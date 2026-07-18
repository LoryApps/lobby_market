'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  Minus,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ForecastsResponse, MyForecast } from '@/app/api/exchange/forecasts/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function deltaColor(delta: number): string {
  if (Math.abs(delta) < 1) return 'text-surface-500'
  if (delta > 0) return 'text-emerald'
  return 'text-against-400'
}

function directionLabel(dir: MyForecast['direction']): string {
  if (dir === 'bullish') return 'Bullish'
  if (dir === 'bearish') return 'Bearish'
  return 'Neutral'
}

function directionBg(dir: MyForecast['direction']): string {
  if (dir === 'bullish') return 'bg-emerald/10 border-emerald/30 text-emerald'
  if (dir === 'bearish') return 'bg-against-500/10 border-against-500/30 text-against-300'
  return 'bg-surface-700/40 border-surface-600 text-surface-400'
}

function accuracyGrade(score: number): { label: string; color: string } {
  if (score >= 95) return { label: 'Spot on', color: 'text-gold' }
  if (score >= 85) return { label: 'Very close', color: 'text-emerald' }
  if (score >= 70) return { label: 'Close', color: 'text-for-400' }
  if (score >= 50) return { label: 'Off track', color: 'text-surface-400' }
  return { label: 'Wide miss', color: 'text-against-400' }
}

function confidenceStars(n: number): string {
  return '●'.repeat(n) + '○'.repeat(5 - n)
}

const HORIZON_LABEL: Record<string, string> = {
  '7d': '7d', '14d': '14d', '30d': '30d', '90d': '90d', '180d': '180d',
}

type SortMode = 'recent' | 'accuracy' | 'delta' | 'confidence'
type FilterMode = 'all' | 'bullish' | 'bearish' | 'neutral' | 'on_track' | 'off_track'

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string | number
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <p className="text-[11px] uppercase tracking-wider text-surface-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold font-mono', valueClass ?? 'text-white')}>{value}</p>
      {sub && <p className="text-xs text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Forecast row ─────────────────────────────────────────────────────────────

function ForecastRow({ f }: { f: MyForecast }) {
  const grade = accuracyGrade(f.accuracy_score)
  const isClosed = f.status === 'law' || f.status === 'failed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link
          href={`/exchange/${f.topic_id}/forecast`}
          className="flex-1 min-w-0 group"
        >
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {f.statement}
          </p>
        </Link>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={cn('text-xs font-mono font-bold', priceColor(f.current_price))}>
            {f.current_price}¢
          </span>
          <span className="text-[10px] text-surface-500 uppercase tracking-wide">
            {isClosed ? f.status : 'current'}
          </span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Direction badge */}
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border', directionBg(f.direction))}>
          {f.direction === 'bullish' ? (
            <TrendingUp className="h-3 w-3" />
          ) : f.direction === 'bearish' ? (
            <TrendingDown className="h-3 w-3" />
          ) : (
            <Minus className="h-3 w-3" />
          )}
          {directionLabel(f.direction)}
        </span>

        {/* Target price */}
        <span className="inline-flex items-center gap-1 text-[11px] text-surface-300 bg-surface-200 px-2 py-0.5 rounded-full border border-surface-400">
          <Target className="h-3 w-3 text-surface-500" />
          Target {f.target_price}¢
        </span>

        {/* Delta */}
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface-200 border border-surface-400', deltaColor(f.delta))}>
          {f.delta === 0 ? (
            <Minus className="h-3 w-3" />
          ) : f.delta > 0 ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )}
          {f.delta > 0 ? '+' : ''}{f.delta}¢
        </span>

        {/* Horizon */}
        <span className="inline-flex items-center gap-1 text-[11px] text-surface-400 bg-surface-200 px-2 py-0.5 rounded-full border border-surface-400">
          <Clock className="h-3 w-3" />
          {HORIZON_LABEL[f.horizon]}
        </span>

        {/* Category */}
        {f.category && (
          <Badge variant="category" className="text-[11px] py-0.5">
            {f.category}
          </Badge>
        )}
      </div>

      {/* Accuracy bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-[11px] font-medium', grade.color)}>{grade.label}</span>
          <span className="text-[11px] text-surface-500 font-mono">{f.accuracy_score}/100</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              f.accuracy_score >= 85 ? 'bg-emerald' :
              f.accuracy_score >= 70 ? 'bg-for-400' :
              f.accuracy_score >= 50 ? 'bg-surface-400' : 'bg-against-400',
            )}
            style={{ width: `${f.accuracy_score}%` }}
          />
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-surface-500 tracking-wider">
            {confidenceStars(f.confidence)}
          </span>
          {f.is_correct_direction ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald">
              <CheckCircle2 className="h-3 w-3" />
              Direction correct
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-against-300">
              <XCircle className="h-3 w-3" />
              Direction off
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-surface-500">{relTime(f.updated_at)}</span>
          <Link
            href={`/exchange/${f.topic_id}/forecast`}
            aria-label="Edit forecast"
            className="text-surface-500 hover:text-for-400 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Reasoning */}
      {f.reasoning && (
        <p className="mt-2 pt-2 border-t border-surface-300 text-xs text-surface-400 italic line-clamp-2">
          &ldquo;{f.reasoning}&rdquo;
        </p>
      )}
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ForecastsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-10" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ForecastsClient() {
  const [data, setData] = useState<ForecastsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortMode>('recent')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/forecasts')
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filter
  const filtered = (data?.forecasts ?? []).filter((f) => {
    if (filter === 'bullish') return f.direction === 'bullish'
    if (filter === 'bearish') return f.direction === 'bearish'
    if (filter === 'neutral') return f.direction === 'neutral'
    if (filter === 'on_track') return f.is_correct_direction
    if (filter === 'off_track') return !f.is_correct_direction
    return true
  })

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'accuracy') return b.accuracy_score - a.accuracy_score
    if (sort === 'delta') return Math.abs(b.delta) - Math.abs(a.delta)
    if (sort === 'confidence') return b.confidence - a.confidence
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  const stats = data?.stats

  return (
    <div className="flex flex-col min-h-screen bg-surface-900">
      <TopBar />

      <div className="flex-1 overflow-y-auto pb-24 pt-4">
        <div className="max-w-2xl mx-auto px-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link
                href="/exchange"
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-lg font-bold text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-for-400" />
                  My Forecasts
                </h1>
                <p className="text-xs text-surface-500">Your price target track record</p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-all disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Loading */}
          {loading && !data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                    <Skeleton className="h-3 w-16 mb-2" />
                    <Skeleton className="h-7 w-12" />
                  </div>
                ))}
              </div>
              <ForecastsSkeleton />
            </div>
          )}

          {/* Unauthenticated */}
          {!loading && data && !data.is_authenticated && (
            <EmptyState
              icon={Target}
              title="Sign in to view forecasts"
              description="Log in to track your price forecasts and see your accuracy over time."
              action={{ label: 'Sign in', href: '/auth/login' }}
            />
          )}

          {/* Authenticated — content */}
          {!loading && data && data.is_authenticated && (
            <div className="space-y-4">
              {/* Stats grid */}
              {stats && stats.total > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatTile
                    label="Forecasts"
                    value={stats.total}
                    sub="submitted"
                    valueClass="text-white"
                  />
                  <StatTile
                    label="Avg Accuracy"
                    value={`${stats.avg_accuracy}`}
                    sub="out of 100"
                    valueClass={
                      stats.avg_accuracy >= 85 ? 'text-emerald' :
                      stats.avg_accuracy >= 70 ? 'text-for-400' :
                      stats.avg_accuracy >= 50 ? 'text-surface-300' : 'text-against-400'
                    }
                  />
                  <StatTile
                    label="Direction Hit"
                    value={`${stats.correct_direction_pct}%`}
                    sub={`${stats.correct_direction}/${stats.total} correct`}
                    valueClass={stats.correct_direction_pct >= 60 ? 'text-emerald' : 'text-against-400'}
                  />
                  <StatTile
                    label="Within 5¢"
                    value={stats.within_5c}
                    sub={`${stats.total > 0 ? Math.round((stats.within_5c / stats.total) * 100) : 0}% of targets`}
                    valueClass="text-gold"
                  />
                </div>
              )}

              {/* Direction breakdown bar */}
              {stats && stats.total > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">Direction bias</span>
                    <span className="text-xs text-surface-500">
                      Avg confidence: {stats.avg_confidence.toFixed(1)}/5
                    </span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    {stats.bullish > 0 && (
                      <div
                        className="bg-emerald h-full"
                        style={{ width: `${(stats.bullish / stats.total) * 100}%` }}
                        title={`Bullish: ${stats.bullish}`}
                      />
                    )}
                    {stats.neutral > 0 && (
                      <div
                        className="bg-surface-400 h-full"
                        style={{ width: `${(stats.neutral / stats.total) * 100}%` }}
                        title={`Neutral: ${stats.neutral}`}
                      />
                    )}
                    {stats.bearish > 0 && (
                      <div
                        className="bg-against-400 h-full"
                        style={{ width: `${(stats.bearish / stats.total) * 100}%` }}
                        title={`Bearish: ${stats.bearish}`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-emerald">
                      <TrendingUp className="h-3 w-3" />
                      {stats.bullish} bullish
                    </span>
                    <span className="flex items-center gap-1 text-xs text-surface-400">
                      <Minus className="h-3 w-3" />
                      {stats.neutral} neutral
                    </span>
                    <span className="flex items-center gap-1 text-xs text-against-300">
                      <TrendingDown className="h-3 w-3" />
                      {stats.bearish} bearish
                    </span>
                  </div>
                </div>
              )}

              {/* Sort + filter controls */}
              {stats && stats.total > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Sort */}
                  <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
                    {(
                      [
                        { id: 'recent', label: 'Recent' },
                        { id: 'accuracy', label: 'Accuracy' },
                        { id: 'delta', label: 'Delta' },
                        { id: 'confidence', label: 'Confidence' },
                      ] as { id: SortMode; label: string }[]
                    ).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSort(s.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                          sort === s.id
                            ? 'bg-for-600 text-white'
                            : 'text-surface-400 hover:text-white',
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Filter toggle */}
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors',
                      showFilters
                        ? 'bg-for-600/20 border-for-500/40 text-for-300'
                        : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white',
                    )}
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    Filter
                    {filter !== 'all' && (
                      <span className="h-1.5 w-1.5 rounded-full bg-for-400" />
                    )}
                  </button>
                </div>
              )}

              {/* Filter chips */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2 pb-1">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'bullish', label: 'Bullish' },
                          { id: 'bearish', label: 'Bearish' },
                          { id: 'neutral', label: 'Neutral' },
                          { id: 'on_track', label: 'On Track' },
                          { id: 'off_track', label: 'Off Track' },
                        ] as { id: FilterMode; label: string }[]
                      ).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                          className={cn(
                            'px-3 py-1 rounded-full border text-xs font-medium transition-colors',
                            filter === f.id
                              ? 'bg-for-600 border-for-500 text-white'
                              : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty state — no forecasts yet */}
              {stats && stats.total === 0 && (
                <EmptyState
                  icon={Target}
                  title="No forecasts yet"
                  description="Submit price targets on individual markets to track your forecasting accuracy here."
                  action={{ label: 'Browse markets', href: '/exchange' }}
                />
              )}

              {/* Filtered empty */}
              {stats && stats.total > 0 && sorted.length === 0 && (
                <EmptyState
                  icon={Scale}
                  title="No forecasts match this filter"
                  description="Try a different filter to see your forecasts."
                  action={{ label: 'Show all', href: '#' }}
                />
              )}

              {/* Forecast list */}
              {sorted.length > 0 && (
                <div className="space-y-3">
                  {sorted.map((f) => (
                    <ForecastRow key={f.id} f={f} />
                  ))}
                </div>
              )}

              {/* Link to exchange */}
              {stats && stats.total > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-for-600/20 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-for-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Add more forecasts</p>
                      <p className="text-xs text-surface-500">Browse open markets</p>
                    </div>
                  </div>
                  <Link
                    href="/exchange"
                    className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors font-medium"
                  >
                    Exchange
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}

              {/* Performance link */}
              {stats && stats.total > 0 && (
                <Link
                  href="/exchange/performance"
                  className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-gold/10 flex items-center justify-center">
                      <Trophy className="h-4 w-4 text-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Full performance report</p>
                      <p className="text-xs text-surface-500">Brier score, calibration, win rate</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
