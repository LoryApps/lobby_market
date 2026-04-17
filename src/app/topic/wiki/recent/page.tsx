'use client'

/**
 * /topic/wiki/recent — Wikipedia-style "Recent Changes" feed.
 *
 * Shows all topics whose context/description was recently edited, with:
 *   - Editor attribution (avatar + username + role)
 *   - Time since edit
 *   - Topic status, category, vote split
 *   - First 280 chars of the description as a preview
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
  Loader2,
  RefreshCw,
  Tag,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { WikiRecentEdit, WikiRecentResponse } from '@/app/api/topics/wiki/recent/route'

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

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
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

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
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

function EditCard({ edit, index }: { edit: WikiRecentEdit; index: number }) {
  const forPct = Math.round(edit.blue_pct)
  const againstPct = 100 - forPct
  const preview = edit.description ? truncate(edit.description.replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/[*_`#>]/g, ''), 220) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Link
        href={`/topic/wiki/${edit.id}`}
        className={cn(
          'group block rounded-2xl bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/60 transition-all duration-150',
          'p-5 space-y-3'
        )}
      >
        {/* Editor attribution row */}
        <div className="flex items-center gap-2 min-w-0">
          {edit.editor ? (
            <>
              <Avatar
                src={edit.editor.avatar_url}
                fallback={edit.editor.display_name ?? edit.editor.username}
                size="xs"
                className="flex-shrink-0"
              />
              <span className={cn('text-xs font-mono font-semibold flex-shrink-0', ROLE_COLORS[edit.editor.role] ?? 'text-surface-500')}>
                @{edit.editor.username}
              </span>
              <span className="text-xs font-mono text-surface-500 flex-shrink-0">edited context</span>
            </>
          ) : (
            <span className="text-xs font-mono text-surface-500">Context edited</span>
          )}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500 flex-shrink-0">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {relativeTime(edit.description_updated_at)}
          </span>
        </div>

        {/* Topic statement */}
        <p className="font-mono text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
          {edit.statement}
        </p>

        {/* Description preview */}
        {preview && (
          <p className="text-xs font-mono text-surface-500 leading-relaxed line-clamp-2">
            {preview}
          </p>
        )}

        {/* Footer: badges + vote split */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={STATUS_BADGE[edit.status] ?? 'proposed'}>
            {edit.status === 'law' ? 'LAW' : edit.status.charAt(0).toUpperCase() + edit.status.slice(1)}
          </Badge>
          {edit.category && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500 bg-surface-200 border border-surface-300 rounded-full px-2 py-0.5">
              <Tag className="h-3 w-3" aria-hidden="true" />
              {edit.category}
            </span>
          )}
          {edit.total_votes > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono tabular-nums flex-shrink-0">
              <span className="text-for-400 font-semibold">{forPct}%</span>
              <span className="text-surface-500">/</span>
              <span className="text-against-400 font-semibold">{againstPct}%</span>
              <span className="text-surface-600">· {edit.total_votes.toLocaleString()} votes</span>
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function WikiRecentPage() {
  const [edits, setEdits] = useState<WikiRecentEdit[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('All')
  const [offset, setOffset] = useState(0)

  const fetchEdits = useCallback(
    async (cat: string, off: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(off),
        })
        if (cat !== 'All') params.set('category', cat)

        const res = await fetch(`/api/topics/wiki/recent?${params}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: WikiRecentResponse = await res.json()

        setEdits((prev) => (append ? [...prev, ...data.edits] : data.edits))
        setTotal(data.total)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recent edits')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  // Initial load + category change
  useEffect(() => {
    setOffset(0)
    fetchEdits(category, 0, false)
  }, [category, fetchEdits])

  function handleLoadMore() {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    fetchEdits(category, newOffset, true)
  }

  function handleRefresh() {
    setOffset(0)
    fetchEdits(category, 0, false)
  }

  const hasMore = edits.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12" id="main-content">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/topic/categories"
                aria-label="Back to categories"
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                  'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                  'transition-colors'
                )}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                  <FileEdit className="h-5 w-5 text-emerald" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white leading-none">
                    Recent Wiki Edits
                  </h1>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    {total > 0 ? `${total.toLocaleString()} topics with community context` : 'Topics with community-written context'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={loading}
              aria-label="Refresh recent edits"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors disabled:opacity-40 disabled:pointer-events-none'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>

          {/* ── What is this? blurb ── */}
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-200/60 border border-surface-300 px-4 py-3 mb-4">
            <BookOpen className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              Community members add context to topics — background, sources, and key facts — like a Wikipedia article for each debate. This feed shows the most recent edits, newest first.
            </p>
          </div>

          {/* ── Category filter pills ── */}
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
                    ? 'bg-emerald/15 text-emerald border-emerald/40'
                    : 'bg-surface-200/60 text-surface-500 border-surface-300 hover:text-surface-700 hover:border-surface-400'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EditSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <FileEdit className="h-8 w-8 text-surface-500 mx-auto mb-3" aria-hidden="true" />
            <p className="font-mono text-sm text-surface-500 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 text-sm font-mono transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : edits.length === 0 ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center">
            <BookOpen className="h-10 w-10 text-surface-500 mx-auto mb-4" aria-hidden="true" />
            <h2 className="font-mono text-lg font-semibold text-white mb-2">No edits yet</h2>
            <p className="font-mono text-sm text-surface-500 mb-6 max-w-xs mx-auto">
              {category !== 'All'
                ? `No topics in ${category} have community context yet. Be the first to add some.`
                : 'No topics have community context yet. Open any topic and click the Edit button to start building the wiki.'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald/15 text-emerald border border-emerald/30 hover:bg-emerald/25 text-sm font-mono transition-colors"
            >
              Browse topics
            </Link>
          </div>
        ) : (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={category}
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
