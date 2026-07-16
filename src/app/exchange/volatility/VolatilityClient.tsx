'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wind,
  Zap,
  Minus,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  VolatilityResponse,
  VolatileMarket,
  CategoryVolatility,
} from '@/app/api/exchange/volatility/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { id: 7,  label: '7d'  },
  { id: 14, label: '14d' },
  { id: 30, label: '30d' },
] as const
type TF = (typeof TIMEFRAMES)[number]['id']

const TABS = [
  { id: 'volatile', label: 'Most Volatile', icon: Zap },
  { id: 'stable',   label: 'Most Stable',   icon: Scale },
  { id: 'category', label: 'By Category',   icon: BarChart2 },
] as const
type TabId = (typeof TABS)[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function priceColor(price: number, status: string): string {
  if (status === 'law')    return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function volColor(stddev: number): string {
  if (stddev >= 15) return 'text-against-400'
  if (stddev >= 10) return 'text-gold'
  if (stddev >= 5)  return 'text-for-400'
  return 'text-emerald'
}

function volBg(stddev: number): string {
  if (stddev >= 15) return 'bg-against-500/20 border-against-500/30'
  if (stddev >= 10) return 'bg-gold/10 border-gold/30'
  if (stddev >= 5)  return 'bg-for-500/10 border-for-500/30'
  return 'bg-emerald/10 border-emerald/30'
}

function trendIcon(trend: VolatileMarket['trend']) {
  if (trend === 'rising')  return TrendingUp
  if (trend === 'falling') return TrendingDown
  return Minus
}

function trendColor(trend: VolatileMarket['trend']): string {
  if (trend === 'rising')  return 'text-for-400'
  if (trend === 'falling') return 'text-against-400'
  return 'text-surface-500'
}

const FEAR_LABELS: Record<VolatilityResponse['fear_gauge'], { label: string; color: string; bg: string }> = {
  extreme_volatility: { label: 'Extreme Volatility',  color: 'text-against-400', bg: 'bg-against-500/20' },
  high:               { label: 'High Volatility',      color: 'text-gold',        bg: 'bg-gold/10'        },
  moderate:           { label: 'Moderate Volatility',  color: 'text-for-300',     bg: 'bg-for-500/10'     },
  low:                { label: 'Low Volatility',        color: 'text-emerald',     bg: 'bg-emerald/10'     },
  stable:             { label: 'Market Stable',         color: 'text-surface-400', bg: 'bg-surface-200'    },
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'bg-for-500',
  Economics:   'bg-gold',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-for-300',
  Philosophy:  'bg-surface-400',
  Culture:     'bg-pink-500',
  Health:      'bg-green-500',
  Environment: 'bg-teal-500',
  Education:   'bg-amber-500',
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ history, trend }: { history: number[]; trend: VolatileMarket['trend'] }) {
  if (!history || history.length < 2) {
    return <div className="w-20 h-8 bg-surface-300/30 rounded" />
  }

  const W = 80
  const H = 32
  const padding = 2
  const minV = Math.min(...history)
  const maxV = Math.max(...history)
  const range = maxV - minV || 1

  const pts = history.map((v, i) => {
    const x = padding + (i / (history.length - 1)) * (W - padding * 2)
    const y = padding + ((maxV - v) / range) * (H - padding * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const lineColor =
    trend === 'rising'  ? '#60a5fa' :
    trend === 'falling' ? '#f87171' :
    '#71717a'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  )
}

// ─── Market card ──────────────────────────────────────────────────────────────

function MarketCard({ market, rank }: { market: VolatileMarket; rank: number }) {
  const TrendIcon = trendIcon(market.trend)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03 }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'group flex items-start gap-3 p-3.5 rounded-xl border transition-all',
          'bg-surface-200/40 hover:bg-surface-200/70 border-surface-300 hover:border-surface-400',
        )}
      >
        {/* Rank */}
        <span className="text-xs font-mono text-surface-600 w-5 pt-0.5 shrink-0 text-right">
          {rank}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {market.statement}
          </p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Category */}
            {market.category && (
              <span className="text-xs font-mono text-surface-500">{market.category}</span>
            )}

            {/* Current price */}
            <span className={cn('text-xs font-mono font-medium', priceColor(market.current_price, market.status))}>
              {market.current_price}¢
            </span>

            {/* Trend */}
            <span className={cn('flex items-center gap-0.5 text-xs font-mono', trendColor(market.trend))}>
              <TrendIcon className="h-3 w-3" />
              {market.trend === 'sideways' ? 'Sideways' : `${market.trend_strength.toFixed(1)}¢`}
            </span>

            {/* Volume */}
            <span className="text-xs font-mono text-surface-600">{formatVol(market.volume)} votes</span>
          </div>
        </div>

        {/* Right: Volatility stats + sparkline */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Sparkline history={market.history} trend={market.trend} />

          <div className="flex items-center gap-2">
            <div className={cn('px-1.5 py-0.5 rounded border text-xs font-mono font-bold', volBg(market.stddev), volColor(market.stddev))}>
              σ {market.stddev.toFixed(1)}
            </div>
            <span className="text-xs font-mono text-surface-600">
              ±{market.price_range.toFixed(0)}¢
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, maxStddev }: { cat: CategoryVolatility; maxStddev: number }) {
  const barWidth = maxStddev > 0 ? (cat.avg_stddev / maxStddev) * 100 : 0
  const barColor = CATEGORY_COLORS[cat.category] ?? 'bg-surface-400'

  return (
    <motion.div
      className="p-4 rounded-xl border border-surface-300 bg-surface-200/40 space-y-2"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-white">{cat.category}</span>
          <span className="text-xs font-mono text-surface-600">
            #{cat.vol_rank} volatile
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-surface-500">
            {cat.market_count} markets
          </span>
          <span className={cn('text-sm font-mono font-bold', volColor(cat.avg_stddev))}>
            σ {cat.avg_stddev.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-mono text-surface-600">
        <span>Avg σ {cat.avg_stddev.toFixed(1)} · Max σ {cat.max_stddev.toFixed(1)}</span>
        <span>{cat.active_count} active</span>
      </div>
    </motion.div>
  )
}

// ─── Volatility gauge ─────────────────────────────────────────────────────────

function VolatilityGauge({ mvi, gauge }: { mvi: number; gauge: VolatilityResponse['fear_gauge'] }) {
  const { label, color, bg } = FEAR_LABELS[gauge]
  const pct = Math.min(mvi / 20, 1) * 100

  return (
    <div className={cn('rounded-2xl border border-surface-300 p-5', bg)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">
            Market Volatility Index
          </p>
          <div className="flex items-baseline gap-2">
            <span className={cn('text-4xl font-mono font-bold', color)}>{mvi.toFixed(1)}</span>
            <span className="text-sm font-mono text-surface-500">σ avg</span>
          </div>
        </div>
        <div className={cn('px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold', bg, color, 'border-current/30')}>
          {label}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-surface-300/50 rounded-full overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            gauge === 'extreme_volatility' ? 'bg-against-500' :
            gauge === 'high' ? 'bg-gold' :
            gauge === 'moderate' ? 'bg-for-500' :
            'bg-emerald',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between mt-1.5 text-xs font-mono text-surface-600">
        <span>Stable</span>
        <span>Extreme</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VolatilityClient() {
  const [data, setData] = useState<VolatilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<TabId>('volatile')
  const [timeframe, setTimeframe] = useState<TF>(30)

  const load = useCallback(async (tf: TF, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/exchange/volatility?days=${tf}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as VolatilityResponse
      setData(json)
    } catch {
      // keep previous data on refresh error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(timeframe) }, [load, timeframe])

  const handleTimeframe = (tf: TF) => {
    setTimeframe(tf)
    setData(null)
  }

  const maxCatStddev = Math.max(...(data?.by_category ?? []).map((c) => c.avg_stddev), 1)

  return (
    <div className="min-h-screen bg-surface-50 pb-20 md:pb-0">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="p-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-mono font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-gold" />
              Market Volatility
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Price variance & stability across all active civic markets
            </p>
          </div>
          <button
            onClick={() => load(timeframe, true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-2 mb-5">
          <Clock className="h-3.5 w-3.5 text-surface-500" />
          <div className="flex bg-surface-200 rounded-xl p-0.5 gap-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.id}
                onClick={() => handleTimeframe(tf.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors',
                  timeframe === tf.id
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white',
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
          {data && (
            <span className="text-xs font-mono text-surface-600 ml-auto">
              {data.most_volatile.length + data.most_stable.length} markets analysed
            </span>
          )}
        </div>

        {/* Volatility gauge */}
        {loading ? (
          <Skeleton className="h-28 mb-5 rounded-2xl" />
        ) : data ? (
          <div className="mb-5">
            <VolatilityGauge mvi={data.market_volatility_index} gauge={data.fear_gauge} />
          </div>
        ) : null}

        {/* Quick stats row */}
        {!loading && data && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              {
                label: 'Most Volatile',
                value: data.most_volatile[0]
                  ? `σ ${data.most_volatile[0].stddev.toFixed(1)}`
                  : '—',
                sub: data.most_volatile[0]?.category ?? '',
                color: 'text-against-300',
              },
              {
                label: 'Most Stable',
                value: data.most_stable[0]
                  ? `σ ${data.most_stable[0].stddev.toFixed(1)}`
                  : '—',
                sub: data.most_stable[0]?.category ?? '',
                color: 'text-emerald',
              },
              {
                label: 'Hottest Sector',
                value: data.by_category[0]?.category ?? '—',
                sub: data.by_category[0] ? `σ ${data.by_category[0].avg_stddev.toFixed(1)}` : '',
                color: 'text-gold',
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-surface-200/50 border border-surface-300 p-3 text-center"
              >
                <p className="text-xs font-mono text-surface-500 mb-1">{s.label}</p>
                <p className={cn('text-sm font-mono font-bold', s.color)}>{s.value}</p>
                {s.sub && <p className="text-xs font-mono text-surface-600 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex border-b border-surface-300 mb-5 gap-1">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-xs font-mono font-medium transition-colors border-b-2 -mb-px',
                  tab === t.id
                    ? 'border-for-500 text-white'
                    : 'border-transparent text-surface-500 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </motion.div>
          ) : !data ? (
            <EmptyState
              icon={Activity}
              title="No volatility data"
              description="Price history is still being collected. Check back once markets have more activity."
              action={{ label: 'Back to Exchange', href: '/exchange' }}
            />
          ) : tab === 'volatile' ? (
            <motion.div key="volatile" className="space-y-2">
              {data.most_volatile.length === 0 ? (
                <EmptyState
                  icon={Wind}
                  title="No volatile markets yet"
                  description="Not enough price history to measure volatility. Markets need at least 2 snapshots."
                  size="sm"
                />
              ) : (
                data.most_volatile.map((m, i) => (
                  <MarketCard key={m.id} market={m} rank={i + 1} />
                ))
              )}
            </motion.div>
          ) : tab === 'stable' ? (
            <motion.div key="stable" className="space-y-2">
              {data.most_stable.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No stable markets found"
                  description="All markets are showing meaningful price movement. Check back later."
                  size="sm"
                />
              ) : (
                data.most_stable.map((m, i) => (
                  <MarketCard key={m.id} market={m} rank={i + 1} />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="category" className="space-y-3">
              {data.by_category.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  title="No category data"
                  description="Not enough markets with price history to compute category volatility."
                  size="sm"
                />
              ) : (
                data.by_category.map((cat) => (
                  <CategoryRow key={cat.category} cat={cat} maxStddev={maxCatStddev} />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer link */}
        {!loading && data && (
          <div className="mt-8 flex items-center justify-between text-xs font-mono text-surface-600">
            <span>Updated {new Date(data.as_of).toLocaleTimeString()}</span>
            <Link
              href="/exchange/movers"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              24h Movers
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
