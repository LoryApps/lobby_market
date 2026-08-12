'use client'

/**
 * /debate/my-schedule — Personal Debate Schedule
 *
 * Shows all upcoming debates the current user has RSVP'd to, grouped by date.
 * Includes a live countdown for debates starting soon, quick join links,
 * and cancel-RSVP actions.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  CalendarPlus,
  Clock,
  ExternalLink,
  RefreshCw,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { DebateRSVPButton } from '@/components/debate/DebateRSVPButton'
import { cn } from '@/lib/utils/cn'
import type { ScheduledDebate, DebateScheduleResponse } from '@/app/api/me/debate-schedule/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function msUntil(iso: string): number {
  return Math.max(0, new Date(iso).getTime() - Date.now())
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'starting now'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `in ${h}h ${m}m`
  if (m > 0) return `in ${m}m ${s.toString().padStart(2, '0')}s`
  return `in ${s}s`
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

const TYPE_COLOR: Record<string, string> = {
  quick: 'text-for-400 bg-for-500/10 border-for-500/30',
  grand: 'text-gold bg-gold/10 border-gold/30',
  tribunal: 'text-purple bg-purple/10 border-purple/30',
  oxford: 'text-emerald bg-emerald/10 border-emerald/30',
  town_hall: 'text-for-300 bg-for-400/10 border-for-400/30',
  rapid_fire: 'text-against-400 bg-against-500/10 border-against-500/30',
  panel: 'text-surface-400 bg-surface-300/30 border-surface-400/30',
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Countdown component ──────────────────────────────────────────────────────

function LiveCountdown({ scheduledAt, status }: { scheduledAt: string; status: string }) {
  const [ms, setMs] = useState(() => (status === 'live' ? 0 : msUntil(scheduledAt)))

  useEffect(() => {
    if (status === 'live') return
    const id = setInterval(() => setMs(msUntil(scheduledAt)), 1000)
    return () => clearInterval(id)
  }, [scheduledAt, status])

  if (status === 'live') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-mono text-for-400 font-semibold">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-for-400 animate-pulse" />
        LIVE NOW
      </span>
    )
  }

  const isImminent = ms < 60 * 60 * 1000
  return (
    <span className={cn('flex items-center gap-1 text-[11px] font-mono', isImminent ? 'text-gold font-semibold' : 'text-surface-500')}>
      <Clock className="h-3 w-3" />
      {formatCountdown(ms)}
    </span>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateScheduleCard({ debate }: { debate: ScheduledDebate }) {
  const isLive = debate.status === 'live'
  const typeColor = TYPE_COLOR[debate.type] ?? 'text-surface-400 bg-surface-300/30 border-surface-400/30'
  const catColor = CATEGORY_COLOR[debate.topic_category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isLive
          ? 'bg-for-500/8 border-for-500/30'
          : 'bg-surface-200/60 border-surface-300/60 hover:bg-surface-200/80'
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border mt-0.5',
            isLive ? 'bg-for-500/15 border-for-500/30' : 'bg-surface-300/60 border-surface-400/40'
          )}>
            {isLive ? (
              <Zap className="h-3.5 w-3.5 text-for-400" />
            ) : (
              <Calendar className="h-3.5 w-3.5 text-surface-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2">
              {debate.title}
            </p>
            {debate.topic_statement && (
              <p className={cn('text-[11px] font-mono mt-0.5 line-clamp-1', catColor)}>
                {debate.topic_statement.length > 70
                  ? debate.topic_statement.slice(0, 70) + '…'
                  : debate.topic_statement}
              </p>
            )}
          </div>
        </div>

        <Link
          href={`/debate/${debate.id}`}
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold',
            'border transition-all',
            isLive
              ? 'bg-for-600/20 border-for-500/40 text-for-300 hover:bg-for-600/30'
              : 'bg-surface-300/60 border-surface-400/40 text-surface-400 hover:text-white hover:border-surface-400'
          )}
        >
          <ExternalLink className="h-3 w-3" />
          {isLive ? 'Join' : 'View'}
        </Link>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold', typeColor)}>
          {TYPE_LABEL[debate.type] ?? debate.type}
        </span>

        <LiveCountdown scheduledAt={debate.scheduled_at} status={debate.status} />

        {!isLive && (
          <span className="text-[11px] font-mono text-surface-600">
            {formatTime(debate.scheduled_at)}
          </span>
        )}

        {debate.rsvp_count > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Users className="h-3 w-3" />
            {debate.rsvp_count} attending
          </span>
        )}
      </div>

      {/* RSVP cancel button */}
      <div className="mt-3 flex items-center justify-between">
        <Link
          href={`/topic/${debate.topic_id}/debate`}
          className="text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
        >
          See all debates →
        </Link>

        <DebateRSVPButton
          debateId={debate.id}
          initialCount={debate.rsvp_count}
          initialHasRsvp={true}
          size="sm"
        />
      </div>
    </motion.div>
  )
}

// ─── Day group ─────────────────────────────────────────────────────────────────

function DayGroup({ day, debates }: { day: string; debates: ScheduledDebate[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-mono font-bold text-surface-500 uppercase tracking-widest">
          {day}
        </span>
        <div className="flex-1 h-px bg-surface-300/60" />
        <span className="text-[10px] font-mono text-surface-600">
          {debates.length} debate{debates.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-3">
        {debates.map((d) => (
          <DebateScheduleCard key={d.id} debate={d} />
        ))}
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((g) => (
        <div key={g} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="flex-1 h-px" />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-md" />
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function MySchedulePage() {
  const router = useRouter()
  const [debates, setDebates] = useState<ScheduledDebate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const res = await fetch('/api/me/debate-schedule', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('fetch failed')
      const data: DebateScheduleResponse = await res.json()
      setDebates(data.debates ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // Group by day
  const grouped: { day: string; debates: ScheduledDebate[] }[] = []
  for (const d of debates) {
    const day = formatDay(d.scheduled_at)
    const existing = grouped.find((g) => g.day === day)
    if (existing) {
      existing.debates.push(d)
    } else {
      grouped.push({ day, debates: [d] })
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/debate"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0 mt-0.5"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-for-400 flex-shrink-0" />
                <h1 className="font-mono text-lg font-bold text-white">My Schedule</h1>
              </div>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Upcoming debates you&apos;re attending
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={load}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <Link
              href="/debate/calendar"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors text-xs font-mono"
            >
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </Link>
          </div>
        </div>

        {/* Summary pill */}
        {!loading && !error && debates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-for-500/8 border border-for-500/20 mb-6"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
            <span className="text-xs font-mono text-for-300">
              {debates.length} upcoming debate{debates.length !== 1 ? 's' : ''} in your schedule
            </span>
          </motion.div>
        )}

        {/* Content */}
        {loading && <ScheduleSkeleton />}

        {error && (
          <div className="py-12 text-center">
            <p className="text-sm font-mono text-against-400">Failed to load your schedule.</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <AnimatePresence mode="wait">
            {grouped.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <EmptyState
                  icon={CalendarCheck}
                  title="No upcoming debates"
                  description="RSVP to scheduled debates to add them to your personal schedule."
                  action={{ label: 'Browse Debates', href: '/debate/calendar' }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-8"
              >
                {grouped.map(({ day, debates: dayDebates }) => (
                  <DayGroup key={day} day={day} debates={dayDebates} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
