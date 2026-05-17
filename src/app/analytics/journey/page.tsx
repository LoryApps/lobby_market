'use client'

/**
 * /analytics/journey — Civic Journey Timeline
 *
 * A narrative, chronological timeline of the user's most significant
 * civic moments on Lobby Market: first vote, arguments written, debates
 * joined, achievements unlocked, and laws they helped shape.
 *
 * Distinct from:
 *   /analytics/legacy      — current-state summary + Legacy Tier
 *   /analytics/evolution   — opinion drift over 12 weeks
 *   /analytics/snapshot    — identity card / archetype
 *   /activity              — flat chronological activity log
 *   /milestones            — achievement completion status
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  BarChart2,
  Calendar,
  ChevronRight,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  Landmark,
  MessageSquare,
  Mic,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { JourneyEvent, JourneyEventType, JourneyResponse, JourneyStats } from '@/app/api/analytics/journey/route'

// ─── Event type config ─────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  JourneyEventType,
  {
    icon: typeof Vote
    color: string
    bg: string
    border: string
    dotColor: string
  }
> = {
  joined: {
    icon: Rocket,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    dotColor: 'bg-gold',
  },
  first_vote: {
    icon: Vote,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    dotColor: 'bg-for-500',
  },
  vote_milestone: {
    icon: ThumbsUp,
    color: 'text-for-300',
    bg: 'bg-for-500/8',
    border: 'border-for-500/30',
    dotColor: 'bg-for-500',
  },
  first_argument: {
    icon: MessageSquare,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    dotColor: 'bg-purple',
  },
  argument_milestone: {
    icon: MessageSquare,
    color: 'text-purple',
    bg: 'bg-purple/8',
    border: 'border-purple/30',
    dotColor: 'bg-purple',
  },
  first_debate: {
    icon: Mic,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    dotColor: 'bg-against-500',
  },
  law_voted: {
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    dotColor: 'bg-gold',
  },
  achievement: {
    icon: Award,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    dotColor: 'bg-emerald',
  },
  first_prediction: {
    icon: BarChart2,
    color: 'text-surface-400',
    bg: 'bg-surface-200/60',
    border: 'border-surface-400/30',
    dotColor: 'bg-surface-400',
  },
  clout_milestone: {
    icon: Coins,
    color: 'text-gold',
    bg: 'bg-gold/8',
    border: 'border-gold/30',
    dotColor: 'bg-gold',
  },
  streak_milestone: {
    icon: Flame,
    color: 'text-against-300',
    bg: 'bg-against-500/8',
    border: 'border-against-500/30',
    dotColor: 'bg-against-500',
  },
  archetype_set: {
    icon: Sparkles,
    color: 'text-surface-400',
    bg: 'bg-surface-200/50',
    border: 'border-surface-400/25',
    dotColor: 'bg-surface-500',
  },
}

// ─── Tier badge for achievements ──────────────────────────────────────────────

const ACHIEVEMENT_TIER_STYLE: Record<string, string> = {
  legendary: 'text-gold bg-gold/10 border-gold/30',
  epic: 'text-purple bg-purple/10 border-purple/30',
  rare: 'text-for-400 bg-for-500/10 border-for-500/30',
  common: 'text-surface-400 bg-surface-200/60 border-surface-400/20',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function groupByMonth(events: JourneyEvent[]): { monthKey: string; label: string; events: JourneyEvent[] }[] {
  const groups: Map<string, { label: string; events: JourneyEvent[] }> = new Map()

  for (const ev of events) {
    const d = new Date(ev.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups.has(key)) {
      groups.set(key, {
        label: formatMonthYear(ev.date),
        events: [],
      })
    }
    groups.get(key)!.events.push(ev)
  }

  return Array.from(groups.entries()).map(([k, v]) => ({
    monthKey: k,
    label: v.label,
    events: v.events,
  }))
}

// ─── Stats header ──────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: JourneyStats }) {
  const items = [
    { label: 'Days in Lobby', value: stats.days_as_member.toLocaleString(), icon: Calendar },
    { label: 'Votes Cast', value: stats.total_votes.toLocaleString(), icon: Vote },
    { label: 'Arguments', value: stats.total_arguments.toLocaleString(), icon: MessageSquare },
    { label: 'Clout', value: stats.clout.toLocaleString(), icon: Coins },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div
            key={item.label}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center"
          >
            <Icon className="h-4 w-4 text-surface-500 mx-auto mb-1.5" />
            <p className="text-lg font-mono font-bold text-white">{item.value}</p>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5">{item.label}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Timeline event card ───────────────────────────────────────────────────────

function EventCard({
  event,
  index,
  isLast,
}: {
  event: JourneyEvent
  index: number
  isLast: boolean
}) {
  const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.archetype_set
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="relative flex gap-4"
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={cn(
            'flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0 z-10',
            cfg.bg,
            cfg.border,
            event.highlight && 'shadow-sm'
          )}
        >
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-surface-300/60 mt-1 min-h-[24px]" />
        )}
      </div>

      {/* Content */}
      <div className={cn('pb-6 flex-1 min-w-0', isLast && 'pb-0')}>
        <div
          className={cn(
            'rounded-xl border p-3.5 transition-all',
            event.highlight
              ? cn('border-surface-400/50 bg-surface-100', cfg.border.replace('border-', 'border-l-2 border-'))
              : 'border-surface-300/60 bg-surface-100/70'
          )}
        >
          {/* Title + date row */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {event.highlight && (
                <Star className="h-3 w-3 text-gold flex-shrink-0 fill-gold" />
              )}
              <p className={cn(
                'text-sm font-mono font-semibold leading-snug truncate',
                event.highlight ? 'text-white' : 'text-surface-200'
              )}>
                {event.title}
              </p>
            </div>
            <span className="text-[11px] font-mono text-surface-600 flex-shrink-0">
              {formatDate(event.date)}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            {event.description}
          </p>

          {/* Achievement tier badge */}
          {event.type === 'achievement' && event.achievement_tier && (
            <div className="mt-2">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border uppercase tracking-wider',
                ACHIEVEMENT_TIER_STYLE[event.achievement_tier] ?? ACHIEVEMENT_TIER_STYLE.common
              )}>
                {event.achievement_tier}
              </span>
            </div>
          )}

          {/* Topic link */}
          {event.topic_id && (
            <div className="mt-2">
              <Link
                href={`/topic/${event.topic_id}`}
                className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-300 transition-colors"
              >
                View topic
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-4 w-4 mx-auto mb-2 rounded" />
            <Skeleton className="h-6 w-16 mx-auto mb-1" />
            <Skeleton className="h-3 w-20 mx-auto" />
          </div>
        ))}
      </div>

      {/* Month group */}
      <Skeleton className="h-4 w-32 mb-3" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 rounded-xl border border-surface-300 p-3.5 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CivicJourneyPage() {
  const router = useRouter()
  const [data, setData] = useState<JourneyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/journey', { cache: 'no-store' })
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const groups = data ? groupByMonth(data.events) : []
  const highlightCount = data?.events.filter((e) => e.highlight).length ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Landmark className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Journey</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {loading
                  ? 'Building your timeline…'
                  : data
                  ? `${data.events.length} milestones · ${highlightCount} highlights`
                  : 'Your civic story'}
              </p>
            </div>
          </div>

          {!loading && data && (
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                aria-label="Refresh timeline"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-400 border border-surface-400/40 hover:text-white hover:border-surface-400 transition-all"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* Archetype badge */}
        {data?.stats.civic_archetype && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple/30 bg-purple/8 w-fit"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple flex-shrink-0" />
            <p className="text-xs font-mono text-purple font-semibold">
              Civic Archetype: {data.stats.civic_archetype}
            </p>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="font-mono text-sm text-against-300 mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Try again
            </button>
          </div>
        ) : data && data.events.length === 0 ? (
          <>
            <StatsRow stats={data.stats} />
            <EmptyState
              icon={Landmark}
              title="Your journey starts here"
              description="Cast your first vote, write an argument, or join a debate to begin your civic story."
              action={
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-700 transition-colors"
                >
                  <Flame className="h-3 w-3" />
                  Browse topics
                </Link>
              }
            />
          </>
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Stats row */}
              <StatsRow stats={data.stats} />

              {/* Timeline groups */}
              <div className="space-y-8">
                {groups.map((group, gi) => (
                  <motion.div
                    key={group.monthKey}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: gi * 0.06 }}
                  >
                    {/* Month label */}
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
                      <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                        {group.label}
                      </p>
                    </div>

                    {/* Events in this month */}
                    <div className="space-y-0">
                      {group.events.map((ev, ei) => (
                        <EventCard
                          key={ev.id}
                          event={ev}
                          index={ei}
                          isLast={gi === groups.length - 1 && ei === group.events.length - 1}
                        />
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer nav */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-10 grid grid-cols-2 gap-3"
              >
                <Link
                  href="/analytics/legacy"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Legacy Report</p>
                    <p className="text-[11px] font-mono text-surface-500">Your civic tier &amp; impact</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
                <Link
                  href="/analytics"
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">Full Analytics</p>
                    <p className="text-[11px] font-mono text-surface-500">Stats &amp; voting patterns</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
