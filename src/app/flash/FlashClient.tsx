'use client'

/**
 * /flash — The Civic Flash
 *
 * Surfaces topics where the argumentative community diverges from the voting
 * majority. A "flashpoint" is a topic where people vote FOR but argue AGAINST,
 * or vote AGAINST but argue FOR.
 *
 * This tension reveals:
 *   – Topics where voters haven't read the arguments
 *   – Topics with persuasive contrarian arguments
 *   – The platform's most intellectually contested questions
 *
 * Distinct from:
 *   /seismic       — sudden vote-burst anomalies (volume)
 *   /surge         — topics near activation thresholds
 *   /contested     — topics close to 50/50 on votes
 *   /undertow      — hidden engagement beneath the surface
 *   /barometer     — pressure from argument quality
 *
 * The Flash asks: "Where does the argument clash with the ballot?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FlashTopic, FlashResponse } from '@/app/api/flash/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold   border-gold/30   bg-gold/10',
  Politics:    'text-for-400 border-for-400/30 bg-for-400/10',
  Technology:  'text-purple  border-purple/30  bg-purple/10',
  Science:     'text-emerald border-emerald/30 bg-emerald/10',
  Ethics:      'text-amber-400 border-amber-400/30 bg-amber-400/10',
  Philosophy:  'text-indigo-400 border-indigo-400/30 bg-indigo-400/10',
  Culture:     'text-pink-400 border-pink-400/30 bg-pink-400/10',
  Health:      'text-green-400 border-green-400/30 bg-green-400/10',
  Environment: 'text-teal-400 border-teal-400/30 bg-teal-400/10',
  Education:   'text-cyan-400 border-cyan-400/30 bg-cyan-400/10',
}

function flashIntensity(score: number): { label: string; color: string; bg: string } {
  if (score >= 40) return { label: 'Critical', color: 'text-against-400', bg: 'bg-against-400/15' }
  if (score >= 30) return { label: 'High',     color: 'text-orange-400',  bg: 'bg-orange-400/15' }
  if (score >= 22) return { label: 'Medium',   color: 'text-amber-400',   bg: 'bg-amber-400/15' }
  return                  { label: 'Low',      color: 'text-surface-600', bg: 'bg-surface-600/15' }
}

type Filter = 'all' | 'vote_for_arg_against' | 'vote_against_arg_for'

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Zap
  color: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-surface-600">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        {label}
      </div>
      <div className={cn('text-xl font-bold tabular-nums', color)}>{value}</div>
      {sub && <div className="text-[10px] text-surface-500 leading-tight">{sub}</div>}
    </div>
  )
}

// ─── Flashpoint Card ─────────────────────────────────────────────────────────

function FlashCard({ topic, index }: { topic: FlashTopic; index: number }) {
  const intensity = flashIntensity(topic.flash_score)
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500 border-surface-500/30 bg-surface-500/10'

  const isVoteForArgAgainst = topic.tension_type === 'vote_for_arg_against'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl border bg-surface-100 p-4 space-y-3 transition-all duration-200',
          'hover:border-surface-400 hover:bg-surface-200 active:scale-[0.99]',
          'border-surface-300',
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', catColor)}>
                {topic.category}
              </span>
            )}
            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', intensity.bg, intensity.color)}>
              {intensity.label} Flash
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-sm font-bold text-amber-400 tabular-nums">{topic.flash_score}pt</span>
          </div>
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-surface-900 leading-snug line-clamp-2">
          {topic.statement}
        </p>

        {/* Tension summary */}
        <div className="rounded-lg border border-surface-300 bg-surface-50 p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-surface-500 font-medium uppercase tracking-wide">
            <Swords className="h-3 w-3" />
            Vote vs. Argument tension
          </div>

          {/* Vote bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-surface-500">
              <span className="flex items-center gap-1">
                <Vote className="h-3 w-3 text-surface-500" />
                Votes
              </span>
              <span>
                <span className="text-for-400 font-semibold">{topic.blue_pct}% For</span>
                {' · '}
                <span className="text-against-400 font-semibold">{100 - topic.blue_pct}% Against</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-for-400 rounded-full"
                style={{ width: `${topic.blue_pct}%` }}
              />
            </div>
          </div>

          {/* Argument bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-surface-500">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-surface-500" />
                Arguments
              </span>
              <span>
                <span className="text-for-400 font-semibold">{topic.arg_blue_pct}% Pro</span>
                {' · '}
                <span className="text-against-400 font-semibold">{100 - topic.arg_blue_pct}% Con</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-for-400 rounded-full"
                style={{ width: `${topic.arg_blue_pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Tension label */}
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5',
          isVoteForArgAgainst
            ? 'bg-against-900/30 text-against-300 border border-against-800/50'
            : 'bg-for-900/30 text-for-300 border border-for-800/50',
        )}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            {isVoteForArgAgainst
              ? `Votes lean FOR, but arguments favor AGAINST (${topic.flash_score}pt gap)`
              : `Votes lean AGAINST, but arguments favor FOR (${topic.flash_score}pt gap)`}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <div className="flex items-center gap-3 text-[11px] text-surface-500">
            <span className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              {topic.total_votes.toLocaleString()} votes
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {topic.total_arguments} args
            </span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FlashSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-10 rounded ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-2 rounded-lg border border-surface-300 bg-surface-50 p-2.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
          <Skeleton className="h-8 w-full rounded-lg" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-3.5" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FlashClient() {
  const [data, setData] = useState<FlashResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/flash', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load flash data')
      const json: FlashResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = data?.flashpoints.filter((f) => {
    if (filter === 'all') return true
    return f.tension_type === filter
  }) ?? []

  const visible = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleCount

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Zap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900">The Civic Flash</h1>
              <p className="text-xs text-surface-500">Where ballots clash with arguments</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-surface-900 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-surface-500 leading-relaxed">
          Flashpoints are topics where the <span className="text-surface-700 font-medium">voting majority</span> and
          the <span className="text-surface-700 font-medium">argumentative community</span> point in opposite
          directions — revealing the platform&apos;s most contested intellectual tensions.
        </p>

        {/* Stats */}
        {loading && !data ? (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Flashpoints"
              value={data.stats.total_flashpoints}
              sub="Active divergences"
              icon={Zap}
              color="text-amber-400"
            />
            <StatCard
              label="Avg Gap"
              value={`${data.stats.avg_flash_score}pt`}
              sub="Vote vs. argument"
              icon={Scale}
              color="text-purple"
            />
            <StatCard
              label="Peak Gap"
              value={`${data.stats.highest_flash_score}pt`}
              sub="Highest divergence"
              icon={TrendingUp}
              color="text-against-400"
            />
          </div>
        ) : null}

        {/* Sub-stats if data loaded */}
        {data && data.stats.total_flashpoints > 0 && (
          <div className="flex items-center gap-3 text-xs text-surface-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-against-400/70 inline-block" />
              <span className="text-against-300 font-medium">{data.stats.vote_for_arg_against_count}</span>
              {' '}vote-for / argue-against
            </span>
            <span className="text-surface-700">·</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-for-400/70 inline-block" />
              <span className="text-for-300 font-medium">{data.stats.vote_against_arg_for_count}</span>
              {' '}vote-against / argue-for
            </span>
          </div>
        )}

        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
              showFilters
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                : 'border-surface-300 bg-surface-100 text-surface-500 hover:text-surface-900 hover:border-surface-400',
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
            <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
          </button>
          {filter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="text-xs text-surface-500 hover:text-surface-900 px-2 py-1 rounded"
            >
              Clear
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pb-1">
                {([
                  { id: 'all', label: 'All Flashpoints', icon: Zap },
                  { id: 'vote_for_arg_against', label: 'Vote For / Argue Against', icon: ThumbsDown },
                  { id: 'vote_against_arg_for', label: 'Vote Against / Argue For', icon: ThumbsUp },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setFilter(opt.id); setVisibleCount(12) }}
                    className={cn(
                      'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors',
                      filter === opt.id
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                        : 'border-surface-300 bg-surface-100 text-surface-500 hover:text-surface-900',
                    )}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading && !data ? (
          <FlashSkeleton />
        ) : error ? (
          <div className="text-sm text-against-400 p-4 rounded-xl border border-against-800/50 bg-against-900/20">
            {error}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No flashpoints detected"
            description="No topics currently show a significant divergence between voting and argument direction."
          />
        ) : (
          <div className="space-y-3">
            {visible.map((topic, i) => (
              <FlashCard key={topic.id} topic={topic} index={i} />
            ))}

            {hasMore && (
              <button
                onClick={() => setVisibleCount((v) => v + 12)}
                className="w-full py-3 text-sm text-surface-500 hover:text-surface-900 flex items-center justify-center gap-2 rounded-xl border border-surface-300 hover:border-surface-400 bg-surface-100 hover:bg-surface-200 transition-colors"
              >
                Show more
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* Context note */}
        {data && data.stats.total_flashpoints > 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-surface-600">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              What does a flashpoint mean?
            </div>
            <p className="text-xs text-surface-500 leading-relaxed">
              A high flash score means the community is debating a topic very differently from how they vote.
              This can indicate persuasive contrarian arguments, uninformed voting, or genuinely complex issues
              where nuance lives in the arguments rather than the ballot.
            </p>
            <Link
              href="/correlations"
              className="inline-flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              Explore topic correlations
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
