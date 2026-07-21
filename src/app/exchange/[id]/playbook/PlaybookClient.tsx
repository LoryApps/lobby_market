'use client'

/**
 * /exchange/[id]/playbook — Market Strategic Playbook
 *
 * A trading guide for each civic prediction market showing:
 *   • Market stage (Early → Building → Contested → Converging → Mature)
 *   • Price trend and recent momentum
 *   • Active trading signals (momentum, deadlock, near-law, etc.)
 *   • Key price levels with interpretation
 *   • Category benchmark from resolved markets
 *   • Similar resolved markets as historical context
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Gavel,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PlaybookData, MarketStage, TrendDirection, PlaybookSignal } from '@/app/api/exchange/[id]/playbook/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<MarketStage, {
  label: string
  description: string
  color: string
  bg: string
  border: string
  icon: typeof Activity
}> = {
  early: {
    label: 'Early Market',
    description: 'Price is still forming. Early votes have the most impact.',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    icon: Sparkles,
  },
  building: {
    label: 'Building',
    description: 'Trend emerging. Community starting to coalesce around a position.',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: TrendingUp,
  },
  contested: {
    label: 'Contested',
    description: 'Evenly split — debate quality will determine the outcome.',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Scale,
  },
  converging: {
    label: 'Converging',
    description: 'Market moving steadily toward resolution on one side.',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Target,
  },
  mature: {
    label: 'Mature',
    description: 'High volume, stable consensus. Needs a major catalyst to shift.',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: CheckCircle2,
  },
  law: {
    label: 'Established Law',
    description: 'Community has reached strong FOR consensus.',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Gavel,
  },
  failed: {
    label: 'Failed',
    description: 'AGAINST consensus was decisive. Market has resolved.',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    icon: ThumbsDown,
  },
}

const TREND_CONFIG: Record<TrendDirection, {
  label: string
  icon: typeof TrendingUp
  color: string
}> = {
  rising:   { label: 'Rising',   icon: TrendingUp,   color: 'text-emerald' },
  falling:  { label: 'Falling',  icon: TrendingDown, color: 'text-against-400' },
  flat:     { label: 'Flat',     icon: Minus,         color: 'text-surface-500' },
  volatile: { label: 'Volatile', icon: Activity,      color: 'text-gold' },
}

const SIGNAL_STRENGTH: Record<PlaybookSignal['strength'], string> = {
  strong:   'border-l-2 border-l-for-500',
  moderate: 'border-l-2 border-l-gold',
  weak:     'border-l-2 border-l-surface-400',
}

const SIGNAL_DIRECTION_COLOR: Record<PlaybookSignal['direction'], string> = {
  for:     'text-for-400',
  against: 'text-against-400',
  neutral: 'text-surface-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(v: number): string {
  return `${Math.round(v)}%`
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PlaybookSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-5 w-48 mb-2" />
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-36 mb-2" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      ))}
    </div>
  )
}

// ─── Price Sparkline ──────────────────────────────────────────────────────────

function PriceSparkline({
  snapshots,
}: {
  snapshots: Array<{ price: number }>
}) {
  if (snapshots.length < 2) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-surface-600 font-mono">
        Not enough data yet
      </div>
    )
  }
  const prices = snapshots.map((s) => s.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const w = 280
  const h = 56
  const pts = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * w
      const y = h - ((p - min) / range) * h
      return `${x},${y}`
    })
    .join(' ')
  const lastPrice = prices[prices.length - 1]
  const firstPrice = prices[0]
  const up = lastPrice >= firstPrice
  const stroke = up ? '#3b82f6' : '#ef4444'

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-14"
        aria-label="Price history sparkline"
        role="img"
      >
        <polyline
          points={pts}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Endpoint dot */}
        {prices.length > 0 && (() => {
          const lastX = w
          const lastY = h - ((lastPrice - min) / range) * h
          return (
            <circle cx={lastX} cy={lastY} r="3" fill={stroke} />
          )
        })()}
      </svg>
      <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
        <span>{pct(firstPrice)}</span>
        <span className={cn('font-semibold', up ? 'text-for-400' : 'text-against-400')}>
          {lastPrice > firstPrice ? '+' : ''}{pct(lastPrice - firstPrice)}
        </span>
        <span>{pct(lastPrice)}</span>
      </div>
    </div>
  )
}

// ─── Stage Badge ─────────────────────────────────────────────────────────────

function StageBadge({ stage }: { stage: MarketStage }) {
  const cfg = STAGE_CONFIG[stage]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border',
        cfg.color, cfg.bg, cfg.border,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

// ─── Signal Card ─────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: PlaybookSignal }) {
  const dirColor = SIGNAL_DIRECTION_COLOR[signal.direction]
  const borderClass = SIGNAL_STRENGTH[signal.strength]

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl bg-surface-200/60 border border-surface-300/60',
        borderClass,
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Zap className={cn('h-3.5 w-3.5 flex-shrink-0', dirColor)} aria-hidden="true" />
        <span className={cn('text-xs font-mono font-semibold', dirColor)}>{signal.label}</span>
        <span
          className={cn(
            'ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
            signal.strength === 'strong'
              ? 'text-for-300 border-for-500/30 bg-for-500/10'
              : signal.strength === 'moderate'
                ? 'text-gold border-gold/30 bg-gold/10'
                : 'text-surface-500 border-surface-400/30 bg-surface-300/20',
          )}
        >
          {signal.strength.toUpperCase()}
        </span>
      </div>
      <p className="text-xs text-surface-400 leading-relaxed">{signal.description}</p>
    </div>
  )
}

// ─── Price Level Row ──────────────────────────────────────────────────────────

function PriceLevelRow({
  level,
  current,
}: {
  level: { pct: number; label: string; description: string; color: string }
  current: number
}) {
  const dist = Math.abs(current - level.pct)
  const isNear = dist <= 7
  const colorMap: Record<string, { text: string; bar: string; ring: string }> = {
    emerald: { text: 'text-emerald', bar: 'bg-emerald', ring: 'ring-emerald/40' },
    for:     { text: 'text-for-400', bar: 'bg-for-500', ring: 'ring-for-500/40' },
    surface: { text: 'text-surface-400', bar: 'bg-surface-400', ring: 'ring-surface-400/40' },
    against: { text: 'text-against-400', bar: 'bg-against-500', ring: 'ring-against-500/40' },
  }
  const colors = colorMap[level.color] ?? colorMap.surface

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-colors',
        isNear
          ? 'bg-surface-200/80 border border-surface-300/80'
          : 'bg-surface-100/40 border border-surface-300/30',
      )}
    >
      {/* Level indicator bar */}
      <div className="flex-shrink-0 w-1 h-10 rounded-full bg-surface-300 relative overflow-hidden">
        <div className={cn('absolute bottom-0 left-0 right-0 rounded-full', colors.bar)}
          style={{ height: `${level.pct}%` }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-mono font-semibold', colors.text)}>
            {level.pct}¢
          </span>
          <span className="text-xs text-white font-medium">{level.label}</span>
          {isNear && (
            <span className={cn(
              'ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
              colors.text,
              `ring-1 ${colors.ring} bg-surface-200`,
            )}>
              NEAR
            </span>
          )}
        </div>
        <p className="text-[11px] text-surface-500 leading-relaxed">{level.description}</p>
      </div>

      {/* Current price indicator arrow */}
      {isNear && (
        <ArrowRight className={cn('h-3.5 w-3.5 flex-shrink-0', colors.text)} aria-hidden="true" />
      )}
    </div>
  )
}

// ─── Similar Resolved Row ─────────────────────────────────────────────────────

function SimilarMarketRow({
  market,
}: {
  market: PlaybookData['similar_resolved'][number]
}) {
  const isLaw = market.resolved_as === 'law'
  return (
    <Link
      href={`/exchange/${market.id}`}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl transition-colors group',
        'bg-surface-100/60 border',
        isLaw
          ? 'border-gold/20 hover:border-gold/40'
          : 'border-surface-300/60 hover:border-against-500/30',
      )}
    >
      <div
        className={cn(
          'flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center',
          isLaw ? 'bg-gold/10' : 'bg-against-500/10',
        )}
      >
        {isLaw ? (
          <Gavel className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs leading-snug line-clamp-2 transition-colors',
          isLaw
            ? 'text-white/90 group-hover:text-gold'
            : 'text-white/70 group-hover:text-against-300',
        )}>
          {market.statement}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn(
            'text-[10px] font-mono font-semibold',
            isLaw ? 'text-gold' : 'text-against-400',
          )}>
            {isLaw ? 'LAW' : 'FAILED'}
          </span>
          <span className="text-[10px] text-surface-600">·</span>
          <span className="text-[10px] font-mono text-surface-600">
            {market.final_price}¢ final
          </span>
          <span className="text-[10px] text-surface-600">·</span>
          <span className="text-[10px] font-mono text-surface-600">
            {fmt(market.total_votes)} votes
          </span>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 group-hover:text-white transition-colors" aria-hidden="true" />
    </Link>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PlaybookClientProps {
  marketId: string
  statement: string
}

export function PlaybookClient({ marketId, statement }: PlaybookClientProps) {
  const [data, setData] = useState<PlaybookData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/exchange/${marketId}/playbook`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as PlaybookData
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [marketId])

  useEffect(() => { load() }, [load])

  const price = data?.market.price ?? 50
  const trendCfg = data ? TREND_CONFIG[data.trend] : null
  const stageCfg = data ? STAGE_CONFIG[data.stage] : null
  const TrendIcon = trendCfg?.icon ?? Minus

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/exchange/${marketId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to market"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple flex-shrink-0" />
              Market Playbook
            </h1>
            <p className="text-xs text-surface-500 truncate mt-0.5">{statement}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <PlaybookSkeleton />}

        {error && !loading && (
          <EmptyState
            icon={BarChart2}
            title="Couldn't load playbook"
            message="There was a problem loading the strategic playbook for this market."
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* ── Market Overview Card ────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <StageBadge stage={data.stage} />
                {trendCfg && (
                  <div className={cn('flex items-center gap-1.5 text-xs font-mono', trendCfg.color)}>
                    <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{trendCfg.label}</span>
                    {data.trend_delta !== 0 && (
                      <span className="opacity-70">
                        ({data.trend_delta > 0 ? '+' : ''}{Math.round(data.trend_delta)}¢)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Consensus bar */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-for-400">{pct(price)} FOR</span>
                  <span className="text-against-400">{pct(100 - price)} AGAINST</span>
                </div>
                <div className="h-2.5 rounded-full bg-against-500/20 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-500"
                    style={{ width: `${price}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="bg-surface-200/60 rounded-xl py-2.5 px-2">
                  <div className="text-sm font-mono font-bold text-white">{fmt(data.market.volume)}</div>
                  <div className="text-[10px] text-surface-500 mt-0.5">Total Votes</div>
                </div>
                <div className="bg-surface-200/60 rounded-xl py-2.5 px-2">
                  <div className="text-sm font-mono font-bold text-for-400">{fmt(data.market.blue_votes)}</div>
                  <div className="text-[10px] text-surface-500 mt-0.5">For Votes</div>
                </div>
                <div className="bg-surface-200/60 rounded-xl py-2.5 px-2">
                  <div className="text-sm font-mono font-bold text-surface-400">{data.days_active}d</div>
                  <div className="text-[10px] text-surface-500 mt-0.5">Days Active</div>
                </div>
              </div>

              {/* Sparkline */}
              {data.recent_snapshots.length >= 2 ? (
                <div>
                  <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mb-2">
                    Price History
                  </p>
                  <PriceSparkline snapshots={data.recent_snapshots} />
                </div>
              ) : (
                <p className="text-xs text-surface-600 text-center py-2">
                  Price history will appear after more votes are cast.
                </p>
              )}
            </motion.section>

            {/* ── Active Signals ──────────────────────────────────────────── */}
            {data.signals.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-gold" />
                  Active Signals
                </h2>
                <div className="space-y-2.5">
                  {data.signals.map((sig) => (
                    <SignalCard key={sig.id} signal={sig} />
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── Key Price Levels ────────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-purple" />
                Key Price Levels
              </h2>
              <div className="space-y-2">
                {data.price_levels.map((level) => (
                  <PriceLevelRow key={level.pct} level={level} current={price} />
                ))}
              </div>
            </motion.section>

            {/* ── Category Benchmark ─────────────────────────────────────── */}
            {data.benchmark && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                  {data.benchmark.category} Benchmark
                </h2>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-surface-200/60 rounded-xl p-3">
                    <div className="text-lg font-mono font-bold text-for-400">
                      {Math.round(data.benchmark.law_rate * 100)}%
                    </div>
                    <div className="text-[11px] text-surface-500 mt-0.5">Resolve as Law</div>
                    <div className="text-[10px] text-surface-600 mt-0.5">
                      {data.benchmark.resolved_as_law}/{data.benchmark.total_resolved} in category
                    </div>
                  </div>
                  <div className="bg-surface-200/60 rounded-xl p-3">
                    <div className="text-lg font-mono font-bold text-white">
                      {fmt(data.benchmark.avg_resolution_votes)}
                    </div>
                    <div className="text-[11px] text-surface-500 mt-0.5">Avg Votes to Resolve</div>
                    <div className="text-[10px] text-surface-600 mt-0.5">
                      This market: {fmt(data.market.volume)}
                    </div>
                  </div>
                </div>

                {/* Law rate bar */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-surface-600">
                    <span>Law rate in {data.benchmark.category}</span>
                    <span>{Math.round(data.benchmark.law_rate * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full"
                      style={{ width: `${Math.round(data.benchmark.law_rate * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Context note */}
                <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">
                  Based on {data.benchmark.total_resolved} resolved {data.benchmark.category.toLowerCase()} markets.
                  {data.benchmark.law_rate >= 0.6
                    ? ' This is a high law-rate category — FOR positions historically win more often.'
                    : data.benchmark.law_rate <= 0.4
                      ? ' This is a high failure-rate category — AGAINST consensus often prevails.'
                      : ' This category is evenly contested — outcome depends heavily on argument quality.'}
                </p>
              </motion.section>
            )}

            {/* ── Stage Guide ─────────────────────────────────────────────── */}
            {stageCfg && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-emerald" />
                  Stage Guide
                </h2>

                {/* Stage timeline */}
                <div className="flex items-center gap-1 mb-4">
                  {(['early', 'building', 'contested', 'converging', 'mature'] as MarketStage[]).map((s, i) => {
                    const cfg = STAGE_CONFIG[s]
                    const StageIcon = cfg.icon
                    const isActive = s === data.stage
                    return (
                      <div key={s} className="flex items-center gap-1 flex-1">
                        <div className={cn(
                          'flex items-center justify-center rounded-full transition-all',
                          isActive
                            ? cn('h-7 w-7 ring-2 ring-offset-1 ring-offset-surface-100', cfg.bg, cfg.border)
                            : 'h-5 w-5 bg-surface-300/40',
                        )}>
                          <StageIcon
                            className={cn(
                              'transition-all',
                              isActive ? cn('h-3.5 w-3.5', cfg.color) : 'h-2.5 w-2.5 text-surface-600',
                            )}
                            aria-hidden="true"
                          />
                        </div>
                        {i < 4 && (
                          <div className="flex-1 h-px bg-surface-300/60" />
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className={cn(
                  'rounded-xl px-4 py-3 border',
                  stageCfg.bg, stageCfg.border,
                )}>
                  <p className={cn('text-xs font-semibold mb-1', stageCfg.color)}>
                    {stageCfg.label}
                  </p>
                  <p className="text-xs text-surface-400 leading-relaxed">
                    {stageCfg.description}
                  </p>
                </div>

                {/* Stage-specific tips */}
                {data.stage === 'early' && (
                  <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">
                    <span className="text-for-400 font-semibold">Tip:</span> Early-stage markets are most sensitive to new arguments.
                    Writing a well-cited, high-quality argument now can shift the consensus significantly.
                  </p>
                )}
                {data.stage === 'contested' && (
                  <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">
                    <span className="text-gold font-semibold">Tip:</span> Deadlocked markets are decided by argument quality.
                    Head to{' '}
                    <Link href={`/exchange/${marketId}/arguments`} className="text-gold hover:underline">
                      Arguments
                    </Link>{' '}
                    to see what&apos;s persuading voters.
                  </p>
                )}
                {data.stage === 'converging' && (
                  <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">
                    <span className="text-purple font-semibold">Tip:</span> The market is moving toward resolution.
                    Check the{' '}
                    <Link href={`/exchange/${marketId}/signal`} className="text-purple hover:underline">
                      Signal
                    </Link>{' '}
                    for momentum indicators.
                  </p>
                )}
                {data.stage === 'mature' && (
                  <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">
                    <span className="text-emerald font-semibold">Tip:</span> High-volume markets have stable consensus.
                    Look for catalysts in{' '}
                    <Link href={`/exchange/${marketId}/catalysts`} className="text-emerald hover:underline">
                      Catalysts
                    </Link>{' '}
                    that could shift momentum.
                  </p>
                )}
              </motion.section>
            )}

            {/* ── Similar Resolved Markets ────────────────────────────────── */}
            {data.similar_resolved.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5 text-gold" />
                  Similar Markets (Resolved)
                </h2>
                <div className="space-y-2">
                  {data.similar_resolved.map((market) => (
                    <SimilarMarketRow key={market.id} market={market} />
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── Quick Links ─────────────────────────────────────────────── */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ExternalLink className="h-3.5 w-3.5 text-surface-500" />
                Dig Deeper
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/exchange/${marketId}/signal`,   label: 'Signal',       desc: 'Multi-factor signal' },
                  { href: `/exchange/${marketId}/momentum`, label: 'Momentum',     desc: 'Price momentum' },
                  { href: `/exchange/${marketId}/steelman`, label: 'Steelman',     desc: 'Best arguments' },
                  { href: `/exchange/${marketId}/analysis`, label: 'Analysis',     desc: 'Statistical deep-dive' },
                  { href: `/exchange/${marketId}/forecast`, label: 'Forecast',     desc: 'Community predictions' },
                  { href: `/exchange/${marketId}/scorecard`,label: 'Scorecard',    desc: 'Prediction accuracy' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-for-400 transition-colors">
                        {link.label}
                      </p>
                      <p className="text-[10px] text-surface-600">{link.desc}</p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </motion.section>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
