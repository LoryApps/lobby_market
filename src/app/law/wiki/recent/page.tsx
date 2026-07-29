'use client'

/**
 * /law/wiki/recent — Recent edits to law wiki articles.
 *
 * Mirrors /topic/wiki/recent but surfaces established laws whose
 * wiki_content has been recently edited.  Shows:
 *   - Editor attribution (avatar + username + role)
 *   - How much content was added/removed (char delta)
 *   - Time since edit
 *   - Law category, established date, vote split
 *   - First 220 chars of the wiki article as a preview
 *   - Category filter pills
 *   - Infinite scroll (load more)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Clock,
  FileEdit,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawWikiRecentEdit, LawWikiRecentResponse } from '@/app/api/law/wiki/recent/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Philosophy',
  'Science',
  'Culture',
  'Health',
  'Environment',
  'Education',
  'Other',
]

const ROLE_COLORS: Record<string, string> = {
  admin: 'text-gold',
  oracle: 'text-purple',
  magistrate: 'text-gold',
  senator: 'text-for-400',
  troll_catcher: 'text-emerald',
  moderator: 'text-against-400',
  citizen: 'text-surface-500',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold bg-gold/10 border-gold/30',
  Politics: 'text-for-400 bg-for-500/10 border-for-500/30',
  Technology: 'text-purple bg-purple/10 border-purple/30',
  Science: 'text-emerald bg-emerald/10 border-emerald/30',
  Ethics: 'text-against-400 bg-against-500/10 border-against-500/30',
  Philosophy: 'text-purple bg-purple/10 border-purple/30',
  Culture: 'text-gold bg-gold/10 border-gold/30',
  Health: 'text-emerald bg-emerald/10 border-emerald/30',
  Environment: 'text-emerald bg-emerald/10 border-emerald/30',
  Education: 'text-for-400 bg-for-500/10 border-for-500/30',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function estDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function charDeltaLabel(delta: number | null): { label: string; color: string } | null {
  if (delta === null) return null
  if (delta > 0) return { label: `+${delta.toLocaleString()}`, color: 'text-emerald' }
  if (delta < 0) return { label: delta.toLocaleString(), color: 'text-against-400' }
  return { label: '±0', color: 'text-surface-500' }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function EditSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-14 ml-auto" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-3/4" />
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

// ─── Edit card ─────────────────────────────────────────────────────────────────

function EditCard({ edit, index }: { edit: LawWikiRecentEdit; index: number }) {
  const forPct = Math.round(edit.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const preview = edit.wiki_content
    ? truncate(
        edit.wiki_content
          .replace(/\[\[([^\]]+)\]\]/g, '$1')
          .replace(/[*_`#>]/g, ''),
        220
      )
    : null
  const delta = charDeltaLabel(edit.char_delta)
  const catStyle = CATEGORY_COLORS[edit.category ?? ''] ?? 'text-surface-500 bg-surface-300/40 border-surface-400/40'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        href={`/law/${edit.id}/wiki`}
        className="block rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-gold/40 hover:bg-surface-100/80 transition-colors"
      >
        {/* Header: editor + timestamp + delta */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar
            src={edit.editor?.avatar_url}
            fallback={edit.editor?.display_name ?? edit.editor?.username ?? '?'}
            size="xs"
          />
          {edit.editor ? (
            <span
              className={cn(
                'text-xs font-semibold truncate',
                ROLE_COLORS[edit.editor.role] ?? 'text-surface-400'
              )}
            >
              {edit.editor.display_name ?? edit.editor.username}
            </span>
          ) : (
            <span className="text-xs text-surface-500">Anonymous</span>
          )}
          <span className="text-surface-600 text-xs">edited</span>

          {delta && (
            <span
              className={cn(
                'ml-1 text-xs font-mono font-semibold',
                delta.color
              )}
              title="Characters added or removed"
            >
              {delta.label}
            </span>
          )}

          <div className="flex items-center gap-1.5 ml-auto text-surface-500 text-xs">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <time dateTime={edit.wiki_updated_at}>
              {relativeTime(edit.wiki_updated_at)}
            </time>
          </div>
        </div>

        {/* Law statement */}
        <div className="flex items-start gap-2 mb-2">
          <Gavel className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {edit.statement}
          </p>
        </div>

        {/* Wiki content preview */}
        {preview && (
          <p className="text-xs text-surface-400 leading-relaxed line-clamp-2 pl-6 mb-3">
            {preview}
          </p>
        )}

        {/* Footer: category, established, vote split */}
        <div className="flex items-center gap-2 flex-wrap pl-6">
          {edit.category && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                catStyle
              )}
            >
              {edit.category}
            </span>
          )}
          <Badge variant="law" className="text-[11px]">
            <Gavel className="h-2.5 w-2.5 mr-0.5" aria-hidden="true" />
            LAW
          </Badge>
          {edit.established_at && (
            <span className="flex items-center gap-1 text-[11px] text-surface-500">
              <Clock className="h-2.5 w-2.5" aria-hidden="true" />
              {estDate(edit.established_at)}
            </span>
          )}
          {(edit.total_votes ?? 0) > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-surface-500 ml-auto">
              <Scale className="h-2.5 w-2.5" aria-hidden="true" />
              {forPct}% · {againstPct}%
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LawWikiRecentPage() {
  const [edits, setEdits] = useState<LawWikiRecentEdit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState('All')
  const [offset, setOffset] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  const hasMore = edits.length < total

  const fetchEdits = useCallback(
    async (cat: string, off: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(off),
        })
        if (cat !== 'All') params.set('category', cat)

        const res = await fetch(`/api/law/wiki/recent?${params}`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data: LawWikiRecentResponse = await res.json()

        setEdits((prev) => (append ? [...prev, ...data.edits] : data.edits))
        setTotal(data.total)
        setOffset(off + data.edits.length)
      } catch {
        // best-effort
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    setEdits([])
    setOffset(0)
    fetchEdits(category, 0, false)
  }, [category, refreshKey, fetchEdits])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchEdits(category, offset, true)
    }
  }, [fetchEdits, category, offset, loadingMore, hasMore])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-surface-500 mb-4">
          <Link href="/wiki" className="hover:text-white transition-colors flex items-center gap-1">
            <BookOpen className="h-3 w-3" aria-hidden="true" />
            Wiki
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/law" className="hover:text-white transition-colors flex items-center gap-1">
            <Gavel className="h-3 w-3" aria-hidden="true" />
            Laws
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-surface-400">Recent Changes</span>
        </nav>

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/wiki"
              aria-label="Back to Wiki"
              className="p-1.5 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-gold" aria-hidden="true" />
              <h1 className="text-lg font-bold text-white">Law Wiki — Recent Changes</h1>
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              aria-label="Refresh"
              className="ml-auto p-1.5 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs text-surface-500 pl-12">
            All recent edits to the community law encyclopedia, most recent first.
            {total > 0 && (
              <span className="ml-1 text-surface-400 font-medium">
                {total.toLocaleString()} law{total === 1 ? '' : 's'} with wiki content.
              </span>
            )}
          </p>
        </div>

        {/* Stats strip */}
        {!loading && total > 0 && (
          <div className="flex items-center gap-4 mb-5 px-4 py-3 rounded-2xl bg-surface-100 border border-surface-300">
            <div className="flex items-center gap-1.5 text-xs text-surface-400">
              <TrendingUp className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              <span className="font-medium text-white">{total.toLocaleString()}</span> laws edited
            </div>
            <div className="w-px h-4 bg-surface-300" aria-hidden="true" />
            <div className="flex items-center gap-1.5 text-xs text-surface-400">
              <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
              Established laws with community analysis
            </div>
          </div>
        )}

        {/* Category filter pills */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide"
          role="group"
          aria-label="Filter by category"
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              aria-pressed={category === cat}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                category === cat
                  ? 'bg-gold/20 text-gold border-gold/50'
                  : 'bg-surface-200 text-surface-400 border-surface-300 hover:border-surface-400 hover:text-surface-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Edit list */}
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading law wiki recent edits">
            {Array.from({ length: 6 }).map((_, i) => (
              <EditSkeleton key={i} />
            ))}
          </div>
        ) : edits.length === 0 ? (
          <EmptyState
            icon={FileEdit}
            title="No law wiki edits yet"
            description={
              category !== 'All'
                ? `No ${category} laws have wiki articles yet. Be the first to contribute!`
                : 'No laws have wiki articles yet. Visit a law page to start contributing.'
            }
            action={{ label: 'Browse Laws', href: '/law' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${category}-${refreshKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {edits.map((edit, i) => (
                <EditCard key={edit.id} edit={edit} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Load more */}
        {!loading && hasMore && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                'bg-surface-200 text-surface-300 border-surface-300',
                'hover:bg-surface-300 hover:text-white hover:border-surface-400',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
              {loadingMore ? 'Loading…' : `Load more (${total - edits.length} remaining)`}
            </button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
