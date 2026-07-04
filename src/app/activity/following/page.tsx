'use client'

/**
 * /activity/following — Social Activity Feed
 *
 * Shows recent civic actions from users you follow:
 *   • New topics they proposed
 *   • Topics that became active / entered voting / became law
 *   • Arguments they posted (FOR or AGAINST) with the argument text
 *
 * Uses /api/activity/following (NetworkFeedResponse).
 * Empty state when the user follows nobody links to /discover.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Gavel,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
  Zap,
  FileText,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  NetworkEvent,
  NetworkFeedResponse,
  NetworkEventType,
} from '@/app/api/activity/following/route'

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_CFG: Record<
  NetworkEventType,
  { verb: string; icon: typeof Activity; color: string; bg: string; border: string }
> = {
  topic_proposed: {
    verb: 'proposed a new topic',
    icon: FileText,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
  },
  topic_active: {
    verb: 'topic became active',
    icon: Zap,
    color: 'text-for-300',
    bg: 'bg-for-600/15',
    border: 'border-for-600/25',
  },
  topic_voting: {
    verb: 'topic entered final vote',
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
  },
  law_established: {
    verb: 'topic became law',
    icon: Gavel,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
  },
  argument_posted: {
    verb: 'posted an argument',
    icon: MessageSquare,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
  },
}

// ─── Status badge variant ─────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Role display ─────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diff = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
  if (diff < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function groupByDay(events: NetworkEvent[]) {
  const buckets = new Map<string, NetworkEvent[]>()
  for (const ev of events) {
    const label = dayLabel(ev.timestamp)
    const bucket = buckets.get(label) ?? []
    bucket.push(ev)
    buckets.set(label, bucket)
  }
  return Array.from(buckets.entries()).map(([label, evs]) => ({ label, events: evs }))
}

// ─── Single event card ────────────────────────────────────────────────────────

function EventCard({ event, index }: { event: NetworkEvent; index: number }) {
  const cfg = EVENT_CFG[event.type]
  const Icon = cfg.icon
  const actor = event.actor
  const topic = event.topic
  const arg = event.argument ?? null
  const forPct = Math.round(topic.blue_pct ?? 50)

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.5) }}
      className={cn(
        'rounded-2xl bg-surface-100 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-200/50 transition-all duration-150',
        'overflow-hidden'
      )}
    >
      {/* Actor row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <Link
          href={`/profile/${actor.username}`}
          className="relative flex-shrink-0"
          aria-label={`View ${actor.display_name ?? actor.username}'s profile`}
        >
          <Avatar
            src={actor.avatar_url}
            fallback={actor.display_name ?? actor.username}
            size="sm"
          />
          {/* Event type dot */}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center',
              'rounded-full border-2 border-surface-100',
              cfg.bg
            )}
          >
            <Icon className={cn('h-2 w-2', cfg.color)} aria-hidden="true" />
          </span>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <Link
              href={`/profile/${actor.username}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate max-w-[130px]"
            >
              {actor.display_name ?? actor.username}
            </Link>
            <span className="text-xs text-surface-500">{cfg.verb}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono text-surface-600">
              @{actor.username}
            </span>
            <span className="text-surface-700">·</span>
            <span className="text-[10px] font-mono text-surface-600">
              {ROLE_LABEL[actor.role] ?? actor.role}
            </span>
            <span className="text-surface-700">·</span>
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(event.timestamp)}
            </span>
          </div>
        </div>
      </div>

      {/* Topic card */}
      <Link
        href={`/topic/${topic.id}`}
        className="block mx-4 mb-3 rounded-xl bg-surface-50 border border-surface-300 p-3 hover:border-surface-400 transition-colors"
      >
        <div className="flex items-start gap-2 mb-2">
          <Badge
            variant={STATUS_BADGE[topic.status] ?? 'proposed'}
            size="sm"
          >
            {topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
          </Badge>
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500 pt-0.5">
              {topic.category}
            </span>
          )}
        </div>

        <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-300"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-for-400 flex-shrink-0 w-14 text-right">
            {forPct}% For
          </span>
        </div>
      </Link>

      {/* Argument preview (only for argument_posted events) */}
      {arg && (
        <div
          className={cn(
            'mx-4 mb-4 rounded-xl p-3 border',
            arg.side === 'blue'
              ? 'bg-for-500/8 border-for-500/20'
              : 'bg-against-500/8 border-against-500/20'
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            {arg.side === 'blue' ? (
              <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
            ) : (
              <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" aria-hidden="true" />
            )}
            <span
              className={cn(
                'text-[10px] font-mono font-semibold uppercase tracking-wider',
                arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
              )}
            >
              {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
            {arg.upvotes > 0 && (
              <>
                <span className="text-surface-700">·</span>
                <span className="text-[10px] font-mono text-surface-500">
                  {arg.upvotes} upvote{arg.upvotes !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>
          <p className="text-xs text-surface-300 leading-relaxed line-clamp-3">
            &ldquo;{arg.content}&rdquo;
          </p>
          <Link
            href={`/topic/${topic.id}/argue`}
            className={cn(
              'inline-flex items-center gap-1 mt-2 text-[10px] font-mono',
              'hover:underline transition-colors',
              arg.side === 'blue' ? 'text-for-500' : 'text-against-500'
            )}
          >
            View full argument
            <ArrowRight className="h-2.5 w-2.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </motion.article>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-3">
            <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="mx-4 mb-4 rounded-xl bg-surface-50 border border-surface-300 p-3 space-y-2">
            <Skeleton className="h-3 w-16 rounded-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-1.5 w-full rounded-full mt-2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty: not following anyone ──────────────────────────────────────────────

function NotFollowingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 mb-4">
        <Users className="h-6 w-6 text-surface-500" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-bold text-white font-mono mb-2">
        No one to follow yet
      </h2>
      <p className="text-sm text-surface-500 max-w-xs mb-6">
        Follow citizens whose civic takes you admire. Their topic proposals and arguments will appear here.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/discover"
          className="flex items-center justify-center gap-2 h-10 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          Discover citizens to follow
        </Link>
        <Link
          href="/leaderboard"
          className="flex items-center justify-center gap-2 h-10 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-sm font-mono transition-colors"
        >
          View leaderboard
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

// ─── Empty: following but no activity ────────────────────────────────────────

function NoActivityState({ count }: { count: number }) {
  return (
    <EmptyState
      icon={Activity}
      title="No recent activity"
      description={`The ${count} citizen${count !== 1 ? 's' : ''} you follow haven't posted arguments or proposed topics in the last 30 days.`}
      actions={[
        { label: 'Discover more citizens', href: '/discover' },
        { label: 'See platform activity', href: '/activity' },
      ]}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FollowingActivityPage() {
  const [data, setData] = useState<NetworkFeedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/activity/following?limit=60', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load following activity')
      const json = (await res.json()) as NetworkFeedResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchFeed()
    pollRef.current = setInterval(() => fetchFeed(), 90_000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchFeed])

  const events = data?.events ?? []
  const followingCount = data?.followingCount ?? 0
  const isEmpty = data?.isEmpty ?? false
  const grouped = groupByDay(events)

  let globalIdx = 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/activity"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to activity"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-white font-mono">
                Following
              </h1>
              {followingCount > 0 && (
                <span className="text-[10px] font-mono font-semibold text-surface-500 bg-surface-300 px-2 py-0.5 rounded-full">
                  {followingCount} followed
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Recent civic activity from citizens you follow
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/discover"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Discover more citizens to follow"
              title="Discover citizens"
            >
              <UserPlus className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => fetchFeed(true)}
              disabled={refreshing}
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                refreshing && 'opacity-50 cursor-not-allowed'
              )}
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Activity / platform toggle */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-6" role="tablist">
          <Link
            href="/activity"
            role="tab"
            aria-selected={false}
            className="flex-1 flex items-center justify-center h-8 rounded-lg text-xs font-mono font-medium text-surface-500 hover:text-surface-300 transition-colors"
          >
            Platform
          </Link>
          <span
            role="tab"
            aria-selected={true}
            className="flex-1 flex items-center justify-center h-8 rounded-lg text-xs font-mono font-medium bg-surface-100 text-white shadow-sm"
          >
            Following
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error} ·{' '}
            <button
              type="button"
              onClick={() => fetchFeed(true)}
              className="underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <FeedSkeleton />}

        {/* Not following anyone */}
        {!loading && isEmpty && followingCount === 0 && <NotFollowingState />}

        {/* Following but no activity */}
        {!loading && isEmpty && followingCount > 0 && (
          <NoActivityState count={followingCount} />
        )}

        {/* Feed */}
        {!loading && events.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="feed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-8"
            >
              {grouped.map(({ label, events: groupEvents }) => {
                const startIdx = globalIdx
                globalIdx += groupEvents.length
                return (
                  <div key={label}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                        {label}
                      </span>
                      <div className="flex-1 h-px bg-surface-300" aria-hidden="true" />
                    </div>
                    <div className="space-y-3">
                      {groupEvents.map((ev, i) => (
                        <EventCard key={ev.id} event={ev} index={startIdx + i} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Polling indicator */}
        {refreshing && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-surface-200 border border-surface-300 shadow-lg text-xs font-mono text-surface-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing…
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
