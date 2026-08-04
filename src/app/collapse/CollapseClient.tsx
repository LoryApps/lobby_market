'use client'

/**
 * /collapse — Consensus Collapse
 *
 * Topics where the FOR% has dropped the most in the last 7 days.
 * Shows debates where public opinion dramatically turned — positions that
 * were winning now losing ground. Distinct from:
 *
 *   /battleground  — contested 50/50 right now (not about change)
 *   /trending      — gaining engagement (not about consensus direction)
 *   /rising        — gaining vote velocity (not about consensus reversal)
 *
 * This page answers: "Where did the Lobby change its mind this week?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronRight,
  Clock,
  Flame,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollapseTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  _collapse_drop: number | null
  _collapse_start: number | null
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

interface CollapseResponse {
  topics: CollapseTopic[]
  hasMore: boolean
  total: number
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-surface-400',
  Culture:     'text-pink-400',
  Health:      'text-red-400',
  Education:   'text-amber-400',
  Environment: 'text-emerald',
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type Sort = 'top' | 'new' | 'hot'

const SORTS: { id: Sort; label: string; icon: typeof TrendingDown }[] = [
  { id: 'top', label: 'Biggest Drop', icon: TrendingDown },
  { id: 'hot', label: 'Most Votes',   icon: Flame },
  { id: 'new', label: 'Newest',       icon: Clock },
]

// ─── Collapse card ────────────────────────────────────────────────────────────

function CollapseCard({ topic, index }: { topic: CollapseTopic; index: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const drop = topic._collapse_drop
  const startPct = topic._collapse_start

  const catColor = CAT_COLOR[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border border-surface-300 bg-surface-200/60 backdrop-blur-sm',
          'hover:border-against-500/40 hover:bg-surface-200/80 transition-all duration-150',
          'group'
        )}
      >
        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {topic.category && (
                <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', catColor)}>
                  {topic.category}
                </span>
              )}
              <Badge variant={topic.status as 'proposed' | 'active' | 'voting' | 'law' | 'failed'} />
            </div>

            {/* Drop badge */}
            {drop != null && drop > 0 && (
              <div className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full',
                'bg-against-500/15 border border-against-500/30'
              )}>
                <TrendingDown className="h-3 w-3 text-against-400" />
                <span className="text-[11px] font-mono font-bold text-against-300">
                  −{drop.toFixed(1)}pp
                </span>
              </div>
            )}
          </div>

          {/* Statement */}
          <p className="text-sm font-medium text-surface-800 leading-snug mb-3 line-clamp-2 group-hover:text-white transition-colors">
            {topic.statement}
          </p>

          {/* Vote bar */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-for-400 w-7 text-right tabular-nums">{forPct}%</span>
              <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full transition-all duration-500"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums">{againstPct}%</span>
            </div>

            {/* Start → now indicator */}
            {startPct != null && drop != null && drop > 0 && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] font-mono text-surface-500">
                  Was {Math.round(startPct)}% FOR
                </span>
                <TrendingDown className="h-2.5 w-2.5 text-against-500" />
                <span className="text-[10px] font-mono text-against-400">
                  now {forPct}%
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-for-500" />
                <span className="text-[11px] font-mono text-surface-500">
                  {topic.total_votes?.toLocaleString() ?? 0}
                </span>
              </div>
              {topic.author && (
                <span className="text-[11px] font-mono text-surface-600">
                  by {topic.author.display_name ?? topic.author.username}
                </span>
              )}
            </div>

            <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-against-400 transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CollapseClient() {
  const [topics, setTopics] = useState<CollapseTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const [sort, setSort] = useState<Sort>('top')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (reset = false) => {
    const nextOffset = reset ? 0 : offset
    if (reset) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: String(nextOffset),
        sort,
      })
      const res = await fetch(`/api/feed/collapse?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const json: CollapseResponse = await res.json()

      if (reset) {
        setTopics(json.topics)
      } else {
        setTopics((prev) => [...prev, ...json.topics])
      }
      setHasMore(json.hasMore)
      setOffset(nextOffset + json.topics.length)
    } catch {
      setError('Could not load collapsing debates. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [offset, sort])

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort])

  return (
    <div className="flex flex-col h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="h-5 w-5 text-against-400" />
                <h1 className="text-lg font-mono font-bold text-surface-800">
                  Consensus Collapse
                </h1>
              </div>
              <p className="text-xs font-mono text-surface-500">
                Biggest FOR% drops in the last 7 days
              </p>
            </div>

            <button
              onClick={() => load(true)}
              disabled={loading}
              aria-label="Refresh"
              className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-all"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Sort tabs */}
          <div className="flex items-center gap-0.5 mb-5 bg-surface-200/80 border border-surface-300 rounded-xl p-0.5 w-fit">
            {SORTS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                aria-pressed={sort === id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all duration-150',
                  sort === id
                    ? 'bg-against-500/20 text-against-300 border border-against-500/30 shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 rounded-xl bg-against-500/10 border border-against-500/20">
              <X className="h-4 w-4 text-against-400 flex-shrink-0" />
              <p className="text-sm font-mono text-against-400">{error}</p>
            </div>
          ) : topics.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="No collapses yet"
              description="No debates have experienced significant consensus drops in the last 7 days. Check back as more votes roll in."
              action={{ label: 'Browse all topics', href: '/topics' }}
            />
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-3">
                {topics.map((topic, i) => (
                  <CollapseCard key={topic.id} topic={topic} index={i} />
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <div className="flex justify-center pt-6">
              <button
                onClick={() => load(false)}
                disabled={loadingMore}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-mono font-medium',
                  'bg-surface-200 border border-surface-300 text-surface-600',
                  'hover:bg-surface-300 hover:text-surface-800 transition-all',
                  loadingMore && 'opacity-50 cursor-not-allowed'
                )}
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          {/* Platform links */}
          <div className="flex items-center gap-3 pt-8 pb-2 flex-wrap">
            <Link
              href="/battleground"
              className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <BarChart2 className="h-3 w-3" />
              Battleground
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/trending"
              className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <TrendingUp className="h-3 w-3" />
              Trending
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/topics"
              className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <BarChart2 className="h-3 w-3" />
              All Topics
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
