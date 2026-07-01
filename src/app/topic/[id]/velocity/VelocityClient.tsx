'use client'

/**
 * /topic/[id]/velocity — Vote Velocity Engine
 *
 * Shows the rate-of-change in debate momentum over time:
 *   - Vote intake rate per day/week (bar chart)
 *   - Argument submission cadence (sparkline overlay)
 *   - Acceleration / deceleration score
 *   - Lifecycle phase (Ignition → Surge → Plateau → Fade → Dormant)
 *   - Trajectory prediction
 *
 * Distinct from:
 *   /heat       — hourly/daily engagement heatmap
 *   /momentum   — historical vote balance (For% over time)
 *   /stats      — static aggregate statistics
 *   /signal     — Bloomberg-terminal multi-signal dashboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronUp,
  ChevronDown,
  Flame,
  Gauge,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  VelocityResponse,
  VelocityBucket,
  LifecyclePhase,
} from '@/app/api/topics/[id]/velocity/route'

// ─── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<
  LifecyclePhase,
  { color: string; bg: string; border: string; glow: string; icon: typeof Flame }
> = {
  ignition: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'bg-gold/6',
    icon: Flame,
  },
  surge: {
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'bg-for-500/6',
    icon: TrendingUp,
  },
  plateau: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'bg-purple/6',
    icon: Activity,
  },
  fade: {
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'bg-against-500/6',
    icon: TrendingDown,
  },
  dormant: {
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
    glow: 'bg-surface-300/6',
    icon: BarChart2,
  },
  resolved: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'bg-gold/6',
    icon: Zap,
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function reltime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'bg-surface-400/20 text-surface-400 border-surface-400/30',
  active: 'bg-emerald/15 text-emerald border-emerald/30',
  voting: 'bg-gold/15 text-gold border-gold/30',
  law: 'bg-gold/20 text-gold border-gold/40',
  failed: 'bg-against-500/15 text-against-400 border-against-500/30',
}


// ─── Bar Chart ───────────────────────────────────────────────────────────────

function VelocityChart({
  buckets,
  peakIdx,
}: {
  buckets: VelocityBucket[]
  peakIdx: number | null
}) {
  const maxV = Math.max(...buckets.map((b) => b.votes), 1)
  const maxA = Math.max(...buckets.map((b) => b.arguments), 1)

  if (buckets.length === 0) return null

  return (
    <div className="relative">
      {/* Y-axis hint */}
      <div className="flex flex-col justify-between h-40 absolute -left-1 top-0 bottom-0 pb-6">
        <span className="text-[9px] font-mono text-surface-600 tabular-nums">{maxV}</span>
        <span className="text-[9px] font-mono text-surface-600 tabular-nums">0</span>
      </div>

      {/* Chart area */}
      <div className="ml-6 overflow-x-auto">
        <div
          className="flex items-end gap-[3px] h-40 pb-6 min-w-0"
          style={{ minWidth: buckets.length > 20 ? buckets.length * 18 : '100%' }}
        >
          {buckets.map((b, i) => {
            const vH = Math.round((b.votes / maxV) * 100)
            const aH = Math.round((b.arguments / maxA) * 100)
            const isPeak = i === peakIdx
            const isLast = i === buckets.length - 1

            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <div className="bg-surface-100 border border-surface-300 rounded-lg px-2 py-1.5 text-[10px] font-mono whitespace-nowrap shadow-lg">
                    <div className="text-white font-bold">{b.label}</div>
                    <div className="text-for-300">{b.votes} votes</div>
                    <div className="text-purple">{b.arguments} args</div>
                    <div className="text-surface-500">{b.netForPct}% For</div>
                  </div>
                </div>

                {/* Vote bar */}
                <div className="w-full flex flex-col justify-end" style={{ height: 'calc(100% - 24px)' }}>
                  <div className="relative w-full flex flex-col gap-px">
                    {/* Argument sparkline on top */}
                    {b.arguments > 0 && (
                      <motion.div
                        className="w-full rounded-sm bg-purple/60"
                        style={{ height: Math.max(2, Math.round((aH / 100) * 24)) }}
                        initial={{ height: 0 }}
                        animate={{ height: Math.max(2, Math.round((aH / 100) * 24)) }}
                        transition={{ duration: 0.6, delay: i * 0.015, ease: 'easeOut' }}
                      />
                    )}
                    {/* Vote bar */}
                    <motion.div
                      className={cn(
                        'w-full rounded-sm',
                        isPeak
                          ? 'bg-gold'
                          : isLast
                          ? 'bg-for-400'
                          : b.forVotes >= b.againstVotes
                          ? 'bg-for-500/80'
                          : 'bg-against-500/80',
                      )}
                      style={{ height: Math.max(2, Math.round((vH / 100) * (128 - 24))) }}
                      initial={{ height: 0 }}
                      animate={{ height: Math.max(2, Math.round((vH / 100) * (128 - 24))) }}
                      transition={{ duration: 0.6, delay: i * 0.015, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                {/* X-axis label */}
                <span className={cn(
                  'text-[9px] font-mono truncate w-full text-center leading-tight',
                  isPeak ? 'text-gold' : 'text-surface-600',
                )}>
                  {b.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 ml-6">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-for-500/80" />
          <span className="text-[10px] font-mono text-surface-500">Votes (FOR)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-against-500/80" />
          <span className="text-[10px] font-mono text-surface-500">Votes (AGAINST)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-purple/60" />
          <span className="text-[10px] font-mono text-surface-500">Arguments</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-3 rounded-sm bg-gold" />
          <span className="text-[10px] font-mono text-surface-500">Peak</span>
        </div>
      </div>
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color = 'text-white',
  sub,
}: {
  label: string
  value: string | number
  color?: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 p-3 rounded-xl border border-surface-300 bg-surface-100">
      <span className="text-[10px] font-mono uppercase tracking-wider text-surface-500">{label}</span>
      <span className={cn('text-xl font-mono font-bold tabular-nums', color)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VelocityClient({ topicId }: { topicId: string }) {
  const params = useParams<{ id: string }>()
  const id = topicId || params.id

  const [data, setData] = useState<VelocityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/velocity`)
      if (!res.ok) throw new Error('Failed to load velocity data')
      const json = (await res.json()) as VelocityResponse
      setData(json)
      setRefreshedAt(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const phase = data?.phase ?? 'ignition'
  const pCfg = PHASE_CONFIG[phase]
  const PhaseIcon = pCfg.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">

        {/* Back + refresh */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/topic/${id}`}
            className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {refreshedAt ? reltime(refreshedAt) : 'Refresh'}
          </button>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30 shrink-0">
              <Gauge className="h-4.5 w-4.5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Velocity Engine
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Rate-of-change analysis · {data?.topic.category ?? '—'}
              </p>
            </div>
          </div>

          {data && (
            <p className="text-sm font-mono text-surface-400 line-clamp-2 leading-snug mt-2">
              {data.topic.statement}
            </p>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((k) => (
                <Skeleton key={k} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            icon={<Activity className="h-8 w-8" />}
            title="Unable to load velocity data"
            description={error}
            action={{ label: 'Retry', onClick: () => void load() }}
          />
        )}

        {/* No votes yet */}
        {!loading && !error && data && data.topic.total_votes === 0 && (
          <EmptyState
            icon={<Gauge className="h-8 w-8" />}
            title="No velocity data yet"
            description="Velocity data will appear once votes are cast on this debate."
            action={{ label: 'Go vote', href: `/topic/${id}` }}
          />
        )}

        {/* Main content */}
        {!loading && !error && data && data.topic.total_votes > 0 && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Phase banner */}
            <div className={cn(
              'relative rounded-2xl border p-5 overflow-hidden',
              pCfg.border,
              pCfg.bg,
            )}>
              {/* Glow */}
              <div className={cn('absolute inset-0 blur-2xl opacity-40 pointer-events-none', pCfg.glow)} />

              <div className="relative flex items-start gap-4">
                <div className={cn('flex items-center justify-center h-12 w-12 rounded-xl shrink-0 border', pCfg.bg, pCfg.border)}>
                  <PhaseIcon className={cn('h-6 w-6', pCfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('font-mono text-lg font-bold', pCfg.color)}>
                      {data.phaseLabel}
                    </span>
                    <span className={cn(
                      'text-xs font-mono px-2 py-0.5 rounded-full border',
                      STATUS_COLOR[data.topic.status] ?? 'text-surface-500',
                    )}>
                      {data.topic.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm font-mono text-surface-400 leading-snug">
                    {data.phaseDescription}
                  </p>
                </div>
              </div>

              {/* Gauge rings */}
              <div className="flex items-center justify-around mt-5 pt-4 border-t border-surface-300/40">
                <div className="text-center">
                  <div className="relative h-20 w-20 mx-auto">
                    {/* SVG ring */}
                    <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#1d2535" strokeWidth="8" />
                      <motion.circle
                        cx="40" cy="40" r="32" fill="none"
                        stroke="currentColor" strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeLinecap="round"
                        className={pCfg.color}
                        initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - data.velocityScore / 100) }}
                        transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={cn('text-xl font-mono font-bold tabular-nums', pCfg.color)}>{data.velocityScore}</span>
                      <span className="text-[9px] font-mono text-surface-600 uppercase">vel</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-surface-500 mt-1">Velocity Score</p>
                </div>

                <div className="text-center">
                  <div className="relative h-20 w-20 mx-auto">
                    <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90">
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#1d2535" strokeWidth="8" />
                      <motion.circle
                        cx="40" cy="40" r="32" fill="none"
                        stroke="currentColor" strokeWidth="8"
                        strokeDasharray={2 * Math.PI * 32}
                        strokeLinecap="round"
                        className="text-emerald"
                        initial={{ strokeDashoffset: 2 * Math.PI * 32 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 32 * (1 - data.engagementScore / 100) }}
                        transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-mono font-bold tabular-nums text-emerald">{data.engagementScore}</span>
                      <span className="text-[9px] font-mono text-surface-600 uppercase">eng</span>
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-surface-500 mt-1">Engagement Score</p>
                </div>

                {/* Acceleration indicator */}
                <div className="text-center">
                  <div className={cn(
                    'h-20 w-20 mx-auto rounded-xl border flex flex-col items-center justify-center',
                    data.accelerationScore > 0
                      ? 'bg-for-500/10 border-for-500/30'
                      : data.accelerationScore < 0
                      ? 'bg-against-500/10 border-against-500/30'
                      : 'bg-surface-300/10 border-surface-400/30',
                  )}>
                    {data.accelerationScore > 0
                      ? <ChevronUp className="h-7 w-7 text-for-300" />
                      : data.accelerationScore < 0
                      ? <ChevronDown className="h-7 w-7 text-against-300" />
                      : <Activity className="h-7 w-7 text-surface-500" />}
                    <span className={cn(
                      'text-sm font-mono font-bold tabular-nums',
                      data.accelerationScore > 0 ? 'text-for-300' : data.accelerationScore < 0 ? 'text-against-300' : 'text-surface-500',
                    )}>
                      {data.accelerationScore > 0 ? '+' : ''}{data.accelerationScore}%
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-surface-500 mt-1">Acceleration</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill
                label="Days Active"
                value={data.daysActive}
                color="text-white"
                sub="since debate opened"
              />
              <StatPill
                label="Avg/Day"
                value={data.avgVotesPerDay.toLocaleString()}
                color="text-for-300"
                sub="votes per day"
              />
              <StatPill
                label="Peak/Day"
                value={data.peakVotesPerDay.toLocaleString()}
                color="text-gold"
                sub="peak daily volume"
              />
              <StatPill
                label="Arg Ratio"
                value={`${data.argToVoteRatio}%`}
                color="text-purple"
                sub="args per 100 votes"
              />
            </div>

            {/* Velocity chart */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-for-400" />
                  <h2 className="font-mono text-sm font-semibold text-white">
                    Vote & Argument Velocity
                  </h2>
                </div>
                <div className="text-[10px] font-mono text-surface-500">
                  {data.buckets.length} {data.daysActive > 28 ? 'weeks' : 'days'}
                </div>
              </div>
              <VelocityChart buckets={data.buckets} peakIdx={data.peakBucket} />
            </div>

            {/* Current vs Peak */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-gold" />
                <h2 className="font-mono text-sm font-semibold text-white">
                  Velocity Comparison
                </h2>
              </div>

              {/* Current */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono text-surface-500">Current period</span>
                  <span className="text-xs font-mono text-for-300 tabular-nums font-bold">{data.currentVelocity} votes</span>
                </div>
                <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-for-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.velocityScore}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="text-right mt-0.5">
                  <span className="text-[10px] font-mono text-surface-600">{data.velocityScore}% of peak</span>
                </div>
              </div>

              {/* Peak */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono text-surface-500">
                    Peak period {data.peakBucket !== null ? `(${data.buckets[data.peakBucket]?.label})` : ''}
                  </span>
                  <span className="text-xs font-mono text-gold tabular-nums font-bold">{data.peakVelocity} votes</span>
                </div>
                <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                  <div className="h-full bg-gold rounded-full w-full" />
                </div>
                <div className="text-right mt-0.5">
                  <span className="text-[10px] font-mono text-surface-600">100% — all-time peak</span>
                </div>
              </div>

              {/* Total arguments */}
              <div className="flex items-center justify-between pt-3 border-t border-surface-300/40">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-purple" />
                  <span className="text-xs font-mono text-surface-500">Total arguments submitted</span>
                </div>
                <span className="text-sm font-mono font-bold text-purple tabular-nums">{data.totalArguments.toLocaleString()}</span>
              </div>
            </div>

            {/* Trajectory prediction */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="h-4 w-4 text-emerald" />
                <h2 className="font-mono text-sm font-semibold text-white">
                  Trajectory Forecast
                </h2>
              </div>
              <p className="text-sm font-mono text-surface-400 leading-relaxed">
                {data.prediction}
              </p>
              {data.topic.status === 'active' && (
                <div className="mt-4 pt-4 border-t border-surface-300/40 flex gap-3">
                  <Link
                    href={`/topic/${id}/momentum`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Momentum
                  </Link>
                  <Link
                    href={`/topic/${id}/signal`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-for-500/30 text-xs font-mono text-for-400 hover:text-for-300 hover:border-for-400 transition-colors"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Signal Board
                  </Link>
                </div>
              )}
            </div>

            {/* Back link */}
            <Link
              href={`/topic/${id}`}
              className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to debate
            </Link>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
