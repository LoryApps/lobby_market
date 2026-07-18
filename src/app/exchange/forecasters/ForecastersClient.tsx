'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Binoculars,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Crown,
  Medal,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ForecasterStats,
  ForecastersGlobalStats,
  ForecastersResponse,
} from '@/app/api/exchange/forecasters/route'

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_TABS = [
  { id: 'composite', label: 'Score',    icon: Trophy    },
  { id: 'accuracy',  label: 'Accuracy', icon: Target    },
  { id: 'hit_rate',  label: 'Hit Rate', icon: Check     },
  { id: 'volume',    label: 'Volume',   icon: BarChart2 },
] as const

type SortId = (typeof SORT_TABS)[number]['id']

// ─── Category styles ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  elder:         { label: 'Elder',         color: 'text-gold' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  debator:       { label: 'Debator',       color: 'text-for-400' },
  person:        { label: 'Citizen',       color: 'text-surface-500' },
}

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: 'Citizen', color: 'text-surface-500' }
}

// ─── Accuracy tier ────────────────────────────────────────────────────────────

function accuracyTier(score: number | null): { label: string; color: string; bg: string } {
  if (score === null) return { label: '—', color: 'text-surface-500', bg: 'bg-surface-200' }
  if (score >= 85) return { label: 'Elite', color: 'text-gold', bg: 'bg-gold/15' }
  if (score >= 70) return { label: 'Sharp', color: 'text-emerald', bg: 'bg-emerald/15' }
  if (score >= 55) return { label: 'Solid', color: 'text-for-400', bg: 'bg-for-500/15' }
  return { label: 'Developing', color: 'text-surface-400', bg: 'bg-surface-200' }
}

// ─── Rank display ─────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-gold" aria-label="#1" />
  if (rank === 2) return <Medal className="h-5 w-5 text-surface-400" aria-label="#2" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" aria-label="#3" />
  return (
    <span className="w-5 text-center text-sm font-mono font-bold text-surface-600" aria-label={`#${rank}`}>
      {rank}
    </span>
  )
}

// ─── Accuracy bar ─────────────────────────────────────────────────────────────

function AccuracyBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-surface-600 text-xs">—</span>
  const tier = accuracyTier(value)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', tier.bg)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={cn('text-xs font-mono font-bold tabular-nums', tier.color)}>
        {value}%
      </span>
    </div>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ label, value, colorClass }: { label: string; value: string | number; colorClass?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className={cn('text-sm font-bold tabular-nums font-mono', colorClass ?? 'text-white')}>
        {value}
      </span>
      <span className="text-[10px] text-surface-500 whitespace-nowrap">{label}</span>
    </div>
  )
}

// ─── Confidence dot indicator ─────────────────────────────────────────────────

function ConfidenceDots({ level }: { level: number | null }) {
  const filled = Math.round(level ?? 0)
  return (
    <div className="flex items-center gap-0.5" aria-label={`Avg confidence ${filled}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i <= filled ? 'bg-purple' : 'bg-surface-300',
          )}
        />
      ))}
    </div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ForecasterSkeleton({ index }: { index: number }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-100/60 border border-surface-300/50 animate-pulse"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Skeleton className="h-5 w-5 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-2.5 w-20 rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3.5 w-16 rounded" />
        <Skeleton className="h-2 w-full rounded" />
      </div>
    </div>
  )
}

// ─── Global stat banner ───────────────────────────────────────────────────────

function GlobalStats({ global }: { global: ForecastersGlobalStats }) {
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {[
        { label: 'Forecasters', value: global.total_forecasters, color: 'text-for-400', icon: Users },
        { label: 'Resolved Calls', value: global.total_resolved, color: 'text-emerald', icon: Target },
        {
          label: 'Avg Hit Rate',
          value: global.avg_direction_hit_rate !== null ? `${global.avg_direction_hit_rate}%` : '—',
          color: 'text-purple',
          icon: Check,
        },
        {
          label: 'Avg Accuracy',
          value: global.avg_accuracy !== null ? `${global.avg_accuracy}%` : '—',
          color: 'text-gold',
          icon: Trophy,
        },
      ].map(({ label, value, color, icon: Icon }) => (
        <div
          key={label}
          className="flex flex-col gap-1 items-center px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300"
        >
          <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
          <span className={cn('text-base font-bold font-mono tabular-nums', color)}>{value}</span>
          <span className="text-[10px] text-surface-500 text-center leading-tight">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Forecaster row ───────────────────────────────────────────────────────────

function ForecasterRow({
  forecaster,
  rank,
  sort,
  index,
}: {
  forecaster: ForecasterStats
  rank: number
  sort: SortId
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const roleConfig = getRoleConfig(forecaster.role)
  const tier = accuracyTier(forecaster.avg_accuracy)
  const catColor = forecaster.top_category
    ? (CAT_COLOR[forecaster.top_category] ?? 'text-surface-500')
    : 'text-surface-500'

  const primaryValue =
    sort === 'accuracy'
      ? forecaster.avg_accuracy !== null ? `${forecaster.avg_accuracy}%` : '—'
      : sort === 'hit_rate'
      ? forecaster.direction_hit_rate !== null ? `${forecaster.direction_hit_rate}%` : '—'
      : sort === 'volume'
      ? forecaster.total_forecasts.toString()
      : forecaster.avg_composite !== null ? forecaster.avg_composite.toFixed(1) : '—'

  const primaryLabel =
    sort === 'accuracy' ? 'avg accuracy'
    : sort === 'hit_rate' ? 'hit rate'
    : sort === 'volume' ? 'forecasts'
    : 'score'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
    >
      <div
        className={cn(
          'rounded-xl border transition-all',
          rank <= 3
            ? 'bg-surface-200/80 border-surface-400/60'
            : 'bg-surface-100/60 border-surface-300/50',
        )}
      >
        {/* Main row */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
          role="button"
          aria-expanded={expanded}
        >
          {/* Rank */}
          <div className="flex-shrink-0 flex items-center justify-center w-6">
            <RankBadge rank={rank} />
          </div>

          {/* Avatar */}
          <Link
            href={`/profile/${forecaster.username}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          >
            <Avatar
              src={forecaster.avatar_url}
              fallback={forecaster.display_name || forecaster.username}
              size="sm"
            />
          </Link>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                href={`/profile/${forecaster.username}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-white truncate hover:underline"
              >
                {forecaster.display_name || forecaster.username}
              </Link>
              <span className={cn('hidden sm:inline text-[10px] font-medium shrink-0', roleConfig.color)}>
                {roleConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {/* Accuracy tier badge */}
              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', tier.bg, tier.color)}>
                {tier.label}
              </span>
              {/* Top category */}
              {forecaster.top_category && (
                <span className={cn('text-[10px]', catColor)}>
                  {forecaster.top_category}
                </span>
              )}
            </div>
          </div>

          {/* Primary stat */}
          <div className="text-right shrink-0 min-w-[64px]">
            <p className="text-base font-bold font-mono tabular-nums text-white">{primaryValue}</p>
            <p className="text-[10px] text-surface-500">{primaryLabel}</p>
          </div>

          {/* Accuracy bar (hidden on xs) */}
          <div className="hidden sm:block w-28 shrink-0">
            <AccuracyBar value={forecaster.avg_accuracy} />
          </div>

          {/* Expand chevron */}
          <div className="shrink-0 text-surface-600 ml-1">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>

        {/* Expanded detail */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-0 border-t border-surface-300/50">
                {/* Stats grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 pt-3">
                  <StatPill
                    label="Total Calls"
                    value={forecaster.total_forecasts}
                    colorClass="text-white"
                  />
                  <StatPill
                    label="Resolved"
                    value={forecaster.resolved_forecasts}
                    colorClass="text-emerald"
                  />
                  <StatPill
                    label="Hit Rate"
                    value={forecaster.direction_hit_rate !== null ? `${forecaster.direction_hit_rate}%` : '—'}
                    colorClass={
                      forecaster.direction_hit_rate !== null
                        ? forecaster.direction_hit_rate >= 70
                          ? 'text-emerald'
                          : forecaster.direction_hit_rate >= 50
                          ? 'text-for-400'
                          : 'text-against-400'
                        : 'text-surface-500'
                    }
                  />
                  <StatPill
                    label="Avg Score"
                    value={forecaster.avg_composite !== null ? forecaster.avg_composite.toFixed(1) : '—'}
                    colorClass="text-gold"
                  />
                  <StatPill
                    label="Best Call"
                    value={forecaster.best_accuracy !== null ? `${forecaster.best_accuracy}%` : '—'}
                    colorClass="text-purple"
                  />
                  <StatPill
                    label="Pending"
                    value={forecaster.pending_forecasts}
                    colorClass="text-surface-400"
                  />
                </div>

                {/* Avg confidence dots */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-300/40">
                  <span className="text-[10px] text-surface-500">Avg confidence</span>
                  <ConfidenceDots level={forecaster.avg_confidence} />
                  {forecaster.avg_confidence !== null && (
                    <span className="text-[10px] text-surface-500">
                      {forecaster.avg_confidence.toFixed(1)}/5
                    </span>
                  )}
                </div>

                {/* Best call statement */}
                {forecaster.best_call_statement && (
                  <div className="mt-3 pt-3 border-t border-surface-300/40">
                    <p className="text-[10px] text-surface-500 mb-1">Best call</p>
                    <p className="text-xs text-surface-300 leading-relaxed line-clamp-2">
                      {forecaster.best_call_statement}
                    </p>
                  </div>
                )}

                {/* View profile link */}
                <Link
                  href={`/profile/${forecaster.username}`}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-for-400 hover:underline"
                >
                  View profile
                  <TrendingUp className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ForecastersClient() {
  const [forecasters, setForecasters] = useState<ForecasterStats[]>([])
  const [global, setGlobal] = useState<ForecastersGlobalStats | null>(null)
  const [sort, setSort] = useState<SortId>('composite')
  const [category, setCategory] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const params = new URLSearchParams({ sort })
        if (category) params.set('category', category)
        const res = await fetch(`/api/exchange/forecasters?${params}`)
        if (!res.ok) return
        const data: ForecastersResponse = await res.json()
        setForecasters(data.forecasters)
        setGlobal(data.global)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [sort, category],
  )

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-16">

        {/* Header */}
        <div className="py-5">
          <div className="flex items-start justify-between mb-1">
            <Link
              href="/exchange"
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Exchange
            </Link>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-all"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-purple" aria-hidden="true" />
            <h1 className="text-xl font-bold text-white">Price Forecasters</h1>
          </div>
          <p className="text-sm text-surface-500">
            Ranked by accuracy on resolved markets — who called the price closest.
          </p>
        </div>

        {/* Global stats */}
        {global && !loading && <GlobalStats global={global} />}

        {/* Sort tabs */}
        <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-0.5">
          {SORT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSort(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap',
                sort === id
                  ? 'bg-purple/15 border-purple/50 text-purple'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Category filter */}
        <div className="mb-4">
          <button
            onClick={() => setShowCategories((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium transition-colors',
              category ? 'text-gold' : 'text-surface-500 hover:text-white',
            )}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {category ?? 'All Categories'}
            {showCategories ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          <AnimatePresence>
            {showCategories && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button
                    onClick={() => { setCategory(null); setShowCategories(false) }}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                      category === null
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white',
                    )}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCategories(false) }}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                        category === cat
                          ? 'bg-gold/15 border-gold/50 text-gold'
                          : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Forecaster list */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <ForecasterSkeleton key={i} index={i} />
            ))
          ) : forecasters.length === 0 ? (
            <EmptyState
              icon={<Binoculars className="h-8 w-8 text-surface-500" />}
              title="No forecasters yet"
              description={
                category
                  ? `No price forecasters found for ${category}. Try a different category.`
                  : 'Be the first to submit a price target forecast on any market.'
              }
              action={
                <Link
                  href="/exchange"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/15 border border-purple/40 text-xs font-medium text-purple hover:bg-purple/25 transition-all"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Browse markets
                </Link>
              }
            />
          ) : (
            <>
              {forecasters.map((f, i) => (
                <ForecasterRow
                  key={f.user_id}
                  forecaster={f}
                  rank={i + 1}
                  sort={sort}
                  index={i}
                />
              ))}

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6 p-4 rounded-xl bg-purple/10 border border-purple/30 text-center"
              >
                <Brain className="h-6 w-6 text-purple mx-auto mb-2" />
                <p className="text-sm font-semibold text-white mb-1">Make your calls count</p>
                <p className="text-xs text-surface-500 mb-3">
                  Submit price target forecasts on any active market to earn your spot here.
                </p>
                <div className="flex gap-2 justify-center">
                  <Link
                    href="/exchange"
                    className="px-4 py-2 rounded-xl bg-purple/20 border border-purple/40 text-xs font-medium text-purple hover:bg-purple/30 transition-all"
                  >
                    Browse Markets
                  </Link>
                  <Link
                    href="/exchange/forecasts"
                    className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-400 text-xs font-medium text-surface-300 hover:text-white transition-all"
                  >
                    My Forecasts
                  </Link>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
