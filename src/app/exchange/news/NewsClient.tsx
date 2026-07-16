'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Bell,
  ChevronRight,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
  X,
  Zap,
  AlertTriangle,
  Radio,
  Clock,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NewsEvent, NewsResponse } from '@/app/api/exchange/news/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const WINDOWS = [
  { id: 3,   label: '3h' },
  { id: 12,  label: '12h' },
  { id: 24,  label: '24h' },
  { id: 72,  label: '3d' },
  { id: 168, label: '7d' },
]

const REFRESH_MS = 60_000

const EVENT_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  badgeBg: string
  badgeText: string
  borderColor: string
  dotColor: string
}> = {
  became_law: {
    icon: Gavel,
    iconColor: 'text-gold',
    badgeBg: 'bg-gold/15',
    badgeText: 'text-gold',
    borderColor: 'border-gold/30',
    dotColor: 'bg-gold',
  },
  entered_voting: {
    icon: Scale,
    iconColor: 'text-purple',
    badgeBg: 'bg-purple/15',
    badgeText: 'text-purple',
    borderColor: 'border-purple/30',
    dotColor: 'bg-purple',
  },
  activated: {
    icon: Zap,
    iconColor: 'text-for-400',
    badgeBg: 'bg-for-500/15',
    badgeText: 'text-for-300',
    borderColor: 'border-for-500/30',
    dotColor: 'bg-for-500',
  },
  failed: {
    icon: X,
    iconColor: 'text-against-400',
    badgeBg: 'bg-against-500/15',
    badgeText: 'text-against-300',
    borderColor: 'border-against-500/30',
    dotColor: 'bg-against-500',
  },
  price_milestone: {
    icon: Activity,
    iconColor: 'text-emerald',
    badgeBg: 'bg-emerald/15',
    badgeText: 'text-emerald',
    borderColor: 'border-emerald/30',
    dotColor: 'bg-emerald',
  },
  volume_surge: {
    icon: TrendingUp,
    iconColor: 'text-for-400',
    badgeBg: 'bg-for-500/15',
    badgeText: 'text-for-300',
    borderColor: 'border-for-500/30',
    dotColor: 'bg-for-500',
  },
  closing_soon: {
    icon: Clock,
    iconColor: 'text-against-300',
    badgeBg: 'bg-against-500/10',
    badgeText: 'text-against-300',
    borderColor: 'border-against-500/25',
    dotColor: 'bg-against-400',
  },
  new_consensus_high: {
    icon: TrendingUp,
    iconColor: 'text-emerald',
    badgeBg: 'bg-emerald/15',
    badgeText: 'text-emerald',
    borderColor: 'border-emerald/30',
    dotColor: 'bg-emerald',
  },
  deadlocked: {
    icon: AlertTriangle,
    iconColor: 'text-gold',
    badgeBg: 'bg-gold/10',
    badgeText: 'text-gold',
    borderColor: 'border-gold/25',
    dotColor: 'bg-gold',
  },
}

const CAT_DOT: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-400',
  Philosophy:  'bg-for-300',
  Culture:     'bg-gold',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-for-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function priceColor(price: number): string {
  if (price >= 70) return 'text-for-400'
  if (price >= 55) return 'text-for-300'
  if (price >= 45) return 'text-surface-400'
  if (price >= 30) return 'text-against-300'
  return 'text-against-400'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function NewsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="ml-auto h-4 w-14" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex items-center gap-3 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── News Event Card ──────────────────────────────────────────────────────────

function EventCard({ event, idx }: { event: NewsEvent; idx: number }) {
  const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.activated
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03, duration: 0.25 }}
    >
      <Link href={`/exchange/${event.topic_id}`}>
        <div
          className={cn(
            'group relative rounded-2xl bg-surface-100 border transition-all duration-200 p-4',
            'hover:bg-surface-200 hover:border-surface-400',
            cfg.borderColor,
            event.is_breaking && 'ring-1 ring-inset ring-against-500/20'
          )}
        >
          {/* Breaking badge */}
          {event.is_breaking && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-against-500/20 text-against-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-against-400 animate-pulse" />
                LIVE
              </span>
            </div>
          )}

          {/* Header row */}
          <div className="flex items-center gap-2 pr-12">
            <div className={cn('flex-shrink-0 p-1 rounded-md', cfg.badgeBg)}>
              <Icon className={cn('h-3.5 w-3.5', cfg.iconColor)} />
            </div>
            <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', cfg.badgeText)}>
              {event.headline}
            </span>
          </div>

          {/* Detail */}
          <p className="mt-2.5 text-sm text-surface-400 leading-relaxed font-mono">
            {event.detail}
          </p>

          {/* Footer */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {/* Category */}
            {event.category && (
              <div className="flex items-center gap-1.5">
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full', CAT_DOT[event.category] ?? 'bg-surface-500')} />
                <span className="text-[11px] font-mono text-surface-500">{event.category}</span>
              </div>
            )}

            {/* Price */}
            <span className={cn('text-[11px] font-mono font-semibold', priceColor(event.price))}>
              {event.price}¢
            </span>

            {/* Volume */}
            <span className="text-[11px] font-mono text-surface-600">
              {event.volume.toLocaleString()} votes
            </span>

            {/* Timestamp */}
            <span className="ml-auto text-[11px] font-mono text-surface-600">
              {relTime(event.occurred_at)}
            </span>
          </div>

          {/* Hover arrow */}
          <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="h-4 w-4 text-surface-500" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function NewsClient() {
  const [data, setData] = useState<NewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState('All')
  const [window, setWindow] = useState(24)
  const [catOpen, setCatOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams({
          window: window.toString(),
          ...(category !== 'All' && { category }),
        })
        const res = await fetch(`/api/exchange/news?${params}`, { cache: 'no-store' })
        if (res.ok) {
          setData(await res.json())
          setLastUpdated(new Date())
        }
      } catch {
        // best-effort
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [category, window]
  )

  useEffect(() => { load() }, [load])

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const events = data?.events ?? []

  // Count breaking events
  const breakingCount = events.filter((e) => e.is_breaking).length

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 px-4 pt-4 pb-24 max-w-2xl mx-auto w-full space-y-5">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/exchange"
            className="flex-shrink-0 p-2 rounded-xl text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-against-400" />
              <h1 className="font-mono text-lg font-bold text-white">Market News</h1>
              {breakingCount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-against-500/25 text-against-300 text-[10px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-against-400 animate-pulse inline-block" />
                  {breakingCount} LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Price crossings · Status changes · Closing alerts
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh news"
            className="flex-shrink-0 p-2 rounded-xl text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          {/* Time window */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider w-14 flex-shrink-0">
              Window
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {WINDOWS.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWindow(w.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all',
                    window === w.id
                      ? 'bg-for-600/20 border-for-600/50 text-for-300'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider w-14 flex-shrink-0">
              Category
            </span>
            <div className="flex-1 relative">
              <button
                onClick={() => setCatOpen(!catOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:border-surface-400 transition-colors"
              >
                {category !== 'All' && (
                  <span className={cn('w-1.5 h-1.5 rounded-full', CAT_DOT[category] ?? 'bg-surface-500')} />
                )}
                {category}
                <ChevronRight className={cn('h-3 w-3 text-surface-500 transition-transform', catOpen && 'rotate-90')} />
              </button>
              <AnimatePresence>
                {catOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute top-full left-0 mt-1 z-20 bg-surface-200 border border-surface-300 rounded-xl shadow-xl overflow-hidden"
                  >
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setCategory(cat); setCatOpen(false) }}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-2 text-xs font-mono text-left hover:bg-surface-300 transition-colors',
                          category === cat ? 'text-white' : 'text-surface-400'
                        )}
                      >
                        {cat !== 'All' && (
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', CAT_DOT[cat] ?? 'bg-surface-500')} />
                        )}
                        {cat}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {(category !== 'All') && (
              <button
                onClick={() => setCategory('All')}
                className="p-1.5 text-surface-500 hover:text-white transition-colors"
                aria-label="Clear category filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Status bar ────────────────────────────────────────────────── */}
        {data && (
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-600 border-b border-surface-300 pb-3">
            <span>{events.length} event{events.length !== 1 ? 's' : ''}</span>
            {lastUpdated && (
              <span>Updated {relTime(lastUpdated.toISOString())}</span>
            )}
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        {loading ? (
          <NewsSkeleton />
        ) : events.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No market events"
            description={
              category !== 'All'
                ? `No events in ${category} for the selected time window. Try widening the window or changing category.`
                : 'No market events in the selected time window. Try a wider window.'
            }
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {events.map((event, idx) => (
                <EventCard key={event.id} event={event} idx={idx} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Refresh footer ────────────────────────────────────────────── */}
        {!loading && events.length > 0 && (
          <div className="text-center py-4">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh feed
            </button>
            <p className="text-[11px] text-surface-600 font-mono mt-2">
              Auto-refreshes every minute
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
