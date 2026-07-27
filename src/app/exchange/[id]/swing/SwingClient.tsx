'use client'

/**
 * /exchange/[id]/swing — Market Swing Analyzer
 *
 * Detects and visualises major price swings in a civic prediction market.
 * A "swing" is any session where the consensus price moved ≥4 percentage
 * points in a single day, or ≥7pp over a rolling 3-day window.
 *
 * Shows:
 *   - SVG price chart with swing markers (up/down arrows)
 *   - Stat cards: largest swing, current trend, volatility, swing count
 *   - Ordered list of every detected swing with magnitude and direction
 *   - Momentum indicator (is the market accelerating or decelerating?)
 *
 * Data source: /api/topics/[id]/vote-trend (same endpoint, exchange markets
 * are topics under the hood).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  ChevronRight,
  Gavel,
  Minus,
  TrendingDown,
  TrendingUp,
  Zap,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { VoteTrendPoint, VoteTrendResponse } from '@/app/api/topics/[id]/vote-trend/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 120_000
const SWING_THRESHOLD_DAY = 4   // pp single-day swing
const SWING_THRESHOLD_WEEK = 7  // pp 3-day rolling swing

// ─── Types ────────────────────────────────────────────────────────────────────

interface SwingEvent {
  date: string
  fromPct: number
  toPct: number
  delta: number          // signed pp change (positive = bullish)
  magnitude: number      // abs pp change
  direction: 'bull' | 'bear'
  window: '1d' | '3d'   // which detection window fired
  totalVotes: number
}

interface SwingStats {
  largestBull: SwingEvent | null
  largestBear: SwingEvent | null
  avgMagnitude: number
  volatility: 'high' | 'medium' | 'low'
  trend: 'rising' | 'falling' | 'stable'
  momentum: 'accelerating' | 'decelerating' | 'steady'
  recentSwings: number  // swings in last 7 days of data
}

interface Props {
  id: string
  statement: string
  category: string | null
  status: string
  currentPrice: number
  totalVotes: number
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' })
}

function detectSwings(points: VoteTrendPoint[]): SwingEvent[] {
  if (points.length < 2) return []

  const swings: SwingEvent[] = []
  const seen = new Set<string>()

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const delta1d = curr.forPct - prev.forPct
    const abs1d = Math.abs(delta1d)

    if (abs1d >= SWING_THRESHOLD_DAY) {
      const key = curr.date + '_1d'
      if (!seen.has(key)) {
        seen.add(key)
        swings.push({
          date: curr.date,
          fromPct: prev.forPct,
          toPct: curr.forPct,
          delta: delta1d,
          magnitude: abs1d,
          direction: delta1d > 0 ? 'bull' : 'bear',
          window: '1d',
          totalVotes: curr.totalVotes,
        })
      }
    }

    // 3-day rolling swing
    if (i >= 3) {
      const base = points[i - 3]
      const delta3d = curr.forPct - base.forPct
      const abs3d = Math.abs(delta3d)
      if (abs3d >= SWING_THRESHOLD_WEEK) {
        const key = curr.date + '_3d'
        if (!seen.has(key)) {
          seen.add(key)
          swings.push({
            date: curr.date,
            fromPct: base.forPct,
            toPct: curr.forPct,
            delta: delta3d,
            magnitude: abs3d,
            direction: delta3d > 0 ? 'bull' : 'bear',
            window: '3d',
            totalVotes: curr.totalVotes,
          })
        }
      }
    }
  }

  return swings.sort((a, b) => b.date.localeCompare(a.date))
}

function computeStats(points: VoteTrendPoint[], swings: SwingEvent[]): SwingStats {
  const bullSwings = swings.filter(s => s.direction === 'bull')
  const bearSwings = swings.filter(s => s.direction === 'bear')

  const largestBull = bullSwings.reduce<SwingEvent | null>(
    (best, s) => (!best || s.magnitude > best.magnitude ? s : best), null
  )
  const largestBear = bearSwings.reduce<SwingEvent | null>(
    (best, s) => (!best || s.magnitude > best.magnitude ? s : best), null
  )

  const avgMagnitude = swings.length
    ? swings.reduce((sum, s) => sum + s.magnitude, 0) / swings.length
    : 0

  // Volatility based on swing frequency relative to time span
  const days = points.length
  const swingsPerDay = days > 0 ? swings.length / days : 0
  const volatility: SwingStats['volatility'] =
    swingsPerDay > 0.3 ? 'high' : swingsPerDay > 0.1 ? 'medium' : 'low'

  // Trend: compare first 20% of points to last 20%
  const q = Math.max(1, Math.floor(points.length * 0.2))
  const earlyAvg = points.slice(0, q).reduce((s, p) => s + p.forPct, 0) / q
  const lateAvg  = points.slice(-q).reduce((s, p) => s + p.forPct, 0) / q
  const trendDelta = lateAvg - earlyAvg
  const trend: SwingStats['trend'] =
    trendDelta > 3 ? 'rising' : trendDelta < -3 ? 'falling' : 'stable'

  // Momentum: compare swing frequency in first half vs second half
  const mid = points[Math.floor(points.length / 2)]?.date ?? ''
  const firstHalfSwings = swings.filter(s => s.date < mid).length
  const secondHalfSwings = swings.filter(s => s.date >= mid).length
  const momentum: SwingStats['momentum'] =
    secondHalfSwings > firstHalfSwings + 1 ? 'accelerating'
    : firstHalfSwings > secondHalfSwings + 1 ? 'decelerating'
    : 'steady'

  const sevenDaysAgo = points.length >= 7
    ? points[points.length - 7].date
    : points[0]?.date ?? ''
  const recentSwings = swings.filter(s => s.date >= sevenDaysAgo).length

  return { largestBull, largestBear, avgMagnitude, volatility, trend, momentum, recentSwings }
}

// ─── SVG Swing Chart ──────────────────────────────────────────────────────────

function SwingChart({ points, swings }: { points: VoteTrendPoint[]; swings: SwingEvent[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 600
  const H = 160
  const PAD = { top: 16, right: 12, bottom: 24, left: 36 }

  const prices = points.map(p => p.forPct)
  const minP = Math.max(0, Math.min(...prices) - 5)
  const maxP = Math.min(100, Math.max(...prices) + 5)
  const rangeP = maxP - minP || 10

  const xOf = (i: number) =>
    PAD.left + (i / Math.max(points.length - 1, 1)) * (W - PAD.left - PAD.right)
  const yOf = (pct: number) =>
    PAD.top + ((maxP - pct) / rangeP) * (H - PAD.top - PAD.bottom)

  // Build smooth path
  const pathD = points.reduce((d, p, i) => {
    const x = xOf(i)
    const y = yOf(p.forPct)
    return i === 0 ? `M ${x} ${y}` : `${d} L ${x} ${y}`
  }, '')

  // Area fill
  const firstX = xOf(0)
  const lastX  = xOf(points.length - 1)
  const baseY  = H - PAD.bottom
  const areaD  = `${pathD} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`

  // Swing index map (date → index in points)
  const dateToIdx = new Map(points.map((p, i) => [p.date, i]))

  const swingMarkers = swings.map(s => {
    const idx = dateToIdx.get(s.date)
    if (idx == null) return null
    const x = xOf(idx)
    const y = yOf(s.toPct)
    return { ...s, x, y }
  }).filter(Boolean) as (SwingEvent & { x: number; y: number })[]

  // Y-axis ticks
  const tickValues = [25, 50, 75]

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      aria-label="Price swing chart"
    >
      <defs>
        <linearGradient id="swing-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(59,130,246)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(59,130,246)" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="swing-line-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {tickValues.map(v => {
        const y = yOf(v)
        return (
          <g key={v}>
            <line
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke="rgba(255,255,255,0.06)" strokeWidth={1}
            />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end"
              fontSize={9} fill="rgba(255,255,255,0.3)"
            >{v}¢</text>
          </g>
        )
      })}

      {/* 50¢ midline */}
      <line
        x1={PAD.left} y1={yOf(50)} x2={W - PAD.right} y2={yOf(50)}
        stroke="rgba(255,255,255,0.15)" strokeWidth={1} strokeDasharray="3 3"
      />

      {/* Area fill */}
      {areaD && <path d={areaD} fill="url(#swing-area-grad)" />}

      {/* Price line */}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="url(#swing-line-grad)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Swing markers */}
      {swingMarkers.map((s, i) => {
        const isBull = s.direction === 'bull'
        const color = isBull ? '#22c55e' : '#ef4444'
        const r = 5
        return (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r={r + 3} fill={color} fillOpacity={0.15} />
            <circle cx={s.x} cy={s.y} r={r} fill={color} fillOpacity={0.8} />
            {/* Arrow */}
            <path
              d={isBull
                ? `M ${s.x} ${s.y + 3} L ${s.x - 3} ${s.y + 8} L ${s.x + 3} ${s.y + 8} Z`
                : `M ${s.x} ${s.y - 3} L ${s.x - 3} ${s.y - 8} L ${s.x + 3} ${s.y - 8} Z`
              }
              fill={color}
              opacity={0.9}
            />
          </g>
        )
      })}

      {/* Current price dot */}
      {points.length > 0 && (() => {
        const last = points[points.length - 1]
        const x = xOf(points.length - 1)
        const y = yOf(last.forPct)
        return (
          <>
            <circle cx={x} cy={y} r={6} fill="#3b82f6" opacity={0.3} />
            <circle cx={x} cy={y} r={3} fill="#93c5fd" />
          </>
        )
      })()}
    </svg>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-surface-500">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
      {sub && <p className="text-xs text-surface-500 leading-tight">{sub}</p>}
    </div>
  )
}

// ─── Swing Row ────────────────────────────────────────────────────────────────

function SwingRow({ swing, rank }: { swing: SwingEvent; rank: number }) {
  const isBull = swing.direction === 'bull'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border',
        isBull
          ? 'bg-for-600/5 border-for-500/20'
          : 'bg-against-600/5 border-against-500/20',
      )}
    >
      {/* Direction badge */}
      <div className={cn(
        'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
        isBull ? 'bg-for-500/20' : 'bg-against-500/20',
      )}>
        {isBull
          ? <ArrowUpRight className="w-4 h-4 text-for-400" />
          : <ArrowDownRight className="w-4 h-4 text-against-400" />
        }
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-sm font-semibold font-mono',
            isBull ? 'text-for-300' : 'text-against-300',
          )}>
            {isBull ? '+' : ''}{swing.delta.toFixed(1)}¢
          </span>
          <span className="text-xs text-surface-500">
            {Math.round(swing.fromPct)}¢ → {Math.round(swing.toPct)}¢
          </span>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1.5 py-0',
              swing.window === '1d'
                ? 'border-surface-400/50 text-surface-500'
                : 'border-purple/40 text-purple',
            )}
          >
            {swing.window === '1d' ? '1-day' : '3-day'}
          </Badge>
        </div>
        <p className="text-xs text-surface-500 mt-0.5">{fmtDate(swing.date)}</p>
      </div>

      {/* Magnitude bar */}
      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-mono font-bold text-surface-400">
          {swing.magnitude.toFixed(1)}pp
        </div>
        <div className="w-16 h-1.5 bg-surface-300 rounded-full mt-1 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              isBull ? 'bg-for-500' : 'bg-against-500',
            )}
            style={{ width: `${Math.min(100, (swing.magnitude / 20) * 100)}%` }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SwingClient({
  id,
  statement,
  category,
  status,
  currentPrice,
}: Props) {
  const [points, setPoints] = useState<VoteTrendPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [window3d, setWindow3d] = useState<'all' | 'bull' | 'bear'>('all')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${id}/vote-trend`)
      if (!res.ok) throw new Error('fetch failed')
      const data: VoteTrendResponse = await res.json()
      setPoints(data.points)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const allSwings = useMemo(() => detectSwings(points), [points])
  const stats      = useMemo(() => computeStats(points, allSwings), [points, allSwings])

  const filteredSwings = useMemo(() => {
    if (window3d === 'all') return allSwings
    return allSwings.filter(s => s.direction === window3d)
  }, [allSwings, window3d])

  const isLaw   = status === 'law'
  const isFailed = status === 'failed'

  // ── Volatility config
  const volConfig = {
    high:   { label: 'High',   color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
    medium: { label: 'Medium', color: 'text-gold',         bg: 'bg-gold/10',        border: 'border-gold/30' },
    low:    { label: 'Low',    color: 'text-for-300',      bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  }

  const trendConfig = {
    rising:  { label: 'Rising',  color: 'text-for-300',      icon: TrendingUp },
    falling: { label: 'Falling', color: 'text-against-300',  icon: TrendingDown },
    stable:  { label: 'Stable',  color: 'text-surface-400',  icon: Minus },
  }

  const momConfig = {
    accelerating: { label: 'Accelerating', color: 'text-gold' },
    decelerating: { label: 'Decelerating', color: 'text-surface-400' },
    steady:       { label: 'Steady',       color: 'text-for-300' },
  }

  const vc = volConfig[stats.volatility]
  const tc = trendConfig[stats.trend]
  const mc = momConfig[stats.momentum]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <div className="max-w-3xl mx-auto px-4 pt-4 pb-28">
        {/* Back link */}
        <Link
          href={`/exchange/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Market
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl font-bold text-white">Swing Analysis</h1>
            {category && (
              <Badge variant="outline" className="text-xs border-surface-400/50 text-surface-400">
                {category}
              </Badge>
            )}
            {isLaw && (
              <Badge className="bg-gold/20 text-gold border-gold/30 text-xs flex items-center gap-1">
                <Gavel className="w-3 h-3" /> LAW
              </Badge>
            )}
            {isFailed && (
              <Badge className="bg-against-500/10 text-against-300 border-against-500/30 text-xs">
                Failed
              </Badge>
            )}
          </div>
          <p className="text-sm text-surface-500 leading-snug line-clamp-2">{statement}</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
            <Skeleton className="h-52 rounded-2xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Failed to load swing data"
            description="Could not fetch vote history. Please try again."
            action={{ label: 'Retry', onClick: load }}
          />
        ) : points.length < 3 ? (
          <EmptyState
            icon={BarChart2}
            title="Not enough data yet"
            description="Swing analysis needs at least 3 days of trading data. Check back soon."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Largest Bull Swing"
                  value={stats.largestBull ? `+${stats.largestBull.magnitude.toFixed(1)}pp` : '—'}
                  sub={stats.largestBull ? fmtDate(stats.largestBull.date) : 'No bull swings detected'}
                  color="text-for-300"
                  icon={ArrowUpRight}
                />
                <StatCard
                  label="Largest Bear Swing"
                  value={stats.largestBear ? `−${stats.largestBear.magnitude.toFixed(1)}pp` : '—'}
                  sub={stats.largestBear ? fmtDate(stats.largestBear.date) : 'No bear swings detected'}
                  color="text-against-300"
                  icon={ArrowDownRight}
                />
                <StatCard
                  label="Price Trend"
                  value={tc.label}
                  sub={`${points[0]?.forPct.toFixed(0)}¢ → ${points[points.length - 1]?.forPct.toFixed(0)}¢ all-time`}
                  color={tc.color}
                  icon={tc.icon}
                />
                <StatCard
                  label="Swing Momentum"
                  value={mc.label}
                  sub={`${stats.recentSwings} swings in last 7 days`}
                  color={mc.color}
                  icon={Activity}
                />
              </div>

              {/* Volatility badge */}
              <div className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm',
                vc.bg, vc.border,
              )}>
                <Zap className={cn('w-4 h-4', vc.color)} />
                <span className={cn('font-semibold', vc.color)}>{vc.label} Volatility</span>
                <span className="text-surface-500 text-xs">
                  · {allSwings.length} swing{allSwings.length !== 1 ? 's' : ''} detected across {points.length} trading days
                  · avg {stats.avgMagnitude.toFixed(1)}pp per swing
                </span>
              </div>

              {/* Chart card */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-white">Consensus Price Chart</p>
                    <p className="text-xs text-surface-500">Swing events marked with arrows</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-for-400">
                      <span className="w-2 h-2 rounded-full bg-for-500 inline-block" /> Bull swing
                    </span>
                    <span className="flex items-center gap-1 text-xs text-against-400">
                      <span className="w-2 h-2 rounded-full bg-against-500 inline-block" /> Bear swing
                    </span>
                  </div>
                </div>
                <SwingChart points={points} swings={allSwings} />
                <div className="flex items-center justify-between mt-3 text-xs text-surface-500">
                  <span>{fmtDate(points[0].date)}</span>
                  <span className="font-mono font-bold text-white">{currentPrice}¢ now</span>
                  <span>{fmtDate(points[points.length - 1].date)}</span>
                </div>
              </div>

              {/* Swing list */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-white">
                    Detected Swings
                    {allSwings.length > 0 && (
                      <span className="ml-2 text-xs text-surface-500 font-normal">
                        ({allSwings.length})
                      </span>
                    )}
                  </p>
                  {/* Filter tabs */}
                  <div className="flex gap-1 bg-surface-200 rounded-lg p-0.5">
                    {(['all', 'bull', 'bear'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setWindow3d(f)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                          window3d === f
                            ? f === 'bull'
                              ? 'bg-for-500/20 text-for-300'
                              : f === 'bear'
                                ? 'bg-against-500/20 text-against-300'
                                : 'bg-surface-300 text-white'
                            : 'text-surface-500 hover:text-white',
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredSwings.length === 0 ? (
                  <EmptyState
                    icon={BarChart2}
                    title="No swings detected"
                    description={
                      window3d === 'all'
                        ? 'The market has been stable — no significant price moves found.'
                        : `No ${window3d === 'bull' ? 'bullish' : 'bearish'} swings in the selected range.`
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredSwings.map((swing, i) => (
                      <SwingRow key={`${swing.date}_${swing.window}`} swing={swing} rank={i} />
                    ))}
                  </div>
                )}
              </div>

              {/* Interpretation */}
              {allSwings.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-surface-500" />
                    Swing Interpretation
                  </p>
                  <div className="space-y-2 text-sm text-surface-400 leading-relaxed">
                    <p>
                      This market has experienced{' '}
                      <span className="text-white font-medium">{allSwings.length} swing event{allSwings.length !== 1 ? 's' : ''}</span>{' '}
                      since trading began.{' '}
                      {stats.largestBull && stats.largestBear
                        ? `The largest single-session move was a ${
                            stats.largestBull.magnitude >= stats.largestBear.magnitude
                              ? `${stats.largestBull.magnitude.toFixed(1)}pp bull swing on ${fmtDate(stats.largestBull.date)}`
                              : `${stats.largestBear.magnitude.toFixed(1)}pp bear swing on ${fmtDate(stats.largestBear.date)}`
                          }.`
                        : stats.largestBull
                          ? `All detected swings have been bullish, with the largest at ${stats.largestBull.magnitude.toFixed(1)}pp.`
                          : `All detected swings have been bearish, with the largest at ${stats.largestBear?.magnitude.toFixed(1)}pp.`
                      }
                    </p>
                    <p>
                      {stats.volatility === 'high'
                        ? 'High volatility suggests this market is actively contested — new arguments and debate activity are frequently shifting consensus.'
                        : stats.volatility === 'medium'
                          ? 'Moderate volatility indicates periodic momentum shifts, likely tied to major debate or argument events.'
                          : 'Low volatility suggests broad consensus — the market is unlikely to swing without a major external catalyst.'
                      }
                    </p>
                    <p>
                      {stats.momentum === 'accelerating'
                        ? 'Swing frequency is increasing in recent sessions — watch for a decisive move toward resolution.'
                        : stats.momentum === 'decelerating'
                          ? 'Swing frequency is declining — the market may be entering a period of consensus consolidation.'
                          : 'Swing frequency is steady — no notable acceleration or deceleration in price volatility.'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Nav links */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: `/exchange/${id}/smart-money`, label: 'Smart Money', sub: 'Who leads the moves' },
                  { href: `/exchange/${id}/momentum`,    label: 'Momentum',    sub: 'Vote velocity trends' },
                  { href: `/exchange/${id}/simulation`,  label: 'Simulation',  sub: 'Model hypothetical moves' },
                  { href: `/exchange/${id}/chart`,       label: 'Full Chart',  sub: 'Historical price view' },
                ].map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors">
                        {link.label}
                      </p>
                      <p className="text-xs text-surface-500">{link.sub}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-for-300 transition-colors" />
                  </Link>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
