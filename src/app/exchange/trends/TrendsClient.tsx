'use client'

/**
 * /exchange/trends — Historical Price Trend Analysis
 *
 * Shows the shape of price movement for every active civic market over time.
 * Unlike /exchange/movers (which shows a single 24h delta), this page shows
 * the full trend trajectory — breakouts, reversals, steady climbers/decliners,
 * and consolidating markets — via multi-point sparklines.
 *
 * Pattern classification:
 *   breakout     — price crossed ≥10 pts in the last 4 ticks (fast move up)
 *   breakdown    — price dropped ≥10 pts in the last 4 ticks (fast move down)
 *   rising       — consistent upward trend over full history
 *   falling      — consistent downward trend over full history
 *   consolidating — tight range, low volatility
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  Layers,
  Minus,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Market } from '@/app/api/exchange/route'
import type { PriceTick, TrendsResponse } from '@/app/api/exchange/trends/route'

// ─── Trend pattern classification ─────────────────────────────────────────────

type TrendPattern = 'breakout' | 'breakdown' | 'rising' | 'falling' | 'consolidating'

interface TrendedMarket {
  market: Market
  ticks: PriceTick[]
  pattern: TrendPattern
  velocity: number     // pts / tick (positive = up, negative = down)
  volatility: number   // std dev of prices
  change: number       // total change first→last (¢)
  changePct: number    // % change from first price
  latest: number       // current price
}

function classifyTrend(ticks: PriceTick[]): {
  pattern: TrendPattern
  velocity: number
  volatility: number
  change: number
  changePct: number
} {
  if (ticks.length < 2) {
    return { pattern: 'consolidating', velocity: 0, volatility: 0, change: 0, changePct: 0 }
  }

  const prices = ticks.map((t) => t.price)
  const first = prices[0]
  const last = prices[prices.length - 1]
  const change = Math.round((last - first) * 10) / 10
  const changePct = first === 0 ? 0 : Math.round((change / first) * 1000) / 10

  // Volatility = standard deviation
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length
  const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length
  const volatility = Math.round(Math.sqrt(variance) * 10) / 10

  // Velocity = avg change per tick
  const velocity = Math.round((change / (ticks.length - 1)) * 10) / 10

  // Short-window check (last 4 ticks) for breakout/breakdown
  const recent = prices.slice(-4)
  const recentChange = recent.length > 1 ? recent[recent.length - 1] - recent[0] : 0

  let pattern: TrendPattern
  if (recentChange >= 10) {
    pattern = 'breakout'
  } else if (recentChange <= -10) {
    pattern = 'breakdown'
  } else if (change >= 4) {
    pattern = 'rising'
  } else if (change <= -4) {
    pattern = 'falling'
  } else {
    pattern = 'consolidating'
  }

  return { pattern, velocity, volatility, change, changePct }
}

// ─── Sparkline (full-width version for trend cards) ──────────────────────────

function TrendSparkline({
  ticks,
  pattern,
  width = 120,
  height = 40,
}: {
  ticks: PriceTick[]
  pattern: TrendPattern
  width?: number
  height?: number
}) {
  const { points, gradientId } = useMemo(() => {
    if (ticks.length < 2) return { points: null, gradientId: '' }
    const prices = ticks.map((t) => t.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1
    const step = width / (prices.length - 1)
    const pts = prices
      .map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / range) * height).toFixed(1)}`)
      .join(' ')
    return { points: pts, gradientId: `grad-${Math.random().toString(36).slice(2, 7)}` }
  }, [ticks, width, height])

  if (!points) return <div className="w-full h-10 flex items-center justify-center text-surface-600 text-xs">No history</div>

  const strokeColor: Record<TrendPattern, string> = {
    breakout:     '#22c55e',
    rising:       '#60a5fa',
    falling:      '#f87171',
    breakdown:    '#ef4444',
    consolidating:'#6b7280',
  }

  const color = strokeColor[pattern]

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
      {/* End dot */}
      {(() => {
        const lastPt = points.split(' ').pop()!.split(',')
        return (
          <circle
            cx={parseFloat(lastPt[0])}
            cy={parseFloat(lastPt[1])}
            r="3"
            fill={color}
            opacity="0.95"
          />
        )
      })()}
    </svg>
  )
}

// ─── Pattern config ───────────────────────────────────────────────────────────

const PATTERN_CONFIG: Record<TrendPattern, {
  label: string
  icon: typeof TrendingUp
  color: string
  bg: string
  border: string
  badge: string
  description: string
}> = {
  breakout: {
    label: 'Breakout',
    icon: Zap,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badge: 'bg-emerald/20 text-emerald border-emerald/30',
    description: 'Surging fast in recent ticks',
  },
  breakdown: {
    label: 'Breakdown',
    icon: ArrowDownRight,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    badge: 'bg-against-500/20 text-against-300 border-against-400/30',
    description: 'Sharp decline in recent ticks',
  },
  rising: {
    label: 'Rising',
    icon: TrendingUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-300 border-for-400/30',
    description: 'Consistent upward trend',
  },
  falling: {
    label: 'Falling',
    icon: TrendingDown,
    color: 'text-against-300',
    bg: 'bg-against-500/5',
    border: 'border-against-500/20',
    badge: 'bg-against-500/15 text-against-300 border-against-400/20',
    description: 'Consistent downward drift',
  },
  consolidating: {
    label: 'Consolidating',
    icon: Minus,
    color: 'text-surface-500',
    bg: 'bg-surface-200/30',
    border: 'border-surface-400/20',
    badge: 'bg-surface-300/30 text-surface-500 border-surface-400/20',
    description: 'Tight range, low volatility',
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatChange(change: number): string {
  const sign = change > 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}¢`
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: 'all' as const,           label: 'All',          icon: Activity },
  { id: 'breakout' as const,      label: 'Breakouts',    icon: Zap },
  { id: 'breakdown' as const,     label: 'Breakdowns',   icon: ArrowDownRight },
  { id: 'rising' as const,        label: 'Rising',       icon: TrendingUp },
  { id: 'falling' as const,       label: 'Falling',      icon: TrendingDown },
  { id: 'consolidating' as const, label: 'Consolidating',icon: Minus },
]

type FilterId = 'all' | TrendPattern

// ─── Trend market card ────────────────────────────────────────────────────────

function TrendCard({ item }: { item: TrendedMarket }) {
  const cfg = PATTERN_CONFIG[item.pattern]
  const PatternIcon = cfg.icon
  const catColor = item.market.category ? (CATEGORY_COLOR[item.market.category] ?? 'text-surface-500') : 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/exchange/${item.market.id}`}
        className={cn(
          'block rounded-xl border bg-surface-100/60 hover:bg-surface-100 transition-colors p-4 group',
          cfg.border
        )}
      >
        {/* Top row: pattern badge + category + price */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium', cfg.badge)}>
              <PatternIcon className="w-3 h-3" />
              {cfg.label}
            </span>
            {item.market.category && (
              <span className={cn('text-xs font-medium', catColor)}>
                {item.market.category}
              </span>
            )}
            {item.market.is_hot && (
              <span className="inline-flex items-center gap-0.5 text-xs text-gold">
                <Flame className="w-3 h-3" />Hot
              </span>
            )}
            {item.market.is_near_law && (
              <span className="inline-flex items-center gap-0.5 text-xs text-gold">
                <Gavel className="w-3 h-3" />Near Law
              </span>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className={cn('text-lg font-bold tabular-nums', priceColor(item.latest, item.market.status))}>
              {item.latest}¢
            </div>
            <div className={cn('text-xs font-medium tabular-nums', item.change >= 0 ? 'text-emerald' : 'text-against-400')}>
              {formatChange(item.change)}
            </div>
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm text-surface-900 leading-snug line-clamp-2 mb-3 group-hover:text-white transition-colors">
          {item.market.statement}
        </p>

        {/* Sparkline */}
        <div className="mb-3">
          <TrendSparkline ticks={item.ticks} pattern={item.pattern} />
        </div>

        {/* Metrics row */}
        <div className="flex items-center justify-between text-xs text-surface-600">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3 h-3" />
              {formatVolume(item.market.volume)}
            </span>
            <span className={cn('flex items-center gap-1', cfg.color)}>
              <Activity className="w-3 h-3" />
              {item.velocity > 0 ? '+' : ''}{item.velocity}¢/step
            </span>
            <span className="flex items-center gap-1">
              <Scale className="w-3 h-3" />
              σ{item.volatility}
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TrendSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/30 bg-surface-100/40 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-7 w-12" />
      </div>
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-3/4 mb-3" />
      <Skeleton className="h-10 w-full mb-3" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-8" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const BATCH_SIZE = 40

export function TrendsClient() {
  const [markets, setMarkets] = useState<TrendedMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [sortBy, setSortBy] = useState<'velocity' | 'volume' | 'volatility'>('velocity')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch active markets
      const res = await fetch('/api/exchange?sort=volume&status=live&limit=80', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch markets')
      const data = await res.json()
      const activeMarkets: Market[] = data.markets ?? []

      if (activeMarkets.length === 0) {
        setMarkets([])
        return
      }

      // 2. Fetch price history in batches to stay under URL length
      const allTrends: TrendsResponse = {}
      for (let i = 0; i < activeMarkets.length; i += BATCH_SIZE) {
        const batch = activeMarkets.slice(i, i + BATCH_SIZE)
        const ids = batch.map((m) => m.id).join(',')
        const tRes = await fetch(`/api/exchange/trends?ids=${encodeURIComponent(ids)}&limit=24`, {
          cache: 'no-store',
        })
        if (tRes.ok) {
          const tData: TrendsResponse = await tRes.json()
          Object.assign(allTrends, tData)
        }
      }

      // 3. Classify each market
      const classified: TrendedMarket[] = activeMarkets
        .map((market) => {
          const ticks = allTrends[market.id] ?? []
          const metrics = classifyTrend(ticks)
          return {
            market,
            ticks,
            ...metrics,
            latest: market.price,
          }
        })
        // Require at least 3 history points to show on trends page
        .filter((m) => m.ticks.length >= 3)

      setMarkets(classified)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filter + sort
  const displayed = useMemo(() => {
    let items = filter === 'all' ? markets : markets.filter((m) => m.pattern === filter)
    items = [...items].sort((a, b) => {
      if (sortBy === 'velocity') return Math.abs(b.velocity) - Math.abs(a.velocity)
      if (sortBy === 'volume') return b.market.volume - a.market.volume
      return b.volatility - a.volatility
    })
    return items
  }, [markets, filter, sortBy])

  // Pattern counts
  const counts = useMemo(() => {
    const c: Partial<Record<FilterId, number>> = { all: markets.length }
    for (const m of markets) {
      c[m.pattern] = (c[m.pattern] ?? 0) + 1
    }
    return c
  }, [markets])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="flex items-center gap-1 text-sm text-surface-600 hover:text-surface-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Exchange
          </Link>
          <span className="text-surface-500">/</span>
          <span className="text-sm text-surface-900 font-medium">Market Trends</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-for-400" />
              Market Trends
            </h1>
            <p className="text-sm text-surface-600 mt-1">
              Price trajectory analysis — spot breakouts, reversals, and consolidations
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-surface-600 hover:text-surface-900 transition-colors disabled:opacity-50 mt-1"
            aria-label="Refresh trends"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span className="hidden sm:inline">
              {lastUpdated
                ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Refresh'}
            </span>
          </button>
        </div>

        {/* Pattern summary chips */}
        {!loading && markets.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
            {(['breakout', 'rising', 'consolidating', 'falling', 'breakdown'] as TrendPattern[]).map((p) => {
              const cfg = PATTERN_CONFIG[p]
              const Icon = cfg.icon
              const count = counts[p] ?? 0
              return (
                <button
                  key={p}
                  onClick={() => setFilter(filter === p ? 'all' : p)}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg border text-xs transition-all',
                    filter === p
                      ? `${cfg.bg} ${cfg.border} ${cfg.color} font-semibold`
                      : 'bg-surface-100/40 border-surface-300/30 text-surface-600 hover:bg-surface-100/70'
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <div className="text-left">
                    <div className="font-medium">{cfg.label}</div>
                    <div className="opacity-70">{count} markets</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Filter + Sort bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 flex-1 min-w-0">
            {FILTER_TABS.map((tab) => {
              const Icon = tab.icon
              const count = counts[tab.id] ?? 0
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border',
                    filter === tab.id
                      ? 'bg-for-500/20 border-for-500/40 text-for-300'
                      : 'bg-surface-100/40 border-surface-300/20 text-surface-600 hover:bg-surface-100/60'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {tab.label}
                  {count > 0 && (
                    <span className="opacity-60 text-[10px]">({count})</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-surface-600 mr-1">Sort:</span>
            {(['velocity', 'volume', 'volatility'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize',
                  sortBy === s
                    ? 'bg-surface-200/60 border-surface-400/40 text-surface-900'
                    : 'bg-surface-100/30 border-surface-300/20 text-surface-600 hover:bg-surface-100/50'
                )}
              >
                {s === 'velocity' ? 'Speed' : s === 'volume' ? 'Volume' : 'Volatility'}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3 text-sm text-against-300 mb-5">
            {error} —{' '}
            <button onClick={load} className="underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <TrendSkeleton key={i} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={filter === 'all' ? 'No trend data yet' : `No ${PATTERN_CONFIG[filter as TrendPattern]?.label ?? filter} markets`}
            description={
              filter === 'all'
                ? 'Price history builds up over time. Check back once markets have been active for a few snapshots.'
                : 'Switch to a different filter to see more markets.'
            }
            action={
              filter !== 'all'
                ? { label: 'Show all markets', onClick: () => setFilter('all') }
                : undefined
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid gap-3 sm:grid-cols-2">
              {displayed.map((item) => (
                <TrendCard key={item.market.id} item={item} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Pattern legend footer */}
        {!loading && displayed.length > 0 && (
          <div className="mt-8 rounded-xl border border-surface-300/20 bg-surface-100/30 p-4">
            <h3 className="text-xs font-semibold text-surface-700 mb-3 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Pattern Definitions
            </h3>
            <div className="grid gap-2">
              {(['breakout', 'rising', 'consolidating', 'falling', 'breakdown'] as TrendPattern[]).map((p) => {
                const cfg = PATTERN_CONFIG[p]
                const Icon = cfg.icon
                return (
                  <div key={p} className="flex items-start gap-2 text-xs">
                    <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', cfg.color)} />
                    <div>
                      <span className={cn('font-semibold', cfg.color)}>{cfg.label}</span>
                      <span className="text-surface-600"> — {cfg.description}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Nav to adjacent exchange pages */}
        <div className="mt-6 flex flex-wrap gap-2">
          {[
            { href: '/exchange/movers', icon: ArrowUpRight, label: '24h Movers' },
            { href: '/exchange/signals', icon: Zap, label: 'Signals' },
            { href: '/exchange/flow', icon: Activity, label: 'Market Flow' },
            { href: '/exchange/heatmap', icon: BarChart2, label: 'Heat Map' },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300/30 bg-surface-100/30 text-xs text-surface-600 hover:text-surface-900 hover:bg-surface-100/60 transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <ArrowRight className="w-3 h-3 opacity-40" />
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
