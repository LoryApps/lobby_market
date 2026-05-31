'use client'

/**
 * /gradient — The Civic Consensus Gradient
 *
 * A distribution curve showing how platform opinion is spread across the
 * FOR–AGAINST spectrum. Each bar represents a 5% bucket of topics grouped
 * by their current vote split.
 *
 * Reveals whether the platform is:
 *   • Polarized  — two peaks near 0% and 100% (bimodal)
 *   • Contested  — a large central cluster near 50/50
 *   • Resolved   — topics clustered toward one end
 *
 * Also shows per-category gradients so you can compare which domains
 * tend toward consensus vs. deadlock.
 *
 * Distinct from:
 *   /spectrum     — 2D scatter (consensus × engagement volume)
 *   /correlations — which topics vote together
 *   /polarization — over-time polarization trend tracking
 *   /heatmap      — category × scope matrix
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
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
import type {
  GradientBucket,
  GradientResponse,
  GradientTopic,
  CategoryStats,
} from '@/app/api/gradient/route'

// ─── Category config ───────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { text: string; bar: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',       bar: 'bg-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',    bar: 'bg-for-500',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',     bar: 'bg-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
  Science:     { text: 'text-emerald',    bar: 'bg-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300',bar: 'bg-against-400',bg: 'bg-against-400/10',border: 'border-against-400/30' },
  Philosophy:  { text: 'text-for-300',    bar: 'bg-for-400',    bg: 'bg-for-400/10',    border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',       bar: 'bg-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  Health:      { text: 'text-against-300',bar: 'bg-against-400',bg: 'bg-against-400/10',border: 'border-against-400/30' },
  Environment: { text: 'text-emerald',    bar: 'bg-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Education:   { text: 'text-purple',     bar: 'bg-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Bar color helpers ─────────────────────────────────────────────────────────

function barColor(pctMin: number): string {
  if (pctMin >= 67) return 'bg-emerald'
  if (pctMin >= 55) return 'bg-for-500'
  if (pctMin >= 45) return 'bg-surface-400'
  if (pctMin >= 30) return 'bg-against-400'
  return 'bg-against-500'
}

// ─── Gradient Bar Chart ────────────────────────────────────────────────────────

function GradientChart({
  buckets,
  selected,
  onSelect,
}: {
  buckets: GradientBucket[]
  selected: number | null
  onSelect: (idx: number | null) => void
}) {
  const maxCount = Math.max(...buckets.map((b) => b.count), 1)

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="relative flex items-end gap-0.5 h-48">
        {/* Threshold lines */}
        <div className="absolute inset-0 pointer-events-none">
          {/* 50% line — center of chart */}
          <div
            className="absolute bottom-0 top-0 w-px bg-surface-500/40"
            style={{ left: '50%' }}
          />
          {/* 67% line — law threshold */}
          <div
            className="absolute bottom-0 top-0 w-px bg-emerald/30"
            style={{ left: '67%' }}
          />
        </div>

        {buckets.map((bucket, idx) => {
          const heightPct = bucket.count === 0 ? 0 : Math.max(2, (bucket.count / maxCount) * 100)
          const isSelected = selected === idx
          const isContest = bucket.pctMin >= 45 && bucket.pctMax <= 55
          const isLawZone = bucket.pctMin >= 65

          return (
            <motion.button
              key={idx}
              onClick={() => onSelect(isSelected ? null : idx)}
              className={cn(
                'relative flex-1 rounded-t-sm transition-all cursor-pointer group',
                barColor(bucket.pctMin),
                isSelected && 'ring-2 ring-white/40',
                bucket.count === 0 && 'opacity-20 cursor-default',
              )}
              style={{ height: `${heightPct}%` }}
              initial={{ scaleY: 0, originY: 1 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.4, delay: idx * 0.015, ease: 'easeOut' }}
              title={`${bucket.pctMin}–${bucket.pctMax}% FOR: ${bucket.count} topic${bucket.count !== 1 ? 's' : ''}`}
            >
              {/* Hover tooltip */}
              {bucket.count > 0 && (
                <div className={cn(
                  'absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20',
                  'opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity',
                  'bg-surface-0 border border-surface-300 rounded-lg px-2 py-1.5 text-center',
                  'min-w-[80px] shadow-lg',
                )}>
                  <p className="text-xs font-mono font-bold text-white whitespace-nowrap">
                    {bucket.count} topic{bucket.count !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 whitespace-nowrap">
                    {bucket.pctMin}–{bucket.pctMax}% FOR
                  </p>
                  {bucket.laws > 0 && (
                    <p className="text-[10px] font-mono text-gold whitespace-nowrap">
                      {bucket.laws} law{bucket.laws !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Special zone indicator */}
              {(isContest || isLawZone) && bucket.count > 0 && (
                <div className={cn(
                  'absolute -top-3 left-1/2 -translate-x-1/2',
                  'text-[7px] font-mono font-bold uppercase tracking-widest',
                  isLawZone ? 'text-emerald' : 'text-surface-400',
                )}>
                  {isLawZone ? '⚖' : '≈'}
                </div>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* X-axis labels */}
      <div className="relative flex mt-2">
        <span className="text-[10px] font-mono text-against-400 flex-shrink-0">0% AGAINST</span>
        <div className="flex-1 flex justify-center">
          <span className="text-[10px] font-mono text-surface-500">← Contested →</span>
        </div>
        <span className="text-[10px] font-mono text-for-400 flex-shrink-0">100% FOR</span>
      </div>

      {/* Zone markers */}
      <div className="relative flex mt-1 text-[9px] font-mono text-surface-600">
        <span style={{ width: '45%' }} className="text-center text-against-500/60">AGAINST LEANING</span>
        <span style={{ width: '10%' }} className="text-center text-surface-500">TIED</span>
        <span style={{ width: '22%' }} className="text-center text-for-500/60">FOR LEANING</span>
        <span style={{ width: '23%' }} className="text-center text-emerald/60">LAW ZONE</span>
      </div>
    </div>
  )
}

// ─── Topic mini-card ──────────────────────────────────────────────────────────

function TopicMini({ topic }: { topic: GradientTopic }) {
  const pct = Math.round(topic.blue_pct ?? 50)
  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all group',
        'border-surface-300 bg-surface-100/80 hover:border-surface-400 hover:bg-surface-200/60',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white line-clamp-2 leading-snug group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
              {topic.category}
            </span>
          )}
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="scale-75 origin-left">
            {topic.status === 'law' ? 'LAW' : topic.status}
          </Badge>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={cn(
          'text-xs font-mono font-bold',
          pct >= 67 ? 'text-emerald' : pct >= 55 ? 'text-for-400' : pct >= 45 ? 'text-surface-400' : 'text-against-400'
        )}>
          {pct}%
        </div>
        <div className="text-[9px] font-mono text-surface-600">FOR</div>
      </div>
    </Link>
  )
}

// ─── Bucket detail panel ──────────────────────────────────────────────────────

function BucketPanel({
  bucket,
  onClose,
}: {
  bucket: GradientBucket
  onClose: () => void
}) {
  const color = barColor(bucket.pctMin)
  const isLawZone = bucket.pctMin >= 65
  const isContest = bucket.pctMin >= 45 && bucket.pctMax <= 55

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('h-3 w-3 rounded-full', color)} />
            <span className="text-sm font-mono font-bold text-white">
              {bucket.pctMin}–{bucket.pctMax}% FOR
            </span>
            {isLawZone && (
              <span className="text-[10px] font-mono text-emerald font-semibold uppercase tracking-wider">
                Law Zone
              </span>
            )}
            {isContest && (
              <span className="text-[10px] font-mono text-surface-400 font-semibold uppercase tracking-wider">
                Contested
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-surface-500">
            {bucket.count} topic{bucket.count !== 1 ? 's' : ''}
            {bucket.laws > 0 && ` · ${bucket.laws} established law${bucket.laws !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-surface-500 hover:text-white transition-colors text-xs font-mono"
        >
          ✕ close
        </button>
      </div>

      {bucket.topics.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2">
            Sample topics in this range
          </p>
          {bucket.topics.map((t) => (
            <TopicMini key={t.id} topic={t} />
          ))}
        </div>
      ) : (
        <p className="text-xs font-mono text-surface-500 text-center py-4">
          No topics in this range
        </p>
      )}
    </motion.div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({
  stats,
  selected,
  onSelect,
}: {
  stats: CategoryStats
  selected: boolean
  onSelect: () => void
}) {
  const colors = CAT_COLORS[stats.category] ?? CAT_COLORS.Politics
  const avg = stats.avgBluePct

  return (
    <motion.button
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all',
        selected
          ? cn(colors.bg, colors.border, 'ring-2 ring-white/10')
          : 'border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/60',
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <p className={cn('text-sm font-mono font-bold', colors.text)}>
            {stats.category}
          </p>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            {stats.count} topic{stats.count !== 1 ? 's' : ''}
            {stats.lawCount > 0 && ` · ${stats.lawCount} law${stats.lawCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="text-right">
          <div className={cn('text-sm font-mono font-bold', colors.text)}>
            {avg}%
          </div>
          <div className="text-[10px] font-mono text-surface-500">avg FOR</div>
        </div>
      </div>

      {/* Gradient mini-bar */}
      <div className="h-2 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          className={cn('h-full rounded-full', colors.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${avg}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="flex justify-between mt-1">
        <span className="text-[9px] font-mono text-against-400">AGAINST</span>
        <span className="text-[9px] font-mono text-for-400">FOR</span>
      </div>
    </motion.button>
  )
}

// ─── Polarization gauge ───────────────────────────────────────────────────────

function PolarizationGauge({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-surface-500">{label}</span>
        <span className={cn('text-sm font-mono font-bold', color)}>{score}/100</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GradientSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function GradientPage() {
  const [data, setData] = useState<GradientResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedBucket, setSelectedBucket] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/gradient', { signal: ctrl.signal, cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const activeBucket = selectedBucket !== null ? data?.buckets[selectedBucket] : null
  const activeCategoryStats = selectedCategory
    ? data?.categories.find((c) => c.category === selectedCategory)
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
                <Activity className="h-5 w-5 text-for-400" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Civic Gradient
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Consensus distribution across the platform
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          <p className="text-sm font-mono text-surface-500 leading-relaxed max-w-2xl">
            Each bar represents a 5% slice of the FOR–AGAINST spectrum. The shape of this
            curve reveals whether the platform has reached{' '}
            <span className="text-white">consensus</span> (spike at one end),{' '}
            <span className="text-surface-400">deadlock</span> (bulge at 50%), or{' '}
            <span className="text-against-400">polarization</span> (two peaks at both extremes).
            Click any bar to explore topics in that range.
          </p>
        </div>

        {loading && <GradientSkeleton />}

        {error && (
          <EmptyState
            icon={BarChart2}
            iconColor="text-surface-500"
            title="Failed to load gradient"
            description="Could not fetch topic distribution data. Try refreshing."
            actions={[{ label: 'Retry', href: '/gradient', icon: RefreshCw }]}
          />
        )}

        {data && (
          <div className="space-y-8">

            {/* ── Global stats strip ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Total Topics',
                  value: data.totalTopics,
                  icon: BarChart2,
                  color: 'text-for-400',
                  bg: 'bg-for-500/10',
                },
                {
                  label: 'Laws Established',
                  value: data.totalLaws,
                  icon: Gavel,
                  color: 'text-gold',
                  bg: 'bg-gold/10',
                },
                {
                  label: 'Median FOR%',
                  value: `${data.medianBluePct}%`,
                  icon: Scale,
                  color: data.medianBluePct >= 50 ? 'text-for-400' : 'text-against-400',
                  bg: data.medianBluePct >= 50 ? 'bg-for-500/10' : 'bg-against-500/10',
                },
                {
                  label: 'Mean FOR%',
                  value: `${data.meanBluePct}%`,
                  icon: Activity,
                  color: 'text-purple',
                  bg: 'bg-purple/10',
                },
              ].map((stat) => {
                const Icon = stat.icon
                return (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
                  >
                    <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg mb-2', stat.bg)}>
                      <Icon className={cn('h-4 w-4', stat.color)} />
                    </div>
                    <div className={cn('font-mono text-xl font-bold', stat.color)}>
                      {stat.value}
                    </div>
                    <div className="text-[11px] font-mono text-surface-500 mt-0.5">
                      {stat.label}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Polarization + Consensus scores ─────────────────────────── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4">
                Platform Health Indices
              </h2>
              <div className="space-y-4">
                <div>
                  <PolarizationGauge
                    score={data.polarizationScore}
                    label="Polarization Index"
                    color={
                      data.polarizationScore >= 60
                        ? 'text-against-400'
                        : data.polarizationScore >= 30
                        ? 'text-gold'
                        : 'text-emerald'
                    }
                  />
                  <p className="text-[11px] font-mono text-surface-500 mt-1">
                    {data.polarizationScore >= 60
                      ? 'Platform is highly polarized — opinions cluster at extremes.'
                      : data.polarizationScore >= 30
                      ? 'Moderate polarization — some extreme positions but also middle ground.'
                      : 'Platform is relatively unified — opinions show broad agreement.'}
                  </p>
                </div>
                <div>
                  <PolarizationGauge
                    score={data.consensusScore}
                    label="Contested Topics Index"
                    color="text-surface-400"
                  />
                  <p className="text-[11px] font-mono text-surface-500 mt-1">
                    {data.consensusScore >= 50
                      ? 'Most topics are genuinely contested — the community is split on the hard questions.'
                      : 'Many topics have found one-sided consensus — most debates have clear winners.'}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Main gradient chart ──────────────────────────────────────── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  Opinion Distribution (5% buckets)
                </h2>
                <div className="flex items-center gap-3 text-[10px] font-mono text-surface-600">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-against-500" />
                    Against-leading
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-surface-400" />
                    Contested
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-for-500" />
                    For-leading
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald" />
                    Law zone
                  </span>
                </div>
              </div>

              <GradientChart
                buckets={data.buckets}
                selected={selectedBucket}
                onSelect={setSelectedBucket}
              />

              <p className="mt-4 text-[11px] font-mono text-surface-500 text-center">
                Click any bar to explore topics in that range ·{' '}
                <span className="text-emerald">Green zone ≥67%</span> = law threshold ·{' '}
                <span className="text-surface-400">50% line</span> = contested
              </p>
            </div>

            {/* ── Bucket detail panel ──────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {activeBucket && selectedBucket !== null && (
                <BucketPanel
                  key={selectedBucket}
                  bucket={activeBucket}
                  onClose={() => setSelectedBucket(null)}
                />
              )}
            </AnimatePresence>

            {/* ── Category gradient grid ───────────────────────────────────── */}
            <div>
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4">
                Gradient by Category
              </h2>
              <p className="text-[11px] font-mono text-surface-500 mb-4">
                Average FOR% per category. Click a category to see its most contested and most decisive topics.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.categories.map((cat) => (
                  <CategoryCard
                    key={cat.category}
                    stats={cat}
                    selected={selectedCategory === cat.category}
                    onSelect={() =>
                      setSelectedCategory(
                        selectedCategory === cat.category ? null : cat.category,
                      )
                    }
                  />
                ))}
              </div>
            </div>

            {/* ── Category detail ──────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {activeCategoryStats && (
                <motion.div
                  key={selectedCategory}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className={cn(
                        'text-base font-mono font-bold',
                        (CAT_COLORS[activeCategoryStats.category] ?? CAT_COLORS.Politics).text
                      )}>
                        {activeCategoryStats.category}
                      </h3>
                      <p className="text-xs font-mono text-surface-500 mt-0.5">
                        {activeCategoryStats.count} topics · {activeCategoryStats.lawCount} laws established ·{' '}
                        avg {activeCategoryStats.avgBluePct}% FOR
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-surface-500 hover:text-white transition-colors text-xs font-mono"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeCategoryStats.mostContested && (
                      <div>
                        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          Most contested
                        </p>
                        <TopicMini topic={activeCategoryStats.mostContested} />
                      </div>
                    )}
                    {activeCategoryStats.strongestFor && (
                      <div>
                        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-for-400" />
                          Strongest consensus FOR
                        </p>
                        <TopicMini topic={activeCategoryStats.strongestFor} />
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/categories/${activeCategoryStats.category}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-colors',
                        (CAT_COLORS[activeCategoryStats.category] ?? CAT_COLORS.Politics).bg,
                        (CAT_COLORS[activeCategoryStats.category] ?? CAT_COLORS.Politics).text,
                        'hover:opacity-80',
                      )}
                    >
                      Browse all {activeCategoryStats.category} topics
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Interpretation guide ─────────────────────────────────────── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-gold" />
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  How to Read the Gradient
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-1 rounded-full bg-against-500" />
                    <div className="h-8 w-1 rounded-full bg-against-400" />
                    <div className="h-4 w-1 rounded-full bg-surface-400" />
                    <div className="h-3 w-1 rounded-full bg-for-500" />
                    <div className="h-2 w-1 rounded-full bg-emerald" />
                  </div>
                  <p className="text-surface-400 font-semibold">Skewed AGAINST</p>
                  <p className="text-surface-500">
                    Platform leans AGAINST most proposals. Common when ideas are ahead of their time.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-1 rounded-full bg-against-500" />
                    <div className="h-5 w-1 rounded-full bg-against-400" />
                    <div className="h-10 w-1 rounded-full bg-surface-400" />
                    <div className="h-5 w-1 rounded-full bg-for-500" />
                    <div className="h-3 w-1 rounded-full bg-emerald" />
                  </div>
                  <p className="text-surface-400 font-semibold">Normal — Most Contested</p>
                  <p className="text-surface-500">
                    A bell curve centred at 50% means debates are genuinely difficult. Healthy democracy.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-1 rounded-full bg-against-500" />
                    <div className="h-3 w-1 rounded-full bg-against-400" />
                    <div className="h-2 w-1 rounded-full bg-surface-400" />
                    <div className="h-3 w-1 rounded-full bg-for-500" />
                    <div className="h-8 w-1 rounded-full bg-emerald" />
                  </div>
                  <p className="text-surface-400 font-semibold">Bimodal — Polarized</p>
                  <p className="text-surface-500">
                    Two peaks at extremes signals deep polarization — few contested topics.
                  </p>
                </div>
              </div>
            </div>

            {/* ── Related links ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3">
              <span className="text-xs font-mono text-surface-600 self-center">Related:</span>
              {[
                { href: '/spectrum', label: 'Civic Spectrum', icon: BarChart2 },
                { href: '/polarization', label: 'Polarization', icon: TrendingDown },
                { href: '/correlations', label: 'Correlations', icon: Zap },
                { href: '/heatmap', label: 'Heatmap', icon: Activity },
                { href: '/accord', label: 'Civic Accord', icon: Scale },
                { href: '/', label: 'Browse Feed', icon: ArrowRight },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
