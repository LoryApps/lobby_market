'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  Download,
  Gavel,
  Globe,
  Maximize2,
  Minimize2,
  RefreshCw,
  Share2,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ChartResponse, ChartSnapshot } from '@/app/api/exchange/[id]/chart/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type TimeWindow = 'all' | '90d' | '30d' | '7d'

const WINDOWS: { id: TimeWindow; label: string }[] = [
  { id: 'all',  label: 'All' },
  { id: '90d',  label: '90D' },
  { id: '30d',  label: '30D' },
  { id: '7d',   label: '7D'  },
]

type MAKey = 'none' | 'ma5' | 'ma20'

const MA_OPTIONS: { id: MAKey; label: string; color: string }[] = [
  { id: 'none', label: 'None',  color: '' },
  { id: 'ma5',  label: '5-MA',  color: '#a78bfa' },
  { id: 'ma20', label: '20-MA', color: '#f59e0b' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function fmtPrice(p: number): string {
  return `${Math.round(p)}¢`
}

function fmtDate(iso: string, detail = false): string {
  const d = new Date(iso)
  if (detail) {
    return d.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
      year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function calcMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null
    const slice = prices.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function priceLineColor(isUp: boolean, status: string): string {
  if (status === 'law') return '#f59e0b'
  if (status === 'failed') return '#ef4444'
  return isUp ? '#22c55e' : '#ef4444'
}

function priceTextColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-300'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-500'
}

// ─── Chart ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  x: number
  y: number
  price: number
  volume: number
  recorded_at: string
  volBarH: number
}

function PriceChartSVG({
  ticks,
  status,
  maKey,
  fullHeight,
}: {
  ticks: ChartSnapshot[]
  status: string
  maKey: MAKey
  fullHeight: boolean
}) {
  const [hovered, setHovered] = useState<ChartPoint | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W  = 800
  const H  = fullHeight ? 340 : 220
  const VOL_H  = 50
  const PAD_Y  = 20
  const PAD_X  = 0
  const TOTAL_H = H + VOL_H + 8

  const prices = useMemo(() => ticks.map((t) => t.price), [ticks])
  const vols   = useMemo(() => ticks.map((t) => t.volume), [ticks])

  const { minP, maxP, ma } = useMemo(() => {
    if (prices.length === 0) return { minP: 0, maxP: 100, ma: [] as (number | null)[] }
    const period = maKey === 'ma5' ? 5 : 20
    return {
      minP: Math.max(0, Math.min(...prices) - 4),
      maxP: Math.min(100, Math.max(...prices) + 4),
      ma: maKey !== 'none' ? calcMA(prices, period) : [],
    }
  }, [prices, maKey])

  const points: ChartPoint[] = useMemo(() => {
    if (ticks.length === 0) return []
    const range = maxP - minP || 1
    const maxVol = Math.max(...vols, 1)
    return ticks.map((t, i) => {
      const xFrac = ticks.length > 1 ? i / (ticks.length - 1) : 0
      return {
        x: PAD_X + xFrac * (W - PAD_X * 2),
        y: PAD_Y + ((maxP - t.price) / range) * (H - PAD_Y * 2),
        price: t.price,
        volume: t.volume,
        recorded_at: t.recorded_at,
        volBarH: (t.volume / maxVol) * VOL_H,
      }
    })
  }, [ticks, minP, maxP, vols, H])

  const maPoints = useMemo(() => {
    if (maKey === 'none' || ma.length === 0 || points.length === 0) return []
    const range = maxP - minP || 1
    return ma.map((v, i) => {
      if (v === null) return null
      return {
        x: points[i].x,
        y: PAD_Y + ((maxP - v) / range) * (H - PAD_Y * 2),
        value: v,
      }
    })
  }, [ma, maKey, points, minP, maxP, H])

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  const areaPath = useMemo(() => {
    if (points.length < 2) return ''
    const first = points[0]
    const last = points[points.length - 1]
    return `M${first.x},${H} ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${last.x},${H} Z`
  }, [points, H])

  const maPolyline = useMemo(() => {
    const segs: string[] = []
    let seg: string[] = []
    for (const p of maPoints) {
      if (p === null) {
        if (seg.length > 1) segs.push(seg.join(' '))
        seg = []
      } else {
        seg.push(`${p.x},${p.y}`)
      }
    }
    if (seg.length > 1) segs.push(seg.join(' '))
    return segs
  }, [maPoints])

  const isUp = prices.length > 1 ? prices[prices.length - 1] >= prices[0] : true
  const lineColor = priceLineColor(isUp, status)
  const maColor = MA_OPTIONS.find((o) => o.id === maKey)?.color ?? '#a78bfa'

  const gridPcts = useMemo(() => {
    const range = maxP - minP || 1
    return [25, 50, 75].flatMap((pct) => {
      const y = PAD_Y + ((maxP - pct) / range) * (H - PAD_Y * 2)
      return y > 0 && y < H ? [{ pct, y }] : []
    })
  }, [minP, maxP, H])

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W
    let closest: ChartPoint | null = null
    let minDist = Infinity
    for (const p of points) {
      const d = Math.abs(p.x - mx)
      if (d < minDist) { minDist = d; closest = p }
    }
    setHovered(closest)
  }

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-surface-500 text-sm font-mono">
        Not enough price data yet — come back after more votes are cast.
      </div>
    )
  }

  const crosshairX = hovered ? hovered.x : null
  const crosshairY = hovered ? hovered.y : null

  return (
    <div className="relative select-none">
      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="tt"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-50 border border-surface-300 shadow-xl text-xs font-mono pointer-events-none whitespace-nowrap"
          >
            <span className={cn('font-bold text-base', priceTextColor(hovered.price, status))}>
              {fmtPrice(hovered.price)}
            </span>
            <span className="text-surface-400">·</span>
            <span className="text-surface-500">Vol {fmtVol(hovered.volume)}</span>
            <span className="text-surface-400">·</span>
            <span className="text-surface-500">{fmtDate(hovered.recorded_at, true)}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${TOTAL_H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ touchAction: 'none' }}
        aria-label="Market price history chart"
        role="img"
      >
        <defs>
          <linearGradient id="chart-area-up" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="chart-area-dn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="chart-area-law" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </linearGradient>
          <clipPath id="chart-clip">
            <rect x="0" y="0" width={W} height={H} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {gridPcts.map(({ pct, y }) => (
          <g key={pct}>
            <line
              x1={0} y1={y} x2={W} y2={y}
              stroke="rgba(148,163,184,0.12)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={W - 4} y={y - 3}
              textAnchor="end"
              fill="rgba(148,163,184,0.5)"
              fontSize={9}
              fontFamily="monospace"
            >
              {pct}¢
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#chart-area-${status === 'law' ? 'law' : isUp ? 'up' : 'dn'})`}
          clipPath="url(#chart-clip)"
        />

        {/* MA line */}
        {maKey !== 'none' && maPolyline.map((seg, i) => (
          <polyline
            key={i}
            points={seg}
            fill="none"
            stroke={maColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.85}
          />
        ))}

        {/* Price line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair */}
        {crosshairX !== null && crosshairY !== null && (
          <g>
            <line
              x1={crosshairX} y1={0} x2={crosshairX} y2={TOTAL_H}
              stroke="rgba(148,163,184,0.3)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line
              x1={0} y1={crosshairY} x2={W} y2={crosshairY}
              stroke="rgba(148,163,184,0.25)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={crosshairX} cy={crosshairY} r={4}
              fill={lineColor}
              stroke="rgba(15,23,42,0.9)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Volume bars */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - Math.max(1, (W / points.length) * 0.35)}
            y={H + 8 + (VOL_H - p.volBarH)}
            width={Math.max(1.5, (W / points.length) * 0.7)}
            height={p.volBarH}
            fill={hovered?.recorded_at === p.recorded_at
              ? lineColor
              : 'rgba(148,163,184,0.25)'}
            rx={1}
          />
        ))}

        {/* Vol label */}
        <text
          x={4} y={H + 12}
          fill="rgba(148,163,184,0.4)"
          fontSize={9}
          fontFamily="monospace"
        >
          VOL
        </text>
      </svg>
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 min-w-[60px]">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      <span className={cn('text-sm font-mono font-bold', valueClass ?? 'text-white')}>{value}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ChartStudioClient() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ChartResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [window, setWindow] = useState<TimeWindow>('all')
  const [maKey, setMaKey] = useState<MAKey>('none')
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (win: TimeWindow, refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/chart?window=${win}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as ChartResponse
      setData(json)
    } catch {
      setError('Could not load chart data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => {
    load(window)
  }, [load, window])

  function handleWindow(w: TimeWindow) {
    setWindow(w)
    load(w)
  }

  // CSV export
  function exportCSV() {
    if (!data) return
    const rows = ['Date,Price,Volume']
    for (const snap of data.history) {
      rows.push(`${snap.recorded_at},${snap.price},${snap.volume}`)
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lobby-market-${id}-${window}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(globalThis.location?.href ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* best-effort */ }
  }

  const topic = data?.topic
  const stats = data?.stats
  const history = data?.history ?? []

  const changePositive = (stats?.change ?? 0) > 0
  const changeNeutral = (stats?.change ?? 0) === 0

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    proposed: { label: 'Proposed',  cls: 'text-surface-500 bg-surface-300/40 border-surface-400/40' },
    active:   { label: 'Active',    cls: 'text-for-300 bg-for-900/40 border-for-700/40' },
    voting:   { label: 'Voting',    cls: 'text-purple bg-purple/10 border-purple/30' },
    law:      { label: 'LAW',       cls: 'text-gold bg-gold/10 border-gold/30' },
    failed:   { label: 'Failed',    cls: 'text-against-400 bg-against-900/30 border-against-700/30' },
  }
  const badge = topic ? (STATUS_BADGE[topic.status] ?? STATUS_BADGE.proposed) : null

  // X-axis date labels — evenly spaced
  const dateLabels = useMemo(() => {
    if (history.length < 2) return []
    const indices = [0, Math.floor(history.length / 3), Math.floor((2 * history.length) / 3), history.length - 1]
    return indices.map((i) => ({ idx: i, label: fmtDate(history[i].recorded_at) }))
  }, [history])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-5 pb-24 md:pb-12">

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-4">
          <Link href="/exchange" className="hover:text-white transition-colors">Exchange</Link>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          {topic ? (
            <Link href={`/exchange/${id}`} className="hover:text-white transition-colors truncate max-w-[180px]">
              {topic.statement.slice(0, 40)}{topic.statement.length > 40 ? '…' : ''}
            </Link>
          ) : (
            <Skeleton className="h-3 w-28" />
          )}
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <span className="text-white">Chart</span>
        </div>

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-5">
          <Link
            href={`/exchange/${id}`}
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Back to market"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            {topic ? (
              <>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {badge && (
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
                      badge.cls
                    )}>
                      {badge.label}
                    </span>
                  )}
                  {topic.category && (
                    <span className="text-xs font-mono text-surface-500">{topic.category}</span>
                  )}
                  {topic.scope && topic.scope !== 'Global' && (
                    <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
                      <Globe className="h-3 w-3" />
                      {topic.scope}
                    </div>
                  )}
                </div>
                <h1 className="text-base font-mono font-semibold text-white leading-snug line-clamp-2">
                  {topic.statement}
                </h1>
              </>
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-full" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyLink}
              title="Copy link"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              {copied ? 'Copied' : 'Share'}
            </button>
            <button
              onClick={exportCSV}
              disabled={!data || history.length === 0}
              title="Export CSV"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={() => load(window, true)}
              disabled={refreshing || loading}
              title="Refresh"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Stats row ── */}
        {loading ? (
          <div className="flex gap-2 mb-4 flex-wrap">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-16 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="flex gap-2 mb-4 flex-wrap">
            <StatPill
              label="Price"
              value={fmtPrice(stats.close)}
              valueClass={priceTextColor(stats.close, topic?.status ?? '')}
            />
            <StatPill
              label="Change"
              value={`${stats.change > 0 ? '+' : ''}${stats.change_pct.toFixed(1)}%`}
              valueClass={changeNeutral ? 'text-surface-400' : changePositive ? 'text-emerald' : 'text-against-400'}
            />
            <StatPill label="Open"  value={fmtPrice(stats.open)} />
            <StatPill label="High"  value={fmtPrice(stats.high)} valueClass="text-for-300" />
            <StatPill label="Low"   value={fmtPrice(stats.low)}  valueClass="text-against-400" />
            <StatPill label="Volume" value={fmtVol(stats.volume_total)} />
            <StatPill label="Ticks" value={stats.snapshots.toLocaleString()} />
          </div>
        ) : null}

        {/* ── Chart card ── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden mb-4">

          {/* Controls bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-300/50">
            <div className="flex items-center gap-1">
              {/* Window selector */}
              <div className="flex items-center rounded-lg border border-surface-300/60 bg-surface-200/50 p-0.5">
                {WINDOWS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleWindow(w.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors',
                      window === w.id
                        ? 'bg-for-600 text-white shadow-sm'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {/* MA selector */}
              <div className="flex items-center rounded-lg border border-surface-300/60 bg-surface-200/50 p-0.5 ml-1">
                {MA_OPTIONS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMaKey(m.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors',
                      maKey === m.id
                        ? 'bg-surface-400/60 text-white'
                        : 'text-surface-500 hover:text-white'
                    )}
                    title={m.id === 'none' ? 'No moving average' : `${m.id === 'ma5' ? '5' : '20'}-period moving average`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Expand / collapse */}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                title={expanded ? 'Collapse chart' : 'Expand chart'}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>

              {/* Trend indicator */}
              {stats && !changeNeutral && (
                <div className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold border',
                  changePositive
                    ? 'bg-emerald/10 border-emerald/30 text-emerald'
                    : 'bg-against-500/10 border-against-500/30 text-against-400'
                )}>
                  {changePositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {changePositive ? '+' : ''}{stats.change_pct.toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          {/* Chart area */}
          <div className="px-4 pt-4 pb-2">
            {loading ? (
              <Skeleton className={cn('w-full rounded-lg', expanded ? 'h-96' : 'h-52')} />
            ) : error ? (
              <EmptyState
                icon={BarChart2}
                title="Chart unavailable"
                description={error}
                actions={[{ label: 'Retry', onClick: () => load(window) }]}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <PriceChartSVG
                  ticks={history}
                  status={topic?.status ?? 'active'}
                  maKey={maKey}
                  fullHeight={expanded}
                />
              </motion.div>
            )}
          </div>

          {/* X-axis labels */}
          {!loading && dateLabels.length > 0 && (
            <div className="relative h-5 px-4 mb-2">
              {dateLabels.map(({ idx, label }) => {
                const pct = history.length > 1 ? (idx / (history.length - 1)) * 100 : 0
                return (
                  <span
                    key={idx}
                    className="absolute text-[9px] font-mono text-surface-500 -translate-x-1/2"
                    style={{ left: `calc(${pct}% + ${pct < 5 ? 16 : pct > 95 ? -16 : 0}px)` }}
                  >
                    {label}
                  </span>
                )
              })}
            </div>
          )}

          {/* MA legend */}
          {maKey !== 'none' && (
            <div className="flex items-center gap-2 px-4 pb-3 text-xs font-mono text-surface-500">
              <span
                className="inline-block h-1.5 w-6 rounded-full"
                style={{ backgroundColor: MA_OPTIONS.find((o) => o.id === maKey)?.color ?? '#a78bfa' }}
              />
              {maKey === 'ma5' ? '5-period' : '20-period'} moving average
            </div>
          )}
        </div>

        {/* ── Key levels ── */}
        {stats && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4"
          >
            {[
              {
                label: 'Period Open',
                value: fmtPrice(stats.open),
                sub: 'Starting price',
                icon: Clock,
                color: 'text-surface-500',
                iconBg: 'bg-surface-300/40',
              },
              {
                label: 'Period High',
                value: fmtPrice(stats.high),
                sub: 'Maximum consensus',
                icon: TrendingUp,
                color: 'text-for-400',
                iconBg: 'bg-for-500/10',
              },
              {
                label: 'Period Low',
                value: fmtPrice(stats.low),
                sub: 'Minimum consensus',
                icon: TrendingDown,
                color: 'text-against-400',
                iconBg: 'bg-against-500/10',
              },
              {
                label: 'Current Price',
                value: fmtPrice(stats.close),
                sub: 'Live consensus',
                icon: Zap,
                color: priceTextColor(stats.close, topic?.status ?? ''),
                iconBg: 'bg-surface-300/40',
              },
              {
                label: 'Total Volume',
                value: fmtVol(stats.volume_total),
                sub: 'Cumulative votes',
                icon: BarChart2,
                color: 'text-surface-400',
                iconBg: 'bg-surface-300/40',
              },
              {
                label: 'Price Snapshots',
                value: stats.snapshots.toLocaleString(),
                sub: 'Data points tracked',
                icon: BarChart2,
                color: 'text-purple',
                iconBg: 'bg-purple/10',
              },
            ].map(({ label, value, sub, icon: Icon, color, iconBg }) => (
              <div
                key={label}
                className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 flex items-start gap-3"
              >
                <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0', iconBg)}>
                  <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</p>
                  <p className={cn('text-lg font-mono font-bold', color)}>{value}</p>
                  <p className="text-[10px] font-mono text-surface-600">{sub}</p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Action links ── */}
        {topic && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            {[
              { href: `/exchange/${id}`,           label: 'Market',     icon: Gavel,    color: 'text-for-400' },
              { href: `/exchange/${id}/orderbook`, label: 'Order Book', icon: BarChart2, color: 'text-purple' },
              { href: `/exchange/${id}/activity`,  label: 'Activity',   icon: Zap,      color: 'text-gold' },
              { href: `/exchange/${id}/signal`,    label: 'Signals',    icon: TrendingUp, color: 'text-emerald' },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                <span className="text-xs font-mono text-surface-500 group-hover:text-white transition-colors">{label}</span>
              </Link>
            ))}
          </motion.div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
