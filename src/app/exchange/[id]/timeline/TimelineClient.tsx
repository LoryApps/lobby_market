'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileEdit,
  Gavel,
  Loader2,
  Mic,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Vote,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketTimeline, TimelineEvent, TimelineEventType } from '@/app/api/exchange/[id]/timeline/route'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Vote, Mic, Gavel, Scale, BookOpen, FileEdit, TrendingUp, TrendingDown,
  ThumbsUp, ThumbsDown, CheckCircle2, XCircle, ChevronUp, ChevronDown, BarChart2,
}

function EventIcon({ icon, className }: { icon: string; className?: string }) {
  const Comp = ICON_MAP[icon] ?? Zap
  return <Comp className={className} />
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  })
}

function priceColor(price: number | null, status: string): string {
  if (price === null) return 'text-surface-500'
  if (status === 'law') return 'text-gold'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function tierColors(tier: TimelineEvent['tier'], type: TimelineEventType): {
  dot: string
  line: string
  icon: string
  border: string
  bg: string
  text: string
} {
  if (type === 'law_established') return {
    dot: 'bg-gold border-gold/60 ring-gold/30',
    line: 'bg-gold/40',
    icon: 'text-gold',
    border: 'border-gold/30',
    bg: 'bg-gold/8',
    text: 'text-gold',
  }
  if (type === 'created') return {
    dot: 'bg-for-500 border-for-400/60 ring-for-400/30',
    line: 'bg-for-500/30',
    icon: 'text-for-400',
    border: 'border-for-500/30',
    bg: 'bg-for-500/8',
    text: 'text-for-300',
  }
  if (tier === 'peak') return {
    dot: 'bg-for-500 border-for-400/60 ring-for-400/30',
    line: 'bg-for-500/30',
    icon: 'text-for-400',
    border: 'border-for-500/30',
    bg: 'bg-for-500/8',
    text: 'text-for-300',
  }
  if (tier === 'high') return {
    dot: 'bg-for-600 border-for-500/60 ring-for-500/20',
    line: 'bg-for-600/20',
    icon: 'text-for-400',
    border: 'border-for-600/20',
    bg: 'bg-for-600/6',
    text: 'text-for-400',
  }
  if (tier === 'medium') return {
    dot: 'bg-surface-400 border-surface-300/60 ring-surface-300/20',
    line: 'bg-surface-500/30',
    icon: 'text-surface-400',
    border: 'border-surface-400/20',
    bg: 'bg-surface-200/60',
    text: 'text-surface-300',
  }
  return {
    dot: 'bg-surface-600 border-surface-500/40 ring-surface-500/10',
    line: 'bg-surface-600/20',
    icon: 'text-surface-500',
    border: 'border-surface-500/15',
    bg: 'bg-surface-200/40',
    text: 'text-surface-400',
  }
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterId = 'all' | 'price' | 'debate' | 'argument' | 'milestone'

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'price',     label: 'Price' },
  { id: 'debate',    label: 'Debates' },
  { id: 'argument',  label: 'Arguments' },
  { id: 'milestone', label: 'Milestones' },
]

function matchesFilter(event: TimelineEvent, filter: FilterId): boolean {
  if (filter === 'all') return true
  if (filter === 'price') return event.type === 'price_threshold' || event.type === 'price_swing'
  if (filter === 'debate') return event.type === 'debate_scheduled' || event.type === 'debate_ended'
  if (filter === 'argument') return event.type === 'top_argument'
  if (filter === 'milestone') return (
    event.type === 'vote_milestone' ||
    event.type === 'created' ||
    event.type === 'law_established' ||
    event.type === 'status_change' ||
    event.type === 'wiki_edit'
  )
  return true
}

// ─── Timeline event card ──────────────────────────────────────────────────────

function EventCard({
  event,
  status,
  isLast,
  index,
}: {
  event: TimelineEvent
  status: string
  isLast: boolean
  index: number
}) {
  const colors = tierColors(event.tier, event.type)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      className="relative flex gap-3"
    >
      {/* Vertical line */}
      {!isLast && (
        <div className={cn('absolute left-4 top-8 bottom-0 w-px', colors.line)} />
      )}

      {/* Dot */}
      <div className="flex-shrink-0 relative z-10 mt-1">
        <div className={cn(
          'w-8 h-8 rounded-full border-2 ring-2 ring-offset-1 ring-offset-surface-100',
          'flex items-center justify-center',
          colors.dot,
        )}>
          <EventIcon icon={event.icon} className={cn('w-3.5 h-3.5', colors.icon)} />
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        'flex-1 min-w-0 mb-5 rounded-xl border p-3',
        colors.border,
        colors.bg,
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-semibold leading-snug', colors.text)}>
              {event.href ? (
                <Link href={event.href} className="hover:underline underline-offset-2">
                  {event.title}
                </Link>
              ) : (
                event.title
              )}
            </p>
            {event.description && (
              <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{event.description}</p>
            )}
          </div>

          {/* Price badge */}
          {event.price !== null && (
            <span className={cn(
              'flex-shrink-0 text-xs font-mono font-bold',
              priceColor(event.price, status),
            )}>
              {Math.round(event.price)}¢
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Clock className="h-3 w-3 text-surface-600 flex-shrink-0" />
          <span className="text-[11px] font-mono text-surface-500">
            {formatDate(event.timestamp)} · {formatTime(event.timestamp)}
          </span>

          {event.tag && (
            <>
              <span className="text-surface-600">·</span>
              <span className={cn(
                'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
                event.tag === 'FOR' || event.tag === 'FOR momentum'
                  ? 'bg-for-700/30 text-for-300'
                  : event.tag === 'AGAINST' || event.tag === 'AGAINST momentum'
                  ? 'bg-against-700/30 text-against-300'
                  : event.tag === 'LAW'
                  ? 'bg-gold/15 text-gold'
                  : event.tag === 'Wiki'
                  ? 'bg-purple/15 text-purple'
                  : 'bg-surface-300/40 text-surface-400',
              )}>
                {event.tag}
              </span>
            </>
          )}

          {event.volume !== null && (
            <>
              <span className="text-surface-600">·</span>
              <span className="text-[11px] font-mono text-surface-500">
                {event.volume.toLocaleString()} votes
              </span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface-200/60 border border-surface-300/60 rounded-xl p-3">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      <span className="text-base font-bold text-white font-mono">{value}</span>
      {sub && <span className="text-[10px] text-surface-500">{sub}</span>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
}

export function TimelineClient({ topicId }: Props) {
  const [data, setData] = useState<MarketTimeline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [showAll, setShowAll] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/exchange/${topicId}/timeline`, { signal: ctrl.signal })
      if (!res.ok) throw new Error('Failed to load timeline')
      const json: MarketTimeline = await res.json()
      setData(json)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return
      setError('Failed to load market timeline.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  // ── Filtered events ────────────────────────────────────────────────────────
  const allEvents = data?.events ?? []
  const filtered = allEvents.filter((e) => matchesFilter(e, filter))
  const INITIAL_COUNT = 15
  const displayed = showAll ? filtered : filtered.slice(0, INITIAL_COUNT)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-100">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* Back link */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to market
          </Link>
        </div>

        {/* Header */}
        {data && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-surface-500" />
              <h1 className="text-sm font-mono text-surface-400 uppercase tracking-wider">Market Timeline</h1>
            </div>
            <p className="text-lg font-semibold text-white leading-snug line-clamp-2">
              {data.statement}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {data.category && (
                <Badge variant="outline" size="xs">{data.category}</Badge>
              )}
              <Badge
                variant={data.status === 'law' ? 'gold' : data.status === 'failed' ? 'red' : 'default'}
                size="xs"
              >
                {data.status.toUpperCase()}
              </Badge>
              <span className="text-xs font-mono text-surface-500">
                {data.days_active} days active
              </span>
            </div>
          </div>
        )}

        {/* Stat grid */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatTile
              label="Current"
              value={`${Math.round(data.current_price)}¢`}
              sub="consensus price"
            />
            <StatTile
              label="Range"
              value={data.price_range !== null ? `${Math.round(data.price_range)}¢` : '—'}
              sub={data.peak_price !== null ? `${Math.round(data.trough_price ?? 0)}¢–${Math.round(data.peak_price)}¢` : ''}
            />
            <StatTile
              label="Events"
              value={String(allEvents.length)}
              sub={`${data.total_debates} debate${data.total_debates !== 1 ? 's' : ''}`}
            />
          </div>
        )}

        {/* Refresh + filter bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-0.5 flex-1 overflow-x-auto bg-surface-200/80 border border-surface-300/60 rounded-xl p-0.5 [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setShowAll(false) }}
                aria-pressed={filter === f.id}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-150',
                  filter === f.id
                    ? 'bg-for-600 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh timeline"
            className="flex-shrink-0 p-2 rounded-lg bg-surface-200/80 border border-surface-300/60 text-surface-500 hover:text-white transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
        </div>

        {/* Timeline */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                <Skeleton className="h-16 flex-1 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <EmptyState
            icon={<XCircle className="h-8 w-8" />}
            title="Failed to load timeline"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && filtered.length === 0 && (
          <EmptyState
            icon={<Clock className="h-8 w-8" />}
            title="No events yet"
            description={
              filter === 'all'
                ? 'This market has no recorded events yet. Check back after more votes are cast.'
                : `No ${filter} events recorded for this market.`
            }
          />
        )}

        {!loading && !error && filtered.length > 0 && (
          <AnimatePresence>
            <div className="relative">
              {displayed.map((event, idx) => (
                <EventCard
                  key={event.id}
                  event={event}
                  status={data?.status ?? 'active'}
                  isLast={idx === displayed.length - 1}
                  index={idx}
                />
              ))}
            </div>

            {/* Show more / less */}
            {filtered.length > INITIAL_COUNT && (
              <div className="mt-2 flex justify-center">
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono text-surface-400 hover:text-white bg-surface-200/60 border border-surface-300/40 hover:border-surface-400 transition-all duration-150"
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Show {filtered.length - INITIAL_COUNT} more events
                    </>
                  )}
                </button>
              </div>
            )}
          </AnimatePresence>
        )}

        {/* Footer link to full market */}
        {data && (
          <div className="mt-8 pt-4 border-t border-surface-300/40">
            <Link
              href={`/exchange/${topicId}`}
              className="flex items-center justify-between gap-2 text-sm text-surface-400 hover:text-white transition-colors group"
            >
              <span className="font-mono">View full market →</span>
              <span className="text-xs text-surface-500 group-hover:text-surface-300">
                {Math.round(data.current_price)}¢ · {data.total_votes.toLocaleString()} votes
              </span>
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
