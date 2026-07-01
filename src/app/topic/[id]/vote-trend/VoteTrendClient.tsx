'use client'

/**
 * /topic/[id]/vote-trend — Consensus Trajectory
 *
 * Full-page visualization of how the FOR% has moved since the debate began.
 * Shows a large SVG area chart, inflection milestones, time-window selector,
 * and trend summary statistics.
 *
 * Distinct from:
 *   /topic/[id]/velocity   — votes per day (speed), not cumulative %
 *   /topic/[id]/momentum   — acceleration of vote rate
 *   /topic/[id]/inflection — AI-inferred turning-point events
 *   /topic/[id]/stats      — raw vote breakdown tables
 *
 * This is the only page showing cumulative consensus % as a time series.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { VoteTrendPoint, VoteTrendResponse } from '@/app/api/topics/[id]/vote-trend/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Window = '7d' | '30d' | 'all'

interface Milestone {
  date: string
  label: string
  delta: number // pp change on that day
  forPct: number
  totalVotes: number
}

interface TrendStats {
  startPct: number
  endPct: number
  peakForPct: number
  peakAgainstPct: number
  largestSwing: Milestone | null
  daysCrossedMajority: string | null
  trendDirection: 'rising' | 'falling' | 'stable'
  volatility: 'high' | 'medium' | 'low'
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VoteTrendClientProps {
  topicId: string
  statement: string
  category: string | null
  status: string
  currentForPct: number
  totalVotes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ─── Compute milestones ───────────────────────────────────────────────────────

function computeMilestones(points: VoteTrendPoint[]): Milestone[] {
  if (points.length < 2) return []

  const milestones: Milestone[] = []
  const MIN_DELTA = 3 // pp minimum shift to qualify
  const MAX_COUNT = 6

  for (let i = 1; i < points.length; i++) {
    const delta = points[i].forPct - points[i - 1].forPct
    if (Math.abs(delta) >= MIN_DELTA) {
      const dir = delta > 0 ? 'surged' : 'dropped'
      const pp = Math.abs(delta).toFixed(1)
      milestones.push({
        date: points[i].date,
        label: `FOR ${dir} ${pp}pp`,
        delta,
        forPct: points[i].forPct,
        totalVotes: points[i].totalVotes,
      })
    }
  }

  // Sort by abs(delta) descending, keep top MAX_COUNT
  milestones.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const top = milestones.slice(0, MAX_COUNT)
  // Re-sort by date
  top.sort((a, b) => a.date.localeCompare(b.date))
  return top
}

// ─── Compute trend stats ──────────────────────────────────────────────────────

function computeStats(points: VoteTrendPoint[]): TrendStats | null {
  if (points.length < 2) return null

  const startPct = points[0].forPct
  const endPct = points[points.length - 1].forPct
  const peakForPct = Math.max(...points.map((p) => p.forPct))
  const peakAgainstPct = 100 - Math.min(...points.map((p) => p.forPct))

  // Find largest single-day swing
  let largestSwing: Milestone | null = null
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].forPct - points[i - 1].forPct
    if (!largestSwing || Math.abs(delta) > Math.abs(largestSwing.delta)) {
      largestSwing = {
        date: points[i].date,
        label: `${Math.abs(delta).toFixed(1)}pp ${delta > 0 ? 'gain' : 'drop'}`,
        delta,
        forPct: points[i].forPct,
        totalVotes: points[i].totalVotes,
      }
    }
  }

  // Day consensus first crossed 50%
  let daysCrossedMajority: string | null = null
  const startAbove = points[0].forPct >= 50
  for (let i = 1; i < points.length; i++) {
    const nowAbove = points[i].forPct >= 50
    if (nowAbove !== startAbove) {
      daysCrossedMajority = points[i].date
      break
    }
  }

  // Trend direction: compare last 20% of points vs first 20%
  const slice = Math.max(2, Math.floor(points.length * 0.2))
  const earlyAvg = points.slice(0, slice).reduce((s, p) => s + p.forPct, 0) / slice
  const lateAvg = points.slice(-slice).reduce((s, p) => s + p.forPct, 0) / slice
  const diff = lateAvg - earlyAvg
  const trendDirection: TrendStats['trendDirection'] =
    diff > 1.5 ? 'rising' : diff < -1.5 ? 'falling' : 'stable'

  // Volatility: std dev of deltas
  const deltas = points.slice(1).map((p, i) => p.forPct - points[i].forPct)
  const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length
  const variance = deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length
  const stdDev = Math.sqrt(variance)
  const volatility: TrendStats['volatility'] =
    stdDev > 2.5 ? 'high' : stdDev > 1 ? 'medium' : 'low'

  return {
    startPct,
    endPct,
    peakForPct,
    peakAgainstPct,
    largestSwing,
    daysCrossedMajority,
    trendDirection,
    volatility,
  }
}

// ─── Filter points by window ──────────────────────────────────────────────────

function filterByWindow(points: VoteTrendPoint[], window: Window): VoteTrendPoint[] {
  if (window === 'all' || points.length === 0) return points
  const days = window === '7d' ? 7 : 30
  const cutoff = addDays(new Date().toISOString().slice(0, 10), -days)
  const filtered = points.filter((p) => p.date >= cutoff)
  // Always include the last point before cutoff as origin
  if (filtered.length < points.length) {
    const before = points.filter((p) => p.date < cutoff)
    if (before.length > 0) {
      return [before[before.length - 1], ...filtered]
    }
  }
  return filtered
}

// ─── SVG Area Chart ───────────────────────────────────────────────────────────

interface ChartProps {
  points: VoteTrendPoint[]
  width: number
  height: number
  hoveredIdx: number | null
  onHover: (idx: number | null) => void
  milestones: Milestone[]
}

function TrendChart({ points, width, height, hoveredIdx, onHover, milestones }: ChartProps) {
  if (points.length < 2) return null

  const PAD = { top: 16, right: 12, bottom: 32, left: 40 }
  const innerW = width - PAD.left - PAD.right
  const innerH = height - PAD.top - PAD.bottom

  const allPcts = points.map((p) => p.forPct)
  const rawMin = Math.min(...allPcts)
  const rawMax = Math.max(...allPcts)
  // Widen the range slightly so the chart isn't too flat
  const lo = Math.max(0, rawMin - 5)
  const hi = Math.min(100, rawMax + 5)
  const range = hi - lo || 10

  function xOf(i: number) {
    return PAD.left + (i / (points.length - 1)) * innerW
  }
  function yOf(pct: number) {
    return PAD.top + innerH - ((pct - lo) / range) * innerH
  }

  // SVG paths
  const linePts = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.forPct).toFixed(1)}`)
  const linePath = `M${linePts.join('L')}`
  const areaPath =
    `${linePath}` +
    `L${xOf(points.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)}` +
    `L${PAD.left.toFixed(1)},${(PAD.top + innerH).toFixed(1)}Z`

  // 50% guideline
  const y50 = yOf(50)
  const above50 = points[points.length - 1].forPct >= 50

  // Y-axis ticks
  const yTicks: number[] = []
  for (let t = Math.ceil(lo / 10) * 10; t <= hi; t += 10) yTicks.push(t)

  // X-axis labels (evenly spread, max 5)
  const xStep = Math.max(1, Math.floor((points.length - 1) / 4))
  const xIdxs: number[] = [0]
  for (let i = xStep; i < points.length - 1; i += xStep) xIdxs.push(i)
  xIdxs.push(points.length - 1)
  const uniqueXIdxs = Array.from(new Set(xIdxs))

  // Milestone dots — map date → index
  const milestoneIdxMap = new Map<string, number>()
  for (const m of milestones) {
    const idx = points.findIndex((p) => p.date === m.date)
    if (idx !== -1) milestoneIdxMap.set(m.date, idx)
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      onMouseLeave={() => onHover(null)}
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={above50 ? '#3b82f6' : '#ef4444'} stopOpacity="0.25" />
          <stop offset="100%" stopColor={above50 ? '#3b82f6' : '#ef4444'} stopOpacity="0.02" />
        </linearGradient>
        <clipPath id="chartClip">
          <rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} />
        </clipPath>
      </defs>

      {/* Y-axis grid + ticks */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={PAD.left + innerW}
            y1={yOf(t)}
            y2={yOf(t)}
            stroke="#2a2d36"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 6}
            y={yOf(t)}
            textAnchor="end"
            dominantBaseline="middle"
            fill="#6b7280"
            fontSize="10"
            fontFamily="monospace"
          >
            {t}%
          </text>
        </g>
      ))}

      {/* 50% majority line */}
      {lo < 50 && hi > 50 && (
        <line
          x1={PAD.left}
          x2={PAD.left + innerW}
          y1={y50}
          y2={y50}
          stroke="#4b5563"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      )}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" clipPath="url(#chartClip)" />

      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={above50 ? '#3b82f6' : '#ef4444'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        clipPath="url(#chartClip)"
      />

      {/* Milestone dots */}
      {Array.from(milestoneIdxMap.entries()).map(([date, idx]) => (
        <circle
          key={date}
          cx={xOf(idx)}
          cy={yOf(points[idx].forPct)}
          r="4"
          fill="#f59e0b"
          stroke="#0d0f14"
          strokeWidth="1.5"
        />
      ))}

      {/* Hover overlay */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={innerW}
        height={innerH}
        fill="transparent"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect()
          const relX = e.clientX - rect.left
          const ratio = relX / rect.width
          const idx = Math.round(ratio * (points.length - 1))
          onHover(Math.max(0, Math.min(points.length - 1, idx)))
        }}
      />

      {/* Hover crosshair */}
      {hoveredIdx !== null && (
        <g>
          <line
            x1={xOf(hoveredIdx)}
            x2={xOf(hoveredIdx)}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="#4b5563"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <circle
            cx={xOf(hoveredIdx)}
            cy={yOf(points[hoveredIdx].forPct)}
            r="5"
            fill={above50 ? '#3b82f6' : '#ef4444'}
            stroke="#0d0f14"
            strokeWidth="2"
          />
        </g>
      )}

      {/* X-axis labels */}
      {uniqueXIdxs.map((idx) => (
        <text
          key={idx}
          x={xOf(idx)}
          y={PAD.top + innerH + 16}
          textAnchor={idx === 0 ? 'start' : idx === points.length - 1 ? 'end' : 'middle'}
          fill="#6b7280"
          fontSize="9"
          fontFamily="monospace"
        >
          {fmtDateShort(points[idx].date)}
        </text>
      ))}
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-400',
  active: 'text-emerald',
  voting: 'text-purple',
  law: 'text-gold',
  failed: 'text-surface-500',
}

export function VoteTrendClient({
  topicId,
  statement,
  category,
  status,
  currentForPct,
  totalVotes,
}: VoteTrendClientProps) {
  const [allPoints, setAllPoints] = useState<VoteTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [window, setWindow] = useState<Window>('all')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [showAllMilestones, setShowAllMilestones] = useState(false)
  const chartRef = useRef<HTMLDivElement>(null)
  const [chartSize, setChartSize] = useState({ w: 600, h: 280 })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/vote-trend`)
      if (!res.ok) throw new Error('Failed to load vote trend data')
      const json = (await res.json()) as VoteTrendResponse
      setAllPoints(json.points)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  // Observe chart container width for responsive SVG
  useEffect(() => {
    if (!chartRef.current) return
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const w = Math.round(entry.contentRect.width)
        const h = Math.min(320, Math.max(220, Math.round(w * 0.45)))
        setChartSize({ w, h })
      }
    })
    ro.observe(chartRef.current)
    return () => ro.disconnect()
  }, [])

  const filteredPoints = useMemo(() => filterByWindow(allPoints, window), [allPoints, window])
  const milestones = useMemo(() => computeMilestones(filteredPoints), [filteredPoints])
  const stats = useMemo(() => computeStats(filteredPoints), [filteredPoints])

  const hovered = hoveredIdx !== null && filteredPoints[hoveredIdx] ? filteredPoints[hoveredIdx] : null

  const above50 = currentForPct >= 50
  const forColor = above50 ? 'text-for-300' : 'text-against-300'
  const forBg = above50 ? 'bg-for-500/15 border-for-500/30' : 'bg-against-500/15 border-against-500/30'

  const visibleMilestones = showAllMilestones ? milestones : milestones.slice(0, 3)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', STATUS_COLOR[status] ?? 'text-surface-400')}>
              {STATUS_LABEL[status] ?? status}
            </span>
            {category && (
              <Badge variant="outline" className="text-xs font-mono text-surface-400 border-surface-600">
                {category}
              </Badge>
            )}
          </div>
          <h1 className="text-xl font-bold text-white leading-snug mb-1">{statement}</h1>
          <p className="text-sm text-surface-500 font-mono">
            Consensus trajectory · {totalVotes.toLocaleString()} votes
          </p>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Current FOR% */}
          <div className={cn('rounded-2xl border p-3 flex flex-col gap-1', forBg)}>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Current</p>
            <p className={cn('text-2xl font-bold tabular-nums', forColor)}>
              {currentForPct.toFixed(1)}%
            </p>
            <p className="text-[10px] font-mono text-surface-500">FOR</p>
          </div>

          {/* Peak FOR% */}
          <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-3 flex flex-col gap-1">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Peak FOR</p>
            <p className="text-2xl font-bold tabular-nums text-for-300">
              {stats ? stats.peakForPct.toFixed(1) : '—'}%
            </p>
            <p className="text-[10px] font-mono text-surface-500">all time</p>
          </div>

          {/* Trend */}
          <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-3 flex flex-col gap-1">
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Trend</p>
            {stats ? (
              <>
                <div className="flex items-center gap-1">
                  {stats.trendDirection === 'rising' && <TrendingUp className="h-5 w-5 text-for-400" />}
                  {stats.trendDirection === 'falling' && <TrendingDown className="h-5 w-5 text-against-400" />}
                  {stats.trendDirection === 'stable' && <BarChart2 className="h-5 w-5 text-surface-400" />}
                  <p className={cn(
                    'text-sm font-semibold capitalize',
                    stats.trendDirection === 'rising' ? 'text-for-300' :
                    stats.trendDirection === 'falling' ? 'text-against-300' : 'text-surface-400',
                  )}>
                    {stats.trendDirection}
                  </p>
                </div>
                <p className="text-[10px] font-mono text-surface-500">
                  {stats.volatility} volatility
                </p>
              </>
            ) : (
              <p className="text-sm text-surface-500">—</p>
            )}
          </div>
        </div>

        {/* Chart card */}
        <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-4 mb-6">

          {/* Window selector */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono text-surface-500">Time window</span>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-surface-300/60">
              {(['7d', '30d', 'all'] as Window[]).map((w) => (
                <button
                  key={w}
                  onClick={() => { setWindow(w); setHoveredIdx(null) }}
                  className={cn(
                    'px-3 py-1 text-[11px] font-mono transition-colors',
                    window === w
                      ? 'bg-surface-300 text-white'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  {w === 'all' ? 'All' : w}
                </button>
              ))}
            </div>
          </div>

          {/* Chart area */}
          <div ref={chartRef} className="relative" style={{ height: `${chartSize.h}px` }}>
            {loading ? (
              <Skeleton className="absolute inset-0 rounded-xl" />
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center text-surface-500 text-sm font-mono">
                {error}
              </div>
            ) : filteredPoints.length < 2 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-surface-500">
                <BarChart2 className="h-8 w-8 text-surface-600" />
                <p className="text-sm font-mono">Not enough data for this window</p>
              </div>
            ) : (
              <TrendChart
                points={filteredPoints}
                width={chartSize.w}
                height={chartSize.h}
                hoveredIdx={hoveredIdx}
                onHover={setHoveredIdx}
                milestones={milestones}
              />
            )}
          </div>

          {/* Hover tooltip */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                key="tooltip"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="mt-3 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300/60 flex items-center gap-4 flex-wrap"
              >
                <div>
                  <p className="text-[10px] font-mono text-surface-500">DATE</p>
                  <p className="text-xs font-mono text-white">{fmtDate(hovered.date)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-surface-500">FOR</p>
                  <p className={cn('text-sm font-bold tabular-nums', hovered.forPct >= 50 ? 'text-for-300' : 'text-against-300')}>
                    {hovered.forPct.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-surface-500">AGAINST</p>
                  <p className={cn('text-sm font-bold tabular-nums', hovered.forPct < 50 ? 'text-against-300' : 'text-surface-400')}>
                    {(100 - hovered.forPct).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-surface-500">TOTAL VOTES</p>
                  <p className="text-xs font-mono text-white">{hovered.totalVotes.toLocaleString()}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 text-[10px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-gold inline-block rounded-full" />
              Inflection day
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-px border-t border-dashed border-surface-500 inline-block" />
              50% majority line
            </span>
          </div>
        </div>

        {/* Stats detail */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {/* Starting point */}
            <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-4">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Starting Consensus</p>
              <p className={cn('text-lg font-bold tabular-nums', stats.startPct >= 50 ? 'text-for-300' : 'text-against-300')}>
                {stats.startPct.toFixed(1)}% FOR
              </p>
              {filteredPoints.length > 0 && (
                <p className="text-xs text-surface-500 mt-1 font-mono">{fmtDate(filteredPoints[0].date)}</p>
              )}
            </div>

            {/* Net shift */}
            <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-4">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Net Shift</p>
              <p className={cn(
                'text-lg font-bold tabular-nums',
                stats.endPct - stats.startPct > 0 ? 'text-for-300' :
                stats.endPct - stats.startPct < 0 ? 'text-against-300' : 'text-surface-400',
              )}>
                {stats.endPct - stats.startPct > 0 ? '+' : ''}{(stats.endPct - stats.startPct).toFixed(1)}pp
              </p>
              <p className="text-xs text-surface-500 mt-1 font-mono">
                {stats.trendDirection === 'rising'
                  ? 'Moving toward FOR majority'
                  : stats.trendDirection === 'falling'
                  ? 'Moving toward AGAINST majority'
                  : 'Consensus holding steady'}
              </p>
            </div>

            {/* Largest swing */}
            {stats.largestSwing && (
              <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Largest Single-Day Swing</p>
                <p className={cn(
                  'text-lg font-bold tabular-nums',
                  stats.largestSwing.delta > 0 ? 'text-for-300' : 'text-against-300',
                )}>
                  {stats.largestSwing.delta > 0 ? '+' : ''}{stats.largestSwing.delta.toFixed(1)}pp
                </p>
                <p className="text-xs text-surface-500 mt-1 font-mono">{fmtDate(stats.largestSwing.date)}</p>
              </div>
            )}

            {/* Majority crossover */}
            <div className="rounded-xl border border-surface-300/50 bg-surface-100/60 p-4">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Majority Crossed</p>
              {stats.daysCrossedMajority ? (
                <>
                  <p className="text-sm font-mono text-white font-semibold">{fmtDate(stats.daysCrossedMajority)}</p>
                  <p className="text-xs text-surface-500 mt-1 font-mono">Consensus flipped past 50%</p>
                </>
              ) : (
                <p className="text-sm text-surface-500 font-mono">
                  {stats.startPct >= 50 ? 'Has always been FOR majority' : 'Has never crossed 50%'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-semibold text-white">Inflection Days</h2>
              </div>
              <span className="text-[10px] font-mono text-surface-500">{milestones.length} shift{milestones.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {visibleMilestones.map((m) => (
                  <motion.div
                    key={m.date}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/40"
                  >
                    <div className={cn(
                      'flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center',
                      m.delta > 0 ? 'bg-for-500/20' : 'bg-against-500/20',
                    )}>
                      {m.delta > 0
                        ? <TrendingUp className="h-3 w-3 text-for-400" />
                        : <TrendingDown className="h-3 w-3 text-against-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold', m.delta > 0 ? 'text-for-300' : 'text-against-300')}>
                        {m.delta > 0 ? '+' : ''}{m.delta.toFixed(1)}pp · {m.label}
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">
                        {fmtDate(m.date)} · reached {m.forPct.toFixed(1)}% FOR
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] font-mono text-surface-500">
                        {m.totalVotes.toLocaleString()} votes
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {milestones.length > 3 && (
              <button
                onClick={() => setShowAllMilestones((v) => !v)}
                className="mt-3 flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                {showAllMilestones
                  ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> Show {milestones.length - 3} more</>}
              </button>
            )}
          </div>
        )}

        {/* Refresh */}
        <div className="flex items-center justify-between">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>

          <div className="flex items-center gap-3">
            <Link
              href={`/topic/${topicId}/velocity`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Vote velocity
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href={`/topic/${topicId}/inflection`}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Inflection points
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
