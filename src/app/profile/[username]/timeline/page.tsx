'use client'

/**
 * /profile/[username]/timeline — Personal Civic Timeline
 *
 * A unified chronological record of every civic action a user has taken:
 * votes cast, arguments posted, debates joined, achievements earned,
 * coalitions joined, and topics proposed.
 *
 * Distinct from:
 *   /profile/[username]/votes       — vote-only record with topic outcomes
 *   /profile/[username]/arguments   — argument record with AI grades
 *   /profile/[username]/debates     — full debate record
 *   /activity                       — platform-wide activity feed
 *   /timeline                       — global law/topic event timeline
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ProfileTimelineResponse,
  TimelineEvent,
  TimelineEventType,
} from '@/app/api/profile/[username]/timeline/route'

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'votes' | 'arguments' | 'debates' | 'achievements' | 'coalitions' | 'topics'

const FILTERS: { key: FilterKey; label: string; icon: typeof Vote }[] = [
  { key: 'all',          label: 'All',          icon: Clock },
  { key: 'votes',        label: 'Votes',        icon: Vote },
  { key: 'arguments',    label: 'Arguments',    icon: MessageSquare },
  { key: 'debates',      label: 'Debates',      icon: Mic },
  { key: 'achievements', label: 'Achievements', icon: Trophy },
  { key: 'coalitions',   label: 'Coalitions',   icon: Users },
  { key: 'topics',       label: 'Topics',       icon: FileText },
]

// ─── Event display config ─────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  TimelineEventType,
  { color: string; bg: string; border: string; icon: typeof Vote; label: string }
> = {
  vote: {
    icon: Vote,
    label: 'Voted',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
  },
  argument: {
    icon: MessageSquare,
    label: 'Argued',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
  },
  debate_join: {
    icon: Mic,
    label: 'Debated',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/20',
  },
  achievement: {
    icon: Trophy,
    label: 'Achievement',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
  },
  coalition_join: {
    icon: Users,
    label: 'Joined coalition',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
  },
  topic_created: {
    icon: FileText,
    label: 'Proposed',
    color: 'text-for-300',
    bg: 'bg-for-600/10',
    border: 'border-for-600/20',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { text: string; bg: string }> = {
  A: { text: 'text-emerald',     bg: 'bg-emerald/10' },
  B: { text: 'text-for-300',     bg: 'bg-for-500/10' },
  C: { text: 'text-gold',        bg: 'bg-gold/10' },
  D: { text: 'text-against-300', bg: 'bg-against-500/10' },
  F: { text: 'text-against-400', bg: 'bg-against-600/10' },
}

const TIER_CONFIG: Record<string, { text: string; bg: string; border: string }> = {
  bronze:    { text: 'text-amber-600',   bg: 'bg-amber-600/10',   border: 'border-amber-600/30' },
  silver:    { text: 'text-surface-300', bg: 'bg-surface-300/10', border: 'border-surface-300/30' },
  gold:      { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  platinum:  { text: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  legendary: { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event }: { event: TimelineEvent }) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'relative flex gap-4 rounded-2xl border p-4 transition-colors hover:bg-surface-200/50',
        cfg.border
      )}
    >
      {/* Icon dot */}
      <div className={cn('flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl', cfg.bg)}>
        <Icon className={cn('h-4 w-4', cfg.color)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-xs font-mono text-surface-500">
            {relativeTime(event.occurred_at)}
          </span>
        </div>

        {/* Vote */}
        {event.type === 'vote' && (
          <div>
            {event.vote_topic_statement && (
              <Link
                href={`/topic/${event.vote_topic_id}`}
                className="text-sm font-mono text-white hover:text-for-300 transition-colors line-clamp-2 flex items-start gap-1.5 group"
              >
                <span className="leading-snug">{event.vote_topic_statement}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
            <div className="flex items-center gap-2 mt-2">
              {event.vote_side === 'blue' ? (
                <span className="flex items-center gap-1 text-xs font-mono text-for-400 bg-for-500/10 rounded-lg px-2 py-0.5 border border-for-500/20">
                  <ThumbsUp className="h-3 w-3" /> FOR
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-mono text-against-400 bg-against-500/10 rounded-lg px-2 py-0.5 border border-against-500/20">
                  <ThumbsDown className="h-3 w-3" /> AGAINST
                </span>
              )}
              {event.vote_topic_status && (
                <Badge variant={STATUS_BADGE[event.vote_topic_status] ?? 'proposed'}>
                  {event.vote_topic_status === 'law' ? 'LAW' : event.vote_topic_status}
                </Badge>
              )}
              {event.vote_topic_category && (
                <span className="text-xs font-mono text-surface-500">{event.vote_topic_category}</span>
              )}
            </div>
          </div>
        )}

        {/* Argument */}
        {event.type === 'argument' && (
          <div>
            {event.arg_topic_statement && (
              <Link
                href={`/topic/${event.arg_topic_id}`}
                className="text-xs font-mono text-surface-400 hover:text-surface-300 transition-colors line-clamp-1 mb-1.5 flex items-center gap-1 group"
              >
                <span>{event.arg_topic_statement}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
            <p className="text-sm font-mono text-surface-200 line-clamp-3 leading-relaxed">
              {event.arg_content}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {event.arg_side === 'blue' ? (
                <span className="text-xs font-mono text-for-400 bg-for-500/10 rounded-lg px-2 py-0.5 border border-for-500/20">FOR</span>
              ) : (
                <span className="text-xs font-mono text-against-400 bg-against-500/10 rounded-lg px-2 py-0.5 border border-against-500/20">AGAINST</span>
              )}
              {(event.arg_upvotes ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-xs font-mono text-surface-400">
                  <ThumbsUp className="h-3 w-3" />
                  {event.arg_upvotes}
                </span>
              )}
              {event.arg_ai_grade && GRADE_CONFIG[event.arg_ai_grade] && (
                <span className={cn(
                  'text-xs font-mono font-semibold rounded-lg px-2 py-0.5',
                  GRADE_CONFIG[event.arg_ai_grade].text,
                  GRADE_CONFIG[event.arg_ai_grade].bg
                )}>
                  {event.arg_ai_grade}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Debate */}
        {event.type === 'debate_join' && (
          <div>
            {event.debate_topic_statement && (
              <Link
                href={`/debate/${event.debate_id}`}
                className="text-sm font-mono text-white hover:text-purple transition-colors line-clamp-2 flex items-start gap-1.5 group"
              >
                <span className="leading-snug">{event.debate_topic_statement}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
            <div className="flex items-center gap-2 mt-2">
              {event.debate_is_speaker && (
                <span className="flex items-center gap-1 text-xs font-mono text-against-300 bg-against-500/10 rounded-lg px-2 py-0.5 border border-against-500/20">
                  <Mic className="h-3 w-3" /> Speaker
                </span>
              )}
              {event.debate_side && (
                <span className={cn(
                  'text-xs font-mono rounded-lg px-2 py-0.5',
                  event.debate_side === 'blue'
                    ? 'text-for-400 bg-for-500/10 border border-for-500/20'
                    : 'text-against-400 bg-against-500/10 border border-against-500/20'
                )}>
                  {event.debate_side === 'blue' ? 'FOR' : 'AGAINST'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Achievement */}
        {event.type === 'achievement' && (
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {event.achievement_icon && (
                <span className="text-xl">{event.achievement_icon}</span>
              )}
              <span className="text-sm font-mono font-bold text-white">
                {event.achievement_name ?? 'Achievement unlocked'}
              </span>
              {event.achievement_tier && TIER_CONFIG[event.achievement_tier] && (
                <span className={cn(
                  'text-xs font-mono font-semibold rounded-lg px-2 py-0.5 border',
                  TIER_CONFIG[event.achievement_tier].text,
                  TIER_CONFIG[event.achievement_tier].bg,
                  TIER_CONFIG[event.achievement_tier].border,
                )}>
                  {event.achievement_tier.charAt(0).toUpperCase() + event.achievement_tier.slice(1)}
                </span>
              )}
            </div>
            {event.achievement_description && (
              <p className="text-xs font-mono text-surface-400 mt-1 line-clamp-2">
                {event.achievement_description}
              </p>
            )}
          </div>
        )}

        {/* Coalition */}
        {event.type === 'coalition_join' && (
          <div>
            <Link
              href={`/coalitions`}
              className="text-sm font-mono text-white hover:text-emerald transition-colors line-clamp-1 flex items-center gap-1.5 group"
            >
              <Users className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
              <span>{event.coalition_name ?? 'Unknown coalition'}</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            {event.coalition_role && (
              <span className="mt-1 inline-block text-xs font-mono text-surface-400 capitalize">
                Joined as {event.coalition_role}
              </span>
            )}
          </div>
        )}

        {/* Topic created */}
        {event.type === 'topic_created' && (
          <div>
            {event.topic_statement && (
              <Link
                href={`/topic/${event.topic_id}`}
                className="text-sm font-mono text-white hover:text-for-300 transition-colors line-clamp-2 flex items-start gap-1.5 group"
              >
                <span className="leading-snug">{event.topic_statement}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
            <div className="flex items-center gap-2 mt-2">
              {event.topic_status && (
                <Badge variant={STATUS_BADGE[event.topic_status] ?? 'proposed'}>
                  {event.topic_status === 'law' ? 'LAW' : event.topic_status}
                </Badge>
              )}
              {event.topic_category && (
                <span className="text-xs font-mono text-surface-500">{event.topic_category}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Month group header ───────────────────────────────────────────────────────

function MonthHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-6 first:mt-0">
      <div className="h-px flex-1 bg-surface-200" />
      <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-surface-200" />
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[88px] w-full rounded-2xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfileTimelinePage() {
  const params = useParams<{ username: string }>()
  const username = params.username

  const [filter, setFilter] = useState<FilterKey>('all')
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [profile, setProfile] = useState<ProfileTimelineResponse['profile'] | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTimeline = useCallback(async (f: FilterKey, cursor?: string) => {
    const isInitial = !cursor
    if (isInitial) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({ filter: f })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/profile/${username}/timeline?${params}`)
      if (!res.ok) throw new Error('Failed to load timeline')
      const data: ProfileTimelineResponse = await res.json()

      if (isInitial) {
        setEvents(data.events)
        setProfile(data.profile)
      } else {
        setEvents((prev) => [...prev, ...data.events])
      }
      setNextCursor(data.next_cursor)
    } catch {
      setError('Failed to load timeline.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [username])

  useEffect(() => {
    fetchTimeline(filter)
  }, [filter, fetchTimeline])

  // ── Group events by month ──────────────────────────────────────────────────
  type MonthGroup = { label: string; events: TimelineEvent[] }
  const grouped: MonthGroup[] = []

  for (const event of events) {
    const label = formatMonthYear(event.occurred_at)
    const last = grouped[grouped.length - 1]
    if (last?.label === label) {
      last.events.push(event)
    } else {
      grouped.push({ label, events: [event] })
    }
  }

  const displayName = profile?.display_name ?? username

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-16">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/profile/${username}`}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:bg-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-300" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              Civic Timeline
            </h1>
            {profile ? (
              <p className="text-sm font-mono text-surface-400 mt-0.5">
                {displayName}&apos;s full civic record
              </p>
            ) : (
              <Skeleton className="h-4 w-32 mt-0.5 rounded" />
            )}
          </div>
          {profile && (
            <Link href={`/profile/${username}`} className="flex-shrink-0">
              <Avatar
                src={profile.avatar_url}
                username={profile.username}
                size={36}
              />
            </Link>
          )}
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────── */}
        {profile && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Votes', value: profile.total_votes.toLocaleString(), color: 'text-for-400' },
              { label: 'Arguments', value: profile.total_arguments.toLocaleString(), color: 'text-purple' },
              { label: 'Clout', value: profile.clout.toLocaleString(), color: 'text-gold' },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-surface-100 border border-surface-200 p-3 text-center"
              >
                <p className={cn('text-lg font-mono font-bold', s.color)}>{s.value}</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter tabs ─────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {FILTERS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold whitespace-nowrap transition-all',
                  filter === key
                    ? 'bg-for-500 text-white border border-for-400'
                    : 'bg-surface-100 text-surface-400 border border-surface-200 hover:bg-surface-200 hover:text-surface-200'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Timeline content ─────────────────────────────────────────────── */}
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/20 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => fetchTimeline(filter)}
              className="mt-3 text-xs font-mono text-surface-400 hover:text-white transition-colors flex items-center gap-1.5 mx-auto"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No activity yet"
            description={
              filter === 'all'
                ? `${displayName} hasn't taken any civic actions yet.`
                : `No ${filter} found for ${displayName}.`
            }
          />
        ) : (
          <div>
            <AnimatePresence mode="popLayout">
              {grouped.map((group) => (
                <div key={group.label}>
                  <MonthHeader label={group.label} />
                  <div className="space-y-2.5">
                    {group.events.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ))}
            </AnimatePresence>

            {/* Load more */}
            {nextCursor && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchTimeline(filter, nextCursor)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200 text-sm font-mono text-surface-300 hover:text-white transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}

            {/* End marker */}
            {!nextCursor && events.length > 0 && (
              <div className="mt-10 flex items-center gap-3">
                <div className="h-px flex-1 bg-surface-200" />
                <span className="text-xs font-mono text-surface-600">Beginning of record</span>
                <div className="h-px flex-1 bg-surface-200" />
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
