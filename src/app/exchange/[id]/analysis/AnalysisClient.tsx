'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Minus,
  RefreshCw,
  Scale,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { MarketAnalysis, VelocityPoint } from '@/app/api/exchange/[id]/analysis/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-surface-500'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function priceBg(price: number, status: string): string {
  if (status === 'law') return 'bg-gold/10 border-gold/20'
  if (status === 'failed') return 'bg-surface-700/40 border-surface-600'
  if (price >= 67) return 'bg-gold/10 border-gold/20'
  if (price >= 55) return 'bg-for-600/20 border-for-600/30'
  if (price <= 33) return 'bg-against-600/20 border-against-600/30'
  if (price <= 45) return 'bg-against-700/20 border-against-700/30'
  return 'bg-surface-700/40 border-surface-600/40'
}

function deltaColor(delta: number | null): string {
  if (delta === null) return 'text-surface-500'
  if (delta > 0) return 'text-emerald'
  if (delta < 0) return 'text-against-400'
  return 'text-surface-500'
}

function DeltaIcon({ delta }: { delta: number | null }) {
  if (delta === null || Math.abs(delta) < 0.5) return <Minus className="h-3.5 w-3.5" />
  if (delta > 0) return <ArrowUp className="h-3.5 w-3.5" />
  return <ArrowDown className="h-3.5 w-3.5" />
}

// ─── Mini Velocity Chart ──────────────────────────────────────────────────────

function VelocityChart({ data }: { data: VelocityPoint[] }) {
  const maxVotes = useMemo(() => Math.max(1, ...data.map((d) => d.votes)), [data])
  const WIDTH = 480
  const HEIGHT = 80
  const BAR_GAP = 2
  const barWidth = data.length > 0 ? Math.max(2, (WIDTH - BAR_GAP * data.length) / data.length) : 8

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-surface-600 text-sm">
        No daily activity data
      </div>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      aria-label="Daily voting velocity chart"
    >
      {data.map((d, i) => {
        const barH = Math.max(2, (d.votes / maxVotes) * (HEIGHT - 8))
        const x = i * (barWidth + BAR_GAP)
        const y = HEIGHT - barH

        // Color based on price at that point
        const pColor =
          d.price >= 60 ? '#3b82f6'
          : d.price <= 40 ? '#ef4444'
          : '#64748b'

        return (
          <rect
            key={d.date}
            x={x}
            y={y}
            width={barWidth}
            height={barH}
            rx={1}
            fill={pColor}
            opacity={0.7}
          >
            <title>{`${d.date}: ${d.votes} votes · ${Math.round(d.price)}¢`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

// ─── Price Distribution Bar ───────────────────────────────────────────────────

function DistributionBar({
  distribution,
  currentPrice,
}: {
  distribution: MarketAnalysis['price_distribution']
  currentPrice: number
}) {
  const maxCount = Math.max(1, ...distribution.map((b) => b.count))
  const total = distribution.reduce((s, b) => s + b.count, 0) || 1

  return (
    <div className="space-y-1">
      {distribution.map((bucket) => {
        const pct = (bucket.count / maxCount) * 100
        const isCurrent = currentPrice >= bucket.low && currentPrice < bucket.high
        const share = Math.round((bucket.count / total) * 100)
        const barColor =
          bucket.high <= 40 ? 'bg-against-500'
          : bucket.low >= 60 ? 'bg-for-500'
          : 'bg-surface-500'

        return (
          <div key={bucket.range} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                'w-12 text-right tabular-nums shrink-0',
                isCurrent ? 'text-white font-semibold' : 'text-surface-500',
              )}
            >
              {bucket.range}¢
            </span>
            <div className="flex-1 h-3 bg-surface-800 rounded-sm overflow-hidden relative">
              <div
                className={cn('h-full rounded-sm transition-all', barColor, isCurrent && 'ring-1 ring-white/30')}
                style={{ width: `${pct}%` }}
              />
              {isCurrent && (
                <span className="absolute inset-0 flex items-center pl-1 text-[9px] text-white font-bold">
                  ▶
                </span>
              )}
            </div>
            <span className="w-8 text-right text-surface-500 tabular-nums shrink-0">
              {share > 0 ? `${share}%` : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-3">
      <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={cn('text-xl font-bold tabular-nums leading-none', accent ?? 'text-white')}>
        {value}
      </p>
      {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Signal badge ─────────────────────────────────────────────────────────────

function SignalBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', color)}>
      {label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  id: string
}

export function AnalysisClient({ id }: Props) {
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/analysis`)
      if (!res.ok) throw new Error('Failed to load')
      const data: MarketAnalysis = await res.json()
      setAnalysis(data)
    } catch {
      setError('Could not load analysis')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <TopBar />
        <main className="min-h-screen bg-surface-900 pb-24 pt-16">
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        </main>
        <BottomNav />
      </>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !analysis) {
    return (
      <>
        <TopBar />
        <main className="min-h-screen bg-surface-900 pb-24 pt-16">
          <div className="max-w-2xl mx-auto px-4 py-12">
            <EmptyState
              icon={<BarChart2 className="h-8 w-8" />}
              title="Analysis unavailable"
              description="Could not load market analysis. Try refreshing."
              action={{ label: 'Retry', onClick: load }}
            />
          </div>
        </main>
        <BottomNav />
      </>
    )
  }

  const a = analysis
  const statusLabel: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Law',
    failed: 'Failed',
  }

  // Signals
  const signals: Array<{ label: string; color: string }> = []
  if (a.is_overbought)
    signals.push({ label: 'Overbought', color: 'text-gold border-gold/40 bg-gold/10' })
  if (a.is_oversold)
    signals.push({ label: 'Oversold', color: 'text-against-400 border-against-500/40 bg-against-600/10' })
  if (a.trend_direction === 'bullish')
    signals.push({ label: 'Bullish momentum', color: 'text-emerald border-emerald/40 bg-emerald/10' })
  if (a.trend_direction === 'bearish')
    signals.push({ label: 'Bearish momentum', color: 'text-against-400 border-against-500/40 bg-against-600/10' })
  if (a.volatility_score > 60)
    signals.push({ label: 'High volatility', color: 'text-purple border-purple/40 bg-purple/10' })
  if (a.volatility_score < 15 && a.snapshot_count > 5)
    signals.push({ label: 'Low volatility', color: 'text-surface-400 border-surface-600/60 bg-surface-800/60' })
  if (a.status === 'voting')
    signals.push({ label: 'In Voting', color: 'text-purple border-purple/40 bg-purple/10' })
  if (a.status === 'law')
    signals.push({ label: 'Resolved: LAW', color: 'text-gold border-gold/40 bg-gold/10' })

  const sentimentFavour =
    a.top_for_score + a.top_against_score > 0
      ? Math.round((a.top_for_score / (a.top_for_score + a.top_against_score)) * 100)
      : 50

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-900 pb-24 pt-16">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">

          {/* Back + refresh */}
          <div className="flex items-center justify-between">
            <Link
              href={`/exchange/${id}`}
              className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Market
            </Link>
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-xl border p-4 space-y-3',
              priceBg(a.price, a.status),
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <Badge variant={a.status as 'proposed' | 'active' | 'law' | 'failed'}>
                    {statusLabel[a.status] ?? a.status}
                  </Badge>
                  {a.category && (
                    <span className="text-xs text-surface-400">{a.category}</span>
                  )}
                </div>
                <p className="text-sm text-surface-200 leading-snug line-clamp-3">
                  {a.statement}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={cn('text-3xl font-bold tabular-nums', priceColor(a.price, a.status))}>
                  {a.price}¢
                </p>
                <p className="text-xs text-surface-500 mt-0.5">consensus</p>
              </div>
            </div>

            {/* Momentum tags */}
            {signals.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {signals.map((s) => (
                  <SignalBadge key={s.label} label={s.label} color={s.color} />
                ))}
              </div>
            )}
          </motion.div>

          {/* Price statistics grid */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
              Price Statistics
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Current" value={`${a.price}¢`} />
              <StatCard
                label="All-Time High"
                value={`${a.price_high}¢`}
                accent="text-emerald"
              />
              <StatCard
                label="All-Time Low"
                value={`${a.price_low}¢`}
                accent="text-against-400"
              />
              <StatCard label="Open" value={`${a.price_open}¢`} sub="First snapshot" />
              <StatCard label="Mean" value={`${a.price_mean}¢`} sub="Average" />
              <StatCard label="Range" value={`${a.price_range}¢`} sub="High − Low" />
            </div>
          </motion.section>

          {/* Momentum */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
              Momentum
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-3 flex items-center gap-3">
                <div className={cn('flex items-center gap-1', deltaColor(a.momentum_7d))}>
                  <DeltaIcon delta={a.momentum_7d} />
                  <span className="text-xl font-bold tabular-nums">
                    {a.momentum_7d !== null
                      ? `${a.momentum_7d > 0 ? '+' : ''}${a.momentum_7d}¢`
                      : '—'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-surface-500">7-day change</p>
                </div>
              </div>
              <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-3 flex items-center gap-3">
                <div className={cn('flex items-center gap-1', deltaColor(a.momentum_30d))}>
                  <DeltaIcon delta={a.momentum_30d} />
                  <span className="text-xl font-bold tabular-nums">
                    {a.momentum_30d !== null
                      ? `${a.momentum_30d > 0 ? '+' : ''}${a.momentum_30d}¢`
                      : '—'}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-surface-500">30-day change</p>
                </div>
              </div>
            </div>

            {/* Trend bar */}
            {a.trend_direction !== 'neutral' && (
              <div className="mt-2 bg-surface-800/60 border border-surface-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-sm">
                    {a.trend_direction === 'bullish'
                      ? <TrendingUp className="h-4 w-4 text-emerald" />
                      : <TrendingDown className="h-4 w-4 text-against-400" />}
                    <span className={a.trend_direction === 'bullish' ? 'text-emerald' : 'text-against-400'}>
                      {a.trend_direction === 'bullish' ? 'Bullish' : 'Bearish'} trend
                    </span>
                  </span>
                  <span className="text-xs text-surface-500">{a.trend_strength}% strength</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-700">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      a.trend_direction === 'bullish' ? 'bg-emerald' : 'bg-against-500',
                    )}
                    style={{ width: `${a.trend_strength}%` }}
                  />
                </div>
              </div>
            )}
          </motion.section>

          {/* Volatility */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
              Volatility & Levels
            </h2>
            <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-300">Volatility Index</span>
                <span className={cn(
                  'text-sm font-semibold',
                  a.volatility_score > 60 ? 'text-purple'
                  : a.volatility_score > 30 ? 'text-gold'
                  : 'text-emerald',
                )}>
                  {a.volatility_score}/100
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    a.volatility_score > 60 ? 'bg-purple'
                    : a.volatility_score > 30 ? 'bg-gold'
                    : 'bg-emerald',
                  )}
                  style={{ width: `${a.volatility_score}%` }}
                />
              </div>
              <p className="text-xs text-surface-500">
                Std deviation: {a.price_std_dev}¢ across {a.snapshot_count} snapshots
              </p>

              {/* Support / Resistance */}
              {(a.support_level !== null || a.resistance_level !== null) && (
                <div className="pt-2 border-t border-surface-700/50 grid grid-cols-2 gap-3">
                  {a.resistance_level !== null && (
                    <div>
                      <p className="text-xs text-surface-500 mb-0.5">Resistance</p>
                      <p className="text-sm font-semibold text-against-300">{a.resistance_level}¢</p>
                    </div>
                  )}
                  {a.support_level !== null && (
                    <div>
                      <p className="text-xs text-surface-500 mb-0.5">Support</p>
                      <p className="text-sm font-semibold text-for-300">{a.support_level}¢</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          {/* Price distribution */}
          {a.snapshot_count > 5 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
                Price Distribution
              </h2>
              <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-4">
                <DistributionBar
                  distribution={a.price_distribution}
                  currentPrice={a.price}
                />
                <p className="text-xs text-surface-500 mt-3">
                  Based on {a.snapshot_count} historical snapshots
                </p>
              </div>
            </motion.section>
          )}

          {/* Voting velocity */}
          {a.velocity.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
                Voting Velocity (last 30 days)
              </h2>
              <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-4">
                <VelocityChart data={a.velocity} />
                <div className="flex items-center justify-between mt-2 text-xs text-surface-500">
                  <span>Daily avg: {a.daily_avg_votes.toLocaleString()} votes</span>
                  <span>Peak: {a.peak_daily_votes.toLocaleString()} votes</span>
                </div>
              </div>
            </motion.section>
          )}

          {/* Volume stats */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
              Volume
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Total Votes"
                value={a.total_votes.toLocaleString()}
                accent="text-for-300"
              />
              <StatCard
                label="Days Active"
                value={a.days_active.toLocaleString()}
              />
              <StatCard
                label="Daily Avg"
                value={a.daily_avg_votes.toLocaleString()}
                sub="votes/day"
              />
            </div>
          </motion.section>

          {/* Argument sentiment */}
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
              Argument Sentiment
            </h2>
            <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-for-400 font-medium">FOR ({a.for_argument_count})</span>
                <span className="text-against-400 font-medium">AGAINST ({a.against_argument_count})</span>
              </div>
              {/* Sentiment bar */}
              <div className="h-3 rounded-full bg-against-700/60 overflow-hidden relative">
                <div
                  className="h-full bg-for-500 rounded-full transition-all"
                  style={{ width: `${sentimentFavour}%` }}
                />
                <div
                  className="absolute inset-y-0 left-1/2 w-px bg-white/30"
                  style={{ transform: 'translateX(-50%)' }}
                />
              </div>
              <div className="flex justify-between text-xs text-surface-500">
                <span>Top FOR score: {a.top_for_score} upvotes</span>
                <span>Top AGAINST: {a.top_against_score} upvotes</span>
              </div>
            </div>
          </motion.section>

          {/* Category context */}
          {a.category_avg_price !== null && a.category_market_count !== null && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2.5">
                Category Context
              </h2>
              <div className="bg-surface-800/60 border border-surface-700/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-surface-300">
                      {a.category} average consensus
                    </p>
                    <p className="text-xs text-surface-500">
                      Across {a.category_market_count} active markets
                    </p>
                  </div>
                  <p className="text-xl font-bold text-surface-200 tabular-nums">
                    {a.category_avg_price}¢
                  </p>
                </div>
                {/* Comparison bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-surface-500">
                    <span>This market</span>
                    <span className={priceColor(a.price, a.status)}>{a.price}¢</span>
                  </div>
                  <div className="h-2 bg-surface-700 rounded-full overflow-hidden relative">
                    <div className="h-full bg-for-600 rounded-full" style={{ width: `${a.price}%` }} />
                    {/* Category avg marker */}
                    <div
                      className="absolute inset-y-0 w-0.5 bg-gold/80"
                      style={{ left: `${a.category_avg_price}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-surface-500">
                    <span>0¢</span>
                    <span className="text-gold/80">Avg {a.category_avg_price}¢</span>
                    <span>100¢</span>
                  </div>
                </div>
                <p className={cn('text-xs font-medium', a.price > a.category_avg_price ? 'text-emerald' : 'text-against-400')}>
                  {a.price > a.category_avg_price
                    ? `${a.price - a.category_avg_price}¢ above category average`
                    : `${a.category_avg_price - a.price}¢ below category average`}
                </p>
              </div>
            </motion.section>
          )}

          {/* Navigation footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="grid grid-cols-2 gap-2 pt-2"
          >
            <Link
              href={`/exchange/${id}`}
              className="flex items-center justify-center gap-2 bg-surface-800/60 border border-surface-700/50 rounded-xl p-3 text-sm text-surface-300 hover:text-white hover:border-surface-500 transition-all"
            >
              <Scale className="h-4 w-4" />
              Market Detail
            </Link>
            <Link
              href={`/exchange/${id}/orderbook`}
              className="flex items-center justify-center gap-2 bg-surface-800/60 border border-surface-700/50 rounded-xl p-3 text-sm text-surface-300 hover:text-white hover:border-surface-500 transition-all"
            >
              <BarChart2 className="h-4 w-4" />
              Order Book
            </Link>
          </motion.div>

        </div>
      </main>
      <BottomNav />
    </>
  )
}
