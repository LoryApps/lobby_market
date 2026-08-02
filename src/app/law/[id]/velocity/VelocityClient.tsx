'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Flame,
  Gauge,
  MessageSquare,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawVelocityResponse, LawVelocityBucket, JourneyPattern } from '@/app/api/laws/[id]/velocity/route'

// ─── Journey pattern config ───────────────────────────────────────────────────

const PATTERN_CONFIG: Record<
  JourneyPattern,
  { color: string; bg: string; border: string; glow: string; icon: typeof Flame }
> = {
  blitz: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'bg-gold/6',
    icon: Zap,
  },
  surge: {
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'bg-for-500/6',
    icon: TrendingUp,
  },
  grind: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'bg-purple/6',
    icon: Activity,
  },
  controversy: {
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'bg-against-500/6',
    icon: TrendingDown,
  },
  landslide: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'bg-emerald/6',
    icon: Flame,
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Velocity chart ───────────────────────────────────────────────────────────

function VelocityChart({
  buckets,
  peakIdx,
}: {
  buckets: LawVelocityBucket[]
  peakIdx: number | null
}) {
  const maxV = Math.max(...buckets.map((b) => b.votes), 1)
  const maxA = Math.max(...buckets.map((b) => b.arguments), 1)

  if (buckets.length === 0) return null

  return (
    <div className="relative">
      <div className="flex flex-col justify-between h-40 absolute -left-1 top-0 bottom-0 pb-6">
        <span className="text-[9px] font-mono text-surface-600 tabular-nums">{maxV}</span>
        <span className="text-[9px] font-mono text-surface-600 tabular-nums">0</span>
      </div>

      <div className="ml-6 overflow-x-auto">
        <div
          className="flex items-end gap-[3px] h-40 pb-6 min-w-0"
          style={{ minWidth: buckets.length > 20 ? buckets.length * 18 : '100%' }}
        >
          {buckets.map((b, i) => {
            const vH = Math.round((b.votes / maxV) * 100)
            const aH = Math.round((b.arguments / maxA) * 100)
            const isPeak = i === peakIdx

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

                <div className="w-full flex flex-col justify-end" style={{ height: 'calc(100% - 24px)' }}>
                  <div className="relative w-full flex flex-col gap-px">
                    {b.arguments > 0 && (
                      <motion.div
                        className="w-full rounded-sm bg-purple/60"
                        style={{ height: Math.max(2, Math.round((aH / 100) * 24)) }}
                        initial={{ height: 0 }}
                        animate={{ height: Math.max(2, Math.round((aH / 100) * 24)) }}
                        transition={{ duration: 0.6, delay: i * 0.015, ease: 'easeOut' }}
                      />
                    )}
                    <motion.div
                      className={cn(
                        'w-full rounded-sm',
                        isPeak
                          ? 'bg-gold'
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

export function VelocityClient({ lawId }: { lawId: string }) {
  const [data, setData] = useState<LawVelocityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/velocity`)
      if (!res.ok) throw new Error('Failed to load velocity data')
      const json = (await res.json()) as LawVelocityResponse
      setData(json)
      setRefreshedAt(new Date().toISOString())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { void load() }, [load])

  const pattern = data?.journeyPattern ?? 'grind'
  const pCfg = PATTERN_CONFIG[pattern]
  const PatternIcon = pCfg.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">

        {/* Back + refresh */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to law
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
                Journey to consensus · {data?.law.category ?? '—'}
              </p>
            </div>
          </div>

          {data && (
            <p className="text-sm font-mono text-surface-400 line-clamp-2 leading-snug mt-2">
              {data.law.statement}
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((k) => <Skeleton key={k} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-52 w-full rounded-2xl" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={<Activity className="h-8 w-8" />}
            title="Unable to load velocity data"
            description={error}
            action={{ label: 'Retry', onClick: () => void load() }}
          />
        )}

        {/* No data */}
        {!loading && !error && data && data.law.total_votes === 0 && (
          <EmptyState
            icon={<Gauge className="h-8 w-8" />}
            title="No velocity data"
            description="No votes were recorded for this law's origin debate."
          />
        )}

        {/* Main content */}
        {!loading && !error && data && data.law.total_votes > 0 && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* Journey pattern banner */}
            <div className={cn(
              'relative rounded-2xl border p-5 overflow-hidden',
              pCfg.border,
              pCfg.bg,
            )}>
              <div className={cn('absolute inset-0 blur-2xl opacity-40 pointer-events-none', pCfg.glow)} />

              <div className="relative flex items-start gap-4">
                <div className={cn('flex items-center justify-center h-12 w-12 rounded-xl shrink-0 border', pCfg.bg, pCfg.border)}>
                  <PatternIcon className={cn('h-6 w-6', pCfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('font-mono text-lg font-bold', pCfg.color)}>
                      {data.journeyLabel}
                    </span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full border bg-gold/20 text-gold border-gold/40">
                      LAW
                    </span>
                  </div>
                  <p className="text-sm font-mono text-surface-400 leading-snug">
                    {data.journeyDescription}
                  </p>
                </div>
              </div>

              {/* Gauge rings */}
              <div className="flex items-center justify-around mt-5 pt-4 border-t border-surface-300/40">
                <div className="text-center">
                  <div className="relative h-20 w-20 mx-auto">
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
                      data.accelerationScore > 0
                        ? 'text-for-300'
                        : data.accelerationScore < 0
                        ? 'text-against-300'
                        : 'text-surface-500',
                    )}>
                      {data.accelerationScore > 0 ? '+' : ''}{data.accelerationScore}%
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-surface-500 mt-1">Final Acc.</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill
                label="Days to Law"
                value={data.daysToResolve}
                color="text-gold"
                sub="debate duration"
              />
              <StatPill
                label="Avg / Day"
                value={data.avgVotesPerDay.toLocaleString()}
                color="text-for-300"
                sub="votes per day"
              />
              <StatPill
                label="Peak / Day"
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
                    Debate Velocity Timeline
                  </h2>
                </div>
                <div className="text-[10px] font-mono text-surface-500">
                  {data.buckets.length} {data.daysToResolve > 28 ? 'weeks' : 'days'}
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

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono text-surface-500">Final period</span>
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

              <div className="flex items-center justify-between pt-3 border-t border-surface-300/40">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-purple" />
                  <span className="text-xs font-mono text-surface-500">Total arguments submitted</span>
                </div>
                <span className="text-sm font-mono font-bold text-purple tabular-nums">{data.totalArguments.toLocaleString()}</span>
              </div>
            </div>

            {/* Historical insight */}
            <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-gold" />
                <h2 className="font-mono text-sm font-semibold text-white">
                  Historical Insight
                </h2>
              </div>
              <p className="text-sm font-mono text-surface-400 leading-relaxed">
                {data.insight}
              </p>
            </div>

            {/* Related links */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                Related Analysis
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/law/${lawId}/echo-chamber`}
                  className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Echo Chamber
                </Link>
                <Link
                  href={`/law/${lawId}/blocs`}
                  className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Voting Blocs
                </Link>
                <Link
                  href={`/law/${lawId}/dissent`}
                  className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  Dissent Analysis
                </Link>
                <Link
                  href={`/law/${lawId}/pulse`}
                  className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Pulse
                </Link>
              </div>
            </div>

            <Link
              href={`/law/${lawId}`}
              className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to law
            </Link>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
