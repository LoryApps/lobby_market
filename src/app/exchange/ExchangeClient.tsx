'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  Bell,
  Bookmark,
  Calendar,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  GitCompare,
  LayoutGrid,
  Map,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Timer,
  Trophy,
  Wallet,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ExchangeResponse, Market, ExchangeStats } from '@/app/api/exchange/route'
import type { TrendsResponse, PriceTick } from '@/app/api/exchange/trends/route'

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_TABS = [
  { id: 'volume', label: 'Volume', icon: BarChart2 },
  { id: 'contested', label: 'Contested', icon: Scale },
  { id: 'momentum', label: 'Momentum', icon: TrendingUp },
  { id: 'near_law', label: 'Near Law', icon: Gavel },
  { id: 'closing', label: 'Closing', icon: Timer },
] as const

type SortId = (typeof SORT_TABS)[number]['id']

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const STATUS_FILTERS = [
  { id: null, label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'voting', label: 'Voting' },
  { id: 'settled', label: 'Settled' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h`
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-600'
}

function priceBarColor(price: number, status: string): string {
  if (status === 'law') return 'bg-gold'
  if (status === 'failed') return 'bg-against-600'
  if (price >= 67) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 33) return 'bg-against-600'
  if (price <= 45) return 'bg-against-500'
  return 'bg-surface-500'
}

function marketStatusBadge(m: Market) {
  if (m.status === 'law') return { label: 'LAW', class: 'bg-gold/20 text-gold border-gold/30' }
  if (m.status === 'failed') return { label: 'FAILED', class: 'bg-against-500/15 text-against-400 border-against-500/30' }
  if (m.status === 'voting') return { label: 'VOTING', class: 'bg-purple/15 text-purple border-purple/30' }
  return { label: 'LIVE', class: 'bg-for-500/15 text-for-400 border-for-500/30' }
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: ExchangeStats }) {
  return (
    <div className="grid grid-cols-4 gap-2 mb-5">
      {[
        {
          label: 'Total Volume',
          value: formatVolume(stats.total_volume),
          icon: BarChart2,
          color: 'text-for-400',
        },
        {
          label: 'Live Markets',
          value: stats.live_markets.toString(),
          icon: Activity,
          color: 'text-emerald',
        },
        {
          label: 'In Voting',
          value: stats.voting_markets.toString(),
          icon: Scale,
          color: 'text-purple',
        },
        {
          label: 'Laws Today',
          value: stats.laws_today.toString(),
          icon: Gavel,
          color: 'text-gold',
        },
      ].map((s) => (
        <div
          key={s.label}
          className="bg-surface-200/60 border border-surface-300/60 rounded-xl p-3 text-center"
        >
          <s.icon className={cn('h-3.5 w-3.5 mx-auto mb-1', s.color)} aria-hidden="true" />
          <p className={cn('text-base font-mono font-bold leading-none', s.color)}>{s.value}</p>
          <p className="text-[10px] text-surface-500 mt-0.5 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ ticks, width = 56, height = 20 }: { ticks: PriceTick[]; width?: number; height?: number }) {
  const points = useMemo(() => {
    if (ticks.length < 2) return null
    const prices = ticks.map((t) => t.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1
    const step = width / (prices.length - 1)
    return prices
      .map((p, i) => `${i * step},${height - ((p - min) / range) * height}`)
      .join(' ')
  }, [ticks, width, height])

  if (!points) return null

  const first = ticks[0].price
  const last = ticks[ticks.length - 1].price
  const color = last > first + 1 ? '#22c55e' : last < first - 1 ? '#ef4444' : '#6b7280'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
    </svg>
  )
}

// ─── Market Card ──────────────────────────────────────────────────────────────

function MarketCard({ market, rank, ticks }: { market: Market; rank: number; ticks?: PriceTick[] }) {
  const badge = marketStatusBadge(market)
  const priceBarWidth = `${Math.round(market.price)}%`
  const priceDelta = ticks && ticks.length >= 2 ? market.price - ticks[0].price : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'group block rounded-xl border p-3.5 transition-all duration-200',
          'bg-surface-200/50 hover:bg-surface-200/80',
          market.status === 'law'
            ? 'border-gold/20 hover:border-gold/40'
            : market.status === 'failed'
              ? 'border-against-500/15 hover:border-against-500/30'
              : market.status === 'voting'
                ? 'border-purple/20 hover:border-purple/30'
                : 'border-surface-300/60 hover:border-surface-400/80',
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          {/* Rank + statement */}
          <div className="flex items-start gap-2 min-w-0">
            <span className="flex-shrink-0 text-[11px] font-mono text-surface-500 mt-0.5 w-5 text-right">
              #{rank}
            </span>
            <p className="text-sm font-medium text-white leading-snug line-clamp-2">
              {market.statement}
            </p>
          </div>

          {/* Status badge + arrow */}
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span
              className={cn(
                'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border',
                badge.class,
              )}
            >
              {badge.label}
            </span>
            <ChevronRight
              className="h-3.5 w-3.5 text-surface-500 group-hover:text-white group-hover:translate-x-0.5 transition-all"
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Price bar */}
        <div className="mb-2.5">
          <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', priceBarColor(market.price, market.status))}
              style={{ width: priceBarWidth }}
              initial={{ width: 0 }}
              animate={{ width: priceBarWidth }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Metrics row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Price */}
            <div>
              <p className="text-[10px] text-surface-500 leading-none mb-0.5">FOR</p>
              <p className={cn('text-sm font-mono font-bold leading-none', priceColor(market.price, market.status))}>
                {Math.round(market.price)}¢
              </p>
            </div>
            {/* Against */}
            <div>
              <p className="text-[10px] text-surface-500 leading-none mb-0.5">AGAINST</p>
              <p className="text-sm font-mono font-bold leading-none text-against-400">
                {Math.round(100 - market.price)}¢
              </p>
            </div>
            {/* Volume */}
            <div>
              <p className="text-[10px] text-surface-500 leading-none mb-0.5">VOL</p>
              <p className="text-sm font-mono font-bold leading-none text-surface-600">
                {formatVolume(market.volume)}
              </p>
            </div>
            {/* Delta badge */}
            {priceDelta !== null && Math.abs(priceDelta) >= 1 && (
              <div className="flex items-center gap-0.5">
                {priceDelta > 0
                  ? <TrendingUp className="h-3 w-3 text-emerald" aria-hidden="true" />
                  : <TrendingDown className="h-3 w-3 text-against-400" aria-hidden="true" />}
                <span className={cn('text-[10px] font-mono font-semibold', priceDelta > 0 ? 'text-emerald' : 'text-against-400')}>
                  {priceDelta > 0 ? '+' : ''}{Math.round(priceDelta)}
                </span>
              </div>
            )}
          </div>

          {/* Right side: sparkline + signals + category */}
          <div className="flex items-center gap-2">
            {ticks && ticks.length >= 2 && (
              <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                <Sparkline ticks={ticks} />
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {market.category && (
                <span className="text-[10px] text-surface-500 font-mono bg-surface-300/40 px-1.5 py-0.5 rounded">
                  {market.category}
                </span>
              )}
              {market.is_hot && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-against-400">
                  <Flame className="h-2.5 w-2.5" aria-hidden="true" />
                  HOT
                </span>
              )}
              {market.is_closing_soon && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-gold animate-pulse">
                  <Clock className="h-2.5 w-2.5" aria-hidden="true" />
                  {market.voting_ends_at ? timeUntil(market.voting_ends_at) : 'SOON'}
                </span>
              )}
              {market.is_near_law && !market.is_closing_soon && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-gold">
                  <Gavel className="h-2.5 w-2.5" aria-hidden="true" />
                  NEAR LAW
                </span>
              )}
              {market.is_deadlocked && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold text-surface-500">
                  <Scale className="h-2.5 w-2.5" aria-hidden="true" />
                  SPLIT
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function MarketSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/40 bg-surface-200/40 p-3.5 space-y-2.5">
      <div className="flex gap-2">
        <Skeleton className="h-4 w-5" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-5 w-14 rounded-md" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

// ─── Main Exchange Client ─────────────────────────────────────────────────────

export function ExchangeClient() {
  const [data, setData] = useState<ExchangeResponse | null>(null)
  const [trends, setTrends] = useState<TrendsResponse>({})
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortId>('volume')
  const [category, setCategory] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, _k: String(refreshKey) })
      if (category) params.set('category', category)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/exchange?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const json: ExchangeResponse = await res.json()
      setData(json)

      // Fetch price trends for the first 30 markets (non-blocking)
      if (json.markets.length > 0) {
        const ids = json.markets.slice(0, 30).map((m) => m.id).join(',')
        fetch(`/api/exchange/trends?ids=${ids}&limit=12`)
          .then((r) => r.ok ? r.json() : {})
          .then((t: TrendsResponse) => setTrends(t))
          .catch(() => {})
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [sort, category, statusFilter, refreshKey])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setRefreshKey((k) => k + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-16">
        {/* Page header */}
        <div className="py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="h-5 w-5 text-for-400" aria-hidden="true" />
                <h1 className="text-xl font-bold text-white">Civic Exchange</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-for-500/15 border border-for-500/30 rounded-full text-[10px] font-mono font-bold text-for-400 animate-pulse">
                  <span className="h-1.5 w-1.5 rounded-full bg-for-500 animate-ping" aria-hidden="true" />
                  LIVE
                </span>
              </div>
              <p className="text-sm text-surface-500">
                Civic consensus as prediction markets — track every debate in real time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/exchange/categories"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/40 text-xs font-medium text-surface-500 hover:text-purple transition-colors"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Sectors
              </Link>
              <Link
                href="/exchange/movers"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 text-xs font-medium text-surface-500 hover:text-gold transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Movers
              </Link>
              <Link
                href="/exchange/resolved"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-xs font-medium text-surface-500 hover:text-white transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                Resolved
              </Link>
              <Link
                href="/exchange/leaderboard"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-xs font-medium text-surface-500 hover:text-white transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                Leaders
              </Link>
              <Link
                href="/exchange/alerts"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 text-xs font-medium text-surface-500 hover:text-for-300 transition-colors"
              >
                <Bell className="h-3.5 w-3.5" />
                Alerts
              </Link>
              <Link
                href="/exchange/portfolio"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-xs font-medium text-surface-500 hover:text-white transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                Portfolio
              </Link>
              <Link
                href="/exchange/correlations"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-emerald/40 text-xs font-medium text-surface-500 hover:text-emerald transition-colors"
              >
                <GitCompare className="h-3.5 w-3.5" />
                Correlations
              </Link>
              <Link
                href="/exchange/indices"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-400/40 text-xs font-medium text-surface-500 hover:text-for-400 transition-colors"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Indices
              </Link>
              <Link
                href="/exchange/calendar"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 text-xs font-medium text-surface-500 hover:text-gold transition-colors"
              >
                <Calendar className="h-3.5 w-3.5" />
                Calendar
              </Link>
              <Link
                href="/exchange/screener"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/40 text-xs font-medium text-surface-500 hover:text-purple transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Screener
              </Link>
              <Link
                href="/exchange/watchlist"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-400/40 text-xs font-medium text-surface-500 hover:text-for-300 transition-colors"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Watchlist
              </Link>
              <Link
                href="/exchange/flow"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-emerald/40 text-xs font-medium text-surface-500 hover:text-emerald transition-colors"
              >
                <Activity className="h-3.5 w-3.5" />
                Flow
              </Link>
              <Link
                href="/exchange/heatmap"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 text-xs font-medium text-surface-500 hover:text-gold transition-colors"
              >
                <Map className="h-3.5 w-3.5" />
                Heat Map
              </Link>
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                disabled={loading}
                aria-label="Refresh markets"
                className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {data?.stats && <StatsBar stats={data.stats} />}
        {loading && !data && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}

        {/* Sort tabs */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-none">
          {SORT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={cn(
                'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                sort === id
                  ? 'bg-for-500/20 text-for-300 border border-for-500/40'
                  : 'text-surface-500 hover:text-white border border-transparent hover:border-surface-400/40',
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 mb-3">
          {STATUS_FILTERS.map(({ id, label }) => (
            <button
              key={String(id)}
              onClick={() => setStatusFilter(id)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all border',
                statusFilter === id
                  ? 'bg-surface-300 text-white border-surface-400'
                  : 'text-surface-500 border-transparent hover:border-surface-400/40 hover:text-surface-700',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-mono transition-all border',
              !category
                ? 'bg-surface-300/60 text-white border-surface-400'
                : 'text-surface-500 border-transparent hover:text-surface-700 hover:border-surface-400/40',
            )}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c === category ? null : c)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-mono transition-all border',
                category === c
                  ? 'bg-for-500/20 text-for-300 border-for-500/40'
                  : 'text-surface-500 border-transparent hover:text-surface-700 hover:border-surface-400/40',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Market list */}
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <MarketSkeleton key={i} />
            ))}
          </div>
        ) : !data || data.markets.length === 0 ? (
          <EmptyState
            icon={BarChart2}
            title="No markets found"
            description="Try changing your filters to see more markets."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {data.markets.map((market, i) => (
                <MarketCard key={market.id} market={market} rank={i + 1} ticks={trends[market.id]} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-8 text-center">
          <p className="text-[11px] text-surface-500">
            Prices represent % FOR consensus · 100¢ = guaranteed law · 0¢ = guaranteed fail
          </p>
          <p className="text-[11px] text-surface-600 mt-1">
            Auto-refreshes every 30 seconds · Data from live platform votes
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
