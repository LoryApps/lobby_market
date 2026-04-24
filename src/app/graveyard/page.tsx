'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ExternalLink,
  Filter,
  Ghost,
  Loader2,
  Skull,
  TrendingDown,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  GraveyardTopic,
  GraveyardStats,
  GraveyardResponse,
} from '@/app/api/topics/graveyard/route'
import { CAUSE_CONFIG } from '@/lib/graveyard/config'
import type { CauseOfDeath } from '@/lib/graveyard/config'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const SORT_OPTIONS: { id: string; label: string }[] = [
  { id: 'votes', label: 'Most Contested' },
  { id: 'recent', label: 'Most Recent' },
  { id: 'closest', label: 'Closest to Law' },
]

const CAUSE_FILTERS: { id: CauseOfDeath | 'all'; label: string }[] = [
  { id: 'all', label: 'All Causes' },
  { id: 'decisively_rejected', label: 'Decisively Rejected' },
  { id: 'voted_down', label: 'Voted Down' },
  { id: 'narrowly_defeated', label: 'Narrowly Defeated' },
  { id: 'close_but_not_enough', label: 'Majority — Not Enough' },
  { id: 'never_rallied', label: 'Never Rallied' },
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const w = Math.floor(d / 7)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${w}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/40 bg-surface-100/60 p-5 space-y-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-16 rounded" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full rounded" />
      <Skeleton className="h-4 w-3/4 rounded" />
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-12 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function GraveyardCard({ topic }: { topic: GraveyardTopic }) {
  const cause = CAUSE_CONFIG[topic.cause]
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        'group relative rounded-2xl border bg-surface-100/60 p-5 transition-all duration-200',
        'hover:bg-surface-100 hover:border-surface-400/60',
        'border-surface-300/40',
      )}
    >
      {/* Header: category + cause badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {topic.category && (
            <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-wider truncate', catColor)}>
              {topic.category}
            </span>
          )}
          {topic.scope && topic.scope !== 'Global' && (
            <>
              <span className="text-surface-500 text-[10px]">·</span>
              <span className="text-[11px] font-mono text-surface-500 truncate">{topic.scope}</span>
            </>
          )}
        </div>
        <span
          className={cn(
            'flex-shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            cause.bg,
            cause.color,
            cause.border,
          )}
        >
          {cause.label}
        </span>
      </div>

      {/* Statement */}
      <Link href={`/topic/${topic.id}`} className="group/link block mb-3">
        <p className="text-sm font-semibold text-white leading-snug group-hover/link:text-for-200 transition-colors line-clamp-3">
          {topic.statement}
        </p>
      </Link>

      {/* Vote bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        </div>
        {/* Consensus threshold line at 60% */}
        <div
          className="absolute top-0 h-full w-px bg-gold/60"
          style={{ left: '60%' }}
          aria-hidden
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <Vote className="h-3 w-3" />
          {fmt(topic.total_votes)} votes
        </span>
        <span>·</span>
        <span>{topic.days_alive}d lifespan</span>
        <span>·</span>
        <span>Fell {relativeTime(topic.updated_at)}</span>
      </div>

      {/* Hover link */}
      <Link
        href={`/topic/${topic.id}`}
        aria-label="View topic"
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ExternalLink className="h-3.5 w-3.5 text-surface-500 hover:text-white transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: GraveyardStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
      <div className="rounded-xl border border-surface-300/40 bg-surface-100/60 p-4 text-center">
        <p className="text-2xl font-mono font-bold text-white">{fmt(stats.total_failed)}</p>
        <p className="text-[11px] font-mono text-surface-500 mt-0.5 uppercase tracking-wider">Topics Failed</p>
      </div>
      <div className="rounded-xl border border-surface-300/40 bg-surface-100/60 p-4 text-center">
        <p className="text-2xl font-mono font-bold text-against-400">{fmt(stats.total_votes_cast)}</p>
        <p className="text-[11px] font-mono text-surface-500 mt-0.5 uppercase tracking-wider">Votes on Failed Topics</p>
      </div>
      {stats.closest_call_id && stats.closest_call_pct !== null && (
        <div className="col-span-2 md:col-span-1 rounded-xl border border-gold/30 bg-gold/5 p-4">
          <p className="text-[10px] font-mono text-gold uppercase tracking-wider mb-1">Closest Call</p>
          <Link href={`/topic/${stats.closest_call_id}`} className="group/cc">
            <p className="text-xs font-semibold text-white line-clamp-2 group-hover/cc:text-gold transition-colors leading-snug">
              {stats.closest_call_statement}
            </p>
          </Link>
          <p className="text-[11px] font-mono text-gold mt-1.5">
            {Math.round(stats.closest_call_pct)}% For — fell just short
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GraveyardPage() {
  const [topics, setTopics] = useState<GraveyardTopic[]>([])
  const [stats, setStats] = useState<GraveyardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)

  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('votes')
  const [cause, setCause] = useState<CauseOfDeath | 'all'>('all')
  const [showFilters, setShowFilters] = useState(false)

  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const buildUrl = useCallback((cur: string | null) => {
    const params = new URLSearchParams()
    if (category !== 'All') params.set('category', category)
    if (sort !== 'votes') params.set('sort', sort)
    if (cause !== 'all') params.set('cause', cause)
    if (cur) params.set('cursor', cur)
    params.set('limit', '24')
    return `/api/topics/graveyard?${params}`
  }, [category, sort, cause])

  const load = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      setTopics([])
      setCursor(null)
    } else {
      setLoadingMore(true)
    }
    setError(false)

    try {
      const cur = reset ? null : cursor
      const res = await fetch(buildUrl(cur))
      if (!res.ok) throw new Error()
      const data: GraveyardResponse = await res.json()

      setTopics((prev) => reset ? data.topics : [...prev, ...data.topics])
      setHasMore(data.has_more)
      setCursor(data.next_cursor)
      if (reset && data.stats.total_failed > 0) setStats(data.stats)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [buildUrl, cursor])

  // Reset on filter change
  useEffect(() => { load(true) }, [category, sort, cause]) // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return
    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          load(false)
        }
      },
      { rootMargin: '200px' },
    )
    observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [hasMore, loadingMore, load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-300">
              <Skull className="h-5 w-5 text-surface-500" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">The Graveyard</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Topics that never became law — and the stories of why
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed max-w-2xl">
            Every failed proposal leaves a record. Browse the topics that were proposed, debated, and ultimately rejected by the Lobby. Some fell decisively; others missed by a single percentage point.
          </p>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────────── */}
        {stats && !loading && <StatsBar stats={stats} />}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Filters ────────────────────────────────────────────────────────── */}
        <div className="mb-6 space-y-3">
          {/* Sort + filter toggle row */}
          <div className="flex flex-wrap items-center gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                  sort === opt.id
                    ? 'bg-surface-200 border-surface-400 text-white'
                    : 'bg-transparent border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-surface-400',
                )}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setShowFilters((f) => !f)}
              className={cn(
                'ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                showFilters
                  ? 'bg-surface-200 border-surface-400 text-white'
                  : 'bg-transparent border-surface-300/40 text-surface-500 hover:border-surface-400',
              )}
              aria-expanded={showFilters}
            >
              <Filter className="h-3 w-3" />
              Filters
              <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
            </button>
          </div>

          {/* Expanded filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-1">
                  {/* Category */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                            category === cat
                              ? 'bg-surface-200 border-surface-400 text-white'
                              : 'border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-surface-400',
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Cause of death */}
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Cause of Death</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CAUSE_FILTERS.map((cf) => {
                        const config = cf.id !== 'all' ? CAUSE_CONFIG[cf.id] : null
                        return (
                          <button
                            key={cf.id}
                            onClick={() => setCause(cf.id)}
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                              cause === cf.id
                                ? config
                                  ? cn(config.bg, config.border, config.color)
                                  : 'bg-surface-200 border-surface-400 text-white'
                                : 'border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-surface-400',
                            )}
                          >
                            {cf.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <TopicSkeleton key={i} />)}
          </div>
        ) : error ? (
          <EmptyState
            icon={TrendingDown}
            title="Failed to load the graveyard"
            description="Something went wrong fetching the data. Please try again."
            actions={[{ label: 'Retry', onClick: () => load(true) }]}
          />
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Ghost}
            title="No fallen topics found"
            description={
              category !== 'All' || cause !== 'all'
                ? 'Try adjusting your filters to see more results.'
                : 'No topics have failed yet — the Lobby is thriving.'
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence mode="popLayout">
                {topics.map((topic) => (
                  <GraveyardCard key={topic.id} topic={topic} />
                ))}
              </AnimatePresence>
            </div>

            {/* Load more sentinel */}
            <div ref={sentinelRef} className="h-1" aria-hidden />

            {loadingMore && (
              <div className="flex justify-center mt-6">
                <Loader2 className="h-5 w-5 text-surface-500 animate-spin" />
              </div>
            )}

            {!hasMore && topics.length > 0 && (
              <p className="text-center text-xs font-mono text-surface-500 mt-8">
                {topics.length} topic{topics.length !== 1 ? 's' : ''} in the graveyard
              </p>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
