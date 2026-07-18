'use client'

/**
 * /exchange/consensus — Crowd Consensus Dashboard
 *
 * Aggregates user price forecasts across all live Exchange markets.
 * Shows where the crowd thinks each market is headed vs. where it
 * currently trades — surfacing underpriced / overpriced markets.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Brain,
  ChevronRight,
  Flame,
  Info,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConsensusMarket, ConsensusResponse, ConsensusStats } from '@/app/api/exchange/consensus/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'forecasters', label: 'Most Forecasts', icon: Users },
  { id: 'underpriced', label: 'Most Underpriced', icon: TrendingUp },
  { id: 'overpriced',  label: 'Most Overpriced',  icon: TrendingDown },
  { id: 'bullish',     label: 'Most Bullish',     icon: Flame },
  { id: 'bearish',     label: 'Most Bearish',     icon: ArrowDown },
  { id: 'confidence',  label: 'Highest Confidence', icon: Target },
] as const
type SortId = (typeof SORT_OPTIONS)[number]['id']

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CAT_DOT: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-for-300',
  Philosophy:  'bg-purple',
  Culture:     'bg-against-400',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-gold',
}

const HORIZON_LABEL: Record<string, string> = {
  '7d':   '1W',
  '14d':  '2W',
  '30d':  '1M',
  '90d':  '3M',
  '180d': '6M',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function priceColor(price: number): string {
  if (price >= 70) return 'text-for-400'
  if (price >= 55) return 'text-for-300'
  if (price >= 45) return 'text-purple'
  if (price >= 30) return 'text-against-300'
  return 'text-against-400'
}

function divergenceColor(div: number): string {
  if (div > 8)  return 'text-emerald'
  if (div > 3)  return 'text-for-400'
  if (div < -8) return 'text-against-400'
  if (div < -3) return 'text-against-300'
  return 'text-surface-400'
}

function divergenceIcon(div: number) {
  if (div > 3)  return <ArrowUp   className="h-3.5 w-3.5 flex-shrink-0" />
  if (div < -3) return <ArrowDown className="h-3.5 w-3.5 flex-shrink-0" />
  return <Minus className="h-3.5 w-3.5 flex-shrink-0 text-surface-500" />
}

function crowdDirectionConfig(dir: ConsensusMarket['crowd_direction']): {
  label: string; cls: string; dotCls: string
} {
  switch (dir) {
    case 'bullish': return { label: 'Bullish', cls: 'text-emerald border-emerald/40 bg-emerald/10', dotCls: 'bg-emerald' }
    case 'bearish': return { label: 'Bearish', cls: 'text-against-400 border-against-500/40 bg-against-500/10', dotCls: 'bg-against-500' }
    case 'mixed':   return { label: 'Mixed',   cls: 'text-purple border-purple/40 bg-purple/10',         dotCls: 'bg-purple' }
    default:        return { label: 'Neutral', cls: 'text-surface-400 border-surface-500/40 bg-surface-300/20', dotCls: 'bg-surface-500' }
  }
}

function confidenceBar(conf: number): JSX.Element {
  const pct = ((conf - 1) / 4) * 100
  const color = conf >= 4 ? 'bg-emerald' : conf >= 3 ? 'bg-for-400' : 'bg-surface-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-12 rounded-full bg-surface-300/50 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-surface-500">{conf.toFixed(1)}</span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConsensusSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <Skeleton className="h-4 w-3/4 rounded" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats }: { stats: ConsensusStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
      {[
        { label: 'Markets Covered', value: stats.total_markets_with_forecasts, icon: BarChart2, color: 'text-for-400' },
        { label: 'Total Forecasts', value: stats.total_forecasters, icon: Users, color: 'text-purple' },
        { label: 'Avg Sentiment', value: `${stats.avg_bullish_pct}% Bullish`, icon: TrendingUp, color: 'text-emerald', isString: true },
        { label: 'Underpriced', value: stats.markets_underpriced, icon: ArrowUp, color: 'text-emerald' },
        { label: 'Overpriced', value: stats.markets_overpriced, icon: ArrowDown, color: 'text-against-400' },
        { label: 'Avg Divergence', value: `${stats.avg_divergence > 0 ? '+' : ''}${stats.avg_divergence}¢`, icon: Scale, color: stats.avg_divergence > 0 ? 'text-emerald' : 'text-against-400', isString: true },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-xl bg-surface-100 border border-surface-300 p-3"
        >
          <div className="flex items-center gap-1.5 mb-1">
            <s.icon className={cn('h-3.5 w-3.5 flex-shrink-0', s.color)} />
            <span className="text-xs font-mono text-surface-500">{s.label}</span>
          </div>
          <p className={cn('text-lg font-mono font-bold', s.color)}>
            {s.isString ? s.value : (s.value as number).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Market row ───────────────────────────────────────────────────────────────

function MarketRow({ market, index }: { market: ConsensusMarket; index: number }) {
  const dir = crowdDirectionConfig(market.crowd_direction)
  const bullPct = Math.round((market.bullish_count / market.forecast_count) * 100)
  const bearPct = Math.round((market.bearish_count / market.forecast_count) * 100)
  const neuPct  = 100 - bullPct - bearPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        href={`/exchange/${market.topic_id}/forecast`}
        className="block rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/60 transition-all p-4 group"
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Category */}
            {market.category && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', CAT_DOT[market.category] ?? 'bg-surface-400')} />
                <span className="text-xs font-mono text-surface-500">{market.category}</span>
              </div>
            )}
            <p className="text-sm font-mono text-white leading-snug group-hover:text-for-200 transition-colors line-clamp-2">
              {market.statement}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 flex-shrink-0 mt-0.5 transition-colors" />
        </div>

        {/* Price comparison */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {/* Current price */}
          <div className="text-center">
            <p className="text-xs font-mono text-surface-500 mb-0.5">Current</p>
            <p className={cn('text-lg font-mono font-bold', priceColor(market.current_price))}>
              {market.current_price}¢
            </p>
          </div>

          {/* Divergence arrow */}
          <div className="flex flex-col items-center justify-center">
            <div className={cn('flex items-center gap-1 text-sm font-mono font-bold', divergenceColor(market.divergence))}>
              {divergenceIcon(market.divergence)}
              <span>{market.divergence > 0 ? '+' : ''}{market.divergence}¢</span>
            </div>
            <p className="text-xs font-mono text-surface-600 mt-0.5">divergence</p>
          </div>

          {/* Crowd target */}
          <div className="text-center">
            <p className="text-xs font-mono text-surface-500 mb-0.5">Crowd Target</p>
            <p className={cn('text-lg font-mono font-bold', priceColor(market.avg_target))}>
              {market.avg_target}¢
            </p>
          </div>
        </div>

        {/* Price track visual */}
        <div className="relative h-2 bg-surface-300/40 rounded-full mb-3 overflow-visible">
          {/* Current price marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-0.5 bg-white/40 rounded-full"
            style={{ left: `${Math.min(Math.max(market.current_price, 2), 98)}%` }}
          />
          {/* Fill bar from 0 to current */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-for-500/30"
            style={{ width: `${market.current_price}%` }}
          />
          {/* Crowd target marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-4 w-1 rounded-full shadow-lg"
            style={{
              left: `${Math.min(Math.max(market.avg_target, 2), 98)}%`,
              backgroundColor: market.avg_target > market.current_price ? '#4ade80' : '#f87171',
            }}
          />
        </div>

        {/* Bottom meta row */}
        <div className="flex items-center justify-between gap-2">
          {/* Bull/Bear bar */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="flex h-1.5 rounded-full overflow-hidden w-24 flex-shrink-0">
              <div className="bg-emerald h-full transition-all" style={{ width: `${bullPct}%` }} />
              <div className="bg-surface-400 h-full" style={{ width: `${neuPct}%` }} />
              <div className="bg-against-500 h-full" style={{ width: `${bearPct}%` }} />
            </div>
            <span className="text-xs font-mono text-surface-500 flex-shrink-0">
              {bullPct}% / {bearPct}%
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Crowd direction badge */}
            <span className={cn('text-xs font-mono border rounded-full px-2 py-0.5 flex items-center gap-1', dir.cls)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', dir.dotCls)} />
              {dir.label}
            </span>
            {/* Forecasters count */}
            <span className="text-xs font-mono text-surface-500 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {market.forecast_count}
            </span>
            {/* Horizon */}
            <span className="text-xs font-mono text-surface-600">
              {HORIZON_LABEL[market.top_horizon] ?? market.top_horizon}
            </span>
          </div>
        </div>

        {/* Confidence */}
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-xs font-mono text-surface-600">Confidence</span>
          {confidenceBar(market.avg_confidence)}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConsensusClient() {
  const [data, setData] = useState<ConsensusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortId>('forecasters')
  const [category, setCategory] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort })
      if (category) params.set('category', category)
      const res = await fetch(`/api/exchange/consensus?${params}`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [sort, category])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/exchange"
            className="mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-5 w-5 text-purple flex-shrink-0" />
              <h1 className="font-mono text-2xl font-bold text-white">Crowd Consensus</h1>
              <button
                onClick={() => setShowInfo((v) => !v)}
                className="ml-1 text-surface-500 hover:text-surface-300 transition-colors"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm font-mono text-surface-500">
              Where forecasters think each market is heading vs. current price
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-300 transition-colors flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-xl bg-purple/5 border border-purple/20 p-4 text-sm font-mono text-surface-400 space-y-2">
                <p>
                  <span className="text-purple">Crowd Consensus</span> aggregates all user price forecasts
                  per market. The <span className="text-white">Crowd Target</span> is the average price
                  forecasters expect, and <span className="text-white">Divergence</span> is how far that
                  is from today&apos;s price.
                </p>
                <p>
                  A <span className="text-emerald">positive divergence</span> means the crowd thinks the
                  market is underpriced — consensus may move up.{' '}
                  <span className="text-against-400">Negative divergence</span> means the crowd expects a
                  drop. Use this signal alongside your own research.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats strip */}
        {data?.stats && !loading && <StatsStrip stats={data.stats} />}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Sort tabs */}
          <div className="flex gap-1 flex-wrap">
            {SORT_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all',
                  sort === s.id
                    ? 'bg-for-500/20 text-for-300 border-for-500/40'
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-surface-300'
                )}
              >
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'px-3 py-1 rounded-full border text-xs font-mono transition-all',
              !category
                ? 'bg-surface-300 text-white border-surface-400'
                : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400'
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat === category ? null : cat)}
              className={cn(
                'px-3 py-1 rounded-full border text-xs font-mono transition-all flex items-center gap-1.5',
                category === cat
                  ? 'bg-surface-300 text-white border-surface-400'
                  : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400'
              )}
            >
              <div className={cn('h-1.5 w-1.5 rounded-full', CAT_DOT[cat] ?? 'bg-surface-400')} />
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <ConsensusSkeleton />
        ) : !data || data.markets.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No forecasts yet"
            description="Be the first to submit a price forecast on any Exchange market. Visit a market page and look for the Forecast tab."
            action={{ label: 'Browse Markets', href: '/exchange' }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {data.markets.map((market, i) => (
                <MarketRow key={market.topic_id} market={market} index={i} />
              ))}
            </AnimatePresence>

            {/* Footer note */}
            <p className="text-center text-xs font-mono text-surface-600 pt-2">
              Showing top {data.markets.length} markets by forecast activity ·{' '}
              <Link href="/exchange/forecasts" className="text-for-400 hover:text-for-300 transition-colors">
                My Forecasts
              </Link>
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
