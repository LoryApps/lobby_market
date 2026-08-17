'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  CalendarDays,
  ChevronDown,
  Globe,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoodHistoryResponse, MoodDayBucket } from '@/app/api/mood/history/route'
import type { MoodKind } from '@/app/api/mood/route'

// ─── Mood config ──────────────────────────────────────────────────────────────

const MOOD_CONFIG: Record<MoodKind, { emoji: string; label: string; color: string; bg: string; chartColor: string }> = {
  hopeful:    { emoji: '🌱', label: 'Hopeful',    color: 'text-for-400',     bg: 'bg-for-500/10',     chartColor: '#4ade80' },
  inspired:   { emoji: '✨', label: 'Inspired',   color: 'text-gold',        bg: 'bg-gold/10',        chartColor: '#fbbf24' },
  proud:      { emoji: '🏆', label: 'Proud',      color: 'text-emerald',     bg: 'bg-emerald/10',     chartColor: '#34d399' },
  determined: { emoji: '💪', label: 'Determined', color: 'text-purple',      bg: 'bg-purple/10',      chartColor: '#a78bfa' },
  frustrated: { emoji: '😤', label: 'Frustrated', color: 'text-against-400', bg: 'bg-against-500/10', chartColor: '#f87171' },
  worried:    { emoji: '😟', label: 'Worried',    color: 'text-against-300', bg: 'bg-against-600/10', chartColor: '#fb923c' },
  angry:      { emoji: '😠', label: 'Angry',      color: 'text-against-500', bg: 'bg-against-500/15', chartColor: '#dc2626' },
  relieved:   { emoji: '😮‍💨', label: 'Relieved', color: 'text-for-300',     bg: 'bg-for-600/10',     chartColor: '#6ee7b7' },
}

const POSITIVE_MOODS: MoodKind[] = ['hopeful', 'inspired', 'proud', 'determined', 'relieved']
const ANXIOUS_MOODS: MoodKind[] = ['frustrated', 'worried', 'angry']

type Window = '7d' | '30d' | '90d'
const WINDOWS: { id: Window; label: string }[] = [
  { id: '7d',  label: '7 days'  },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

interface LineChartProps {
  buckets: MoodDayBucket[]
  /** Which series to show: 'positive', 'anxious', or a specific MoodKind */
  series: 'positive' | 'anxious' | MoodKind
  color: string
  fillColor: string
  height?: number
}

function LineChart({ buckets, series, color, fillColor, height = 160 }: LineChartProps) {
  const W = 100 // viewBox percentage units
  const H = height
  const PAD = 4

  const values = buckets.map((b) => {
    if (series === 'positive') return b.positive_pct
    if (series === 'anxious') return b.anxious_pct
    return b.total > 0 ? Math.round(((b.moods[series] ?? 0) / b.total) * 100) : 0
  })

  const maxVal = Math.max(...values, 1)
  const n = values.length

  const pts = values.map((v, i) => {
    const x = PAD + (i / Math.max(n - 1, 1)) * (W - PAD * 2)
    const y = H - PAD - (v / maxVal) * (H - PAD * 2)
    return { x, y, v }
  })

  // Build smooth path using simple cubic bezier through all points
  function pathD(points: { x: number; y: number }[]): string {
    if (points.length < 2) return ''
    let d = `M ${points[0].x} ${points[0].y}`
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const cpx = (prev.x + curr.x) / 2
      d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`
    }
    return d
  }

  const linePath = pathD(pts)
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={`fill-${series}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.35" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#fill-${series})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} opacity="0.6" />
      ))}
    </svg>
  )
}

// ─── Stacked Bar Chart ────────────────────────────────────────────────────────

const STACK_COLORS: Record<MoodKind, string> = {
  hopeful:    '#4ade80',
  inspired:   '#fbbf24',
  proud:      '#34d399',
  determined: '#a78bfa',
  frustrated: '#f87171',
  worried:    '#fb923c',
  angry:      '#dc2626',
  relieved:   '#6ee7b7',
}

interface StackedBarChartProps {
  buckets: MoodDayBucket[]
  height?: number
}

function StackedBarChart({ buckets, height = 120 }: StackedBarChartProps) {
  const W = 100
  const H = height
  const PAD_V = 4
  const n = buckets.length
  const barW = Math.max(1, (W / n) * 0.7)
  const gap = W / n

  const moods: MoodKind[] = ['hopeful', 'inspired', 'proud', 'determined', 'relieved', 'worried', 'frustrated', 'angry']

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {buckets.map((b, i) => {
        if (b.total === 0) return null
        const x = gap * i + gap / 2 - barW / 2
        let yOff = H - PAD_V

        return (
          <g key={b.date}>
            {moods.map((m) => {
              const count = b.moods[m] ?? 0
              if (count === 0) return null
              const segH = Math.max(0, ((count / b.total) * (H - PAD_V * 2)))
              yOff -= segH
              const y = yOff
              return (
                <rect
                  key={m}
                  x={x}
                  y={y}
                  width={barW}
                  height={segH}
                  fill={STACK_COLORS[m]}
                  opacity="0.8"
                  rx="0.3"
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Trend badge ──────────────────────────────────────────────────────────────

function TrendBadge({ trend, delta }: { trend: MoodHistoryResponse['trend']; delta: number }) {
  if (trend === 'improving') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-for-500/10 text-for-400 border border-for-500/30">
      <TrendingUp className="h-3 w-3" />
      +{delta}pp more positive
    </span>
  )
  if (trend === 'declining') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-against-500/10 text-against-400 border border-against-500/30">
      <TrendingDown className="h-3 w-3" />
      {delta}pp less positive
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-300/30 text-surface-400 border border-surface-400/30">
      <Minus className="h-3 w-3" />
      Stable mood
    </span>
  )
}

// ─── Date label ───────────────────────────────────────────────────────────────

function fmtDate(iso: string, short = false): string {
  const d = new Date(iso + 'T12:00:00Z')
  if (short) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MoodHistoryClient() {
  const [data, setData] = useState<MoodHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [win, setWin] = useState<Window>('30d')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (w: Window, refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/mood/history?window=${w}`)
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(win) }, [load, win])

  function handleWindowChange(w: Window) {
    setWin(w)
    load(w)
  }

  const buckets = data?.buckets ?? []
  const hovered = hoveredIdx !== null ? buckets[hoveredIdx] : null

  // Compute overall mood totals
  const overallTotals: Record<MoodKind, number> = Object.fromEntries(
    (['hopeful', 'inspired', 'proud', 'determined', 'frustrated', 'worried', 'angry', 'relieved'] as MoodKind[])
      .map((m) => [m, buckets.reduce((s, b) => s + (b.moods[m] ?? 0), 0)])
  ) as Record<MoodKind, number>

  const overallTotal = (data?.total_responses ?? 0)
  const sortedMoods = (Object.entries(overallTotals) as [MoodKind, number][])
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/mood"
              className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Civic Mood
            </Link>
            <h1 className="text-2xl font-bold text-white">Mood History</h1>
            <p className="text-sm text-surface-400 mt-0.5">
              How civic sentiment has evolved over time
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => load(win, true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-surface-200/60 hover:bg-surface-300/60 text-surface-400 hover:text-white transition-all"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Window selector ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => handleWindowChange(w.id)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all',
                win === w.id
                  ? 'bg-for-500/15 text-for-400 border border-for-500/30'
                  : 'bg-surface-200/60 text-surface-400 hover:text-white border border-transparent'
              )}
            >
              {w.label}
            </button>
          ))}
          {data && (
            <TrendBadge trend={data.trend} delta={data.trend_delta} />
          )}
        </div>

        {loading ? (
          <PageSkeleton />
        ) : !data || buckets.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No mood data yet"
            description="Be the first to express how civic debates make you feel."
          />
        ) : (
          <>
            {/* ── Summary cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
                <p className="text-xs text-surface-400 mb-1">Responses</p>
                <p className="text-2xl font-bold text-white">{data.total_responses.toLocaleString()}</p>
                <p className="text-xs text-surface-500 mt-0.5">in {win.replace('d', ' days')}</p>
              </div>
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
                <p className="text-xs text-surface-400 mb-1">Top Mood</p>
                <p className="text-2xl">{MOOD_CONFIG[data.summary.most_common_mood].emoji}</p>
                <p className={cn('text-xs font-semibold mt-0.5', MOOD_CONFIG[data.summary.most_common_mood].color)}>
                  {MOOD_CONFIG[data.summary.most_common_mood].label}
                </p>
              </div>
              {data.summary.peak_positive_date && (
                <div className="bg-for-500/10 border border-for-500/20 rounded-2xl p-4">
                  <p className="text-xs text-for-400 mb-1">Peak Positivity</p>
                  <p className="text-2xl font-bold text-for-400">{data.summary.peak_positive_pct}%</p>
                  <p className="text-xs text-surface-500 mt-0.5">{fmtDate(data.summary.peak_positive_date, true)}</p>
                </div>
              )}
              {data.summary.most_anxious_date && (
                <div className="bg-against-500/10 border border-against-500/20 rounded-2xl p-4">
                  <p className="text-xs text-against-400 mb-1">Peak Anxiety</p>
                  <p className="text-2xl font-bold text-against-400">{data.summary.most_anxious_pct}%</p>
                  <p className="text-xs text-surface-500 mt-0.5">{fmtDate(data.summary.most_anxious_date, true)}</p>
                </div>
              )}
            </div>

            {/* ── Main chart: Positive vs Anxious ─────────────────────────── */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Positive vs Anxious Over Time</h2>
                  <p className="text-xs text-surface-400">% of daily mood responses</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-for-400">
                    <span className="inline-block w-3 h-0.5 bg-for-400 rounded-full" />
                    Positive
                  </span>
                  <span className="flex items-center gap-1.5 text-against-400">
                    <span className="inline-block w-3 h-0.5 bg-against-400 rounded-full" />
                    Anxious
                  </span>
                </div>
              </div>

              {/* Interactive chart area */}
              <div
                ref={chartRef}
                className="relative select-none"
                onMouseLeave={() => setHoveredIdx(null)}
                onMouseMove={(e) => {
                  if (!chartRef.current) return
                  const rect = chartRef.current.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const frac = x / rect.width
                  const idx = Math.round(frac * (buckets.length - 1))
                  setHoveredIdx(Math.max(0, Math.min(idx, buckets.length - 1)))
                }}
              >
                <svg viewBox="0 0 100 160" preserveAspectRatio="none" className="w-full" style={{ height: 160 }}>
                  <defs>
                    <linearGradient id="pos-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4ade80" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#4ade80" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="anx-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#f87171" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const vals = buckets.map((b) => ({ pos: b.positive_pct, anx: b.anxious_pct }))
                    const maxV = Math.max(...vals.map((v) => Math.max(v.pos, v.anx)), 1)
                    const PAD = 4; const W = 100; const H = 160
                    const pts = (getter: (v: typeof vals[0]) => number) =>
                      vals.map((v, i) => ({
                        x: PAD + (i / Math.max(vals.length - 1, 1)) * (W - PAD * 2),
                        y: H - PAD - (getter(v) / maxV) * (H - PAD * 2),
                      }))
                    function pathD(points: { x: number; y: number }[]): string {
                      if (!points.length) return ''
                      let d = `M ${points[0].x} ${points[0].y}`
                      for (let i = 1; i < points.length; i++) {
                        const p = points[i - 1], c = points[i]
                        const cpx = (p.x + c.x) / 2
                        d += ` C ${cpx} ${p.y} ${cpx} ${c.y} ${c.x} ${c.y}`
                      }
                      return d
                    }
                    const posPts = pts((v) => v.pos)
                    const anxPts = pts((v) => v.anx)
                    const posLine = pathD(posPts)
                    const anxLine = pathD(anxPts)
                    const posFill = `${posLine} L ${posPts[posPts.length - 1].x} ${H} L ${posPts[0].x} ${H} Z`
                    const anxFill = `${anxLine} L ${anxPts[anxPts.length - 1].x} ${H} L ${anxPts[0].x} ${H} Z`

                    // Hover indicator
                    const hi = hoveredIdx !== null ? hoveredIdx : -1
                    const hxPt = hi >= 0 ? posPts[hi] : null

                    return (
                      <>
                        <path d={anxFill} fill="url(#anx-fill)" />
                        <path d={anxLine} fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                        <path d={posFill} fill="url(#pos-fill)" />
                        <path d={posLine} fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" />
                        {hxPt && (
                          <line x1={hxPt.x} y1={PAD} x2={hxPt.x} y2={H - PAD} stroke="white" strokeWidth="0.5" strokeOpacity="0.3" strokeDasharray="2 2" />
                        )}
                      </>
                    )
                  })()}
                </svg>

                {/* Hover tooltip */}
                <AnimatePresence>
                  {hovered && (
                    <motion.div
                      key="tooltip"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none bg-surface-50 border border-surface-300 rounded-xl px-3 py-2 text-xs shadow-xl z-10 whitespace-nowrap"
                    >
                      <p className="font-semibold text-white mb-1">{fmtDate(hovered.date)}</p>
                      <div className="flex gap-3">
                        <span className="text-for-400">
                          <span className="font-bold">{hovered.positive_pct}%</span> positive
                        </span>
                        <span className="text-against-400">
                          <span className="font-bold">{hovered.anxious_pct}%</span> anxious
                        </span>
                        <span className="text-surface-400">
                          {hovered.total} responses
                        </span>
                      </div>
                      {hovered.total > 0 && (
                        <p className="text-surface-400 mt-0.5">
                          Dominant: {MOOD_CONFIG[hovered.dominant_mood].emoji} {MOOD_CONFIG[hovered.dominant_mood].label}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* X-axis labels */}
                {buckets.length > 0 && (
                  <div className="flex justify-between mt-1.5 text-[10px] text-surface-500 px-1">
                    <span>{fmtDate(buckets[0].date, true)}</span>
                    {buckets.length > 2 && (
                      <span>{fmtDate(buckets[Math.floor(buckets.length / 2)].date, true)}</span>
                    )}
                    <span>{fmtDate(buckets[buckets.length - 1].date, true)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Stacked distribution chart ──────────────────────────────── */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Daily Mood Composition</h2>
                  <p className="text-xs text-surface-400">Stacked bars — each colour represents a mood</p>
                </div>
              </div>
              <StackedBarChart buckets={buckets} height={100} />
              <div className="flex flex-wrap gap-2 mt-3">
                {sortedMoods.slice(0, 6).map(([mood, count]) => (
                  <span key={mood} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', MOOD_CONFIG[mood as MoodKind].bg, 'border-transparent', MOOD_CONFIG[mood as MoodKind].color)}>
                    {MOOD_CONFIG[mood as MoodKind].emoji}
                    <span className="capitalize">{mood}</span>
                    {overallTotal > 0 && (
                      <span className="opacity-60">
                        {Math.round((count / overallTotal) * 100)}%
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Per-mood breakdown ──────────────────────────────────────── */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Per-Mood Trend Lines</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {sortedMoods.map(([mood, total]) => {
                  const cfg = MOOD_CONFIG[mood as MoodKind]
                  const pct = overallTotal > 0 ? Math.round((total / overallTotal) * 100) : 0
                  return (
                    <div key={mood} className={cn('rounded-xl p-3 border', cfg.bg, 'border-transparent')}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">{cfg.emoji}</span>
                        <span className={cn('text-xs font-bold', cfg.color)}>{pct}%</span>
                      </div>
                      <p className={cn('text-xs font-semibold mb-2', cfg.color)}>{cfg.label}</p>
                      <LineChart
                        buckets={buckets}
                        series={mood as MoodKind}
                        color={cfg.chartColor}
                        fillColor={cfg.chartColor}
                        height={48}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Navigation strip ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { href: '/mood', label: 'Civic Mood', sub: 'Live snapshot', icon: '🌡️' },
                { href: '/mood/atlas', label: 'Mood Atlas', sub: 'By category', icon: '🗺️' },
                { href: '/mood/trending', label: 'Trending', sub: 'Rising moods', icon: '📈' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all"
                >
                  <span className="text-xl">{link.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{link.label}</p>
                    <p className="text-[10px] text-surface-400">{link.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
