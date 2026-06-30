'use client'

/**
 * /topic/[id]/pulse — Live Vote Pulse
 *
 * Distinct from:
 *   /activity  – individual event log (votes, arguments, upvotes)
 *   /heat      – aggregate heatmap of WHEN votes happen (day/hour histograms)
 *   /momentum  – historical vote-split evolution over the topic's full lifetime
 *
 * Pulse answers: "Is this debate alive RIGHT NOW?"
 * It shows current vote velocity, the 24h heartbeat sparkline, and
 * momentum classification: Surging / Active / Cooling / Dormant.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Flame,
  Heart,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { PulseData, PulseHourBucket, PulseMomentum } from '@/app/api/topics/[id]/pulse/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 30_000

const MOMENTUM_CONFIG: Record<PulseMomentum, {
  label: string
  color: string
  bg: string
  border: string
  glow: string
  icon: typeof Flame
  description: string
}> = {
  surging: {
    label: 'SURGING',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    glow: 'bg-against-500',
    icon: Flame,
    description: 'Votes are flooding in. This debate is on fire.',
  },
  active: {
    label: 'ACTIVE',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    glow: 'bg-emerald',
    icon: Activity,
    description: 'Steady engagement. The debate is alive.',
  },
  cooling: {
    label: 'COOLING',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    glow: 'bg-gold',
    icon: TrendingDown,
    description: 'Activity is slowing. Still worth watching.',
  },
  dormant: {
    label: 'DORMANT',
    color: 'text-surface-500',
    bg: 'bg-surface-200/50',
    border: 'border-surface-300/50',
    glow: 'bg-surface-400',
    icon: Clock,
    description: 'No recent activity. The debate is quiet.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  })
}

function formatLargeNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Sparkline SVG ─────────────────────────────────────────────────────────────

function SparklineChart({ buckets, className }: { buckets: PulseHourBucket[]; className?: string }) {
  const W = 600
  const H = 100
  const PAD = 4

  if (!buckets.length) return null

  const maxVal = Math.max(...buckets.map((b) => b.total), 1)

  const points = buckets.map((b, i) => {
    const x = PAD + (i / (buckets.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((b.total / maxVal) * (H - PAD * 2))
    return { x, y, bucket: b }
  })

  const forPoints = buckets.map((b, i) => {
    const x = PAD + (i / (buckets.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((b.blue / maxVal) * (H - PAD * 2))
    return { x, y }
  })

  const againstPoints = buckets.map((b, i) => {
    const x = PAD + (i / (buckets.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((b.red / maxVal) * (H - PAD * 2))
    return { x, y }
  })

  const polyline = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x},${p.y}`).join(' ')

  const areaPath = (pts: { x: number; y: number }[]) => {
    if (!pts.length) return ''
    const move = `M ${pts[0].x},${H - PAD}`
    const lines = pts.map((p) => `L ${p.x},${p.y}`).join(' ')
    const close = `L ${pts[pts.length - 1].x},${H - PAD} Z`
    return `${move} ${lines} ${close}`
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('w-full overflow-visible', className)}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="forGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="againstGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b7280" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6b7280" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Total area fill */}
      <path d={areaPath(points)} fill="url(#totalGrad)" />

      {/* FOR area */}
      <path d={areaPath(forPoints)} fill="url(#forGrad)" />

      {/* AGAINST area */}
      <path d={areaPath(againstPoints)} fill="url(#againstGrad)" />

      {/* FOR line */}
      <polyline
        points={polyline(forPoints)}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />

      {/* AGAINST line */}
      <polyline
        points={polyline(againstPoints)}
        fill="none"
        stroke="#ef4444"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />

      {/* Total line */}
      <polyline
        points={polyline(points)}
        fill="none"
        stroke="#9ca3af"
        strokeWidth="1"
        strokeDasharray="3 3"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Current hour dot (last point) */}
      {points.length > 0 && (
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r="4"
          fill="#6b7280"
          stroke="#0f1117"
          strokeWidth="2"
        />
      )}
    </svg>
  )
}

// ─── Heartbeat bars ───────────────────────────────────────────────────────────

function HeartbeatBars({ buckets, momentum }: { buckets: PulseHourBucket[]; momentum: PulseMomentum }) {
  const maxVal = Math.max(...buckets.map((b) => b.total), 1)
  const cfg = MOMENTUM_CONFIG[momentum]

  return (
    <div className="flex items-end gap-[2px] h-12 w-full">
      {buckets.map((b, i) => {
        const heightPct = Math.max(4, (b.total / maxVal) * 100)
        const isRecent = i >= buckets.length - 3
        return (
          <motion.div
            key={b.hour}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: i * 0.01 }}
            style={{ height: `${heightPct}%` }}
            className={cn(
              'flex-1 rounded-sm origin-bottom transition-colors',
              isRecent
                ? cn(cfg.bg.replace('/10', '/30'), 'border-b', cfg.border)
                : 'bg-surface-300/40'
            )}
            title={`${formatHour(b.hour)}: ${b.total} votes`}
          />
        )
      })}
    </div>
  )
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulsingDot({ momentum }: { momentum: PulseMomentum }) {
  const cfg = MOMENTUM_CONFIG[momentum]
  const isAlive = momentum !== 'dormant'

  return (
    <div className="relative flex items-center justify-center h-6 w-6 flex-shrink-0">
      {isAlive && (
        <motion.span
          className={cn('absolute inset-0 rounded-full opacity-30', cfg.glow)}
          animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <span className={cn('h-2.5 w-2.5 rounded-full', cfg.glow)} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PulseClientProps {
  topicId: string
  topicStatement: string
}

export function PulseClient({ topicId }: PulseClientProps) {
  const [data, setData] = useState<PulseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPulse = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topicId}/pulse`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = (await res.json()) as PulseData
      setData(json)
      setLastRefresh(new Date())
    } catch {
      // best-effort — retain stale data
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    fetchPulse()
    intervalRef.current = setInterval(fetchPulse, POLL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchPulse])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-surface-500" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-10 pb-24 text-center">
          <p className="text-surface-500 font-mono text-sm">Pulse data unavailable.</p>
          <button
            onClick={fetchPulse}
            className="mt-4 text-xs font-mono text-surface-400 hover:text-white transition-colors"
          >
            Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const cfg = MOMENTUM_CONFIG[data.momentum]
  const Icon = cfg.icon
  const forPct = Math.round(data.topic.blue_pct)
  const againstPct = 100 - forPct

  const velocityUp =
    data.velocity_change_pct !== null && data.velocity_change_pct > 0
  const velocityDown =
    data.velocity_change_pct !== null && data.velocity_change_pct < 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-4">

        {/* Back nav */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Heart className="h-4 w-4 text-against-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-surface-500 font-semibold">
              Live Pulse
            </span>
          </div>
          <h1 className="font-mono text-lg font-bold text-white leading-snug line-clamp-2">
            {data.topic.statement}
          </h1>
          {data.topic.category && (
            <Badge variant="neutral" className="mt-1.5 text-[10px]">
              {data.topic.category}
            </Badge>
          )}
        </div>

        {/* Momentum banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'relative rounded-2xl border p-5 overflow-hidden',
            cfg.bg, cfg.border
          )}
        >
          {/* Glow blob */}
          <div
            className={cn(
              'absolute -top-8 -right-8 h-36 w-36 rounded-full blur-3xl opacity-20 pointer-events-none',
              cfg.glow
            )}
          />

          <div className="relative flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <PulsingDot momentum={data.momentum} />
                <span className={cn('font-mono text-xs font-bold uppercase tracking-widest', cfg.color)}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-sm font-mono text-surface-400 leading-relaxed">
                {cfg.description}
              </p>
            </div>
            <div className={cn('flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center border', cfg.bg, cfg.border)}>
              <Icon className={cn('h-5 w-5', cfg.color)} />
            </div>
          </div>

          {/* Velocity metrics */}
          <div className="mt-4 pt-4 border-t border-surface-300/20 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-0.5">
                Last Hour
              </p>
              <div className="flex items-center gap-1.5">
                <span className={cn('font-mono text-2xl font-bold', cfg.color)}>
                  {data.votes_1h}
                </span>
                <span className="font-mono text-xs text-surface-500">votes</span>
                {velocityUp && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-emerald font-bold ml-1">
                    <ArrowUp className="h-2.5 w-2.5" />
                    +{data.velocity_change_pct}%
                  </span>
                )}
                {velocityDown && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-against-400 font-bold ml-1">
                    <ArrowDown className="h-2.5 w-2.5" />
                    {data.velocity_change_pct}%
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-0.5">
                Last 24 Hours
              </p>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-2xl font-bold text-white">
                  {formatLargeNum(data.votes_24h)}
                </span>
                <span className="font-mono text-xs text-surface-500">votes</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 24h Heartbeat bars */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-surface-500">
                24h Heartbeat
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-for-400">
                <span className="h-1.5 w-3 rounded-full bg-for-500 inline-block" />
                FOR
              </span>
              <span className="flex items-center gap-1 text-against-400">
                <span className="h-1.5 w-3 rounded-full bg-against-500 inline-block" />
                AGAINST
              </span>
            </div>
          </div>

          <HeartbeatBars buckets={data.buckets} momentum={data.momentum} />

          <div className="mt-1">
            <SparklineChart buckets={data.buckets} className="h-24" />
          </div>

          <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
            <span>24h ago</span>
            <span>Now</span>
          </div>
        </motion.div>

        {/* Vote split 24h */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold">
            24h Vote Split
          </h2>

          {data.votes_24h > 0 ? (
            <>
              <div className="flex justify-between text-sm font-mono font-bold">
                <span className="text-for-400">
                  {Math.round((data.for_24h / data.votes_24h) * 100)}% FOR
                </span>
                <span className="text-surface-500 text-xs font-normal">
                  {data.votes_24h} votes today
                </span>
                <span className="text-against-400">
                  {Math.round((data.against_24h / data.votes_24h) * 100)}% AGAINST
                </span>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden bg-surface-300">
                <div
                  className="h-full bg-gradient-to-r from-for-700 to-for-400 transition-all duration-700"
                  style={{ width: `${(data.for_24h / data.votes_24h) * 100}%` }}
                />
                <div
                  className="h-full bg-against-600"
                  style={{ width: `${(data.against_24h / data.votes_24h) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-for-500/5 border border-for-500/20 p-3">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <ThumbsUp className="h-3 w-3 text-for-400" />
                    <span className="text-xs font-mono text-for-400 font-bold">FOR</span>
                  </div>
                  <span className="font-mono text-xl font-bold text-white">
                    {formatLargeNum(data.for_24h)}
                  </span>
                </div>
                <div className="rounded-xl bg-against-500/5 border border-against-500/20 p-3">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <ThumbsDown className="h-3 w-3 text-against-400" />
                    <span className="text-xs font-mono text-against-400 font-bold">AGAINST</span>
                  </div>
                  <span className="font-mono text-xl font-bold text-white">
                    {formatLargeNum(data.against_24h)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm font-mono text-surface-500 text-center py-2">
              No votes in the last 24 hours.
            </p>
          )}
        </motion.div>

        {/* All-time context */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4"
        >
          <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold mb-3">
            All-Time Context
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="font-mono text-lg font-bold text-white">
                {formatLargeNum(data.topic.total_votes)}
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                Total Votes
              </div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-for-400">
                {forPct}%
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                For
              </div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-against-400">
                {againstPct}%
              </div>
              <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
                Against
              </div>
            </div>
          </div>

          {data.peak_count > 0 && data.peak_hour && (
            <div className="mt-3 pt-3 border-t border-surface-300/30 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                <span className="text-xs font-mono text-surface-500">Peak hour (24h)</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-xs font-bold text-gold">
                  {data.peak_count} votes
                </span>
                <span className="font-mono text-[10px] text-surface-600 ml-1.5">
                  @ {formatHour(data.peak_hour)}
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Auto-refresh footer */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
            <RefreshCw className="h-3 w-3" />
            {lastRefresh
              ? `Updated ${lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}`
              : 'Refreshing…'}
          </div>
          <button
            onClick={fetchPulse}
            className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            Refresh now
          </button>
        </div>

        {/* Navigate to related views */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/topic/${topicId}/activity`}
            className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
          >
            <Activity className="h-4 w-4 text-surface-500 mb-1.5 group-hover:text-white transition-colors" />
            <p className="text-sm font-mono font-semibold text-white">Activity Log</p>
            <p className="text-xs font-mono text-surface-500 leading-snug">Individual events</p>
          </Link>
          <Link
            href={`/topic/${topicId}/heat`}
            className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
          >
            <Flame className="h-4 w-4 text-surface-500 mb-1.5 group-hover:text-against-400 transition-colors" />
            <p className="text-sm font-mono font-semibold text-white">Vote Heatmap</p>
            <p className="text-xs font-mono text-surface-500 leading-snug">When people vote</p>
          </Link>
          <Link
            href={`/topic/${topicId}/momentum`}
            className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
          >
            <TrendingUp className="h-4 w-4 text-surface-500 mb-1.5 group-hover:text-for-400 transition-colors" />
            <p className="text-sm font-mono font-semibold text-white">Momentum</p>
            <p className="text-xs font-mono text-surface-500 leading-snug">Vote split over time</p>
          </Link>
          <Link
            href={`/topic/${topicId}`}
            className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
          >
            <Heart className="h-4 w-4 text-surface-500 mb-1.5 group-hover:text-against-400 transition-colors" />
            <p className="text-sm font-mono font-semibold text-white">Full Debate</p>
            <p className="text-xs font-mono text-surface-500 leading-snug">Cast your vote</p>
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
