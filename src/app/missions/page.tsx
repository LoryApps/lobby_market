'use client'

/**
 * /missions — Civic Daily Missions
 *
 * Three fresh civic challenges each day. Complete them to earn Clout,
 * protect your streak, and stay engaged with the Lobby's most urgent debates.
 * Missions rotate by day of week; progress is calculated in real-time from
 * your actual votes, arguments, and actions.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  Coins,
  Compass,
  Flame,
  Lock,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DailyMission, DailyMissionsResponse, MissionIcon } from '@/app/api/missions/daily/route'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<MissionIcon, React.ComponentType<{ className?: string }>> = {
  vote: Vote,
  argument: MessageSquare,
  compass: Compass,
  scale: Scale,
  book: BookOpen,
  thumbsup: ThumbsUp,
  flame: Flame,
  star: Star,
}

// ─── Category colours by completion state ─────────────────────────────────────

function missionStyle(mission: DailyMission) {
  if (mission.completed) {
    return {
      border: 'border-emerald/40',
      bg: 'bg-emerald/5',
      iconBg: 'bg-emerald/15',
      iconColor: 'text-emerald',
      progressBar: 'bg-emerald',
      progressTrack: 'bg-emerald/20',
      titleColor: 'text-emerald',
    }
  }
  const pct = mission.target > 0 ? mission.progress / mission.target : 0
  if (pct >= 0.5) {
    return {
      border: 'border-for-500/40',
      bg: 'bg-for-500/5',
      iconBg: 'bg-for-500/15',
      iconColor: 'text-for-400',
      progressBar: 'bg-for-500',
      progressTrack: 'bg-for-500/20',
      titleColor: 'text-white',
    }
  }
  return {
    border: 'border-surface-300',
    bg: 'bg-surface-100',
    iconBg: 'bg-surface-200',
    iconColor: 'text-surface-500',
    progressBar: 'bg-for-600',
    progressTrack: 'bg-surface-300/40',
    titleColor: 'text-white',
  }
}

// ─── Countdown to midnight UTC ────────────────────────────────────────────────

function useCountdown(targetIso: string) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function tick() {
      const diff = new Date(targetIso).getTime() - Date.now()
      if (diff <= 0) { setLabel('00:00:00'); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setLabel(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      )
    }
    tick()
    const timer = setInterval(tick, 1_000)
    return () => clearInterval(timer)
  }, [targetIso])

  return label
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function MissionProgressBar({
  progress,
  target,
  trackClass,
  fillClass,
}: {
  progress: number
  target: number
  trackClass: string
  fillClass: string
}) {
  const pct = target > 0 ? Math.min(100, (progress / target) * 100) : 0
  return (
    <div className={cn('h-1.5 rounded-full overflow-hidden', trackClass)} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={target}>
      <motion.div
        className={cn('h-full rounded-full', fillClass)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Single mission card ──────────────────────────────────────────────────────

function MissionCard({ mission, index }: { mission: DailyMission; index: number }) {
  const style = missionStyle(mission)
  const Icon = ICON_MAP[mission.icon] ?? Vote
  const pct = mission.target > 0 ? Math.min(100, Math.round((mission.progress / mission.target) * 100)) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={cn(
        'relative rounded-2xl border p-5 transition-all',
        style.border, style.bg,
      )}
    >
      {/* Completed ribbon */}
      {mission.completed && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald/15 border border-emerald/30">
          <CheckCircle2 className="h-3 w-3 text-emerald" aria-hidden />
          <span className="text-[11px] font-semibold text-emerald">Done</span>
        </div>
      )}

      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={cn('flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center', style.iconBg)}>
          <Icon className={cn('h-5 w-5', style.iconColor)} aria-hidden />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className={cn('font-semibold text-sm', style.titleColor)}>{mission.title}</h3>
            <span className="text-xs text-gold font-semibold">+{mission.reward_clout} clout</span>
          </div>
          <p className="text-xs text-surface-500 mt-0.5 leading-relaxed">{mission.description}</p>

          {/* Progress */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-surface-500">
                {mission.progress} / {mission.target}
              </span>
              <span className="text-[11px] text-surface-500">{pct}%</span>
            </div>
            <MissionProgressBar
              progress={mission.progress}
              target={mission.target}
              trackClass={style.progressTrack}
              fillClass={mission.completed ? 'bg-emerald' : style.progressBar}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Quick-action button ──────────────────────────────────────────────────────

interface QuickAction {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Vote Now',    href: '/',           icon: Vote,         color: 'text-for-400' },
  { label: 'Write',       href: '/',           icon: MessageSquare, color: 'text-purple' },
  { label: 'Voting Phase', href: '/senate',    icon: Scale,         color: 'text-gold' },
  { label: 'Proposals',  href: '/surge',       icon: Zap,           color: 'text-emerald' },
]

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MissionsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 flex items-start gap-4">
          <Skeleton className="h-11 w-11 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <div className="mt-3 space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-2 w-12" />
                <Skeleton className="h-2 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function MissionsPage() {
  const [data, setData] = useState<DailyMissionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const countdown = useCountdown(data?.next_reset ?? new Date(Date.now() + 86_400_000).toISOString())

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/missions/daily', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Derived values ──────────────────────────────────────────────────────────
  const completedCount = data?.completed_count ?? 0
  const totalMissions = data?.missions.length ?? 3
  const allDone = data?.all_completed ?? false
  const totalClout = data?.total_clout ?? 0
  const streak = data?.vote_streak ?? 0
  const isAuth = data?.is_authenticated ?? false

  const headerColor =
    allDone ? 'text-emerald' :
    completedCount > 0 ? 'text-for-300' :
    'text-white'

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 py-8 pb-28 md:pb-12">
        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/"
              className="text-surface-500 hover:text-white transition-colors"
              aria-label="Back to home"
            >
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
            </Link>
            <div>
              <p className="text-xs text-surface-500 font-medium uppercase tracking-wider">{dayName}&apos;s Missions</p>
              <h1 className={cn('text-2xl font-bold tracking-tight', headerColor)}>
                {allDone ? 'All Missions Complete!' : 'Daily Civic Missions'}
              </h1>
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {/* Completion */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle2 className={cn('h-4 w-4', allDone ? 'text-emerald' : 'text-surface-500')} aria-hidden />
                <span className={cn('text-lg font-bold tabular-nums', allDone ? 'text-emerald' : 'text-white')}>
                  {completedCount}/{totalMissions}
                </span>
              </div>
              <p className="text-[11px] text-surface-500">Done</p>
            </div>

            {/* Clout to earn */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Coins className="h-4 w-4 text-gold" aria-hidden />
                <span className="text-lg font-bold tabular-nums text-gold">
                  {allDone ? totalClout : totalClout}
                </span>
              </div>
              <p className="text-[11px] text-surface-500">Clout</p>
            </div>

            {/* Streak */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Flame className={cn('h-4 w-4', streak > 0 ? 'text-against-400' : 'text-surface-500')} aria-hidden />
                <span className={cn('text-lg font-bold tabular-nums', streak > 0 ? 'text-against-400' : 'text-surface-500')}>
                  {isAuth ? <AnimatedNumber value={streak} /> : '—'}
                </span>
              </div>
              <p className="text-[11px] text-surface-500">Streak</p>
            </div>
          </div>
        </div>

        {/* ── All-done banner ── */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6 rounded-2xl bg-emerald/10 border border-emerald/30 p-4 flex items-center gap-3"
            >
              <Trophy className="h-6 w-6 text-emerald flex-shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-emerald">All missions complete — bonus clout earned!</p>
                <p className="text-xs text-emerald/70 mt-0.5">Next missions reset in {countdown}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Not-logged-in notice ── */}
        {!isAuth && !loading && (
          <div className="mb-6 rounded-2xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-surface-500 flex-shrink-0" aria-hidden />
            <div>
              <p className="text-sm text-white font-medium">Sign in to track your progress</p>
              <p className="text-xs text-surface-500 mt-0.5">Create a free account to earn clout and protect your streak.</p>
            </div>
            <Link
              href="/login"
              className="ml-auto flex-shrink-0 px-3 py-1.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-semibold transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* ── Missions list ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Today&apos;s Challenges</h2>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh missions"
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} aria-hidden />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <MissionsSkeleton />
          ) : data?.missions.length ? (
            <div className="space-y-3">
              {data.missions.map((mission, i) => (
                <MissionCard key={mission.id} mission={mission} index={i} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-surface-500 text-sm">
              No missions available. Check back tomorrow.
            </div>
          )}
        </div>

        {/* ── Bonus completion badge ── */}
        {!allDone && data && (
          <div className="mb-6 rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-gold flex-shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-white">Complete all 3 for a bonus!</p>
                <p className="text-xs text-surface-500 mt-0.5">
                  Finish every mission today to earn the full {totalClout} clout reward.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', action.color)} aria-hidden />
                  <span className="text-sm text-surface-400 group-hover:text-white transition-colors font-medium">
                    {action.label}
                  </span>
                  <ArrowRight className="h-3 w-3 text-surface-600 ml-auto group-hover:text-surface-400 transition-colors" aria-hidden />
                </Link>
              )
            })}
          </div>
        </div>

        {/* ── Reset timer ── */}
        {data && (
          <div className="text-center">
            <p className="text-xs text-surface-600">
              New missions in{' '}
              <span className="font-mono text-surface-500 tabular-nums">{countdown}</span>
            </p>
          </div>
        )}

        {/* ── Related ── */}
        <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-3 justify-center">
          {[
            { href: '/achievements', icon: Award, label: 'Achievements' },
            { href: '/streaks', icon: Flame, label: 'Streaks' },
            { href: '/skill-tree', icon: BarChart2, label: 'Skill Tree' },
            { href: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-300 hover:border-surface-400 text-surface-500 hover:text-white transition-all text-xs font-medium"
              >
                <Icon className="h-3 w-3" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
