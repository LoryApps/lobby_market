'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronRight,
  Crown,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CrowdData, CohortStats, PredictorSnapshot } from '@/app/api/exchange/[id]/crowd/route'

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

function priceBorder(price: number, status: string): string {
  if (status === 'law') return 'border-gold/40 bg-gold/10'
  if (price >= 60) return 'border-for-500/40 bg-for-600/10'
  if (price <= 40) return 'border-against-500/40 bg-against-600/10'
  return 'border-surface-500/40 bg-surface-700/20'
}

function signalLabel(divergence: number): { label: string; color: string } {
  if (divergence > 10) return { label: 'Smart money MORE bullish than crowd', color: 'text-for-400' }
  if (divergence < -10) return { label: 'Smart money MORE bearish than crowd', color: 'text-against-400' }
  return { label: 'Smart money and crowd aligned', color: 'text-surface-400' }
}

function convictionLabel(conv: CrowdData['crowd_conviction']): { label: string; color: string; desc: string } {
  switch (conv) {
    case 'high': return {
      label: 'High Conviction',
      color: 'text-emerald',
      desc: 'Predictors cluster tightly — strong agreement on outcome',
    }
    case 'medium': return {
      label: 'Moderate Conviction',
      color: 'text-gold',
      desc: 'Some spread in predictions — uncertain but directional',
    }
    case 'low': return {
      label: 'Low Conviction',
      color: 'text-against-400',
      desc: 'Wide spread in predictions — market is genuinely uncertain',
    }
  }
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
}

// ─── Confidence Distribution Bar Chart ────────────────────────────────────────

function DistributionChart({ data, currentPrice }: {
  data: CrowdData['confidence_distribution']
  currentPrice: number
}) {
  const maxPct = Math.max(1, ...data.map((d) => d.pct))

  return (
    <div className="space-y-2" aria-label="Prediction confidence distribution">
      {data.map((bucket) => (
        <div key={bucket.label} className="flex items-center gap-3">
          <span className="w-16 text-xs text-surface-500 font-mono shrink-0">{bucket.label}</span>
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-5 bg-surface-800 rounded-sm overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(bucket.pct / maxPct) * 100}%` }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className={cn(
                  'h-full rounded-sm',
                  bucket.high <= 40
                    ? 'bg-against-600/70'
                    : bucket.low >= 60
                    ? 'bg-for-600/70'
                    : 'bg-surface-500/70',
                )}
              />
            </div>
            <span className="w-14 text-right text-xs text-surface-400 font-mono">
              {bucket.count} ({bucket.pct}%)
            </span>
          </div>
        </div>
      ))}
      {/* Current price marker */}
      <div className="flex items-center gap-3 mt-1">
        <span className="w-16 text-xs text-for-400 font-mono shrink-0 text-right">Price</span>
        <div className="flex-1 relative h-1">
          <div
            className="absolute h-4 w-0.5 bg-for-400 -top-1.5"
            style={{ left: `${currentPrice}%` }}
          />
          <div className="absolute top-2 text-[10px] text-for-400 font-mono"
            style={{ left: `${Math.min(currentPrice, 85)}%` }}>
            {currentPrice}¢
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Cohort Card ──────────────────────────────────────────────────────────────

function CohortCard({ cohort }: { cohort: CohortStats }) {
  const bullish = cohort.avg_confidence >= 50
  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3',
      cohort.cohort === 'smart_money'
        ? 'border-gold/30 bg-gold/5'
        : 'border-surface-700/60 bg-surface-800/60',
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {cohort.cohort === 'smart_money' && <Crown className="h-3.5 w-3.5 text-gold" />}
          {cohort.cohort === 'experienced' && <Zap className="h-3.5 w-3.5 text-for-400" />}
          {cohort.cohort === 'newcomer' && <Users className="h-3.5 w-3.5 text-surface-400" />}
          <span className="text-sm font-semibold text-white">{cohort.label}</span>
        </div>
        <Badge variant="surface" className="font-mono text-xs">{cohort.count} predictors</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-surface-500 mb-0.5">Avg Confidence</p>
          <p className={cn('text-2xl font-bold font-mono', bullish ? 'text-for-400' : 'text-against-400')}>
            {cohort.avg_confidence}¢
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-surface-500 mb-0.5">Predicting Law</p>
          <p className={cn('text-2xl font-bold font-mono', cohort.pct_predicting_law >= 50 ? 'text-for-400' : 'text-against-400')}>
            {cohort.pct_predicting_law}%
          </p>
        </div>
      </div>

      {cohort.avg_brier !== null && (
        <div className="pt-2 border-t border-surface-700/40">
          <p className="text-[11px] text-surface-500">
            Avg Brier Score: <span className="text-white font-mono">{cohort.avg_brier.toFixed(3)}</span>
            <span className="ml-1 text-surface-600">(lower = more accurate)</span>
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Predictor Row ────────────────────────────────────────────────────────────

function PredictorRow({ p, rank }: { p: PredictorSnapshot; rank: number }) {
  const bullish = p.confidence >= 50
  return (
    <Link
      href={`/profile/${p.username}`}
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-800/60 transition-colors group"
    >
      <span className="w-5 text-center text-xs text-surface-600 font-mono">{rank}</span>
      <Avatar src={p.avatar_url} fallback={p.display_name ?? p.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-white truncate group-hover:text-for-300 transition-colors">
            {p.display_name ?? p.username}
          </span>
          {p.clout >= 1000 && <Crown className="h-3 w-3 text-gold shrink-0" />}
          {p.correct === true && <CheckCircle2 className="h-3 w-3 text-emerald shrink-0" />}
          {p.correct === false && <XCircle className="h-3 w-3 text-against-400 shrink-0" />}
        </div>
        <p className="text-[11px] text-surface-500">{p.clout.toLocaleString()} Clout · @{p.username}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={cn('text-sm font-bold font-mono', bullish ? 'text-for-400' : 'text-against-400')}>
          {p.confidence}¢
        </p>
        <p className="text-[11px] text-surface-500">{p.predicted_law ? 'FOR' : 'AGAINST'}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CrowdSkeleton({ id }: { id: string }) {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/exchange/${id}`} className="text-surface-500 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CrowdClient({ id }: { id: string }) {
  const [data, setData] = useState<CrowdData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/exchange/${id}/crowd`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <CrowdSkeleton id={id} />

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
          <EmptyState icon={Users} title="Market not found" description="This market doesn't exist or has been removed." />
        </main>
        <BottomNav />
      </div>
    )
  }

  const divergence = data.prediction_vs_price
  const conviction = convictionLabel(data.crowd_conviction)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <Link
            href={`/exchange/${id}`}
            aria-label="Back to market"
            className="mt-0.5 text-surface-500 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-purple" />
              <span className="text-xs font-mono text-purple uppercase tracking-widest">Crowd Intelligence</span>
            </div>
            <h1 className="text-base font-semibold text-white leading-snug line-clamp-2">
              {data.statement}
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={STATUS_MAP[data.status] ?? 'surface'} className="text-xs">
                {data.status.toUpperCase()}
              </Badge>
              {data.category && (
                <span className="text-xs text-surface-500">{data.category}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh crowd data"
            className="mt-0.5 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-800 transition-colors disabled:opacity-40 shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Market price vs crowd signal ── */}
        <div className={cn('rounded-xl border p-4', priceBorder(data.price, data.status))}>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wide text-surface-500 mb-1">Market Price</p>
              <p className={cn('text-3xl font-bold font-mono', priceColor(data.price, data.status))}>
                {data.price}¢
              </p>
              <p className="text-[11px] text-surface-500 mt-0.5">{data.total_votes.toLocaleString()} votes</p>
            </div>
            <div className="text-center border-x border-surface-700/40">
              <p className="text-[11px] uppercase tracking-wide text-surface-500 mb-1">Crowd Signal</p>
              <p className={cn(
                'text-3xl font-bold font-mono',
                data.avg_confidence >= 55 ? 'text-for-400'
                : data.avg_confidence <= 45 ? 'text-against-400'
                : 'text-surface-300',
              )}>
                {data.avg_confidence}¢
              </p>
              <p className="text-[11px] text-surface-500 mt-0.5">{data.total_predictors} predictors</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-wide text-surface-500 mb-1">Divergence</p>
              <p className={cn(
                'text-3xl font-bold font-mono',
                divergence > 5 ? 'text-for-400'
                : divergence < -5 ? 'text-against-400'
                : 'text-surface-400',
              )}>
                {divergence > 0 ? '+' : ''}{divergence}¢
              </p>
              <p className="text-[11px] text-surface-500 mt-0.5">
                {divergence > 0 ? 'crowd more bullish' : divergence < 0 ? 'crowd more bearish' : 'aligned'}
              </p>
            </div>
          </div>

          {/* Crowd conviction pill */}
          <div className={cn(
            'mt-4 flex items-center gap-2 rounded-lg px-3 py-2 border',
            conviction.color === 'text-emerald' ? 'border-emerald/30 bg-emerald/10'
            : conviction.color === 'text-gold' ? 'border-gold/30 bg-gold/5'
            : 'border-against-700/40 bg-against-800/20',
          )}>
            <BarChart2 className={cn('h-3.5 w-3.5 shrink-0', conviction.color)} />
            <div>
              <span className={cn('text-xs font-semibold', conviction.color)}>{conviction.label}</span>
              <span className="text-[11px] text-surface-500 ml-2">{conviction.desc}</span>
            </div>
          </div>
        </div>

        {/* ── Signal divergence (smart money vs retail) ── */}
        {data.signal_divergence !== null && data.smart_money_signal !== null && data.retail_signal !== null && (
          <div className="rounded-xl border border-surface-700/60 bg-surface-900/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-white">Smart Money vs Retail</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-center">
                <Crown className="h-3.5 w-3.5 text-gold mx-auto mb-1" />
                <p className="text-[11px] text-surface-500 mb-1">Smart Money Signal</p>
                <p className={cn('text-2xl font-bold font-mono', data.smart_money_signal >= 50 ? 'text-for-400' : 'text-against-400')}>
                  {data.smart_money_signal}¢
                </p>
              </div>
              <div className="rounded-lg border border-surface-700/40 bg-surface-800/60 p-3 text-center">
                <Users className="h-3.5 w-3.5 text-surface-400 mx-auto mb-1" />
                <p className="text-[11px] text-surface-500 mb-1">Retail Signal</p>
                <p className={cn('text-2xl font-bold font-mono', data.retail_signal >= 50 ? 'text-for-400' : 'text-against-400')}>
                  {data.retail_signal}¢
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-surface-800/40 border border-surface-700/40 px-3 py-2">
              <div className={cn(
                'text-xs font-medium flex items-center gap-1.5',
                signalLabel(data.signal_divergence).color,
              )}>
                {data.signal_divergence > 0
                  ? <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                  : data.signal_divergence < 0
                  ? <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                  : <Scale className="h-3.5 w-3.5 shrink-0" />}
                {signalLabel(data.signal_divergence).label}
                <span className="ml-auto font-mono">
                  {data.signal_divergence > 0 ? '+' : ''}{data.signal_divergence}¢ gap
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Cohort breakdown ── */}
        {data.cohorts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="h-4 w-4 text-purple" />
              Predictor Cohorts
            </h2>
            <div className="grid gap-3">
              {data.cohorts.map((c) => (
                <CohortCard key={c.cohort} cohort={c} />
              ))}
            </div>
          </div>
        )}

        {/* ── Confidence distribution ── */}
        {data.confidence_distribution.some((b) => b.count > 0) && (
          <div className="rounded-xl border border-surface-700/60 bg-surface-900/60 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-for-400" />
              Prediction Distribution
              <span className="ml-auto text-[11px] text-surface-500 font-normal font-mono">
                {data.pct_predicting_law}% predicting FOR
              </span>
            </h2>
            <DistributionChart
              data={data.confidence_distribution}
              currentPrice={data.price}
            />
          </div>
        )}

        {/* ── No predictions empty state ── */}
        {data.total_predictors === 0 && (
          <EmptyState
            icon={Brain}
            title="No predictions yet"
            description="Be the first to make a formal prediction on this market."
          />
        )}

        {/* ── Top predictors ── */}
        {data.top_predictors.length > 0 && (
          <div className="rounded-xl border border-surface-700/60 bg-surface-900/60 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-700/60">
              <Crown className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-white">Top Predictors by Clout</h2>
            </div>
            <div className="divide-y divide-surface-800/60">
              {data.top_predictors.map((p, i) => (
                <PredictorRow key={p.id} p={p} rank={i + 1} />
              ))}
            </div>
            <div className="px-4 py-3 border-t border-surface-700/60">
              <Link
                href={`/exchange/${id}/leaderboard`}
                className="text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
              >
                View full leaderboard
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {/* ── Quick links ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: `/exchange/${id}/sentiment`, label: 'Sentiment', icon: TrendingUp },
            { href: `/exchange/${id}/analysis`, label: 'Analysis', icon: BarChart2 },
            { href: `/exchange/${id}/traders`, label: 'Traders', icon: Users },
            { href: `/exchange/${id}`, label: 'Market', icon: Scale },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl border border-surface-700/60 bg-surface-900/40 px-4 py-3 hover:border-surface-600/60 hover:bg-surface-800/60 transition-colors group"
            >
              <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              <span className="text-sm text-surface-300 group-hover:text-white transition-colors">{label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors ml-auto" />
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
