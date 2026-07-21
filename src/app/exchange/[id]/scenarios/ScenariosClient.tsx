'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Flame,
  Gavel,
  GitMerge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ScenariosResponse,
  PriceMilestone,
  TimeProjection,
  ScenarioOutcome,
} from '@/app/api/exchange/[id]/scenarios/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<ScenarioOutcome, {
  label: string
  icon: typeof Gavel
  color: string
  bg: string
  border: string
}> = {
  law:       { label: 'Law',       icon: Gavel,        color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  contested: { label: 'Contested', icon: GitMerge,     color: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
  failed:    { label: 'Failed',    icon: XCircle,      color: 'text-against-400',bg: 'bg-against-500/10',border: 'border-against-500/30' },
  active:    { label: 'Active',    icon: Flame,        color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
}

const CONFIDENCE_CONFIG = {
  high:   { color: 'text-emerald',     label: 'High confidence' },
  medium: { color: 'text-gold',        label: 'Medium confidence' },
  low:    { color: 'text-surface-500', label: 'Low confidence' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status?: string): string {
  if (status === 'law')    return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  if (n >= 99_999)    return '99.9K+'
  return n.toLocaleString('en-US')
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ScenariosSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>

      {/* Milestones */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-5 w-40 mb-4" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
            <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Projections */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-5 w-44 mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 space-y-2">
              <Skeleton className="h-3 w-12 mx-auto" />
              <Skeleton className="h-8 w-14 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Price milestone card ─────────────────────────────────────────────────────

function MilestoneCard({
  milestone,
  currentPrice,
}: {
  milestone: PriceMilestone
  currentPrice: number
}) {
  const cfg = OUTCOME_CONFIG[milestone.outcome_hint]
  const Icon = cfg.icon
  const isCurrent = Math.abs(milestone.price - currentPrice) <= 2
  const isBelow = milestone.price < currentPrice

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative flex items-start gap-3 p-3.5 rounded-xl border transition-colors',
        isCurrent
          ? 'bg-for-500/10 border-for-500/40'
          : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60',
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border', cfg.bg, cfg.border)}>
        <Icon className={cn('h-4 w-4', cfg.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('font-mono text-sm font-bold', isBelow ? 'text-against-300' : 'text-for-300')}>
            {milestone.price}¢
          </span>
          <span className="text-xs text-surface-500 font-mono">{milestone.label}</span>
          {isCurrent && (
            <span className="text-[10px] font-mono font-semibold text-for-400 bg-for-500/15 border border-for-500/30 px-1.5 py-0.5 rounded">
              NEAR NOW
            </span>
          )}
        </div>
        <p className="text-[12px] text-surface-400 leading-relaxed mb-2">{milestone.description}</p>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', cfg.border.replace('border', 'bg').replace('/30', '/60'))}
              style={{ width: `${milestone.probability}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-surface-500 w-8 text-right">{milestone.probability}%</span>
        </div>

        {/* Votes needed */}
        {milestone.votes_needed < 99_000 && milestone.price > currentPrice && (
          <p className="text-[11px] font-mono text-surface-500 mt-1.5">
            ~{fmtVotes(milestone.votes_needed)} more FOR votes needed
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Time projection card ─────────────────────────────────────────────────────

function ProjectionCard({
  projection,
  currentPrice,
  status,
}: {
  projection: TimeProjection
  currentPrice: number
  status: string
}) {
  const delta = projection.projected_price - currentPrice
  const isUp = delta > 0
  const isFlat = delta === 0
  const cfg = CONFIDENCE_CONFIG[projection.confidence]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center p-4 rounded-xl bg-surface-200/60 border border-surface-300/60"
    >
      <div className="flex items-center gap-1 mb-2">
        <Calendar className="h-3 w-3 text-surface-500" />
        <span className="text-[11px] font-mono text-surface-500">{projection.label}</span>
      </div>

      <span className={cn('font-mono text-2xl font-bold', priceColor(projection.projected_price, status))}>
        {projection.projected_price}¢
      </span>

      <div className={cn('flex items-center gap-1 mt-1 text-xs font-mono', isFlat ? 'text-surface-500' : isUp ? 'text-for-400' : 'text-against-400')}>
        {isFlat ? null : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {isFlat ? 'Flat' : `${isUp ? '+' : ''}${delta}¢`}
      </div>

      <span className={cn('text-[10px] font-mono mt-2', cfg.color)}>{cfg.label}</span>
    </motion.div>
  )
}

// ─── Comparable market row ────────────────────────────────────────────────────

function ComparableRow({ market }: { market: ScenariosResponse['comparables'][number] }) {
  const statusColor =
    market.final_status === 'law' ? 'text-gold' :
    market.final_status === 'failed' ? 'text-against-400' :
    'text-for-400'

  const statusLabel =
    market.final_status === 'law' ? 'LAW' :
    market.final_status === 'failed' ? 'FAILED' :
    'ACTIVE'

  return (
    <Link
      href={`/exchange/${market.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/50 hover:border-surface-400/60 hover:bg-surface-200/70 transition-colors group"
    >
      <div className={cn('flex-shrink-0 mt-0.5 font-mono text-xs font-bold px-1.5 py-1 rounded-lg border',
        market.final_status === 'law' ? 'text-gold bg-gold/10 border-gold/30' :
        market.final_status === 'failed' ? 'text-against-400 bg-against-500/10 border-against-500/30' :
        'text-for-400 bg-for-500/10 border-for-500/30',
      )}>
        {Math.round(market.final_price)}¢
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
          {market.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn('text-[10px] font-mono font-semibold', statusColor)}>{statusLabel}</span>
          <span className="text-[10px] text-surface-600">·</span>
          <span className="text-[10px] font-mono text-surface-500">{fmtVotes(market.total_votes)} votes</span>
          <span className="text-[10px] text-surface-600">·</span>
          <span className="text-[10px] font-mono text-surface-600">{market.similarity_reason}</span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 self-center transition-colors" />
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ScenariosClient({ id }: { id: string }) {
  const [data, setData] = useState<ScenariosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/exchange/${id}/scenarios`)
      if (!res.ok) throw new Error('Failed')
      const json: ScenariosResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const price = data?.current_price ?? 50
  const momentum = data?.momentum_7d ?? null
  const isLaw = data?.status === 'law'
  const isFailed = data?.status === 'failed'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-12 space-y-4">

        {/* Back */}
        <Link
          href={`/exchange/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors font-mono"
        >
          <ArrowLeft className="h-4 w-4" />
          Market
        </Link>

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-4 w-4 text-purple" />
            <h1 className="font-mono text-sm font-semibold text-purple uppercase tracking-wider">
              What-If Scenarios
            </h1>
          </div>
          {loading ? (
            <Skeleton className="h-5 w-3/4" />
          ) : data ? (
            <h2 className="text-white font-semibold text-base leading-snug line-clamp-2">
              {data.statement}
            </h2>
          ) : null}
        </div>

        {/* Error */}
        {error && !loading && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto" />
            <p className="text-sm font-mono text-surface-400">Failed to load scenarios</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <ScenariosSkeleton />}

        {/* Content */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Summary card */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">Current Consensus</p>
                    <div className="flex items-baseline gap-2">
                      <span className={cn('font-mono text-4xl font-bold', priceColor(price, data.status))}>
                        {price}¢
                      </span>
                      {!isLaw && !isFailed && momentum !== null && (
                        <span className={cn('flex items-center gap-0.5 text-sm font-mono font-semibold',
                          momentum > 0 ? 'text-for-400' : momentum < 0 ? 'text-against-400' : 'text-surface-500'
                        )}>
                          {momentum > 0 ? <TrendingUp className="h-3 w-3" /> : momentum < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                          {momentum > 0 ? '+' : ''}{momentum}¢ / 7d
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-surface-500 mt-1">
                      {fmtVotes(data.current_volume)} votes cast
                    </p>
                  </div>

                  <div className="flex flex-col gap-1 text-right">
                    <span className={cn('text-[11px] font-mono font-semibold px-2 py-0.5 rounded border',
                      isLaw ? 'text-gold bg-gold/10 border-gold/30' :
                      isFailed ? 'text-against-400 bg-against-500/10 border-against-500/30' :
                      price >= 67 ? 'text-gold bg-gold/10 border-gold/30' :
                      price <= 33 ? 'text-against-400 bg-against-500/10 border-against-500/30' :
                      'text-for-400 bg-for-500/10 border-for-500/30'
                    )}>
                      {isLaw ? 'LAW' : isFailed ? 'FAILED' : price >= 67 ? 'NEAR LAW' : price <= 33 ? 'NEAR FAIL' : 'ACTIVE'}
                    </span>
                    {data.category && (
                      <span className="text-[10px] font-mono text-surface-500">{data.category}</span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-surface-400 leading-relaxed mt-4 border-t border-surface-300/50 pt-4">
                  {data.summary}
                </p>

                {/* Law / fail thresholds */}
                <div className="flex items-center gap-3 mt-4 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <Gavel className="h-3 w-3 text-gold" />
                    <span className="text-surface-500">Law at</span>
                    <span className="text-gold font-semibold">{data.law_threshold}¢</span>
                  </div>
                  <div className="h-3 w-px bg-surface-300/60" />
                  <div className="flex items-center gap-1.5">
                    <XCircle className="h-3 w-3 text-against-400" />
                    <span className="text-surface-500">Failure below</span>
                    <span className="text-against-400 font-semibold">{data.fail_threshold}¢</span>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={load}
                    aria-label="Refresh scenarios"
                    className="p-1 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-200 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Price milestones */}
              <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Coins className="h-4 w-4 text-gold" />
                  <h3 className="font-mono text-sm font-semibold text-white">Price Milestone Scenarios</h3>
                </div>
                <p className="text-xs text-surface-500 mb-4">
                  What reaching each consensus price would mean for this market&apos;s outcome.
                </p>
                <div className="space-y-2">
                  {data.milestones.map((m) => (
                    <MilestoneCard key={m.price} milestone={m} currentPrice={price} />
                  ))}
                </div>
              </section>

              {/* Time projections */}
              {!isLaw && !isFailed && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-purple" />
                    <h3 className="font-mono text-sm font-semibold text-white">Trajectory Projections</h3>
                  </div>
                  <p className="text-xs text-surface-500 mb-4">
                    Where this market is headed if recent momentum continues. Projections are model estimates, not guarantees.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {data.projections.map((p) => (
                      <ProjectionCard key={p.days} projection={p} currentPrice={price} status={data.status} />
                    ))}
                  </div>
                  {/* Narratives */}
                  <div className="space-y-2">
                    {data.projections.map((p) => (
                      <div key={p.days} className="flex gap-2 text-[12px] text-surface-400">
                        <span className="font-mono font-semibold text-surface-500 flex-shrink-0 w-14">{p.label}:</span>
                        <span>{p.narrative}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Volume impact */}
              <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-4 w-4 text-for-400" />
                  <h3 className="font-mono text-sm font-semibold text-white">Vote Impact Model</h3>
                </div>
                <p className="text-xs text-surface-500 mb-4">
                  How the next {fmtVotes(data.volume_impact.additional_for_votes)} votes would move the market, depending on which way they break.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {/* FOR scenario */}
                  <div className="p-4 rounded-xl bg-for-500/8 border border-for-500/25">
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-for-400" />
                      <span className="text-[11px] font-mono font-semibold text-for-400">All FOR</span>
                    </div>
                    <div className="font-mono text-2xl font-bold text-for-300 mb-1">
                      {data.volume_impact.new_price_for}¢
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-for-500">
                      <TrendingUp className="h-3 w-3" />
                      +{data.volume_impact.price_delta_for}¢
                    </div>
                    <p className="text-[11px] text-surface-500 mt-2 leading-relaxed">
                      {data.volume_impact.new_price_for >= data.law_threshold
                        ? 'Would cross the law threshold'
                        : `Would reach ${data.volume_impact.new_price_for}¢ FOR consensus`}
                    </p>
                  </div>

                  {/* AGAINST scenario */}
                  <div className="p-4 rounded-xl bg-against-500/8 border border-against-500/25">
                    <div className="flex items-center gap-1.5 mb-2">
                      <XCircle className="h-3.5 w-3.5 text-against-400" />
                      <span className="text-[11px] font-mono font-semibold text-against-400">All AGAINST</span>
                    </div>
                    <div className="font-mono text-2xl font-bold text-against-300 mb-1">
                      {data.volume_impact.new_price_against}¢
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-against-500">
                      <TrendingDown className="h-3 w-3" />
                      {data.volume_impact.price_delta_against}¢
                    </div>
                    <p className="text-[11px] text-surface-500 mt-2 leading-relaxed">
                      {data.volume_impact.new_price_against <= data.fail_threshold
                        ? 'Would enter failure territory'
                        : `Would drop to ${data.volume_impact.new_price_against}¢ FOR consensus`}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] font-mono text-surface-600 mt-3 text-center">
                  Based on {fmtVotes(data.current_volume)} existing votes
                </p>
              </section>

              {/* Comparable markets */}
              {data.comparables.length > 0 && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <GitMerge className="h-4 w-4 text-emerald" />
                    <h3 className="font-mono text-sm font-semibold text-white">Comparable Markets</h3>
                  </div>
                  <p className="text-xs text-surface-500 mb-4">
                    Markets with similar characteristics — see how analogous debates resolved.
                  </p>
                  <div className="space-y-2">
                    {data.comparables.map((c) => (
                      <ComparableRow key={c.id} market={c} />
                    ))}
                  </div>
                </section>
              )}

              {/* Footer nav */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Link
                  href={`/exchange/${id}/risk`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors"
                >
                  <Zap className="h-3 w-3" />
                  Risk Analysis
                </Link>
                <Link
                  href={`/exchange/${id}/model`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors"
                >
                  <BarChart2 className="h-3 w-3" />
                  Fair Value Model
                </Link>
                <Link
                  href={`/exchange/${id}/forecast`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors"
                >
                  <Flame className="h-3 w-3" />
                  Forecasts
                </Link>
                <Link
                  href={`/exchange/${id}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Market
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
