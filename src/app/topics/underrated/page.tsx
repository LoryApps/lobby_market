'use client'

/**
 * /topics/underrated — Hidden Gem Topics
 *
 * Surfaces civic debates that have high-quality arguments (AI score ≥ 6)
 * but haven't yet found their audience (low vote counts). These are the
 * topics worth debating that most people haven't discovered yet.
 *
 * Distinct from:
 *   /trending       — short-term velocity; already gaining traction
 *   /groundswell    — topics waking back up after a quiet spell
 *   /arguments/underrated — hidden gem arguments, not topics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  ChevronDown,
  Gavel,
  Gem,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { UnderratedTopic, UnderratedTopicsResponse } from '@/app/api/topics/underrated/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type SortMode = 'underrated' | 'score' | 'activity'

const SORT_OPTIONS: { id: SortMode; label: string; icon: typeof Star }[] = [
  { id: 'underrated', label: 'Most Underrated', icon: Gem },
  { id: 'score', label: 'Highest Quality', icon: Brain },
  { id: 'activity', label: 'Most Active', icon: MessageSquare },
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
  law: 'law',
  failed: 'failed',
}

const STATUS_ICON: Record<string, typeof Zap> = {
  proposed: Scale,
  active: Zap,
  voting: Gavel,
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const className =
    score >= 8.5
      ? 'bg-gold/15 text-gold border-gold/30'
      : score >= 7.5
      ? 'bg-emerald/15 text-emerald border-emerald/30'
      : score >= 6.5
      ? 'bg-for-500/15 text-for-400 border-for-500/30'
      : 'bg-surface-300/40 text-surface-500 border-surface-400/30'

  const label =
    score >= 8.5 ? 'Excellent' : score >= 7.5 ? 'Great' : score >= 6.5 ? 'Good' : 'Decent'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
        className,
      )}
    >
      <Star className="h-3 w-3" />
      {score.toFixed(1)} · {label}
    </span>
  )
}

// ─── Balance badge ────────────────────────────────────────────────────────────

function BalanceBadge({ balance }: { balance: UnderratedTopic['argument_balance'] }) {
  if (balance === 'balanced') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-purple border border-purple/30 bg-purple/10 px-2 py-0.5 rounded-full">
        <Scale className="h-3 w-3" />
        Balanced
      </span>
    )
  }
  if (balance === 'for') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400 border border-for-500/30 bg-for-500/10 px-2 py-0.5 rounded-full">
        <ThumbsUp className="h-3 w-3" />
        For-heavy
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-mono text-against-400 border border-against-500/30 bg-against-500/10 px-2 py-0.5 rounded-full">
      <ThumbsDown className="h-3 w-3" />
      Against-heavy
    </span>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function UnderratedTopicCard({
  topic,
  rank,
}: {
  topic: UnderratedTopic
  rank: number
}) {
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
          {/* Rank + gem indicator */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="text-[11px] font-mono text-surface-600 tabular-nums">
              #{rank + 1}
            </span>
            <Gem className="h-3.5 w-3.5 text-emerald opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Status + category */}
          <div className="flex items-center gap-2 mb-3 pr-12">
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              <StatusIcon className="h-3 w-3 mr-1 inline" />
              {topic.status === 'voting' ? 'Voting' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
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
              <span className="text-for-400">{forPct}% For</span>
              <span className="text-against-400">{againstPct}% Against</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
              <div
                className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-600"
                style={{ width: `${againstPct}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-surface-500 mt-1.5 text-right tabular-nums">
              {topic.total_votes.toLocaleString()} votes
            </p>
          </div>

          {/* Quality signals */}
          <div className="flex flex-wrap items-center gap-2">
            <ScoreBadge score={topic.avg_ai_score} />
            <BalanceBadge balance={topic.argument_balance} />
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <MessageSquare className="h-3 w-3" />
              {topic.scored_arg_count} scored
              {topic.total_arg_count > topic.scored_arg_count && (
                <span className="text-surface-600"> / {topic.total_arg_count} total</span>
              )}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicCardSkeleton() {
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
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UnderratedTopicsPage() {
  const [topics, setTopics] = useState<UnderratedTopic[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<SortMode>('underrated')
  const [showFilters, setShowFilters] = useState(false)
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
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
        const res = await fetch(`/api/topics/underrated?${params}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('fetch failed')
        const data: UnderratedTopicsResponse = await res.json()
        setTopics(reset ? data.topics : (prev) => [...prev, ...data.topics])
        setTotal(data.total)
      } catch {
        setError('Could not load topics. Please try again.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [category, sort, topics.length],
  )

  useEffect(() => {
    fetchTopics(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort])

  const activeSort = SORT_OPTIONS.find((s) => s.id === sort) ?? SORT_OPTIONS[0]

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
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
              <Gem className="h-6 w-6 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Hidden Gem Topics
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed max-w-xl">
                Civic debates with high-quality arguments that haven&apos;t found
                their audience yet. Topics where the discussion outshines the
                vote count — ranked by argument quality per voter.
              </p>
            </div>
          </div>

          {/* Stats strip */}
          {!loading && topics.length > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-mono text-surface-500">
              <span className="flex items-center gap-1.5">
                <Gem className="h-3.5 w-3.5 text-emerald" />
                <span className="text-white font-semibold">{total}</span> underrated topics found
              </span>
              <span className="flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                All have AI-scored arguments
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                Avg quality ≥ 6/10
              </span>
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
                onClick={() => {
                  setShowSortDropdown((v) => !v)
                  setShowCategoryDropdown(false)
                }}
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

            {/* Category pills (when filters open) */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full overflow-hidden"
                >
                  <div className="flex flex-wrap gap-2 pt-2">
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
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <TopicCardSkeleton key={i} />
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
            icon={Gem}
            title="No hidden gems found"
            description={
              category !== 'all'
                ? `No underrated topics in ${category} right now. Try another category or check back later.`
                : 'No topics meet the quality threshold yet. As more arguments get AI scores, hidden gems will surface here.'
            }
            action={
              category !== 'all'
                ? { label: 'Show all categories', onClick: () => setCategory('all') }
                : undefined
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {topics.map((topic, i) => (
                <UnderratedTopicCard key={topic.id} topic={topic} rank={i} />
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

            {/* End of list */}
            {topics.length >= total && topics.length > 0 && (
              <p className="mt-8 text-center text-xs font-mono text-surface-600">
                All {total} hidden gems shown
              </p>
            )}
          </>
        )}

        {/* ── How it works ─────────────────────────────────────────────── */}
        <div className="mt-12 rounded-2xl border border-surface-300 bg-surface-100 p-6">
          <h2 className="font-mono text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            How underrated score works
          </h2>
          <div className="space-y-2 text-xs font-mono text-surface-500 leading-relaxed">
            <p>
              Topics are scored using:{' '}
              <span className="text-emerald">
                avg_argument_quality × √(scored_args) ÷ log₂(votes + 2)
              </span>
            </p>
            <p>
              A higher score means: strong arguments, active debate, and few
              votes relative to quality. These topics deserve more eyes.
            </p>
            <p>Only topics with ≥ 2 AI-scored arguments (quality ≥ 6/10) qualify.</p>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
