'use client'

/**
 * /timeline — Global Civic Timeline
 *
 * A chronological feed of all significant platform events:
 * laws established, topics failing or activating, debates concluded.
 *
 * Distinct from:
 *  - /activity  (your own activity)
 *  - /network   (activity from people you follow)
 *  - /newspaper (curated editorial front page)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  Clock,
  Gavel,
  History,
  Loader2,
  Mic,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
  FileText,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TimelineEvent, TimelineEventType, TimelineResponse } from '@/app/api/timeline/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

function catColor(c: string | null | undefined) {
  return CATEGORY_COLOR[c ?? ''] ?? 'text-surface-500'
}

// ─── Event config ─────────────────────────────────────────────────────────────

interface EventConfig {
  icon: typeof Gavel
  iconColor: string
  iconBg: string
  connectorColor: string
  label: string
  badgeVariant: 'proposed' | 'active' | 'law' | 'failed'
}

const EVENT_CONFIG: Record<TimelineEventType, EventConfig> = {
  law_established: {
    icon: Gavel,
    iconColor: 'text-gold',
    iconBg: 'bg-gold/15 border-gold/30',
    connectorColor: 'bg-gold/40',
    label: 'Law Established',
    badgeVariant: 'law',
  },
  topic_failed: {
    icon: XCircle,
    iconColor: 'text-against-400',
    iconBg: 'bg-against-500/10 border-against-500/25',
    connectorColor: 'bg-against-500/30',
    label: 'Topic Failed',
    badgeVariant: 'failed',
  },
  topic_activated: {
    icon: Zap,
    iconColor: 'text-for-300',
    iconBg: 'bg-for-400/10 border-for-400/25',
    connectorColor: 'bg-for-400/35',
    label: 'Topic Activated',
    badgeVariant: 'active',
  },
  topic_voting: {
    icon: Scale,
    iconColor: 'text-purple',
    iconBg: 'bg-purple/10 border-purple/25',
    connectorColor: 'bg-purple/35',
    label: 'Voting Opened',
    badgeVariant: 'active',
  },
  topic_proposed: {
    icon: FileText,
    iconColor: 'text-surface-500',
    iconBg: 'bg-surface-300/10 border-surface-300/20',
    connectorColor: 'bg-surface-400/25',
    label: 'Topic Proposed',
    badgeVariant: 'proposed',
  },
  debate_ended: {
    icon: Mic,
    iconColor: 'text-emerald',
    iconBg: 'bg-emerald/10 border-emerald/25',
    connectorColor: 'bg-emerald/35',
    label: 'Debate Concluded',
    badgeVariant: 'active',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const w = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (w < 5) return `${w}w ago`
  if (mo < 12) return `${mo}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function absoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function dateGroupLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'

  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 6)
  if (d >= weekAgo) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  }

  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ─── Filter config ────────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { id: 'all',    label: 'All Events' },
  { id: 'laws',   label: 'Laws Only' },
  { id: 'topics', label: 'Topics' },
  { id: 'debates', label: 'Debates' },
] as const

type TypeFilter = (typeof TYPE_FILTERS)[number]['id']

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventSkeleton({ delay }: { delay: number }) {
  return (
    <div className="flex gap-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <Skeleton className="w-px h-16" />
      </div>
      <div className="flex-1 pb-6 space-y-2 pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function TimelineEventCard({
  event,
  isLast,
}: {
  event: TimelineEvent
  isLast: boolean
}) {
  const cfg = EVENT_CONFIG[event.type]
  const Icon = cfg.icon

  const href = event.debate_id
    ? `/debate/${event.debate_id}`
    : event.topic_id
      ? `/topic/${event.topic_id}`
      : '#'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
      className="flex gap-4"
    >
      {/* Icon + connector line */}
      <div className="flex flex-col items-center gap-0 flex-shrink-0">
        <div
          className={cn(
            'flex items-center justify-center h-9 w-9 rounded-xl border-2 flex-shrink-0',
            cfg.iconBg
          )}
        >
          <Icon className={cn('h-4 w-4', cfg.iconColor)} aria-hidden="true" />
        </div>
        {!isLast && (
          <div className={cn('w-px flex-1 min-h-[2.5rem] mt-1', cfg.connectorColor)} />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0', !isLast && 'pb-6')}>
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-surface-500">
            {cfg.label}
          </span>
          {event.topic_category && (
            <>
              <span className="text-surface-600">·</span>
              <span className={cn('text-[11px] font-mono uppercase tracking-wider', catColor(event.topic_category))}>
                {event.topic_category}
              </span>
            </>
          )}
          <span className="text-surface-600 ml-auto text-[11px] font-mono flex-shrink-0" title={absoluteDate(event.occurred_at)}>
            {relativeTime(event.occurred_at)}
          </span>
        </div>

        {/* Statement / title */}
        <Link
          href={href}
          className="group block"
        >
          <p className="text-sm font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-3">
            {event.topic_statement ?? event.debate_title ?? 'Untitled'}
          </p>
        </Link>

        {/* Stats row for topic events */}
        {event.type !== 'debate_ended' && event.topic_total_votes !== undefined && event.topic_total_votes > 0 && (
          <div className="mt-2 flex items-center gap-3 text-xs font-mono text-surface-500 flex-wrap">
            {/* Vote split */}
            {event.topic_blue_pct !== undefined && (
              <>
                <span className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden="true" />
                  <span className="text-for-400 font-semibold">
                    {Math.round(event.topic_blue_pct)}%
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden="true" />
                  <span className="text-against-400 font-semibold">
                    {100 - Math.round(event.topic_blue_pct)}%
                  </span>
                </span>
                <span>·</span>
              </>
            )}
            <span>
              {event.topic_total_votes.toLocaleString()} vote{event.topic_total_votes !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Debate type pill */}
        {event.type === 'debate_ended' && event.debate_type && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald bg-emerald/10 border border-emerald/25 rounded-full px-2 py-0.5">
              <Mic className="h-2.5 w-2.5" aria-hidden="true" />
              {event.debate_type.replace('_', ' ')}
            </span>
          </div>
        )}

        {/* View link */}
        <Link
          href={href}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          View {event.type === 'debate_ended' ? 'Debate' : 'Topic'}
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Date group header ────────────────────────────────────────────────────────

function DateGroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 mb-2">
      <div className="h-px flex-1 bg-surface-300/50" />
      <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-surface-500 flex-shrink-0 flex items-center gap-1.5">
        <Clock className="h-3 w-3" aria-hidden="true" />
        {label}
      </span>
      <div className="h-px flex-1 bg-surface-300/50" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchEvents = useCallback(
    async (opts: { replace?: boolean; nextCursor?: string | null } = {}) => {
      const { replace = false, nextCursor = null } = opts
      if (replace) setLoading(true)
      else setLoadingMore(true)

      try {
        const params = new URLSearchParams()
        params.set('type', typeFilter)
        if (categoryFilter !== 'All') params.set('category', categoryFilter)
        if (nextCursor) params.set('cursor', nextCursor)

        const res = await fetch(`/api/timeline?${params}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load timeline')
        const data: TimelineResponse = await res.json()

        setEvents((prev) => (replace ? data.events : [...prev, ...data.events]))
        setCursor(data.next_cursor)
        setHasMore(data.next_cursor !== null)
      } catch {
        // best-effort
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [typeFilter, categoryFilter]
  )

  // Reload when filters change
  useEffect(() => {
    fetchEvents({ replace: true })
  }, [fetchEvents])

  // Close category dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Group events by date label
  const grouped: Array<{ label: string; events: TimelineEvent[] }> = []
  for (const event of events) {
    const label = dateGroupLabel(event.occurred_at)
    const last = grouped[grouped.length - 1]
    if (last && last.label === label) {
      last.events.push(event)
    } else {
      grouped.push({ label, events: [event] })
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-300 flex-shrink-0">
            <History className="h-5 w-5 text-surface-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white">
              Civic Timeline
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Every law, debate, and milestone — in order
            </p>
          </div>
          <button
            onClick={() => fetchEvents({ replace: true })}
            disabled={loading}
            aria-label="Refresh timeline"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-200 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex items-center gap-2 flex-wrap">
          {/* Type filter */}
          <div
            className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-xl p-1"
            role="group"
            aria-label="Event type filter"
          >
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                aria-pressed={typeFilter === f.id}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                  typeFilter === f.id
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowCategoryDropdown((v) => !v)}
              aria-expanded={showCategoryDropdown}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-all',
                categoryFilter !== 'All'
                  ? 'bg-for-500/10 border-for-500/30 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-surface-700'
              )}
            >
              {categoryFilter === 'All' ? 'All Categories' : categoryFilter}
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </button>

            <AnimatePresence>
              {showCategoryDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 mt-1 z-20 w-44 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono transition-colors',
                        categoryFilter === cat
                          ? 'bg-surface-200 text-white'
                          : 'text-surface-500 hover:bg-surface-200 hover:text-white'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <EventSkeleton key={i} delay={i * 40} />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={History}
            iconColor="text-surface-500"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title="Nothing yet"
            description="Platform events will appear here as topics activate, reach law, and debates conclude."
            actions={[
              { label: 'Browse the Feed', href: '/', icon: FileText },
              { label: 'View Trending', href: '/trending', icon: Zap, variant: 'secondary' },
            ]}
            size="lg"
          />
        ) : (
          <div>
            {grouped.map((group, gi) => (
              <div key={group.label}>
                <DateGroupHeader label={group.label} />
                <div>
                  {group.events.map((event, ei) => {
                    const isLastInGroup = ei === group.events.length - 1
                    const isLastGroup = gi === grouped.length - 1
                    const isLast = isLastInGroup && isLastGroup && !hasMore
                    return (
                      <TimelineEventCard
                        key={event.id}
                        event={event}
                        isLast={isLast}
                      />
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => fetchEvents({ nextCursor: cursor })}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-surface-300 bg-surface-200 text-sm font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  {loadingMore ? 'Loading…' : 'Load More'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
