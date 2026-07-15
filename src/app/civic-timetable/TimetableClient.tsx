'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  ChevronRight,
  Clock,
  ExternalLink,
  Mic,
  Radio,
  RefreshCw,
  Scale,
  Siren,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TimetableDebate,
  TimetableEvent,
  TimetableResponse,
  TimetableVoting,
} from '@/app/api/timetable/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'ending now'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 60) return `${m}m left`
  if (h < 24) return `${h}h ${m % 60}m left`
  return `${Math.floor(h / 24)}d ${h % 24}h left`
}

function forPct(pct: number): string {
  return `${Math.round(pct)}% For`
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-against-300',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

function catColor(cat: string | null) {
  return cat && CAT_COLOR[cat] ? CAT_COLOR[cat] : 'text-surface-500'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
  color = 'text-surface-500',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  color?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={cn('h-4 w-4', color)} />
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{label}</h2>
      {count > 0 && (
        <span className="ml-auto text-xs text-surface-500 tabular-nums">{count}</span>
      )}
    </div>
  )
}

function DebateCard({ debate }: { debate: TimetableDebate }) {
  const isLive = debate.status === 'live'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-2xl border transition-colors',
          isLive
            ? 'bg-against-950/40 border-against-500/30 hover:border-against-500/60'
            : 'bg-surface-200/60 border-surface-300/40 hover:border-surface-400/60',
        )}
      >
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-xl',
            isLive ? 'bg-against-500/20' : 'bg-for-500/10',
          )}
        >
          <Mic
            className={cn('h-4 w-4', isLive ? 'text-against-400' : 'text-for-400')}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isLive && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-against-400">
                <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
                Live
              </span>
            )}
            {debate.category && (
              <span className={cn('text-[10px] font-medium uppercase tracking-wide', catColor(debate.category))}>
                {debate.category}
              </span>
            )}
            <span className="ml-auto text-[10px] text-surface-500 tabular-nums">
              {formatTime(debate.starts_at)}
            </span>
          </div>

          <p className="text-sm text-white font-medium leading-snug line-clamp-2">
            {debate.title}
          </p>

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-surface-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {debate.participant_count}
            </span>
            {debate.ends_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ends {formatTime(debate.ends_at)}
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

function VotingCard({ topic }: { topic: TimetableVoting }) {
  const remainingText = timeUntil(topic.voting_ends_at)
  const isUrgent = new Date(topic.voting_ends_at).getTime() - Date.now() < 3 * 60 * 60 * 1000

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex items-start gap-3 p-4 rounded-2xl border transition-colors',
          isUrgent
            ? 'bg-gold/5 border-gold/30 hover:border-gold/60'
            : 'bg-surface-200/60 border-surface-300/40 hover:border-surface-400/60',
        )}
      >
        <div
          className={cn(
            'flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-xl',
            isUrgent ? 'bg-gold/10' : 'bg-purple/10',
          )}
        >
          <Scale
            className={cn('h-4 w-4', isUrgent ? 'text-gold' : 'text-purple')}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isUrgent && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-gold">
                Closing soon
              </span>
            )}
            {topic.category && (
              <span className={cn('text-[10px] font-medium uppercase tracking-wide', catColor(topic.category))}>
                {topic.category}
              </span>
            )}
            <span className="ml-auto text-[10px] text-surface-500 tabular-nums">
              {remainingText}
            </span>
          </div>

          <p className="text-sm text-white font-medium leading-snug line-clamp-2">
            {topic.statement}
          </p>

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-surface-500">
            <span className={cn('font-medium', topic.blue_pct >= 50 ? 'text-for-400' : 'text-against-400')}>
              {forPct(topic.blue_pct)}
            </span>
            <span>{topic.total_votes.toLocaleString()} votes</span>
            <span>closes {formatDate(topic.voting_ends_at)} {formatTime(topic.voting_ends_at)}</span>
          </div>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
      </Link>
    </motion.div>
  )
}

const EVENT_CONFIG = {
  emergency_debate: {
    icon: Siren,
    color: 'text-against-400',
    bg: 'bg-against-950/40 border-against-500/30 hover:border-against-500/60',
    iconBg: 'bg-against-500/20',
    label: 'Emergency',
  },
  ama: {
    icon: Radio,
    color: 'text-gold',
    bg: 'bg-gold/5 border-gold/30 hover:border-gold/60',
    iconBg: 'bg-gold/10',
    label: 'AMA',
  },
  debate_challenge: {
    icon: Zap,
    color: 'text-purple',
    bg: 'bg-purple/5 border-purple/30 hover:border-purple/60',
    iconBg: 'bg-purple/10',
    label: 'Challenge',
  },
} as const

function EventCard({ event }: { event: TimetableEvent }) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link
        href={event.link}
        className={cn(
          'flex items-start gap-3 p-4 rounded-2xl border transition-colors',
          cfg.bg,
        )}
      >
        <div className={cn('flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-xl', cfg.iconBg)}>
          <Icon className={cn('h-4 w-4', cfg.color)} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', cfg.color)}>
              {cfg.label}
            </span>
            <span className="ml-auto text-[10px] text-surface-500 tabular-nums">
              {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
            </span>
          </div>
          <p className="text-sm text-white font-medium leading-snug line-clamp-2">
            {event.title}
          </p>
        </div>

        <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1.5" />
      </Link>
    </motion.div>
  )
}

function SkeletonSection() {
  return (
    <div className="mb-8">
      <Skeleton className="h-4 w-36 mb-3" />
      <div className="space-y-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TimetableClient() {
  const [data, setData] = useState<TimetableResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/timetable', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load timetable')
      setData(await res.json() as TimetableResponse)
    } catch {
      setError('Could not load the timetable. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Tick the clock every minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const totalItems =
    (data?.debates_today.length ?? 0) +
    (data?.debates_upcoming.length ?? 0) +
    (data?.voting_closing_today.length ?? 0) +
    (data?.voting_closing_soon.length ?? 0) +
    (data?.special_events.length ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-5 w-5 text-for-400" />
              <h1 className="text-xl font-bold text-white">Civic Timetable</h1>
            </div>
            <p className="text-sm text-surface-500">
              {now.toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              {' · '}
              <span className="tabular-nums">{formatTime(now.toISOString())}</span>
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh timetable"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Quick stats bar */}
        {data && totalItems > 0 && (
          <div className="flex gap-3 mb-6 overflow-x-auto pb-1 scrollbar-none">
            {data.debates_today.filter((d) => d.status === 'live').length > 0 && (
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-against-950/50 border border-against-500/30 text-xs text-against-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
                {data.debates_today.filter((d) => d.status === 'live').length} live debate{data.debates_today.filter((d) => d.status === 'live').length !== 1 ? 's' : ''}
              </div>
            )}
            {data.voting_closing_today.length > 0 && (
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/30 text-xs text-gold font-medium">
                <Scale className="h-3 w-3" />
                {data.voting_closing_today.length} vote{data.voting_closing_today.length !== 1 ? 's' : ''} closing today
              </div>
            )}
            {data.special_events.length > 0 && (
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple/10 border border-purple/30 text-xs text-purple font-medium">
                <Calendar className="h-3 w-3" />
                {data.special_events.length} special event{data.special_events.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <>
            <SkeletonSection />
            <SkeletonSection />
            <SkeletonSection />
          </>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400" />
            <p className="text-sm text-surface-500">{error}</p>
            <button
              onClick={() => load()}
              className="px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Special Events */}
              {data.special_events.length > 0 && (
                <section className="mb-8">
                  <SectionHeader
                    icon={Siren}
                    label="Special Events"
                    count={data.special_events.length}
                    color="text-against-400"
                  />
                  <div className="space-y-3">
                    {data.special_events.map((ev) => (
                      <EventCard key={ev.id} event={ev} />
                    ))}
                  </div>
                </section>
              )}

              {/* Debates Today */}
              {data.debates_today.length > 0 && (
                <section className="mb-8">
                  <SectionHeader
                    icon={Mic}
                    label="Debates Today"
                    count={data.debates_today.length}
                    color="text-for-400"
                  />
                  <div className="space-y-3">
                    {data.debates_today.map((d) => (
                      <DebateCard key={d.id} debate={d} />
                    ))}
                  </div>
                </section>
              )}

              {/* Voting Closing Today */}
              {data.voting_closing_today.length > 0 && (
                <section className="mb-8">
                  <SectionHeader
                    icon={Scale}
                    label="Votes Closing Today"
                    count={data.voting_closing_today.length}
                    color="text-gold"
                  />
                  <div className="space-y-3">
                    {data.voting_closing_today.map((t) => (
                      <VotingCard key={t.id} topic={t} />
                    ))}
                  </div>
                </section>
              )}

              {/* Upcoming Debates */}
              {data.debates_upcoming.length > 0 && (
                <section className="mb-8">
                  <SectionHeader
                    icon={Mic}
                    label="Upcoming Debates"
                    count={data.debates_upcoming.length}
                    color="text-surface-500"
                  />
                  <div className="space-y-3">
                    {data.debates_upcoming.map((d) => (
                      <DebateCard key={d.id} debate={d} />
                    ))}
                  </div>
                </section>
              )}

              {/* Voting Closing Soon (next 48h) */}
              {data.voting_closing_soon.length > 0 && (
                <section className="mb-8">
                  <SectionHeader
                    icon={Scale}
                    label="Votes Closing in 48h"
                    count={data.voting_closing_soon.length}
                    color="text-surface-500"
                  />
                  <div className="space-y-3">
                    {data.voting_closing_soon.map((t) => (
                      <VotingCard key={t.id} topic={t} />
                    ))}
                  </div>
                </section>
              )}

              {/* Empty state */}
              {totalItems === 0 && (
                <EmptyState
                  icon={Calendar}
                  title="All quiet on the civic front"
                  description="No live debates, closing votes, or special events scheduled right now. Check back soon — the Lobby never sleeps for long."
                  action={
                    <Link
                      href="/"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm transition-colors"
                    >
                      Browse the feed
                    </Link>
                  }
                />
              )}

              {/* Footer links */}
              {totalItems > 0 && (
                <div className="mt-6 pt-6 border-t border-surface-300/40 flex flex-wrap gap-3">
                  <Link
                    href="/calendar"
                    className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    Full calendar
                  </Link>
                  <Link
                    href="/debate"
                    className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    <Mic className="h-3.5 w-3.5" />
                    All debates
                  </Link>
                  <Link
                    href="/emergency-debates"
                    className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    <Siren className="h-3.5 w-3.5" />
                    Emergency debates
                  </Link>
                  <Link
                    href="/ama"
                    className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
                  >
                    <Radio className="h-3.5 w-3.5" />
                    AMA sessions
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
