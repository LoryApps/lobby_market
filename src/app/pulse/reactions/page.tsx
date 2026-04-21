'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  RefreshCw,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopicReactions } from '@/components/topic/TopicReactions'
import { cn } from '@/lib/utils/cn'
import type { ReactionSummary } from '@/app/api/topics/most-reacted/route'

// ─── Reaction config ──────────────────────────────────────────────────────────

type ReactionFilter = 'all' | 'insightful' | 'controversial' | 'complex' | 'surprising'

interface TabConfig {
  id: ReactionFilter
  emoji: string
  label: string
  description: string
  activeClass: string
}

const TABS: TabConfig[] = [
  {
    id: 'all',
    emoji: '📊',
    label: 'All',
    description: 'Most-reacted topics overall',
    activeClass: 'bg-surface-300 text-white border-surface-400',
  },
  {
    id: 'insightful',
    emoji: '💡',
    label: 'Insightful',
    description: 'Topics the community finds illuminating',
    activeClass: 'bg-gold/20 text-gold border-gold/50',
  },
  {
    id: 'controversial',
    emoji: '🔥',
    label: 'Controversial',
    description: 'The most divisive debates right now',
    activeClass: 'bg-against-500/20 text-against-300 border-against-500/50',
  },
  {
    id: 'complex',
    emoji: '⚖️',
    label: 'Complex',
    description: 'Topics with no easy answer',
    activeClass: 'bg-purple/20 text-purple border-purple/50',
  },
  {
    id: 'surprising',
    emoji: '😮',
    label: 'Surprising',
    description: 'Results and arguments that shocked the Lobby',
    activeClass: 'bg-for-500/20 text-for-300 border-for-500/50',
  },
]

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  rank,
}: {
  topic: ReactionSummary
  rank: number
}) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.25 }}
    >
      <Link
        href={`/topic/${topic.topic_id}`}
        className={cn(
          'block rounded-2xl bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/50 transition-colors',
          'p-4 space-y-3'
        )}
      >
        {/* Rank + statement */}
        <div className="flex items-start gap-3">
          <span className="text-2xl font-mono font-bold text-surface-400 w-8 flex-shrink-0 tabular-nums">
            {rank}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
              {topic.statement}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {topic.category && (
                <span className="text-[11px] font-mono text-surface-500">
                  {topic.category}
                </span>
              )}
              <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px]">
                {STATUS_LABEL[topic.status] ?? topic.status}
              </Badge>
            </div>
          </div>
          {/* Total reaction count */}
          <div className="flex-shrink-0 text-right">
            <span className="text-lg font-mono font-bold text-white">
              {topic.total_reactions}
            </span>
            <p className="text-[10px] font-mono text-surface-500">reactions</p>
          </div>
        </div>

        {/* Vote bar */}
        <div className="space-y-1">
          <div className="relative h-2 rounded-full overflow-hidden bg-surface-300">
            <div
              className="absolute inset-y-0 left-0 bg-for-600 rounded-l-full"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-against-600 rounded-r-full"
              style={{ width: `${againstPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-surface-500">
            <span className="text-for-400">{forPct}% For</span>
            <span className="text-surface-600">
              {topic.total_votes.toLocaleString()} votes
            </span>
            <span className="text-against-400">{againstPct}% Against</span>
          </div>
        </div>

        {/* Reactions strip */}
        <div onClick={(e) => e.preventDefault()}>
          <TopicReactions
            topicId={topic.topic_id}
            initialCounts={topic.reactions as Record<'insightful' | 'controversial' | 'complex' | 'surprising', number>}
            size="sm"
          />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-8 w-12 flex-shrink-0 rounded-lg" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-14 rounded-full" />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReactionsLeaderboardPage() {
  const [activeFilter, setActiveFilter] = useState<ReactionFilter>('controversial')
  const [topics, setTopics] = useState<ReactionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadTopics = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams({ limit: '25' })
        if (activeFilter !== 'all') params.set('reaction', activeFilter)
        const res = await fetch(`/api/topics/most-reacted?${params}`)
        const data = await res.json()
        setTopics(data.topics ?? [])
      } catch {
        setTopics([])
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [activeFilter]
  )

  useEffect(() => {
    loadTopics()
  }, [loadTopics])

  const activeTab = TABS.find((t) => t.id === activeFilter) ?? TABS[0]

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 pb-20">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-surface-100/95 border-b border-surface-300 backdrop-blur-sm">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3 mb-3">
              <Link
                href="/pulse"
                className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
                aria-label="Back to Pulse"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <h1 className="text-lg font-mono font-bold text-white">
                  Community Reactions
                </h1>
                <p className="text-xs text-surface-500 font-mono">
                  {activeTab.description}
                </p>
              </div>
              <button
                onClick={() => loadTopics(true)}
                disabled={refreshing}
                className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </button>
            </div>

            {/* Filter tabs */}
            <div
              className={cn(
                'flex items-center gap-1.5 overflow-x-auto pb-1',
                '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
              )}
            >
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  aria-pressed={activeFilter === tab.id}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
                    'border text-xs font-mono font-medium transition-all',
                    activeFilter === tab.id
                      ? tab.activeClass
                      : 'bg-surface-200/60 text-surface-500 border-transparent hover:text-surface-300'
                  )}
                >
                  <span aria-hidden="true">{tab.emoji}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : topics.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              iconColor="text-surface-500"
              title="No reactions yet"
              description="Be the first to react to a topic — use the 💡🔥⚖️😮 buttons on any topic card."
              size="md"
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFilter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {topics.map((topic, i) => (
                  <TopicRow
                    key={topic.topic_id}
                    topic={topic}
                    rank={i + 1}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
