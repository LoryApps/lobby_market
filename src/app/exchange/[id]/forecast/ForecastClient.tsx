'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Minus,
  RefreshCw,
  Scale,
  Send,
  Target,
  TrendingDown,
  TrendingUp,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { ForecastResponse, ForecastEntry, ForecastStats } from '@/app/api/exchange/[id]/forecast/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function directionBg(dir: ForecastEntry['direction']): string {
  if (dir === 'bullish') return 'bg-emerald/10 border-emerald/30 text-emerald'
  if (dir === 'bearish') return 'bg-against-500/10 border-against-500/30 text-against-300'
  return 'bg-surface-700/40 border-surface-600 text-surface-400'
}

function DirectionIcon({ dir }: { dir: ForecastEntry['direction'] }) {
  if (dir === 'bullish') return <TrendingUp className="h-3.5 w-3.5" />
  if (dir === 'bearish') return <TrendingDown className="h-3.5 w-3.5" />
  return <Minus className="h-3.5 w-3.5" />
}

function DeltaArrow({ current, target }: { current: number; target: number }) {
  const diff = target - current
  if (Math.abs(diff) < 1) return <Minus className="h-3.5 w-3.5 text-surface-500" />
  if (diff > 0) return <ArrowUp className="h-3.5 w-3.5 text-emerald" />
  return <ArrowDown className="h-3.5 w-3.5 text-against-400" />
}

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

const HORIZON_LABEL: Record<string, string> = {
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '90d': '3 months',
  '180d': '6 months',
}

const CONFIDENCE_LABEL: Record<number, string> = {
  1: 'Low',
  2: 'Slightly Low',
  3: 'Medium',
  4: 'High',
  5: 'Very High',
}

// ─── Distribution Bar Chart ───────────────────────────────────────────────────

function DistributionChart({
  distribution,
  currentPrice,
  medianTarget,
}: {
  distribution: ForecastStats['distribution']
  currentPrice: number
  medianTarget: number
}) {
  const maxCount = Math.max(1, ...distribution.map((b) => b.count))

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-0.5 h-24">
        {distribution.map((bucket) => {
          const height = bucket.count > 0 ? Math.max(4, (bucket.count / maxCount) * 100) : 0
          const isCurrent = currentPrice >= bucket.min && currentPrice < bucket.max
          const isMedian = medianTarget >= bucket.min && medianTarget < bucket.max
          return (
            <div
              key={bucket.bucket}
              className="flex-1 flex flex-col items-center justify-end gap-0.5"
              title={`${bucket.bucket}¢: ${bucket.count} forecast${bucket.count !== 1 ? 's' : ''}`}
            >
              <div
                className={cn(
                  'w-full rounded-t-sm transition-all',
                  isMedian
                    ? 'bg-purple'
                    : isCurrent
                    ? 'bg-for-500/60'
                    : bucket.count > 0
                    ? 'bg-surface-500'
                    : 'bg-surface-700/40'
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          )
        })}
      </div>
      {/* X-axis labels — only a few */}
      <div className="flex items-center">
        {distribution.map((b, i) => (
          <div key={b.bucket} className="flex-1 text-center">
            {i % 2 === 0 && (
              <span className="text-[9px] font-mono text-surface-600">{b.min}</span>
            )}
          </div>
        ))}
        <div className="text-[9px] font-mono text-surface-600">100</div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-for-500/60" />
          <span className="text-[10px] text-surface-500">Current ({currentPrice}¢)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-purple" />
          <span className="text-[10px] text-surface-500">Median target ({medianTarget}¢)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Confidence Dots ──────────────────────────────────────────────────────────

function ConfidenceDots({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <div
          key={n}
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            n <= value ? 'bg-gold' : 'bg-surface-600'
          )}
        />
      ))}
    </div>
  )
}

// ─── Forecast Card ────────────────────────────────────────────────────────────

function ForecastCard({
  forecast,
  currentPrice,
  isOwn,
  onDelete,
}: {
  forecast: ForecastEntry
  currentPrice: number
  isOwn: boolean
  onDelete?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const diff = forecast.target_price - currentPrice

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-3 transition-colors',
        isOwn
          ? 'bg-purple/5 border-purple/30'
          : 'bg-surface-200/60 border-surface-300/60'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link href={`/profile/${forecast.username}`} className="flex-shrink-0">
          <Avatar
            src={forecast.avatar_url}
            fallback={forecast.display_name || forecast.username}
            size="sm"
          />
        </Link>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Top row: name + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <Link
              href={`/profile/${forecast.username}`}
              className="text-xs font-semibold text-white hover:text-surface-200 transition-colors truncate"
            >
              {forecast.display_name || `@${forecast.username}`}
            </Link>
            {isOwn && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple/20 text-purple border border-purple/30">
                you
              </span>
            )}
            <span
              className={cn(
                'flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border',
                directionBg(forecast.direction)
              )}
            >
              <DirectionIcon dir={forecast.direction} />
              {forecast.direction}
            </span>
          </div>

          {/* Price target row */}
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              <span className={cn('text-base font-mono font-bold', priceColor(forecast.target_price))}>
                {forecast.target_price}¢
              </span>
              <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
                <DeltaArrow current={currentPrice} target={forecast.target_price} />
                <span
                  className={
                    diff > 0 ? 'text-emerald' : diff < 0 ? 'text-against-300' : 'text-surface-500'
                  }
                >
                  {diff > 0 ? '+' : ''}{diff}¢
                </span>
              </span>
            </div>
            <span className="text-[10px] text-surface-500 font-mono">
              in {HORIZON_LABEL[forecast.horizon] ?? forecast.horizon}
            </span>
          </div>

          {/* Confidence + time */}
          <div className="flex items-center gap-3">
            <ConfidenceDots value={forecast.confidence} />
            <span className="text-[10px] text-surface-600 font-mono">
              {CONFIDENCE_LABEL[forecast.confidence]} confidence
            </span>
            <span className="ml-auto text-[10px] text-surface-600">
              {relTime(forecast.updated_at)}
            </span>
          </div>

          {/* Reasoning (expandable) */}
          {forecast.reasoning && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
              >
                {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                {expanded ? 'Hide' : 'Show'} reasoning
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 text-xs text-surface-400 leading-relaxed overflow-hidden"
                  >
                    {forecast.reasoning}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Delete button for own forecast */}
        {isOwn && onDelete && (
          <button
            onClick={onDelete}
            className="flex-shrink-0 p-1.5 rounded-lg text-surface-600 hover:text-against-400 hover:bg-against-500/10 transition-all"
            title="Remove your forecast"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Submit Form ──────────────────────────────────────────────────────────────

function SubmitForm({
  id,
  currentPrice,
  initial,
  onSuccess,
  onCancel,
}: {
  id: string
  currentPrice: number
  initial: ForecastEntry | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const [targetPrice, setTargetPrice] = useState(initial?.target_price ?? currentPrice)
  const [horizon, setHorizon] = useState<ForecastEntry['horizon']>(initial?.horizon ?? '30d')
  const [confidence, setConfidence] = useState(initial?.confidence ?? 3)
  const [reasoning, setReasoning] = useState(initial?.reasoning ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    // Auto-detect direction from price vs current
    const autoDir = targetPrice > currentPrice + 2
      ? 'bullish'
      : targetPrice < currentPrice - 2
      ? 'bearish'
      : 'neutral'

    const payload = {
      target_price: targetPrice,
      direction: autoDir,
      horizon,
      confidence,
      reasoning: reasoning.trim() || null,
    }

    const res = await fetch(`/api/exchange/${id}/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSaving(false)
    if (!res.ok) {
      setError('Failed to save forecast. Please try again.')
      return
    }
    onSuccess()
  }

  const diff = targetPrice - currentPrice

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-purple/30 bg-purple/5 p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          {initial ? 'Update your forecast' : 'Add your forecast'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Price slider */}
      <div className="space-y-2">
        <label className="text-xs font-mono text-surface-400">
          Price target in {HORIZON_LABEL[horizon] ?? horizon}
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            value={targetPrice}
            onChange={(e) => setTargetPrice(parseInt(e.target.value))}
            className="flex-1 accent-purple cursor-pointer"
          />
          <span className={cn('text-xl font-mono font-bold w-14 text-right', priceColor(targetPrice))}>
            {targetPrice}¢
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
          <span>Current: {currentPrice}¢</span>
          <span
            className={cn(
              'flex items-center gap-0.5',
              diff > 0 ? 'text-emerald' : diff < 0 ? 'text-against-300' : 'text-surface-500'
            )}
          >
            {diff > 0 ? <ArrowUp className="h-3 w-3" /> : diff < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {diff > 0 ? '+' : ''}{diff}¢
          </span>
        </div>
      </div>

      {/* Horizon */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono text-surface-400">Time horizon</label>
        <div className="flex gap-1.5 flex-wrap">
          {(['7d', '14d', '30d', '90d', '180d'] as const).map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-mono border transition-all',
                horizon === h
                  ? 'bg-purple/20 border-purple/50 text-purple'
                  : 'bg-surface-700/40 border-surface-600 text-surface-500 hover:border-surface-500'
              )}
            >
              {HORIZON_LABEL[h]}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono text-surface-400">
          Confidence — {CONFIDENCE_LABEL[confidence]}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={5}
            value={confidence}
            onChange={(e) => setConfidence(parseInt(e.target.value))}
            className="flex-1 accent-gold cursor-pointer"
          />
          <ConfidenceDots value={confidence} />
        </div>
      </div>

      {/* Reasoning */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono text-surface-400">
          Reasoning <span className="text-surface-600">(optional)</span>
        </label>
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value.slice(0, 500))}
          placeholder="Why do you think the market will move here?"
          rows={3}
          className={cn(
            'w-full bg-surface-700/60 border border-surface-600 rounded-lg px-3 py-2',
            'text-sm text-white placeholder:text-surface-600',
            'focus:outline-none focus:border-purple/60 focus:bg-surface-700/80',
            'resize-none transition-colors'
          )}
        />
        <div className="text-right text-[10px] text-surface-600 font-mono">
          {reasoning.length}/500
        </div>
      </div>

      {error && (
        <p className="text-xs text-against-400 bg-against-500/10 border border-against-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {initial ? 'Update forecast' : 'Submit forecast'}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm font-medium text-surface-400 hover:text-surface-200 border border-surface-600 hover:border-surface-500 transition-all"
        >
          Cancel
        </button>
      </div>
    </motion.form>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function ForecastClient({ id }: { id: string }) {
  const [data, setData] = useState<ForecastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/exchange/${id}/forecast`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setData(json as ForecastResponse)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!data?.my_forecast) return
    await fetch(`/api/exchange/${id}/forecast`, { method: 'DELETE' })
    setShowForm(false)
    load()
  }

  const otherForecasts = useMemo(
    () => (data?.forecasts ?? []).filter((f) => f.user_id !== data?.my_forecast?.user_id),
    [data]
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10 space-y-6">

        {/* Back link */}
        <Link
          href={`/exchange/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to market
        </Link>

        {/* Header */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : data ? (
          <div>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-semibold text-white leading-snug mb-1">
                  Price Forecasts
                </h1>
                <p className="text-sm text-surface-400 leading-relaxed line-clamp-2">
                  {data.statement}
                </p>
              </div>
              <Badge variant="active" className="flex-shrink-0 text-xs">
                {data.current_price}¢
              </Badge>
            </div>
          </div>
        ) : null}

        {/* Stats panel */}
        {loading ? (
          <div className="rounded-xl border border-surface-300/60 bg-surface-200/60 p-4 space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
            </div>
          </div>
        ) : data && data.stats.count > 0 ? (
          <div className="rounded-xl border border-surface-300/60 bg-surface-200/60 p-4 space-y-4">
            {/* Sentiment bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-surface-400">
                  Community sentiment — {data.stats.count} forecast{data.stats.count !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                  <Users className="h-3 w-3" />
                  {data.stats.count}
                </div>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden bg-surface-600">
                {data.stats.bullish_pct > 0 && (
                  <div
                    className="bg-emerald h-full transition-all"
                    style={{ width: `${data.stats.bullish_pct}%` }}
                    title={`${data.stats.bullish_pct}% bullish`}
                  />
                )}
                {data.stats.neutral_pct > 0 && (
                  <div
                    className="bg-surface-500 h-full transition-all"
                    style={{ width: `${data.stats.neutral_pct}%` }}
                    title={`${data.stats.neutral_pct}% neutral`}
                  />
                )}
                {data.stats.bearish_pct > 0 && (
                  <div
                    className="bg-against-500 h-full transition-all"
                    style={{ width: `${data.stats.bearish_pct}%` }}
                    title={`${data.stats.bearish_pct}% bearish`}
                  />
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono">
                <span className="text-emerald">{data.stats.bullish_pct}% bull</span>
                <span className="text-surface-500">{data.stats.neutral_pct}% neutral</span>
                <span className="text-against-400">{data.stats.bearish_pct}% bear</span>
              </div>
            </div>

            {/* Key numbers */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-surface-700/40 border border-surface-600/60 p-2.5 text-center">
                <div className={cn('text-xl font-mono font-bold', priceColor(data.stats.median_target))}>
                  {data.stats.median_target}¢
                </div>
                <div className="text-[10px] text-surface-500 font-mono mt-0.5">Median target</div>
              </div>
              <div className="rounded-lg bg-surface-700/40 border border-surface-600/60 p-2.5 text-center">
                <div className={cn('text-xl font-mono font-bold', priceColor(data.stats.mean_target))}>
                  {data.stats.mean_target}¢
                </div>
                <div className="text-[10px] text-surface-500 font-mono mt-0.5">Mean target</div>
              </div>
              {data.stats.high_confidence_median !== null ? (
                <div className="rounded-lg bg-gold/5 border border-gold/20 p-2.5 text-center">
                  <div className={cn('text-xl font-mono font-bold', priceColor(data.stats.high_confidence_median))}>
                    {data.stats.high_confidence_median}¢
                  </div>
                  <div className="text-[10px] text-gold/70 font-mono mt-0.5">High-conf median</div>
                </div>
              ) : (
                <div className="rounded-lg bg-surface-700/40 border border-surface-600/60 p-2.5 text-center">
                  <div className="text-xl font-mono font-bold text-surface-600">—</div>
                  <div className="text-[10px] text-surface-600 font-mono mt-0.5">High-conf</div>
                </div>
              )}
            </div>

            {/* Distribution */}
            <div>
              <p className="text-[10px] font-mono text-surface-500 mb-2">Target price distribution</p>
              <DistributionChart
                distribution={data.stats.distribution}
                currentPrice={data.current_price}
                medianTarget={data.stats.median_target}
              />
            </div>
          </div>
        ) : !loading && data && (
          <div className="rounded-xl border border-surface-300/60 bg-surface-200/60 p-6 text-center">
            <BarChart2 className="h-8 w-8 text-surface-500 mx-auto mb-2" />
            <p className="text-sm text-surface-400">No forecasts yet.</p>
            <p className="text-xs text-surface-600 mt-1">Be the first to set a price target.</p>
          </div>
        )}

        {/* Your forecast section */}
        {data && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-surface-300 font-mono uppercase tracking-wider">
                Your forecast
              </h2>
              {data.my_forecast && !showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="text-xs font-mono text-purple hover:text-purple/80 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {showForm ? (
              <SubmitForm
                id={id}
                currentPrice={data.current_price}
                initial={data.my_forecast}
                onSuccess={() => { setShowForm(false); load() }}
                onCancel={() => setShowForm(false)}
              />
            ) : data.my_forecast ? (
              <ForecastCard
                forecast={data.my_forecast}
                currentPrice={data.current_price}
                isOwn
                onDelete={handleDelete}
              />
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium',
                  'border border-dashed border-purple/40 text-purple/80',
                  'hover:border-purple/60 hover:text-purple hover:bg-purple/5',
                  'transition-all duration-150'
                )}
              >
                <Target className="h-4 w-4" />
                Set your price target
              </button>
            )}
          </div>
        )}

        {/* Community forecasts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-surface-300 font-mono uppercase tracking-wider">
              Community forecasts
            </h2>
            <button
              onClick={load}
              className="p-1.5 rounded-lg text-surface-600 hover:text-surface-400 hover:bg-surface-700/40 transition-all"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl border border-surface-300/60 bg-surface-200/60 p-3">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : otherForecasts.length === 0 ? (
            <EmptyState
              icon={<Scale className="h-6 w-6 text-surface-500" />}
              title="No community forecasts yet"
              description="Be the first to call the market direction."
            />
          ) : (
            <div className="space-y-2">
              {otherForecasts.map((f) => (
                <ForecastCard
                  key={f.id}
                  forecast={f}
                  currentPrice={data?.current_price ?? 50}
                  isOwn={false}
                />
              ))}
            </div>
          )}
        </div>

        {/* Nav links */}
        <div className="flex gap-2 pt-2">
          <Link
            href={`/exchange/${id}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
              'bg-surface-700/40 border border-surface-600 text-surface-400',
              'hover:border-surface-500 hover:text-surface-300 transition-all'
            )}
          >
            <Zap className="h-3.5 w-3.5" />
            Market
          </Link>
          <Link
            href={`/exchange/${id}/analysis`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
              'bg-surface-700/40 border border-surface-600 text-surface-400',
              'hover:border-surface-500 hover:text-surface-300 transition-all'
            )}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Analysis
          </Link>
          <Link
            href={`/exchange/${id}/ideas`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
              'bg-surface-700/40 border border-surface-600 text-surface-400',
              'hover:border-surface-500 hover:text-surface-300 transition-all'
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Theses
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
