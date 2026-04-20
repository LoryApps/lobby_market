'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  FileText,
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
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NetworkEvent, NetworkEventType, NetworkFeedResponse } from '@/app/api/activity/following/route'

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  NetworkEventType,
  {
    icon: typeof FileText
    iconColor: string
    iconBg: string
    verb: string
    topicAccent: string
  }
> = {
  topic_proposed: {
    icon: FileText,
    iconColor: 'text-for-400',
    iconBg: 'bg-for-500/10',
    verb: 'proposed a topic',
    topicAccent: 'hover:border-for-500/40',
  },
  topic_active: {
    icon: Zap,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10',
    verb: 'topic went active',
    topicAccent: 'hover:border-for-400/40',
  },
  topic_voting: {
    icon: Scale,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10',
    verb: 'topic entered voting',
    topicAccent: 'hover:border-purple/40',
  },
  law_established: {
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/10',
    verb: 'helped pass a law',
    topicAccent: 'hover:border-gold/40',
  },
  argument_posted: {
    icon: MessageSquare,
    iconColor: 'text-surface-400',
    iconBg: 'bg-surface-300/40',
    verb: 'made an argument',
    topicAccent: 'hover:border-surface-400/40',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b border-surface-300/60 last:border-0">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    </div>
  )
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event, index }: { event: NetworkEvent; index: number }) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon
  const forPct = Math.round(event.topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
      className="flex items-start gap-3 px-4 py-4 border-b border-surface-300/50 last:border-0"
    >
      {/* Actor avatar */}
      <Link
        href={`/profile/${event.actor.username}`}
        className="flex-shrink-0 mt-0.5"
        aria-label={`View @${event.actor.username}'s profile`}
      >
        <Avatar
          src={event.actor.avatar_url}
          fallback={event.actor.display_name || event.actor.username}
          size="sm"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Actor + verb + timestamp */}
        <div className="flex items-baseline gap-1.5 flex-wrap mb-2">
          <Link
            href={`/profile/${event.actor.username}`}
            className="text-sm font-semibold text-white hover:text-for-400 transition-colors"
          >
            {event.actor.display_name || event.actor.username}
          </Link>
          <span className="text-xs text-surface-500">{cfg.verb}</span>
          <span className="text-xs text-surface-600 ml-auto">{relativeTime(event.timestamp)}</span>
        </div>

        {/* Argument card */}
        {event.type === 'argument_posted' && event.argument && (
          <div
            className={cn(
              'rounded-xl border p-3.5 mb-2',
              event.argument.side === 'blue'
                ? 'bg-for-950/30 border-for-600/20'
                : 'bg-against-950/30 border-against-600/20'
            )}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              {event.argument.side === 'blue' ? (
                <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden="true" />
              ) : (
                <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden="true" />
              )}
              <span
                className={cn(
                  'text-[10px] font-mono font-bold uppercase tracking-widest',
                  event.argument.side === 'blue' ? 'text-for-400' : 'text-against-400'
                )}
              >
                {event.argument.side === 'blue' ? 'For' : 'Against'}
              </span>
              {event.argument.upvotes > 0 && (
                <span className="ml-auto text-[10px] font-mono text-surface-500">
                  +{event.argument.upvotes}
                </span>
              )}
            </div>
            <p className="text-sm text-surface-700 leading-snug line-clamp-3">
              {event.argument.content}
            </p>
          </div>
        )}

        {/* Topic link card */}
        <Link
          href={`/topic/${event.topic.id}`}
          className={cn(
            'flex items-start gap-3 p-3 rounded-xl group',
            'bg-surface-100 border border-surface-300 transition-colors',
            cfg.topicAccent
          )}
        >
          <div
            className={cn(
              'flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center',
              cfg.iconBg
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', cfg.iconColor)} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <Badge variant={STATUS_BADGE[event.topic.status] ?? 'proposed'}>
                {STATUS_LABEL[event.topic.status] ?? event.topic.status}
              </Badge>
              {event.topic.category && (
                <span className="text-[11px] font-mono text-surface-500">{event.topic.category}</span>
              )}
            </div>
            <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-400 transition-colors">
              {event.topic.statement}
            </p>
            {event.topic.total_votes > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-l-full"
                    style={{ width: `${forPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
                <span className="text-[10px] font-mono text-against-400">{againstPct}%</span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const router = useRouter()
  const [events, setEvents] = useState<NetworkEvent[]>([])
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(false)
  const [notAuthed, setNotAuthed] = useState(false)
  const loadedRef = useRef(false)

  const fetchFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/activity/following?limit=50')
      if (res.status === 401) {
        setNotAuthed(true)
        return
      }
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as NetworkFeedResponse
      setEvents(data.events)
      setFollowingCount(data.followingCount)
      setIsEmpty(data.isEmpty)
    } catch {
      // keep current state on error
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true
      fetchFeed()
    }
  }, [fetchFeed])

  if (notAuthed) {
    router.push('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-0 sm:px-4 pt-4 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 sm:px-0 mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Activity className="h-5 w-5 text-for-400" aria-hidden="true" />
              Your Network
            </h1>
            {!loading && followingCount > 0 && (
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Activity from {followingCount} {followingCount === 1 ? 'person' : 'people'} you follow
              </p>
            )}
          </div>
          <button
            onClick={() => fetchFeed(true)}
            disabled={refreshing}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh feed"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Feed card */}
        <div className="bg-surface-100 border border-surface-300 sm:rounded-2xl overflow-hidden">

          {/* Loading skeleton */}
          {loading && (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <EventSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Not following anyone */}
          {!loading && isEmpty && followingCount === 0 && (
            <div className="py-4">
              <EmptyState
                icon={UserPlus}
                iconColor="text-for-400/60"
                iconBg="bg-for-600/10"
                iconBorder="border-for-500/20"
                title="Follow people to see their activity"
                description="When you follow other members of the Lobby, their topics, arguments, and milestones will appear here."
                actions={[
                  { label: 'Find people', href: '/search?tab=people', icon: Users },
                  { label: 'Leaderboard', href: '/leaderboard', icon: Activity, variant: 'secondary' },
                ]}
                size="lg"
              />
            </div>
          )}

          {/* Following people but no recent activity */}
          {!loading && isEmpty && followingCount > 0 && (
            <div className="py-4">
              <EmptyState
                icon={Activity}
                iconColor="text-surface-500"
                iconBg="bg-surface-300/30"
                iconBorder="border-surface-400/20"
                title="Nothing yet from your network"
                description="The people you follow haven't posted topics or arguments in the last 30 days."
                actions={[
                  { label: 'Browse the Feed', href: '/', icon: Zap },
                  { label: 'Find more people', href: '/search?tab=people', icon: Users, variant: 'secondary' },
                ]}
                size="md"
              />
            </div>
          )}

          {/* Event list */}
          {!loading && events.length > 0 && (
            <AnimatePresence initial={false}>
              {events.map((event, i) => (
                <EventRow key={event.id} event={event} index={i} />
              ))}
            </AnimatePresence>
          )}

          {/* Refreshing overlay indicator */}
          {refreshing && events.length > 0 && (
            <div className="flex items-center justify-center gap-2 py-3 border-t border-surface-300">
              <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin" aria-hidden="true" />
              <span className="text-xs font-mono text-surface-500">Refreshing…</span>
            </div>
          )}
        </div>

        {/* Footer hint */}
        {!loading && events.length > 0 && (
          <p className="text-center text-[11px] font-mono text-surface-600 mt-4 px-4">
            Showing the last 30 days of activity from your network
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
