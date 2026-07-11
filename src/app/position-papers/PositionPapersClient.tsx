'use client'

/**
 * /position-papers — Civic Position Papers
 *
 * A curated gallery of relay chains that the community has voted "compelling" —
 * presented as official civic position papers. These represent the platform's
 * most persuasive collective arguments FOR or AGAINST major policy debates.
 *
 * Features:
 *   • Filter by side (FOR / AGAINST), category, sort order
 *   • Expandable leg-by-leg breakdown of each position paper
 *   • Compelling vote bar + opposing chain score
 *   • Direct links to original relay chain for voting
 *
 * Distinct from:
 *   /relays/verdicts     — all voted relay results (including rejected)
 *   /relays/hall-of-fame — all-time top relays by any metric
 *   /arguments           — individual argument feed (not collaborative chains)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileText,
  Filter,
  GitMerge,
  Loader2,
  Quote,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PositionPaper, PositionPapersResponse } from '@/app/api/position-papers/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function sideColors(side: 'for' | 'against') {
  return side === 'for'
    ? {
        text: 'text-for-400',
        bg: 'bg-for-500/10',
        border: 'border-for-500/30',
        bar: 'bg-for-500',
        pill: 'bg-for-500/15 text-for-300 border-for-500/30',
        label: 'FOR',
      }
    : {
        text: 'text-against-400',
        bg: 'bg-against-500/10',
        border: 'border-against-500/30',
        bar: 'bg-against-500',
        pill: 'bg-against-500/15 text-against-300 border-against-500/30',
        label: 'AGAINST',
      }
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS = [
  { id: 'compelling', label: 'Most Compelling' },
  { id: 'decisive', label: 'Most Decisive' },
  { id: 'recent', label: 'Most Recent' },
] as const

type SortOption = typeof SORT_OPTIONS[number]['id']

// ─── Leg item ─────────────────────────────────────────────────────────────────

function LegItem({ leg, index }: { leg: PositionPaper['legs'][0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex gap-3"
    >
      {/* Spine */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-surface-300 border border-surface-400 text-[10px] font-mono font-bold text-surface-500">
          {leg.leg_number}
        </div>
        {index < 99 && <div className="w-px flex-1 min-h-[1.5rem] bg-surface-300/60" />}
      </div>
      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar
            src={leg.author_avatar_url}
            fallback={leg.author_display_name || leg.author_username}
            size="xs"
          />
          <Link
            href={`/profile/${leg.author_username}`}
            className="text-[11px] font-semibold text-surface-400 hover:text-white transition-colors"
          >
            {leg.author_display_name || `@${leg.author_username}`}
          </Link>
          {leg.upvote_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gold font-mono ml-auto">
              <ThumbsUp className="h-2.5 w-2.5" />
              {leg.upvote_count}
            </span>
          )}
        </div>
        <p className="text-sm text-surface-600 leading-relaxed">{leg.content}</p>
      </div>
    </motion.div>
  )
}

// ─── Position paper card ───────────────────────────────────────────────────────

function PaperCard({ paper }: { paper: PositionPaper }) {
  const [expanded, setExpanded] = useState(false)
  const colors = sideColors(paper.side)
  const totalVotes = paper.vote_compelling + paper.vote_not_compelling

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        'bg-surface-100/60 backdrop-blur-sm',
        paper.side === 'for' ? 'border-for-500/20' : 'border-against-500/20',
      )}
    >
      {/* Header */}
      <div className={cn('px-5 pt-4 pb-3', colors.bg)}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
              colors.pill,
            )}>
              {colors.label}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-emerald bg-emerald/10 border border-emerald/30 px-2 py-0.5 rounded-full font-mono font-bold">
              <CheckCircle2 className="h-2.5 w-2.5" />
              COMPELLING
            </span>
            {paper.topic_category && (
              <span className="text-[10px] text-surface-500 font-mono">
                {paper.topic_category}
              </span>
            )}
          </div>
          <span className="text-[11px] text-surface-500 font-mono flex-shrink-0">
            {relativeTime(paper.completed_at)}
          </span>
        </div>

        {paper.topic_statement ? (
          <Link
            href={paper.topic_id ? `/topic/${paper.topic_id}` : '#'}
            className="block text-sm font-semibold text-white hover:text-for-300 transition-colors leading-snug mb-3"
          >
            {paper.topic_statement}
          </Link>
        ) : (
          <p className="text-sm font-semibold text-surface-400 mb-3 italic">
            Untethered relay
          </p>
        )}

        {/* Compelling vote bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-emerald font-mono font-semibold">
              {paper.compelling_pct}% Compelling
            </span>
            <span className="text-surface-500 font-mono">
              {totalVotes} votes
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald transition-all duration-500"
              style={{ width: `${paper.compelling_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top leg preview */}
      {paper.legs.length > 0 && !expanded && (
        <div className="px-5 py-3 border-t border-surface-200/60">
          <div className="flex items-start gap-2">
            <Quote className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-surface-600 leading-relaxed line-clamp-3">
              {paper.legs[0].content}
            </p>
          </div>
          {paper.legs.length > 1 && (
            <p className="text-[11px] text-surface-500 mt-1.5 font-mono">
              +{paper.legs.length - 1} more argument{paper.legs.length > 2 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Expanded legs */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pt-4 border-t border-surface-200/60">
              <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-4">
                Full Argument Chain
              </p>
              {paper.legs.map((leg, i) => (
                <LegItem key={leg.id} leg={leg} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-surface-200/60 bg-surface-50/40">
        <div className="flex items-center gap-2">
          <Avatar
            src={paper.starter_avatar_url}
            fallback={paper.starter_display_name || paper.starter_username}
            size="xs"
          />
          <div className="text-[11px] text-surface-500">
            Started by{' '}
            <Link
              href={`/profile/${paper.starter_username}`}
              className="text-surface-400 hover:text-white transition-colors font-medium"
            >
              {paper.starter_display_name || `@${paper.starter_username}`}
            </Link>
          </div>
          <span className="text-[10px] text-surface-600 font-mono ml-1">
            {paper.leg_count}/{paper.max_legs} legs
          </span>
        </div>

        <div className="flex items-center gap-2">
          {paper.opposing_relay_id && paper.opposing_compelling_pct !== null && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-surface-500 font-mono">
              <Scale className="h-3 w-3" />
              Opp: {paper.opposing_compelling_pct}%
            </span>
          )}

          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors font-mono"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse argument chain' : 'Expand argument chain'}
          >
            {expanded ? (
              <><ChevronUp className="h-3.5 w-3.5" /> Collapse</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5" /> Expand</>
            )}
          </button>

          <Link
            href={`/relays/${paper.relay_id}`}
            className={cn(
              'flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-colors',
              colors.pill,
              'hover:border-opacity-60',
            )}
          >
            View <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function PaperSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-200/60 bg-surface-100/60 overflow-hidden">
      <div className="px-5 pt-4 pb-3 bg-surface-200/30">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
      <div className="px-5 py-3 border-t border-surface-200/60">
        <Skeleton className="h-3.5 w-full mb-1" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      <div className="px-5 py-3 border-t border-surface-200/60 flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PositionPapersClient() {
  const [papers, setPapers] = useState<PositionPaper[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [side, setSide] = useState<'' | 'for' | 'against'>('')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<SortOption>('compelling')
  const [showFilters, setShowFilters] = useState(false)

  const offsetRef = useRef(0)

  const buildUrl = useCallback(
    (offset: number) => {
      const params = new URLSearchParams()
      if (side) params.set('side', side)
      if (category) params.set('category', category)
      params.set('sort', sort)
      params.set('limit', '12')
      params.set('offset', String(offset))
      return `/api/position-papers?${params}`
    },
    [side, category, sort],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    offsetRef.current = 0
    try {
      const res = await fetch(buildUrl(0))
      const json: PositionPapersResponse = await res.json()
      if (!res.ok) throw new Error('Failed to load position papers')
      setPapers(json.papers)
      setTotal(json.total)
      setHasMore(json.has_more)
      offsetRef.current = json.papers.length
    } catch {
      setError('Could not load position papers. Try again.')
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(buildUrl(offsetRef.current))
      const json: PositionPapersResponse = await res.json()
      setPapers((prev) => [...prev, ...json.papers])
      setHasMore(json.has_more)
      offsetRef.current += json.papers.length
    } catch {
      // ignore
    } finally {
      setLoadingMore(false)
    }
  }, [buildUrl, hasMore, loadingMore])

  useEffect(() => {
    load()
  }, [load])

  const activeFilterCount = [side, category].filter(Boolean).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/relays"
                className="text-surface-500 hover:text-white transition-colors"
                aria-label="Back to Relays"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald" />
                <h1 className="text-xl font-bold text-white">Civic Position Papers</h1>
              </div>
            </div>
            <p className="text-sm text-surface-500 ml-6">
              Community-validated relay chains — the platform&apos;s definitive collective arguments.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh"
              className="p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={() => setShowFilters((f) => !f)}
              aria-label="Toggle filters"
              aria-expanded={showFilters}
              className={cn(
                'relative flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-mono transition-colors',
                showFilters
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white',
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 w-4 rounded-full bg-for-500 text-white text-[9px] font-mono font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {!loading && total > 0 && (
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 mb-5 text-[12px] text-surface-500 font-mono">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
              {total} position paper{total !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-for-400" />
              Community validated
            </span>
            <span className="flex items-center gap-1.5">
              <GitMerge className="h-3.5 w-3.5 text-purple" />
              Relay chains
            </span>
          </div>
        )}

        {/* Filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-5"
            >
              <div className="space-y-4 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60">
                {/* Sort */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Sort</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSort(opt.id)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-mono border transition-colors',
                          sort === opt.id
                            ? 'bg-for-500/20 border-for-500/40 text-for-300'
                            : 'bg-surface-300 border-surface-400 text-surface-500 hover:text-white',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Side */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Side</p>
                  <div className="flex items-center gap-2">
                    {([['', 'All'], ['for', 'FOR'], ['against', 'AGAINST']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setSide(val)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-mono border transition-colors',
                          side === val
                            ? val === 'for'
                              ? 'bg-for-500/20 border-for-500/40 text-for-300'
                              : val === 'against'
                              ? 'bg-against-500/20 border-against-500/40 text-against-300'
                              : 'bg-for-500/20 border-for-500/40 text-for-300'
                            : 'bg-surface-300 border-surface-400 text-surface-500 hover:text-white',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Category</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setCategory('')}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-mono border transition-colors',
                        !category
                          ? 'bg-for-500/20 border-for-500/40 text-for-300'
                          : 'bg-surface-300 border-surface-400 text-surface-500 hover:text-white',
                      )}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategory(category === cat ? '' : cat)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-xs font-mono border transition-colors',
                          category === cat
                            ? 'bg-for-500/20 border-for-500/40 text-for-300'
                            : 'bg-surface-300 border-surface-400 text-surface-500 hover:text-white',
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setSide(''); setCategory('') }}
                    className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors font-mono"
                  >
                    <X className="h-3 w-3" /> Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sort tabs (always visible) */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSort(opt.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border whitespace-nowrap transition-colors',
                sort === opt.id
                  ? 'bg-emerald/15 border-emerald/30 text-emerald'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
              )}
            >
              {opt.id === 'compelling' && <TrendingUp className="h-3 w-3" />}
              {opt.id === 'decisive' && <BarChart2 className="h-3 w-3" />}
              {opt.id === 'recent' && <ChevronRight className="h-3 w-3" />}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PaperSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-surface-500 text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 mx-auto text-sm text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : papers.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No position papers yet"
            description={
              activeFilterCount > 0
                ? 'No relay chains match your current filters. Try clearing them.'
                : 'Position papers appear here when relay chains are voted compelling by the community. Start a relay chain to contribute.'
            }
            action={
              activeFilterCount > 0
                ? { label: 'Clear filters', onClick: () => { setSide(''); setCategory('') } }
                : { label: 'Start a relay', href: '/relays/create' }
            }
          />
        ) : (
          <div className="space-y-4">
            {papers.map((paper) => (
              <PaperCard key={paper.relay_id} paper={paper} />
            ))}

            {/* Load more */}
            {hasMore && (
              <div className="pt-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-mono transition-colors',
                    'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                    loadingMore && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Loading…</>
                  ) : (
                    <>Load more papers</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
