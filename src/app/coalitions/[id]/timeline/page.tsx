'use client'

/**
 * /coalitions/[id]/timeline — Coalition Chronicle
 *
 * A chronological history of everything the coalition has done:
 * founding, member joins, stance declarations, bulletin posts,
 * challenge outcomes, and influence milestones.
 *
 * Distinct from:
 *   /coalitions/[id]/analytics   — aggregate stats, not a timeline
 *   /coalitions/[id]/challenges  — interactive challenge board
 *   /coalitions/[id]/war-room    — live tactical dashboard
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Crown,
  Flag,
  Flame,
  Globe,
  MessageSquare,
  RefreshCw,
  Shield,
  Star,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  UserPlus,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  CoalitionTimelineResponse,
  TimelineEvent,
  TimelineEventType,
} from '@/app/api/coalitions/[id]/timeline/route'

// ─── Event config ─────────────────────────────────────────────────────────────

interface EventConfig {
  icon: typeof Flag
  iconColor: string
  dotColor: string
  label: string
  ringColor: string
}

const EVENT_CONFIG: Record<TimelineEventType, EventConfig> = {
  founded: {
    icon: Flag,
    iconColor: 'text-gold',
    dotColor: 'bg-gold',
    ringColor: 'ring-gold/30',
    label: 'Founded',
  },
  member_joined: {
    icon: UserPlus,
    iconColor: 'text-purple',
    dotColor: 'bg-purple',
    ringColor: 'ring-purple/30',
    label: 'Member Joined',
  },
  stance_declared: {
    icon: Shield,
    iconColor: 'text-for-400',
    dotColor: 'bg-for-500',
    ringColor: 'ring-for-500/30',
    label: 'Stance Declared',
  },
  post_published: {
    icon: MessageSquare,
    iconColor: 'text-surface-400',
    dotColor: 'bg-surface-400',
    ringColor: 'ring-surface-400/20',
    label: 'Announcement',
  },
  challenge_won: {
    icon: Trophy,
    iconColor: 'text-gold',
    dotColor: 'bg-gold',
    ringColor: 'ring-gold/30',
    label: 'Challenge Won',
  },
  challenge_lost: {
    icon: Swords,
    iconColor: 'text-against-400',
    dotColor: 'bg-against-500',
    ringColor: 'ring-against-500/30',
    label: 'Challenge Lost',
  },
  challenge_issued: {
    icon: Swords,
    iconColor: 'text-purple',
    dotColor: 'bg-purple',
    ringColor: 'ring-purple/30',
    label: 'Challenge Issued',
  },
  influence_milestone: {
    icon: Zap,
    iconColor: 'text-emerald',
    dotColor: 'bg-emerald',
    ringColor: 'ring-emerald/30',
    label: 'Milestone',
  },
}

// ─── Filters ──────────────────────────────────────────────────────────────────

type Filter = 'all' | 'members' | 'stances' | 'posts' | 'battles' | 'milestones'

const FILTERS: { id: Filter; label: string; icon: typeof Globe }[] = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'members', label: 'Members', icon: UserPlus },
  { id: 'stances', label: 'Stances', icon: Shield },
  { id: 'posts', label: 'Posts', icon: MessageSquare },
  { id: 'battles', label: 'Battles', icon: Swords },
  { id: 'milestones', label: 'Milestones', icon: Star },
]

const FILTER_TYPES: Record<Filter, TimelineEventType[]> = {
  all: [],
  members: ['founded', 'member_joined'],
  stances: ['stance_declared'],
  posts: ['post_published'],
  battles: ['challenge_won', 'challenge_lost', 'challenge_issued'],
  milestones: ['influence_milestone'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const mo = Math.floor(d / 30)
  const yr = Math.floor(d / 365)
  if (yr >= 1) return `${yr}y ago`
  if (mo >= 1) return `${mo}mo ago`
  if (d >= 1) return `${d}d ago`
  if (h >= 1) return `${h}h ago`
  if (m >= 1) return `${m}m ago`
  return 'just now'
}

function absDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: TimelineEvent }) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-4"
    >
      {/* Dot + line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
            'border border-surface-300 bg-surface-100 ring-2',
            cfg.ringColor,
          )}
        >
          <Icon className={cn('h-3.5 w-3.5', cfg.iconColor)} />
        </div>
        <div className="mt-1 w-px flex-1 bg-surface-300/50" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <EventContent event={event} cfg={cfg} />
      </div>
    </motion.div>
  )
}

function EventContent({
  event,
  cfg: _cfg,
}: {
  event: TimelineEvent
  cfg: EventConfig
}) {
  switch (event.type) {
    case 'founded':
      return (
        <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-sm font-bold text-gold">Coalition Founded</div>
              <div className="font-mono text-[11px] text-surface-500 mt-0.5">
                The coalition was established on {absDate(event.timestamp)}
              </div>
            </div>
            <Flag className="h-5 w-5 text-gold/60" />
          </div>
        </div>
      )

    case 'member_joined':
      return (
        <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
          <div className="flex items-center gap-3">
            {event.actorUsername ? (
              <Link href={`/profile/${event.actorUsername}`}>
                <Avatar
                  src={event.actorAvatarUrl}
                  alt={event.actorDisplayName ?? event.actorUsername}
                  size={32}
                  className="ring-1 ring-surface-300"
                />
              </Link>
            ) : (
              <div className="h-8 w-8 rounded-full bg-surface-300" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {event.actorUsername ? (
                  <Link
                    href={`/profile/${event.actorUsername}`}
                    className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors"
                  >
                    {event.actorDisplayName ?? `@${event.actorUsername}`}
                  </Link>
                ) : (
                  <span className="font-mono text-sm font-semibold text-surface-400">
                    Unknown Member
                  </span>
                )}
                {event.actorRole === 'leader' && (
                  <Crown className="h-3.5 w-3.5 text-gold shrink-0" />
                )}
                {event.actorRole === 'officer' && (
                  <Shield className="h-3.5 w-3.5 text-purple shrink-0" />
                )}
              </div>
              <div className="font-mono text-[11px] text-surface-500">
                {event.actorRole === 'leader'
                  ? 'Founded the coalition'
                  : event.actorRole === 'officer'
                    ? 'Joined as Officer'
                    : 'Joined the coalition'}
              </div>
            </div>
            <span className="font-mono text-[11px] text-surface-600 shrink-0">
              {relativeTime(event.timestamp)}
            </span>
          </div>
        </div>
      )

    case 'stance_declared': {
      const stanceColor =
        event.stance === 'for'
          ? 'text-for-400'
          : event.stance === 'against'
            ? 'text-against-400'
            : 'text-surface-400'
      const stanceBg =
        event.stance === 'for'
          ? 'bg-for-500/10 border-for-500/30'
          : event.stance === 'against'
            ? 'bg-against-500/10 border-against-500/30'
            : 'bg-surface-300/20 border-surface-400/30'
      const StanceIcon =
        event.stance === 'for' ? ThumbsUp : event.stance === 'against' ? ThumbsDown : Shield

      return (
        <div className={cn('rounded-xl border px-4 py-3', stanceBg)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <StanceIcon className={cn('h-3.5 w-3.5 shrink-0', stanceColor)} />
                <span className={cn('font-mono text-xs font-bold uppercase tracking-wider', stanceColor)}>
                  {event.stance}
                </span>
                {event.topicCategory && (
                  <Badge variant="proposed" size="sm">{event.topicCategory}</Badge>
                )}
              </div>
              {event.topicStatement && (
                <Link
                  href={`/topic/${event.topicId}`}
                  className="font-mono text-sm text-white hover:text-for-300 transition-colors line-clamp-2"
                >
                  {event.topicStatement}
                </Link>
              )}
              {event.stanceStatement && (
                <p className="font-mono text-[11px] text-surface-400 mt-1.5 line-clamp-2">
                  &ldquo;{event.stanceStatement}&rdquo;
                </p>
              )}
              {event.actorUsername && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Avatar
                    src={event.actorAvatarUrl}
                    alt={event.actorDisplayName ?? event.actorUsername}
                    size={16}
                  />
                  <Link
                    href={`/profile/${event.actorUsername}`}
                    className="font-mono text-[10px] text-surface-500 hover:text-surface-300"
                  >
                    by @{event.actorUsername}
                  </Link>
                </div>
              )}
            </div>
            <span className="font-mono text-[11px] text-surface-600 shrink-0">
              {relativeTime(event.timestamp)}
            </span>
          </div>
        </div>
      )
    }

    case 'post_published':
      return (
        <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
          <div className="flex items-start gap-3">
            {event.actorUsername && (
              <Link href={`/profile/${event.actorUsername}`} className="shrink-0">
                <Avatar
                  src={event.actorAvatarUrl}
                  alt={event.actorDisplayName ?? event.actorUsername}
                  size={28}
                />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {event.actorUsername && (
                  <Link
                    href={`/profile/${event.actorUsername}`}
                    className="font-mono text-xs font-semibold text-white hover:text-for-300"
                  >
                    @{event.actorUsername}
                  </Link>
                )}
                {event.isPinned && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded">
                    Pinned
                  </span>
                )}
                <span className="font-mono text-[11px] text-surface-600 ml-auto">
                  {relativeTime(event.timestamp)}
                </span>
              </div>
              <p className="font-mono text-xs text-surface-300 line-clamp-3">
                {event.postContent}
              </p>
            </div>
          </div>
        </div>
      )

    case 'challenge_won':
      return (
        <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-4 w-4 text-gold" />
                <span className="font-mono text-sm font-bold text-gold">Victory!</span>
                {event.stakeClout !== undefined && event.stakeClout > 0 && (
                  <span className="font-mono text-[11px] text-gold/70">
                    +{event.stakeClout} clout
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-surface-400">
                Defeated{' '}
                <span className="text-white font-semibold">
                  {event.opponentName}
                </span>{' '}
                in a coalition challenge
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Check className="h-5 w-5 text-gold" />
              <span className="font-mono text-[11px] text-surface-600">
                {relativeTime(event.timestamp)}
              </span>
            </div>
          </div>
        </div>
      )

    case 'challenge_lost':
      return (
        <div className="rounded-xl border border-against-500/30 bg-against-500/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Swords className="h-4 w-4 text-against-400" />
                <span className="font-mono text-sm font-bold text-against-400">Defeat</span>
              </div>
              <div className="font-mono text-xs text-surface-400">
                Lost a challenge to{' '}
                <span className="text-white font-semibold">
                  {event.opponentName}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <X className="h-5 w-5 text-against-400" />
              <span className="font-mono text-[11px] text-surface-600">
                {relativeTime(event.timestamp)}
              </span>
            </div>
          </div>
        </div>
      )

    case 'challenge_issued':
      return (
        <div className="rounded-xl border border-purple/30 bg-purple/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Swords className="h-4 w-4 text-purple" />
                <span className="font-mono text-sm font-bold text-purple">Challenge Issued</span>
              </div>
              <div className="font-mono text-xs text-surface-400">
                Challenged{' '}
                <span className="text-white font-semibold">
                  {event.opponentName}
                </span>
                {event.stakeClout !== undefined && event.stakeClout > 0 && (
                  <span className="text-purple/70"> · {event.stakeClout} clout at stake</span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <ChevronRight className="h-5 w-5 text-purple" />
              <span className="font-mono text-[11px] text-surface-600">
                {relativeTime(event.timestamp)}
              </span>
            </div>
          </div>
        </div>
      )

    case 'influence_milestone':
      return (
        <div className="rounded-xl border border-emerald/30 bg-emerald/5 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-emerald" />
                <span className="font-mono text-sm font-bold text-emerald">
                  Milestone: {event.influenceValue?.toLocaleString()} Influence
                </span>
              </div>
              <div className="font-mono text-xs text-surface-400">
                The coalition crossed a major influence threshold
              </div>
            </div>
            <Star className="h-5 w-5 text-emerald/60" />
          </div>
        </div>
      )

    default:
      return null
  }
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="flex flex-col gap-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="mt-1 w-px flex-1 bg-surface-300/30 min-h-[4rem]" />
          </div>
          <div className="flex-1 pb-6">
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoalitionTimelinePage() {
  const params = useParams<{ id: string }>()
  const coalitionId = params.id

  const [data, setData] = useState<CoalitionTimelineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const fetchedRef = useRef(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/coalitions/${coalitionId}/timeline`, { cache: 'no-store' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Failed to load timeline')
      }
      const json = (await res.json()) as CoalitionTimelineResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [coalitionId])

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    load()
  }, [load])

  const filteredEvents =
    filter === 'all'
      ? (data?.events ?? [])
      : (data?.events ?? []).filter((e) =>
          FILTER_TYPES[filter].includes(e.type),
        )

  const { coalition } = data ?? {}

  return (
    <div className="min-h-screen bg-surface-0 pb-24">
      <TopBar />
      <div className="mx-auto max-w-2xl px-4 pt-4 space-y-5">
        {/* ── Back link ──────────────────────────────────────────────── */}
        <Link
          href={`/coalitions/${coalitionId}`}
          className="inline-flex items-center gap-2 font-mono text-sm text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {coalition?.name ?? 'Coalition'}
        </Link>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-xl font-bold text-white tracking-tight">
              Coalition Chronicle
            </h1>
            {coalition && (
              <p className="font-mono text-xs text-surface-500 mt-0.5">
                Founded {absDate(coalition.createdAt)} ·{' '}
                {coalition.memberCount} members ·{' '}
                {coalition.wins}W–{coalition.losses}L ·{' '}
                {coalition.influence.toLocaleString()} influence
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/coalitions/${coalitionId}`}
              className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-surface-100 px-3 py-1.5 font-mono text-xs text-surface-400 hover:text-white transition-colors"
            >
              <Flame className="h-3.5 w-3.5" />
              Overview
            </Link>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-surface-300 bg-surface-100 px-3 py-1.5 font-mono text-xs text-surface-400 hover:text-white transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────── */}
        {coalition && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Events', value: (data?.events.length ?? 0).toString(), color: 'text-white' },
              { label: 'Wins', value: coalition.wins.toString(), color: 'text-gold' },
              { label: 'Losses', value: coalition.losses.toString(), color: 'text-against-400' },
              { label: 'Influence', value: coalition.influence >= 1000 ? `${(coalition.influence / 1000).toFixed(1)}k` : coalition.influence.toString(), color: 'text-emerald' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2 text-center"
              >
                <div className={cn('font-mono text-lg font-bold tabular-nums', stat.color)}>
                  {stat.value}
                </div>
                <div className="font-mono text-[10px] text-surface-600 uppercase tracking-wider">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter tabs ────────────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map((f) => {
            const isActive = filter === f.id
            const count =
              f.id === 'all'
                ? (data?.events.length ?? 0)
                : (data?.events ?? []).filter((e) => FILTER_TYPES[f.id].includes(e.type)).length
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs shrink-0 transition-colors',
                  isActive
                    ? 'border-for-500/60 bg-for-500/10 text-for-300'
                    : 'border-surface-300 bg-surface-100 text-surface-500 hover:text-white',
                )}
              >
                {f.label}
                {data && count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[9px] tabular-nums',
                      isActive ? 'bg-for-500/20 text-for-300' : 'bg-surface-300 text-surface-500',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Timeline ───────────────────────────────────────────────── */}
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 px-6 py-8 text-center">
            <p className="font-mono text-sm text-against-400">{error}</p>
            <button
              onClick={load}
              className="mt-4 font-mono text-xs text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No events yet"
            description={
              filter === 'all'
                ? 'This coalition has no recorded history yet.'
                : `No ${filter} events recorded yet.`
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="flex flex-col">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
              {/* End cap */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-surface-400 bg-surface-200">
                    <div className="h-1.5 w-1.5 rounded-full bg-surface-500" />
                  </div>
                </div>
                <div className="pb-2 pt-0.5">
                  <p className="font-mono text-[11px] text-surface-600">
                    {filter === 'all'
                      ? `${filteredEvents.length} event${filteredEvents.length === 1 ? '' : 's'} in coalition history`
                      : `${filteredEvents.length} ${filter} event${filteredEvents.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>
            </div>
          </AnimatePresence>
        )}

        {/* ── Quick links ────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {[
              { href: `/coalitions/${coalitionId}/challenges`, label: 'Challenge Board', icon: Swords, color: 'text-against-400' },
              { href: `/coalitions/${coalitionId}/analytics`, label: 'Analytics', icon: Flame, color: 'text-for-400' },
              { href: `/coalitions/${coalitionId}/members`, label: 'Members', icon: Crown, color: 'text-purple' },
              { href: `/coalitions/${coalitionId}/war-room`, label: 'War Room', icon: Shield, color: 'text-gold' },
            ].map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 hover:border-surface-400 transition-colors group"
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', link.color)} />
                  <span className="font-mono text-xs text-surface-400 group-hover:text-white transition-colors truncate">
                    {link.label}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
