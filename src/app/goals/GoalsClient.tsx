'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Check,
  CheckCircle2,
  Coins,
  Flame,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CivicGoal, GoalsResponse } from '@/app/api/me/goals/route'

// ─── Goal icon + color config ─────────────────────────────────────────────────

interface GoalMeta {
  icon: typeof Vote
  accent: string
  bg: string
  border: string
  bar: string
  href: string
  cta: string
}

const GOAL_META: Record<string, GoalMeta> = {
  votes: {
    icon: Vote,
    accent: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
    href: '/',
    cta: 'Vote now',
  },
  arguments: {
    icon: MessageSquare,
    accent: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    bar: 'bg-purple',
    href: '/topic/create',
    cta: 'Argue a topic',
  },
  debates: {
    icon: Mic,
    accent: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    href: '/debate',
    cta: 'Find a debate',
  },
  streak: {
    icon: Flame,
    accent: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
    href: '/streaks',
    cta: 'See streaks',
  },
  influence: {
    icon: ThumbsUp,
    accent: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
    href: '/arguments/mine',
    cta: 'My arguments',
  },
}

// ─── Day-of-week labels ───────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function WeekProgressDots({ start }: { start: string }) {
  const startDate = new Date(start)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  return (
    <div className="flex items-center gap-1" aria-label="Days this week">
      {DAYS.map((day, i) => {
        const d = new Date(startDate)
        d.setUTCDate(startDate.getUTCDate() + i)
        const isPast = d < today
        const isToday = d.toDateString() === today.toDateString()
        return (
          <div key={day} className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isToday
                  ? 'bg-for-400 ring-2 ring-for-400/30'
                  : isPast
                  ? 'bg-for-500/60'
                  : 'bg-surface-300',
              )}
              aria-label={`${day}: ${isToday ? 'today' : isPast ? 'past' : 'upcoming'}`}
            />
            <span className={cn('text-[9px] font-mono', isToday ? 'text-for-400' : 'text-surface-600')}>
              {day}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Single goal card ─────────────────────────────────────────────────────────

function GoalCard({ goal, rank }: { goal: CivicGoal; rank: number }) {
  const meta = GOAL_META[goal.id] ?? GOAL_META.votes
  const Icon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 transition-all',
        goal.completed ? 'border-emerald/30 bg-emerald/5' : 'border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0',
              goal.completed ? 'bg-emerald/20' : meta.bg,
            )}
            aria-hidden="true"
          >
            {goal.completed ? (
              <CheckCircle2 className="h-5 w-5 text-emerald" />
            ) : (
              <Icon className={cn('h-5 w-5', meta.accent)} />
            )}
          </div>
          <div>
            <p className={cn('font-semibold text-sm', goal.completed ? 'text-emerald' : 'text-white')}>
              {goal.label}
            </p>
            <p className="text-[11px] text-surface-500 mt-0.5">{goal.description}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p
            className={cn(
              'text-sm font-mono font-bold tabular-nums',
              goal.completed ? 'text-emerald' : 'text-white',
            )}
          >
            {goal.current}/{goal.target}
          </p>
          <p className="text-[10px] font-mono text-surface-500">{goal.unit}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-surface-300 rounded-full overflow-hidden mb-3" role="progressbar" aria-valuenow={goal.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${goal.label}: ${goal.pct}% complete`}>
        <motion.div
          className={cn('h-full rounded-full', goal.completed ? 'bg-emerald' : meta.bar)}
          initial={{ width: 0 }}
          animate={{ width: `${goal.pct}%` }}
          transition={{ duration: 0.7, delay: rank * 0.06 + 0.2, ease: 'easeOut' }}
        />
      </div>

      {/* Footer — CTA if not complete */}
      {!goal.completed && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-surface-500">{goal.pct}% there</span>
          <Link
            href={meta.href}
            className={cn(
              'inline-flex items-center gap-1 text-[11px] font-mono font-semibold',
              'transition-colors',
              meta.accent,
              'hover:opacity-80',
            )}
          >
            {meta.cta}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
      {goal.completed && (
        <div className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-emerald" aria-hidden="true" />
          <span className="text-[11px] font-mono text-emerald font-semibold">Goal complete!</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Completion badge ─────────────────────────────────────────────────────────

function CompletionBadge({ completed, total }: { completed: number; total: number }) {
  const pct = Math.round((completed / total) * 100)
  const isAll = completed === total

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 flex items-center gap-4',
        isAll
          ? 'bg-gold/10 border-gold/40'
          : 'bg-surface-200 border-surface-300',
      )}
    >
      <div
        className={cn(
          'h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0',
          'border-2',
          isAll ? 'border-gold/60 bg-gold/20' : 'border-surface-400/40 bg-surface-300',
        )}
        aria-hidden="true"
      >
        {isAll ? (
          <Trophy className="h-7 w-7 text-gold" />
        ) : (
          <BarChart2 className="h-7 w-7 text-surface-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-bold text-base', isAll ? 'text-gold' : 'text-white')}>
          {completed}/{total} Goals
        </p>
        <p className="text-[12px] text-surface-500 mt-0.5">
          {isAll ? 'All civic goals achieved this week' : `${pct}% of your weekly targets met`}
        </p>
        {/* Mini bar */}
        <div className="mt-2 h-1.5 bg-surface-300 rounded-full overflow-hidden" aria-hidden="true">
          <motion.div
            className={cn('h-full rounded-full', isAll ? 'bg-gold' : 'bg-for-500')}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GoalsClient() {
  const [data, setData] = useState<GoalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/me/goals', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as GoalsResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Date helpers ──────────────────────────────────────────────────────────
  function formatWeekRange(start: string, end: string): string {
    const s = new Date(start)
    const e = new Date(end)
    e.setUTCDate(e.getUTCDate() - 1) // Sunday
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Civic Goals</h1>
            {data?.weekStart && (
              <p className="text-[12px] font-mono text-surface-500 mt-1">
                Week of {formatWeekRange(data.weekStart, data.weekEnd)}
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh goals"
            className="h-8 w-8 rounded-full bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 text-for-400 animate-spin" />
            <p className="text-sm text-surface-500">Loading your goals…</p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <EmptyState
            icon={Zap}
            title="Couldn't load goals"
            description="Something went wrong fetching your weekly targets. Try again."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* Not authenticated */}
        {!loading && !error && data && !data.authenticated && (
          <EmptyState
            icon={Trophy}
            title="Sign in to track goals"
            description="Create an account or sign in to set and track your weekly civic targets."
            action={{ label: 'Sign in', href: '/login' }}
          />
        )}

        {/* Goals content */}
        <AnimatePresence>
          {!loading && !error && data?.authenticated && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {/* Encouragement + streak strip */}
              <div className="flex items-center gap-3 mb-5 p-4 rounded-xl bg-surface-200/50 border border-surface-300/60">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Flame className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
                  <p className="text-[12px] text-surface-400 italic leading-snug">{data.encouragement}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Streak</p>
                    <p className="text-sm font-bold text-gold tabular-nums">
                      <AnimatedNumber value={data.streak} />d
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Clout</p>
                    <p className="text-sm font-bold text-purple tabular-nums">
                      <AnimatedNumber value={data.clout} />
                    </p>
                  </div>
                </div>
              </div>

              {/* Week day dots */}
              <div className="flex items-center justify-between mb-5">
                <WeekProgressDots start={data.weekStart} />
                <Link
                  href="/activity-calendar"
                  className="text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
                >
                  Full calendar
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Completion summary */}
              <div className="mb-5">
                <CompletionBadge completed={data.completedCount} total={data.goals.length} />
              </div>

              {/* Goal cards */}
              <div className="space-y-3 mb-8">
                {data.goals.map((goal, i) => (
                  <GoalCard key={goal.id} goal={goal} rank={i} />
                ))}
              </div>

              {/* Navigation links */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: '/streaks', label: 'Streak Leaderboard', icon: Flame, color: 'text-gold' },
                  { href: '/analytics', label: 'My Analytics', icon: BarChart2, color: 'text-purple' },
                  { href: '/achievements', label: 'Achievements', icon: Trophy, color: 'text-gold' },
                  { href: '/clout', label: 'Clout History', icon: Coins, color: 'text-emerald' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 p-3.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors group"
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', color)} aria-hidden="true" />
                    <span className="text-[12px] font-semibold text-surface-700 group-hover:text-white transition-colors">
                      {label}
                    </span>
                  </Link>
                ))}
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
