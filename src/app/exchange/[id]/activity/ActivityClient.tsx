'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Coins,
  Filter,
  Flame,
  Gavel,
  Heart,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  Vote,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ActivityEvent, ActivityResponse } from '@/app/api/exchange/[id]/activity/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'price', label: 'Price' },
  { id: 'argument', label: 'Arguments' },
  { id: 'commentary', label: 'Commentary' },
] as const

type FilterId = (typeof FILTERS)[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function directionColor(dir: string | null): string {
  if (dir === 'for') return 'text-for-400'
  if (dir === 'against') return 'text-against-400'
  return 'text-surface-500'
}

function directionIcon(dir: string | null) {
  if (dir === 'for') return ThumbsUp
  if (dir === 'against') return ThumbsDown
  return Scale
}

// ─── Event Cards ─────────────────────────────────────────────────────────────

function MarketCreatedCard({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-200 border border-surface-300/60 flex items-center justify-center">
        <Zap className="w-4 h-4 text-gold" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-surface-800">Market opened</p>
        <p className="text-xs text-surface-500 mt-0.5">{relTime(event.timestamp)}</p>
      </div>
      <Badge variant="gold" size="xs">LAUNCH</Badge>
    </div>
  )
}

function PriceMilestoneCard({ event }: { event: ActivityEvent }) {
  const went_up = (event.prev_price ?? 0) < (event.price ?? 0)
  const Icon = went_up ? TrendingUp : TrendingDown
  const color = went_up ? 'text-emerald' : 'text-against-400'
  const bg = went_up ? 'bg-emerald/10 border-emerald/20' : 'bg-against-500/10 border-against-500/20'

  return (
    <div className="flex items-start gap-3">
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center', bg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-surface-800">
          <span className={cn('font-mono font-bold', priceColor(event.price ?? 50))}>
            {Math.round(event.price ?? 0)}¢
          </span>
          {' '}— {event.label}
        </p>
        <p className="text-xs text-surface-500 mt-0.5">
          {event.prev_price != null && (
            <span>
              moved from{' '}
              <span className="font-mono text-surface-600">
                {Math.round(event.prev_price)}¢
              </span>
              {' '}·{' '}
            </span>
          )}
          {relTime(event.timestamp)}
        </p>
      </div>
    </div>
  )
}

function VolumeMilestoneCard({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple/10 border border-purple/20 flex items-center justify-center">
        <Vote className="w-4 h-4 text-purple" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-surface-800">
          <span className="font-mono font-bold text-purple">
            {(event.volume ?? 0).toLocaleString()}
          </span>{' '}votes milestone
        </p>
        <p className="text-xs text-surface-500 mt-0.5">{relTime(event.timestamp)}</p>
      </div>
      <Badge variant="default" size="xs" className="text-purple border-purple/30">
        <Coins className="w-2.5 h-2.5 mr-0.5" />
        {(event.volume ?? 0).toLocaleString()}
      </Badge>
    </div>
  )
}

function ArgumentCard({ event }: { event: ActivityEvent }) {
  const arg = event.argument!
  const isFor = arg.side === 'for'

  return (
    <div className="flex items-start gap-3">
      <Avatar
        src={arg.author_avatar_url}
        fallback={arg.author_display_name ?? arg.author_username}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/profile/${arg.author_username}`}
            className="text-sm font-medium text-surface-800 hover:text-surface-900 truncate"
          >
            {arg.author_display_name ?? arg.author_username}
          </Link>
          <Badge
            variant={isFor ? 'default' : 'against'}
            size="xs"
            className={cn(
              isFor ? 'text-for-400 border-for-400/30' : '',
            )}
          >
            {isFor ? (
              <ThumbsUp className="w-2.5 h-2.5 mr-0.5" />
            ) : (
              <ThumbsDown className="w-2.5 h-2.5 mr-0.5" />
            )}
            {isFor ? 'FOR' : 'AGAINST'}
          </Badge>
          <span className="text-xs text-surface-500 ml-auto flex-shrink-0">{relTime(event.timestamp)}</span>
        </div>
        <p className="text-sm text-surface-600 leading-snug line-clamp-3">
          {arg.body}
        </p>
        {arg.upvotes > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <BarChart2 className="w-3 h-3 text-surface-500" />
            <span className="text-xs text-surface-500">{arg.upvotes} upvotes</span>
          </div>
        )}
      </div>
    </div>
  )
}

function CommentaryCard({ event }: { event: ActivityEvent }) {
  const note = event.commentary!
  const DirIcon = directionIcon(note.direction)

  return (
    <div className="flex items-start gap-3">
      <Avatar
        src={note.author_avatar_url}
        fallback={note.author_display_name ?? note.author_username}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/profile/${note.author_username}`}
            className="text-sm font-medium text-surface-800 hover:text-surface-900 truncate"
          >
            {note.author_display_name ?? note.author_username}
          </Link>
          {note.direction && (
            <span className={cn('flex items-center gap-0.5 text-xs', directionColor(note.direction))}>
              <DirIcon className="w-3 h-3" />
              {note.direction}
            </span>
          )}
          <span className="text-xs text-surface-500 ml-auto flex-shrink-0">{relTime(event.timestamp)}</span>
        </div>
        <p className="text-sm text-surface-600 leading-snug">{note.content}</p>
        {note.likes > 0 && (
          <div className="flex items-center gap-1 mt-1.5">
            <Heart className="w-3 h-3 text-against-400" />
            <span className="text-xs text-surface-500">{note.likes}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PhaseTransitionCard({ event }: { event: ActivityEvent }) {
  const isLaw = event.to_status === 'law'
  const isFailed = event.to_status === 'failed'
  const isVoting = event.to_status === 'voting'

  const Icon = isLaw ? CheckCircle2 : isFailed ? XCircle : isVoting ? Gavel : Activity
  const color = isLaw ? 'text-emerald' : isFailed ? 'text-against-400' : 'text-for-400'
  const bg = isLaw
    ? 'bg-emerald/10 border-emerald/20'
    : isFailed
    ? 'bg-against-500/10 border-against-500/20'
    : 'bg-for-500/10 border-for-500/20'

  return (
    <div className="flex items-start gap-3">
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-full border flex items-center justify-center', bg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={cn('text-sm font-semibold', color)}>{event.label}</p>
        <p className="text-xs text-surface-500 mt-0.5">{relTime(event.timestamp)}</p>
      </div>
      {isLaw && <Badge variant="law" size="xs">LAW</Badge>}
      {isFailed && <Badge variant="failed" size="xs">FAILED</Badge>}
      {isVoting && <Badge variant="active" size="xs">VOTING</Badge>}
    </div>
  )
}

function EventCard({ event }: { event: ActivityEvent }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-3 border-b border-surface-200/60 last:border-0"
    >
      {event.type === 'market_created' && <MarketCreatedCard event={event} />}
      {event.type === 'price_milestone' && <PriceMilestoneCard event={event} />}
      {event.type === 'volume_milestone' && <VolumeMilestoneCard event={event} />}
      {event.type === 'argument' && <ArgumentCard event={event} />}
      {event.type === 'commentary' && <CommentaryCard event={event} />}
      {event.type === 'phase_transition' && <PhaseTransitionCard event={event} />}
    </motion.div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="divide-y divide-surface-200/60">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-4 py-3 flex items-start gap-3">
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
}

export function ActivityClient({ topicId }: Props) {
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/exchange/${topicId}/activity?filter=${filter}&limit=80`)
        if (!res.ok) throw new Error('Failed to load activity')
        const json: ActivityResponse = await res.json()
        setData(json)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [topicId, filter],
  )

  useEffect(() => { load() }, [load])

  const topic = data?.topic
  const events = data?.events ?? []

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      {/* Header */}
      <div className="sticky top-14 z-30 bg-surface-100/95 backdrop-blur border-b border-surface-200/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Market
          </Link>
          <span className="text-surface-300">·</span>
          <div className="flex items-center gap-2 min-w-0">
            <Activity className="w-4 h-4 text-for-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-surface-800 truncate">
              {topic ? topic.statement.slice(0, 60) + (topic.statement.length > 60 ? '…' : '') : 'Activity Log'}
            </span>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="ml-auto flex-shrink-0 p-1.5 rounded-lg hover:bg-surface-200/60 transition-colors text-surface-500"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stat row */}
        {topic && (
          <div className="max-w-2xl mx-auto px-4 pb-2 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className={cn('text-sm font-mono font-bold', priceColor(topic.price))}>
                {Math.round(topic.price)}¢
              </span>
              <span className="text-xs text-surface-500">current</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Vote className="w-3 h-3 text-surface-500" />
              <span className="text-xs text-surface-500">
                {(topic.volume ?? 0).toLocaleString()} votes
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-3 h-3 text-surface-500" />
              <span className="text-xs text-surface-500">
                {events.length} events
              </span>
            </div>
            {topic.status !== 'active' && (
              <Badge
                variant={topic.status as 'law' | 'failed' | 'active' | 'proposed'}
                size="xs"
              >
                {topic.status.toUpperCase()}
              </Badge>
            )}
          </div>
        )}

        {/* Filter bar */}
        <div className="max-w-2xl mx-auto px-4 pb-2.5 flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-surface-500 flex-shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  filter === f.id
                    ? 'bg-for-500/20 text-for-400 border border-for-500/30'
                    : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200/60',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full">
        {loading ? (
          <ActivitySkeleton />
        ) : error ? (
          <EmptyState
            icon={Activity}
            iconColor="text-against-400"
            title="Could not load activity"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={Activity}
            iconColor="text-surface-500"
            title="No activity yet"
            description="Activity will appear here as the market evolves — votes, arguments, price milestones, and commentary."
            action={{ label: 'View Market', href: `/exchange/${topicId}` }}
          />
        ) : (
          <div className="bg-surface-100 border-b border-surface-200/60">
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </AnimatePresence>
            {(data?.total ?? 0) > events.length && (
              <div className="px-4 py-3 flex items-center justify-center">
                <span className="text-xs text-surface-500">
                  Showing {events.length} of {data?.total} events
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer links */}
      <div className="max-w-2xl mx-auto w-full px-4 py-4 pb-20 flex items-center gap-4 flex-wrap">
        <Link
          href={`/exchange/${topicId}`}
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          Price Chart
        </Link>
        <Link
          href={`/exchange/${topicId}/analysis`}
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          Analysis
        </Link>
        <Link
          href={`/exchange/${topicId}/ideas`}
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Ideas
        </Link>
        <Link
          href={`/exchange/${topicId}/traders`}
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
        >
          <Flame className="w-3.5 h-3.5" />
          Traders
        </Link>
      </div>

      <BottomNav />
    </div>
  )
}
