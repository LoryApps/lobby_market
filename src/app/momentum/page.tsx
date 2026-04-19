'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  Flame,
  RefreshCw,
  TrendingUp,
  Zap,
  Scale,
  Gavel,
  Clock,
  Activity,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MomentumTopic, MomentumResponse } from '@/app/api/topics/momentum/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_ICON: Record<string, typeof Zap> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Scale,
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

const CATEGORY_BG: Record<string, string> = {
  Economics: 'bg-gold/10 border-gold/20',
  Politics: 'bg-for-500/10 border-for-500/20',
  Technology: 'bg-purple/10 border-purple/20',
  Science: 'bg-emerald/10 border-emerald/20',
  Ethics: 'bg-against-500/10 border-against-500/20',
  Philosophy: 'bg-purple/10 border-purple/20',
  Culture: 'bg-gold/10 border-gold/20',
  Health: 'bg-emerald/10 border-emerald/20',
  Environment: 'bg-emerald/10 border-emerald/20',
  Education: 'bg-for-500/10 border-for-500/20',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVelocity(v: number): string {
  if (v < 0.1) return '<0.1/hr'
  if (v >= 100) return `${Math.round(v)}/hr`
  return `${v.toFixed(1)}/hr`
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function formatHotHour(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
}

// ─── Velocity Indicator ───────────────────────────────────────────────────────

function VelocityBadge({ velocity, acceleration }: { velocity: number; acceleration: number }) {
  const isAccel = acceleration > 0.1
  const isDecel = acceleration < -0.1

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-mono font-semibold border',
        isAccel
          ? 'bg-against-500/15 border-against-500/30 text-against-300'
          : isDecel
          ? 'bg-surface-200 border-surface-300 text-surface-500'
          : 'bg-for-500/15 border-for-500/30 text-for-300'
      )}
    >
      {isAccel ? (
        <ArrowUp className="h-2.5 w-2.5" />
      ) : isDecel ? (
        <ArrowDown className="h-2.5 w-2.5" />
      ) : (
        <Minus className="h-2.5 w-2.5" />
      )}
      {formatVelocity(velocity)}
    </div>
  )
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function MiniVoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <span className="text-for-400 w-8 text-right">{forPct}%</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
        <div
          className="h-full bg-for-500 rounded-full transition-all"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-against-400 w-8">{againstPct}%</span>
    </div>
  )
}

// ─── Topic Card ───────────────────────────────────────────────────────────────

function TopicMomentumCard({
  topic,
  rank,
  index,
}: {
  topic: MomentumTopic
  rank: number
  index: number
}) {
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const isTop3 = rank <= 3
  const catColor = topic.category ? (CATEGORY_COLORS[topic.category] ?? 'text-surface-500') : 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04, ease: 'easeOut' }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border transition-all group',
          isTop3
            ? 'bg-surface-100 border-against-500/30 hover:border-against-400/50 hover:bg-against-500/5'
            : 'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200/50'
        )}
      >
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Rank */}
            <div
              className={cn(
                'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold border',
                isTop3
                  ? 'bg-against-500/20 border-against-500/30 text-against-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500'
              )}
            >
              {rank}
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px] py-0">
                  <StatusIcon className="h-2.5 w-2.5 mr-1" />
                  {STATUS_LABEL[topic.status] ?? topic.status}
                </Badge>

                {topic.category && (
                  <span className={cn('text-[10px] font-mono font-medium', catColor)}>
                    {topic.category}
                  </span>
                )}
              </div>

              <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-surface-700 transition-colors">
                {topic.statement}
              </p>
            </div>

            {/* Velocity badge */}
            <div className="flex-shrink-0">
              <VelocityBadge velocity={topic.velocity} acceleration={topic.acceleration} />
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {formatCount(topic.votes_24h)} in 24h
              </span>
              {topic.votes_1h > 0 && (
                <span className="flex items-center gap-1 text-against-400">
                  <Flame className="h-3 w-3" />
                  {topic.votes_1h} last hr
                </span>
              )}
            </div>

            <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
          </div>

          {/* Vote bar */}
          <div className="mt-2">
            <MiniVoteBar bluePct={topic.blue_pct} />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-7 w-20 flex-shrink-0" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MomentumPage() {
  const [data, setData] = useState<MomentumResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/topics/momentum', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: MomentumResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load momentum data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Auto-refresh every 90 seconds
    const interval = setInterval(() => load(true), 90_000)
    return () => clearInterval(interval)
  }, [load])

  // Derive categories from data for filter pills
  const categories = data
    ? Array.from(new Set(data.topics.map((t) => t.category).filter(Boolean) as string[])).sort()
    : []

  const filtered = data
    ? activeCategory
      ? data.topics.filter((t) => t.category === activeCategory)
      : data.topics
    : []

  // Split into hot (accelerating) vs steady
  const accelerating = filtered.filter((t) => t.acceleration > 0.1)
  const steady = filtered.filter((t) => t.acceleration <= 0.1)

  return (
    <div className="flex flex-col min-h-screen bg-surface-0">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-24">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-mono font-bold text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-against-400" />
                Momentum
              </h1>
              <p className="mt-1 text-sm font-mono text-surface-500">
                Topics gaining votes fastest — ranked by actual vote velocity.
              </p>
            </div>

            <button
              onClick={() => load(true)}
              disabled={loading || refreshing}
              aria-label="Refresh momentum data"
              className="flex-shrink-0 h-9 w-9 rounded-xl border border-surface-300 bg-surface-200 flex items-center justify-center text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <p className="text-lg font-mono font-bold text-white">
                {formatCount(data.window.total_votes_24h)}
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">votes · 24h</p>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <p className="text-lg font-mono font-bold text-white">
                {data.window.unique_topics}
              </p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">active topics</p>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <Clock className="h-4 w-4 text-gold mx-auto mb-0.5" />
              <p className="text-xs font-mono font-bold text-white">
                {formatHotHour(data.window.hottest_hour)}
              </p>
              <p className="text-[10px] font-mono text-surface-500">hottest hour</p>
            </div>
          </motion.div>
        )}

        {/* ── Category filters ─────────────────────────────────────────────── */}
        {!loading && categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors',
                activeCategory === null
                  ? 'bg-against-500/20 border-against-500/30 text-against-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
              )}
            >
              All
            </button>
            {categories.map((cat) => {
              const color = CATEGORY_COLORS[cat] ?? 'text-surface-500'
              const bg = CATEGORY_BG[cat] ?? 'bg-surface-200 border-surface-300'
              const isActive = activeCategory === cat

              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(isActive ? null : cat)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors',
                    isActive ? bg + ' ' + color : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Loading state ────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => <TopicSkeleton key={i} />)}
          </div>
        )}

        {/* ── Error state ──────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <p className="font-mono text-sm text-against-300">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={TrendingUp}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="No momentum data yet"
            description="Vote activity from the last 24 hours will appear here. Cast your first votes to get the board moving."
            actions={[{ label: 'Go to the feed', href: '/' }]}
          />
        )}

        {/* ── Accelerating section ─────────────────────────────────────────── */}
        {!loading && !error && accelerating.length > 0 && (
          <AnimatePresence>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-4 w-4 text-against-400" />
                <span className="text-xs font-mono font-semibold text-against-300 tracking-wider uppercase">
                  Accelerating
                </span>
                <span className="text-xs font-mono text-surface-600">
                  — gaining pace vs 24h average
                </span>
              </div>
              <div className="space-y-2.5">
                {accelerating.map((topic, i) => (
                  <TopicMomentumCard
                    key={topic.id}
                    topic={topic}
                    rank={filtered.indexOf(topic) + 1}
                    index={i}
                  />
                ))}
              </div>
            </div>
          </AnimatePresence>
        )}

        {/* ── Steady section ───────────────────────────────────────────────── */}
        {!loading && !error && steady.length > 0 && (
          <AnimatePresence>
            <div>
              {accelerating.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-for-400" />
                  <span className="text-xs font-mono font-semibold text-for-300 tracking-wider uppercase">
                    Holding Steady
                  </span>
                  <span className="text-xs font-mono text-surface-600">
                    — active but not accelerating
                  </span>
                </div>
              )}
              <div className="space-y-2.5">
                {steady.map((topic, i) => (
                  <TopicMomentumCard
                    key={topic.id}
                    topic={topic}
                    rank={filtered.indexOf(topic) + 1}
                    index={accelerating.length + i}
                  />
                ))}
              </div>
            </div>
          </AnimatePresence>
        )}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        {!loading && !error && filtered.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-between">
            <p className="text-[11px] font-mono text-surface-600">
              Velocity = avg votes/hr over the last 6 hours. Auto-refreshes every 90s.
            </p>
            <Link
              href="/surge"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              View Surge
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
