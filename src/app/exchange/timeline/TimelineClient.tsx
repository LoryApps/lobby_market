'use client'

/**
 * /exchange/timeline — Global Exchange Market Timeline
 *
 * A unified chronological stream of significant events across all civic
 * prediction markets: new markets, status transitions, price milestones,
 * near-law alerts, and high-volume bursts.
 *
 * Distinct from:
 *   /exchange/movers    — 24h gainers/losers by delta
 *   /exchange/activity  — per-market activity log (inside [id])
 *   /exchange/momentum  — per-topic vote velocity ranking
 *   /exchange/pulse     — platform-wide live dashboard
 *
 * This is the only page surfacing ALL market-level events in one feed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TimelineEvent, TimelineEventType, TimelineResponse } from '@/app/api/exchange/timeline/route'

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
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function priceColor(price: number): string {
  if (price >= 75) return 'text-gold'
  if (price >= 60) return 'text-for-400'
  if (price <= 25) return 'text-against-400'
  if (price <= 40) return 'text-against-300'
  return 'text-surface-500'
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Event config ─────────────────────────────────────────────────────────────

interface EventConfig {
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  dotColor: string
}

const EVENT_CONFIGS: Record<TimelineEventType, EventConfig> = {
  became_law: {
    label: 'Became Law',
    icon: Gavel,
    iconColor: 'text-gold',
    dotColor: 'bg-gold',
  },
  market_failed: {
    label: 'Market Failed',
    icon: XCircle,
    iconColor: 'text-against-400',
    dotColor: 'bg-against-500',
  },
  went_voting: {
    label: 'Voting Phase',
    icon: Scale,
    iconColor: 'text-purple',
    dotColor: 'bg-purple',
  },
  price_surge: {
    label: 'Price Surge',
    icon: TrendingUp,
    iconColor: 'text-emerald',
    dotColor: 'bg-emerald',
  },
  price_drop: {
    label: 'Price Drop',
    icon: TrendingDown,
    iconColor: 'text-against-400',
    dotColor: 'bg-against-500',
  },
  near_law: {
    label: 'Near Law',
    icon: Flame,
    iconColor: 'text-gold',
    dotColor: 'bg-gold',
  },
  went_active: {
    label: 'Now Active',
    icon: Zap,
    iconColor: 'text-for-400',
    dotColor: 'bg-for-400',
  },
  new_market: {
    label: 'New Market',
    icon: Activity,
    iconColor: 'text-for-300',
    dotColor: 'bg-for-500',
  },
  high_volume: {
    label: 'High Volume',
    icon: BarChart2,
    iconColor: 'text-surface-600',
    dotColor: 'bg-surface-400',
  },
}

const EVENT_FILTERS: Array<{ key: TimelineEventType | 'all'; label: string }> = [
  { key: 'all', label: 'All Events' },
  { key: 'became_law', label: 'Laws' },
  { key: 'market_failed', label: 'Failed' },
  { key: 'went_voting', label: 'Voting' },
  { key: 'price_surge', label: 'Surges' },
  { key: 'price_drop', label: 'Drops' },
  { key: 'near_law', label: 'Near Law' },
  { key: 'new_market', label: 'New' },
  { key: 'high_volume', label: 'Volume' },
]

const WINDOW_OPTIONS = [
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
  { value: 72, label: '3d' },
  { value: 168, label: '7d' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function TimelineEventCard({ event, isNew }: { event: TimelineEvent; isNew?: boolean }) {
  const config = EVENT_CONFIGS[event.type]
  const Icon = config.icon

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -12 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="relative flex gap-4"
    >
      {/* Timeline connector dot */}
      <div className="relative flex flex-col items-center">
        <div className={cn(
          'mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-surface-100',
          config.dotColor,
        )} />
        <div className="mt-1 w-px flex-1 bg-surface-300/40" />
      </div>

      {/* Event card */}
      <Link
        href={`/exchange/${event.topic_id}`}
        className="mb-4 flex-1 rounded-xl border border-surface-300/30 bg-surface-100/60 p-4 transition-colors hover:border-surface-400/50 hover:bg-surface-200/60"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={cn('h-4 w-4 shrink-0', config.iconColor)} />
            <span className={cn('text-xs font-medium', config.iconColor)}>{config.label}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn('text-sm font-bold tabular-nums', priceColor(event.current_price))}>
              {event.current_price}¢
            </span>
            {event.price_delta !== undefined && event.price_delta !== 0 && (
              <span className={cn(
                'text-xs font-medium tabular-nums',
                event.price_delta > 0 ? 'text-emerald' : 'text-against-400',
              )}>
                {event.price_delta > 0 ? '+' : ''}{event.price_delta.toFixed(1)}¢
              </span>
            )}
          </div>
        </div>

        <p className="mb-2 text-sm font-medium leading-snug text-surface-700 line-clamp-2">
          {event.statement}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {event.category && (
            <Badge variant="outline" className="border-surface-300/50 text-xs text-surface-500">
              {event.category}
            </Badge>
          )}
          {event.total_votes !== undefined && event.total_votes > 0 && (
            <span className="text-xs text-surface-500">
              {formatVotes(event.total_votes)} votes
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 text-xs text-surface-500">
            <Clock className="h-3 w-3" />
            {relTime(event.occurred_at)}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="relative flex gap-4">
          <div className="relative flex flex-col items-center">
            <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-surface-300" />
            <div className="mt-1 w-px flex-1 bg-surface-300/40 min-h-[80px]" />
          </div>
          <div className="mb-4 flex-1">
            <Skeleton className="h-[90px] w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

const AUTO_REFRESH_MS = 90_000

export function TimelineClient() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [asOf, setAsOf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<TimelineEventType | 'all'>('all')
  const [windowHours, setWindowHours] = useState(48)
  const [showWindowPicker, setShowWindowPicker] = useState(false)
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set())
  const prevEventIds = useRef<Set<string>>(new Set())
  const isInitialLoad = useRef(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchTimeline = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)

    try {
      const params = new URLSearchParams({
        hours: windowHours.toString(),
        limit: '60',
        ...(filter !== 'all' ? { type: filter } : {}),
      })
      const res = await fetch(`/api/exchange/timeline?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)

      const data: TimelineResponse = await res.json()
      const incoming = data.events

      // Detect new events since last fetch (skip on initial load)
      const incomingIds = new Set(incoming.map((e) => e.id))
      const fresh = new Set(
        Array.from(incomingIds).filter((id) => !prevEventIds.current.has(id)),
      )
      prevEventIds.current = incomingIds

      setEvents(incoming)
      setAsOf(data.as_of)
      setError(null)

      if (fresh.size > 0 && !isInitialLoad.current) {
        setNewEventIds(fresh)
        setTimeout(() => setNewEventIds(new Set()), 3000)
      }
      isInitialLoad.current = false
    } catch {
      setError('Failed to load timeline')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, windowHours])

  // Initial load + filter/window changes
  useEffect(() => {
    isInitialLoad.current = true
    setLoading(true)
    setEvents([])
    fetchTimeline()
  }, [filter, windowHours]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh
  useEffect(() => {
    timerRef.current = setInterval(() => fetchTimeline(false), AUTO_REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchTimeline])

  const windowLabel = WINDOW_OPTIONS.find((o) => o.value === windowHours)?.label ?? '48h'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="mx-auto max-w-2xl px-4 py-8 pb-28 md:pb-12">
        {/* Header */}
        <div className="mb-6">
          <div className="mb-4 flex items-center gap-3">
            <Link
              href="/exchange"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-300/40 bg-surface-100/60 text-surface-600 transition-colors hover:bg-surface-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-surface-900">Market Timeline</h1>
              <p className="text-xs text-surface-500">
                Real-time event stream across all civic prediction markets
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Window picker */}
              <div className="relative">
                <button
                  onClick={() => setShowWindowPicker((p) => !p)}
                  className="flex items-center gap-1.5 rounded-lg border border-surface-300/40 bg-surface-100/60 px-3 py-1.5 text-xs text-surface-600 transition-colors hover:bg-surface-200"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {windowLabel}
                  <ChevronDown className="h-3 w-3" />
                </button>
                <AnimatePresence>
                  {showWindowPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.95 }}
                      className="absolute right-0 top-full z-20 mt-1 w-28 rounded-xl border border-surface-300/40 bg-surface-100 p-1 shadow-xl"
                    >
                      {WINDOW_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setWindowHours(opt.value); setShowWindowPicker(false) }}
                          className={cn(
                            'w-full rounded-lg px-3 py-2 text-left text-xs transition-colors',
                            windowHours === opt.value
                              ? 'bg-surface-200 text-surface-900'
                              : 'text-surface-600 hover:bg-surface-200/60',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Refresh */}
              <button
                onClick={() => fetchTimeline(true)}
                disabled={refreshing}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-300/40 bg-surface-100/60 text-surface-600 transition-colors hover:bg-surface-200 disabled:opacity-50"
                aria-label="Refresh timeline"
              >
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* As-of timestamp */}
          {asOf && (
            <p className="mb-4 text-xs text-surface-500">
              Last updated {relTime(asOf)} · Auto-refreshes every 90s
            </p>
          )}

          {/* Event type filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <Filter className="h-3.5 w-3.5 shrink-0 text-surface-500" />
            {EVENT_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  filter === f.key
                    ? 'bg-surface-300 text-surface-900'
                    : 'text-surface-500 hover:bg-surface-200/60 hover:text-surface-700',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <TimelineSkeleton />
        ) : error ? (
          <EmptyState
            icon={Activity}
            title="Couldn't load timeline"
            description={error}
            action={
              <button
                onClick={() => fetchTimeline(true)}
                className="mt-4 rounded-lg bg-surface-200 px-4 py-2 text-sm text-surface-700 hover:bg-surface-300"
              >
                Try again
              </button>
            }
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No events in this window"
            description={`No market events in the last ${windowLabel}. Try expanding the time window or clearing the filter.`}
            action={
              <div className="mt-4 flex gap-2">
                {filter !== 'all' && (
                  <button
                    onClick={() => setFilter('all')}
                    className="rounded-lg bg-surface-200 px-4 py-2 text-sm text-surface-700 hover:bg-surface-300"
                  >
                    Clear filter
                  </button>
                )}
                <button
                  onClick={() => setWindowHours(168)}
                  className="rounded-lg bg-surface-200 px-4 py-2 text-sm text-surface-700 hover:bg-surface-300"
                >
                  Show 7 days
                </button>
              </div>
            }
          />
        ) : (
          <div>
            {/* Event count */}
            <p className="mb-4 text-xs text-surface-500">
              {events.length} event{events.length !== 1 ? 's' : ''} in the last {windowLabel}
            </p>

            {/* Timeline entries */}
            <div className="space-y-0">
              {events.map((event) => (
                <TimelineEventCard
                  key={event.id}
                  event={event}
                  isNew={newEventIds.has(event.id)}
                />
              ))}
            </div>

            {/* Tail cap */}
            <div className="mt-2 flex items-center gap-3 pl-[22px]">
              <div className="h-2 w-2 rounded-full bg-surface-400/40" />
              <p className="text-xs text-surface-500">
                Showing events from the last {windowLabel}
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-10 rounded-xl border border-surface-300/30 bg-surface-100/40 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-medium text-surface-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-surface-500" />
            Event Types
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.entries(EVENT_CONFIGS) as [TimelineEventType, EventConfig][]).map(([type, cfg]) => {
              const Icon = cfg.icon
              return (
                <button
                  key={type}
                  onClick={() => setFilter(filter === type ? 'all' : type)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                    filter === type ? 'bg-surface-200' : 'hover:bg-surface-200/60',
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', cfg.iconColor)} />
                  <span className="text-xs text-surface-600">{cfg.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
