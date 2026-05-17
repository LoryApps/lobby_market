'use client'

/**
 * /analytics/streak — Civic Streak History
 *
 * A dedicated analytics view for your voting-streak history:
 *   • Current streak status + tier
 *   • All-time longest streak
 *   • 13-week heatmap calendar
 *   • Every streak run (sorted by length)
 *   • Day-of-week breakdown — when do you start and break streaks?
 *   • Statistical summary: avg/median streak length, total active days
 *
 * Distinct from:
 *   /streaks          — community leaderboard (who has the longest streak NOW)
 *   /analytics/growth — long-term monthly growth and milestones
 *   /analytics/consistency — voting stance consistency within categories
 *   /activity-calendar    — GitHub-style contribution calendar (all actions)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CalendarDays,
  ChevronRight,
  Flame,
  History,
  RefreshCw,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { StreakAnalyticsData, StreakRun, DayOfWeekStat, HeatmapDay } from '@/app/api/analytics/streak/route'

// ─── Tier colour helpers ──────────────────────────────────────────────────────

const TIER_STYLES: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  Legendary:    { color: 'text-gold',        bg: 'bg-gold/15',        border: 'border-gold/40',         glow: 'shadow-[0_0_16px_rgba(201,168,76,0.4)]' },
  Transcendent: { color: 'text-purple',      bg: 'bg-purple/15',      border: 'border-purple/40',       glow: 'shadow-[0_0_14px_rgba(139,92,246,0.35)]' },
  Diamond:      { color: 'text-for-300',     bg: 'bg-for-500/15',     border: 'border-for-500/40',      glow: 'shadow-[0_0_10px_rgba(59,130,246,0.3)]' },
  Blazing:      { color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',      glow: '' },
  Hot:          { color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30',  glow: '' },
  Active:       { color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-400/30',  glow: '' },
  Starting:     { color: 'text-surface-500', bg: 'bg-surface-200',    border: 'border-surface-500/20',  glow: '' },
  None:         { color: 'text-surface-600', bg: 'bg-surface-200',    border: 'border-surface-300',     glow: '' },
}

function tierStyle(tier: string) {
  return TIER_STYLES[tier] ?? TIER_STYLES.None
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

const HEATMAP_COLORS = [
  'bg-surface-300',          // 0 votes
  'bg-for-800/70',           // 1
  'bg-for-700/80',           // 2
  'bg-for-600',              // 3
  'bg-for-500',              // 4+
]

function heatColor(count: number): string {
  if (count === 0) return HEATMAP_COLORS[0]
  if (count === 1) return HEATMAP_COLORS[1]
  if (count === 2) return HEATMAP_COLORS[2]
  if (count === 3) return HEATMAP_COLORS[3]
  return HEATMAP_COLORS[4]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function formatMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

interface HeatmapProps {
  days: HeatmapDay[]
}

function HeatmapGrid({ days }: HeatmapProps) {
  // Group into weeks (Mon-based, 7 days each)
  const weeks: HeatmapDay[][] = []
  let week: HeatmapDay[] = []

  for (const day of days) {
    week.push(day)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) weeks.push(week)

  // Month labels: show month name when the first day of a new month appears
  const monthLabels: (string | null)[] = weeks.map((w) => {
    const first = w[0]
    // Show label if this is the first week or the month changed
    const prevWeek = weeks[weeks.indexOf(w) - 1]
    if (!prevWeek) return formatMonthLabel(first.date)
    const prevMonth = new Date(prevWeek[0].date + 'T00:00:00Z').getUTCMonth()
    const currMonth = new Date(first.date + 'T00:00:00Z').getUTCMonth()
    return currMonth !== prevMonth ? formatMonthLabel(first.date) : null
  })

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        {/* Month headers */}
        <div className="flex gap-[3px] mb-1 pl-7">
          {weeks.map((w, wi) => (
            <div key={wi} className="w-[14px] text-center flex-shrink-0">
              <span className="text-[9px] font-mono text-surface-500">
                {monthLabels[wi] ?? ''}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] mr-1">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <div key={i} className="h-[14px] w-5 flex items-center justify-end">
                <span className="text-[9px] font-mono text-surface-600">{d}</span>
              </div>
            ))}
          </div>

          {/* Cells */}
          {weeks.map((w, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {w.map((day) => (
                <div
                  key={day.date}
                  title={`${formatDate(day.date)}: ${day.count} vote${day.count !== 1 ? 's' : ''}`}
                  className={cn(
                    'h-[14px] w-[14px] rounded-[2px] transition-opacity hover:opacity-80 cursor-default flex-shrink-0',
                    heatColor(day.count),
                  )}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-2 pl-7">
          <span className="text-[10px] font-mono text-surface-600">Less</span>
          {HEATMAP_COLORS.map((c, i) => (
            <div key={i} className={cn('h-[10px] w-[10px] rounded-[2px]', c)} />
          ))}
          <span className="text-[10px] font-mono text-surface-600">More</span>
        </div>
      </div>
    </div>
  )
}

// ─── Streak run card ──────────────────────────────────────────────────────────

function StreakRunCard({ run, rank, isLongest }: { run: StreakRun; rank: number; isLongest: boolean }) {
  const t = tierStyle(
    run.length >= 100 ? 'Legendary'
    : run.length >= 60 ? 'Transcendent'
    : run.length >= 30 ? 'Diamond'
    : run.length >= 14 ? 'Blazing'
    : run.length >= 7 ? 'Hot'
    : run.length >= 3 ? 'Active'
    : 'Starting'
  )

  return (
    <div className={cn(
      'flex items-center gap-3 px-4 py-3.5 border-b border-surface-300/50 last:border-0',
      isLongest && 'bg-gold/5',
    )}>
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
        <span className="text-xs font-mono font-bold text-surface-400">{rank}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-mono font-bold', t.color)}>
            {run.length} day{run.length !== 1 ? 's' : ''}
          </span>
          {isLongest && (
            <span className="text-[10px] font-mono font-bold text-gold bg-gold/15 border border-gold/30 px-1.5 py-0.5 rounded-full">
              All-time best
            </span>
          )}
        </div>
        <div className="text-[11px] font-mono text-surface-500 mt-0.5">
          {formatDate(run.start)} — {formatDate(run.end)}
        </div>
      </div>

      <div className={cn('px-2 py-1 rounded-lg border text-[11px] font-mono font-semibold', t.bg, t.border, t.color)}>
        {run.length >= 100 ? 'Legendary'
          : run.length >= 60 ? 'Transcendent'
          : run.length >= 30 ? 'Diamond'
          : run.length >= 14 ? 'Blazing'
          : run.length >= 7 ? 'Hot'
          : run.length >= 3 ? 'Active'
          : 'Starting'}
      </div>
    </div>
  )
}

// ─── Day of week bar chart ────────────────────────────────────────────────────

function DowChart({ stats }: { stats: DayOfWeekStat[] }) {
  const max = Math.max(...stats.map(s => s.vote_days), 1)

  return (
    <div className="space-y-2">
      {stats.map((s) => (
        <div key={s.day} className="flex items-center gap-3">
          <div className="w-7 text-right">
            <span className="text-[11px] font-mono text-surface-500">{s.short}</span>
          </div>
          <div className="flex-1 relative h-6 rounded-md bg-surface-300/40 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(s.vote_days / max) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: s.day * 0.04 }}
              className="absolute inset-y-0 left-0 bg-for-500/70 rounded-md"
            />
          </div>
          <div className="w-8 text-right">
            <span className="text-[11px] font-mono text-surface-400">{s.vote_days}</span>
          </div>
          <div className="w-16 flex items-center gap-1">
            {s.streak_starts > 0 && (
              <span className="text-[10px] font-mono text-emerald" title={`${s.streak_starts} streak${s.streak_starts !== 1 ? 's' : ''} started`}>
                +{s.streak_starts}
              </span>
            )}
            {s.streak_breaks > 0 && (
              <span className="text-[10px] font-mono text-against-400" title={`${s.streak_breaks} streak${s.streak_breaks !== 1 ? 's' : ''} ended`}>
                −{s.streak_breaks}
              </span>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-surface-300/50">
        <div className="w-7" />
        <div className="flex-1" />
        <div className="w-8" />
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1 text-emerald"><span className="h-2 w-2 rounded-full bg-emerald" />Streaks started</span>
          <span className="flex items-center gap-1 text-against-400"><span className="h-2 w-2 rounded-full bg-against-500" />Streaks ended</span>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <Skeleton className="h-4 w-28 mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StreakAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<StreakAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/streak', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const ts = data ? tierStyle(data.current_tier) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Back nav ──────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>
        </div>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Flame className="h-5 w-5 text-against-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Streak History</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Every run, every break — your voting rhythm over time
              </p>
            </div>
          </div>
          <p className="text-sm font-mono text-surface-400 leading-relaxed">
            A deep-dive into how you&apos;ve maintained your civic streak. See your longest runs,
            which days fuel your habit, and where it&apos;s broken before.
          </p>
        </div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PageSkeleton />
            </motion.div>
          )}

          {!loading && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={<Zap className="h-6 w-6 text-against-400" />}
                title="Couldn't load streak data"
                description="Something went wrong. Give it another try."
                action={
                  <button
                    onClick={load}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                }
              />
            </motion.div>
          )}

          {!loading && !error && data && (
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">

              {/* ── Hero stats ──────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Current streak */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  className={cn(
                    'rounded-2xl border p-5 text-center',
                    ts ? cn('bg-surface-100', ts.border, ts.glow) : 'bg-surface-100 border-surface-300',
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Flame className={cn('h-3.5 w-3.5', ts?.color ?? 'text-surface-500')} />
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Current</span>
                  </div>
                  <AnimatedNumber
                    value={data.current_streak}
                    className={cn('text-3xl font-mono font-bold block', ts?.color ?? 'text-white')}
                  />
                  <span className={cn('text-xs font-mono font-semibold', ts?.color ?? 'text-surface-500')}>
                    {data.current_tier !== 'None' ? data.current_tier : 'No streak'}
                  </span>
                  {data.next_milestone !== null && data.next_milestone > 0 && (
                    <p className="text-[10px] font-mono text-surface-600 mt-1">
                      {data.next_milestone}d to next tier
                    </p>
                  )}
                </motion.div>

                {/* Longest streak */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">All-time best</span>
                  </div>
                  <AnimatedNumber
                    value={data.longest_streak}
                    className="text-3xl font-mono font-bold text-gold block"
                  />
                  <span className="text-xs font-mono text-surface-500">days</span>
                </motion.div>

                {/* Active days */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <CalendarDays className="h-3.5 w-3.5 text-for-400" />
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Active days</span>
                  </div>
                  <AnimatedNumber
                    value={data.total_active_days}
                    className="text-3xl font-mono font-bold text-white block"
                  />
                  <span className="text-xs font-mono text-surface-500">days voted</span>
                </motion.div>

                {/* Avg streak */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center"
                >
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <BarChart2 className="h-3.5 w-3.5 text-purple" />
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Avg streak</span>
                  </div>
                  <div className="text-3xl font-mono font-bold text-white">
                    {data.avg_streak_length > 0 ? data.avg_streak_length.toFixed(1) : '—'}
                  </div>
                  <span className="text-xs font-mono text-surface-500">days per run</span>
                </motion.div>
              </div>

              {/* ── Context pills ────────────────────────────────────────── */}
              {data.all_streaks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex flex-wrap gap-2"
                >
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400">
                    <History className="h-3 w-3" />
                    {data.all_streaks.length} streak run{data.all_streaks.length !== 1 ? 's' : ''}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400">
                    <Target className="h-3 w-3" />
                    Median {data.median_streak_length}d
                  </div>
                  {data.significant_breaks > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-against-500/10 border border-against-500/20 text-xs font-mono text-against-400">
                      <TrendingDown className="h-3 w-3" />
                      {data.significant_breaks} significant break{data.significant_breaks !== 1 ? 's' : ''}
                    </div>
                  )}
                  {data.current_streak > 0 && data.current_streak === data.longest_streak && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-xs font-mono text-gold">
                      <TrendingUp className="h-3 w-3" />
                      Current is all-time best!
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Heatmap ──────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="h-4 w-4 text-for-400" />
                  <h2 className="font-mono text-sm font-semibold text-white">13-Week Activity Calendar</h2>
                </div>

                {data.heatmap.length > 0 ? (
                  <HeatmapGrid days={data.heatmap} />
                ) : (
                  <p className="text-sm font-mono text-surface-500">No vote data in the past 13 weeks.</p>
                )}
              </motion.div>

              {/* ── Day of week ──────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Swords className="h-4 w-4 text-purple" />
                  <h2 className="font-mono text-sm font-semibold text-white">Day-of-Week Rhythm</h2>
                  <span className="text-[10px] font-mono text-surface-600 ml-auto">days you voted on each weekday</span>
                </div>

                {data.total_active_days === 0 ? (
                  <p className="text-sm font-mono text-surface-500">No vote history yet.</p>
                ) : (
                  <DowChart stats={data.day_of_week} />
                )}
              </motion.div>

              {/* ── All streak runs ──────────────────────────────────────── */}
              {data.all_streaks.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-300">
                    <Trophy className="h-4 w-4 text-gold" />
                    <h2 className="font-mono text-sm font-semibold text-white">All Streak Runs</h2>
                    <span className="ml-auto text-[11px] font-mono text-surface-500">
                      Top {data.all_streaks.length} shown
                    </span>
                  </div>

                  <div>
                    {data.all_streaks.map((run, i) => (
                      <StreakRunCard
                        key={`${run.start}-${run.end}`}
                        run={run}
                        rank={i + 1}
                        isLongest={i === 0}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Empty state if never voted ───────────────────────────── */}
              {data.total_votes === 0 && (
                <EmptyState
                  icon={<Flame className="h-6 w-6 text-against-400" />}
                  title="No votes yet"
                  description="Cast your first vote to start building your streak history."
                  action={
                    <Link
                      href="/"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-xs font-mono font-semibold hover:bg-for-500 transition-colors"
                    >
                      Browse topics <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  }
                />
              )}

              {/* ── CTA row ──────────────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap gap-3"
              >
                <Link
                  href="/streaks"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Community Streak Leaderboard
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/analytics/growth"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Growth Report
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href="/activity-calendar"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Full Activity Calendar
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
