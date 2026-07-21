'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Flame,
  MessageSquare,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  MomentumResponse,
  MomentumWindow,
  VelocityBar,
} from '@/app/api/exchange/[id]/momentum/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number): string {
  if (price >= 75) return 'text-gold'
  if (price >= 60) return 'text-for-300'
  if (price >= 55) return 'text-for-400'
  if (price <= 25) return 'text-against-300'
  if (price <= 40) return 'text-against-400'
  return 'text-surface-400'
}

function deltaColor(delta: number): string {
  if (delta > 2) return 'text-for-300'
  if (delta > 0.5) return 'text-for-400'
  if (delta < -2) return 'text-against-300'
  if (delta < -0.5) return 'text-against-400'
  return 'text-surface-400'
}

function deltaBg(delta: number): string {
  if (delta > 2) return 'bg-for-500/15 border-for-500/30'
  if (delta > 0.5) return 'bg-for-600/10 border-for-600/20'
  if (delta < -2) return 'bg-against-500/15 border-against-500/30'
  if (delta < -0.5) return 'bg-against-600/10 border-against-600/20'
  return 'bg-surface-300/20 border-surface-400/20'
}

function phaseColor(color: string): { bg: string; border: string; text: string } {
  switch (color) {
    case 'for':
      return { bg: 'bg-for-500/10', border: 'border-for-500/30', text: 'text-for-300' }
    case 'against':
      return { bg: 'bg-against-500/10', border: 'border-against-500/30', text: 'text-against-300' }
    case 'gold':
      return { bg: 'bg-gold/10', border: 'border-gold/30', text: 'text-gold' }
    default:
      return { bg: 'bg-surface-300/20', border: 'border-surface-400/30', text: 'text-surface-400' }
  }
}

function directionLabel(dir: 'accelerating' | 'decelerating' | 'stable'): string {
  if (dir === 'accelerating') return 'Accelerating'
  if (dir === 'decelerating') return 'Decelerating'
  return 'Stable'
}

// ─── Mini velocity bar chart ──────────────────────────────────────────────────

function VelocityChart({ series }: { series: VelocityBar[] }) {
  const maxAbs = useMemo(() => {
    const m = Math.max(...series.map((b) => Math.abs(b.velocity)), 1)
    return m
  }, [series])

  if (series.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-surface-500 text-sm">
        Not enough data yet
      </div>
    )
  }

  return (
    <div className="flex items-end gap-0.5 h-16" aria-label="Velocity bar chart">
      {series.slice(-28).map((bar, i) => {
        const heightPct = Math.abs(bar.velocity) / maxAbs
        const isUp = bar.velocity >= 0
        const barH = Math.max(heightPct * 100, 4)
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-center"
            title={`${bar.velocity > 0 ? '+' : ''}${bar.velocity}¢`}
          >
            {isUp ? (
              <div
                className="w-full rounded-t-[1px] bg-for-500/70"
                style={{ height: `${barH}%` }}
              />
            ) : (
              <div
                className="w-full rounded-b-[1px] bg-against-500/70 self-start mt-auto"
                style={{ height: `${barH}%` }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Price sparkline ──────────────────────────────────────────────────────────

function PriceSparkline({ series }: { series: VelocityBar[] }) {
  const prices = series.map((b) => b.price)
  const width = 320
  const height = 60

  const minP = useMemo(() => Math.max(0, Math.min(...prices) - 5), [prices])
  const maxP = useMemo(() => Math.min(100, Math.max(...prices) + 5), [prices])
  const range = maxP - minP || 10

  if (prices.length < 2) return null

  const toX = (i: number) => (i / (prices.length - 1)) * width
  const toY = (p: number) => height - ((p - minP) / range) * height

  const pathD = prices
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p).toFixed(1)}`)
    .join(' ')

  const areaD = pathD + ` L ${toX(prices.length - 1).toFixed(1)} ${height} L 0 ${height} Z`

  const lastPrice = prices[prices.length - 1]
  const firstPrice = prices[0]
  const isUp = lastPrice >= firstPrice
  const lineColor  = isUp ? '#3b82f6' : '#ef4444'
  const areaColor  = isUp ? 'rgba(59,130,246,0.08)' : 'rgba(239,68,68,0.08)'

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" aria-hidden="true">
      <path d={areaD} fill={areaColor} />
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current price dot */}
      <circle
        cx={toX(prices.length - 1).toFixed(1)}
        cy={toY(lastPrice).toFixed(1)}
        r="3"
        fill={lineColor}
      />
    </svg>
  )
}

// ─── Window card ──────────────────────────────────────────────────────────────

function WindowCard({ w }: { w: MomentumWindow }) {
  const DeltaIcon = w.direction === 'up' ? ArrowUp : w.direction === 'down' ? ArrowDown : Minus
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-1.5',
        deltaBg(w.delta),
      )}
    >
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">{w.label}</p>
      <div className="flex items-center gap-1.5">
        <DeltaIcon className={cn('h-4 w-4 flex-shrink-0', deltaColor(w.delta))} />
        <span className={cn('text-xl font-bold tabular-nums', deltaColor(w.delta))}>
          {w.delta > 0 ? '+' : ''}{w.delta}¢
        </span>
      </div>
      <p className="text-xs text-surface-500">
        {w.price_start}¢ → {w.price_end}¢
      </p>
      {w.pct_change !== 0 && (
        <p className={cn('text-[11px] font-mono', deltaColor(w.delta))}>
          {w.pct_change > 0 ? '+' : ''}{w.pct_change}%
        </p>
      )}
    </motion.div>
  )
}

// ─── Argument momentum bar ─────────────────────────────────────────────────────

function ArgMomentumBar({ am }: { am: MomentumResponse['argument_momentum'] }) {
  const total7d  = am.for_count_7d + am.against_count_7d
  const totalPrev = am.for_count_prev + am.against_count_prev

  const forPct7d    = total7d   > 0 ? Math.round((am.for_count_7d / total7d) * 100) : 50
  const forPctPrev  = totalPrev > 0 ? Math.round((am.for_count_prev / totalPrev) * 100) : 50

  const netLabel =
    am.net_momentum > 2  ? 'FOR gaining ground'
    : am.net_momentum < -2 ? 'AGAINST gaining ground'
    : 'Balanced'

  return (
    <div className="space-y-3">
      {/* Last 7d */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-surface-500">
          <span>Last 7 days</span>
          <span>{total7d} arguments</span>
        </div>
        <div className="h-2.5 rounded-full bg-surface-300/30 overflow-hidden flex">
          <div className="bg-for-500/70 h-full rounded-l-full" style={{ width: `${forPct7d}%` }} />
          <div className="bg-against-500/70 h-full rounded-r-full flex-1" />
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-for-400">{am.for_count_7d} FOR</span>
          <span className="text-against-400">{am.against_count_7d} AGAINST</span>
        </div>
      </div>

      {/* Prior 7d */}
      {totalPrev > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-surface-500">
            <span>Prior 7 days</span>
            <span>{totalPrev} arguments</span>
          </div>
          <div className="h-2.5 rounded-full bg-surface-300/30 overflow-hidden flex">
            <div className="bg-for-500/40 h-full rounded-l-full" style={{ width: `${forPctPrev}%` }} />
            <div className="bg-against-500/40 h-full rounded-r-full flex-1" />
          </div>
        </div>
      )}

      <div className={cn(
        'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full',
        am.net_momentum > 2 ? 'bg-for-500/10 text-for-300' :
        am.net_momentum < -2 ? 'bg-against-500/10 text-against-300' :
        'bg-surface-300/20 text-surface-500',
      )}>
        <Activity className="h-3 w-3" />
        {netLabel}
      </div>
    </div>
  )
}

// ─── Momentum gauge (SVG arc) ─────────────────────────────────────────────────

function MomentumGauge({ score }: { score: number }) {
  const radius = 52
  const circumference = Math.PI * radius        // semi-circle
  const filled = (score / 100) * circumference

  const color =
    score >= 70 ? '#3b82f6'
    : score >= 55 ? '#60a5fa'
    : score <= 30 ? '#ef4444'
    : score <= 45 ? '#f87171'
    : '#6b7280'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="68" viewBox="-10 -10 140 80" aria-hidden="true">
        {/* Track */}
        <path
          d={`M 0 60 A ${radius} ${radius} 0 0 1 ${radius * 2} 60`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={`M 0 60 A ${radius} ${radius} 0 0 1 ${radius * 2} 60`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute bottom-0 inset-x-0 flex flex-col items-center">
        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] text-surface-500 -mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MomentumClient() {
  const { id } = useParams<{ id: string }>()

  const [data, setData] = useState<MomentumResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(false)
      const res = await fetch(`/api/exchange/${id}/momentum`)
      if (!res.ok) throw new Error()
      const json = await res.json() as MomentumResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const topic = data?.topic
  const phaseColors = data ? phaseColor(data.phase.color) : phaseColor('neutral')

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-5 pb-28 space-y-4">
        {/* Back + refresh */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Market
          </Link>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-5 w-32 rounded-full" />
              <Skeleton className="h-6 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[0,1,2,3].map(i => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-7 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </>
        )}

        {/* Error state */}
        {!loading && error && (
          <EmptyState
            icon={Activity}
            title="Couldn't load momentum data"
            description="Check your connection and try refreshing."
            action={{ label: 'Retry', onClick: () => fetchData() }}
          />
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            {/* Market header */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={topic?.status as 'active' | 'proposed' | 'law' | 'failed' | 'voting'}>
                  {topic?.status?.charAt(0).toUpperCase()}{topic?.status?.slice(1)}
                </Badge>
                {topic?.category && (
                  <span className="text-[11px] text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                    {topic.category}
                  </span>
                )}
                <span className="text-[11px] text-surface-500 ml-auto flex items-center gap-1">
                  <Activity className="h-3 w-3" />
                  Momentum Analysis
                </span>
              </div>

              <h1 className="text-base font-semibold text-surface-800 leading-snug line-clamp-3">
                {topic?.statement}
              </h1>

              <div className="flex items-center gap-4 text-sm">
                <span className={cn('font-bold text-xl tabular-nums', priceColor(topic?.price ?? 50))}>
                  {topic?.price}¢
                </span>
                <span className="text-surface-500 text-xs">
                  {(topic?.volume ?? 0).toLocaleString()} votes
                </span>
              </div>

              {/* Sparkline */}
              {data.velocity_series.length >= 3 && (
                <div className="pt-1">
                  <PriceSparkline series={data.velocity_series} />
                </div>
              )}
            </motion.div>

            {/* Momentum score + phase */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-start gap-4">
                {/* Gauge */}
                <div className="flex flex-col items-center gap-1">
                  <MomentumGauge score={data.momentum_score} />
                  <span className="text-[10px] text-surface-500 text-center">Momentum Score</span>
                </div>

                {/* Labels */}
                <div className="flex-1 space-y-2 pt-1">
                  <h2 className={cn(
                    'text-base font-bold',
                    data.momentum_score >= 60 ? 'text-for-300'
                    : data.momentum_score <= 40 ? 'text-against-300'
                    : 'text-surface-700',
                  )}>
                    {data.momentum_label}
                  </h2>

                  <div className="flex flex-wrap gap-2">
                    <span className={cn(
                      'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border',
                      data.momentum_direction === 'accelerating' ? 'bg-for-500/10 border-for-500/25 text-for-300'
                      : data.momentum_direction === 'decelerating' ? 'bg-against-500/10 border-against-500/25 text-against-300'
                      : 'bg-surface-300/20 border-surface-400/20 text-surface-500',
                    )}>
                      {data.momentum_direction === 'accelerating' && <TrendingUp className="h-3 w-3" />}
                      {data.momentum_direction === 'decelerating' && <TrendingDown className="h-3 w-3" />}
                      {data.momentum_direction === 'stable' && <Minus className="h-3 w-3" />}
                      {directionLabel(data.momentum_direction)}
                    </span>

                    {data.category_avg_momentum !== null && (
                      <span className="text-[11px] text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                        Category avg: {data.category_avg_momentum}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-surface-500">
                    Acceleration: {data.acceleration > 0 ? '+' : ''}{data.acceleration} · {data.snapshot_count} snapshots
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Phase */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className={cn(
                'rounded-2xl border p-5 space-y-1.5',
                phaseColors.bg,
                phaseColors.border,
              )}
            >
              <div className="flex items-center gap-2">
                <Sparkles className={cn('h-4 w-4', phaseColors.text)} />
                <h3 className={cn('text-sm font-semibold', phaseColors.text)}>
                  {data.phase.label}
                </h3>
              </div>
              <p className="text-sm text-surface-600">{data.phase.description}</p>
            </motion.div>

            {/* Time-window cards */}
            <div>
              <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Price Change by Window
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {data.windows.map((w) => (
                  <WindowCard key={w.label} w={w} />
                ))}
              </div>
            </div>

            {/* Velocity chart */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-gold" />
                  Price Velocity (per snapshot)
                </h3>
                <span className="text-[11px] text-surface-500">Last 28 snapshots</span>
              </div>

              <div className="border-b border-surface-300/30" />

              <VelocityChart series={data.velocity_series} />

              <div className="flex gap-4 text-[11px] text-surface-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm bg-for-500/70" />
                  Upward
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm bg-against-500/70" />
                  Downward
                </span>
              </div>
            </motion.div>

            {/* Volume growth */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
            >
              <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-1.5">
                <Flame className="h-4 w-4 text-against-400" />
                Vote Volume Momentum
              </h3>

              <div className="flex items-center gap-4">
                <div className={cn(
                  'text-3xl font-bold tabular-nums',
                  data.volume_growth > 20 ? 'text-for-300'
                  : data.volume_growth > 0 ? 'text-for-400'
                  : data.volume_growth < -20 ? 'text-against-300'
                  : data.volume_growth < 0 ? 'text-against-400'
                  : 'text-surface-400',
                )}>
                  {data.volume_growth > 0 ? '+' : ''}{data.volume_growth}%
                </div>
                <div className="text-xs text-surface-500">
                  <p>Week-over-week vote activity growth</p>
                  <p className="text-[11px] mt-0.5">
                    {data.volume_growth > 20 ? 'Accelerating interest in this market'
                    : data.volume_growth > 0 ? 'Steady growth in participation'
                    : data.volume_growth < -20 ? 'Declining engagement — market may be cooling'
                    : data.volume_growth < 0 ? 'Slight slowdown in vote activity'
                    : 'Stable participation rate'}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Argument momentum */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4 text-surface-500" />
                Argument Flow
              </h3>
              <ArgMomentumBar am={data.argument_momentum} />
            </motion.div>

            {/* Category comparison */}
            {data.category_avg_momentum !== null && topic?.category && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
              >
                <h3 className="text-sm font-semibold text-surface-700 flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-surface-500" />
                  vs. {topic.category} Category
                </h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-surface-500">
                    <span>This market</span>
                    <span className={cn('font-mono font-bold', data.momentum_score >= 60 ? 'text-for-400' : data.momentum_score <= 40 ? 'text-against-400' : 'text-surface-400')}>
                      {data.momentum_score}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-for-500/70 transition-all"
                      style={{ width: `${data.momentum_score}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-surface-500">
                    <span>Category avg</span>
                    <span className="font-mono font-bold">{data.category_avg_momentum}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-surface-500/50 transition-all"
                      style={{ width: `${data.category_avg_momentum}%` }}
                    />
                  </div>
                </div>

                <p className="text-xs text-surface-500">
                  {data.momentum_score > data.category_avg_momentum + 10
                    ? 'This market is outperforming its category in momentum.'
                    : data.momentum_score < data.category_avg_momentum - 10
                    ? 'This market is lagging behind its category peers.'
                    : 'This market is tracking close to the category average.'}
                </p>
              </motion.div>
            )}

            {/* Navigation to other analysis pages */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 divide-y divide-surface-300/50">
              {[
                { href: `/exchange/${id}/signal`, icon: Zap, label: 'Multi-Factor Signal', desc: 'Composite signal across 7 market dimensions' },
                { href: `/exchange/${id}/depth`, icon: BarChart2, label: 'Market Depth', desc: 'Conviction and volume concentration analysis' },
                { href: `/exchange/${id}/chart`, icon: Activity, label: 'Price Chart', desc: 'Interactive price history with indicators' },
              ].map(({ href, icon: Icon, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-200/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-700">{label}</p>
                    <p className="text-xs text-surface-500 truncate">{desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
                </Link>
              ))}
            </div>

            {/* Back to market */}
            <Link
              href={`/exchange/${id}`}
              className="flex items-center justify-center gap-2 text-sm text-surface-500 hover:text-surface-700 transition-colors py-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to market
            </Link>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
