'use client'

/**
 * /tide — The Civic Tide
 *
 * A 30-day macro view of platform-wide civic sentiment:
 *   • "Temperature" gauge — how contested vs. consensual the Lobby is right now
 *   • 30-day law-establishment timeline — when consensus was reached
 *   • Category sentiment breakdown — which domains are trending FOR or AGAINST
 *   • Platform health stats — active debates, contested races, mandate strength
 *
 * Distinct from:
 *   /rhythm      — temporal activity heatmap (hour-of-day patterns)
 *   /seismic     — anomaly detection for vote bursts
 *   /momentum    — per-topic momentum
 *   /shifts      — per-topic vote-split movement
 *   /correlations — cross-topic ideological alignment
 *   /timeline    — chronological event feed
 *
 * The Tide answers: "Is the Lobby more consensual or more contested today
 * than it was last month?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { TideResponse, TideDaypoint, TideCategoryRow } from '@/app/api/tide/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 5 * 60_000

const CATEGORY_COLORS: Record<string, { text: string; bar: string; bg: string; border: string }> = {
  Economics:   { text: 'text-emerald',   bar: 'bg-emerald',   bg: 'bg-emerald/10',   border: 'border-emerald/25' },
  Politics:    { text: 'text-gold',      bar: 'bg-gold',      bg: 'bg-gold/10',      border: 'border-gold/25' },
  Technology:  { text: 'text-for-300',   bar: 'bg-for-500',   bg: 'bg-for-500/10',   border: 'border-for-500/25' },
  Science:     { text: 'text-purple',    bar: 'bg-purple',    bg: 'bg-purple/10',    border: 'border-purple/25' },
  Law:         { text: 'text-gold',      bar: 'bg-gold',      bg: 'bg-gold/15',      border: 'border-gold/30' },
  Philosophy:  { text: 'text-purple',    bar: 'bg-purple',    bg: 'bg-purple/10',    border: 'border-purple/25' },
  Culture:     { text: 'text-against-300', bar: 'bg-against-500', bg: 'bg-against-500/10', border: 'border-against-500/25' },
  Health:      { text: 'text-emerald',   bar: 'bg-emerald',   bg: 'bg-emerald/10',   border: 'border-emerald/25' },
  Environment: { text: 'text-emerald',   bar: 'bg-emerald',   bg: 'bg-emerald/10',   border: 'border-emerald/25' },
  Education:   { text: 'text-for-300',   bar: 'bg-for-500',   bg: 'bg-for-500/10',   border: 'border-for-500/25' },
  Media:       { text: 'text-purple',    bar: 'bg-purple',    bg: 'bg-purple/10',    border: 'border-purple/25' },
  International: { text: 'text-gold',   bar: 'bg-gold',      bg: 'bg-gold/10',      border: 'border-gold/25' },
}
const DEFAULT_CAT_COLOR = { text: 'text-surface-400', bar: 'bg-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-300/40' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [, mm, dd] = iso.split('-')
  return `${parseInt(mm, 10)}/${parseInt(dd, 10)}`
}

function formatDateLong(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function temperatureLabel(t: number): string {
  if (t >= 90) return 'Deep consensus'
  if (t >= 75) return 'Strong consensus'
  if (t >= 65) return 'Moderate consensus'
  if (t >= 55) return 'Slight lean'
  return 'Contested'
}

function temperatureColor(t: number): string {
  if (t >= 75) return 'text-for-400'
  if (t >= 60) return 'text-emerald'
  if (t >= 55) return 'text-gold'
  return 'text-against-400'
}

// ─── Temperature Gauge ────────────────────────────────────────────────────────

function TemperatureGauge({ temperature, trend }: { temperature: number; trend: 'rising' | 'falling' | 'stable' }) {
  const color = temperatureColor(temperature)
  const label = temperatureLabel(temperature)

  // Arc parameters
  const R = 70
  const cx = 90
  const cy = 90
  const startAngle = -220
  const endAngle = 40
  const totalDeg = endAngle - startAngle
  const angleDeg = startAngle + (temperature / 100) * totalDeg
  const toRad = (d: number) => (d * Math.PI) / 180

  function arcPath(from: number, to: number, r: number) {
    const sx = cx + r * Math.cos(toRad(from))
    const sy = cy + r * Math.sin(toRad(from))
    const ex = cx + r * Math.cos(toRad(to))
    const ey = cy + r * Math.sin(toRad(to))
    const large = Math.abs(to - from) > 180 ? 1 : 0
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`
  }

  const needleX = cx + (R - 12) * Math.cos(toRad(angleDeg))
  const needleY = cy + (R - 12) * Math.sin(toRad(angleDeg))

  const TrendIcon = trend === 'rising' ? ArrowUp : trend === 'falling' ? ArrowDown : Minus
  const trendColor = trend === 'rising' ? 'text-for-400' : trend === 'falling' ? 'text-against-400' : 'text-surface-400'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="180" height="110" viewBox="0 0 180 110" aria-hidden>
        {/* Track arc */}
        <path
          d={arcPath(startAngle, endAngle, R)}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          className="text-surface-300/40"
        />
        {/* Filled arc */}
        <path
          d={arcPath(startAngle, angleDeg, R)}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          className={color}
        />
        {/* Needle dot */}
        <circle cx={needleX} cy={needleY} r="5" className={cn('fill-current', color)} />
        {/* Labels */}
        <text x="22" y="95" className="fill-surface-500 text-[8px]" fontSize="8" fontFamily="monospace">CONTESTED</text>
        <text x="130" y="95" className="fill-surface-500 text-[8px]" fontSize="8" fontFamily="monospace">CONSENSUS</text>
      </svg>

      <div className="text-center">
        <p className={cn('text-4xl font-black font-mono tabular-nums', color)}>
          {temperature}
        </p>
        <p className={cn('text-xs font-mono font-semibold mt-0.5', color)}>{label}</p>
        <div className={cn('flex items-center justify-center gap-1 mt-1', trendColor)}>
          <TrendIcon className="h-3 w-3" />
          <span className="text-[10px] font-mono capitalize">{trend} this month</span>
        </div>
      </div>
    </div>
  )
}

// ─── 30-Day Chart ─────────────────────────────────────────────────────────────

function TideChart({ days }: { days: TideDaypoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<TideDaypoint | null>(null)
  const [hoverX, setHoverX] = useState(0)

  const W = 640
  const H = 120
  const PAD_L = 8
  const PAD_R = 8
  const PAD_T = 10
  const PAD_B = 24
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  const maxLaws = Math.max(1, ...days.map((d) => d.laws))
  const maxTopics = Math.max(1, ...days.map((d) => d.topics_created))
  const n = days.length

  function xPos(i: number) {
    return PAD_L + (i / (n - 1)) * chartW
  }

  // Bar height for laws (primary, gold)
  function lawBarH(laws: number) {
    return (laws / maxLaws) * chartH * 0.7
  }

  // Topic creation sparkline
  const topicPoints = days
    .map((d, i) => {
      const x = xPos(i)
      const y = PAD_T + chartH - (d.topics_created / maxTopics) * chartH * 0.6
      return `${x},${y}`
    })
    .join(' ')

  const labelStep = Math.ceil(n / 6) // show ~6 labels
  const daysWithLaws = days.filter((d) => d.laws > 0)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.round(((relX - PAD_L) / chartW) * (n - 1))
    const clamped = Math.max(0, Math.min(n - 1, idx))
    setHover(days[clamped])
    setHoverX(xPos(clamped))
  }

  return (
    <div className="relative">
      {/* Hover tooltip */}
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 z-10 pointer-events-none"
            style={{ left: `${(hoverX / W) * 100}%`, transform: 'translateX(-50%)' }}
          >
            <div className="bg-surface-100 border border-surface-300/80 rounded-xl px-3 py-2 text-xs font-mono shadow-lg">
              <p className="text-surface-300 font-semibold">{formatDateLong(hover.date)}</p>
              {hover.laws > 0 && (
                <p className="text-gold mt-0.5">
                  <Gavel className="h-3 w-3 inline mr-1" />
                  {hover.laws} law{hover.laws !== 1 ? 's' : ''} · {hover.avg_blue_pct}% FOR
                </p>
              )}
              <p className="text-for-400 mt-0.5">
                <Sparkles className="h-3 w-3 inline mr-1" />
                {hover.topics_created} new topic{hover.topics_created !== 1 ? 's' : ''}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        aria-label="30-day civic activity chart"
      >
        {/* Zero line */}
        <line
          x1={PAD_L} y1={PAD_T + chartH}
          x2={W - PAD_R} y2={PAD_T + chartH}
          stroke="currentColor" strokeWidth="0.5"
          className="text-surface-400/40"
        />

        {/* Law bars (gold) */}
        {days.map((d, i) => {
          if (d.laws === 0) return null
          const bh = lawBarH(d.laws)
          const bx = xPos(i) - 3
          const by = PAD_T + chartH - bh
          return (
            <motion.rect
              key={d.date}
              x={bx} y={by} width={6} height={bh}
              rx={2}
              className="fill-gold/70"
              initial={{ height: 0, y: PAD_T + chartH }}
              animate={{ height: bh, y: by }}
              transition={{ duration: 0.5, delay: i * 0.01 }}
            />
          )
        })}

        {/* Topic creation sparkline (blue) */}
        {days.some((d) => d.topics_created > 0) && (
          <polyline
            points={topicPoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-for-400/50"
          />
        )}

        {/* Hover crosshair */}
        {hover && (
          <line
            x1={hoverX} y1={PAD_T}
            x2={hoverX} y2={PAD_T + chartH}
            stroke="currentColor" strokeWidth="1"
            strokeDasharray="3,2"
            className="text-surface-400/60"
          />
        )}

        {/* X axis labels */}
        {days.map((d, i) => {
          if (i % labelStep !== 0 && i !== n - 1) return null
          return (
            <text
              key={d.date}
              x={xPos(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize="8"
              fontFamily="monospace"
              className="fill-surface-600"
            >
              {formatDate(d.date)}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-gold/70" />
          <span className="text-[10px] font-mono text-surface-500">Laws established</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-5 bg-for-400/50 rounded-full" />
          <span className="text-[10px] font-mono text-surface-500">New topics</span>
        </div>
      </div>

      {/* Notable law days */}
      {daysWithLaws.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {daysWithLaws.slice(-8).map((d) => (
            <div
              key={d.date}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gold/10 border border-gold/20"
            >
              <Gavel className="h-2.5 w-2.5 text-gold" />
              <span className="text-[10px] font-mono text-gold">
                {formatDateLong(d.date)} · {d.laws}×
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryTideRow({ cat }: { cat: TideCategoryRow }) {
  const col = CATEGORY_COLORS[cat.category] ?? DEFAULT_CAT_COLOR
  const TrendIcon = cat.trend === 'rising' ? TrendingUp : cat.trend === 'falling' ? TrendingDown : Minus
  const trendColor = cat.trend === 'rising' ? 'text-for-400' : cat.trend === 'falling' ? 'text-against-400' : 'text-surface-500'
  const forPct = cat.avg_blue_pct
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4"
    >
      <div className="flex items-start gap-3">
        {/* Category name + trend */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn('text-sm font-mono font-bold', col.text)}>{cat.category}</span>
            <div className={cn('flex items-center gap-0.5', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span className="text-[10px] font-mono capitalize">{cat.trend}</span>
            </div>
          </div>

          {/* FOR/AGAINST bar */}
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-300/60 mb-2">
            <div className="h-full bg-for-500 rounded-l-full transition-all" style={{ width: `${forPct}%` }} />
            <div className="h-full bg-against-500 rounded-r-full transition-all" style={{ width: `${againstPct}%` }} />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-for-400">
              <ThumbsUp className="h-3 w-3" />
              <span className="text-[11px] font-mono">{forPct}% FOR</span>
            </div>
            <div className="flex items-center gap-1 text-against-400">
              <ThumbsDown className="h-3 w-3" />
              <span className="text-[11px] font-mono">{againstPct}% AGAINST</span>
            </div>
            {cat.law_count_30d > 0 && (
              <div className="flex items-center gap-1 text-gold">
                <Gavel className="h-3 w-3" />
                <span className="text-[11px] font-mono">{cat.law_count_30d} law{cat.law_count_30d !== 1 ? 's' : ''} this month</span>
              </div>
            )}
            {cat.contested_count > 0 && (
              <div className="flex items-center gap-1 text-surface-400">
                <Scale className="h-3 w-3" />
                <span className="text-[11px] font-mono">{cat.contested_count} contested</span>
              </div>
            )}
          </div>
        </div>

        {/* Active topics count */}
        <div className="text-right flex-shrink-0">
          <p className={cn('text-xl font-black font-mono tabular-nums', col.text)}>
            {cat.active_topics}
          </p>
          <p className="text-[10px] font-mono text-surface-600">active</p>
        </div>
      </div>

      {/* Category link */}
      <div className="mt-3 pt-3 border-t border-surface-300/40">
        <Link
          href={`/categories?cat=${encodeURIComponent(cat.category)}`}
          className="flex items-center justify-between group"
        >
          <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors">
            Browse {cat.category} topics
          </span>
          <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-white transition-colors" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  sub,
}: {
  icon: typeof Activity
  iconClass: string
  label: string
  value: number | string
  sub?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 flex gap-3 items-start">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-xl border flex-shrink-0', iconClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-black font-mono text-white tabular-nums leading-none">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        <p className="text-[11px] font-mono text-surface-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TidePage() {
  const [data, setData] = useState<TideResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/tide', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh
  useEffect(() => {
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const p = data?.platform

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-4 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-2.5 flex-1">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
                <Waves className="h-4.5 w-4.5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white leading-none">The Civic Tide</h1>
                <p className="text-[11px] font-mono text-surface-500 mt-0.5">30-day platform sentiment &amp; consensus trends</p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          <p className="text-sm text-surface-400 font-mono leading-relaxed">
            Macro view of how the Lobby&apos;s collective stance has shifted over the past 30 days —
            how many debates turned into law, which categories are trending, and whether civic
            consensus is rising or contested.
          </p>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────────── */}
        {error && (
          <div className="mb-6 rounded-2xl bg-against-500/10 border border-against-500/30 p-4 text-center">
            <p className="text-sm font-mono text-against-400 mb-2">{error}</p>
            <button onClick={load} className="text-xs font-mono text-against-400 hover:text-against-200 underline">
              Try again
            </button>
          </div>
        )}

        <div className="space-y-8">

          {/* ── Civic Temperature ─────────────────────────────────────────────────── */}
          <section>
            <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-6">
              <h2 className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider mb-6">
                Civic Temperature
              </h2>

              {loading ? (
                <div className="flex flex-col items-center gap-4">
                  <Skeleton className="h-28 w-44 rounded-2xl" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : p ? (
                <div className="flex flex-col items-center">
                  <TemperatureGauge
                    temperature={p.temperature}
                    trend={p.tide_direction}
                  />
                  <p className="text-[11px] font-mono text-surface-600 mt-4 text-center max-w-xs">
                    Based on {p.total_active.toLocaleString()} active debate{p.total_active !== 1 ? 's' : ''}.
                    {p.contested_topics > 0 && ` ${p.contested_topics} within 5% of 50/50.`}
                    {p.strong_mandate_topics > 0 && ` ${p.strong_mandate_topics} with strong majority.`}
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          {/* ── Platform Stats ───────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider mb-3">
              This Month
            </h2>

            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
                    <Skeleton className="h-7 w-12 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : p ? (
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Gavel}
                  iconClass="bg-gold/10 border-gold/30 text-gold"
                  label="Laws established"
                  value={p.total_laws_30d}
                  sub={p.total_laws_prev_30d > 0
                    ? `vs ${p.total_laws_prev_30d} prior month`
                    : undefined}
                />
                <StatCard
                  icon={Activity}
                  iconClass="bg-for-500/10 border-for-500/30 text-for-400"
                  label="Active debates"
                  value={p.total_active}
                  sub="live right now"
                />
                <StatCard
                  icon={ThumbsUp}
                  iconClass="bg-for-500/10 border-for-500/30 text-for-400"
                  label="Avg FOR sentiment"
                  value={`${p.avg_blue_pct_current}%`}
                  sub="across active topics"
                />
                <StatCard
                  icon={Scale}
                  iconClass="bg-against-500/10 border-against-500/30 text-against-400"
                  label="Contested debates"
                  value={p.contested_topics}
                  sub="within 5% of 50/50"
                />
              </div>
            ) : null}
          </section>

          {/* ── 30-Day Chart ─────────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider mb-3">
              30-Day Activity
            </h2>

            <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : data?.days.length ? (
                <TideChart days={data.days} />
              ) : (
                <p className="text-sm font-mono text-surface-500 text-center py-8">No activity data yet.</p>
              )}
            </div>
          </section>

          {/* ── Category Breakdown ───────────────────────────────────────────────── */}
          <section>
            <h2 className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider mb-3">
              Category Sentiment
            </h2>

            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
                    <Skeleton className="h-4 w-24 mb-3" />
                    <Skeleton className="h-2 w-full mb-2" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : (
              <AnimatePresence>
                <div className="space-y-3">
                  {(data?.categories ?? []).map((cat, i) => (
                    <motion.div
                      key={cat.category}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <CategoryTideRow cat={cat} />
                    </motion.div>
                  ))}
                  {!loading && (data?.categories ?? []).length === 0 && (
                    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-8 text-center">
                      <p className="text-sm font-mono text-surface-500">No active debates across categories yet.</p>
                    </div>
                  )}
                </div>
              </AnimatePresence>
            )}
          </section>

          {/* ── Related views ────────────────────────────────────────────────────── */}
          <section className="pt-4 border-t border-surface-300/40">
            <h2 className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider mb-3">
              Explore
            </h2>
            <div className="flex flex-wrap gap-2">
              {[
                { href: '/rhythm', icon: Activity, label: 'Civic Rhythm' },
                { href: '/seismic', icon: Zap, label: 'Civic Seismic' },
                { href: '/correlations', icon: BarChart2, label: 'Correlations' },
                { href: '/momentum', icon: TrendingUp, label: 'Momentum' },
                { href: '/forecast', icon: Flame, label: 'Forecast' },
                { href: '/shifts', icon: ChevronRight, label: 'Vote Shifts' },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-mono font-semibold transition-all"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>
          </section>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
