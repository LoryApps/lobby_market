'use client'

/**
 * /gym — The Argument Gym
 *
 * Three daily training exercises to sharpen civic argumentation skills:
 *   - Steelman Challenge: argue the underdog position convincingly
 *   - Rebuttal Room: counter the top argument on a contested debate
 *   - Cold Case: find the argument that could revive a dead debate
 *
 * Progress is tracked per-day in localStorage. Submitting an argument on
 * any of the linked topics counts as completing that exercise.
 *
 * Distinct from:
 *   /missions        — completion-tracked civic tasks (vote, argue, etc.)
 *   /workshop        — guided 4-step argument builder
 *   /argument-battle — bracket tournament for existing arguments
 *   /challenge       — daily quorum voting challenge
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Coins,
  Dumbbell,
  ExternalLink,
  Flame,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GymResponse, GymExercise } from '@/app/api/gym/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const GYM_PROGRESS_KEY = 'lm_gym_progress'

interface GymProgress {
  date: string
  completed: string[] // exercise types completed
}

function getTodayProgress(): GymProgress {
  try {
    const raw = localStorage.getItem(GYM_PROGRESS_KEY)
    if (!raw) return { date: '', completed: [] }
    return JSON.parse(raw) as GymProgress
  } catch {
    return { date: '', completed: [] }
  }
}

function markComplete(exerciseType: string, date: string) {
  try {
    const progress = getTodayProgress()
    if (progress.date !== date) {
      localStorage.setItem(GYM_PROGRESS_KEY, JSON.stringify({ date, completed: [exerciseType] }))
    } else {
      const updated = Array.from(new Set([...progress.completed, exerciseType]))
      localStorage.setItem(GYM_PROGRESS_KEY, JSON.stringify({ date, completed: updated }))
    }
  } catch {
    // localStorage may be unavailable
  }
}

// ─── Exercise metadata ────────────────────────────────────────────────────────

const EXERCISE_META: Record<
  GymExercise['type'],
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    borderColor: string
    bgColor: string
    badgeVariant: 'proposed' | 'active' | 'law' | 'failed'
    label: string
    difficulty: string
    tip: string
  }
> = {
  steelman: {
    icon: Shield,
    color: 'text-for-400',
    borderColor: 'border-for-600/40',
    bgColor: 'bg-for-950/30',
    badgeVariant: 'active',
    label: 'Steelman',
    difficulty: 'Hard',
    tip: 'Steel-manning means making the strongest possible case for a position — even one you oppose. The goal is intellectual honesty, not winning.',
  },
  rebuttal: {
    icon: Zap,
    color: 'text-against-400',
    borderColor: 'border-against-600/40',
    bgColor: 'bg-against-950/30',
    badgeVariant: 'proposed',
    label: 'Rebuttal',
    difficulty: 'Medium',
    tip: 'A great rebuttal doesn\'t just disagree — it shows exactly where the original argument fails and offers something stronger in its place.',
  },
  cold_case: {
    icon: Flame,
    color: 'text-gold',
    borderColor: 'border-gold/40',
    bgColor: 'bg-amber-950/20',
    badgeVariant: 'failed',
    label: 'Cold Case',
    difficulty: 'Expert',
    tip: 'Reviving a dead debate takes more than restating old points. Find the angle nobody tried, the evidence nobody cited, the framing nobody considered.',
  },
}

// ─── Status badges for topics ─────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ExerciseSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/60 bg-surface-200/60 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  )
}

// ─── Target argument card ─────────────────────────────────────────────────────

function TargetArgumentCard({ arg }: { arg: NonNullable<GymExercise['target_argument']> }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-sm',
        arg.side === 'blue'
          ? 'bg-for-950/40 border-for-700/50'
          : 'bg-against-950/40 border-against-700/50',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {arg.side === 'blue' ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'font-mono text-[10px] font-bold uppercase tracking-wider',
            arg.side === 'blue' ? 'text-for-400' : 'text-against-400',
          )}
        >
          {arg.side === 'blue' ? 'FOR' : 'AGAINST'} · {arg.upvotes} upvotes
        </span>
        <span className="text-surface-500 text-[10px] ml-auto">by @{arg.author_username}</span>
      </div>
      <p className="text-surface-200 leading-relaxed line-clamp-4">{arg.content}</p>
    </div>
  )
}

// ─── Single exercise card ─────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  isComplete,
  onStart,
}: {
  exercise: GymExercise
  isComplete: boolean
  onStart: (type: GymExercise['type']) => void
}) {
  const meta = EXERCISE_META[exercise.type]
  const Icon = meta.icon
  const forPct = Math.round(exercise.topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-4 transition-colors',
        isComplete
          ? 'border-emerald-700/50 bg-emerald-950/20'
          : `${meta.borderColor} ${meta.bgColor}`,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border',
            isComplete
              ? 'bg-emerald-900/40 border-emerald-700/50'
              : `bg-surface-200/50 ${meta.borderColor}`,
          )}
        >
          {isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : (
            <Icon className={cn('h-5 w-5', meta.color)} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-white">{exercise.title}</h3>
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md border',
                isComplete
                  ? 'text-emerald-400 border-emerald-700/50 bg-emerald-900/30'
                  : `${meta.color} border-current/30 bg-surface-300/30`,
              )}
            >
              {isComplete ? 'COMPLETE' : meta.difficulty}
            </span>
          </div>
          <p className="text-xs text-surface-400 mt-0.5">{exercise.instruction}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 text-[11px] font-mono text-gold">
          <Coins className="h-3 w-3" />
          <span>+{exercise.clout_reward}</span>
        </div>
      </div>

      {/* Challenge description */}
      <p className="text-xs text-surface-300 leading-relaxed">{exercise.challenge}</p>

      {/* Target argument for rebuttal */}
      {exercise.target_argument && (
        <div>
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">
            Argument to counter:
          </p>
          <TargetArgumentCard arg={exercise.target_argument} />
        </div>
      )}

      {/* Topic card */}
      <div className="rounded-xl border border-surface-300/60 bg-surface-100/50 p-3.5">
        <div className="flex items-start gap-2 mb-2.5">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white leading-snug line-clamp-2">
              {exercise.topic.statement}
            </p>
            {exercise.topic.category && (
              <p className="text-[11px] text-surface-500 mt-0.5">{exercise.topic.category}</p>
            )}
          </div>
          <Badge
            variant={STATUS_BADGE[exercise.topic.status] ?? 'proposed'}
            size="sm"
            className="flex-shrink-0"
          >
            {exercise.topic.status}
          </Badge>
        </div>

        {/* Vote split bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">FOR {forPct}%</span>
            <span className="text-against-400">{againstPct}% AGAINST</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-for-500 to-for-400 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <p className="text-[10px] text-surface-500">
            {exercise.topic.total_votes.toLocaleString()} votes
          </p>
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2 rounded-xl bg-surface-200/40 border border-surface-300/50 px-3 py-2.5">
        <BookOpen className="h-3.5 w-3.5 text-surface-400 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-surface-400 leading-relaxed">{meta.tip}</p>
      </div>

      {/* CTA */}
      {isComplete ? (
        <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-900/30 border border-emerald-700/50 py-3 text-sm text-emerald-400 font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          Exercise complete
        </div>
      ) : (
        <Link
          href={`/topic/${exercise.topic.id}/argue?side=${exercise.assigned_side}&gym=1`}
          onClick={() => onStart(exercise.type)}
          className={cn(
            'flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
            'border border-transparent',
            exercise.type === 'steelman'
              ? 'bg-for-600 hover:bg-for-500 text-white'
              : exercise.type === 'rebuttal'
                ? 'bg-against-600 hover:bg-against-500 text-white'
                : 'bg-amber-700 hover:bg-amber-600 text-white',
          )}
        >
          Argue {exercise.assigned_side === 'blue' ? 'FOR' : 'AGAINST'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </motion.div>
  )
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ completed, total }: { completed: number; total: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = total > 0 ? (completed / total) * circumference : 0

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg className="rotate-[-90deg]" width="96" height="96" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="6"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={completed === total && total > 0 ? '#10b981' : '#f59e0b'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{completed}</span>
        <span className="text-[10px] text-surface-400">of {total}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GymClient() {
  const [data, setData] = useState<GymResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [completed, setCompleted] = useState<Set<string>>(new Set())

  const fetchGym = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/gym')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = (await res.json()) as GymResponse
      setData(json)

      // Load progress from localStorage
      const progress = getTodayProgress()
      if (progress.date === json.date) {
        setCompleted(new Set(progress.completed))
      } else {
        setCompleted(new Set())
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGym()
  }, [fetchGym])

  function handleStart(type: GymExercise['type']) {
    if (!data) return
    markComplete(type, data.date)
    setCompleted((prev) => new Set([...prev, type]))
  }

  const completedCount = completed.size
  const totalCount = data?.exercises.length ?? 3
  const allDone = completedCount === totalCount && totalCount > 0
  const totalClout = data?.exercises.reduce((sum, ex) => sum + ex.clout_reward, 0) ?? 0
  const earnedClout = data?.exercises
    .filter((ex) => completed.has(ex.type))
    .reduce((sum, ex) => sum + ex.clout_reward, 0) ?? 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24 pt-14">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* Hero banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-amber-950/60 via-surface-200/80 to-surface-200/60 p-6"
          >
            {/* Background glow */}
            <div className="absolute inset-0 bg-gradient-radial from-gold/5 via-transparent to-transparent pointer-events-none" />

            <div className="relative flex items-center gap-5">
              <ProgressRing completed={completedCount} total={totalCount} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Dumbbell className="h-4 w-4 text-gold" />
                  <h1 className="text-lg font-bold text-white">The Argument Gym</h1>
                </div>
                <p className="text-sm text-surface-300 leading-snug">
                  Three daily exercises to sharpen your civic argumentation skills. Complete all
                  three to earn Clout and improve your debate quality score.
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-xs text-gold font-mono">
                    <Coins className="h-3.5 w-3.5" />
                    <span>
                      {earnedClout}/{totalClout} Clout
                    </span>
                  </div>
                  {allDone && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <Trophy className="h-3.5 w-3.5" />
                      All exercises complete!
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Date badge */}
          {data && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-surface-300/40" />
              <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider px-2">
                {new Date(data.date + 'T00:00:00Z').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })}
              </span>
              <div className="h-px flex-1 bg-surface-300/40" />
            </div>
          )}

          {/* Exercises */}
          {loading && (
            <div className="space-y-4">
              <ExerciseSkeleton />
              <ExerciseSkeleton />
              <ExerciseSkeleton />
            </div>
          )}

          {!loading && error && (
            <EmptyState
              icon={Scale}
              title="Gym closed today"
              description="Couldn't load today's exercises. Try refreshing."
              action={
                <button
                  onClick={fetchGym}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-300 text-sm text-white hover:bg-surface-400 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              }
            />
          )}

          {!loading && !error && data && (
            <div className="space-y-4">
              {data.exercises.map((exercise) => (
                <ExerciseCard
                  key={exercise.type}
                  exercise={exercise}
                  isComplete={completed.has(exercise.type)}
                  onStart={handleStart}
                />
              ))}
            </div>
          )}

          {/* Info section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-surface-300/60 bg-surface-200/60 p-5 space-y-4"
          >
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Target className="h-4 w-4 text-purple" />
              How the Gym works
            </h2>
            <div className="space-y-3 text-xs text-surface-300 leading-relaxed">
              <div className="flex gap-3">
                <Shield className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-semibold">Steelman Challenge</span> — Argue for
                  the position you might normally oppose. The goal is intellectual honesty and
                  seeing the other side clearly.
                </div>
              </div>
              <div className="flex gap-3">
                <Zap className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-semibold">Rebuttal Room</span> — Counter a
                  top-rated argument with precision. Show exactly where it fails and offer a
                  stronger alternative.
                </div>
              </div>
              <div className="flex gap-3">
                <Flame className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-white font-semibold">Cold Case</span> — Revive a dead
                  debate or find a fresh angle on a stagnant one. The hardest exercise, the highest
                  reward.
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-surface-300/50 flex items-center justify-between text-xs text-surface-500">
              <span>Exercises rotate daily at midnight UTC</span>
              <Link
                href="/workshop"
                className="flex items-center gap-1 text-purple hover:text-purple/80 transition-colors"
              >
                Argument Workshop
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>

          {/* Related links */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/argument-battle', icon: Trophy, label: 'Argument Battle', sub: 'Daily bracket' },
              { href: '/top-arguments', icon: Award, label: 'Top Arguments', sub: 'Platform best' },
              { href: '/missions', icon: Target, label: 'Daily Missions', sub: '3 civic tasks' },
              { href: '/workshop', icon: Sparkles, label: 'Workshop', sub: 'Build better arguments' },
            ].map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-xl border border-surface-300/60 bg-surface-200/60 p-3.5 hover:border-surface-400/60 hover:bg-surface-200/80 transition-colors"
                >
                  <Icon className="h-4 w-4 text-surface-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">{link.label}</p>
                    <p className="text-[11px] text-surface-500">{link.sub}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-surface-500 ml-auto flex-shrink-0" />
                </Link>
              )
            })}
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
