'use client'

/**
 * /tally — The Civic Tally Board
 *
 * An election-night style command centre showing every topic currently
 * in the voting phase.  Each race shows animated vote bars, a live
 * countdown, and an automatic "call" badge when one side has a decisive
 * lead.  Auto-refreshes every 30 seconds so the board stays live.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Gavel,
  Radio,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { TallyRace, RecentVerdict, TallyResponse } from '@/app/api/tally/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 30_000

const CATEGORY_COLORS: Record<string, string> = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const totalMin = Math.floor(diff / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m left`
  if (h < 24) return m > 0 ? `${h}h ${m}m left` : `${h}h left`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h left`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function truncate(s: string, max = 100): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ─── Call badge ───────────────────────────────────────────────────────────────

function CallBadge({ called }: { called: TallyRace['called'] }) {
  if (!called) return null

  if (called === 'too_close') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-widest bg-gold/15 text-gold border border-gold/30">
        <Scale className="h-3 w-3" />
        Too Close
      </span>
    )
  }

  if (called === 'for') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-widest bg-for-600/20 text-for-300 border border-for-500/30">
        <ThumbsUp className="h-3 w-3" />
        Calling FOR
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-widest bg-against-600/20 text-against-300 border border-against-500/30">
      <ThumbsDown className="h-3 w-3" />
      Calling AGAINST
    </span>
  )
}

// ─── Race card ────────────────────────────────────────────────────────────────

function RaceCard({ race, index }: { race: TallyRace; index: number }) {
  const forPct  = Math.round(race.blue_pct)
  const agnPct  = 100 - forPct
  const catColor = CATEGORY_COLORS[race.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Link
        href={`/topic/${race.id}`}
        className={cn(
          'group block rounded-2xl border bg-surface-100 p-4 transition-all duration-150',
          'hover:bg-surface-200 hover:shadow-lg',
          race.is_expiring_soon
            ? 'border-gold/30 bg-gold/5'
            : race.called === 'too_close'
              ? 'border-purple/20'
              : 'border-surface-300/60',
        )}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {race.category && (
              <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest flex-shrink-0', catColor)}>
                {race.category}
              </span>
            )}
            <CallBadge called={race.called} />
            {race.is_expiring_soon && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase tracking-widest bg-gold/15 text-gold border border-gold/30">
                <AlertTriangle className="h-3 w-3" />
                Expiring Soon
              </span>
            )}
          </div>
          <span className={cn(
            'flex-shrink-0 flex items-center gap-1 text-xs font-mono',
            race.is_expiring_soon ? 'text-gold' : 'text-surface-500',
          )}>
            <Timer className="h-3.5 w-3.5" />
            {race.voting_ends_at ? countdown(race.voting_ends_at) : '—'}
          </span>
        </div>

        {/* Statement */}
        <p className="text-sm font-mono text-white leading-relaxed mb-4">
          {truncate(race.statement)}
        </p>

        {/* Vote bar */}
        <div className="space-y-2">
          {/* Labels */}
          <div className="flex justify-between text-xs font-mono font-semibold">
            <span className="text-for-400">{forPct}% FOR</span>
            <span className="text-surface-500 text-[10px] font-normal">
              {formatVotes(race.total_votes)} votes
            </span>
            <span className="text-against-400">{agnPct}% AGAINST</span>
          </div>

          {/* Bar — split at center */}
          <div className="relative h-4 rounded-full overflow-hidden bg-surface-300 flex">
            {/* FOR (blue) grows from left */}
            <motion.div
              className={cn(
                'absolute inset-y-0 left-0 rounded-l-full',
                race.called === 'for'
                  ? 'bg-gradient-to-r from-for-600 to-for-400'
                  : 'bg-gradient-to-r from-for-700 to-for-500',
              )}
              initial={false}
              animate={{ width: `${forPct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            />
            {/* AGAINST (red) grows from right */}
            <motion.div
              className={cn(
                'absolute inset-y-0 right-0 rounded-r-full',
                race.called === 'against'
                  ? 'bg-gradient-to-l from-against-600 to-against-400'
                  : 'bg-gradient-to-l from-against-700 to-against-500',
              )}
              initial={false}
              animate={{ width: `${agnPct}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 18 }}
            />
            {/* Center needle */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-surface-100/60 z-10" />
          </div>

          {/* Raw counts */}
          <div className="flex justify-between text-[10px] font-mono text-surface-500">
            <span>{formatVotes(race.blue_votes)} for</span>
            <span>{formatVotes(race.red_votes)} against</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-end gap-1 text-xs font-mono text-surface-600 group-hover:text-for-400 transition-colors">
          Vote now
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Recent verdict row ───────────────────────────────────────────────────────

function VerdictRow({ v }: { v: RecentVerdict }) {
  const forPct = Math.round(v.blue_pct)
  const catColor = CATEGORY_COLORS[v.category ?? ''] ?? 'text-surface-500'

  return (
    <Link
      href={`/topic/${v.id}`}
      className="group flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl hover:bg-surface-200 transition-colors"
    >
      <div className={cn(
        'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border',
        v.status === 'law'
          ? 'bg-gold/10 border-gold/30'
          : 'bg-against-500/10 border-against-500/20',
      )}>
        {v.status === 'law'
          ? <Gavel className="h-4 w-4 text-gold" />
          : <XCircle className="h-4 w-4 text-against-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-white truncate">{v.statement}</p>
        <p className={cn('text-[10px] font-mono mt-0.5', catColor)}>{v.category}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className={cn(
          'text-xs font-mono font-semibold',
          v.status === 'law' ? 'text-gold' : 'text-against-400',
        )}>
          {forPct}% FOR
        </p>
        <p className="text-[10px] text-surface-500 font-mono">{relativeTime(v.updated_at)}</p>
      </div>
    </Link>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TallySkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300/60 bg-surface-100/50 p-4 space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Activity
  color: string
}) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center px-4 py-3 rounded-2xl border text-center min-w-[90px]',
      color === 'for'
        ? 'bg-for-600/10 border-for-500/20'
        : color === 'against'
          ? 'bg-against-600/10 border-against-500/20'
          : color === 'gold'
            ? 'bg-gold/10 border-gold/20'
            : 'bg-purple/10 border-purple/20',
    )}>
      <Icon className={cn(
        'h-4 w-4 mb-1',
        color === 'for' ? 'text-for-400'
          : color === 'against' ? 'text-against-400'
          : color === 'gold' ? 'text-gold'
          : 'text-purple',
      )} />
      <AnimatedNumber
        value={value}
        className={cn(
          'text-2xl font-mono font-bold tabular-nums',
          color === 'for' ? 'text-for-300'
            : color === 'against' ? 'text-against-300'
            : color === 'gold' ? 'text-gold'
            : 'text-purple',
        )}
      />
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TallyPage() {
  const [data, setData] = useState<TallyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    try {
      const res = await fetch('/api/tally', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as TallyResponse
      setData(json)
      setError(false)
      setLastRefreshed(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(() => fetchData(), REFRESH_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchData])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-for-600/10 border border-for-500/20 flex-shrink-0">
              <Radio className="h-6 w-6 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Tally Board
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Live voting results across every open debate
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {lastRefreshed && (
              <p className="text-[10px] font-mono text-surface-600 hidden sm:block">
                Updated {relativeTime(lastRefreshed.toISOString())}
              </p>
            )}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors disabled:opacity-50"
              aria-label="Refresh tally"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        {data && (
          <div className="flex items-center gap-3 overflow-x-auto pb-1 mb-6 no-scrollbar">
            <StatChip
              label="Races"
              value={data.races.length}
              icon={Scale}
              color="purple"
            />
            <StatChip
              label="Calling FOR"
              value={data.called_for_count}
              icon={ThumbsUp}
              color="for"
            />
            <StatChip
              label="Calling AGN"
              value={data.called_against_count}
              icon={ThumbsDown}
              color="against"
            />
            <StatChip
              label="Too Close"
              value={data.too_close_count}
              icon={AlertTriangle}
              color="gold"
            />
            <StatChip
              label="Votes in Play"
              value={data.total_votes_in_play}
              icon={Activity}
              color="purple"
            />
          </div>
        )}

        {/* ── Live indicator ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-for-500" />
          </span>
          <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
            Live · auto-refreshes every 30 seconds
          </span>
        </div>

        {/* ── Race grid ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" exit={{ opacity: 0 }}>
              <TallySkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={AlertTriangle}
                title="Board offline"
                description="Could not load live tally data. Refresh to try again."
                action={{ label: 'Retry', onClick: () => fetchData(true) }}
              />
            </motion.div>
          ) : !data || data.races.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Scale}
                title="No active votes"
                description="No topics are currently in the voting phase. Check back once debates move into the final vote."
                action={{ label: 'Browse Topics', href: '/' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="races"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {data.races.map((race, i) => (
                <RaceCard key={race.id} race={race} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Recent verdicts ──────────────────────────────────────────────── */}
        {data && data.recent_verdicts.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="h-4 w-4 text-gold flex-shrink-0" />
              <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-wider">
                Recent Verdicts
              </h2>
              <span className="text-xs font-mono text-surface-600">
                · last 24 hours
              </span>
            </div>
            <div className="rounded-2xl border border-surface-300/60 bg-surface-100 px-3 py-1 divide-y divide-surface-300/40">
              {data.recent_verdicts.map((v) => (
                <VerdictRow key={v.id} v={v} />
              ))}
            </div>
          </div>
        )}

        {/* ── CTA ──────────────────────────────────────────────────────────── */}
        <div className="mt-10 rounded-2xl border border-surface-300/30 bg-surface-100/50 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-mono text-white font-semibold">
              See what is building momentum
            </p>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Topics gaining votes fastest right now
            </p>
          </div>
          <Link
            href="/momentum"
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
          >
            <Zap className="h-4 w-4" />
            Momentum
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
