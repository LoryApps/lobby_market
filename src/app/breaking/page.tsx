'use client'

/**
 * /breaking — Civic Breaking News
 *
 * A live-updating feed of the most newsworthy civic events happening
 * RIGHT NOW on Lobby Market. Surfaces:
 *
 *   BREAKING   — vote surges (≥3× spike), majority flips, law established
 *   DEVELOPING — law imminent (≥62% FOR), topic failed
 *   ALERT      — debate surges (≥5 new arguments/hour)
 *   WATCH      — perfect deadlocks (49–51%) under pressure
 *
 * Distinct from:
 *   /now       — static snapshot of current platform state
 *   /momentum  — multi-day trend lines
 *   /flashpoint — single hottest topic
 *   /shifts    — week-scale percentage changes
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Flame,
  Gavel,
  MessageSquare,
  Radio,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
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
import type { BreakingEvent, BreakingLevel, BreakingEventKind, BreakingResponse } from '@/app/api/breaking/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 90_000 // 90 seconds

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Ethics:      'text-emerald',
  Culture:     'text-against-400',
  Science:     'text-for-300',
  Philosophy:  'text-purple',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Level config ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<BreakingLevel, {
  label: string
  bg: string
  border: string
  text: string
  dot: string
  pulse: boolean
}> = {
  breaking: {
    label: 'BREAKING',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    text: 'text-against-400',
    dot: 'bg-against-400',
    pulse: true,
  },
  developing: {
    label: 'DEVELOPING',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    text: 'text-gold',
    dot: 'bg-gold',
    pulse: true,
  },
  alert: {
    label: 'ALERT',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    text: 'text-purple',
    dot: 'bg-purple',
    pulse: false,
  },
  watch: {
    label: 'WATCH',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    text: 'text-for-400',
    dot: 'bg-for-400',
    pulse: false,
  },
}

// ─── Kind icon ────────────────────────────────────────────────────────────────

function KindIcon({ kind, className }: { kind: BreakingEventKind; className?: string }) {
  const props = { className: cn('h-4 w-4', className) }
  switch (kind) {
    case 'vote_surge':    return <Flame {...props} />
    case 'law_imminent':  return <TrendingUp {...props} />
    case 'law_established': return <Gavel {...props} />
    case 'topic_failed':  return <XCircle {...props} />
    case 'flip':          return <Scale {...props} />
    case 'debate_surge':  return <MessageSquare {...props} />
    case 'deadlock':      return <Scale {...props} />
  }
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

// ─── Live ticker ──────────────────────────────────────────────────────────────

function LiveTicker({ events }: { events: BreakingEvent[] }) {
  const breaking = events.filter(e => e.level === 'breaking')
  if (breaking.length === 0) return null
  const items = breaking.map(e => `${e.topic_statement.slice(0, 80)}${e.topic_statement.length > 80 ? '…' : ''}`)

  return (
    <div className="bg-against-600/20 border-y border-against-500/30 overflow-hidden h-8 flex items-center">
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 bg-against-600/40 h-full border-r border-against-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-against-400 animate-pulse" />
        <span className="text-[11px] font-mono font-bold text-against-300 tracking-wider">LIVE</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <motion.div
          className="flex gap-8 pl-4 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: items.length * 8, ease: 'linear', repeat: Infinity }}
        >
          {[...items, ...items].map((item, i) => (
            <span key={i} className="text-[12px] text-against-300 font-medium">
              <span className="text-against-400 font-bold mr-2">●</span>
              {item}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ event, index }: { event: BreakingEvent; index: number }) {
  const cfg = LEVEL_CONFIG[event.level]
  const forPct = Math.round(event.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[event.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        href={`/topic/${event.topic_id}`}
        className={cn(
          'block rounded-xl border p-4 transition-all',
          'hover:brightness-110 active:scale-[0.99]',
          cfg.bg, cfg.border
        )}
      >
        {/* ── Header row ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Level badge */}
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest',
              cfg.bg, cfg.text, 'border', cfg.border
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot, cfg.pulse && 'animate-pulse')} />
              {cfg.label}
            </span>
            {/* Category */}
            {event.category && (
              <span className={cn('text-[11px] font-mono', catColor)}>{event.category}</span>
            )}
            {/* Status */}
            <Badge
              variant={
                event.status === 'law' ? 'law'
                : event.status === 'failed' ? 'failed'
                : event.status === 'voting' ? 'voting'
                : 'active'
              }
              size="sm"
            />
          </div>
          <div className="flex items-center gap-1 text-[11px] text-surface-500 flex-shrink-0">
            <KindIcon kind={event.kind} className="h-3 w-3" />
            <span className="font-mono">{relativeTime(event.occurred_at)}</span>
          </div>
        </div>

        {/* ── Topic statement ──────────────────────────────────────────── */}
        <p className="text-sm font-semibold text-white leading-snug mb-1 line-clamp-2">
          {event.topic_statement}
        </p>

        {/* ── Headline ─────────────────────────────────────────────────── */}
        <p className={cn('text-[13px] font-medium mb-2', cfg.text)}>
          {event.headline}
        </p>

        {/* ── Subline ──────────────────────────────────────────────────── */}
        <p className="text-[12px] text-surface-500 mb-3 line-clamp-2">
          {event.subline}
        </p>

        {/* ── Vote bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          {/* FOR */}
          <div className="flex items-center gap-1 text-for-400">
            <ThumbsUp className="h-3 w-3" />
            <span className="text-[11px] font-mono font-bold tabular-nums">{forPct}%</span>
          </div>

          {/* Bar */}
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
          </div>

          {/* AGAINST */}
          <div className="flex items-center gap-1 text-against-400">
            <span className="text-[11px] font-mono font-bold tabular-nums">{againstPct}%</span>
            <ThumbsDown className="h-3 w-3" />
          </div>

          {/* Total votes */}
          <span className="text-[11px] text-surface-500 font-mono ml-1">
            {event.total_votes.toLocaleString()} votes
          </span>
        </div>

        {/* ── Surge indicator ──────────────────────────────────────────── */}
        {event.kind === 'vote_surge' && event.surge_ratio >= 2 && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-against-400">
            <Zap className="h-3 w-3" />
            <span className="font-mono">
              {event.votes_2h.toLocaleString()} votes last 2h
              {event.votes_prev_2h > 0 && ` (vs ${event.votes_prev_2h.toLocaleString()} prior)`}
            </span>
          </div>
        )}

        {/* ── CTA arrow ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end mt-2">
          <span className={cn('text-[11px] font-medium flex items-center gap-1', cfg.text)}>
            View topic <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function EventSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-2 w-full" />
    </div>
  )
}

// ─── Level filter pills ───────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ value: BreakingLevel | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'breaking', label: 'Breaking' },
  { value: 'developing', label: 'Developing' },
  { value: 'alert', label: 'Alert' },
  { value: 'watch', label: 'Watch' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BreakingPage() {
  const [events, setEvents] = useState<BreakingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [platformVotes2h, setPlatformVotes2h] = useState(0)
  const [filter, setFilter] = useState<BreakingLevel | 'all'>('all')
  const [_lastRefresh, setLastRefresh] = useState(Date.now())
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/breaking', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const data: BreakingResponse = await res.json()
      setEvents(data.events)
      setGeneratedAt(data.generated_at)
      setPlatformVotes2h(data.platform_votes_2h)
      setLastRefresh(Date.now())
    } catch {
      // keep current data on refresh failure
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => { load() }, [load])

  // Auto-refresh
  useEffect(() => {
    timerRef.current = setInterval(() => load(true), REFRESH_INTERVAL_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const filtered = filter === 'all' ? events : events.filter(e => e.level === filter)

  // Level counts
  const counts = events.reduce<Record<BreakingLevel | 'all', number>>(
    (acc, e) => { acc.all++; acc[e.level]++; return acc },
    { all: 0, breaking: 0, developing: 0, alert: 0, watch: 0 }
  )

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      {/* ── Breaking ticker ──────────────────────────────────────────────── */}
      {!loading && <LiveTicker events={events} />}

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
                <Radio className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Breaking News</h1>
                <p className="text-sm text-surface-500 mt-0.5">
                  Live civic events — updated every 90 seconds
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              <span className="text-xs font-mono">Refresh</span>
            </button>
          </div>

          {/* Stats strip */}
          {!loading && (
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm">
                <Activity className="h-3.5 w-3.5 text-against-400" />
                <span className="font-mono font-semibold text-white tabular-nums">
                  {platformVotes2h.toLocaleString()}
                </span>
                <span className="text-surface-500">votes in 2h</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Zap className="h-3.5 w-3.5 text-gold" />
                <span className="font-mono font-semibold text-white tabular-nums">
                  {events.length}
                </span>
                <span className="text-surface-500">
                  {events.length === 1 ? 'alert' : 'alerts'}
                </span>
              </div>
              {generatedAt && (
                <div className="flex items-center gap-1 text-[11px] text-surface-600 font-mono ml-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
                  Live
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Filter pills ─────────────────────────────────────────────── */}
        {!loading && events.length > 0 && (
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {FILTER_OPTIONS.map(opt => {
              const isActive = filter === opt.value
              const count = counts[opt.value]
              const levelCfg = opt.value !== 'all' ? LEVEL_CONFIG[opt.value] : null
              return (
                <button
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all',
                    isActive
                      ? levelCfg
                        ? cn(levelCfg.bg, levelCfg.text, 'border', levelCfg.border)
                        : 'bg-for-500/20 text-for-300 border border-for-500/40'
                      : 'bg-surface-200 text-surface-500 border border-surface-300 hover:text-white hover:border-surface-400'
                  )}
                >
                  {opt.value !== 'all' && levelCfg && (
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', levelCfg.dot)} />
                  )}
                  {opt.label}
                  {count > 0 && (
                    <span className={cn(
                      'min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-mono font-bold px-1',
                      isActive ? 'bg-white/10' : 'bg-surface-300'
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <EventSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Radio}
            title={
              filter !== 'all'
                ? `No ${LEVEL_CONFIG[filter].label.toLowerCase()} alerts right now`
                : 'All quiet on the civic front'
            }
            description={
              filter !== 'all'
                ? `There are no ${filter} events at this moment. Check back soon.`
                : 'No significant activity spikes detected in the last 2 hours. The platform is in steady state — check back soon.'
            }
            actions={
              filter !== 'all'
                ? [{ label: 'Show all alerts', onClick: () => setFilter('all') }]
                : [{ label: 'View live feed', href: '/now' }]
            }
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Footer info ──────────────────────────────────────────────── */}
        {!loading && events.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-200">
            <p className="text-xs text-surface-600 text-center">
              Breaking News monitors vote velocity, argument activity, and status transitions
              in real time. Events auto-refresh every 90 seconds.
            </p>
            <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
              <Link href="/now" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                Status Board
              </Link>
              <Link href="/momentum" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Momentum
              </Link>
              <Link href="/flashpoint" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <Flame className="h-3 w-3" />
                Flashpoint
              </Link>
              <Link href="/vote-stream" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Vote Stream
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
