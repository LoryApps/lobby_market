'use client'

/**
 * /transcripts — The Civic Debate Archive
 *
 * A browsable, searchable archive of every resolved topic, showing its
 * outcome and the strongest FOR and AGAINST arguments that shaped the
 * community's verdict.
 *
 * Distinct from:
 *   /verdicts        — personal outcome view (did YOU win / lose?)
 *   /law             — laws-only codex
 *   /topic/[id]/transcript — full argument history for a single topic
 *   /newspaper       — curated editorial (not exhaustive)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Gavel,
  Loader2,
  MessageSquare,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  Vote,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type {
  TranscriptSummary,
  TranscriptsResponse,
  TranscriptArgument,
} from '@/app/api/transcripts/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Ethics',
  'Science',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

type FilterType = 'all' | 'law' | 'failed'
type SortType = 'recent' | 'votes' | 'arguments'

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All Outcomes',
  law: 'Passed into Law',
  failed: 'Failed',
}

const SORT_LABELS: Record<SortType, string> = {
  recent: 'Most Recent',
  votes: 'Most Votes',
  arguments: 'Most Arguments',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

function truncate(text: string, max = 140): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ArgumentSnippet({
  arg,
  side,
}: {
  arg: TranscriptArgument
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'rounded-lg p-3 border flex-1 min-w-0',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        {isFor ? (
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-[10px] font-mono font-semibold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {arg.ai_grade && (
          <span
            className={cn(
              'ml-auto text-[10px] font-mono font-bold',
              arg.ai_grade === 'A'
                ? 'text-emerald'
                : arg.ai_grade === 'B'
                ? 'text-for-400'
                : arg.ai_grade === 'C'
                ? 'text-gold'
                : 'text-surface-500'
            )}
          >
            {arg.ai_grade}
          </span>
        )}
      </div>
      <p className="text-xs text-surface-200 leading-relaxed line-clamp-3">
        {truncate(arg.content, 160)}
      </p>
      <div className="mt-2 flex items-center gap-2">
        {arg.author && (
          <div className="flex items-center gap-1 min-w-0">
            <Avatar
              src={arg.author_avatar}
              fallback={arg.author}
              size="xs"
            />
            <span className="text-[10px] text-surface-500 truncate">
              @{arg.author}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <ThumbsUp className="h-3 w-3 text-surface-500" />
          <span className="text-[10px] text-surface-500 font-mono">
            {arg.upvotes}
          </span>
        </div>
      </div>
    </div>
  )
}

function TranscriptCard({ t }: { t: TranscriptSummary }) {
  const forPct = Math.round(t.blue_pct)
  const againstPct = 100 - forPct
  const isLaw = t.status === 'law'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-xl border bg-surface-100 overflow-hidden',
        isLaw
          ? 'border-emerald/20 hover:border-emerald/35'
          : 'border-against-500/15 hover:border-against-500/25',
        'transition-colors'
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 mt-0.5',
              isLaw
                ? 'bg-emerald/10 border border-emerald/30'
                : 'bg-against-500/10 border border-against-500/30'
            )}
          >
            {isLaw ? (
              <Gavel className="h-4 w-4 text-emerald" />
            ) : (
              <XCircle className="h-4 w-4 text-against-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant={isLaw ? 'law' : 'failed'}>
                {isLaw ? 'LAW' : 'FAILED'}
              </Badge>
              {t.category && (
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                  {t.category}
                </span>
              )}
              <span className="text-[10px] font-mono text-surface-600 ml-auto flex-shrink-0">
                {relativeTime(t.resolved_at)}
              </span>
            </div>

            <Link
              href={
                isLaw && t.law_id
                  ? `/law/${t.law_id}`
                  : `/topic/${t.id}`
              }
              className="group"
            >
              <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
                {t.statement}
              </h3>
            </Link>
          </div>
        </div>

        {/* ── Vote bar ──────────────────────────────────────────────────── */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono text-for-400 font-semibold">
              {forPct}% For
            </span>
            <span className="text-[11px] font-mono text-surface-500">
              {t.total_votes.toLocaleString()} votes
            </span>
            <span className="text-[11px] font-mono text-against-400 font-semibold">
              {againstPct}% Against
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500 transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Arguments ──────────────────────────────────────────────────── */}
      {(t.top_for || t.top_against) && (
        <div className="px-4 pb-3 flex gap-2">
          {t.top_for ? (
            <ArgumentSnippet arg={t.top_for} side="for" />
          ) : (
            <div className="flex-1 rounded-lg p-3 border border-surface-300/30 bg-surface-200/30 flex items-center justify-center">
              <span className="text-[10px] text-surface-600 font-mono">
                No FOR arguments
              </span>
            </div>
          )}
          {t.top_against ? (
            <ArgumentSnippet arg={t.top_against} side="against" />
          ) : (
            <div className="flex-1 rounded-lg p-3 border border-surface-300/30 bg-surface-200/30 flex items-center justify-center">
              <span className="text-[10px] text-surface-600 font-mono">
                No AGAINST arguments
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="px-4 pb-3 flex items-center gap-3 border-t border-surface-200/50 pt-3">
        <div className="flex items-center gap-1 text-surface-500">
          <MessageSquare className="h-3.5 w-3.5" />
          <span className="text-xs font-mono">
            {t.total_arguments.toLocaleString()} argument{t.total_arguments !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/topic/${t.id}/transcript`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-surface-200 border border-surface-300/60 text-surface-300 hover:text-white hover:border-surface-400 transition-colors"
          >
            <BookOpen className="h-3 w-3" />
            Full Transcript
          </Link>

          {isLaw && t.law_id && (
            <Link
              href={`/law/${t.law_id}`}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-emerald/10 border border-emerald/30 text-emerald hover:bg-emerald/20 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View Law
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TranscriptsClient() {
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const [filter, setFilter]     = useState<FilterType>('all')
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort]         = useState<SortType>('recent')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSortMenu, setShowSortMenu] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTranscripts = useCallback(
    async (cursor: string | null = null) => {
      const isFirstPage = !cursor
      if (isFirstPage) setLoading(true)
      else setLoadingMore(true)

      try {
        const params = new URLSearchParams({ filter, sort })
        if (category !== 'All') params.set('category', category)
        if (searchQuery.trim()) params.set('q', searchQuery.trim())
        if (cursor) params.set('cursor', cursor)

        const res = await fetch(`/api/transcripts?${params}`)
        if (!res.ok) throw new Error('Failed to load')
        const data: TranscriptsResponse = await res.json()

        setTranscripts((prev) =>
          isFirstPage ? data.transcripts : [...prev, ...data.transcripts]
        )
        setHasMore(data.has_more)
        setNextCursor(data.next_cursor)
        setTotal(data.total)
      } catch {
        // silent
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter, sort, category, searchQuery]
  )

  useEffect(() => {
    fetchTranscripts(null)
  }, [fetchTranscripts])

  // ── Search submit ──────────────────────────────────────────────────────────

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSearchQuery(searchInput)
  }

  function clearSearch() {
    setSearchInput('')
    setSearchQuery('')
  }

  // ── Close sort menu on outside click ──────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Archive className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Debate Archive
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The complete civic record — every resolved debate with its key arguments
              </p>
            </div>
          </div>

          {/* Stats strip */}
          {!loading && total > 0 && (
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                <Scale className="h-3.5 w-3.5 text-purple" />
                <span className="text-white font-semibold">{total}</span>
                <span>resolved debate{total !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                <Gavel className="h-3.5 w-3.5 text-emerald" />
                <span>
                  {transcripts.filter((t) => t.status === 'law').length} laws
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                <Vote className="h-3.5 w-3.5 text-for-400" />
                <span>
                  {transcripts
                    .reduce((s, t) => s + t.total_votes, 0)
                    .toLocaleString()}{' '}
                  votes
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className="mb-6 space-y-3">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search debate topics…"
              className="w-full pl-9 pr-10 py-2.5 bg-surface-200 border border-surface-300/60 rounded-xl text-sm text-white placeholder:text-surface-500 font-mono focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/30 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Filter row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Outcome filter */}
            {(['all', 'law', 'failed'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors',
                  filter === f
                    ? f === 'law'
                      ? 'bg-emerald/15 border-emerald/40 text-emerald'
                      : f === 'failed'
                      ? 'bg-against-500/15 border-against-500/40 text-against-400'
                      : 'bg-purple/15 border-purple/40 text-purple'
                    : 'bg-surface-200 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400'
                )}
              >
                {f === 'law' && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                {f === 'failed' && <XCircle className="inline h-3 w-3 mr-1" />}
                {FILTER_LABELS[f]}
              </button>
            ))}

            {/* Sort menu */}
            <div className="relative ml-auto" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu((s) => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium bg-surface-200 border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                {SORT_LABELS[sort]}
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform',
                    showSortMenu && 'rotate-180'
                  )}
                />
              </button>

              <AnimatePresence>
                {showSortMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-surface-300/60 bg-surface-100 shadow-xl"
                  >
                    {(['recent', 'votes', 'arguments'] as SortType[]).map(
                      (s) => (
                        <button
                          key={s}
                          onClick={() => {
                            setSort(s)
                            setShowSortMenu(false)
                          }}
                          className={cn(
                            'w-full text-left px-4 py-2.5 text-xs font-mono transition-colors first:rounded-t-xl last:rounded-b-xl',
                            sort === s
                              ? 'text-white bg-surface-300/50'
                              : 'text-surface-400 hover:text-white hover:bg-surface-200/80'
                          )}
                        >
                          {SORT_LABELS[s]}
                        </button>
                      )
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Category pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-full text-xs font-mono font-medium border transition-colors',
                  category === cat
                    ? 'bg-for-500/15 border-for-500/40 text-for-400'
                    : 'bg-surface-200 border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : transcripts.length === 0 ? (
          <EmptyState
            icon={Archive}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No transcripts found"
            description={
              searchQuery
                ? `No resolved debates match "${searchQuery}"`
                : 'No resolved debates match these filters yet.'
            }
            actions={[
              {
                label: 'Clear filters',
                onClick: () => {
                  setFilter('all')
                  setCategory('All')
                  setSort('recent')
                  setSearchQuery('')
                  setSearchInput('')
                },
              },
              { label: 'Browse Topics', href: '/' },
            ]}
          />
        ) : (
          <>
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {transcripts.map((t) => (
                  <TranscriptCard key={t.id} t={t} />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => fetchTranscripts(nextCursor)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-mono font-medium bg-surface-200 border border-surface-300/60 text-surface-300 hover:text-white hover:border-surface-400 disabled:opacity-50 transition-colors"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Load more
                </button>
              </div>
            )}

            {!hasMore && transcripts.length > 0 && (
              <div className="mt-8 text-center">
                <div className="flex items-center gap-2 justify-center text-xs font-mono text-surface-600">
                  <Archive className="h-3.5 w-3.5" />
                  <span>
                    {transcripts.length} debate{transcripts.length !== 1 ? 's' : ''} in the archive
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
