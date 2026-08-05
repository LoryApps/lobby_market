'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  Clock,
  ExternalLink,
  Hourglass,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { EldersResponse, ElderTopic } from '@/app/api/topics/elders/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000

type SortKey = 'age' | 'votes' | 'consensus'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'age', label: 'Oldest first' },
  { key: 'votes', label: 'Most debated' },
  { key: 'consensus', label: 'Near verdict' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysLabel(days: number): string {
  if (days >= 365) {
    const y = Math.floor(days / 365)
    return `${y}y`
  }
  if (days >= 30) {
    const m = Math.floor(days / 30)
    return `${m}mo`
  }
  return `${days}d`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-xl" />
      </div>
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-2.5 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function ElderCard({ topic, rank }: { topic: ElderTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const isNearVote = topic.status === 'voting'
  const isDeadlocked = Math.abs(forPct - 50) < 5

  // Age tiers for colour coding
  const ageTier =
    topic.days_alive >= 180
      ? 'ancient' // 6+ months
      : topic.days_alive >= 90
      ? 'veteran' // 3–6 months
      : 'elder' // 1–3 months

  const ageColor =
    ageTier === 'ancient'
      ? 'text-gold'
      : ageTier === 'veteran'
      ? 'text-amber-400'
      : 'text-surface-400'

  const ageBg =
    ageTier === 'ancient'
      ? 'bg-gold/10 border-gold/30 text-gold'
      : ageTier === 'veteran'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
      : 'bg-surface-200 border-surface-400 text-surface-300'

  const cardBorder = isDeadlocked
    ? 'border-against-500/30'
    : ageTier === 'ancient'
    ? 'border-gold/30'
    : 'border-surface-300'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(rank * 0.05, 0.4) }}
      className={cn(
        'rounded-2xl bg-surface-100 border transition-all duration-200',
        'hover:border-surface-400 hover:bg-surface-150',
        cardBorder,
      )}
    >
      <Link href={`/topic/${topic.id}`} className="block p-5 space-y-3.5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest border',
                isNearVote
                  ? 'bg-purple/15 border-purple/40 text-purple'
                  : 'bg-for-500/10 border-for-500/30 text-for-400',
              )}
            >
              {isNearVote ? <Scale className="h-2.5 w-2.5" /> : <TrendingUp className="h-2.5 w-2.5" />}
              {isNearVote ? 'Voting' : topic.status}
            </span>

            {/* Deadlock pill */}
            {isDeadlocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border bg-against-500/10 border-against-500/30 text-against-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
                Deadlocked
              </span>
            )}

            {/* Category */}
            {topic.category && (
              <Badge variant="default" className="text-[10px]">
                {topic.category}
              </Badge>
            )}
          </div>

          {/* Days alive badge */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-mono font-bold border',
              ageBg,
            )}
          >
            <Hourglass className="h-3 w-3" />
            {daysLabel(topic.days_alive)}
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm font-semibold text-white leading-snug line-clamp-3">
          {topic.statement}
        </p>

        {/* Vote split */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-for-400 font-bold">{forPct}% FOR</span>
            <span className="text-against-400 font-bold">{againstPct}% AGAINST</span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={forPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${forPct}% for, ${againstPct}% against`}
            className="relative h-2.5 w-full rounded-full bg-against-900/40 overflow-hidden"
          >
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-for-600 to-for-400"
              initial={false}
              animate={{ width: `${forPct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            />
          </div>

          {/* Footer metadata */}
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {topic.total_votes.toLocaleString()} votes
            </span>
            <span className="flex items-center gap-2">
              {topic.argument_count > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {topic.argument_count}
                </span>
              )}
              <span className={cn('font-semibold', ageColor)}>
                {topic.days_alive} days unresolved
              </span>
              <ExternalLink className="h-3 w-3" />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EldersClient() {
  const [topics, setTopics] = useState<ElderTopic[]>([])
  const [stats, setStats] = useState<EldersResponse['stats'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [sort, setSort] = useState<SortKey>('age')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTopics = useCallback(
    async (off = 0, append = false, sortKey = sort) => {
      if (!append) setLoading(true)
      else setLoadingMore(true)
      try {
        const params = new URLSearchParams({
          sort: sortKey,
          limit: '20',
          offset: String(off),
        })
        const res = await fetch(`/api/topics/elders?${params.toString()}`)
        if (!res.ok) throw new Error('Failed')
        const data: EldersResponse = await res.json()
        const incoming = data.topics ?? []
        setTopics((prev) => (append ? [...prev, ...incoming] : incoming))
        setStats(data.stats)
        setHasMore(data.has_more)
        setOffset(off + incoming.length)
      } catch {
        // silent fail
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [sort],
  )

  useEffect(() => {
    fetchTopics(0, false, sort)
    intervalRef.current = setInterval(() => {
      fetchTopics(0, false, sort)
    }, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchTopics, sort])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    await fetchTopics(0, false, sort)
    setRefreshing(false)
  }, [refreshing, fetchTopics, sort])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    fetchTopics(offset, true, sort)
  }, [loadingMore, hasMore, offset, fetchTopics, sort])

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sort) return
      setSort(key)
      setOffset(0)
    },
    [sort],
  )

  const ancientCount = topics.filter((t) => t.days_alive >= 180).length
  const deadlockedCount = topics.filter((t) => Math.abs(t.blue_pct - 50) < 5).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
                <Hourglass className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white leading-none">
                  The Civic Elders
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Questions still awaiting a verdict
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          <p className="text-sm text-surface-500 leading-relaxed">
            These debates have been open for at least{' '}
            <span className="text-gold font-mono font-semibold">30 days</span> with no resolution.
            Some have been waiting for months. Come help the community finally reach a verdict.
          </p>

          {/* Stats strip */}
          {!loading && stats && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap items-center gap-4 p-3 rounded-xl bg-surface-100 border border-surface-300"
            >
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-gold font-bold">{stats.total_elders}</span>
                <span className="text-surface-500">unresolved</span>
              </div>
              <div className="h-3 w-px bg-surface-300" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-amber-400 font-bold">{stats.oldest_days}d</span>
                <span className="text-surface-500">oldest</span>
              </div>
              <div className="h-3 w-px bg-surface-300" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-surface-300 font-bold">{stats.avg_days_alive}d</span>
                <span className="text-surface-500">avg age</span>
              </div>
              {ancientCount > 0 && (
                <>
                  <div className="h-3 w-px bg-surface-300" />
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-gold font-bold">{ancientCount}</span>
                    <span className="text-surface-500">6+ months old</span>
                  </div>
                </>
              )}
              {deadlockedCount > 0 && (
                <>
                  <div className="h-3 w-px bg-surface-300" />
                  <div className="flex items-center gap-1.5 text-xs font-mono">
                    <span className="text-against-400 font-bold">{deadlockedCount}</span>
                    <span className="text-surface-500">deadlocked</span>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Sort controls */}
          <div className="flex items-center gap-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleSort(opt.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                  sort === opt.key
                    ? 'bg-gold/10 border-gold/40 text-gold'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <TopicSkeleton key={i} />
              ))}
            </motion.div>
          ) : topics.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <EmptyState
                icon={Hourglass}
                title="No long-running debates"
                description="All current topics are relatively new. Check back as debates age — the community moves fast here."
                action={{ label: 'Browse all topics', href: '/topics' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {topics.map((t, i) => (
                <ElderCard key={t.id} topic={t} rank={i} />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer CTA ───────────────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-2xl bg-gradient-to-br from-gold/10 to-surface-100 border border-gold/30 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <span className="text-xs font-mono font-bold text-gold uppercase tracking-widest">
                Why these debates persist
              </span>
            </div>
            <p className="text-sm text-surface-400 leading-relaxed">
              Long-running debates often reveal{' '}
              <span className="text-gold font-semibold">deeply held disagreements</span> in the
              community. Your argument or vote could be the catalyst that finally tips the balance
              — or helps everyone understand why the question is so hard.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/battleground"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Scale className="h-3.5 w-3.5" />
                See battleground topics
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
