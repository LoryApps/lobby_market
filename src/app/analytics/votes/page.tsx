'use client'

/**
 * /analytics/votes — Vote History & Patterns
 *
 * Deep-dive on when and how the user votes:
 *  - Total vote stats (FOR/AGAINST split, dates, streaks)
 *  - Weekly vote volume bar chart (last 26 weeks)
 *  - Day-of-week heatmap (which day do you vote most?)
 *  - Hour-of-day distribution
 *  - Majority vs contrarian voting breakdown
 *  - Milestone timeline (1st, 10th, 100th vote …)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Flame,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingDown,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  VotesAnalyticsResponse,
  DayOfWeekStat,
  HourOfDayStat,
  WeeklyStat,
  VoteMilestone,
} from '@/app/api/analytics/votes/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtHour(h: number): string {
  if (h === 0) return '12am'
  if (h < 12) return `${h}am`
  if (h === 12) return '12pm'
  return `${h - 12}pm`
}

// ─── Stat tile ────────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-for-400',
  loading = false,
}: {
  icon: typeof Activity
  label: string
  value: string | number
  sub?: string
  color?: string
  loading?: boolean
}) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-surface-100 border border-surface-300">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-24" />
      ) : (
        <div className="font-mono font-bold text-2xl text-white leading-none">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </div>
      )}
      {sub && !loading && (
        <p className="text-[11px] text-surface-500 font-mono">{sub}</p>
      )}
    </div>
  )
}

// ─── Weekly bar chart ────────────────────────────────────────────────────────────────

function WeeklyBars({ weeks }: { weeks: WeeklyStat[] }) {
  const maxVotes = Math.max(...weeks.map((w) => w.voteCount), 1)
  const last12 = weeks.slice(-12)

  if (last12.length === 0) {
    return (
      <p className="text-sm text-surface-500 font-mono text-center py-6">No vote history yet.</p>
    )
  }

  return (
    <div className="flex items-end gap-1 h-28 w-full">
      {last12.map((week) => {
        const heightPct = (week.voteCount / maxVotes) * 100
        const forPct = week.voteCount > 0 ? (week.forCount / week.voteCount) * 100 : 50
        return (
          <div key={week.weekKey} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
              <div className="bg-surface-200 border border-surface-300 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-white whitespace-nowrap shadow-lg">
                <div className="font-bold">{week.weekLabel}</div>
                <div className="text-for-400">{week.forCount} FOR</div>
                <div className="text-against-400">{week.againstCount} AGN</div>
              </div>
              <div className="w-1.5 h-1.5 bg-surface-200 border-r border-b border-surface-300 rotate-45 -mt-1" />
            </div>
            {/* Bar */}
            <div className="w-full flex-1 flex flex-col justify-end">
              <div
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
              >
                <div
                  style={{ height: `${forPct}%` }}
                  className="w-full bg-for-500/70 group-hover:bg-for-400 transition-colors"
                />
                <div
                  style={{ height: `${100 - forPct}%` }}
                  className="w-full bg-against-500/60 group-hover:bg-against-400 transition-colors"
                />
              </div>
            </div>
            {/* Label */}
            <span className="text-[8px] font-mono text-surface-500 truncate w-full text-center leading-none">
              {week.weekLabel}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Day of week heatmap ──────────────────────────────────────────────────────────────

function DayHeatmap({ stats }: { stats: DayOfWeekStat[] }) {
  const max = Math.max(...stats.map((d) => d.voteCount), 1)
  return (
    <div className="flex gap-2">
      {stats.map((s) => {
        const intensity = s.voteCount / max
        return (
          <div key={s.day} className="flex-1 flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-full aspect-square rounded-lg flex items-center justify-center',
                'transition-all duration-500 border',
                intensity === 0 ? 'bg-surface-300/30 border-surface-300/30 text-surface-600' :
                intensity < 0.25 ? 'bg-for-500/15 border-for-500/20 text-for-500' :
                intensity < 0.5 ? 'bg-for-500/30 border-for-500/35 text-for-400' :
                intensity < 0.75 ? 'bg-for-500/55 border-for-500/50 text-for-300' :
                'bg-for-500/80 border-for-500/70 text-white'
              )}
              title={`${s.voteCount} votes on ${s.day}`}
            >
              <span className="text-[10px] font-mono font-bold">{s.voteCount > 0 ? s.voteCount : ''}</span>
            </div>
            <span className="text-[10px] font-mono text-surface-500">{s.day}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Hour distribution ────────────────────────────────────────────────────────────────

function HourDistribution({ stats }: { stats: HourOfDayStat[] }) {
  const max = Math.max(...stats.map((h) => h.voteCount), 1)
  // Show 6-hour blocks
  const blocks = [
    { label: 'Night', hours: [0,1,2,3,4,5], icon: '🌙' },
    { label: 'Morning', hours: [6,7,8,9,10,11], icon: '🌅' },
    { label: 'Afternoon', hours: [12,13,14,15,16,17], icon: '☀️' },
    { label: 'Evening', hours: [18,19,20,21,22,23], icon: '🏖' },
  ]
  return (
    <div className="space-y-3">
      {/* Per-block summary */}
      <div className="grid grid-cols-4 gap-2">
        {blocks.map((block) => {
          const total = block.hours.reduce((s, h) => s + (stats[h]?.voteCount ?? 0), 0)
          const pct = Math.round((total / (stats.reduce((s, h) => s + h.voteCount, 0) || 1)) * 100)
          return (
            <div
              key={block.label}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-surface-200/50 border border-surface-300/50"
            >
              <span className="text-base" aria-hidden="true">{block.icon}</span>
              <span className="text-[10px] font-mono text-surface-500">{block.label}</span>
              <span className="text-xs font-mono font-bold text-white">{pct}%</span>
            </div>
          )
        })}
      </div>
      {/* Hour bars */}
      <div className="flex items-end gap-px h-14">
        {stats.map((h) => {
          const heightPct = (h.voteCount / max) * 100
          return (
            <div key={h.hour} className="flex-1 flex flex-col items-center group relative">
              <div
                className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 pointer-events-none"
              >
                <div className="bg-surface-200 border border-surface-300 rounded px-1.5 py-0.5 text-[9px] font-mono text-white whitespace-nowrap">
                  {fmtHour(h.hour)}: {h.voteCount}
                </div>
              </div>
              <div
                style={{ height: `${Math.max(heightPct, 2)}%` }}
                className="w-full bg-purple/50 group-hover:bg-purple transition-colors rounded-t-sm"
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-surface-500">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
    </div>
  )
}

// ─── Milestone timeline ───────────────────────────────────────────────────────────────

function MilestoneTimeline({
  milestones,
  total,
}: {
  milestones: VoteMilestone[]
  total: number
}) {
  const achieved = milestones.filter((m) => m.achievedAt !== null)
  const next = milestones.find((m) => m.achievedAt === null)

  return (
    <div className="space-y-2">
      {achieved.map((m, i) => (
        <motion.div
          key={m.milestone}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-3"
        >
          <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-gold/15 border border-gold/30">
            <Trophy className="h-3 w-3 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-white">{m.label}</span>
              <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                {fmtDate(m.achievedAt)}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
      {next && (
        <div className="flex items-center gap-3 opacity-50">
          <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-surface-300/30 border border-surface-300/50 border-dashed">
            <Zap className="h-3 w-3 text-surface-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-surface-500">{next.label}</span>
              <span className="text-[10px] font-mono text-surface-600">
                {next.milestone - total} to go
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────────

export default function VotesAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<VotesAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/votes', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as VotesAnalyticsResponse)
    } catch {
      setError('Could not load vote history. Try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8 space-y-5">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Vote History</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              When, how often, and how you vote
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-sm text-against-300 font-mono">
            {error}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!loading && !error && data?.totalVotes === 0 && (
          <EmptyState
            icon={ThumbsUp}
            title="No votes yet"
            description="Cast your first vote to start tracking your civic engagement."
            action={{ label: 'Go to Feed', href: '/' }}
          />
        )}

        {data && data.totalVotes > 0 && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* ── Hero stats ────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile
                  icon={ThumbsUp}
                  label="Total Votes"
                  value={data.totalVotes}
                  sub={`since ${fmtDate(data.firstVoteAt)}`}
                  color="text-for-400"
                  loading={loading}
                />
                <StatTile
                  icon={Flame}
                  label="Streak"
                  value={`${data.currentStreak}d`}
                  sub={`best: ${data.longestStreak}d`}
                  color="text-gold"
                  loading={loading}
                />
                <StatTile
                  icon={Calendar}
                  label="Active Days"
                  value={data.daysActive}
                  sub={`~${data.avgVotesPerActiveDay} votes/day`}
                  color="text-emerald"
                  loading={loading}
                />
                <StatTile
                  icon={Activity}
                  label="Last Vote"
                  value={relDate(data.lastVoteAt)}
                  color="text-purple"
                  loading={loading}
                />
              </div>

              {/* ── FOR vs AGAINST ───────────────────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5" />
                    FOR / AGAINST Split
                  </h2>
                  <span className="text-[11px] font-mono text-surface-500">
                    {data.totalVotes} total
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                    <span className="text-xs font-mono font-bold text-for-400">{data.forPct}%</span>
                    <span className="text-[10px] font-mono text-surface-500">FOR</span>
                  </div>
                  {/* Compound bar */}
                  <div className="flex-1 h-3 rounded-full overflow-hidden bg-against-500/30 flex">
                    <div
                      style={{ width: `${data.forPct}%` }}
                      className="h-full bg-for-500 rounded-l-full transition-all duration-700"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-mono text-surface-500">AGN</span>
                    <span className="text-xs font-mono font-bold text-against-400">{100 - data.forPct}%</span>
                    <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
                  <span>{data.forCount.toLocaleString()} FOR votes</span>
                  <span>{data.againstCount.toLocaleString()} AGAINST votes</span>
                </div>
              </div>

              {/* ── Weekly volume ───────────────────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Weekly Vote Volume — Last 12 Weeks
                </h2>
                {loading ? (
                  <Skeleton className="h-28 w-full" />
                ) : (
                  <WeeklyBars weeks={data.weeklyStats} />
                )}
                <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-for-500/70 inline-block" />
                    FOR
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-against-500/60 inline-block" />
                    AGAINST
                  </span>
                </div>
              </div>

              {/* ── Day of week ───────────────────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5" />
                  Best Day to Vote
                </h2>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <DayHeatmap stats={data.dayOfWeekStats} />
                )}
                {!loading && data.dayOfWeekStats.length > 0 && (
                  <p className="text-[11px] font-mono text-surface-500">
                    Most active:{' '}
                    <span className="text-for-400 font-semibold">
                      {data.dayOfWeekStats.reduce((best, d) =>
                        d.voteCount > best.voteCount ? d : best,
                        data.dayOfWeekStats[0]
                      ).day}
                    </span>
                  </p>
                )}
              </div>

              {/* ── Hour of day ───────────────────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Time of Day Pattern
                </h2>
                {loading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <HourDistribution stats={data.hourOfDayStats} />
                )}
              </div>

              {/* ── Majority vs Contrarian ───────────────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Consensus vs Contrarian
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className={cn(
                    'flex flex-col gap-2 p-3 rounded-xl border',
                    data.contrarianPct < 30
                      ? 'bg-for-500/8 border-for-500/25'
                      : 'bg-surface-200/50 border-surface-300/50'
                  )}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-for-400" />
                      <span className="text-[11px] font-mono text-surface-500">With Majority</span>
                    </div>
                    <div className="font-mono font-bold text-xl text-white">
                      {100 - data.contrarianPct}%
                    </div>
                    <p className="text-[10px] font-mono text-surface-500">
                      {data.majorityVotes.toLocaleString()} votes
                    </p>
                  </div>
                  <div className={cn(
                    'flex flex-col gap-2 p-3 rounded-xl border',
                    data.contrarianPct >= 40
                      ? 'bg-against-500/8 border-against-500/25'
                      : 'bg-surface-200/50 border-surface-300/50'
                  )}>
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-3.5 w-3.5 text-against-400" />
                      <span className="text-[11px] font-mono text-surface-500">Contrarian</span>
                    </div>
                    <div className="font-mono font-bold text-xl text-white">
                      {data.contrarianPct}%
                    </div>
                    <p className="text-[10px] font-mono text-surface-500">
                      {data.contrarianVotes.toLocaleString()} votes
                    </p>
                  </div>
                </div>
                <p className="text-[11px] font-mono text-surface-500">
                  {data.contrarianPct >= 40
                    ? 'You challenge consensus — a true independent voice.'
                    : data.contrarianPct >= 25
                    ? 'A healthy mix of consensus and independent thinking.'
                    : 'You tend to vote with the majority.'}
                </p>
              </div>

              {/* ── Milestones ──────────────────────────────────────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5" />
                  Vote Milestones
                </h2>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
                  </div>
                ) : (
                  <MilestoneTimeline milestones={data.milestones} total={data.totalVotes} />
                )}
              </div>

              {/* ── Navigation ──────────────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/analytics/topics"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
                >
                  <Scale className="h-4 w-4 text-emerald flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold text-white">Topic Analytics</p>
                    <p className="text-[10px] font-mono text-surface-500">Accuracy &amp; topics</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" />
                </Link>
                <Link
                  href="/activity-calendar"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
                >
                  <Calendar className="h-4 w-4 text-for-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold text-white">Activity Calendar</p>
                    <p className="text-[10px] font-mono text-surface-500">Year in review</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────────────── */}
        {loading && !data && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-7 w-20" />
                  <Skeleton className="h-3 w-12" />
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-28 w-full" />
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
