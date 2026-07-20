'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Clock,
  ExternalLink,
  Gavel,
  Mic,
  Radio,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
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
import type { MarketNewsEvent, MarketNewsResponse, MarketNewsEventType } from '@/app/api/exchange/[id]/news/route'

// ─── Icon registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Gavel, TrendingUp, TrendingDown, Vote, Mic, Scale,
  Shield, Users, ThumbsUp, ThumbsDown, Clock, XCircle,
  BarChart2, Activity, Radio,
}

function EventIcon({ icon, className }: { icon: string; className?: string }) {
  const Comp = ICON_MAP[icon] ?? Activity
  return <Comp className={className} />
}

// ─── Color → Tailwind ─────────────────────────────────────────────────────────

const COLOR_MAP: Record<string, {
  dot: string
  line: string
  icon: string
  border: string
  bg: string
  badge: string
}> = {
  gold: {
    dot: 'bg-gold border-gold/60 ring-gold/20',
    line: 'bg-gold/30',
    icon: 'text-gold',
    border: 'border-gold/25',
    bg: 'bg-gold/6',
    badge: 'bg-gold/15 text-gold',
  },
  for: {
    dot: 'bg-for-500 border-for-400/60 ring-for-400/20',
    line: 'bg-for-500/25',
    icon: 'text-for-400',
    border: 'border-for-500/25',
    bg: 'bg-for-500/6',
    badge: 'bg-for-500/15 text-for-300',
  },
  against: {
    dot: 'bg-against-500 border-against-400/60 ring-against-400/20',
    line: 'bg-against-500/25',
    icon: 'text-against-400',
    border: 'border-against-500/25',
    bg: 'bg-against-500/6',
    badge: 'bg-against-500/15 text-against-300',
  },
  purple: {
    dot: 'bg-purple border-purple/60 ring-purple/20',
    line: 'bg-purple/25',
    icon: 'text-purple',
    border: 'border-purple/25',
    bg: 'bg-purple/6',
    badge: 'bg-purple/15 text-purple',
  },
  emerald: {
    dot: 'bg-emerald border-emerald/60 ring-emerald/20',
    line: 'bg-emerald/25',
    icon: 'text-emerald',
    border: 'border-emerald/25',
    bg: 'bg-emerald/6',
    badge: 'bg-emerald/15 text-emerald',
  },
  surface: {
    dot: 'bg-surface-400 border-surface-500/60 ring-surface-400/20',
    line: 'bg-surface-400/25',
    icon: 'text-surface-400',
    border: 'border-surface-400/20',
    bg: 'bg-surface-200',
    badge: 'bg-surface-300 text-surface-400',
  },
}

function getColors(color: string) {
  return COLOR_MAP[color] ?? COLOR_MAP.surface
}

// ─── Tier → dot size ─────────────────────────────────────────────────────────

function dotSize(tier: MarketNewsEvent['tier']): string {
  if (tier === 'peak') return 'h-4 w-4 ring-4'
  if (tier === 'high') return 'h-3.5 w-3.5 ring-2'
  if (tier === 'medium') return 'h-3 w-3 ring-1'
  return 'h-2.5 w-2.5 ring-1'
}

// ─── Price badge ──────────────────────────────────────────────────────────────

function PriceChip({ price, status }: { price: number; status: string }) {
  const color =
    status === 'law' || price >= 67
      ? 'text-gold'
      : status === 'failed' || price <= 33
        ? 'text-against-400'
        : price >= 55
          ? 'text-for-400'
          : price <= 45
            ? 'text-against-300'
            : 'text-surface-400'

  return (
    <span className={cn('font-mono text-xs tabular-nums font-semibold', color)}>
      {price}¢
    </span>
  )
}

// ─── Time formatter ───────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function absTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── Type filter config ───────────────────────────────────────────────────────

const TYPE_FILTERS: Array<{ id: MarketNewsEventType | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'price_milestone', label: 'Price' },
  { id: 'status_change', label: 'Status' },
  { id: 'debate_scheduled', label: 'Debates' },
  { id: 'coalition_stance', label: 'Coalitions' },
  { id: 'argument_surge', label: 'Arguments' },
  { id: 'vote_milestone', label: 'Volume' },
]

// Combine debate types for filtering
function matchesFilter(event: MarketNewsEvent, filter: string): boolean {
  if (filter === 'all') return true
  if (filter === 'debate_scheduled') {
    return event.type === 'debate_scheduled' || event.type === 'debate_completed'
  }
  return event.type === filter
}

// ─── Single event card ────────────────────────────────────────────────────────

function EventCard({
  event,
  isLast,
  marketStatus,
}: {
  event: MarketNewsEvent
  isLast: boolean
  marketStatus: string
}) {
  const colors = getColors(event.color)
  const dot = dotSize(event.tier)

  return (
    <div className="relative flex gap-4">
      {/* Timeline stem */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={cn(
            'rounded-full border flex-shrink-0 ring',
            dot,
            colors.dot,
            event.tier === 'peak' && 'shadow-lg',
          )}
        />
        {!isLast && (
          <div className={cn('w-px flex-1 min-h-[2rem] mt-1', colors.line)} />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex-1 min-w-0 pb-6', isLast && 'pb-2')}>
        {/* Breaking badge + time */}
        <div className="flex items-center gap-2 mb-1.5">
          {event.is_breaking && (
            <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider text-against-400 uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse inline-block" />
              Breaking
            </span>
          )}
          <time
            dateTime={event.occurred_at}
            className="text-[11px] text-surface-500"
            title={absTime(event.occurred_at)}
          >
            {relTime(event.occurred_at)}
          </time>
          {event.price !== null && (
            <>
              <span className="text-surface-600 text-[10px]">·</span>
              <PriceChip price={event.price} status={marketStatus} />
            </>
          )}
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'rounded-xl border p-3.5 space-y-2',
            event.tier === 'peak' && 'shadow-md',
            colors.bg,
            colors.border,
          )}
        >
          {/* Header row */}
          <div className="flex items-start gap-2.5">
            <div className={cn('mt-0.5 flex-shrink-0', colors.icon)}>
              <EventIcon icon={event.icon} className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-snug">
                {event.headline}
              </p>
            </div>
            {event.tag && (
              <span className={cn(
                'flex-shrink-0 text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded',
                colors.badge,
              )}>
                {event.tag}
              </span>
            )}
          </div>

          {/* Body */}
          <p className="text-xs text-surface-500 leading-relaxed pl-6">
            {event.body}
          </p>

          {/* Link */}
          {event.href && (
            <div className="pl-6">
              <Link
                href={event.href}
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium transition-colors',
                  colors.icon,
                  'opacity-80 hover:opacity-100',
                )}
              >
                View details
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

// ─── Skeleton state ───────────────────────────────────────────────────────────

function NewsSkeletons() {
  return (
    <div className="space-y-0">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center flex-shrink-0">
            <Skeleton className="h-3 w-3 rounded-full" />
            {i < 5 && <Skeleton className="w-px h-16 mt-1" />}
          </div>
          <div className="flex-1 pb-6 space-y-2">
            <Skeleton className="h-3 w-24" />
            <div className="rounded-xl border border-surface-300 bg-surface-200 p-3.5 space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-3.5 w-3.5 rounded flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-14 rounded flex-shrink-0" />
              </div>
              <Skeleton className="h-3 w-4/5 ml-6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function MarketNewsClient({ id }: { id: string }) {
  const [data, setData] = useState<MarketNewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/exchange/${id}/news`)
      if (!res.ok) throw new Error('Failed')
      const json: MarketNewsResponse = await res.json()
      setData(json)
    } catch {
      // keep existing data on soft refresh failure
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const filteredEvents = data?.events.filter(e => matchesFilter(e, activeFilter)) ?? []
  const breakingCount = data?.events.filter(e => e.is_breaking).length ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-28 space-y-5">
        {/* Back */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Market
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh news"
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Header card */}
        {data && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-0.5">
                  Market News
                </p>
                <h1 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                  {data.statement}
                </h1>
              </div>
              <Link
                href={`/exchange/${id}`}
                className="flex-shrink-0 mt-0.5"
              >
                <PriceChip price={data.current_price} status={data.status} />
              </Link>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {data.category && (
                <Badge variant="surface" size="sm">{data.category}</Badge>
              )}
              {data.status === 'law' && (
                <Badge variant="gold" size="sm" className="flex items-center gap-1">
                  <Gavel className="h-3 w-3" />
                  Law
                </Badge>
              )}
              {breakingCount > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-against-400 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse inline-block" />
                  {breakingCount} breaking
                </span>
              )}
              <span className="text-[11px] text-surface-500 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {data.total} events
              </span>
            </div>
          </div>
        )}

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                activeFilter === f.id
                  ? 'bg-for-500/20 text-for-300 border-for-500/40'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {loading ? (
          <NewsSkeletons />
        ) : !data || filteredEvents.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={activeFilter === 'all' ? 'No events yet' : 'No events in this category'}
            description={
              activeFilter === 'all'
                ? 'Events will appear here as this market develops — price moves, debates, coalition stances, and more.'
                : 'Try selecting a different filter.'
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeFilter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {filteredEvents.map((event, i) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isLast={i === filteredEvents.length - 1}
                  marketStatus={data.status}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer: link back to all exchange news */}
        {data && filteredEvents.length > 0 && (
          <div className="flex justify-center pt-4">
            <Link
              href="/exchange/news"
              className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
            >
              <Radio className="h-3 w-3" />
              View all exchange news
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
