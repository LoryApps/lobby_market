'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  TrendingUp,
  Vote,
  Zap,
  Target,
  BarChart2,
  ArrowLeft,
  Flame,
  Scale,
  MessageSquare,
  Award,
  ChevronRight,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  ChevronDown,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { PredictionRecord } from '@/app/api/analytics/predictions/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  profile: {
    total_votes: number
    blue_vote_count: number
    red_vote_count: number
    vote_streak: number
    clout: number
    reputation_score: number
    total_arguments: number
    member_since: string
  }
  accuracy: number | null
  resolved_votes: number
  today?: {
    votes_used: number
    daily_limit: number
    reset_at: string | null
  }
  topCategories: Array<{
    category: string
    count: number
    blue: number
    red: number
  }>
  dailyActivity: Array<{ date: string; count: number }>
  monthlyActivity: Array<{ month: string; count: number }>
  predictions?: {
    total: number
    resolved: number
    correct: number
    accuracy: number | null
    avg_brier: number | null
    clout_earned: number
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-surface-300/50', className)} />
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      {/* hero row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      {/* cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-44">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-44">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TodayProgressCard({
  votesUsed,
  dailyLimit,
  streak,
}: {
  votesUsed: number
  dailyLimit: number
  streak: number
}) {
  const pct = Math.min((votesUsed / dailyLimit) * 100, 100)
  const goalMet = votesUsed >= dailyLimit
  const hasVotedToday = votesUsed > 0

  // Streak-driven heat color
  const streakColor =
    streak >= 30
      ? 'text-against-300'
      : streak >= 7
      ? 'text-gold'
      : streak >= 1
      ? 'text-amber-400'
      : 'text-surface-500'

  const barColor =
    pct >= 100
      ? 'bg-gradient-to-r from-emerald to-emerald/70'
      : pct >= 60
      ? 'bg-gradient-to-r from-for-500 to-for-400'
      : 'bg-gradient-to-r from-for-700 to-for-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <Flame className="h-3.5 w-3.5 text-gold" />
        Today&apos;s Progress
      </div>

      <div className="flex items-start gap-4">
        {/* Streak display */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className={cn('text-3xl font-mono font-bold', streakColor)}>
            {streak}
          </div>
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            day{streak !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
            <Flame className={cn('h-3 w-3', streakColor)} />
            streak
          </div>
        </div>

        {/* Separator */}
        <div className="w-px self-stretch bg-surface-300 flex-shrink-0" />

        {/* Daily vote progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-mono font-medium text-white">
              Daily votes
            </span>
            <span className={cn(
              'text-sm font-mono font-bold',
              goalMet ? 'text-emerald' : 'text-for-400'
            )}>
              {votesUsed}
              <span className="text-surface-500 font-normal">/{dailyLimit}</span>
            </span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2.5 rounded-full bg-surface-300 overflow-hidden mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
              className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
            />
          </div>

          {/* Status message */}
          {goalMet ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald">
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              Daily goal complete — streak extended!
            </div>
          ) : hasVotedToday ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
              <Circle className="h-3.5 w-3.5 flex-shrink-0 text-for-500" />
              {dailyLimit - votesUsed} more vote{dailyLimit - votesUsed !== 1 ? 's' : ''} to reach your daily goal
            </div>
          ) : streak > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-mono text-against-400">
              <Flame className="h-3.5 w-3.5 flex-shrink-0" />
              Vote today to keep your {streak}-day streak alive!
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
              <Circle className="h-3.5 w-3.5 flex-shrink-0 text-surface-400" />
              Cast your first vote today to start a streak
            </div>
          )}
        </div>
      </div>

      {!goalMet && (
        <div className="mt-4 pt-4 border-t border-surface-300">
          <Link
            href="/"
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'bg-for-600/20 border border-for-600/30 text-for-400',
              'text-xs font-mono font-medium',
              'hover:bg-for-600/30 transition-colors'
            )}
          >
            Go vote
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </motion.div>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-white',
  delay = 0,
}: {
  label: string
  value: number | string
  sub?: string
  icon: typeof TrendingUp
  color?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className={cn('text-3xl font-bold font-mono', color)}>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && <div className="text-xs text-surface-500">{sub}</div>}
    </motion.div>
  )
}

function VoteDNACard({
  blue,
  total,
}: {
  blue: number
  red: number
  total: number
}) {
  const bluePct = total > 0 ? Math.round((blue / total) * 100) : 50
  const redPct = 100 - bluePct

  const identity =
    bluePct >= 70
      ? 'Strong Supporter'
      : bluePct >= 55
      ? 'Leaning For'
      : bluePct >= 45
      ? 'True Centrist'
      : bluePct >= 30
      ? 'Leaning Against'
      : 'Strong Dissenter'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <Scale className="h-3.5 w-3.5" />
        Vote DNA
      </div>

      {/* Identity label */}
      <div className="mb-4">
        <span className="text-white font-bold text-lg">{identity}</span>
        <p className="text-xs text-surface-500 mt-0.5">
          Based on {total.toLocaleString()} votes cast
        </p>
      </div>

      {/* Gradient bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300 mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${bluePct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full"
        />
      </div>

      <div className="flex justify-between text-xs font-mono">
        <span className="text-for-400">
          FOR {bluePct}%
        </span>
        <span className="text-against-400">
          {redPct}% AGAINST
        </span>
      </div>
    </motion.div>
  )
}

function AccuracyCard({
  accuracy,
  resolved,
}: {
  accuracy: number | null
  resolved: number
}) {
  const tier =
    accuracy === null
      ? null
      : accuracy >= 75
      ? { label: 'Oracle', color: 'text-gold', ring: 'border-gold/50' }
      : accuracy >= 60
      ? { label: 'Sharp', color: 'text-emerald', ring: 'border-emerald/50' }
      : accuracy >= 50
      ? { label: 'Aligned', color: 'text-for-400', ring: 'border-for-500/50' }
      : { label: 'Contrarian', color: 'text-against-400', ring: 'border-against-500/50' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.2 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <Target className="h-3.5 w-3.5" />
        Vote Accuracy
      </div>

      {accuracy === null ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-surface-500 text-sm">
            Not enough resolved votes yet.
          </div>
          <p className="text-xs text-surface-600 mt-1">
            Accuracy unlocks after {Math.max(0, 5 - resolved)} more resolved topics.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Circle */}
          <div
            className={cn(
              'relative flex-shrink-0 h-20 w-20 rounded-full border-4 flex flex-col items-center justify-center',
              tier?.ring ?? 'border-surface-400'
            )}
          >
            <span className={cn('text-2xl font-bold font-mono', tier?.color)}>
              {accuracy}%
            </span>
          </div>

          <div>
            <div className={cn('text-xl font-bold', tier?.color)}>
              {tier?.label}
            </div>
            <p className="text-xs text-surface-500 mt-1">
              Correct on {Math.round((accuracy / 100) * resolved)} of {resolved} resolved topics
            </p>
            <p className="text-xs text-surface-600 mt-0.5">
              {accuracy >= 50
                ? 'Your intuition tracks with the majority.'
                : 'You think differently from the crowd.'}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  )
}

function CategoryBreakdown({
  categories,
}: {
  categories: Array<{ category: string; count: number; blue: number; red: number }>
}) {
  if (categories.length === 0) {
    return null
  }

  const max = Math.max(...categories.map((c) => c.count))

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.25 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
        <BarChart2 className="h-3.5 w-3.5" />
        Top Categories
      </div>

      <div className="space-y-3">
        {categories.map((cat, i) => {
          const bluePct = cat.count > 0 ? (cat.blue / cat.count) * 100 : 50
          const barWidth = max > 0 ? (cat.count / max) * 100 : 0

          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white font-medium">{cat.category}</span>
                <span className="text-xs font-mono text-surface-500">
                  {cat.count} votes
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, delay: 0.35 + i * 0.05, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-gradient-to-r from-for-600 to-for-400"
                    style={{ width: `${bluePct}%` }}
                  />
                  <div
                    className="absolute top-0 right-0 h-full bg-against-500"
                    style={{ width: `${100 - bluePct}%` }}
                  />
                </motion.div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-for-500 inline-block" />
          FOR
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-against-500 inline-block" />
          AGAINST
        </span>
      </div>
    </motion.div>
  )
}

function ActivityGrid({
  days,
}: {
  days: Array<{ date: string; count: number }>
}) {
  const max = Math.max(...days.map((d) => d.count), 1)

  function intensityClass(count: number): string {
    if (count === 0) return 'bg-surface-300'
    const pct = count / max
    if (pct <= 0.25) return 'bg-for-800'
    if (pct <= 0.5) return 'bg-for-700'
    if (pct <= 0.75) return 'bg-for-600'
    return 'bg-for-400'
  }

  // Build 4-week grid (7 cols × 4 rows)
  const weeks: Array<typeof days> = []
  for (let w = 0; w < 4; w++) {
    weeks.push(days.slice(w * 7, w * 7 + 7))
  }

  // Day labels
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.3 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
        <Flame className="h-3.5 w-3.5" />
        28-Day Activity
      </div>

      <div className="flex gap-1">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 mr-1">
          {dayLabels.map((d, i) => (
            <div
              key={i}
              className="h-6 w-4 flex items-center justify-center text-[9px] font-mono text-surface-500"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1 flex-1">
            {week.map((day, di) => (
              <motion.div
                key={day.date}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2, delay: 0.4 + wi * 0.05 + di * 0.01 }}
                title={`${day.date}: ${day.count} vote${day.count !== 1 ? 's' : ''}`}
                className={cn(
                  'h-6 rounded-sm transition-colors',
                  intensityClass(day.count)
                )}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4 text-[10px] font-mono text-surface-500">
        <span>Less</span>
        {['bg-surface-300', 'bg-for-800', 'bg-for-600', 'bg-for-400'].map(
          (cls, i) => (
            <span key={i} className={cn('h-3 w-3 rounded-sm', cls)} />
          )
        )}
        <span>More</span>
      </div>
    </motion.div>
  )
}

function MonthlyBars({
  months,
}: {
  months: Array<{ month: string; count: number }>
}) {
  const max = Math.max(...months.map((m) => m.count), 1)

  function shortMonth(ym: string) {
    const [year, month] = ym.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'short' })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.35 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
        <BarChart2 className="h-3.5 w-3.5" />
        6-Month Trend
      </div>

      <div className="flex items-end gap-2 h-24">
        {months.map((m, i) => {
          const height = max > 0 ? Math.max((m.count / max) * 100, m.count > 0 ? 8 : 0) : 0

          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.5, delay: 0.45 + i * 0.07, ease: 'easeOut' }}
                  className="w-full rounded-t-sm bg-for-600 hover:bg-for-500 transition-colors"
                  title={`${m.month}: ${m.count} votes`}
                />
              </div>
              <span className="text-[10px] font-mono text-surface-500">
                {shortMonth(m.month)}
              </span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Prediction history ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  archived: 'Archived',
  continued: 'Continued',
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function PredictionRow({ pred }: { pred: PredictionRecord }) {
  const isResolved = pred.resolved_at !== null
  const isPending = !isResolved

  // Outcome badge
  const outcome =
    isPending
      ? { label: 'Pending', color: 'text-surface-500', bg: 'bg-surface-300/50', icon: Clock }
      : pred.correct
      ? { label: 'Correct', color: 'text-emerald', bg: 'bg-emerald/10', icon: CheckCircle2 }
      : { label: 'Wrong', color: 'text-against-400', bg: 'bg-against-500/10', icon: XCircle }

  const OutcomeIcon = outcome.icon

  // Prediction label
  const predLabel = pred.predicted_law ? 'Will pass' : 'Will fail'
  const predColor = pred.predicted_law ? 'text-for-400' : 'text-against-400'

  return (
    <Link
      href={`/topic/${pred.topic_id}`}
      className="flex items-start gap-3 px-4 py-4 hover:bg-surface-200/50 transition-colors"
    >
      {/* Outcome indicator */}
      <div className={cn(
        'flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center',
        outcome.bg
      )}>
        <OutcomeIcon className={cn('h-3.5 w-3.5', outcome.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 line-clamp-2 mb-1.5">
          {pred.topic?.statement ?? 'Unknown topic'}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-surface-500">
          {/* Prediction */}
          <span className={cn('font-semibold', predColor)}>
            {predLabel} · {pred.confidence}% conf
          </span>
          {/* Topic status */}
          {pred.topic && (
            <span className={cn(
              pred.topic.status === 'law' ? 'text-gold' :
              pred.topic.status === 'failed' ? 'text-against-400' :
              'text-surface-500'
            )}>
              {STATUS_LABEL[pred.topic.status] ?? pred.topic.status}
            </span>
          )}
          {/* Brier score */}
          {pred.brier_score !== null && (
            <span title="Brier score (lower = better calibration)">
              Brier {pred.brier_score.toFixed(3)}
            </span>
          )}
          {/* Clout earned */}
          {pred.clout_earned > 0 && (
            <span className="text-gold">+{pred.clout_earned} clout</span>
          )}
          <span>{relativeTime(pred.created_at)}</span>
        </div>
      </div>

      {/* Outcome badge — right side */}
      <span className={cn(
        'flex-shrink-0 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full',
        outcome.bg, outcome.color
      )}>
        {outcome.label}
      </span>
    </Link>
  )
}

function PredictionHistorySection() {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch('/api/analytics/predictions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.predictions) {
          setPredictions(data.predictions as PredictionRecord[])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
          <Target className="h-3.5 w-3.5 text-purple" />
          My Predictions
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 animate-pulse">
              <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (predictions.length === 0) {
    return (
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
          <Target className="h-3.5 w-3.5 text-purple" />
          My Predictions
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-10 w-10 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center mb-3">
            <Target className="h-5 w-5 text-purple" />
          </div>
          <p className="text-sm text-surface-500">No predictions yet.</p>
          <p className="text-xs text-surface-600 mt-1">
            Open any active topic and stake a prediction to earn clout when it resolves.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
          >
            Browse topics
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    )
  }

  const SHOW_INITIAL = 5
  const visible = expanded ? predictions : predictions.slice(0, SHOW_INITIAL)
  const hasMore = predictions.length > SHOW_INITIAL

  // Summary stats
  const resolved = predictions.filter((p) => p.resolved_at !== null)
  const correct = resolved.filter((p) => p.correct === true)
  const pending = predictions.filter((p) => p.resolved_at === null)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.5 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-300">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
          <Target className="h-3.5 w-3.5 text-purple" />
          My Predictions
          <span className="text-surface-600">({predictions.length})</span>
        </div>
        {/* Mini stats */}
        <div className="flex items-center gap-3 text-[11px] font-mono">
          {pending.length > 0 && (
            <span className="text-surface-500">{pending.length} pending</span>
          )}
          {resolved.length > 0 && (
            <span className="text-emerald">
              {correct.length}/{resolved.length} correct
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-surface-300/60">
        {visible.map((pred) => (
          <PredictionRow key={pred.id} pred={pred} />
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-mono text-surface-500 hover:text-white transition-colors border-t border-surface-300/60"
        >
          {expanded ? 'Show less' : `Show all ${predictions.length} predictions`}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analytics')
        if (res.status === 401) {
          router.push('/login')
          return
        }
        if (!res.ok) throw new Error('Failed to load analytics')
        const json = await res.json()
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  const memberSince = data
    ? new Date(data.profile.member_since).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white font-mono">
              Your Analytics
            </h1>
            {memberSince && (
              <p className="text-xs text-surface-500 mt-0.5">
                Member since {memberSince}
              </p>
            )}
          </div>
          <Link
            href="/profile/me"
            className="ml-auto flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors"
          >
            Profile
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {loading && <AnalyticsSkeleton />}

        {!loading && data && (
          <div className="space-y-4">
            {/* Today's progress — streak + daily vote goal */}
            {data.today && (
              <TodayProgressCard
                votesUsed={data.today.votes_used}
                dailyLimit={data.today.daily_limit}
                streak={data.profile.vote_streak}
              />
            )}

            {/* Hero stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Clout"
                value={data.profile.clout}
                sub="influence score"
                icon={TrendingUp}
                color="text-gold"
                delay={0}
              />
              <StatCard
                label="Total Votes"
                value={data.profile.total_votes}
                sub="across all topics"
                icon={Vote}
                color="text-for-400"
                delay={0.05}
              />
              <StatCard
                label="Streak"
                value={data.profile.vote_streak}
                sub="day voting streak"
                icon={Flame}
                color="text-against-400"
                delay={0.1}
              />
              <StatCard
                label="Arguments"
                value={data.profile.total_arguments}
                sub="posted in debates"
                icon={MessageSquare}
                color="text-purple"
                delay={0.15}
              />
            </div>

            {/* Vote DNA + Accuracy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <VoteDNACard
                blue={data.profile.blue_vote_count}
                red={data.profile.red_vote_count}
                total={data.profile.total_votes}
              />
              <AccuracyCard
                accuracy={data.accuracy}
                resolved={data.resolved_votes}
              />
            </div>

            {/* Activity grid + Monthly bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ActivityGrid days={data.dailyActivity} />
              <MonthlyBars months={data.monthlyActivity} />
            </div>

            {/* Category breakdown */}
            {data.topCategories.length > 0 && (
              <CategoryBreakdown categories={data.topCategories} />
            )}

            {/* Reputation meter */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.4 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                <Award className="h-3.5 w-3.5" />
                Reputation Score
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-surface-600">
                      {data.profile.reputation_score.toLocaleString()} pts
                    </span>
                    <span className="text-xs text-surface-500">/ 10,000</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(
                          (data.profile.reputation_score / 10000) * 100,
                          100
                        )}%`,
                      }}
                      transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald to-emerald/60"
                    />
                  </div>
                </div>
                <Zap className="h-5 w-5 text-gold flex-shrink-0" />
              </div>
              <p className="text-xs text-surface-500 mt-3">
                Reputation increases with accurate votes, quality arguments, and consistent participation.
              </p>
            </motion.div>

            {/* Individual predictions history */}
            <PredictionHistorySection />

            {/* Prediction market stats */}
            {data.predictions && data.predictions.total > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.45 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                  <Target className="h-3.5 w-3.5 text-purple" />
                  Prediction Market
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                      Predictions
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">
                      {data.predictions.total}
                    </div>
                    <div className="text-[10px] text-surface-500 mt-0.5">
                      {data.predictions.resolved} resolved
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                      Accuracy
                    </div>
                    <div className={cn(
                      'text-2xl font-mono font-bold',
                      data.predictions.accuracy !== null
                        ? data.predictions.accuracy >= 70 ? 'text-emerald'
                          : data.predictions.accuracy >= 55 ? 'text-for-400'
                          : 'text-gold'
                        : 'text-surface-500'
                    )}>
                      {data.predictions.accuracy !== null ? `${data.predictions.accuracy}%` : '—'}
                    </div>
                    <div className="text-[10px] text-surface-500 mt-0.5">
                      {data.predictions.correct} correct
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                      Avg Brier
                    </div>
                    <div className={cn(
                      'text-2xl font-mono font-bold',
                      data.predictions.avg_brier !== null
                        ? data.predictions.avg_brier <= 0.1 ? 'text-emerald'
                          : data.predictions.avg_brier <= 0.2 ? 'text-for-400'
                          : 'text-gold'
                        : 'text-surface-500'
                    )}>
                      {data.predictions.avg_brier !== null ? data.predictions.avg_brier.toFixed(3) : '—'}
                    </div>
                    <div className="text-[10px] text-surface-500 mt-0.5">lower is sharper</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">
                      Clout Earned
                    </div>
                    <div className="text-2xl font-mono font-bold text-gold">
                      +{data.predictions.clout_earned.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-surface-500 mt-0.5">from predictions</div>
                  </div>
                </div>
                <p className="text-xs text-surface-500 mt-4 border-t border-surface-300 pt-3">
                  Brier score measures calibration: 0.0 = perfect, 1.0 = maximally wrong. Sharp predictors earn clout bonuses when topics resolve.
                </p>
              </motion.div>
            )}
          </div>
        )}

        {!loading && !data && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 flex items-center justify-center mb-4">
              <BarChart2 className="h-5 w-5 text-surface-500" />
            </div>
            <p className="text-surface-500 text-sm">No data yet.</p>
            <p className="text-surface-600 text-xs mt-1">
              Start voting to unlock your analytics.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-for-600 hover:bg-for-700 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Go to Feed
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
