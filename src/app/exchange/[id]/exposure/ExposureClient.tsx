'use client'

/**
 * /exchange/[id]/exposure — Market Exposure Analysis
 *
 * Shows how a civic prediction market relates to the broader exchange:
 *   • Category beta — correlation vs. category consensus
 *   • Cross-market exposure — which markets move with this one
 *   • Inverse exposure — which markets move against this one
 *   • Percentile positioning — where this sits by price and volume
 *   • Velocity metrics — recent price and vote momentum
 *
 * Distinct from:
 *   /exchange/[id]/similar    — topic similarity by tags/category
 *   /exchange/correlations    — platform-wide correlation matrix
 *   /exchange/[id]/ripple     — downstream influence on other markets
 *   /exchange/[id]/analysis   — statistical price analysis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Compass,
  GitCompare,
  Layers,
  RefreshCw,
  Scale,
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
import type { ExposureData, CorrelatedMarket } from '@/app/api/exchange/[id]/exposure/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExposureClientProps {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function correlationColor(r: number): string {
  const abs = Math.abs(r)
  if (r > 0) {
    if (abs >= 0.6) return 'text-for-400'
    if (abs >= 0.4) return 'text-for-300'
    return 'text-surface-400'
  } else {
    if (abs >= 0.6) return 'text-against-400'
    if (abs >= 0.4) return 'text-against-300'
    return 'text-surface-400'
  }
}

function betaLabel(beta: number | null): string {
  if (beta === null) return 'No data'
  if (beta >= 0.7) return 'Category leader'
  if (beta >= 0.4) return 'Tracks category'
  if (beta >= 0.1) return 'Loosely aligned'
  if (beta >= -0.1) return 'Independent'
  if (beta >= -0.4) return 'Counter-category'
  return 'Divergent'
}

function betaColor(beta: number | null): string {
  if (beta === null) return 'text-surface-500'
  if (beta >= 0.4) return 'text-for-400'
  if (beta >= 0.1) return 'text-emerald'
  if (beta >= -0.1) return 'text-gold'
  return 'text-against-400'
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Correlation bar ──────────────────────────────────────────────────────────

function CorrelationBar({ value }: { value: number }) {
  const pct = Math.abs(value) * 100
  const isPositive = value >= 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isPositive ? 'bg-for-500' : 'bg-against-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn('text-xs font-mono tabular-nums w-10 text-right', correlationColor(value))}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  )
}

// ─── Market card ─────────────────────────────────────────────────────────────

function CorrelatedMarketCard({
  market,
  side,
}: {
  market: CorrelatedMarket
  side: 'positive' | 'negative'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'flex items-start gap-3 p-3 rounded-xl border transition-colors group',
          'bg-surface-50 border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-100',
        )}
      >
        {/* Correlation badge */}
        <div
          className={cn(
            'flex-shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center',
            side === 'positive'
              ? 'bg-for-500/10 border border-for-500/20'
              : 'bg-against-500/10 border border-against-500/20',
          )}
        >
          {side === 'positive' ? (
            <TrendingUp className="h-4 w-4 text-for-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-against-400" />
          )}
          <span
            className={cn(
              'text-[9px] font-mono font-bold mt-0.5',
              side === 'positive' ? 'text-for-400' : 'text-against-400',
            )}
          >
            {Math.abs(market.correlation).toFixed(2)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {market.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {market.category && (
              <span className="text-[10px] font-mono text-surface-500">{market.category}</span>
            )}
            <span className={cn('text-[10px] font-mono font-bold', priceColor(market.price))}>
              {market.price}¢
            </span>
            <span className="text-[10px] text-surface-600 font-mono">
              {market.overlap_days}d overlap
            </span>
          </div>
          <div className="mt-1.5">
            <CorrelationBar value={market.correlation} />
          </div>
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-1 group-hover:text-surface-400 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Beta ring ────────────────────────────────────────────────────────────────

function BetaRing({ beta }: { beta: number | null }) {
  const size = 80
  const r = size * 0.38
  const circumference = 2 * Math.PI * r

  // Map –1…1 to 0…100 fill
  const fill = beta !== null ? ((beta + 1) / 2) * 100 : 50
  const offset = circumference - (fill / 100) * circumference

  const color = beta !== null
    ? beta >= 0.4 ? '#3b82f6' : beta >= -0.1 ? '#c9a84c' : '#ef4444'
    : '#4b5563'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={size * 0.09}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={size * 0.09}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono font-bold text-sm" style={{ color }}>
          {beta !== null ? (beta >= 0 ? '+' : '') + beta.toFixed(2) : '—'}
        </span>
      </div>
    </div>
  )
}

// ─── Percentile bar ───────────────────────────────────────────────────────────

function PercentileBar({
  label,
  value,
  color,
  sublabel,
}: {
  label: string
  value: number
  color: string
  sublabel?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-surface-500">{label}</span>
        <span className="text-xs font-mono font-bold text-white">{value}th pct</span>
      </div>
      <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${value}%` }}
        />
      </div>
      {sublabel && (
        <p className="text-[10px] font-mono text-surface-600">{sublabel}</p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExposureClient({
  id,
  statement,
  category,
  status,
  price,
}: ExposureClientProps) {
  const [data, setData] = useState<ExposureData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/exposure`)
      if (!res.ok) throw new Error('Failed to load exposure data')
      const json: ExposureData = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* ── Header ── */}
        <div className="space-y-2">
          <Link
            href={`/exchange/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Market
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-snug">
                Market Exposure
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5 line-clamp-2">
                {statement}
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing || loading}
              aria-label="Refresh exposure data"
              className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {category && (
              <Badge variant="neutral" size="xs">{category}</Badge>
            )}
            <Badge
              variant={status === 'law' ? 'law' : status === 'active' ? 'for' : 'neutral'}
              size="xs"
            >
              {status}
            </Badge>
            <span className={cn('text-sm font-mono font-bold', priceColor(price))}>
              {price}¢
            </span>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl bg-against-900/40 border border-against-700/40 p-4 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-against-400 flex-shrink-0" />
            <p className="text-sm font-mono text-against-300">{error}</p>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <Skeleton className="h-5 w-36" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {data && !loading && (
          <motion.div
            className="space-y-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >

            {/* ── Category Positioning ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Compass className="h-4 w-4 text-for-400" />
                <h2 className="text-sm font-mono font-semibold text-white">Category Positioning</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* This market */}
                <div className="rounded-xl bg-surface-50 border border-surface-300/60 p-4">
                  <p className="text-[10px] font-mono text-surface-500 mb-1.5">This Market</p>
                  <p className={cn('text-2xl font-mono font-bold tabular-nums', priceColor(data.price))}>
                    {data.price}¢
                  </p>
                  <p className="text-[11px] font-mono text-surface-600 mt-1">
                    {data.total_votes.toLocaleString()} votes
                  </p>
                </div>

                {/* Category average */}
                <div className="rounded-xl bg-surface-50 border border-surface-300/60 p-4">
                  <p className="text-[10px] font-mono text-surface-500 mb-1.5">
                    {category ?? 'Category'} Avg
                  </p>
                  {data.category_avg_price !== null ? (
                    <>
                      <p className={cn('text-2xl font-mono font-bold tabular-nums', priceColor(data.category_avg_price))}>
                        {data.category_avg_price}¢
                      </p>
                      <p className="text-[11px] font-mono text-surface-600 mt-1">
                        {data.category_topic_count} market{data.category_topic_count !== 1 ? 's' : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-surface-500 text-sm font-mono">—</p>
                  )}
                </div>
              </div>

              {/* Tracking deviation */}
              {data.tracking_deviation !== null && (
                <div className="mt-3 p-3 rounded-xl bg-surface-50 border border-surface-300/60">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-surface-500">Tracking deviation</span>
                    <span className={cn(
                      'text-xs font-mono font-bold',
                      data.tracking_deviation <= 5 ? 'text-emerald' :
                      data.tracking_deviation <= 15 ? 'text-gold' : 'text-against-400',
                    )}>
                      {data.tracking_deviation > 0 ? '+' : ''}{data.price - (data.category_avg_price ?? 0)}¢
                      {' '}vs avg
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-surface-300 rounded-full relative overflow-visible">
                    {/* Center mark */}
                    <div className="absolute top-1/2 left-1/2 -translate-y-1/2 w-px h-3 bg-surface-500 -translate-x-1/2" />
                    {/* Deviation fill */}
                    <div
                      className={cn(
                        'absolute h-full rounded-full',
                        data.price >= (data.category_avg_price ?? 50) ? 'bg-for-500' : 'bg-against-500',
                      )}
                      style={{
                        left: data.price >= (data.category_avg_price ?? 50) ? '50%' : `${50 - data.tracking_deviation}%`,
                        width: `${data.tracking_deviation}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* ── Category Beta ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <GitCompare className="h-4 w-4 text-gold" />
                <h2 className="text-sm font-mono font-semibold text-white">Category Beta</h2>
              </div>

              <div className="flex items-center gap-5">
                <BetaRing beta={data.category_beta} />
                <div className="flex-1">
                  <p className={cn('text-sm font-mono font-semibold mb-1', betaColor(data.category_beta))}>
                    {betaLabel(data.category_beta)}
                  </p>
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">
                    {data.category_beta === null
                      ? 'Insufficient price history to calculate category correlation.'
                      : data.category_beta >= 0.6
                      ? `This market moves closely with the ${category ?? 'category'} consensus. A shift in category sentiment tends to pull this market with it.`
                      : data.category_beta >= 0.2
                      ? `This market loosely follows ${category ?? 'category'} consensus trends, with some independent movement.`
                      : data.category_beta >= -0.2
                      ? 'This market moves independently of its category — it has its own unique price drivers.'
                      : `This market often moves against the ${category ?? 'category'} consensus, suggesting contrarian positioning.`
                    }
                  </p>
                  {data.history_days > 0 && (
                    <p className="text-[10px] font-mono text-surface-600 mt-2">
                      Based on {data.history_days} days of price history
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Correlated Markets ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-for-400" />
                <h2 className="text-sm font-mono font-semibold text-white">Moves With</h2>
              </div>
              <p className="text-xs font-mono text-surface-500 mb-4">
                Markets that historically move in the same direction
              </p>

              {data.top_correlated.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  title="No strong correlations"
                  description="Not enough shared price history with other markets to calculate correlations yet."
                  size="sm"
                />
              ) : (
                <div className="space-y-2">
                  {data.top_correlated.map((market) => (
                    <CorrelatedMarketCard key={market.id} market={market} side="positive" />
                  ))}
                </div>
              )}
            </section>

            {/* ── Inversely Correlated ── */}
            {(data.top_inversely.length > 0 || data.top_correlated.length > 0) && (
              <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-against-400" />
                  <h2 className="text-sm font-mono font-semibold text-white">Moves Against</h2>
                </div>
                <p className="text-xs font-mono text-surface-500 mb-4">
                  Markets that historically move in the opposite direction — natural hedges
                </p>

                {data.top_inversely.length === 0 ? (
                  <p className="text-xs font-mono text-surface-500 italic py-4 text-center">
                    No strong inverse correlations found
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.top_inversely.map((market) => (
                      <CorrelatedMarketCard key={market.id} market={market} side="negative" />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Percentile Positioning ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers className="h-4 w-4 text-purple" />
                <h2 className="text-sm font-mono font-semibold text-white">Market Positioning</h2>
              </div>

              <div className="space-y-4">
                <PercentileBar
                  label="Consensus price"
                  value={data.price_percentile}
                  color={
                    data.price_percentile >= 70 ? 'bg-for-500' :
                    data.price_percentile >= 40 ? 'bg-surface-400' : 'bg-against-500'
                  }
                  sublabel={
                    data.price_percentile >= 80
                      ? 'High consensus — above most active markets'
                      : data.price_percentile <= 20
                      ? 'Strong dissent — in the lowest price quartile'
                      : 'Near median consensus across the exchange'
                  }
                />
                <PercentileBar
                  label="Trading volume"
                  value={data.vote_percentile}
                  color={
                    data.vote_percentile >= 70 ? 'bg-gold' :
                    data.vote_percentile >= 40 ? 'bg-surface-400' : 'bg-surface-500'
                  }
                  sublabel={
                    data.vote_percentile >= 80
                      ? 'High-volume market — broad civic engagement'
                      : data.vote_percentile <= 30
                      ? 'Low-volume market — limited engagement so far'
                      : 'Average volume for an active market'
                  }
                />
              </div>
            </section>

            {/* ── Velocity ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-emerald" />
                <h2 className="text-sm font-mono font-semibold text-white">7-Day Velocity</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Price velocity */}
                <div className="rounded-xl bg-surface-50 border border-surface-300/60 p-4">
                  <p className="text-[10px] font-mono text-surface-500 mb-1.5">Price momentum</p>
                  <div className="flex items-center gap-1.5">
                    {data.price_velocity_7d > 0 ? (
                      <TrendingUp className="h-4 w-4 text-for-400 flex-shrink-0" />
                    ) : data.price_velocity_7d < 0 ? (
                      <TrendingDown className="h-4 w-4 text-against-400 flex-shrink-0" />
                    ) : (
                      <Scale className="h-4 w-4 text-surface-500 flex-shrink-0" />
                    )}
                    <span className={cn(
                      'text-lg font-mono font-bold tabular-nums',
                      data.price_velocity_7d > 0 ? 'text-for-400' :
                      data.price_velocity_7d < 0 ? 'text-against-400' : 'text-surface-500',
                    )}>
                      {data.price_velocity_7d > 0 ? '+' : ''}{data.price_velocity_7d.toFixed(1)}¢
                    </span>
                    <span className="text-[10px] font-mono text-surface-600">/day</span>
                  </div>
                  <p className="text-[10px] font-mono text-surface-600 mt-1.5">
                    {Math.abs(data.price_velocity_7d) < 0.5
                      ? 'Stable price'
                      : data.price_velocity_7d > 0
                      ? 'Building FOR consensus'
                      : 'Building AGAINST consensus'
                    }
                  </p>
                </div>

                {/* Vote velocity */}
                <div className="rounded-xl bg-surface-50 border border-surface-300/60 p-4">
                  <p className="text-[10px] font-mono text-surface-500 mb-1.5">Vote inflow</p>
                  <div className="flex items-center gap-1.5">
                    <Zap className={cn(
                      'h-4 w-4 flex-shrink-0',
                      data.vote_velocity_7d >= 100 ? 'text-gold' :
                      data.vote_velocity_7d >= 20 ? 'text-for-400' : 'text-surface-500',
                    )} />
                    <span className={cn(
                      'text-lg font-mono font-bold tabular-nums',
                      data.vote_velocity_7d >= 100 ? 'text-gold' :
                      data.vote_velocity_7d >= 20 ? 'text-for-400' : 'text-surface-500',
                    )}>
                      +{data.vote_velocity_7d.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-mono text-surface-600">/day</span>
                  </div>
                  <p className="text-[10px] font-mono text-surface-600 mt-1.5">
                    {data.vote_velocity_7d >= 200
                      ? 'Viral engagement'
                      : data.vote_velocity_7d >= 50
                      ? 'Strong inflow'
                      : data.vote_velocity_7d >= 10
                      ? 'Moderate activity'
                      : 'Low vote inflow'
                    }
                  </p>
                </div>
              </div>
            </section>

            {/* ── Data quality note ── */}
            {data.history_days < 7 && (
              <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                <p className="text-xs font-mono text-surface-400 leading-relaxed">
                  Only {data.history_days} days of price history available. Correlation analysis improves as this market accumulates more trading data.
                </p>
              </div>
            )}

            {/* ── Footer links ── */}
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/exchange/${id}/similar`}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  Similar markets
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
              </Link>
              <Link
                href={`/exchange/correlations`}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  All correlations
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
              </Link>
            </div>

          </motion.div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
