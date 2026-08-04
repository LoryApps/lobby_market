'use client'

/**
 * /argued — Most Argued Topics
 *
 * A live leaderboard of topics ranked by argument activity in the last 24h.
 * Distinct from:
 *   /top-arguments  — best individual arguments (not topic-level)
 *   /discussions    — active reply threads
 *   /battleground   — vote-split contests (not argument count)
 *   /rising         — vote velocity (not argument activity)
 *
 * This is the place to find the debates with the most intellectual heat.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
  Gavel,
  FileText,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicWithAuthor } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArguedTopic extends TopicWithAuthor {
  _argued_count: number | null
  _argued_authors: number | null
  _argued_upvotes: number | null
}

interface ArguedResponse {
  topics: ArguedTopic[]
  hasMore: boolean
  total: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const STATUS_ICON: Record<string, typeof FileText> = {
  proposed: FileText,
  active: Zap,
  voting: Scale,
  law: Gavel,
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
}

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCatStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
      <span className="text-xs font-mono font-bold text-gold">1</span>
    </div>
  )
  if (rank === 2) return (
    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-surface-300/60 border border-surface-400/60 flex items-center justify-center">
      <span className="text-xs font-mono font-bold text-surface-400">2</span>
    </div>
  )
  if (rank === 3) return (
    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-against-500/20 border border-against-500/30 flex items-center justify-center">
      <span className="text-xs font-mono font-bold text-against-400">3</span>
    </div>
  )
  return (
    <div className="flex-shrink-0 h-7 w-7 rounded-full bg-surface-200/60 border border-surface-300/40 flex items-center justify-center">
      <span className="text-xs font-mono text-surface-500">{rank}</span>
    </div>
  )
}

// ─── Topic Row ────────────────────────────────────────────────────────────────

function ArguedTopicRow({ topic, rank }: { topic: ArguedTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const catStyle = getCatStyle(topic.category)
  const StatusIcon = STATUS_ICON[topic.status] ?? FileText

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.5) }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div className={cn(
          'rounded-2xl border transition-all duration-200',
          'bg-surface-100 border-surface-300/60',
          'hover:border-purple/40 hover:bg-surface-200/60',
          rank <= 3 && 'border-purple/20'
        )}>
          <div className="p-4 flex items-start gap-3">
            {/* Rank */}
            <RankBadge rank={rank} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                {topic.category && (
                  <span className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border',
                    catStyle.text, catStyle.bg, catStyle.border
                  )}>
                    {topic.category}
                  </span>
                )}
                <span className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border',
                  'text-surface-500 bg-surface-200/60 border-surface-400/40'
                )}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {STATUS_LABEL[topic.status] ?? topic.status}
                </span>
                <span className="text-[10px] font-mono text-surface-500">
                  {relativeTime(topic.created_at)}
                </span>
              </div>

              {/* Statement */}
              <p className="text-sm font-medium text-white leading-snug mb-2 line-clamp-2 group-hover:text-purple transition-colors">
                {topic.statement}
              </p>

              {/* Vote bar */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="flex items-center gap-1 text-[11px] font-mono text-for-400">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  <span>{forPct}%</span>
                </div>
                <div className="flex-1 h-1 rounded-full bg-surface-300/60 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                    style={{ width: `${forPct}%` }}
                  />
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-against-400">
                  <span>{againstPct}%</span>
                  <ThumbsDown className="h-2.5 w-2.5" />
                </div>
              </div>

              {/* Argument stats */}
              <div className="flex flex-wrap items-center gap-3">
                {topic._argued_count != null && topic._argued_count > 0 ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-purple">
                      <MessageSquare className="h-3 w-3" />
                      <span className="font-bold">{topic._argued_count}</span>
                      <span className="text-purple/70">
                        {topic._argued_count === 1 ? 'argument' : 'arguments'} today
                      </span>
                    </div>
                    {topic._argued_authors != null && topic._argued_authors > 1 && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                        <Users className="h-3 w-3" />
                        <span>{topic._argued_authors} voices</span>
                      </div>
                    )}
                    {topic._argued_upvotes != null && topic._argued_upvotes > 0 && (
                      <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                        <Flame className="h-3 w-3" />
                        <span>{topic._argued_upvotes} upvotes</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
                    <MessageSquare className="h-3 w-3" />
                    <span>{topic.total_arguments ?? 0} total arguments</span>
                  </div>
                )}

                <div className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500">
                  <span>{(topic.total_votes ?? 0).toLocaleString()} votes</span>
                  <ChevronRight className="h-3 w-3 group-hover:text-purple transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom accent for top 3 */}
          {rank <= 3 && (
            <div className="h-0.5 bg-gradient-to-r from-purple/30 via-purple/50 to-transparent rounded-b-2xl" />
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArguedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-surface-300/40 animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-16 rounded bg-surface-300/40 animate-pulse" />
                <div className="h-4 w-12 rounded bg-surface-300/40 animate-pulse" />
              </div>
              <div className="h-4 w-full rounded bg-surface-300/40 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-surface-300/40 animate-pulse" />
              <div className="h-1 w-full rounded bg-surface-300/40 animate-pulse" />
              <div className="flex gap-3">
                <div className="h-3 w-20 rounded bg-surface-300/40 animate-pulse" />
                <div className="h-3 w-16 rounded bg-surface-300/40 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ArguedClient() {
  const [topics, setTopics] = useState<ArguedTopic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPage = useCallback(async (pageOffset: number, silent = false) => {
    if (!silent) {
      if (pageOffset === 0) setIsLoading(true)
      else setLoadingMore(true)
    } else {
      setIsRefreshing(true)
    }

    try {
      const params = new URLSearchParams({ limit: '20', offset: String(pageOffset) })
      const res = await fetch(`/api/feed/argued?${params}`)
      if (!res.ok) return

      const data: ArguedResponse = await res.json()

      if (pageOffset === 0) {
        setTopics(data.topics)
      } else {
        setTopics((prev) => [...prev, ...data.topics])
      }
      setHasMore(data.hasMore)
      setTotal(data.total)
      setOffset(pageOffset + data.topics.length)
    } finally {
      setIsLoading(false)
      setLoadingMore(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPage(0)
    pollRef.current = setInterval(() => fetchPage(0, true), POLL_INTERVAL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchPage])

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-purple" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Most Argued</h1>
                  <p className="text-[11px] font-mono text-surface-500">
                    {total > 0 ? `${total} topics` : 'Loading...'} · last 24 hours
                  </p>
                </div>
              </div>

              <button
                onClick={() => fetchPage(0, true)}
                disabled={isRefreshing}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                  'border border-surface-400/40 text-surface-400',
                  'hover:border-purple/40 hover:text-purple transition-all',
                  'disabled:opacity-50'
                )}
              >
                <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>

            <p className="text-xs text-surface-500 leading-relaxed">
              Topics ranked by argument velocity — the most arguments posted by the most voices in the last 24 hours.
              Not just hot takes: weighted by unique contributors and upvotes to surface genuine intellectual heat.
            </p>
          </div>

          {/* Feed to main */}
          <div className="flex items-center gap-2">
            <Link
              href="/?mode=argued"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-purple/10 border border-purple/30 text-purple',
                'hover:bg-purple/20 transition-all'
              )}
            >
              <ArrowRight className="h-3 w-3" />
              View in feed
            </Link>
            <Link
              href="/discussions"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'border border-surface-400/40 text-surface-400',
                'hover:border-purple/30 hover:text-purple transition-all'
              )}
            >
              <MessageSquare className="h-3 w-3" />
              Live discussions
            </Link>
            <Link
              href="/top-arguments"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'border border-surface-400/40 text-surface-400',
                'hover:border-purple/30 hover:text-purple transition-all'
              )}
            >
              <Flame className="h-3 w-3" />
              Top arguments
            </Link>
          </div>

          {/* List */}
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ArguedSkeleton />
              </motion.div>
            ) : topics.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <EmptyState
                  icon={MessageSquare}
                  title="No arguments yet"
                  description="No arguments have been posted in the last 24 hours. Check back soon — the debate is always warming up."
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                {topics.map((topic, i) => (
                  <ArguedTopicRow key={topic.id} topic={topic} rank={i + 1} />
                ))}

                {hasMore && (
                  <div className="pt-2 flex justify-center">
                    <button
                      onClick={() => fetchPage(offset)}
                      disabled={loadingMore}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono',
                        'bg-surface-200/60 border border-surface-300/60',
                        'hover:border-purple/40 hover:text-purple text-surface-400 transition-all',
                        'disabled:opacity-50'
                      )}
                    >
                      {loadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>Load more</>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      <BottomNav />
    </div>
  )
}
