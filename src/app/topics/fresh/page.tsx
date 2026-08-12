'use client'

/**
 * /topics/fresh — Fresh Topics
 *
 * Surfaces civic debates created in the last 14 days, ranked by how fast
 * they're attracting votes (votes per hour since creation). These are the
 * debates finding their audience fastest — the ones worth watching now,
 * before the crowd arrives.
 *
 * Sort modes:
 *   Velocity   — votes per hour since creation (default)
 *   Newest     — most recently created first
 *   Most Votes — raw vote count
 *   Most Argued — most active debate (argument count)
 *
 * Age tiers: New (< 24h) · Fresh (1–3d) · Recent (3–7d) · This Week (7–14d)
 *
 * Distinct from:
 *   /trending      — velocity for any-age topics; veterans dominate
 *   /groundswell   — previously quiet topics suddenly gaining attention
 *   /topics        — full browser (any age, many sorts)
 *   /topics/underrated — quality gems with low vote counts
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  Clock,
  Flame,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FreshTopic, FreshTopicsResponse } from '@/app/api/topics/fresh/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type SortMode = 'velocity' | 'newest' | 'votes' | 'argued'

const SORT_OPTIONS: { id: SortMode; label: string; icon: typeof TrendingUp }[] = [
  { id: 'velocity', label: 'Fastest Growing', icon: Zap },
  { id: 'newest', label: 'Newest First', icon: Clock },
  { id: 'votes', label: 'Most Votes', icon: BarChart2 },
  { id: 'argued', label: 'Most Argued', icon: MessageSquare },
]

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

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
}

const STATUS_ICON: Record<string, typeof Scale> = {
  proposed: Scale,
  active: Zap,
  voting: Gavel,
}

// ─── Age tier badge ───────────────────────────────────────────────────────────

function AgeTierBadge({ tier, ageHours }: { tier: FreshTopic['age_tier']; ageHours: number }) {
  const label =
    tier === 'new'
      ? ageHours < 1
        ? 'Just posted'
        : `${Math.round(ageHours)}h old`
      : tier === 'fresh'
        ? `${Math.round(ageHours / 24)}d old`
        : tier === 'recent'
          ? `${Math.round(ageHours / 24)}d old`
          : `${Math.round(ageHours / 24)}d old`

  const className =
    tier === 'new'
      ? 'bg-against-500/15 text-against-300 border-against-500/30'
      : tier === 'fresh'
        ? 'bg-gold/15 text-gold border-gold/30'
        : tier === 'recent'
          ? 'bg-for-500/15 text-for-300 border-for-500/30'
          : 'bg-surface-300/40 text-surface-500 border-surface-400/30'

  const Icon = tier === 'new' ? Flame : Clock

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}

// ─── Velocity badge ───────────────────────────────────────────────────────────

function VelocityBadge({ vph }: { vph: number }) {
  if (vph < 0.1) return null

  const formatted =
    vph >= 100 ? `${Math.round(vph)}/hr` : vph >= 10 ? `${vph.toFixed(1)}/hr` : `${vph.toFixed(2)}/hr`

  const className =
    vph >= 10
      ? 'bg-against-500/15 text-against-300 border-against-500/30'
      : vph >= 1
        ? 'bg-gold/15 text-gold border-gold/30'
        : 'bg-surface-300/40 text-surface-500 border-surface-400/30'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
        className,
      )}
    >
      <TrendingUp className="h-3 w-3" />
      {formatted}
    </span>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function FreshTopicCard({ topic, rank }: { topic: FreshTopic; rank: number }) {
  const StatusIcon = STATUS_ICON[topic.status] ?? Scale
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  const forPct = topic.blue_pct
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.5) }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div
          className={cn(
            'relative rounded-2xl border p-5 transition-all duration-200',
            'bg-surface-100 border-surface-300',
            'hover:border-surface-400 hover:bg-surface-200/60',
          )}
        >
          {/* Rank */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="text-[11px] font-mono text-surface-600 tabular-nums">
              #{rank + 1}
            </span>
            <Zap className="h-3.5 w-3.5 text-gold opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Status + category */}
          <div className="flex items-center gap-2 mb-3 pr-12">
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              <StatusIcon className="h-3 w-3 mr-1 inline" />
              {topic.status === 'voting'
                ? 'Voting'
                : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
            </Badge>
            {topic.category && (
              <span className={cn('text-xs font-mono font-semibold', catColor)}>
                {topic.category}
              </span>
            )}
          </div>

          {/* Statement */}
          <p className="text-sm font-semibold text-white leading-snug mb-4 line-clamp-3 group-hover:text-for-200 transition-colors">
            {topic.statement}
          </p>

          {/* Vote bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[11px] font-mono mb-1.5">
              <span className="text-for-400">
                <ThumbsUp className="h-3 w-3 inline mr-0.5" />
                {forPct}% For
              </span>
              <span className="text-against-400">
                {againstPct}% Against
                <ThumbsDown className="h-3 w-3 inline ml-0.5" />
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
              <div className="h-full bg-against-600" style={{ width: `${againstPct}%` }} />
            </div>
            <p className="text-[11px] font-mono text-surface-500 mt-1.5 text-right tabular-nums">
              {topic.total_votes.toLocaleString()} votes
            </p>
          </div>

          {/* Metrics */}
          <div className="flex flex-wrap items-center gap-2">
            <AgeTierBadge tier={topic.age_tier} ageHours={topic.age_hours} />
            <VelocityBadge vph={topic.votes_per_hour} />
            {topic.arg_count > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
                <MessageSquare className="h-3 w-3" />
                {topic.arg_count} argument{topic.arg_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function FreshTopicCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3.5 w-3/4" />
      <div className="space-y-1.5">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-20 ml-auto" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FreshTopicsPage() {
  const [topics, setTopics] = useState<FreshTopic[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortMode>('velocity')
  const [showFilters, setShowFilters] = useState(false)
  const [showSortDropdown, setShowSortDropdown] = useState(false)

  const PAGE_SIZE = 20

  const fetchTopics = useCallback(
    async (reset = false) => {
      const offset = reset ? 0 : topics.length
      if (reset) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      try {
        const params = new URLSearchParams({
          category,
          sort,
          limit: String(PAGE_SIZE),
          offset: String(offset),
        })
        const res = await fetch(`/api/topics/fresh?${params}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('fetch failed')
        const data: FreshTopicsResponse = await res.json()
        setTopics(reset ? data.topics : (prev) => [...prev, ...data.topics])
        setTotal(data.total)
      } catch {
        setError('Could not load fresh topics. Please try again.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, sort],
  )

  useEffect(() => {
    fetchTopics(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort])

  const activeSort = SORT_OPTIONS.find((s) => s.id === sort) ?? SORT_OPTIONS[0]

  // Count topics by age tier
  const tierCounts = topics.reduce(
    (acc, t) => {
      acc[t.age_tier] = (acc[t.age_tier] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/topics"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Topics
          </Link>

          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Zap className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Fresh Topics
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed max-w-xl">
                New civic debates (last 14 days) ranked by how fast they&apos;re
                attracting voters. These are the conversations finding their audience
                fastest — get in before the crowd.
              </p>
            </div>
          </div>

          {/* Age tier stats */}
          {!loading && topics.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-mono text-surface-500">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-gold" />
                <span className="text-white font-semibold">{total}</span> new debates
              </span>
              {tierCounts['new'] ? (
                <span className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-against-400" />
                  <span className="text-white font-semibold">{tierCounts['new']}</span> posted today
                </span>
              ) : null}
              {tierCounts['fresh'] ? (
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-for-400" />
                  <span className="text-white font-semibold">{tierCounts['fresh']}</span> this week
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-mono border transition-colors',
                showFilters
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
            </button>

            {/* Sort picker */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-mono border border-surface-300 bg-surface-100 text-surface-400 hover:text-white transition-colors"
              >
                <activeSort.icon className="h-3.5 w-3.5" />
                {activeSort.label}
                <ChevronDown className="h-3 w-3" />
              </button>
              <AnimatePresence>
                {showSortDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute left-0 top-10 z-20 w-48 rounded-xl border border-surface-300 bg-surface-100 shadow-xl overflow-hidden"
                  >
                    {SORT_OPTIONS.map((opt) => {
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSort(opt.id)
                            setShowSortDropdown(false)
                          }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono transition-colors',
                            sort === opt.id
                              ? 'bg-surface-300 text-white'
                              : 'text-surface-400 hover:bg-surface-200 hover:text-white',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchTopics(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-mono border border-surface-300 bg-surface-100 text-surface-400 hover:text-white transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Category pills */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setCategory('all')}
                    className={cn(
                      'px-3 h-7 rounded-full text-xs font-mono border transition-colors',
                      category === 'all'
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white',
                    )}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'px-3 h-7 rounded-full text-xs font-mono border transition-colors',
                        category === cat
                          ? 'bg-surface-300 border-surface-400 text-white'
                          : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white',
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

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <FreshTopicCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <p className="text-sm font-mono text-against-400 mb-4">{error}</p>
            <button
              onClick={() => fetchTopics(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Zap}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No fresh topics"
            description={
              category !== 'all'
                ? `No new topics in ${category} in the last 14 days. Try another category.`
                : 'No new topics with enough votes in the last 14 days. Check back soon.'
            }
            action={
              category !== 'all'
                ? { label: 'Show all categories', onClick: () => setCategory('all') }
                : { label: 'Browse all topics', href: '/topics' }
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {topics.map((topic, i) => (
                <FreshTopicCard key={topic.id} topic={topic} rank={i} />
              ))}
            </div>

            {/* Load more */}
            {topics.length < total && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchTopics(false)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Load more ({total - topics.length} remaining)
                </button>
              </div>
            )}

            {topics.length >= total && topics.length > 0 && (
              <p className="mt-8 text-center text-xs font-mono text-surface-600">
                All {total} fresh topics shown
              </p>
            )}
          </>
        )}

        {/* ── How it works ─────────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl border border-surface-300 bg-surface-100 p-6">
          <h2 className="font-mono text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            How fresh score works
          </h2>
          <div className="space-y-2 text-xs font-mono text-surface-500 leading-relaxed">
            <p>
              Topics are ranked by{' '}
              <span className="text-gold">votes ÷ hours since creation</span> — the
              fastest-growing new debates rise to the top.
            </p>
            <p>
              Age tiers:{' '}
              <span className="text-against-300">New</span> (&lt;24h) ·{' '}
              <span className="text-gold">Fresh</span> (1–3d) ·{' '}
              <span className="text-for-300">Recent</span> (3–7d) ·{' '}
              <span className="text-surface-400">This Week</span> (7–14d)
            </p>
            <p>Only topics with ≥ 3 votes qualify. Topics older than 14 days graduate to the main feed.</p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
