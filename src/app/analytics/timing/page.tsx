'use client'

/**
 * /analytics/timing — Civic Timing Report
 *
 * Reveals WHEN you vote: hour of day, day of week, and how early or late you
 * engage with topics relative to when they were first published.
 *
 * Distinct from:
 *   /analytics/votes       — what you voted on (topic list + history)
 *   /analytics/evolution   — how your opinions shift over time
 *   /analytics/drift       — how aligned you are with consensus
 *   /analytics/growth      — participation rate trends
 *
 * "Timing archetype" labels: Trailblazer · Pioneer · Mainstream ·
 *                            Deliberator · Archivist
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Flame,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  TimingResponse,
  TimingArchetype,
  EarlyVoteTopic,
} from '@/app/api/analytics/timing/route'

// ─── Archetype styling ───────────────────────────────────────────────────────

const ARCHETYPE_STYLE: Record<
  TimingArchetype,
  { color: string; bg: string; border: string; icon: typeof Clock }
> = {
  trailblazer: {
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: Flame,
  },
  pioneer: {
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Zap,
  },
  mainstream: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Activity,
  },
  late_majority: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Scale,
  },
  archivist: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Calendar,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDeltaHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  const days = hours / 24
  if (days < 7) return `${days.toFixed(1)}d`
  if (days < 30) return `${(days / 7).toFixed(1)}w`
  if (days < 365) return `${(days / 30).toFixed(1)}mo`
  return `${(days / 365).toFixed(1)}y`
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  animateValue,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  animateValue?: number
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
        {sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}
      </div>
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// Bar chart for hour/day distribution
function DistributionBar({
  buckets,
  highlight,
  colorClass,
  labelKey,
  valueKey = 'count',
}: {
  buckets: Array<Record<string, unknown>>
  highlight: number | null
  colorClass: string
  labelKey: string
  valueKey?: string
}) {
  const max = Math.max(...buckets.map((b) => (b[valueKey] as number) ?? 0), 1)
  return (
    <div className="flex items-end gap-[2px] h-20">
      {buckets.map((b, i) => {
        const count = (b[valueKey] as number) ?? 0
        const pct = max > 0 ? (count / max) * 100 : 0
        const isHigh = b[labelKey as string] === highlight || i === highlight
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              style={{ height: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
              className={cn(
                'w-full rounded-t-[2px] transition-all duration-300',
                isHigh ? colorClass : 'bg-surface-300/60 hover:bg-surface-400/50'
              )}
              title={`${b[labelKey as string]}: ${count} vote${count !== 1 ? 's' : ''}`}
            />
          </div>
        )
      })}
    </div>
  )
}

function TopicRow({ topic }: { topic: EarlyVoteTopic }) {
  return (
    <Link
      href={`/topic/${topic.topic_id}`}
      className="flex items-start gap-3 p-3 rounded-xl border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/40 transition-colors group"
    >
      <div
        className={cn(
          'mt-0.5 h-5 w-5 rounded-full flex-shrink-0 flex items-center justify-center',
          topic.user_vote === 'blue' ? 'bg-for-500/20' : 'bg-against-500/20'
        )}
      >
        {topic.user_vote === 'blue' ? (
          <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
        ) : (
          <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium leading-snug line-clamp-2">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={cn(
              'text-[10px] font-mono font-bold',
              topic.delta_hours < 1
                ? 'text-against-300'
                : topic.delta_hours < 24
                ? 'text-for-400'
                : topic.delta_hours < 168
                ? 'text-gold'
                : 'text-purple'
            )}
          >
            {formatDeltaHours(topic.delta_hours)} after publish
          </span>
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
          {topic.status === 'law' ? 'LAW' : topic.status}
        </Badge>
        <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TimingPage() {
  const router = useRouter()
  const [data, setData] = useState<TimingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'fastest' | 'slowest'>('fastest')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/timing', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      if (!json.authenticated) {
        router.push('/login?next=/analytics/timing')
        return
      }
      setData(json as TimingResponse)
    } catch {
      setError('Could not load your timing report. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-56" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={Timer}
            title="Couldn't load timing data"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) return null

  const archetypeStyle = ARCHETYPE_STYLE[data.archetype]
  const ArchetypeIcon = archetypeStyle.icon

  const peakHourLabel =
    data.peak_hour !== null
      ? data.hour_distribution[data.peak_hour]?.label ?? null
      : null
  const peakDayLabel =
    data.peak_day !== null
      ? data.day_distribution[data.peak_day]?.label ?? null
      : null

  const displayTopics = activeTab === 'fastest' ? data.fastest_votes : data.slowest_votes

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-5">

        {/* ── Back link ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>
          <span className="text-surface-600 text-xs">/</span>
          <span className="text-xs font-mono text-surface-400">Timing</span>
        </div>

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-mono font-bold text-white flex items-center gap-2">
            <Clock className="h-5 w-5 text-for-400" />
            Civic Timing Report
          </h1>
          <p className="text-sm text-surface-500 mt-1 font-mono">
            When and how early do you vote? Your civic timing signature.
          </p>
        </div>

        {/* ── Archetype card ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className={cn(
            'rounded-2xl border p-6',
            archetypeStyle.bg,
            archetypeStyle.border
          )}
        >
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0',
                archetypeStyle.bg,
                'border',
                archetypeStyle.border
              )}
            >
              <ArchetypeIcon className={cn('h-6 w-6', archetypeStyle.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-lg font-mono font-bold', archetypeStyle.color)}>
                  {data.archetype_label}
                </span>
                <span className="text-xs font-mono text-surface-500 italic">
                  {data.archetype_tagline}
                </span>
              </div>
              <p className="text-sm text-surface-400 mt-1.5 leading-relaxed">
                {data.archetype_description}
              </p>

              {/* Early adopter score bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                    Early Adopter Score
                  </span>
                  <span className={cn('text-sm font-mono font-bold tabular-nums', archetypeStyle.color)}>
                    {data.early_adopter_score}/100
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-surface-300/50 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.early_adopter_score}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full',
                      data.archetype === 'trailblazer'
                        ? 'bg-against-500'
                        : data.archetype === 'pioneer'
                        ? 'bg-for-500'
                        : data.archetype === 'mainstream'
                        ? 'bg-emerald'
                        : data.archetype === 'late_majority'
                        ? 'bg-gold'
                        : 'bg-purple'
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Stat grid ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid grid-cols-2 gap-3"
        >
          <StatCard
            label="Votes Analysed"
            value={data.total_votes.toLocaleString()}
            animateValue={data.total_votes}
            icon={BarChart2}
            iconColor="text-for-400"
            iconBg="bg-for-500/15"
          />
          <StatCard
            label="Avg. Time to Vote"
            value={formatDeltaHours(data.avg_delta_hours)}
            sub="after topic published"
            icon={Timer}
            iconColor="text-gold"
            iconBg="bg-gold/15"
          />
          <StatCard
            label="Peak Hour (UTC)"
            value={peakHourLabel ?? '—'}
            sub="most votes cast"
            icon={Clock}
            iconColor="text-purple"
            iconBg="bg-purple/15"
          />
          <StatCard
            label="Peak Day"
            value={peakDayLabel ?? '—'}
            sub="most active weekday"
            icon={Calendar}
            iconColor="text-emerald"
            iconBg="bg-emerald/15"
          />
        </motion.div>

        {/* Early accuracy pill */}
        {data.early_accuracy !== null && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3"
          >
            <Trophy className="h-4 w-4 text-gold flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono text-white">
                <span className="text-gold font-bold">{data.early_accuracy}%</span> early-vote accuracy
              </p>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                Of topics you voted on within 24h, {data.early_accuracy}% matched the eventual majority
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Hour of day chart ────────────────────────────────────────── */}
        {data.total_votes > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
          >
            <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
              <Clock className="h-3.5 w-3.5 text-purple" />
              When Do You Vote? (Hour of Day · UTC)
            </div>

            <DistributionBar
              buckets={data.hour_distribution as unknown as Array<Record<string, unknown>>}
              highlight={data.peak_hour}
              colorClass="bg-purple"
              labelKey="hour"
            />

            {/* X-axis labels — show every 4 hours */}
            <div className="flex justify-between mt-1.5 px-0">
              {[0, 4, 8, 12, 16, 20].map((h) => (
                <span key={h} className="text-[9px] font-mono text-surface-600">
                  {h === 0 ? '12A' : h < 12 ? `${h}A` : h === 12 ? '12P' : `${h - 12}P`}
                </span>
              ))}
            </div>

            {peakHourLabel && (
              <p className="text-[11px] font-mono text-surface-500 mt-3">
                Most active at <span className="text-purple font-semibold">{peakHourLabel} UTC</span>
                {' '}({data.hour_distribution[data.peak_hour!]?.count ?? 0} vote{data.hour_distribution[data.peak_hour!]?.count !== 1 ? 's' : ''})
              </p>
            )}
          </motion.div>
        )}

        {/* ── Day of week chart ────────────────────────────────────────── */}
        {data.total_votes > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
          >
            <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
              <Calendar className="h-3.5 w-3.5 text-emerald" />
              Day of Week Activity
            </div>

            <DistributionBar
              buckets={data.day_distribution as unknown as Array<Record<string, unknown>>}
              highlight={data.peak_day}
              colorClass="bg-emerald"
              labelKey="day"
            />

            {/* Day labels */}
            <div className="flex justify-between mt-1.5 px-0">
              {data.day_distribution.map((d) => (
                <span key={d.day} className="flex-1 text-center text-[9px] font-mono text-surface-600">
                  {d.shortLabel.slice(0, 2)}
                </span>
              ))}
            </div>

            {peakDayLabel && (
              <p className="text-[11px] font-mono text-surface-500 mt-3">
                Most active on <span className="text-emerald font-semibold">{peakDayLabel}s</span>
                {' '}({data.day_distribution[data.peak_day!]?.count ?? 0} vote{data.day_distribution[data.peak_day!]?.count !== 1 ? 's' : ''})
              </p>
            )}
          </motion.div>
        )}

        {/* ── Fastest / Slowest votes ──────────────────────────────────── */}
        {(data.fastest_votes.length > 0 || data.slowest_votes.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
          >
            {/* Tab header */}
            <div className="flex border-b border-surface-300">
              <button
                onClick={() => setActiveTab('fastest')}
                className={cn(
                  'flex-1 py-3 text-xs font-mono uppercase tracking-wider transition-colors',
                  activeTab === 'fastest'
                    ? 'bg-for-500/10 text-for-300 border-b-2 border-for-500'
                    : 'text-surface-500 hover:text-surface-400'
                )}
              >
                <Zap className="h-3 w-3 inline mr-1 -mt-0.5" />
                Your Fastest Votes
              </button>
              <button
                onClick={() => setActiveTab('slowest')}
                className={cn(
                  'flex-1 py-3 text-xs font-mono uppercase tracking-wider transition-colors',
                  activeTab === 'slowest'
                    ? 'bg-purple/10 text-purple border-b-2 border-purple'
                    : 'text-surface-500 hover:text-surface-400'
                )}
              >
                <Calendar className="h-3 w-3 inline mr-1 -mt-0.5" />
                Your Slowest Votes
              </button>
            </div>

            <div className="p-4 space-y-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  {displayTopics.length === 0 ? (
                    <p className="text-sm font-mono text-surface-500 text-center py-4">
                      Not enough data yet.
                    </p>
                  ) : (
                    displayTopics.map((topic) => (
                      <TopicRow key={topic.topic_id} topic={topic} />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── Median info ──────────────────────────────────────────────── */}
        {data.total_votes > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.25 }}
            className="rounded-xl border border-surface-300/40 bg-surface-100/50 p-4"
          >
            <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
              Distribution Summary
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm font-mono">
              <div>
                <span className="text-surface-500 text-[11px]">Mean time to vote</span>
                <p className="text-white font-semibold">{formatDeltaHours(data.avg_delta_hours)}</p>
              </div>
              <div>
                <span className="text-surface-500 text-[11px]">Median time to vote</span>
                <p className="text-white font-semibold">{formatDeltaHours(data.median_delta_hours)}</p>
              </div>
            </div>
            <p className="text-[10px] font-mono text-surface-600 mt-3 leading-relaxed">
              All times measured from when a topic was first published to when you cast your vote.
              Hour-of-day data uses UTC.
            </p>
          </motion.div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {data.total_votes === 0 && (
          <EmptyState
            icon={Timer}
            title="No votes yet"
            description="Start voting on topics to see your civic timing signature."
            action={{ label: 'Browse Topics', href: '/' }}
          />
        )}

        {/* ── Refresh + related links ─────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>

          <div className="flex items-center gap-3">
            <Link
              href="/analytics/votes"
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              Vote History
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              href="/analytics/drift"
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-against-400 transition-colors"
            >
              Drift Report
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
