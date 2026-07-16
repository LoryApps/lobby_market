'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Cpu,
  ExternalLink,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SectorDetail, SectorMarket, SectorResolvedMarket, SectorPriceTick } from '@/app/api/exchange/categories/[category]/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  label: string
}> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         label: 'Economics' },
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      label: 'Politics' },
  Technology:  { icon: Cpu,           color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       label: 'Technology' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      label: 'Science' },
  Ethics:      { icon: Scale,         color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  label: 'Ethics' },
  Philosophy:  { icon: BookOpen,      color: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/20',      label: 'Philosophy' },
  Culture:     { icon: Music2,        color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20',         label: 'Culture' },
  Health:      { icon: Heart,         color: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  label: 'Health' },
  Environment: { icon: Leaf,          color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      label: 'Environment' },
  Education:   { icon: GraduationCap, color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       label: 'Education' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
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

function priceBarColor(price: number): string {
  if (price >= 67) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 33) return 'bg-against-500'
  if (price <= 45) return 'bg-against-400'
  return 'bg-surface-500'
}

function sentimentLabel(s: SectorDetail['sentiment']): string {
  switch (s) {
    case 'strong_for': return 'Strong FOR'
    case 'leaning_for': return 'Leaning FOR'
    case 'contested': return 'Contested'
    case 'leaning_against': return 'Leaning AGAINST'
    case 'strong_against': return 'Strong AGAINST'
    default: return 'No Data'
  }
}

function sentimentColor(s: SectorDetail['sentiment']): string {
  switch (s) {
    case 'strong_for': return 'text-gold'
    case 'leaning_for': return 'text-for-400'
    case 'contested': return 'text-surface-400'
    case 'leaning_against': return 'text-against-300'
    case 'strong_against': return 'text-against-400'
    default: return 'text-surface-500'
  }
}

function changeColor(delta: number | null): string {
  if (delta === null) return 'text-surface-500'
  if (delta > 0) return 'text-emerald'
  if (delta < 0) return 'text-against-400'
  return 'text-surface-500'
}

function changePrefix(delta: number | null): string {
  if (delta === null) return '—'
  if (delta > 0) return `+${delta.toFixed(1)}¢`
  return `${delta.toFixed(1)}¢`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / (24 * 60 * 60 * 1000))
  const m = Math.floor(diff / (30 * 24 * 60 * 60 * 1000))
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (m < 12) return `${m}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Mini price chart (SVG) ───────────────────────────────────────────────────

function MiniChart({ data, color }: { data: SectorPriceTick[]; color: string }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-full text-xs font-mono text-surface-500">
        Not enough history
      </div>
    )
  }

  const prices = data.map((d) => d.avg_price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const W = 400
  const H = 80
  const PAD = 4

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((d.avg_price - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`

  const fillPoints = [
    `${PAD},${H - PAD}`,
    ...points,
    `${W - PAD},${H - PAD}`,
  ]
  const fillD = `M ${fillPoints.join(' L ')} Z`

  const lastPrice = prices[prices.length - 1]
  const firstPrice = prices[0]
  const isUp = lastPrice >= firstPrice

  const lineColor = isUp ? '#10B981' : '#F87171'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace(/[^a-z]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={fillD}
        fill={`url(#sg-${color.replace(/[^a-z]/g, '')})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Market row ───────────────────────────────────────────────────────────────

function MarketRow({ market, rank }: { market: SectorMarket; rank: number }) {
  return (
    <motion.div
      key={market.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.02 }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-200/40 transition-colors group"
    >
      {/* Rank */}
      <span className="w-5 text-right text-xs font-mono text-surface-600 flex-shrink-0">{rank}</span>

      {/* Statement */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {market.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-xs font-mono font-semibold', priceColor(market.price, market.status))}>
            {Math.round(market.price)}¢
          </span>
          <span className={cn('text-xs font-mono', changeColor(market.price_change_24h))}>
            {changePrefix(market.price_change_24h)}
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {formatVolume(market.volume)} votes
          </span>
          {market.status === 'voting' && (
            <Badge variant="warning" size="xs">Voting</Badge>
          )}
        </div>
      </div>

      {/* Mini bar */}
      <div className="w-20 flex-shrink-0">
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', priceBarColor(market.price))}
            style={{ width: `${market.price}%` }}
          />
        </div>
      </div>

      {/* Links */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Link
          href={`/exchange/${market.id}`}
          className="p-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          title="Exchange detail"
        >
          <BarChart2 className="h-3.5 w-3.5" />
        </Link>
        <Link
          href={`/topic/${market.id}`}
          className="p-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          title="Topic page"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Resolved row ─────────────────────────────────────────────────────────────

function ResolvedRow({ market }: { market: SectorResolvedMarket }) {
  const isLaw = market.status === 'law'
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-200/40 transition-colors group">
      {isLaw ? (
        <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" />
      ) : (
        <X className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-300 leading-snug line-clamp-1 group-hover:text-white transition-colors">
          {market.statement}
        </p>
        <span className="text-[10px] font-mono text-surface-500">
          {relativeTime(market.resolved_at)} · {formatVolume(market.volume)} votes
        </span>
      </div>
      <span className={cn('text-xs font-mono font-semibold flex-shrink-0', isLaw ? 'text-gold' : 'text-against-400')}>
        {Math.round(market.final_price)}¢
      </span>
      <Link
        href={`/topic/${market.id}`}
        className="p-1.5 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 py-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-2xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SortKey = 'volume' | 'price' | 'change'

interface Props {
  category: string
}

export function SectorDetailClient({ category }: Props) {
  const [data, setData] = useState<SectorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('volume')
  const [showResolved, setShowResolved] = useState<'all' | 'law' | 'failed'>('all')

  const cfg = CAT_CONFIG[category] ?? CAT_CONFIG['Economics']
  const Icon = cfg.icon

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/categories/${encodeURIComponent(category)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as SectorDetail
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sector data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category])

  useEffect(() => { load() }, [load])

  const sortedMarkets = useMemo(() => {
    if (!data) return []
    const markets = [...data.markets]
    if (sort === 'price') markets.sort((a, b) => b.price - a.price)
    else if (sort === 'change') markets.sort((a, b) => (b.price_change_24h ?? 0) - (a.price_change_24h ?? 0))
    return markets
  }, [data, sort])

  const filteredResolved = useMemo(() => {
    if (!data) return []
    if (showResolved === 'law') return data.resolved.filter((r) => r.status === 'law')
    if (showResolved === 'failed') return data.resolved.filter((r) => r.status === 'failed')
    return data.resolved
  }, [data, showResolved])

  // Chart range
  const [range, setRange] = useState<'7d' | '30d'>('30d')
  const chartData = useMemo(() => {
    if (!data?.price_history) return []
    if (range === '7d') {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      return data.price_history.filter((d) => d.date >= cutoff)
    }
    return data.price_history
  }, [data, range])

  const chartDelta = useMemo(() => {
    if (chartData.length < 2) return null
    return chartData[chartData.length - 1].avg_price - chartData[0].avg_price
  }, [chartData])

  return (
    <div className="min-h-screen bg-surface-50 text-white pb-24">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-5">
          <Link href="/exchange" className="hover:text-white transition-colors">Exchange</Link>
          <ArrowRight className="h-3 w-3" />
          <Link href="/exchange/categories" className="hover:text-white transition-colors">Sectors</Link>
          <ArrowRight className="h-3 w-3" />
          <span className={cfg.color}>{category}</span>
        </nav>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <EmptyState
            icon={BarChart2}
            iconColor="text-against-400"
            title="Failed to load sector"
            description={error}
            action={{ label: 'Try again', onClick: () => load() }}
          />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* ── Header ───────────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn('h-11 w-11 rounded-2xl flex items-center justify-center', cfg.bg, `border ${cfg.border}`)}>
                    <Icon className={cn('h-5 w-5', cfg.color)} />
                  </div>
                  <div>
                    <h1 className="font-mono text-2xl font-bold text-white">{category}</h1>
                    <p className={cn('text-sm font-mono font-medium mt-0.5', sentimentColor(data.sentiment))}>
                      {sentimentLabel(data.sentiment)}
                      {data.avg_price !== null && (
                        <span className="text-surface-500 font-normal ml-2">
                          · {data.avg_price.toFixed(1)}¢ avg
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>

              {/* ── Key stats ─────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Live Markets',
                    value: (data.active_count + data.voting_count).toString(),
                    sub: `${data.proposed_count} proposed`,
                    icon: Zap,
                    color: 'text-for-400',
                  },
                  {
                    label: 'Total Volume',
                    value: formatVolume(data.total_volume),
                    sub: `${data.total_markets} markets`,
                    icon: Users,
                    color: 'text-purple',
                  },
                  {
                    label: 'Laws Passed',
                    value: data.law_count.toString(),
                    sub: `${data.failed_count} failed`,
                    icon: Gavel,
                    color: 'text-gold',
                  },
                  {
                    label: '24h Change',
                    value: changePrefix(data.price_change_24h),
                    sub: 'avg consensus shift',
                    icon: data.price_change_24h !== null && data.price_change_24h >= 0 ? TrendingUp : TrendingDown,
                    color: changeColor(data.price_change_24h),
                  },
                ].map(({ label, value, sub, icon: StatIcon, color }) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
                  >
                    <StatIcon className={cn('h-4 w-4 mb-2', color)} />
                    <div className="font-mono text-xl font-bold text-white">{value}</div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">{label}</div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</div>
                  </div>
                ))}
              </div>

              {/* ── Price history chart ───────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-mono font-semibold text-white">Sector Consensus Trend</h2>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">
                      Average FOR% across all live markets
                      {chartDelta !== null && (
                        <span className={cn('ml-2', changeColor(chartDelta))}>
                          {changePrefix(chartDelta)} over period
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(['7d', '30d'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                          range === r
                            ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                            : 'bg-surface-200 text-surface-400 border-surface-300 hover:text-white',
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-28">
                  {chartData.length < 2 ? (
                    <div className="flex items-center justify-center h-full text-xs font-mono text-surface-500">
                      Not enough history to chart
                    </div>
                  ) : (
                    <MiniChart data={chartData} color={cfg.color} />
                  )}
                </div>

                {/* X-axis labels */}
                {chartData.length >= 2 && (
                  <div className="flex justify-between mt-2 text-[10px] font-mono text-surface-600">
                    <span>{new Date(chartData[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span>{new Date(chartData[chartData.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                )}
              </div>

              {/* ── Status breakdown ──────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wide mb-3">Market Status</h2>
                <div className="flex items-center gap-0 h-3 rounded-full overflow-hidden">
                  {[
                    { count: data.active_count, color: 'bg-for-500', label: 'Active' },
                    { count: data.voting_count, color: 'bg-gold', label: 'Voting' },
                    { count: data.proposed_count, color: 'bg-surface-400', label: 'Proposed' },
                    { count: data.law_count, color: 'bg-emerald', label: 'Law' },
                    { count: data.failed_count, color: 'bg-against-500', label: 'Failed' },
                  ].filter((s) => s.count > 0).map(({ count, color, label }) => (
                    <div
                      key={label}
                      className={cn('h-full transition-all', color)}
                      style={{ width: `${(count / data.total_markets) * 100}%` }}
                      title={`${label}: ${count}`}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                  {[
                    { count: data.active_count, color: 'bg-for-500', label: 'Active' },
                    { count: data.voting_count, color: 'bg-gold', label: 'Voting' },
                    { count: data.proposed_count, color: 'bg-surface-400', label: 'Proposed' },
                    { count: data.law_count, color: 'bg-emerald', label: 'Law' },
                    { count: data.failed_count, color: 'bg-against-500', label: 'Failed' },
                  ].map(({ count, color, label }) => (
                    <span key={label} className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                      <span className={cn('h-2 w-2 rounded-full', color)} />
                      {label} <span className="text-white">{count}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Live markets ──────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
                  <h2 className="text-sm font-mono font-semibold text-white">
                    Live Markets
                    <span className="ml-2 text-surface-500 font-normal">({sortedMarkets.length})</span>
                  </h2>
                  <div className="flex items-center gap-1">
                    {([
                      { id: 'volume', label: 'Volume' },
                      { id: 'price', label: 'Price' },
                      { id: 'change', label: '24h' },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setSort(id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                          sort === id
                            ? `${cfg.bg} ${cfg.color} ${cfg.border}`
                            : 'bg-surface-200 text-surface-400 border-surface-300 hover:text-white',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {sortedMarkets.length === 0 ? (
                  <EmptyState
                    icon={BarChart2}
                    title="No live markets"
                    description="No active or voting topics in this sector right now."
                    className="py-8"
                  />
                ) : (
                  <div className="divide-y divide-surface-300/50">
                    {sortedMarkets.map((market, i) => (
                      <MarketRow key={market.id} market={market} rank={i + 1} />
                    ))}
                  </div>
                )}

                {sortedMarkets.length > 0 && (
                  <div className="px-4 py-3 border-t border-surface-300 flex justify-center">
                    <Link
                      href={`/exchange?category=${encodeURIComponent(category)}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-mono',
                        cfg.color, 'hover:opacity-80 transition-opacity',
                      )}
                    >
                      View all {category} markets in Exchange
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* ── Resolved markets ──────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
                  <h2 className="text-sm font-mono font-semibold text-white">
                    Resolved
                    <span className="ml-2 text-surface-500 font-normal">
                      ({data.law_count} laws · {data.failed_count} failed)
                    </span>
                  </h2>
                  <div className="flex items-center gap-1">
                    {([
                      { id: 'all', label: 'All' },
                      { id: 'law', label: 'Laws' },
                      { id: 'failed', label: 'Failed' },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        onClick={() => setShowResolved(id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors',
                          showResolved === id
                            ? 'bg-surface-300 text-white border-surface-400'
                            : 'bg-surface-200 text-surface-400 border-surface-300 hover:text-white',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredResolved.length === 0 ? (
                  <EmptyState
                    icon={Gavel}
                    title="No resolved markets"
                    description="No topics in this sector have been resolved yet."
                    className="py-8"
                  />
                ) : (
                  <div className="divide-y divide-surface-300/50">
                    {filteredResolved.map((market) => (
                      <ResolvedRow key={market.id} market={market} />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Nav strip ────────────────────────────────────────── */}
              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/exchange/categories"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Sectors
                </Link>
                <Link
                  href="/exchange"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                >
                  Exchange Home
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
