'use client'

/**
 * /topic/[id]/activity — Live Activity Stream
 *
 * A real-time feed of everything happening on a debate topic:
 * votes cast, arguments posted, upvotes given, and supports filed.
 * Sorted by most-recent first, with filter pills to narrow by type.
 *
 * Auto-refreshes every 30 seconds so the view stays fresh without
 * requiring a full page reload.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
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
import type {
  ActivityEvent,
  ActivityResponse,
  ActivityVote,
  ActivityArgument,
  ActivityUpvote,
  ActivitySupport,
} from '@/app/api/topics/[id]/activity/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (s < 60) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

// ─── Filter config ─────────────────────────────────────────────────────────────

type FilterType = 'all' | 'votes' | 'arguments' | 'upvotes' | 'support'

const FILTERS: { id: FilterType; label: string; icon: typeof Activity }[] = [
  { id: 'all', label: 'All', icon: Activity },
  { id: 'votes', label: 'Votes', icon: Flame },
  { id: 'arguments', label: 'Arguments', icon: MessageSquare },
  { id: 'upvotes', label: 'Upvotes', icon: ArrowUp },
  { id: 'support', label: 'Support', icon: Users },
]

// ─── Event row components ─────────────────────────────────────────────────────

function ActorRow({
  actor,
  time,
}: {
  actor: ActivityEvent['actor']
  time: string
}) {
  if (!actor) {
    return (
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-5 w-5 rounded-full bg-surface-300/60 flex-shrink-0" />
        <span className="text-xs font-mono text-surface-500">Anonymous</span>
        <span className="text-[10px] font-mono text-surface-600 ml-auto">{relTime(time)}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 mb-1.5">
      <Avatar
        src={actor.avatar_url}
        fallback={actor.display_name || actor.username}
        size="xs"
        className="flex-shrink-0"
      />
      <Link
        href={`/profile/${actor.username}`}
        className="text-xs font-mono font-semibold text-white hover:text-for-300 transition-colors truncate"
      >
        {actor.display_name || actor.username}
      </Link>
      <span className="text-[10px] font-mono text-surface-600 ml-auto flex-shrink-0">
        {relTime(time)}
      </span>
    </div>
  )
}

function VoteRow({ event }: { event: ActivityVote }) {
  const isFor = event.side === 'blue'
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 hover:bg-surface-200/40 transition-colors">
      <ActorRow actor={event.actor} time={event.created_at} />
      <div className="flex items-center gap-2 pl-7">
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold',
            isFor
              ? 'bg-for-600/20 text-for-300 border border-for-600/30'
              : 'bg-against-600/20 text-against-300 border border-against-600/30'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          ) : (
            <ThumbsDown className="h-3 w-3" aria-hidden="true" />
          )}
          voted {isFor ? 'FOR' : 'AGAINST'}
        </div>
        {event.reason && (
          <span className="text-[11px] font-mono text-surface-500 italic truncate">
            &ldquo;{truncate(event.reason, 80)}&rdquo;
          </span>
        )}
      </div>
    </div>
  )
}

function ArgumentRow({ event, topicId }: { event: ActivityArgument; topicId: string }) {
  const isFor = event.side === 'blue'
  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 hover:bg-surface-200/40 transition-colors">
      <ActorRow actor={event.actor} time={event.created_at} />
      <div className="pl-7 space-y-1.5">
        <div
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
            isFor
              ? 'bg-for-600/15 text-for-400 border border-for-600/20'
              : 'bg-against-600/15 text-against-400 border border-against-600/20'
          )}
        >
          <MessageSquare className="h-2.5 w-2.5" aria-hidden="true" />
          new {isFor ? 'FOR' : 'AGAINST'} argument
        </div>
        <Link
          href={`/topic/${topicId}/arguments`}
          className={cn(
            'block text-xs font-mono text-surface-600 leading-relaxed',
            'rounded-lg border px-3 py-2',
            'hover:text-white hover:border-surface-400 transition-colors',
            isFor ? 'border-for-600/20 bg-for-600/5' : 'border-against-600/20 bg-against-600/5'
          )}
        >
          &ldquo;{truncate(event.content, 120)}&rdquo;
        </Link>
        {event.upvotes > 0 && (
          <span className="text-[10px] font-mono text-surface-600">
            {event.upvotes} upvote{event.upvotes !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function UpvoteRow({ event, topicId }: { event: ActivityUpvote; topicId: string }) {
  const isFor = event.argument_side === 'blue'
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 hover:bg-surface-200/40 transition-colors">
      <ActorRow actor={event.actor} time={event.created_at} />
      <div className="pl-7 space-y-1">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple/15 text-purple border border-purple/20">
          <ArrowUp className="h-2.5 w-2.5" aria-hidden="true" />
          upvoted a {isFor ? 'FOR' : 'AGAINST'} argument
        </div>
        <Link
          href={`/topic/${topicId}/arguments`}
          className="block text-xs font-mono text-surface-600 italic hover:text-surface-500 transition-colors truncate"
        >
          &ldquo;{truncate(event.argument_content, 100)}&rdquo;
        </Link>
      </div>
    </div>
  )
}

function SupportRow({ event }: { event: ActivitySupport }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 hover:bg-surface-200/40 transition-colors">
      <ActorRow actor={event.actor} time={event.created_at} />
      <div className="pl-7">
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald/15 text-emerald border border-emerald/20">
          <Zap className="h-2.5 w-2.5" aria-hidden="true" />
          supported this proposal
        </div>
      </div>
    </div>
  )
}

function EventRow({ event, topicId }: { event: ActivityEvent; topicId: string }) {
  switch (event.type) {
    case 'vote':
      return <VoteRow event={event} />
    case 'argument':
      return <ArgumentRow event={event} topicId={topicId} />
    case 'upvote':
      return <UpvoteRow event={event} topicId={topicId} />
    case 'support':
      return <SupportRow event={event} />
    default:
      return null
  }
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="divide-y divide-surface-300/40">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full flex-shrink-0" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
          <div className="pl-7">
            <Skeleton className={cn('h-5 rounded-full', i % 3 === 0 ? 'w-40' : 'w-32')} />
            {i % 2 === 0 && <Skeleton className="h-3 w-full max-w-xs mt-1.5" />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
}

export function ActivityClient({ topicId, topicStatement }: Props) {
  const router = useRouter()
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true)
      try {
        const res = await fetch(
          `/api/topics/${topicId}/activity?filter=${filter}&limit=60`,
          { cache: 'no-store' }
        )
        if (!res.ok) return
        const json = (await res.json()) as ActivityResponse
        setData(json)
      } catch {
        // best-effort
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [topicId, filter]
  )

  // Initial load + refetch when filter changes
  useEffect(() => {
    setLoading(true)
    setData(null)
    load()
  }, [load])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    timerRef.current = setTimeout(function tick() {
      load()
      timerRef.current = setTimeout(tick, 30_000)
    }, 30_000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [load])

  const events = data?.events ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-0 sm:px-4 pt-4 pb-24 md:pb-12">

        {/* ── Back + header ─────────────────────────────────────────────────── */}
        <div className="px-4 sm:px-0 mb-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-3"
            aria-label="Go back"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30">
              <Activity className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-mono font-bold text-white leading-snug">
                Live Activity
              </h1>
              <Link
                href={`/topic/${topicId}`}
                className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors mt-0.5 truncate"
              >
                <span className="truncate">{topicStatement.slice(0, 80)}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
              </Link>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh activity"
              className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        {data && (
          <div className="px-4 sm:px-0 mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-surface-500">Total votes:</span>
                <span className="text-white font-semibold">
                  {(data.topic.total_votes ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="h-3 w-px bg-surface-400" aria-hidden="true" />
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-for-400 font-semibold">
                  {Math.round(data.topic.blue_pct ?? 50)}% For
                </span>
                <span className="text-surface-600">/</span>
                <span className="text-against-400 font-semibold">
                  {Math.round(100 - (data.topic.blue_pct ?? 50))}% Against
                </span>
              </div>
              <div className="h-3 w-px bg-surface-400" aria-hidden="true" />
              <Badge
                variant={
                  data.topic.status === 'law'
                    ? 'law'
                    : data.topic.status === 'failed'
                    ? 'failed'
                    : data.topic.status === 'proposed'
                    ? 'proposed'
                    : 'active'
                }
                size="sm"
              >
                {data.topic.status.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}

        {/* ── Filter pills ──────────────────────────────────────────────────── */}
        <div
          className="px-4 sm:px-0 mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
          role="group"
          aria-label="Filter activity by type"
        >
          {FILTERS.map((f) => {
            const Icon = f.icon
            const isActive = filter === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                aria-pressed={isActive}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full',
                  'text-[11px] font-mono font-semibold border transition-all',
                  isActive
                    ? 'bg-for-600/20 text-for-300 border-for-600/40'
                    : 'bg-surface-200/60 text-surface-500 border-surface-300/60 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {f.label}
              </button>
            )
          })}
        </div>

        {/* ── Event list ────────────────────────────────────────────────────── */}
        <div className="bg-surface-100 sm:rounded-2xl border border-surface-300 overflow-hidden">

          {loading ? (
            <ActivitySkeleton />
          ) : events.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description={
                  filter === 'all'
                    ? 'Be the first to vote or post an argument on this topic.'
                    : `No ${filter} recorded yet.`
                }
                actions={[{ label: 'Go to topic', href: `/topic/${topicId}` }]}
              />
            </div>
          ) : (
            <AnimatePresence initial={false}>
              <ul
                className="divide-y divide-surface-300/40"
                aria-label={`Activity feed — ${events.length} events`}
              >
                {events.map((event, i) => (
                  <motion.li
                    key={event.id}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: i * 0.02 }}
                  >
                    <EventRow event={event} topicId={topicId} />
                  </motion.li>
                ))}
              </ul>
            </AnimatePresence>
          )}

          {/* Footer */}
          {!loading && events.length > 0 && (
            <div className="px-4 py-3 border-t border-surface-300/40 flex items-center justify-between">
              <span className="text-[11px] font-mono text-surface-600">
                {events.length} recent events · auto-refreshes every 30s
              </span>
              <Link
                href={`/topic/${topicId}`}
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View topic
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
