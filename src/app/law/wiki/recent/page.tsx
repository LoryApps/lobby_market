'use client'

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

function charDeltaLabel(delta: number | null): { label: string; color: string; bg: string } | null {
  if (delta === null) return null
  if (delta > 0) return { label: `+${delta.toLocaleString()}`, color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30' }
  if (delta < 0) return { label: delta.toLocaleString(), color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' }
  return { label: '±0', color: 'text-surface-500', bg: 'bg-surface-300/40 border-surface-400/40' }
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function EditSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-4 w-12 rounded-full ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
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
        className={cn(
          'group block rounded-2xl bg-surface-100 border border-surface-300',
          'hover:border-gold/40 hover:bg-surface-200/50 transition-all duration-150',
          'p-5 space-y-3'
        )}
      >
        {/* Editor attribution row */}
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={edit.editor?.avatar_url}
            fallback={edit.editor?.display_name ?? edit.editor?.username ?? '?'}
            size="xs"
            className="flex-shrink-0"
          />
          {edit.editor ? (
            <>
              <span
                className={cn(
                  'text-xs font-mono font-semibold flex-shrink-0',
                  ROLE_COLORS[edit.editor.role] ?? 'text-surface-400'
                )}
              >
                @{edit.editor.username}
              </span>
              <span className="text-xs font-mono text-surface-500 flex-shrink-0">edited law wiki</span>
            </>
          ) : (
            <span className="text-xs font-mono text-surface-500">Law wiki edited</span>
          )}

          {delta && (
            <span
              className={cn(
                'ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border flex-shrink-0',
                delta.color, delta.bg
              )}
              title="Characters added or removed"
            >
              {delta.label}
            </span>
          )}

          <div className="flex items-center gap-1 ml-auto text-[11px] font-mono text-surface-500 flex-shrink-0">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <time dateTime={edit.wiki_updated_at}>
              {relativeTime(edit.wiki_updated_at)}
            </time>
          </div>
        </div>

        {/* Law statement */}
        <div className="flex items-start gap-2">
          <Gavel className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="font-mono text-sm font-semibold text-white leading-snug group-hover:text-gold/90 transition-colors line-clamp-2">
            {edit.statement}
          </p>
        </div>

        {/* Wiki content preview */}
        {preview && (
          <p className="text-xs font-mono text-surface-500 leading-relaxed line-clamp-2 pl-6">
            {preview}
          </p>
        )}

        {/* Footer: category, established, vote split */}
        <div className="flex items-center gap-2 flex-wrap pl-6">
          {edit.category && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border',
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
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Clock className="h-2.5 w-2.5" aria-hidden="true" />
              {estDate(edit.established_at)}
            </span>
          )}
          {(edit.total_votes ?? 0) > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono tabular-nums flex-shrink-0">
              <Scale className="h-2.5 w-2.5 text-surface-500" aria-hidden="true" />
              <span className="text-for-400 font-semibold">{forPct}%</span>
              <span className="text-surface-600">/</span>
              <span className="text-against-400 font-semibold">{againstPct}%</span>
              <span className="text-surface-600">· {(edit.total_votes ?? 0).toLocaleString()} votes</span>
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
    setOffset(0)
    fetchEdits(category, 0, false)
  }, [category, refreshKey, fetchEdits])

  function handleLoadMore() {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    fetchEdits(category, newOffset, true)
  }

  function handleRefresh() {
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12" id="main-content">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/wiki"
                aria-label="Back to Wiki"
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                  'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                  'transition-colors'
                )}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                  <FileEdit className="h-5 w-5 text-gold" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white leading-none">
                    Law Wiki Edits
                  </h1>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    {total > 0
                      ? `${total.toLocaleString()} laws with community analysis`
                      : 'Community-written law encyclopedia'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors disabled:opacity-40 disabled:pointer-events-none'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>

          {/* Info blurb */}
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-200/60 border border-surface-300 px-4 py-3 mb-4">
            <BookOpen className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              Community members write encyclopedic articles about established laws — history, context, legal analysis, and impact. This feed shows the most recent edits, newest first.
            </p>
          </div>

          {/* Category filter pills */}
          <div
            className={cn(
              'flex gap-1.5 overflow-x-auto pb-1',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
            role="group"
            aria-label="Filter by category"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-150',
                  'border',
                  category === cat
                    ? 'bg-gold/15 text-gold border-gold/40'
                    : 'bg-surface-200/60 text-surface-500 border-surface-300 hover:text-surface-200 hover:border-surface-400'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
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
          <>
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

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl',
                    'bg-surface-200 text-surface-600 hover:bg-surface-300 hover:text-white',
                    'text-sm font-mono font-medium transition-all duration-150',
                    'border border-surface-300',
                    'disabled:opacity-50 disabled:pointer-events-none'
                  )}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      Load more · {total - edits.length} remaining
                    </>
                  )}
                </button>
              </div>
            )}

            {!hasMore && edits.length > 0 && (
              <p className="mt-6 text-center text-xs font-mono text-surface-600">
                All {total.toLocaleString()} edits shown
              </p>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
