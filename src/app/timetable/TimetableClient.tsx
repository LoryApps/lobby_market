'use client'

/**
 * /timetable — The Civic Timetable
 *
 * A live schedule of civic events: debates starting today or in the next 48h,
 * topics whose voting windows close soon, AMA sessions, and emergency debates.
 *
 * Think of it as the "What's On" guide for the platform — so users can plan
 * their civic engagement around what's actively happening.
 *
 * Distinct from:
 *   /debates          — full debate browser, all statuses
 *   /calendar         — personal calendar of your own events
 *   /today            — daily raw stats
 *   /live-debates     — feed mode filtered to live only
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CalendarClock,
  Clock,
  ExternalLink,
  Gavel,
  Mic,
  Radio,
  RefreshCw,
  Scale,
  Sparkles,
  Swords,
  Timer,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TimetableDebate,
  TimetableVoting,
  TimetableEvent,
  TimetableResponse,
} from '@/app/api/timetable/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatCountdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) return 'Now'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 48) return `${Math.floor(h / 24)}d`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function isLive(debate: TimetableDebate): boolean {
  return debate.status === 'live'
}

function votePct(pct: number): { label: string; side: 'for' | 'against' | 'tied' } {
  if (pct > 52) return { label: `${Math.round(pct)}% FOR`, side: 'for' }
  if (pct < 48) return { label: `${Math.round(100 - pct)}% AGAINST`, side: 'against' }
  return { label: 'TIED', side: 'tied' }
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold border-gold/30 bg-gold/10',
  Politics:    'text-for-300 border-for-500/30 bg-for-500/10',
  Technology:  'text-purple border-purple/30 bg-purple/10',
  Science:     'text-emerald border-emerald/30 bg-emerald/10',
  Ethics:      'text-for-200 border-for-400/30 bg-for-400/10',
  Philosophy:  'text-surface-300 border-surface-400/30 bg-surface-300/10',
  Culture:     'text-against-300 border-against-500/30 bg-against-500/10',
  Health:      'text-emerald border-emerald/30 bg-emerald/10',
  Environment: 'text-emerald border-emerald/30 bg-emerald/10',
  Education:   'text-gold border-gold/30 bg-gold/10',
}

function categoryClass(cat: string | null): string {
  return CATEGORY_COLORS[cat ?? ''] ?? 'text-surface-400 border-surface-400/30 bg-surface-300/10'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LivePip() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
  )
}

function SectionHeader({
  icon: Icon,
  label,
  count,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count?: number
  accent?: string
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg', accent ?? 'bg-surface-200 border border-surface-300')}>
        <Icon className="h-3.5 w-3.5 text-white" />
      </div>
      <span className="font-mono text-sm font-bold text-white tracking-wide uppercase">{label}</span>
      {count !== undefined && (
        <span className="ml-auto font-mono text-xs text-surface-500">{count} events</span>
      )}
    </div>
  )
}

function DebateRow({ debate }: { debate: TimetableDebate }) {
  const live = isLive(debate)
  const href = `/debate/${debate.id}`

  return (
    <Link href={href}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'group flex items-start gap-4 p-4 rounded-xl border transition-all',
          live
            ? 'bg-against-900/30 border-against-500/40 hover:border-against-400/60'
            : 'bg-surface-100/60 border-surface-300/60 hover:border-surface-400/60'
        )}
      >
        {/* Time column */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5 w-14 text-center">
          {live ? (
            <>
              <LivePip />
              <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-widest">LIVE</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-[10px] font-mono text-surface-500">{formatTime(debate.starts_at)}</span>
              <span className="text-[10px] font-mono font-semibold text-for-400">
                -{formatCountdown(debate.starts_at)}
              </span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {debate.title}
          </p>
          {debate.topic_statement && debate.title !== debate.topic_statement && (
            <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{debate.topic_statement}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {debate.category && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', categoryClass(debate.category))}>
                {debate.category}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              {debate.participant_count}
            </span>
            {live && (
              <span className="text-[10px] font-mono font-bold text-red-400 uppercase tracking-wider">● Live Now</span>
            )}
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </motion.div>
    </Link>
  )
}

function VotingRow({ topic }: { topic: TimetableVoting }) {
  const { label, side } = votePct(topic.blue_pct)
  const countdown = formatCountdown(topic.voting_ends_at)
  const isToday = new Date(topic.voting_ends_at).toDateString() === new Date().toDateString()

  return (
    <Link href={`/topic/${topic.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="group flex items-start gap-4 p-4 rounded-xl border bg-surface-100/60 border-surface-300/60 hover:border-surface-400/60 transition-all"
      >
        {/* Timer column */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5 w-14 text-center">
          <Timer className={cn('h-3.5 w-3.5', isToday ? 'text-against-400' : 'text-gold')} />
          <span className={cn('text-[11px] font-mono font-bold', isToday ? 'text-against-400' : 'text-gold')}>
            {countdown}
          </span>
          <span className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">left</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {topic.category && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', categoryClass(topic.category))}>
                {topic.category}
              </span>
            )}
            {/* Vote bar */}
            <div className="flex items-center gap-1.5">
              <div className="flex h-1.5 w-20 rounded-full overflow-hidden bg-surface-300">
                <div
                  className="bg-for-500 h-full transition-all"
                  style={{ width: `${topic.blue_pct}%` }}
                />
              </div>
              <span className={cn(
                'text-[10px] font-mono font-semibold',
                side === 'for' ? 'text-for-300' : side === 'against' ? 'text-against-300' : 'text-surface-400'
              )}>
                {label}
              </span>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500 ml-auto">
              <Users className="h-3 w-3" />
              {topic.total_votes.toLocaleString()}
            </span>
          </div>
        </div>

        <Scale className="h-4 w-4 text-surface-600 group-hover:text-purple flex-shrink-0 mt-1 transition-colors" />
      </motion.div>
    </Link>
  )
}

function SpecialEventRow({ event }: { event: TimetableEvent }) {
  const icons = {
    emergency_debate: AlertCircle,
    ama: Mic,
    debate_challenge: Swords,
  }
  const colors = {
    emergency_debate: 'text-against-300 border-against-500/30 bg-against-500/10',
    ama: 'text-purple border-purple/30 bg-purple/10',
    debate_challenge: 'text-gold border-gold/30 bg-gold/10',
  }
  const labels = {
    emergency_debate: 'Emergency Debate',
    ama: 'AMA Session',
    debate_challenge: 'Debate Challenge',
  }
  const Icon = icons[event.type]

  return (
    <Link href={event.link}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="group flex items-center gap-4 p-4 rounded-xl border bg-surface-100/60 border-surface-300/60 hover:border-surface-400/60 transition-all"
      >
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg border flex-shrink-0', colors[event.type])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-1 group-hover:text-for-300 transition-colors">
            {event.title}
          </p>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">
            {labels[event.type]} · {formatTime(event.starts_at)}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 transition-colors" />
      </motion.div>
    </Link>
  )
}

function SkeletonSection({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-36 rounded-lg" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TimetableClient() {
  const [data, setData] = useState<TimetableResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const res = await fetch('/api/timetable', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as TimetableResponse
        setData(json)
        setLastUpdated(new Date())
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
    // Auto-refresh every 2 minutes
    intervalRef.current = setInterval(() => void load(true), 120_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load])

  const totalEvents = data
    ? data.debates_today.length +
      data.debates_upcoming.length +
      data.voting_closing_today.length +
      data.voting_closing_soon.length +
      data.special_events.length
    : 0

  const hasAnything = totalEvents > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/20 border border-purple/30">
              <CalendarClock className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white tracking-tight">
                What&apos;s On
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Live civic schedule · {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] font-mono text-surface-600 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary bar */}
        {!loading && data && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
          >
            {[
              {
                label: 'Live Debates',
                value: data.debates_today.filter(isLive).length,
                icon: Radio,
                color: 'text-red-400',
                bg: 'bg-red-500/10 border-red-500/30',
              },
              {
                label: 'Debates Today',
                value: data.debates_today.length,
                icon: Swords,
                color: 'text-for-300',
                bg: 'bg-for-500/10 border-for-500/30',
              },
              {
                label: 'Votes Closing',
                value: data.voting_closing_today.length + data.voting_closing_soon.length,
                icon: Scale,
                color: 'text-purple',
                bg: 'bg-purple/10 border-purple/30',
              },
              {
                label: 'Special Events',
                value: data.special_events.length,
                icon: Sparkles,
                color: 'text-gold',
                bg: 'bg-gold/10 border-gold/30',
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div
                key={label}
                className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border', bg)}
              >
                <Icon className={cn('h-4 w-4', color)} />
                <span className={cn('text-2xl font-mono font-bold', color)}>{value}</span>
                <span className="text-[10px] font-mono text-surface-500 text-center">{label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-10"
            >
              <SkeletonSection rows={3} />
              <SkeletonSection rows={3} />
              <SkeletonSection rows={2} />
            </motion.div>
          ) : !hasAnything ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Calendar}
                title="The Lobby is quiet"
                description="No debates, votes, or special events scheduled for the next 48 hours. Check back later or browse all debates."
                action={{ label: 'Browse Debates', href: '/debates' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-10"
            >

              {/* Live & Today's Debates */}
              {data && data.debates_today.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Radio}
                    label="Debates Today"
                    count={data.debates_today.length}
                    accent="bg-red-500/20 border border-red-500/40"
                  />
                  <div className="space-y-3">
                    {data.debates_today.map((d) => (
                      <DebateRow key={d.id} debate={d} />
                    ))}
                  </div>
                </section>
              )}

              {/* Special Events */}
              {data && data.special_events.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Sparkles}
                    label="Special Events"
                    count={data.special_events.length}
                    accent="bg-gold/20 border border-gold/40"
                  />
                  <div className="space-y-3">
                    {data.special_events.map((e) => (
                      <SpecialEventRow key={e.id} event={e} />
                    ))}
                  </div>
                </section>
              )}

              {/* Votes Closing Today */}
              {data && data.voting_closing_today.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Gavel}
                    label="Votes Closing Today"
                    count={data.voting_closing_today.length}
                    accent="bg-against-500/20 border border-against-500/40"
                  />
                  <div className="space-y-3">
                    {data.voting_closing_today.map((t) => (
                      <VotingRow key={t.id} topic={t} />
                    ))}
                  </div>
                </section>
              )}

              {/* Upcoming Debates */}
              {data && data.debates_upcoming.length > 0 && (
                <section>
                  <SectionHeader
                    icon={CalendarClock}
                    label="Coming Up"
                    count={data.debates_upcoming.length}
                    accent="bg-for-500/20 border border-for-500/40"
                  />
                  <div className="space-y-3">
                    {data.debates_upcoming.map((d) => (
                      <DebateRow key={d.id} debate={d} />
                    ))}
                  </div>
                </section>
              )}

              {/* Votes Closing Soon (next 48h) */}
              {data && data.voting_closing_soon.length > 0 && (
                <section>
                  <SectionHeader
                    icon={Timer}
                    label="Votes Closing Soon"
                    count={data.voting_closing_soon.length}
                    accent="bg-purple/20 border border-purple/40"
                  />
                  <div className="space-y-3">
                    {data.voting_closing_soon.map((t) => (
                      <VotingRow key={t.id} topic={t} />
                    ))}
                  </div>
                </section>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-surface-200 flex items-center justify-between">
                <p className="text-xs font-mono text-surface-600">
                  Auto-refreshes every 2 minutes
                </p>
                <div className="flex items-center gap-3">
                  <Link
                    href="/debates"
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    All debates <ArrowRight className="h-3 w-3" />
                  </Link>
                  <Link
                    href="/topics"
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    All topics <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
