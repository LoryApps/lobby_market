'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gavel,
  Info,
  Minus,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
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
import type { ResolutionData, MandateStrength, TopForecaster } from '@/app/api/exchange/[id]/resolution/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-emerald'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function mandateBg(strength: MandateStrength, isLaw: boolean): string {
  if (isLaw) {
    if (strength === 'landslide') return 'bg-emerald/10 border-emerald/30'
    if (strength === 'strong')    return 'bg-for-900/40 border-for-700/40'
    if (strength === 'moderate')  return 'bg-for-900/30 border-for-800/30'
    return 'bg-for-950/20 border-for-900/20'
  } else {
    if (strength === 'landslide') return 'bg-against-950/60 border-against-600/40'
    if (strength === 'strong')    return 'bg-against-950/50 border-against-700/30'
    if (strength === 'moderate')  return 'bg-against-950/40 border-against-800/25'
    return 'bg-against-950/30 border-against-900/20'
  }
}

function brierGrade(score: number | null): { grade: string; color: string; label: string } {
  if (score === null) return { grade: '—', color: 'text-surface-500', label: 'No forecasts' }
  if (score <= 0.05)  return { grade: 'A+', color: 'text-emerald',     label: 'Exceptional' }
  if (score <= 0.10)  return { grade: 'A',  color: 'text-emerald',     label: 'Excellent' }
  if (score <= 0.15)  return { grade: 'B+', color: 'text-for-300',     label: 'Very good' }
  if (score <= 0.20)  return { grade: 'B',  color: 'text-for-400',     label: 'Good' }
  if (score <= 0.25)  return { grade: 'C',  color: 'text-gold',        label: 'Average' }
  if (score <= 0.30)  return { grade: 'D',  color: 'text-against-300', label: 'Below average' }
  return { grade: 'F', color: 'text-against-400', label: 'Poor' }
}

// ─── Mini price chart ─────────────────────────────────────────────────────────

interface PriceChartProps {
  snapshots: { recorded_at: string; price: number; volume: number }[]
  finalPrice: number
  status: string
}

function PriceChart({ snapshots, finalPrice, status }: PriceChartProps) {
  const WIDTH = 500
  const HEIGHT = 80
  const PAD = 4

  const all = useMemo(() => {
    const pts = [...snapshots]
    if (pts.length === 0) return [{ recorded_at: new Date().toISOString(), price: finalPrice, volume: 0 }]
    return pts
  }, [snapshots, finalPrice])

  const maxP = useMemo(() => Math.max(...all.map((s) => s.price), 55), [all])
  const minP = useMemo(() => Math.min(...all.map((s) => s.price), 45), [all])
  const rangeP = maxP - minP || 1

  const points = useMemo(
    () =>
      all.map((s, i) => {
        const x = PAD + (i / Math.max(1, all.length - 1)) * (WIDTH - PAD * 2)
        const y = PAD + ((maxP - s.price) / rangeP) * (HEIGHT - PAD * 2)
        return { x, y, price: s.price }
      }),
    [all, maxP, rangeP]
  )

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  // 50% line
  const y50 = PAD + ((maxP - 50) / rangeP) * (HEIGHT - PAD * 2)

  const lineColor =
    status === 'law'   ? '#10b981'
    : status === 'failed' ? '#ef4444'
    : finalPrice >= 55 ? '#3b82f6'
    : finalPrice <= 45 ? '#ef4444'
    : '#64748b'

  return (
    <div className="w-full overflow-hidden rounded-xl bg-surface-100/40 border border-surface-300/20 p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        aria-label="Market price history"
      >
        {/* 50% reference line */}
        {y50 > PAD && y50 < HEIGHT - PAD && (
          <line
            x1={PAD} y1={y50}
            x2={WIDTH - PAD} y2={y50}
            stroke="#475569"
            strokeWidth="0.8"
            strokeDasharray="4 3"
          />
        )}
        {/* Price line */}
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Final dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="4"
            fill={lineColor}
            stroke="#0f172a"
            strokeWidth="2"
          />
        )}
      </svg>
      <div className="flex justify-between mt-1 text-surface-600 text-[11px]">
        <span>Inception</span>
        <span className="text-surface-500">50¢ consensus line</span>
        <span>Resolution</span>
      </div>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color = 'text-surface-200',
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl bg-surface-100/40 border border-surface-300/20 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-surface-500" />}
        <p className="text-[11px] uppercase tracking-wider text-surface-500 font-medium">{label}</p>
      </div>
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Forecaster row ───────────────────────────────────────────────────────────

function ForecasterRow({
  f,
  rank,
  isResolved,
}: {
  f: TopForecaster
  rank: number
  isResolved: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300/10 last:border-0">
      {/* Rank */}
      <div className="w-5 text-center">
        {rank <= 3 ? (
          <Trophy className={cn('h-3.5 w-3.5 mx-auto',
            rank === 1 ? 'text-gold' : rank === 2 ? 'text-surface-400' : 'text-amber-600'
          )} />
        ) : (
          <span className="text-xs text-surface-600">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${f.username}`} className="flex-shrink-0">
        <Avatar src={f.avatar_url} fallback={f.display_name || f.username} size="sm" />
      </Link>

      {/* Name + direction */}
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${f.username}`} className="block">
          <p className="text-sm font-medium text-surface-100 truncate">
            {f.display_name || `@${f.username}`}
          </p>
          <p className="text-[11px] text-surface-500">@{f.username}</p>
        </Link>
      </div>

      {/* Direction */}
      <div className={cn(
        'flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border',
        f.direction === 'bullish'
          ? 'bg-for-900/30 border-for-800/30 text-for-300'
          : f.direction === 'bearish'
          ? 'bg-against-950/30 border-against-800/30 text-against-300'
          : 'bg-surface-300/20 border-surface-400/20 text-surface-400'
      )}>
        {f.direction === 'bullish' ? <TrendingUp className="h-2.5 w-2.5" /> :
         f.direction === 'bearish' ? <TrendingDown className="h-2.5 w-2.5" /> :
         <Minus className="h-2.5 w-2.5" />}
        {f.direction.charAt(0).toUpperCase() + f.direction.slice(1)}
      </div>

      {/* Target */}
      <div className="text-right">
        <p className="text-sm font-mono font-semibold text-surface-200">{f.forecast_target}¢</p>
        {isResolved && (
          <p className={cn('text-[10px]', f.error <= 5 ? 'text-emerald' : f.error <= 15 ? 'text-gold' : 'text-surface-500')}>
            ±{f.error}¢ off
          </p>
        )}
      </div>

      {/* Direction badge */}
      {isResolved && (
        <div className={cn(
          'w-5 flex-shrink-0 flex items-center justify-center',
          f.direction_correct === true  ? 'text-emerald'
          : f.direction_correct === false ? 'text-against-400'
          : 'text-surface-600'
        )}>
          {f.direction_correct === true  ? <CheckCircle2 className="h-4 w-4" /> :
           f.direction_correct === false ? <XCircle className="h-4 w-4" /> :
           <Minus className="h-4 w-4" />}
        </div>
      )}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface Props {
  id: string
}

export function ResolutionClient({ id }: Props) {
  const [data, setData] = useState<ResolutionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/resolution`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Failed to load resolution data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const isLaw = data?.topic.status === 'law'
  const isResolved = data?.is_resolved ?? false
  const finalPrice = data?.topic.final_price ?? 50
  const grade = brierGrade(data?.crowd.brier_score ?? null)

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-0">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-16 pb-32">
          <EmptyState
            icon={AlertCircle}
            title="Resolution unavailable"
            description={error ?? 'Could not load market resolution data.'}
            action={{ label: 'Retry', onClick: load }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, crowd, top_forecasters, forecast_stats, price_history, lifecycle } = data

  return (
    <div className="min-h-screen bg-surface-0">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-5">

        {/* ── Back nav ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Market
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm text-surface-300 font-medium">Resolution</span>
        </div>

        {/* ── Topic header ──────────────────────────────────────────────── */}
        <div>
          <p className="text-xs uppercase tracking-wider text-surface-500 font-medium mb-1">
            {topic.category ?? 'Market'} · Resolution Summary
          </p>
          <h1 className="text-xl font-semibold text-surface-100 leading-snug">
            {topic.statement}
          </h1>
        </div>

        {/* ── Resolution verdict ────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {isResolved ? (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-5',
                mandateBg(crowd.mandate_strength, isLaw)
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-xl',
                  isLaw ? 'bg-emerald/15' : 'bg-against-900/40'
                )}>
                  {isLaw
                    ? <Gavel className="h-6 w-6 text-emerald" />
                    : <XCircle className="h-6 w-6 text-against-400" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'text-lg font-bold',
                      isLaw ? 'text-emerald' : 'text-against-400'
                    )}>
                      {isLaw ? 'PASSED' : 'FAILED'}
                    </span>
                    <Badge variant={isLaw ? 'law' : 'failed'}>
                      {crowd.mandate_label}
                    </Badge>
                  </div>
                  <p className="text-sm text-surface-400 mt-1">
                    Final consensus: <span className={cn('font-semibold', priceColor(finalPrice, topic.status))}>
                      {finalPrice}¢
                    </span>
                    {' '}— {isLaw ? `${finalPrice}% for, ${100 - finalPrice}% against` : `${100 - finalPrice}% against, ${finalPrice}% for`}
                  </p>
                  {topic.resolution_at && (
                    <p className="text-xs text-surface-500 mt-1">
                      Resolved {fmtDate(topic.resolution_at)} · {lifecycle.days_active}d active
                    </p>
                  )}
                </div>
              </div>

              {/* Mandate bar */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-surface-500 mb-1.5">
                  <span>Against · {100 - finalPrice}%</span>
                  <span>For · {finalPrice}%</span>
                </div>
                <div className="h-3 rounded-full bg-against-900/60 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${finalPrice}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
                    className={cn(
                      'h-full rounded-full',
                      isLaw ? 'bg-emerald' : 'bg-against-600'
                    )}
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-surface-300/20 bg-surface-100/30 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10">
                  <Clock className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <p className="font-semibold text-surface-200">Resolution Pending</p>
                  <p className="text-sm text-surface-500 mt-0.5">
                    Current consensus: <span className={cn('font-semibold', priceColor(finalPrice, topic.status))}>
                      {finalPrice}¢
                    </span>
                    {' '}· {lifecycle.days_active}d active
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Key stats grid ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Total votes"
            value={topic.total_votes.toLocaleString()}
            sub={`${topic.blue_votes} for · ${topic.red_votes} against`}
            icon={Users}
          />
          {isResolved && crowd.accuracy_pct !== null ? (
            <StatTile
              label="Crowd accuracy"
              value={`${crowd.accuracy_pct}%`}
              sub={`${crowd.correct_votes.toLocaleString()} voters were right`}
              color={crowd.accuracy_pct >= 70 ? 'text-emerald' : crowd.accuracy_pct >= 55 ? 'text-for-400' : 'text-against-300'}
              icon={Target}
            />
          ) : (
            <StatTile
              label="Confidence"
              value={`${Math.abs(finalPrice - 50)}¢`}
              sub={finalPrice >= 50 ? 'Above neutral' : 'Below neutral'}
              icon={BarChart2}
            />
          )}
          <StatTile
            label="Price range"
            value={lifecycle.price_range !== null ? `${lifecycle.price_range}¢` : '—'}
            sub={lifecycle.peak_price !== null && lifecycle.trough_price !== null
              ? `${lifecycle.trough_price}¢ – ${lifecycle.peak_price}¢`
              : 'Insufficient data'}
            icon={TrendingUp}
          />
          <StatTile
            label="Days active"
            value={String(lifecycle.days_active)}
            sub={topic.created_at ? `Since ${fmtDate(topic.created_at)}` : undefined}
            icon={Clock}
          />
        </div>

        {/* ── Price history chart ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300/20 bg-surface-100/20 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-surface-400" />
            <h2 className="font-semibold text-surface-200 text-sm">Consensus Journey</h2>
            {price_history.length === 0 && (
              <span className="ml-auto text-xs text-surface-600">No snapshots yet</span>
            )}
          </div>
          <PriceChart
            snapshots={price_history}
            finalPrice={finalPrice}
            status={topic.status}
          />
        </div>

        {/* ── Forecast scorecard ────────────────────────────────────────── */}
        {forecast_stats.total > 0 && (
          <div className="rounded-2xl border border-surface-300/20 bg-surface-100/20 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-surface-400" />
              <h2 className="font-semibold text-surface-200 text-sm">Forecaster Scorecard</h2>
              <span className="ml-auto text-xs text-surface-500">{forecast_stats.total} forecasters</span>
            </div>

            {/* Forecast distribution */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-for-900/30 border border-for-800/20 p-2.5">
                <TrendingUp className="h-4 w-4 text-for-300 mx-auto mb-1" />
                <p className="text-lg font-bold text-for-300">{forecast_stats.bullish_count}</p>
                <p className="text-[10px] text-surface-500">Bullish</p>
              </div>
              <div className="rounded-lg bg-surface-300/20 border border-surface-400/20 p-2.5">
                <Minus className="h-4 w-4 text-surface-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-surface-300">{forecast_stats.neutral_count}</p>
                <p className="text-[10px] text-surface-500">Neutral</p>
              </div>
              <div className="rounded-lg bg-against-950/40 border border-against-800/20 p-2.5">
                <TrendingDown className="h-4 w-4 text-against-300 mx-auto mb-1" />
                <p className="text-lg font-bold text-against-300">{forecast_stats.bearish_count}</p>
                <p className="text-[10px] text-surface-500">Bearish</p>
              </div>
            </div>

            {/* Median target */}
            {forecast_stats.median_target !== null && (
              <div className="flex items-center justify-between py-2 border-t border-surface-300/10">
                <span className="text-xs text-surface-500">Crowd median target</span>
                <span className={cn('text-sm font-semibold font-mono', priceColor(forecast_stats.median_target, topic.status))}>
                  {forecast_stats.median_target}¢
                </span>
              </div>
            )}

            {/* Brier score + accuracy (resolved only) */}
            {isResolved && (
              <>
                {crowd.brier_score !== null && (
                  <div className="flex items-center justify-between py-2 border-t border-surface-300/10">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-surface-500">Brier score</span>
                      <Info className="h-3 w-3 text-surface-600" title="Lower = better calibration (0 is perfect)" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-lg font-bold', grade.color)}>{grade.grade}</span>
                      <span className="text-xs text-surface-500">{grade.label} ({crowd.brier_score.toFixed(3)})</span>
                    </div>
                  </div>
                )}
                {forecast_stats.forecast_accuracy_pct !== null && (
                  <div className="flex items-center justify-between py-2 border-t border-surface-300/10">
                    <span className="text-xs text-surface-500">Forecasters directionally correct</span>
                    <span className={cn('text-sm font-semibold',
                      forecast_stats.forecast_accuracy_pct >= 70 ? 'text-emerald'
                      : forecast_stats.forecast_accuracy_pct >= 50 ? 'text-for-400'
                      : 'text-against-300'
                    )}>
                      {forecast_stats.forecast_accuracy_pct}%
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Top forecasters ───────────────────────────────────────────── */}
        {top_forecasters.length > 0 && (
          <div className="rounded-2xl border border-surface-300/20 bg-surface-100/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-semibold text-surface-200 text-sm">
                {isResolved ? 'Top Forecasters' : 'Leading Forecasters'}
              </h2>
              <span className="ml-auto text-xs text-surface-500">
                {isResolved ? 'by accuracy' : 'by confidence'}
              </span>
            </div>

            <div>
              {top_forecasters.map((f, i) => (
                <ForecasterRow
                  key={f.username}
                  f={f}
                  rank={i + 1}
                  isResolved={isResolved}
                />
              ))}
            </div>

            {forecast_stats.total > 10 && (
              <Link
                href={`/exchange/${id}/forecast`}
                className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-surface-300/10 text-sm text-surface-400 hover:text-surface-200 transition-colors"
              >
                View all {forecast_stats.total} forecasters
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}

        {/* ── Resolution context (resolved only) ───────────────────────── */}
        {isResolved && (
          <div className="rounded-2xl border border-surface-300/20 bg-surface-100/20 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-surface-400" />
              <h2 className="font-semibold text-surface-200 text-sm">Resolution Context</h2>
            </div>

            <div className="space-y-2">
              {/* Was the crowd right? */}
              <div className={cn(
                'flex items-start gap-3 rounded-xl p-3 border',
                crowd.crowd_was_right
                  ? 'bg-emerald/5 border-emerald/20'
                  : 'bg-against-950/30 border-against-800/20'
              )}>
                {crowd.crowd_was_right
                  ? <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />}
                <p className="text-sm text-surface-300">
                  {crowd.crowd_was_right
                    ? `The crowd called it. With ${finalPrice}¢ consensus, ${crowd.crowd_was_right ? 'the majority backed the winning side' : 'consensus leaned wrong'}.`
                    : `The crowd was surprised. At ${finalPrice}¢, the majority ${isLaw ? 'underestimated' : 'overestimated'} the probability of passage.`}
                </p>
              </div>

              {/* Mandate summary */}
              <div className="flex items-start gap-3 rounded-xl bg-surface-100/20 border border-surface-300/10 p-3">
                <Shield className="h-4 w-4 text-surface-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-surface-400">
                  {crowd.mandate_label}
                  {' '}— {isLaw
                    ? `${finalPrice}¢ final consensus on a scale where 50¢ is neutral`
                    : `only ${finalPrice}¢ for-support in a market where passage requires majority`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Related links ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: `/exchange/${id}`, label: 'Market overview', icon: BarChart2 },
            { href: `/exchange/${id}/timeline`, label: 'Full timeline', icon: Clock },
            { href: `/exchange/${id}/leaderboard`, label: 'Vote leaderboard', icon: Trophy },
            { href: `/exchange/${id}/analysis`, label: 'Market analysis', icon: Zap },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl border border-surface-300/20 bg-surface-100/20 p-3 text-sm text-surface-300 hover:text-surface-100 hover:bg-surface-100/30 transition-all group"
            >
              <Icon className="h-4 w-4 text-surface-500 group-hover:text-surface-300 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400" />
            </Link>
          ))}
        </div>

        {/* ── Refresh ───────────────────────────────────────────────────── */}
        <div className="flex justify-center pt-2">
          <button
            onClick={load}
            className="flex items-center gap-2 text-xs text-surface-600 hover:text-surface-400 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh data
          </button>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
