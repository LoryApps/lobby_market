'use client'

/**
 * /most-reacted — Community Reactions Hub
 *
 * Surfaces topics the community has tagged with an emotional/qualitative
 * reaction beyond their raw vote count. Reactions:
 *   💡 Insightful  — the argument opened minds
 *   🔥 Controversial — strong feelings on both sides
 *   ⚖️  Complex      — nuanced, hard to reduce to yes/no
 *   😮 Surprising  — outcome or argument caught people off guard
 *
 * Distinct from:
 *   /vortex     — argument intensity per voter
 *   /flashpoint — most contested vote splits
 *   /trending   — algorithmic feed_score
 *   /top-arguments — individual argument rankings
 *
 * Uses GET /api/topics/most-reacted?reaction=<type>&limit=<n>
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Lightbulb,
  RefreshCw,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ReactionSummary } from '@/app/api/topics/most-reacted/route'

// ─── Reaction config ───────────────────────────────────────────────────────────

type ReactionType = 'insightful' | 'controversial' | 'complex' | 'surprising'
type FilterMode = 'all' | ReactionType

interface ReactionConfig {
  emoji: string
  label: string
  description: string
  pill: string
  activePill: string
  bar: string
}

const REACTION_CONFIG: Record<ReactionType, ReactionConfig> = {
  insightful: {
    emoji: '💡',
    label: 'Insightful',
    description: 'Opened minds',
    pill: 'border-gold/30 text-gold/70',
    activePill: 'bg-gold/20 border-gold/60 text-gold',
    bar: 'bg-gold',
  },
  controversial: {
    emoji: '🔥',
    label: 'Controversial',
    description: 'Strong feelings',
    pill: 'border-against-500/30 text-against-400/70',
    activePill: 'bg-against-500/20 border-against-500/60 text-against-300',
    bar: 'bg-against-500',
  },
  complex: {
    emoji: '⚖️',
    label: 'Complex',
    description: 'Hard to reduce',
    pill: 'border-purple/30 text-purple/70',
    activePill: 'bg-purple/20 border-purple/60 text-purple',
    bar: 'bg-purple',
  },
  surprising: {
    emoji: '😮',
    label: 'Surprising',
    description: 'Caught people off guard',
    pill: 'border-for-500/30 text-for-400/70',
    activePill: 'bg-for-500/20 border-for-500/60 text-for-300',
    bar: 'bg-for-500',
  },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-purple',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Reaction mini-bar ────────────────────────────────────────────────────────

function ReactionBar({ reactions, total }: { reactions: Record<ReactionType, number>; total: number }) {
  if (total === 0) return null
  const order: ReactionType[] = ['insightful', 'controversial', 'complex', 'surprising']
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {order.map((type) => {
        const count = reactions[type]
        if (count === 0) return null
        const pct = Math.round((count / total) * 100)
        const cfg = REACTION_CONFIG[type]
        return (
          <span
            key={type}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
              cfg.pill,
            )}
            aria-label={`${count} ${cfg.label}`}
          >
            <span aria-hidden="true">{cfg.emoji}</span>
            <span>{count}</span>
            <span className="opacity-60">({pct}%)</span>
          </span>
        )
      })}
    </div>
  )
}

// ─── Topic card ────────────────────────────────────────────────────────────────

function TopicCard({ topic, rank }: { topic: ReactionSummary; rank: number }) {
  const topReactionType = Object.entries(topic.reactions)
    .sort((a, b) => b[1] - a[1])
    .find(([, v]) => v > 0)?.[0] as ReactionType | undefined

  const topCfg = topReactionType ? REACTION_CONFIG[topReactionType] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
    >
      <Link
        href={`/topic/${topic.topic_id}`}
        className={cn(
          'block rounded-2xl bg-surface-100 border border-surface-300 p-4',
          'hover:border-surface-400 transition-all group',
        )}
        aria-label={`Topic: ${topic.statement} — ${topic.total_reactions} reactions`}
      >
        {/* Rank + meta row */}
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-mono font-bold text-surface-600 w-5 text-right flex-shrink-0"
              aria-label={`Rank ${rank}`}
            >
              {rank}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {topic.category && (
                <span
                  className={cn(
                    'text-[11px] font-mono font-semibold uppercase tracking-wider',
                    CATEGORY_COLOR[topic.category] ?? 'text-surface-400',
                  )}
                >
                  {topic.category}
                </span>
              )}
              {topic.category && (
                <span className="text-surface-600" aria-hidden="true">·</span>
              )}
              <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
                {STATUS_LABEL[topic.status] ?? topic.status}
              </Badge>
            </div>
          </div>

          {/* Top reaction badge */}
          {topCfg && topReactionType && (
            <span
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
                topCfg.activePill,
              )}
              aria-label={`Mostly ${topCfg.label}`}
            >
              <span aria-hidden="true">{topCfg.emoji}</span>
              {topCfg.label}
            </span>
          )}
        </div>

        {/* Statement */}
        <p className="text-white text-sm font-medium leading-snug mb-3 group-hover:text-white/90 transition-colors">
          {topic.statement}
        </p>

        {/* Reaction breakdown */}
        <ReactionBar reactions={topic.reactions} total={topic.total_reactions} />

        {/* Footer stats */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-300/60">
          <div className="flex items-center gap-3 text-[11px] text-surface-500 font-mono">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {formatCount(topic.total_votes)} votes
            </span>
            <span>
              <span className="text-for-400">{topic.blue_pct.toFixed(0)}%</span>
              {' '}FOR
            </span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-surface-500">
            <span className="font-semibold text-surface-400">{topic.total_reactions}</span>
            {' '}reactions
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TopicSkeleton({ i }: { i: number }) {
  return (
    <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-3 w-5 rounded bg-surface-300 animate-pulse" />
        <div className="h-4 w-20 rounded-full bg-surface-300 animate-pulse" />
        <div className="h-4 w-12 rounded-full bg-surface-300 animate-pulse" />
      </div>
      <div className="h-4 w-full rounded bg-surface-300 animate-pulse" />
      <div className="h-4 w-4/5 rounded bg-surface-300 animate-pulse" />
      <div className="flex gap-1.5">
        <div className="h-5 w-20 rounded-full bg-surface-300 animate-pulse" />
        <div className="h-5 w-24 rounded-full bg-surface-300 animate-pulse" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MostReactedClient() {
  const [filter, setFilter] = useState<FilterMode>('all')
  const [topics, setTopics] = useState<ReactionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchTopics = useCallback(async (mode: FilterMode, isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true)
    } else {
      setIsLoading(true)
    }

    try {
      const params = new URLSearchParams({ limit: '30' })
      if (mode !== 'all') params.set('reaction', mode)
      const res = await fetch(`/api/topics/most-reacted?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json() as { topics: ReactionSummary[] }
      setTopics(data.topics ?? [])
    } catch {
      setTopics([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchTopics('all')
  }, [fetchTopics])

  const handleFilter = (mode: FilterMode) => {
    setFilter(mode)
    fetchTopics(mode)
  }

  const handleRefresh = () => {
    fetchTopics(filter, true)
  }

  const filterOptions: { id: FilterMode; label: string; emoji?: string }[] = [
    { id: 'all', label: 'All reactions' },
    { id: 'insightful', label: 'Insightful', emoji: '💡' },
    { id: 'controversial', label: 'Controversial', emoji: '🔥' },
    { id: 'complex', label: 'Complex', emoji: '⚖️' },
    { id: 'surprising', label: 'Surprising', emoji: '😮' },
  ]

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 px-4 pt-4 pb-24 max-w-lg mx-auto w-full space-y-4">

        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                aria-label="Back to feed"
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
              <h1 className="text-lg font-bold text-white">Community Reactions</h1>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              aria-label="Refresh"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
                aria-hidden="true"
              />
            </button>
          </div>
          <p className="text-sm text-surface-500 pl-10">
            Topics the community marked as particularly noteworthy — beyond just vote counts.
          </p>
        </div>

        {/* Filter chips */}
        <div
          role="group"
          aria-label="Filter by reaction type"
          className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none"
        >
          {filterOptions.map(({ id, label, emoji }) => {
            const isActive = filter === id
            const cfg = id !== 'all' ? REACTION_CONFIG[id as ReactionType] : null
            return (
              <button
                key={id}
                onClick={() => handleFilter(id)}
                aria-pressed={isActive}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  isActive
                    ? id === 'all'
                      ? 'bg-surface-300 border-surface-400 text-white'
                      : cfg?.activePill
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400/60',
                )}
              >
                {emoji && <span aria-hidden="true">{emoji}</span>}
                {label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
              aria-label="Loading topics"
              aria-busy="true"
            >
              {Array.from({ length: 6 }, (_, i) => (
                <TopicSkeleton key={i} i={i} />
              ))}
            </motion.div>
          ) : topics.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Lightbulb}
                title="No reactions yet"
                description={
                  filter === 'all'
                    ? 'No topics have been reacted to yet. Be the first to mark a topic as insightful, controversial, complex, or surprising.'
                    : `No topics have been marked as "${filter}" yet. Try a different filter.`
                }
                action={
                  filter !== 'all'
                    ? { label: 'Show all reactions', onClick: () => handleFilter('all') }
                    : { label: 'Browse topics', href: '/topics' }
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key={`list-${filter}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
              aria-label={`${topics.length} topics with community reactions`}
              role="list"
            >
              {topics.map((topic, i) => (
                <div key={topic.topic_id} role="listitem">
                  <TopicCard topic={topic} rank={i + 1} />
                </div>
              ))}

              {/* Footer CTA */}
              <div className="pt-2 pb-4 text-center">
                <p className="text-xs text-surface-600 mb-3">
                  React to topics from their debate page
                </p>
                <div className="flex items-center justify-center gap-4 text-[11px] text-surface-600">
                  <Link href="/topics" className="hover:text-surface-400 transition-colors">
                    Browse all topics
                  </Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/trending" className="hover:text-surface-400 transition-colors">
                    Trending now
                  </Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/vortex" className="hover:text-surface-400 transition-colors">
                    Argument vortex
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
