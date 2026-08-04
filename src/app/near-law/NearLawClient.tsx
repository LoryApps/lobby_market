'use client'

/**
 * /near-law — Topics on the Brink of Law
 *
 * A dedicated high-stakes chamber showing every topic that is one strong
 * vote session away from becoming law. Topics in the "voting" phase with
 * ≥ 55% FOR consensus, sorted by how close they are to the law threshold.
 *
 * Also includes active topics with strong support (≥ 55%) that are likely
 * to transition to voting soon.
 *
 * The threshold to become law is 67% FOR sustained through a voting period.
 *
 * Distinct from:
 *   /laws         — already-established laws
 *   /battleground — the most contested (near 50/50) topics
 *   /voting       — all voting-phase topics regardless of consensus strength
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  Clock,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'
import { cn } from '@/lib/utils/cn'
import type { TopicWithAuthor } from '@/lib/supabase/types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** The FOR % threshold that triggers law establishment */
const LAW_THRESHOLD = 67

/** Polls for new data every 30 s */
const POLL_INTERVAL_MS = 30_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'ended'
  const m = Math.round(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `${m}m left`
  if (h < 24) return `${h}h left`
  return `${d}d left`
}

/** Distance in percentage points from the law threshold */
function distanceToLaw(bluePct: number): number {
  return Math.max(0, LAW_THRESHOLD - bluePct)
}

/** Progress (0–100) toward the law threshold */
function progressToLaw(bluePct: number): number {
  return Math.min(100, (bluePct / LAW_THRESHOLD) * 100)
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <div className="space-y-1.5 pt-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function NearLawCard({
  topic,
  rank,
}: {
  topic: TopicWithAuthor
  rank: number
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const distance = distanceToLaw(forPct)
  const progress = progressToLaw(forPct)
  const signal = getTopicSignal(topic)
  const isVoting = topic.status === 'voting'
  const isEndingSoon = signal?.id === 'ending_soon'
  const isBrink = signal?.id === 'brink_of_law'
  const alreadyLaw = topic.status === 'law'

  // Colour the threshold bar based on how close to law
  const barColor =
    forPct >= LAW_THRESHOLD
      ? 'bg-gradient-to-r from-gold to-gold/70'
      : forPct >= 63
      ? 'bg-gradient-to-r from-for-400 to-gold'
      : 'bg-gradient-to-r from-for-600 to-for-400'

  const containerBorder = isEndingSoon
    ? 'border-against-500/50'
    : isBrink
    ? 'border-gold/50'
    : isVoting
    ? 'border-for-500/40'
    : 'border-surface-300'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(rank * 0.05, 0.4) }}
      className={cn(
        'rounded-2xl bg-surface-100 border transition-all duration-200',
        'hover:border-surface-400 hover:bg-surface-150',
        containerBorder,
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
                isVoting
                  ? 'bg-purple/15 border-purple/40 text-purple'
                  : 'bg-for-500/10 border-for-500/30 text-for-400',
              )}
            >
              {isVoting ? <Scale className="h-2.5 w-2.5" /> : <Zap className="h-2.5 w-2.5" />}
              {isVoting ? 'Voting' : 'Active'}
            </span>

            {/* Signal pill */}
            {signal && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  SIGNAL_PILL_CLASSES[signal.color].pill,
                )}
              >
                <span
                  className={cn(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    isEndingSoon ? 'animate-pulse' : '',
                    SIGNAL_PILL_CLASSES[signal.color].dot,
                  )}
                />
                {signal.label}
              </span>
            )}

            {/* Category */}
            {topic.category && (
              <Badge variant="default" className="text-[10px]">
                {topic.category}
              </Badge>
            )}
          </div>

          {/* Created at / voting countdown */}
          <div className="flex-shrink-0 flex items-center gap-1 text-[11px] font-mono text-surface-500">
            {isVoting && topic.voting_ends_at ? (
              <>
                <Timer className="h-3 w-3" />
                {timeUntil(topic.voting_ends_at)}
              </>
            ) : (
              <>
                <Clock className="h-3 w-3" />
                {relativeTime(topic.created_at)}
              </>
            )}
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm font-semibold text-white leading-snug line-clamp-3">
          {topic.statement}
        </p>

        {/* Threshold meter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className={cn('font-bold', forPct >= LAW_THRESHOLD ? 'text-gold' : 'text-for-400')}>
              {forPct}% FOR
            </span>
            <span className="text-surface-500">
              {distance === 0
                ? '✓ Threshold met'
                : `${distance}pp to law`}
            </span>
          </div>

          {/* Progress bar toward LAW_THRESHOLD */}
          <div
            role="progressbar"
            aria-valuenow={forPct}
            aria-valuemin={0}
            aria-valuemax={LAW_THRESHOLD}
            aria-label={`${forPct}% FOR — ${distance === 0 ? 'law threshold met' : `${distance} percentage points from law threshold`}`}
            className="relative h-2.5 w-full rounded-full bg-surface-300 overflow-hidden"
          >
            <motion.div
              className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
              initial={false}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            />
            {/* Law threshold marker */}
            <div
              className="absolute inset-y-0 w-px bg-gold/60"
              style={{ left: '100%' }}
            />
          </div>

          {/* Vote count */}
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
            <span>{(topic.total_votes ?? 0).toLocaleString()} votes</span>
            <span className="flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Vote now
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FeedResponse {
  topics: TopicWithAuthor[]
}

export function NearLawClient() {
  const [topics, setTopics] = useState<TopicWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTopics = useCallback(async (off = 0, append = false) => {
    if (!append) setLoading(true)
    else setLoadingMore(true)
    try {
      const params = new URLSearchParams({ sort: 'top', limit: '20', offset: String(off) })
      const res = await fetch(`/api/feed/closingin?${params.toString()}`)
      if (!res.ok) throw new Error('Failed')
      const data: FeedResponse = await res.json()
      const incoming = data.topics ?? []
      setTopics((prev) => (append ? [...prev, ...incoming] : incoming))
      setHasMore(incoming.length === 20)
      setOffset(off + incoming.length)
    } catch {
      // silent fail — show whatever was loaded
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchTopics(0)
    // Poll for updates
    intervalRef.current = setInterval(() => {
      fetchTopics(0)
    }, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchTopics])

  const handleRefresh = useCallback(async () => {
    if (refreshing) return
    setRefreshing(true)
    await fetchTopics(0)
    setRefreshing(false)
  }, [refreshing, fetchTopics])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    fetchTopics(offset, true)
  }, [loadingMore, hasMore, offset, fetchTopics])

  // Split: voting topics first (highest priority), then active
  const votingTopics = topics.filter((t) => t.status === 'voting')
  const activeTopics = topics.filter((t) => t.status !== 'voting')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">
        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
                <Gavel className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white leading-none">
                  Near Law
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Debates on the brink of history
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
            Every debate here has crossed{' '}
            <span className="text-for-400 font-mono font-semibold">55% FOR</span> —
            and the law threshold is{' '}
            <span className="text-gold font-mono font-semibold">67%</span>.
            Your vote in these debates carries maximum weight.
          </p>

          {/* Stats strip */}
          {!loading && topics.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4 p-3 rounded-xl bg-surface-100 border border-surface-300"
            >
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-purple font-bold">{votingTopics.length}</span>
                <span className="text-surface-500">in final vote</span>
              </div>
              <div className="h-3 w-px bg-surface-300" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-for-400 font-bold">{activeTopics.length}</span>
                <span className="text-surface-500">building support</span>
              </div>
              <div className="h-3 w-px bg-surface-300" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-gold font-bold">
                  {topics.filter((t) => (t.blue_pct ?? 0) >= LAW_THRESHOLD).length}
                </span>
                <span className="text-surface-500">threshold met</span>
              </div>
            </motion.div>
          )}
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
                icon={Gavel}
                title="No topics near law"
                description="There are no active debates with majority support right now. Check back soon — consensus builds quickly."
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
              {/* ─ Voting phase section ─ */}
              {votingTopics.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 text-purple" />
                    <h2 className="text-xs font-mono font-bold text-purple uppercase tracking-widest">
                      In Final Voting
                    </h2>
                    <span className="text-[10px] font-mono text-surface-500 px-1.5 py-0.5 rounded-full bg-purple/10 border border-purple/30">
                      {votingTopics.length}
                    </span>
                  </div>
                  {votingTopics.map((t, i) => (
                    <NearLawCard key={t.id} topic={t} rank={i} />
                  ))}
                </section>
              )}

              {/* ─ Active with strong support section ─ */}
              {activeTopics.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-for-400" />
                    <h2 className="text-xs font-mono font-bold text-for-400 uppercase tracking-widest">
                      Building to Voting
                    </h2>
                    <span className="text-[10px] font-mono text-surface-500 px-1.5 py-0.5 rounded-full bg-for-500/10 border border-for-500/30">
                      {activeTopics.length}
                    </span>
                  </div>
                  {activeTopics.map((t, i) => (
                    <NearLawCard key={t.id} topic={t} rank={votingTopics.length + i} />
                  ))}
                </section>
              )}

              {/* ─ Load more ─ */}
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
                How laws are made
              </span>
            </div>
            <p className="text-sm text-surface-400 leading-relaxed">
              When a topic sustains{' '}
              <span className="text-gold font-semibold">67% FOR</span> throughout
              a voting period, the Lobby automatically promotes it to law. Topics
              here are the closest — a single shift in sentiment can decide the outcome.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/laws"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                Browse established laws
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
