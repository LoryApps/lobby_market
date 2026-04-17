'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Calendar,
  FileText,
  Gavel,
  Loader2,
  Mic,
  RefreshCw,
  Scale,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ActivityEvent, ActivityEventType } from '@/app/api/activity/route'

// ─── Event config ─────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<
  ActivityEventType,
  {
    icon: typeof FileText
    color: string
    bg: string
    border: string
    label: string
    verb: string
  }
> = {
  topic_proposed: {
    icon: FileText,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    label: 'New Topic',
    verb: 'proposed',
  },
  topic_active: {
    icon: Zap,
    color: 'text-for-300',
    bg: 'bg-for-600/15',
    border: 'border-for-600/25',
    label: 'Now Active',
    verb: 'moved to active voting',
  },
  topic_voting: {
    icon: Scale,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
    label: 'Final Vote',
    verb: 'entered final voting',
  },
  law_established: {
    icon: Gavel,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/20',
    label: 'Law Established',
    verb: 'became law',
  },
  debate_scheduled: {
    icon: Calendar,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    label: 'Debate Scheduled',
    verb: 'debate scheduled',
  },
  debate_live: {
    icon: Mic,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/20',
    label: 'Live Debate',
    verb: 'debate is live',
  },
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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  const diff = Math.floor(
    (today.getTime() - d.getTime()) / 86_400_000
  )
  if (diff < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'long' })
  }
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year:
      d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  })
}

/** Group events into day buckets */
function groupByDay(events: ActivityEvent[]): { label: string; events: ActivityEvent[] }[] {
  const buckets = new Map<string, ActivityEvent[]>()

  for (const ev of events) {
    const label = dayLabel(ev.timestamp)
    const bucket = buckets.get(label) ?? []
    bucket.push(ev)
    buckets.set(label, bucket)
  }

  return Array.from(buckets.entries()).map(([label, evs]) => ({
    label,
    events: evs,
  }))
}

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({ event, index }: { event: ActivityEvent; index: number }) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.4) }}
      className="relative flex gap-4 pl-10"
    >
      {/* Timeline dot */}
      <div
        className={cn(
          'absolute left-0 flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
          cfg.bg,
          'border',
          cfg.border
        )}
      >
        <Icon className={cn('h-3.5 w-3.5', cfg.color)} aria-hidden="true" />
      </div>

      {/* Card */}
      <Link
        href={event.href}
        className={cn(
          'flex-1 group rounded-xl p-4',
          'bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/60',
          'transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40'
        )}
      >
        {/* Type label + time */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-widest',
              cfg.color
            )}
          >
            <span
              className={cn('h-1.5 w-1.5 rounded-full inline-block', cfg.bg.replace('bg-', 'bg-').replace('/10', '').replace('/15', ''))}
              style={{
                backgroundColor:
                  event.type === 'topic_proposed'
                    ? 'rgb(96 165 250 / 0.9)'
                    : event.type === 'topic_active'
                    ? 'rgb(59 130 246)'
                    : event.type === 'topic_voting'
                    ? 'rgb(168 85 247)'
                    : event.type === 'law_established'
                    ? 'rgb(52 211 153)'
                    : event.type === 'debate_scheduled'
                    ? 'rgb(201 168 76)'
                    : 'rgb(248 113 113)',
              }}
            />
            {cfg.label}
          </span>
          <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
            {relativeTime(event.timestamp)}
          </span>
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {event.statement}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2.5 flex-wrap">
          {event.category && (
            <span className="text-[10px] font-mono text-surface-500">
              {event.category}
            </span>
          )}
          {event.extra && (
            <span
              className={cn(
                'text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full',
                event.type === 'debate_live'
                  ? 'bg-against-500/20 text-against-400'
                  : event.type === 'law_established'
                  ? 'bg-emerald/10 text-emerald'
                  : 'bg-surface-300 text-surface-500'
              )}
            >
              {event.extra}
            </span>
          )}
          {event.author && (
            <span className="flex items-center gap-1 ml-auto">
              <Avatar
                src={event.author.avatar_url}
                fallback={event.author.display_name ?? event.author.username}
                size="xs"
              />
              <span className="text-[10px] text-surface-500 font-mono">
                @{event.author.username}
              </span>
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Day group ────────────────────────────────────────────────────────────────

function DayGroup({
  label,
  events,
  startIndex,
}: {
  label: string
  events: ActivityEvent[]
  startIndex: number
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
          {label}
        </span>
        <div className="flex-1 h-px bg-surface-300" aria-hidden="true" />
      </div>

      {/* Vertical timeline line */}
      <div className="relative">
        {/* The connecting line behind all dots */}
        <div
          className="absolute left-3.5 top-4 bottom-4 w-px bg-surface-300"
          aria-hidden="true"
        />
        <div className="space-y-3">
          {events.map((ev, i) => (
            <EventRow
              key={ev.id}
              event={ev}
              index={startIndex + i}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((g) => (
        <div key={g}>
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-3 w-16" />
            <div className="flex-1 h-px bg-surface-300" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: g === 1 ? 4 : 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 pl-10 relative">
                <Skeleton className="absolute left-0 h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="flex items-center gap-2 pt-0.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function ActivityEmptyState() {
  return (
    <EmptyState
      icon={Activity}
      title="No recent activity"
      description="Platform events will appear here as they happen."
      actions={[{ label: 'Propose the first topic', href: '/topic/create' }]}
    />
  )
}

// ─── Live pulse dot ───────────────────────────────────────────────────────────

function PulseDot() {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-against-400 opacity-60" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-against-500" />
    </span>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({ events }: { events: ActivityEvent[] }) {
  const today = new Date().toDateString()
  const todayEvents = events.filter(
    (e) => new Date(e.timestamp).toDateString() === today
  )
  const lawsToday = todayEvents.filter((e) => e.type === 'law_established').length
  const topicsToday = todayEvents.filter((e) => e.type === 'topic_proposed').length
  const debatesToday = todayEvents.filter(
    (e) => e.type === 'debate_live' || e.type === 'debate_scheduled'
  ).length

  const items = [
    { label: 'Topics Today', value: topicsToday, color: 'text-for-400' },
    { label: 'Laws Today', value: lawsToday, color: 'text-emerald' },
    { label: 'Debates', value: debatesToday, color: 'text-gold' },
    { label: 'Total Events', value: events.length, color: 'text-surface-400' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3"
        >
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
            {item.label}
          </p>
          <p className={cn('text-xl font-mono font-bold', item.color)}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'topics' | 'laws' | 'debates'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'topics', label: 'Topics' },
  { id: 'laws', label: 'Laws' },
  { id: 'debates', label: 'Debates' },
]

function filterEvents(events: ActivityEvent[], tab: FilterTab): ActivityEvent[] {
  if (tab === 'all') return events
  if (tab === 'topics')
    return events.filter(
      (e) =>
        e.type === 'topic_proposed' ||
        e.type === 'topic_active' ||
        e.type === 'topic_voting'
    )
  if (tab === 'laws') return events.filter((e) => e.type === 'law_established')
  if (tab === 'debates')
    return events.filter(
      (e) => e.type === 'debate_scheduled' || e.type === 'debate_live'
    )
  return events
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const router = useRouter()
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/activity')
      if (!res.ok) throw new Error('Failed to load activity')
      const { events: data } = await res.json()
      setEvents(data ?? [])
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load + 60-second polling
  useEffect(() => {
    fetchEvents()

    pollRef.current = setInterval(() => {
      fetchEvents()
    }, 60_000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchEvents])

  const filtered = filterEvents(events, activeFilter)
  const grouped = groupByDay(filtered)
  const liveCount = events.filter((e) => e.type === 'debate_live').length

  // Cumulative index for staggered animation
  let globalIndex = 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white font-mono">
                Activity
              </h1>
              {liveCount > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-against-400 uppercase tracking-widest">
                  <PulseDot />
                  {liveCount} live
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              What&apos;s happening in the Lobby — last 14 days
            </p>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => fetchEvents(true)}
            disabled={refreshing}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0',
              refreshing && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Refresh activity"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
            />
          </button>
        </div>

        {/* ── Last updated ──────────────────────────────────────────────── */}
        {lastUpdated && !loading && (
          <p className="text-[10px] font-mono text-surface-600 mb-4 -mt-2">
            Updated {relativeTime(lastUpdated.toISOString())} · auto-refreshes every 60s
          </p>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && <ActivitySkeleton />}

        {/* ── Content ───────────────────────────────────────────────────── */}
        {!loading && events.length > 0 && (
          <>
            {/* Stats strip */}
            <StatsStrip events={events} />

            {/* Filter tabs */}
            <div
              role="tablist"
              aria-label="Filter activity by type"
              className="flex items-center gap-1 p-1 bg-surface-200 rounded-xl mb-6"
            >
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeFilter === tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    'flex-1 h-8 rounded-lg text-xs font-mono font-medium transition-colors',
                    activeFilter === tab.id
                      ? 'bg-surface-100 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Timeline */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFilter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-8"
              >
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-surface-200 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-surface-500" />
                    </div>
                    <p className="text-surface-500 text-sm">
                      No {activeFilter} events in this window.
                    </p>
                  </div>
                ) : (
                  grouped.map(({ label, events: groupEvents }) => {
                    const startIdx = globalIndex
                    globalIndex += groupEvents.length
                    return (
                      <DayGroup
                        key={label}
                        label={label}
                        events={groupEvents}
                        startIndex={startIdx}
                      />
                    )
                  })
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && events.length === 0 && !error && <ActivityEmptyState />}

        {/* ── Spinner overlay during refresh (non-blocking) ─────────────── */}
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
