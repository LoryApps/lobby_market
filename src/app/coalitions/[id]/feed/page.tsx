'use client'

/**
 * /coalitions/[id]/feed — Coalition Activity Feed
 *
 * A live stream of everything coalition members have been doing:
 * votes cast, arguments posted, bulletin announcements, and new
 * members who joined. Events merge into a single chronological
 * feed so coalition members can feel the pulse of the group.
 *
 * Distinct from:
 *   /coalitions/[id]/timeline    — milestone events only (founded, wins)
 *   /coalitions/[id]/war-room    — tactical management dashboard
 *   /coalitions/[id]/analytics   — aggregate stats, not a live feed
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  Crown,
  Loader2,
  MessageSquare,
  Pin,
  RefreshCw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CoalitionFeedResponse, FeedEvent, FeedEventType } from '@/app/api/coalitions/[id]/feed/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const COALITION_ROLE_ICON: Record<string, typeof Crown> = {
  leader: Crown,
  officer: Shield,
  member: Users,
}
const COALITION_ROLE_COLOR: Record<string, string> = {
  leader: 'text-gold',
  officer: 'text-for-400',
  member: 'text-surface-500',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-for-300',
  Philosophy: 'text-purple',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

const FILTER_TABS: { label: string; value: FeedEventType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Votes', value: 'vote' },
  { label: 'Arguments', value: 'argument' },
  { label: 'Posts', value: 'post' },
  { label: 'Joins', value: 'join' },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ─── Event cards ──────────────────────────────────────────────────────────────

function ActorLine({ event }: { event: FeedEvent }) {
  const RoleIcon = COALITION_ROLE_ICON[event.actor.coalition_role] ?? Users
  const roleColor = COALITION_ROLE_COLOR[event.actor.coalition_role] ?? 'text-surface-500'
  return (
    <Link
      href={`/profile/${event.actor.username}`}
      className="flex items-center gap-2.5 group"
    >
      <Avatar
        src={event.actor.avatar_url}
        fallback={event.actor.display_name ?? event.actor.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors truncate">
            {event.actor.display_name ?? event.actor.username}
          </span>
          <RoleIcon className={cn('h-3 w-3 flex-shrink-0', roleColor)} />
        </div>
        <p className="text-[10px] font-mono text-surface-500">
          @{event.actor.username}
        </p>
      </div>
      <time className="text-[10px] font-mono text-surface-600 flex-shrink-0">
        {relativeTime(event.timestamp)}
      </time>
    </Link>
  )
}

function VoteCard({ event }: { event: FeedEvent }) {
  const isFor = event.vote_side === 'for'
  const catColor = CATEGORY_COLOR[event.topic_category ?? ''] ?? 'text-surface-500'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        isFor
          ? 'bg-for-900/20 border-for-700/30 hover:border-for-600/50'
          : 'bg-against-900/20 border-against-700/30 hover:border-against-600/50'
      )}
    >
      <ActorLine event={event} />
      <div className="flex items-start gap-2.5 pl-0.5">
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border mt-0.5',
          isFor ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'
        )}>
          {isFor
            ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
            : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1">
            <span className={isFor ? 'text-for-400' : 'text-against-400'}>
              voted {isFor ? 'for' : 'against'}
            </span>
          </p>
          {event.topic_id ? (
            <Link
              href={`/topic/${event.topic_id}`}
              className="text-xs font-mono text-surface-300 hover:text-white transition-colors line-clamp-2"
            >
              {event.topic_statement}
            </Link>
          ) : (
            <p className="text-xs font-mono text-surface-400 line-clamp-2">
              {event.topic_statement}
            </p>
          )}
          {event.topic_category && (
            <span className={cn('text-[10px] font-mono mt-1 block', catColor)}>
              {event.topic_category}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function ArgumentCard({ event }: { event: FeedEvent }) {
  const isFor = event.argument_side === 'for'
  const catColor = CATEGORY_COLOR[event.topic_category ?? ''] ?? 'text-surface-500'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 space-y-3 transition-colors"
    >
      <ActorLine event={event} />
      <div className="flex items-start gap-2.5 pl-0.5">
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border mt-0.5',
          isFor ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'
        )}>
          <MessageSquare className={cn('h-3.5 w-3.5', isFor ? 'text-for-400' : 'text-against-400')} />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-mono uppercase tracking-widest">
              <span className={isFor ? 'text-for-400' : 'text-against-400'}>
                argued {isFor ? 'for' : 'against'}
              </span>
            </p>
            {(event.argument_upvotes ?? 0) > 0 && (
              <span className="text-[10px] font-mono text-gold">
                +{event.argument_upvotes} upvotes
              </span>
            )}
          </div>
          {event.topic_id && (
            <Link
              href={`/topic/${event.topic_id}`}
              className="text-[10px] font-mono text-surface-500 hover:text-surface-400 transition-colors block truncate"
            >
              on: {event.topic_statement}
            </Link>
          )}
          {event.topic_category && (
            <span className={cn('text-[10px] font-mono', catColor)}>
              {event.topic_category}
            </span>
          )}
          {event.argument_body && (
            <blockquote className="text-xs font-mono text-surface-300 border-l-2 border-surface-500 pl-3 line-clamp-3">
              {event.argument_body}{event.argument_body.length >= 200 ? '…' : ''}
            </blockquote>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function PostCard({ event }: { event: FeedEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3 transition-colors',
        event.post_is_pinned
          ? 'bg-gold/5 border-gold/20 hover:border-gold/40'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      <ActorLine event={event} />
      <div className="flex items-start gap-2.5 pl-0.5">
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border mt-0.5',
          event.post_is_pinned ? 'bg-gold/10 border-gold/30' : 'bg-surface-200 border-surface-400'
        )}>
          {event.post_is_pinned
            ? <Pin className="h-3.5 w-3.5 text-gold" />
            : <MessageSquare className="h-3.5 w-3.5 text-surface-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1">
            <span className={event.post_is_pinned ? 'text-gold' : 'text-surface-500'}>
              {event.post_is_pinned ? 'pinned announcement' : 'bulletin post'}
            </span>
          </p>
          <p className="text-xs font-mono text-surface-300 leading-relaxed line-clamp-4">
            {event.post_content}{(event.post_content?.length ?? 0) >= 300 ? '…' : ''}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

function JoinCard({ event }: { event: FeedEvent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-emerald/5 border border-emerald/20 hover:border-emerald/40 p-4 space-y-3 transition-colors"
    >
      <ActorLine event={event} />
      <div className="flex items-center gap-2.5 pl-0.5">
        <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border bg-emerald/10 border-emerald/30">
          <UserPlus className="h-3.5 w-3.5 text-emerald" />
        </div>
        <p className="text-xs font-mono text-emerald">joined the coalition</p>
      </div>
    </motion.div>
  )
}

function EventCard({ event }: { event: FeedEvent }) {
  switch (event.type) {
    case 'vote':     return <VoteCard event={event} />
    case 'argument': return <ArgumentCard event={event} />
    case 'post':     return <PostCard event={event} />
    case 'join':     return <JoinCard event={event} />
    default:         return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoalitionFeedPage() {
  const params = useParams<{ id: string }>()
  const coalitionId = params.id

  const [data, setData] = useState<CoalitionFeedResponse | null>(null)
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [filter, setFilter] = useState<FeedEventType | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (opts?: { refresh?: boolean; cursor?: string | null }) => {
    const isRefresh = opts?.refresh ?? false
    const nextCursor = opts?.cursor ?? null

    if (isRefresh) { setRefreshing(true) }
    else if (nextCursor) { setLoadingMore(true) }
    else { setLoading(true) }

    try {
      const url = `/api/coalitions/${coalitionId}/feed${nextCursor ? `?cursor=${encodeURIComponent(nextCursor)}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load feed')
      const json = (await res.json()) as CoalitionFeedResponse

      if (isRefresh || !nextCursor) {
        setData(json)
        setEvents(json.events)
      } else {
        setEvents((prev) => [...prev, ...json.events])
      }
      setCursor(json.cursor)
      setHasMore(!!json.cursor)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLoadingMore(false)
    }
  }, [coalitionId])

  useEffect(() => { load() }, [load])

  const filteredEvents = filter === 'all'
    ? events
    : events.filter((e) => e.type === filter)

  const hasContent = filteredEvents.length > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href={`/coalitions/${coalitionId}`}
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors mt-0.5"
            aria-label="Back to coalition"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <Activity className="h-5 w-5 text-for-400" />
              </div>
              <div className="min-w-0">
                <h1 className="font-mono text-xl font-bold text-white leading-tight">
                  Coalition Feed
                </h1>
                {data && (
                  <p className="text-xs font-mono text-surface-500 truncate mt-0.5">
                    {data.coalition.name} · {data.coalition.member_count} member{data.coalition.member_count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => load({ refresh: true })}
            disabled={refreshing}
            aria-label="Refresh feed"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50 mt-0.5"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-colors whitespace-nowrap',
                filter === tab.value
                  ? 'bg-for-600/20 border-for-600/40 text-for-400'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <FeedSkeleton />
        ) : !hasContent ? (
          <EmptyState
            icon={Activity}
            title={filter === 'all' ? 'No activity yet' : `No ${filter}s yet`}
            description={
              filter === 'all'
                ? 'Coalition members haven\'t been active in the last 90 days. Once they vote, post arguments, and debate, their activity will appear here.'
                : `No ${filter}s from coalition members yet.`
            }
            actions={filter !== 'all' ? [{ label: 'Show All', onClick: () => setFilter('all') }] : []}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Load more ────────────────────────────────────────────────── */}
        {hasMore && filter === 'all' && !loading && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => load({ cursor })}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 text-xs font-mono font-semibold transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {loadingMore ? 'Loading…' : 'Load older activity'}
            </button>
          </div>
        )}

        {/* ── Nav links ────────────────────────────────────────────────── */}
        {!loading && (
          <nav className="flex flex-wrap gap-2 pt-2 border-t border-surface-300">
            {[
              { href: `/coalitions/${coalitionId}`, label: 'Overview' },
              { href: `/coalitions/${coalitionId}/members`, label: 'Members' },
              { href: `/coalitions/${coalitionId}/timeline`, label: 'Chronicle' },
              { href: `/coalitions/${coalitionId}/analytics`, label: 'Analytics' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 text-xs font-mono transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
