'use client'

/**
 * /pivot — The Civic Pivot
 *
 * Surfaces debates where recent community opinion has significantly diverged
 * from the historical consensus. These are not topics that are currently
 * divided (see /schism) or oscillating week-to-week (see /divergence) —
 * they are topics where the platform is QUIETLY CHANGING ITS MIND.
 *
 * Swing = recent_blue_pct (last 7 days) − lifetime_blue_pct (all-time avg)
 *   Positive swing  → recent voters lean more FOR than the historical record
 *   Negative swing  → recent voters lean more AGAINST than the historical record
 *
 * Classes:
 *   Landmark  (|swing| ≥ 35pp) — the community has fundamentally reconsidered
 *   Major     (|swing| ≥ 20pp) — clear, deliberate directional change
 *   Notable   (|swing| ≥ 10pp) — meaningful drift worth watching
 *
 * Distinct from:
 *   /divergence — week-to-week oscillation in recent history (two windows, both recent)
 *   /schism     — currently near-50/50 split (not about direction vs. history)
 *   /convergence — topics approaching consensus (direction only, no vs-history lens)
 *   /momentum   — topics building momentum IN ONE direction (no historical contrast)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  History,
  Landmark,
  Layers,
  Leaf,
  Loader2,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  PivotTopic,
  PivotClass,
  PivotDirection,
  PivotResponse,
} from '@/app/api/topics/pivot/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  Scale,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pivotClassConfig(cls: PivotClass) {
  switch (cls) {
    case 'landmark': return {
      label: 'Landmark',
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/40',
      ring: 'ring-gold/30',
      desc: '≥35pp swing',
    }
    case 'major': return {
      label: 'Major',
      color: 'text-for-300',
      bg: 'bg-for-500/10',
      border: 'border-for-500/30',
      ring: 'ring-for-500/20',
      desc: '≥20pp swing',
    }
    case 'notable': return {
      label: 'Notable',
      color: 'text-surface-400',
      bg: 'bg-surface-300/40',
      border: 'border-surface-400/30',
      ring: 'ring-surface-400/10',
      desc: '≥10pp swing',
    }
  }
}

function directionConfig(dir: PivotDirection) {
  return dir === 'shifting_for'
    ? {
        label: 'Shifting FOR',
        icon: ArrowUpRight,
        color: 'text-for-400',
        barColor: 'bg-for-500',
        arrowBg: 'bg-for-600/20 border-for-600/40',
      }
    : {
        label: 'Shifting AGAINST',
        icon: ArrowDownRight,
        color: 'text-against-400',
        barColor: 'bg-against-500',
        arrowBg: 'bg-against-700/20 border-against-700/40',
      }
}

function formatSwing(swing: number): string {
  const abs = Math.abs(swing)
  const sign = swing > 0 ? '+' : '−'
  return `${sign}${abs.toFixed(1)}pp`
}

function formatAge(days: number): string {
  if (days >= 365) return `${Math.floor(days / 365)}y old`
  if (days >= 30)  return `${Math.floor(days / 30)}mo old`
  return `${days}d old`
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return `${n}`
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TopicSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
        </div>
        <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-full rounded-lg" />
        <Skeleton className="h-8 w-10 rounded-lg" />
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: React.ReactNode
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-surface-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Dual bar: lifetime vs recent ────────────────────────────────────────────

function PivotBar({
  lifetimePct,
  recentPct,
  direction,
  rank,
}: {
  lifetimePct: number
  recentPct: number
  direction: PivotDirection
  rank: number
}) {
  const isFor = direction === 'shifting_for'

  return (
    <div className="space-y-1" aria-label="Opinion pivot visualization">
      {/* Lifetime bar */}
      <div>
        <div className="flex justify-between text-[9px] font-mono text-surface-600 mb-0.5">
          <span>Historical consensus</span>
          <span className="tabular-nums">{Math.round(lifetimePct)}% FOR</span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden bg-surface-300">
          <div
            className="absolute inset-y-0 left-0 bg-for-700 rounded-l-full"
            style={{ width: `${Math.round(lifetimePct)}%` }}
          />
          <div
            className="absolute inset-y-0 right-0 bg-against-800 rounded-r-full"
            style={{ width: `${100 - Math.round(lifetimePct)}%` }}
          />
        </div>
      </div>

      {/* Recent bar */}
      <div>
        <div className="flex justify-between text-[9px] font-mono text-surface-500 mb-0.5">
          <span>Recent (last 7 days)</span>
          <span className={cn('tabular-nums font-semibold', isFor ? 'text-for-400' : 'text-against-400')}>
            {Math.round(recentPct)}% FOR
          </span>
        </div>
        <div className="relative h-1.5 rounded-full overflow-hidden bg-surface-300">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(recentPct)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: rank * 0.04 }}
            className={cn('absolute inset-y-0 left-0 rounded-l-full', isFor ? 'bg-for-500' : 'bg-for-700')}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${100 - Math.round(recentPct)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: rank * 0.04 }}
            className={cn('absolute inset-y-0 right-0 rounded-r-full', isFor ? 'bg-against-800' : 'bg-against-500')}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function PivotCard({
  topic,
  rank,
}: {
  topic: PivotTopic
  rank: number
}) {
  const cls     = pivotClassConfig(topic.pivot_class)
  const dir     = directionConfig(topic.pivot_direction)
  const DirIcon = dir.icon
  const CatIcon = topic.category ? (CATEGORY_ICONS[topic.category] ?? Scale) : Scale

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.04 }}
      className={cn(
        'relative rounded-xl border bg-surface-100 p-4',
        'hover:border-surface-400 transition-colors',
        `ring-1 ${cls.ring}`,
        topic.pivot_class === 'landmark'
          ? 'border-gold/40'
          : topic.pivot_class === 'major'
          ? 'border-for-600/30'
          : 'border-surface-300',
      )}
    >
      {/* Rank badge */}
      <span
        className={cn(
          'absolute -top-2 -left-2 flex items-center justify-center',
          'h-5 w-5 rounded-full text-[10px] font-mono font-bold',
          'bg-surface-200 border border-surface-400 text-surface-500',
        )}
      >
        {rank}
      </span>

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {/* Tags row */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {topic.category && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <CatIcon className="h-3 w-3" aria-hidden="true" />
                {topic.category}
              </span>
            )}
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border',
                cls.bg, cls.color, cls.border,
              )}
            >
              {cls.label}
            </span>
            <span className="text-[10px] font-mono text-surface-600">{formatAge(topic.days_old)}</span>
          </div>

          <h3 className="text-sm font-medium text-white leading-snug line-clamp-3">
            {topic.statement}
          </h3>
        </div>

        {/* Swing indicator */}
        <div
          className={cn(
            'flex-shrink-0 flex flex-col items-center justify-center min-w-[52px]',
            'rounded-lg border p-2 text-center',
            dir.arrowBg,
          )}
          aria-label={`Swing: ${formatSwing(topic.swing)}`}
        >
          <DirIcon className={cn('h-4 w-4 mb-0.5', dir.color)} aria-hidden="true" />
          <span className={cn('text-xs font-mono font-bold tabular-nums leading-none', dir.color)}>
            {formatSwing(topic.swing)}
          </span>
        </div>
      </div>

      {/* Dual bar visualization */}
      <div className="mb-3">
        <PivotBar
          lifetimePct={topic.lifetime_blue_pct}
          recentPct={topic.recent_blue_pct}
          direction={topic.pivot_direction}
          rank={rank}
        />
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600 mb-3">
        <span className="flex items-center gap-1">
          <History className="h-3 w-3" aria-hidden="true" />
          {formatVotes(topic.total_votes)} lifetime votes
        </span>
        <span className="flex items-center gap-1">
          <BarChart2 className="h-3 w-3" aria-hidden="true" />
          {formatVotes(topic.recent_vote_count)} this week
        </span>
        <Badge
          variant={
            topic.status === 'law'     ? 'law'
            : topic.status === 'voting' ? 'proposed'
            : topic.status === 'failed' ? 'failed'
            : 'active'
          }
          size="sm"
        >
          {topic.status}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          href={`/topics/${topic.id}`}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg',
            'text-xs font-mono font-medium transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
            topic.pivot_direction === 'shifting_for'
              ? 'bg-for-600 text-white hover:bg-for-500'
              : 'bg-against-700 text-white hover:bg-against-600',
          )}
        >
          {topic.pivot_direction === 'shifting_for'
            ? <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
            : <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
          }
          View debate
        </Link>
        <Link
          href={`/topics/${topic.id}`}
          className={cn(
            'flex items-center justify-center gap-1 px-3 py-2 rounded-lg',
            'text-xs font-mono text-surface-400',
            'bg-surface-200 hover:bg-surface-300 hover:text-white transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400',
          )}
          aria-label="Open topic"
        >
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type TabValue = 'all' | 'shifting_for' | 'shifting_against'
type SortKey  = 'swing' | 'votes' | 'age'

export function PivotClient() {
  const [data, setData]           = useState<PivotResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [tab, setTab]             = useState<TabValue>('all')
  const [category, setCategory]   = useState<string | null>(null)
  const [sort, setSort]           = useState<SortKey>('swing')
  const [classFilter, setClassFilter] = useState<PivotClass | 'all'>('all')
  const [refreshing, setRefreshing]   = useState(false)
  const abortRef                  = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (cat: string | null) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError(false)

    try {
      const url = cat
        ? `/api/topics/pivot?category=${encodeURIComponent(cat)}`
        : '/api/topics/pivot'
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error('fetch_failed')
      const json: PivotResponse = await res.json()
      setData(json)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(category)
  }, [fetchData, category])

  function handleRefresh() {
    setRefreshing(true)
    fetchData(category)
  }

  // Derive visible topics
  const baseTopics: PivotTopic[] = !data ? [] :
    tab === 'shifting_for'      ? data.shifting_for
    : tab === 'shifting_against' ? data.shifting_against
    : data.topics

  const filtered = classFilter === 'all'
    ? baseTopics
    : baseTopics.filter((t) => t.pivot_class === classFilter)

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'swing')  return Math.abs(b.swing) - Math.abs(a.swing)
    if (sort === 'votes')  return b.total_votes - a.total_votes
    if (sort === 'age')    return b.days_old - a.days_old
    return 0
  })

  const stats     = data?.stats
  const moodLabel = stats?.platform_mood === 'reversing' ? 'Reversing'
    : stats?.platform_mood === 'drifting' ? 'Drifting'
    : 'Stable'
  const moodColor = stats?.platform_mood === 'reversing' ? 'text-against-400'
    : stats?.platform_mood === 'drifting' ? 'text-gold'
    : 'text-for-400'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Layers className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">The Civic Pivot</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Debates the community is quietly reconsidering
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed mt-3">
            These debates haven&apos;t flipped — but they&apos;re moving. Recent voters are
            disagreeing with the historical consensus, suggesting the platform&apos;s collective
            view is in the process of changing.
          </p>
        </div>

        {/* ── Stats grid ─────────────────────────────────────────────────────── */}
        {loading && !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Pivoting"
              value={<AnimatedNumber value={stats.total_pivoting} />}
              sub={`${stats.shifting_for_count} FOR · ${stats.shifting_against_count} AGN`}
              icon={BarChart2}
              color="text-for-400"
            />
            <StatCard
              label="Landmark"
              value={<AnimatedNumber value={stats.landmark_count} />}
              sub="≥35pp swing"
              icon={TriangleAlert}
              color="text-gold"
            />
            <StatCard
              label="Max Swing"
              value={
                <span className={stats.max_swing >= 20 ? 'text-gold' : 'text-white'}>
                  {stats.max_swing.toFixed(1)}
                  <span className="text-base font-normal text-surface-500">pp</span>
                </span>
              }
              sub={`avg ${stats.avg_swing.toFixed(1)}pp`}
              icon={TrendingDown}
              color="text-against-400"
            />
            <StatCard
              label="Mood"
              value={<span className={moodColor}>{moodLabel}</span>}
              sub={stats.most_active_category ?? 'across all categories'}
              icon={History}
              color={moodColor}
            />
          </div>
        ) : null}

        {/* ── Direction tabs ──────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1 mb-4"
          role="tablist"
          aria-label="Filter by pivot direction"
        >
          {(
            [
              { value: 'all',              label: 'All',            count: data?.topics.length ?? 0 },
              { value: 'shifting_for',     label: 'Shifting FOR',   count: data?.shifting_for.length ?? 0 },
              { value: 'shifting_against', label: 'Shifting AGAINST', count: data?.shifting_against.length ?? 0 },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg',
                'text-xs font-mono font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
                tab === t.value
                  ? t.value === 'shifting_for'
                    ? 'bg-for-600/30 text-for-300 border border-for-600/40'
                    : t.value === 'shifting_against'
                    ? 'bg-against-700/30 text-against-300 border border-against-700/40'
                    : 'bg-surface-200 text-white border border-surface-400'
                  : 'text-surface-500 hover:text-white hover:bg-surface-200',
              )}
            >
              {t.value === 'shifting_for'
                ? <TrendingUp className="h-3 w-3" aria-hidden="true" />
                : t.value === 'shifting_against'
                ? <TrendingDown className="h-3 w-3" aria-hidden="true" />
                : null
              }
              {t.label}
              {!loading && (
                <span className="text-[10px] text-surface-600">({t.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Category filter ─────────────────────────────────────────────────── */}
        <div
          className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none"
          role="group"
          aria-label="Filter by category"
        >
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
              category === null
                ? 'bg-for-600 text-white'
                : 'bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300',
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] ?? Scale
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat === category ? null : cat)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
                  category === cat
                    ? 'bg-for-600 text-white'
                    : 'bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300',
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {cat}
              </button>
            )
          })}
        </div>

        {/* ── Controls row ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 mb-5">
          {/* Class filter */}
          <div className="flex items-center gap-1" role="group" aria-label="Filter by pivot class">
            {(
              [
                { value: 'all',      label: 'All' },
                { value: 'landmark', label: 'Landmark' },
                { value: 'major',    label: 'Major' },
                { value: 'notable',  label: 'Notable' },
              ] as const
            ).map((f) => (
              <button
                key={f.value}
                onClick={() => setClassFilter(f.value)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
                  classFilter === f.value
                    ? f.value === 'landmark'
                      ? 'bg-gold/20 text-gold border border-gold/30'
                      : f.value === 'major'
                      ? 'bg-for-600/20 text-for-300 border border-for-600/30'
                      : f.value === 'notable'
                      ? 'bg-surface-300 text-surface-200 border border-surface-400'
                      : 'bg-surface-200 text-white border border-surface-400'
                    : 'text-surface-500 hover:text-white hover:bg-surface-200',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={cn(
                'text-[11px] font-mono bg-surface-200 border border-surface-300 rounded-lg',
                'text-surface-400 px-2 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
              )}
              aria-label="Sort topics"
            >
              <option value="swing">By swing</option>
              <option value="votes">By votes</option>
              <option value="age">By age</option>
            </select>

            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={loading || refreshing}
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-lg',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:text-white hover:bg-surface-300 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              aria-label="Refresh data"
            >
              {refreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              }
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────────── */}
        {loading && !data ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <TopicSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={TriangleAlert}
            title="Could not load pivoting topics"
            description="There was a problem fetching data. Please try again."
            actions={[{ label: 'Retry', onClick: handleRefresh }]}
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={
              classFilter !== 'all'
                ? `No ${classFilter} pivots right now`
                : category
                ? `No pivots in ${category} right now`
                : tab === 'shifting_for'
                ? 'No topics shifting FOR right now'
                : tab === 'shifting_against'
                ? 'No topics shifting AGAINST right now'
                : 'No significant opinion pivots detected'
            }
            description={
              classFilter !== 'all' || category
                ? 'Try removing filters to see all pivoting debates.'
                : 'The community\'s recent votes are closely tracking the historical consensus. Check back as new voting activity comes in.'
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${tab}-${category ?? 'all'}-${classFilter}-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="grid gap-3 sm:grid-cols-2"
            >
              {sorted.map((topic, i) => (
                <PivotCard key={topic.id} topic={topic} rank={i + 1} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Category breakdown ──────────────────────────────────────────────── */}
        {!loading && data && data.category_breakdown.length > 0 && (
          <section className="mt-10" aria-labelledby="category-breakdown-heading">
            <h2
              id="category-breakdown-heading"
              className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4"
            >
              Category breakdown
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.category_breakdown.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.category] ?? Scale
                return (
                  <button
                    key={cat.category}
                    onClick={() => setCategory(cat.category === category ? null : cat.category)}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition-colors text-left',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400',
                      category === cat.category
                        ? 'bg-for-600/20 border-for-600/40'
                        : 'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
                    )}
                  >
                    <Icon
                      className={cn('h-4 w-4 flex-shrink-0', category === cat.category ? 'text-for-400' : 'text-surface-500')}
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-mono font-medium text-white truncate">
                          {cat.category}
                        </span>
                        <span className="text-xs font-mono text-surface-500 flex-shrink-0">
                          {cat.topic_count} topic{cat.topic_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-mono text-gold">
                          avg {cat.avg_swing.toFixed(1)}pp swing
                        </span>
                        {cat.landmark_count > 0 && (
                          <span className="text-[11px] font-mono text-gold/70">
                            {cat.landmark_count} landmark
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Legend ─────────────────────────────────────────────────────────── */}
        {!loading && data && data.topics.length > 0 && (
          <section
            className="mt-8 rounded-xl border border-surface-300 bg-surface-100 p-4"
            aria-labelledby="legend-heading"
          >
            <h2
              id="legend-heading"
              className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3"
            >
              How to read this
            </h2>
            <div className="space-y-2 text-xs font-mono text-surface-400">
              <p>
                <span className="text-gold font-semibold">Landmark (≥35pp):</span>{' '}
                A fundamental reconsideration is underway — the community today would likely vote very differently than before.
              </p>
              <p>
                <span className="text-for-300 font-semibold">Major (≥20pp):</span>{' '}
                Clear directional drift. Recent voters are consistently moving away from the established position.
              </p>
              <p>
                <span className="text-surface-400 font-semibold">Notable (≥10pp):</span>{' '}
                Early-stage drift. Worth watching — may develop into a major pivot or revert.
              </p>
              <p className="text-surface-500 pt-1 border-t border-surface-300">
                The dual bars show the <span className="text-white">historical consensus</span> (all-time blue_pct)
                vs the <span className="text-white">recent window</span> (last 7 days). Only topics at least 14 days
                old with 30+ lifetime votes qualify.
              </p>
            </div>
          </section>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
