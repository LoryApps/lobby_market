'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Flame,
  Gavel,
  MessageSquare,
  Radio,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ActivityEvent,
  ActivityResponse,
  ActivityStats,
} from '@/app/api/exchange/activity/route'

// ─── Filter tabs ───────────────────────────────────────────────────────────────

type FilterId = 'all' | 'trade' | 'argument' | 'crossing' | 'law'

const FILTERS: { id: FilterId; label: string; icon: typeof Activity }[] = [
  { id: 'all', label: 'All', icon: Activity },
  { id: 'trade', label: 'Trades', icon: Vote },
  { id: 'argument', label: 'Arguments', icon: MessageSquare },
  { id: 'crossing', label: 'Crossings', icon: TrendingUp },
  { id: 'law', label: 'Laws', icon: Gavel },
]

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-surface-500'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function sideBg(side: 'blue' | 'red'): string {
  return side === 'blue'
    ? 'bg-for-500/10 border-for-500/30 text-for-300'
    : 'bg-against-500/10 border-against-500/30 text-against-300'
}

function crossingColor(threshold?: number, direction?: 'up' | 'down'): string {
  if (threshold === 75 && direction === 'up') return 'text-gold border-gold/30 bg-gold/10'
  if (threshold === 75 && direction === 'down') return 'text-against-400 border-against-400/30 bg-against-400/10'
  if (threshold === 50 && direction === 'up') return 'text-for-400 border-for-400/30 bg-for-400/10'
  if (threshold === 50 && direction === 'down') return 'text-against-400 border-against-400/30 bg-against-400/10'
  return 'text-surface-400 border-surface-400/30 bg-surface-400/10'
}

// ─── Trade event card ─────────────────────────────────────────────────────────

function TradeCard({ event }: { event: ActivityEvent }) {
  const { user, side, statement, category, price, status, topic_id, ts } = event
  if (!user || !side) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300/60 bg-surface-100 p-4 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link href={`/profile/${user.username}`} className="flex-shrink-0">
          <Avatar
            src={user.avatar_url}
            username={user.username}
            size="sm"
            className="ring-1 ring-surface-300"
          />
        </Link>

        <div className="flex-1 min-w-0">
          {/* User + action */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <Link
              href={`/profile/${user.username}`}
              className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors"
            >
              {user.display_name ?? user.username}
            </Link>
            <span className="text-xs font-mono text-surface-500">voted</span>
            <span
              className={cn(
                'text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                sideBg(side),
              )}
            >
              {side === 'blue' ? 'For' : 'Against'}
            </span>
            <span className="text-xs font-mono text-surface-600 ml-auto flex-shrink-0">
              {timeAgo(ts)}
            </span>
          </div>

          {/* Topic */}
          <Link href={`/exchange/${topic_id}`} className="group">
            <p className="font-mono text-sm text-surface-300 group-hover:text-white transition-colors line-clamp-2 leading-relaxed">
              {statement}
            </p>
          </Link>

          {/* Footer */}
          <div className="flex items-center gap-3 mt-2.5">
            {category && (
              <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wide">
                {category}
              </span>
            )}
            <span className={cn('text-xs font-mono font-bold ml-auto', priceColor(price, status))}>
              {price}¢
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Argument event card ──────────────────────────────────────────────────────

function ArgumentCard({ event }: { event: ActivityEvent }) {
  const { user, side, content, upvotes, statement, category, price, status, topic_id, ts } = event
  if (!side) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-surface-300/60 bg-surface-100 p-4 hover:border-surface-400/60 transition-colors"
    >
      {/* Event label */}
      <div className="flex items-center gap-1.5 mb-3">
        <MessageSquare className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald">
          New Argument
        </span>
        <span
          className={cn(
            'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border ml-1',
            sideBg(side),
          )}
        >
          {side === 'blue' ? 'For' : 'Against'}
        </span>
        <span className="text-xs font-mono text-surface-600 ml-auto">{timeAgo(ts)}</span>
      </div>

      {/* Argument content */}
      {content && (
        <blockquote className="border-l-2 border-emerald/40 pl-3 mb-3">
          <p className="font-mono text-sm text-surface-300 leading-relaxed line-clamp-3">
            &ldquo;{content}&rdquo;
          </p>
        </blockquote>
      )}

      {/* Author + topic */}
      <div className="flex items-center gap-2">
        {user && (
          <Link href={`/profile/${user.username}`} className="flex items-center gap-1.5 group">
            <Avatar
              src={user.avatar_url}
              username={user.username}
              size="xs"
              className="ring-1 ring-surface-300"
            />
            <span className="font-mono text-xs text-surface-500 group-hover:text-surface-300 transition-colors">
              {user.display_name ?? user.username}
            </span>
          </Link>
        )}

        <span className="text-surface-600 text-xs font-mono mx-1">on</span>

        <Link href={`/exchange/${topic_id}`} className="group flex-1 min-w-0">
          <span className="font-mono text-xs text-surface-400 group-hover:text-white transition-colors line-clamp-1">
            {statement}
          </span>
        </Link>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2.5">
        {category && (
          <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wide">
            {category}
          </span>
        )}
        {(upvotes ?? 0) > 0 && (
          <span className="text-[10px] font-mono text-surface-600">
            {upvotes} upvotes
          </span>
        )}
        <span className={cn('text-xs font-mono font-bold ml-auto', priceColor(price, status))}>
          {price}¢
        </span>
      </div>
    </motion.div>
  )
}

// ─── Crossing event card ──────────────────────────────────────────────────────

function CrossingCard({ event }: { event: ActivityEvent }) {
  const {
    threshold, direction, crossing_label, price_before, price_after,
    statement, category, price, status, topic_id, ts,
  } = event

  const colorClasses = crossingColor(threshold, direction)
  const DirectionIcon = direction === 'up' ? TrendingUp : TrendingDown

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 hover:opacity-90 transition-opacity',
        threshold === 75 ? 'border-gold/20 bg-gold/5' : 'border-surface-300/60 bg-surface-100',
      )}
    >
      {/* Event label */}
      <div className="flex items-center gap-1.5 mb-3">
        <DirectionIcon className={cn('h-3.5 w-3.5 flex-shrink-0', threshold === 75 && direction === 'up' ? 'text-gold' : direction === 'up' ? 'text-for-400' : 'text-against-400')} />
        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest', threshold === 75 && direction === 'up' ? 'text-gold' : direction === 'up' ? 'text-for-400' : 'text-against-400')}>
          {crossing_label ?? 'Threshold Crossing'}
        </span>
        <span className="text-xs font-mono text-surface-600 ml-auto">{timeAgo(ts)}</span>
      </div>

      {/* Topic */}
      <Link href={`/exchange/${topic_id}`} className="group">
        <p className="font-mono text-sm text-surface-300 group-hover:text-white transition-colors line-clamp-2 leading-relaxed mb-3">
          {statement}
        </p>
      </Link>

      {/* Price movement */}
      {price_before !== undefined && price_after !== undefined && (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-surface-500">
            {price_before}¢
          </span>
          <ArrowUpRight className={cn('h-3 w-3', direction === 'up' ? 'text-for-400' : 'text-against-400 rotate-180')} />
          <span className={cn('font-mono text-xs font-bold', direction === 'up' ? 'text-for-400' : 'text-against-400')}>
            {price_after}¢
          </span>
          <span className="text-xs font-mono font-bold ml-1">
            crossed <span className={cn('px-1.5 py-0.5 rounded-full border text-[10px]', colorClasses)}>{threshold}¢</span>
          </span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 mt-2.5">
        {category && (
          <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wide">
            {category}
          </span>
        )}
        <span className={cn('text-xs font-mono font-bold ml-auto', priceColor(price, status))}>
          {price}¢
        </span>
      </div>
    </motion.div>
  )
}

// ─── Law event card ───────────────────────────────────────────────────────────

function LawCard({ event }: { event: ActivityEvent }) {
  const { statement, category, topic_id, ts } = event
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-gold/30 bg-gold/5 p-4"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Gavel className="h-3.5 w-3.5 text-gold" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-gold">
          Established as Law
        </span>
        <span className="text-xs font-mono text-surface-600 ml-auto">{timeAgo(ts)}</span>
      </div>
      <Link href={`/exchange/${topic_id}`} className="group">
        <p className="font-mono text-sm text-gold/80 group-hover:text-gold transition-colors line-clamp-2 leading-relaxed">
          {statement}
        </p>
      </Link>
      {category && (
        <div className="mt-2.5">
          <span className="text-[10px] font-mono text-gold/60 uppercase tracking-wide">
            {category}
          </span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Event card dispatcher ────────────────────────────────────────────────────

function EventCard({ event }: { event: ActivityEvent }) {
  switch (event.type) {
    case 'trade':    return <TradeCard event={event} />
    case 'argument': return <ArgumentCard event={event} />
    case 'crossing': return <CrossingCard event={event} />
    case 'law':      return <LawCard event={event} />
    default:         return null
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-12 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ActivityClient() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [stats, setStats] = useState<ActivityStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<FilterId>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [liveMode, setLiveMode] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [newCount, setNewCount] = useState(0)

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true)
    else setRefreshing(true)
    setError(false)
    try {
      const params = new URLSearchParams({ filter, limit: '50' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/exchange/activity?${params}`)
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as ActivityResponse
      if (isRefresh) {
        setNewCount((prev) => {
          const newEvts = data.events.filter(
            (e) => !events.some((old) => old.id === e.id),
          ).length
          return prev + newEvts
        })
        setEvents(data.events)
      } else {
        setEvents(data.events)
        setNewCount(0)
      }
      setStats(data.stats)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filter, category, events])

  // Initial load & re-load on filter/category change
  useEffect(() => {
    setEvents([])
    setNewCount(0)
    load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, category])

  // Live mode auto-refresh every 30 seconds
  useEffect(() => {
    if (liveMode) {
      intervalRef.current = setInterval(() => load(true), 30_000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [liveMode, load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exchange
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-600/20 border border-for-500/30 flex-shrink-0">
                <Activity className="h-5 w-5 text-for-400" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white">Live Activity</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  Real-time exchange pulse
                </p>
              </div>
            </div>

            {/* Live toggle + refresh */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setLiveMode((p) => !p)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-mono font-semibold transition-all',
                  liveMode
                    ? 'border-for-500/50 bg-for-500/15 text-for-300'
                    : 'border-surface-400 bg-surface-200 text-surface-500 hover:text-surface-300',
                )}
              >
                <Radio className={cn('h-3 w-3', liveMode && 'animate-pulse')} />
                {liveMode ? 'Live' : 'Live'}
              </button>
              <button
                onClick={() => load(true)}
                disabled={refreshing}
                className="p-2 rounded-lg border border-surface-400 bg-surface-200 text-surface-500 hover:text-surface-300 hover:border-surface-300 transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats bar ────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center">
              <div className="font-mono text-lg font-bold text-white">
                {stats.events_1h.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Events / hr</div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center">
              <div className="font-mono text-lg font-bold text-for-400">
                {stats.trades_1h.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Trades / hr</div>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center">
              <div className="font-mono text-lg font-bold text-emerald">
                {stats.arguments_1h.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">Arguments / hr</div>
            </div>
          </div>
        )}

        {/* ── Filter tabs ─────────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 scrollbar-none">
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono font-medium whitespace-nowrap transition-all',
                filter === id
                  ? 'border-for-500/50 bg-for-500/15 text-for-300'
                  : 'border-surface-400 bg-surface-200 text-surface-500 hover:text-surface-300 hover:border-surface-300',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Category filter ──────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-none">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'px-2.5 py-1 rounded-full border text-[11px] font-mono whitespace-nowrap transition-all',
              !category
                ? 'border-surface-400 bg-surface-300 text-white'
                : 'border-surface-500 bg-transparent text-surface-500 hover:text-surface-300',
            )}
          >
            All topics
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat === category ? null : cat)}
              className={cn(
                'px-2.5 py-1 rounded-full border text-[11px] font-mono whitespace-nowrap transition-all',
                category === cat
                  ? 'border-purple/50 bg-purple/20 text-purple'
                  : 'border-surface-500 bg-transparent text-surface-500 hover:text-surface-300',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── New events banner ────────────────────────────────────── */}
        <AnimatePresence>
          {newCount > 0 && (
            <motion.button
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={() => { setNewCount(0); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              className="w-full flex items-center justify-center gap-2 mb-4 py-2 rounded-xl border border-for-500/40 bg-for-500/10 text-for-300 text-xs font-mono font-semibold hover:bg-for-500/20 transition-colors"
            >
              <Zap className="h-3.5 w-3.5" />
              {newCount} new {newCount === 1 ? 'event' : 'events'} — click to refresh
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Events list ─────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <EventSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<Flame className="h-6 w-6 text-against-400" />}
            title="Couldn't load activity"
            description="Something went wrong. Try refreshing."
            action={
              <button
                onClick={() => load(false)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-6 w-6 text-surface-500" />}
            title="No activity yet"
            description="No exchange events in this time window. Try a different filter."
            action={
              <button
                onClick={() => { setFilter('all'); setCategory(null) }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Footer CTA ───────────────────────────────────────────── */}
        {!loading && !error && events.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="/exchange"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-surface-400 bg-surface-200 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-300 transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              All Markets
            </Link>
            <Link
              href="/exchange/trades"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-surface-400 bg-surface-200 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-300 transition-colors"
            >
              <Users className="h-3.5 w-3.5" />
              Trade History
            </Link>
            <Link
              href="/exchange/crossings"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-surface-400 bg-surface-200 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-300 transition-colors"
            >
              <Scale className="h-3.5 w-3.5" />
              Crossings
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
