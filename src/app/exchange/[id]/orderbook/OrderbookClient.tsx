'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
  Activity,
  ChevronRight,
  Scale,
  ExternalLink,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { OrderbookData, PriceBand, RecentActivity } from '@/app/api/exchange/[id]/orderbook/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Depth Chart SVG ──────────────────────────────────────────────────────────

const CHART_W = 480
const CHART_H = 200
const PADDING = { top: 10, right: 16, bottom: 28, left: 48 }

function DepthChart({
  forDepth,
  againstDepth,
  currentPrice,
}: {
  forDepth: OrderbookData['forDepth']
  againstDepth: OrderbookData['againstDepth']
  currentPrice: number
}) {
  const maxVol = useMemo(() => {
    const allVols = [...forDepth.map(d => d.cumVol), ...againstDepth.map(d => d.cumVol)]
    return Math.max(...allVols, 1)
  }, [forDepth, againstDepth])

  const innerW = CHART_W - PADDING.left - PADDING.right
  const innerH = CHART_H - PADDING.top - PADDING.bottom

  function xScale(price: number) {
    return PADDING.left + (price / 100) * innerW
  }
  function yScale(vol: number) {
    return PADDING.top + innerH - (vol / maxVol) * innerH
  }

  // Build SVG path strings
  function pathFromPoints(pts: Array<{ price: number; cumVol: number }>): string {
    if (pts.length === 0) return ''
    const [first, ...rest] = pts
    let d = `M ${xScale(first.price).toFixed(1)} ${yScale(first.cumVol).toFixed(1)}`
    for (const pt of rest) {
      d += ` L ${xScale(pt.price).toFixed(1)} ${yScale(pt.cumVol).toFixed(1)}`
    }
    return d
  }

  function areaFromPoints(
    pts: Array<{ price: number; cumVol: number }>,
    _side: 'for' | 'against',
  ): string {
    if (pts.length === 0) return ''
    const baseline = PADDING.top + innerH
    const [first, ...rest] = pts
    let d = `M ${xScale(first.price).toFixed(1)} ${baseline}`
    d += ` L ${xScale(first.price).toFixed(1)} ${yScale(first.cumVol).toFixed(1)}`
    for (const pt of rest) {
      d += ` L ${xScale(pt.price).toFixed(1)} ${yScale(pt.cumVol).toFixed(1)}`
    }
    const lastPt = pts[pts.length - 1]
    d += ` L ${xScale(lastPt.price).toFixed(1)} ${baseline} Z`
    return d
  }

  const priceX = xScale(currentPrice)
  const gridLines = [0, 25, 50, 75, 100]
  const volTicks = [0, Math.round(maxVol / 2), maxVol]

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full"
      aria-label="Market depth chart showing cumulative vote volume at each consensus level"
    >
      <defs>
        <linearGradient id="forGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="againstGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map(p => (
        <line
          key={p}
          x1={xScale(p)}
          y1={PADDING.top}
          x2={xScale(p)}
          y2={PADDING.top + innerH}
          stroke="#374151"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ))}

      {/* X axis labels */}
      {gridLines.map(p => (
        <text
          key={p}
          x={xScale(p)}
          y={CHART_H - 4}
          fill="#6b7280"
          fontSize={9}
          textAnchor="middle"
          fontFamily="monospace"
        >
          {p}%
        </text>
      ))}

      {/* Y axis labels */}
      {volTicks.map(v => (
        <text
          key={v}
          x={PADDING.left - 4}
          y={yScale(v) + 3}
          fill="#6b7280"
          fontSize={8}
          textAnchor="end"
          fontFamily="monospace"
        >
          {formatVol(v)}
        </text>
      ))}

      {/* AGAINST depth area (left/red side) */}
      <path d={areaFromPoints(againstDepth, 'against')} fill="url(#againstGrad)" />
      <path d={pathFromPoints(againstDepth)} stroke="#ef4444" strokeWidth={1.5} fill="none" />

      {/* FOR depth area (right/blue side) */}
      <path d={areaFromPoints(forDepth, 'for')} fill="url(#forGrad)" />
      <path d={pathFromPoints(forDepth)} stroke="#3b82f6" strokeWidth={1.5} fill="none" />

      {/* Current price vertical line */}
      <line
        x1={priceX}
        y1={PADDING.top}
        x2={priceX}
        y2={PADDING.top + innerH}
        stroke="#a78bfa"
        strokeWidth={1.5}
      />
      <rect
        x={priceX - 20}
        y={PADDING.top - 2}
        width={40}
        height={14}
        rx={3}
        fill="#a78bfa"
      />
      <text
        x={priceX}
        y={PADDING.top + 9}
        fill="#fff"
        fontSize={8}
        textAnchor="middle"
        fontFamily="monospace"
        fontWeight="bold"
      >
        {currentPrice}%
      </text>
    </svg>
  )
}

// ─── Price Band Row ───────────────────────────────────────────────────────────

function BandRow({
  band,
  maxVol,
  currentPrice,
}: {
  band: PriceBand
  maxVol: number
  currentPrice: number
}) {
  const isActive = currentPrice >= band.lo && currentPrice < band.hi
  const pct = maxVol > 0 ? (band.volume / maxVol) * 100 : 0
  const isFor = band.lo >= 50

  return (
    <div
      className={cn(
        'grid grid-cols-[72px_1fr_80px] items-center gap-2 px-3 py-1 text-xs font-mono',
        isActive ? 'bg-purple/10 border border-purple/30 rounded-lg' : 'border border-transparent',
      )}
    >
      <span className={cn('text-right', isFor ? 'text-for-400' : 'text-against-400')}>
        {band.lo}–{band.hi}%
      </span>
      <div className="relative h-3 rounded-sm overflow-hidden bg-surface-300">
        <div
          className={cn('absolute left-0 top-0 h-full rounded-sm transition-all', isFor ? 'bg-for-500/70' : 'bg-against-500/70')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-right', isActive ? 'text-purple font-bold' : 'text-surface-500')}>
        {formatVol(band.volume)}
      </span>
    </div>
  )
}

// ─── Activity Row ─────────────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: RecentActivity }) {
  const Icon =
    entry.direction === 'up' ? TrendingUp
    : entry.direction === 'down' ? TrendingDown
    : Minus

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-surface-300/40 last:border-0 text-xs font-mono">
      <Icon
        className={cn(
          'h-3.5 w-3.5 flex-shrink-0',
          entry.direction === 'up' ? 'text-for-400' : entry.direction === 'down' ? 'text-against-400' : 'text-surface-500',
        )}
        aria-hidden="true"
      />
      <span className={cn('w-10 text-right font-bold', entry.price >= 50 ? 'text-for-400' : 'text-against-400')}>
        {entry.price}%
      </span>
      <span className="flex-1 text-surface-500">
        {entry.delta > 0 ? `+${formatVol(entry.delta)}` : formatVol(entry.delta)} votes
      </span>
      <span className="text-surface-600">{relTime(entry.recorded_at)}</span>
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function OrderbookClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<OrderbookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'depth' | 'bands' | 'activity'>('depth')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/exchange/${topicId}/orderbook`)
      if (!res.ok) throw new Error('Failed to load')
      const json: OrderbookData = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('Could not load order book data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => load(true), 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [load])

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-[220px] w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <EmptyState
            icon={BarChart2}
            title="Order book unavailable"
            description={error ?? 'No data found for this market.'}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, priceBands, forDepth, againstDepth, recentActivity, pressure, maxBandVolume } = data

  const statusColor: Record<string, string> = {
    active: 'text-for-400',
    voting: 'text-purple',
    law: 'text-gold',
    proposed: 'text-surface-500',
    failed: 'text-against-400',
  }

  const pressureLabel =
    pressure.buyPressure >= 65 ? 'Strong FOR pressure'
    : pressure.buyPressure >= 55 ? 'Moderate FOR pressure'
    : pressure.buyPressure <= 35 ? 'Strong AGAINST pressure'
    : pressure.buyPressure <= 45 ? 'Moderate AGAINST pressure'
    : 'Balanced'

  const pressureColor =
    pressure.buyPressure >= 55 ? 'text-for-400'
    : pressure.buyPressure <= 45 ? 'text-against-400'
    : 'text-surface-500'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to market detail"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span className="text-xs font-mono text-surface-500">
            <Link href="/exchange" className="hover:text-surface-400">Exchange</Link>
            {' / '}
            <Link href={`/exchange/${topicId}`} className="hover:text-surface-400">Market</Link>
            {' / '}
            <span className="text-white">Order Book</span>
          </span>
        </div>

        {/* ── Topic title ────────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="font-mono text-sm font-semibold text-white leading-snug flex-1">
              {topic.statement}
            </h1>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
              aria-label="Refresh order book"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <Badge variant="outline" size="sm" className="text-surface-500">
                {topic.category}
              </Badge>
            )}
            <span className={cn('text-xs font-mono font-semibold uppercase', statusColor[topic.status] ?? 'text-surface-500')}>
              {topic.status}
            </span>
            <Link
              href={`/topic/${topicId}`}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors ml-auto"
            >
              View debate <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* ── Key stats ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Current Price', value: `${topic.price}%`, color: topic.price >= 50 ? 'text-for-400' : 'text-against-400' },
            { label: 'Total Volume', value: formatVol(topic.volume), color: 'text-white' },
            { label: '24h Volume', value: formatVol(pressure.volume24h), color: 'text-surface-400' },
            { label: 'Pressure', value: pressureLabel.split(' ')[0], color: pressureColor },
          ].map(stat => (
            <div key={stat.label} className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-3">
              <p className="text-[10px] font-mono text-surface-500 mb-1">{stat.label}</p>
              <p className={cn('text-sm font-mono font-bold', stat.color)}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── 24h range ──────────────────────────────────────────────────── */}
        {(pressure.high24h !== null || pressure.low24h !== null) && (
          <div className="bg-surface-200/40 border border-surface-300/40 rounded-xl p-3 mb-5">
            <p className="text-[10px] font-mono text-surface-500 mb-2 uppercase tracking-wider">24h Range</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-against-400">{pressure.low24h ?? '—'}%</span>
              <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden relative">
                <div
                  className="absolute h-full bg-gradient-to-r from-against-500 to-for-500 rounded-full"
                  style={{
                    left: `${pressure.low24h ?? 0}%`,
                    right: `${100 - (pressure.high24h ?? 100)}%`,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-1.5 bg-purple rounded-full"
                  style={{ left: `${topic.price}%` }}
                />
              </div>
              <span className="text-xs font-mono text-for-400">{pressure.high24h ?? '—'}%</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
              <span>Low</span>
              <span>Avg {pressure.avgPrice24h ?? '—'}%</span>
              <span>High</span>
            </div>
          </div>
        )}

        {/* ── Pressure bar ───────────────────────────────────────────────── */}
        <div className="bg-surface-200/40 border border-surface-300/40 rounded-xl p-3 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Buying Pressure</span>
            <span className={cn('text-xs font-mono font-bold', pressureColor)}>{pressureLabel}</span>
          </div>
          <div className="h-2 bg-against-500/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all duration-700"
              style={{ width: `${pressure.buyPressure}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
            <span>AGAINST</span>
            <span>{pressure.buyPressure}% FOR momentum</span>
            <span>FOR</span>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-4 bg-surface-200/40 rounded-xl p-1 border border-surface-300/40">
          {[
            { id: 'depth' as const, label: 'Depth Chart', icon: BarChart2 },
            { id: 'bands' as const, label: 'Price Bands', icon: Scale },
            { id: 'activity' as const, label: 'Activity', icon: Activity },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === id
                  ? 'bg-surface-300 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-400',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab panels ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tab === 'depth' && (
            <motion.div
              key="depth"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="bg-surface-200/40 border border-surface-300/40 rounded-xl p-4"
            >
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                Cumulative Vote Depth — {formatVol(topic.volume)} total votes
              </p>
              {forDepth.length === 0 && againstDepth.length === 0 ? (
                <EmptyState icon={BarChart2} title="No price history yet" description="Depth data builds as votes are cast." />
              ) : (
                <>
                  <DepthChart
                    forDepth={forDepth}
                    againstDepth={againstDepth}
                    currentPrice={topic.price}
                  />
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-for-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-for-500/50" />
                      FOR liquidity
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-against-400">
                      <span className="inline-block h-2 w-4 rounded-sm bg-against-500/50" />
                      AGAINST liquidity
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-purple">
                      <span className="inline-block h-2 w-0.5 rounded-sm bg-purple" />
                      Current price
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {tab === 'bands' && (
            <motion.div
              key="bands"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="bg-surface-200/40 border border-surface-300/40 rounded-xl overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-surface-300/40">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                  Volume by Price Band
                </p>
              </div>
              <div className="divide-y divide-surface-300/20">
                {[...priceBands].reverse().map(band => (
                  <BandRow
                    key={`${band.lo}-${band.hi}`}
                    band={band}
                    maxVol={maxBandVolume}
                    currentPrice={topic.price}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {tab === 'activity' && (
            <motion.div
              key="activity"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="bg-surface-200/40 border border-surface-300/40 rounded-xl overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-surface-300/40">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                  Recent Price Activity
                </p>
              </div>
              {recentActivity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="Vote history will appear here as consensus builds."
                />
              ) : (
                <div className="divide-y divide-surface-300/20">
                  {recentActivity.map((entry, i) => (
                    <ActivityRow key={`${entry.recorded_at}-${i}`} entry={entry} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer actions ──────────────────────────────────────────────── */}
        <div className="mt-5 flex items-center gap-3">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Market detail
          </Link>
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors ml-auto"
          >
            Vote on this topic
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
