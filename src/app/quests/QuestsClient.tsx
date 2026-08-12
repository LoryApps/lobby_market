'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Coins,
  Flame,
  Globe,
  Loader2,
  Lock,
  MessageSquare,
  Network,
  RefreshCw,
  Shield,
  Star,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { Quest, QuestTrack, QuestTrackSummary, QuestsResponse } from '@/app/api/quests/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACK_CONFIG: Record<
  QuestTrack,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
    ring: string
    gradient: string
  }
> = {
  voter: {
    label: 'Voter',
    icon: Vote,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/40',
    gradient: 'from-for-700/60 to-for-900/60',
  },
  debater: {
    label: 'Debater',
    icon: MessageSquare,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/40',
    gradient: 'from-against-700/60 to-against-900/60',
  },
  scholar: {
    label: 'Scholar',
    icon: BookOpen,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/40',
    gradient: 'from-yellow-900/60 to-surface-200/60',
  },
  builder: {
    label: 'Builder',
    icon: Network,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/40',
    gradient: 'from-emerald/20 to-surface-200/60',
  },
}

const TIER_CONFIG: Record<
  Quest['tier'],
  { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  bronze: {
    label: 'Bronze',
    color: 'text-amber-600',
    bg: 'bg-amber-900/20',
    border: 'border-amber-700/40',
    icon: Shield,
  },
  silver: {
    label: 'Silver',
    color: 'text-surface-600',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/40',
    icon: Star,
  },
  gold: {
    label: 'Gold',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    icon: Trophy,
  },
  legendary: {
    label: 'Legendary',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    icon: Zap,
  },
}

// ─── Level progress ───────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS = [0, 1, 3, 6, 10, 15, 20, 25, Infinity]
const LEVEL_NAMES = [
  'Newcomer', 'Civic Seedling', 'Active Voice', 'Engaged Citizen',
  'Civic Advocate', 'Community Pillar', 'Civic Elder', 'Lobby Legend',
]

function getLevelProgress(completedCount: number, level: number) {
  const thisFloor = LEVEL_THRESHOLDS[level - 1] ?? 0
  const nextCeiling = LEVEL_THRESHOLDS[level] ?? completedCount
  if (nextCeiling === Infinity) return { pct: 100, floor: thisFloor, ceiling: null }
  const pct = Math.min(
    100,
    Math.round(((completedCount - thisFloor) / (nextCeiling - thisFloor)) * 100),
  )
  return { pct, floor: thisFloor, ceiling: nextCeiling }
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct, className, color = 'bg-for-500' }: { pct: number; className?: string; color?: string }) {
  return (
    <div className={cn('h-1.5 bg-surface-300/50 rounded-full overflow-hidden', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn('h-full rounded-full', color)}
      />
    </div>
  )
}

// ─── Track card ───────────────────────────────────────────────────────────────

function TrackCard({
  summary,
  isActive,
  onClick,
}: {
  summary: QuestTrackSummary
  isActive: boolean
  onClick: () => void
}) {
  const cfg = TRACK_CONFIG[summary.track]
  const Icon = cfg.icon
  const pct = summary.total === 0 ? 0 : Math.round((summary.completed / summary.total) * 100)

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col gap-2 p-3.5 rounded-2xl border text-left transition-all duration-200',
        'hover:border-surface-400/60',
        isActive
          ? cn('border-surface-400/60 ring-2', cfg.ring, 'bg-surface-200/80')
          : 'border-surface-300/40 bg-surface-200/30',
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn('flex items-center justify-center w-8 h-8 rounded-xl', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        {isActive && (
          <div className={cn('w-1.5 h-1.5 rounded-full', cfg.color.replace('text-', 'bg-'))} />
        )}
      </div>
      <div>
        <p className="text-xs font-bold text-white">{cfg.label}</p>
        <p className="text-[10px] text-surface-500 mt-0.5">
          {summary.completed}/{summary.total} complete
        </p>
      </div>
      <ProgressBar
        pct={pct}
        color={cfg.color.replace('text-', 'bg-')}
        className="mt-0.5"
      />
    </button>
  )
}

// ─── Quest card ───────────────────────────────────────────────────────────────

function QuestCard({ quest, trackColor }: { quest: Quest; trackColor: string }) {
  const tier = TIER_CONFIG[quest.tier]
  const TierIcon = tier.icon
  const pct = quest.target === 0 ? 0 : Math.round((quest.progress / quest.target) * 100)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative flex gap-3 p-4 rounded-xl border transition-colors',
        quest.completed
          ? 'border-emerald/30 bg-emerald/5'
          : quest.unlocked
            ? 'border-surface-300/50 bg-surface-200/40 hover:border-surface-400/60'
            : 'border-surface-300/20 bg-surface-200/15 opacity-60',
      )}
    >
      {/* Tier badge */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl border',
          quest.completed ? 'bg-emerald/15 border-emerald/30' : cn(tier.bg, tier.border),
        )}
      >
        {quest.completed ? (
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald" />
        ) : !quest.unlocked ? (
          <Lock className="h-4 w-4 text-surface-500" />
        ) : (
          <TierIcon className={cn('h-4 w-4', tier.color)} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-sm font-semibold leading-snug',
                quest.completed
                  ? 'text-emerald'
                  : quest.unlocked
                    ? 'text-white'
                    : 'text-surface-500',
              )}
            >
              {quest.title}
            </p>
            <p className="text-[11px] text-surface-500 mt-0.5 leading-relaxed">
              {quest.description}
            </p>
          </div>
          {/* Reward */}
          <div
            className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold',
              quest.completed
                ? 'border-emerald/30 bg-emerald/10 text-emerald'
                : 'border-gold/30 bg-gold/10 text-gold',
            )}
          >
            <Coins className="h-3 w-3" />
            {quest.reward_clout}
          </div>
        </div>

        {/* Progress */}
        {quest.unlocked && !quest.completed && (
          <div className="mt-2.5 space-y-1">
            <ProgressBar
              pct={pct}
              color={trackColor.replace('text-', 'bg-')}
            />
            <p className="text-[10px] text-surface-600">
              {quest.progress.toLocaleString()} / {quest.target.toLocaleString()}
            </p>
          </div>
        )}

        {/* Completed checkmark */}
        {quest.completed && (
          <p className="mt-1 text-[11px] text-emerald/70 font-medium">Completed</p>
        )}

        {/* Locked hint */}
        {!quest.unlocked && (
          <p className="mt-1 text-[11px] text-surface-600">Complete previous quest to unlock</p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Level ring ───────────────────────────────────────────────────────────────

function LevelRing({ level, completedCount }: { level: number; completedCount: number }) {
  const { pct, ceiling } = getLevelProgress(completedCount, level)
  const name = LEVEL_NAMES[level - 1] ?? 'Lobby Legend'
  const nextName = level < LEVEL_NAMES.length ? LEVEL_NAMES[level] : null
  const r = 38
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <svg width="96" height="96" className="-rotate-90">
          <circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            strokeWidth="6"
            className="stroke-surface-300/40"
          />
          <motion.circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-for-500"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{level}</span>
        </div>
      </div>
      <div>
        <p className="text-base font-bold text-white">{name}</p>
        <p className="text-xs text-surface-500 mt-0.5">
          {pct}% to {nextName ?? 'Max level'}
        </p>
        {ceiling && (
          <p className="text-[11px] text-surface-600 mt-0.5">
            {completedCount} / {ceiling} quests
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function QuestSkeleton() {
  return (
    <div className="flex gap-3 p-4 rounded-xl border border-surface-300/30 bg-surface-200/20">
      <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-40 rounded" />
        <Skeleton className="h-2.5 w-56 rounded" />
        <Skeleton className="h-1.5 w-full rounded-full mt-3" />
      </div>
      <Skeleton className="h-6 w-14 rounded-full flex-shrink-0" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuestsClient() {
  const [data, setData] = useState<QuestsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTrack, setActiveTrack] = useState<QuestTrack>('voter')
  const [showCompleted, setShowCompleted] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/quests', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as QuestsResponse
        setData(json)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const trackCfg = TRACK_CONFIG[activeTrack]
  const trackQuests = data?.quests.filter((q) => q.track === activeTrack) ?? []
  const visibleQuests = showCompleted
    ? trackQuests
    : trackQuests.filter((q) => !q.completed || trackQuests.filter((x) => !x.completed).length === 0)

  const activeTrackSummary = data?.tracks.find((t) => t.track === activeTrack)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Civic Quests</h1>
              <p className="text-xs text-surface-500 mt-0.5">
                Complete quests. Earn Clout. Level up your civic profile.
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh quests"
              className="p-2 rounded-xl bg-surface-200/60 border border-surface-300/40 text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Overall level card */}
          {loading ? (
            <Skeleton className="h-28 w-full rounded-2xl" />
          ) : data ? (
            <div className="relative overflow-hidden rounded-2xl border border-surface-300/40 bg-surface-200/50 p-5">
              <div className="absolute inset-0 bg-gradient-to-br from-for-700/10 to-purple/5 pointer-events-none" />
              <div className="relative flex items-center justify-between gap-4">
                <LevelRing
                  level={data.overall_level}
                  completedCount={data.total_completed}
                />
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1.5 mb-1">
                    <Coins className="h-4 w-4 text-gold" />
                    <span className="text-lg font-black text-gold">
                      <AnimatedNumber value={data.total_clout_earned} />
                    </span>
                  </div>
                  <p className="text-[11px] text-surface-500">Clout earned from quests</p>
                  <p className="text-[11px] text-surface-600 mt-1">
                    {data.total_completed} of {data.quests.length} quests complete
                  </p>
                  {!data.is_authenticated && (
                    <Link
                      href="/login"
                      className="mt-2 inline-flex items-center gap-1 text-[11px] text-for-400 hover:text-for-300 transition-colors"
                    >
                      Sign in to track progress <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* Track selector */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(data?.tracks ?? []).map((summary) => (
                <TrackCard
                  key={summary.track}
                  summary={summary}
                  isActive={activeTrack === summary.track}
                  onClick={() => setActiveTrack(summary.track)}
                />
              ))}
            </div>
          )}

          {/* Active track header */}
          {!loading && activeTrackSummary && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('flex items-center justify-center w-7 h-7 rounded-lg', trackCfg.bg)}>
                  <trackCfg.icon className={cn('h-3.5 w-3.5', trackCfg.color)} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{trackCfg.label} Track</p>
                  <p className="text-[11px] text-surface-500">
                    Level {activeTrackSummary.level} ·{' '}
                    <span className={trackCfg.color}>
                      {activeTrackSummary.clout_earned}
                    </span>{' '}
                    / {activeTrackSummary.clout_total} Clout
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="text-[11px] text-surface-500 hover:text-surface-700 transition-colors"
              >
                {showCompleted ? 'Hide completed' : 'Show all'}
              </button>
            </div>
          )}

          {/* Quest list */}
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <QuestSkeleton key={i} />)
                : visibleQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      trackColor={trackCfg.color}
                    />
                  ))}
            </AnimatePresence>

            {!loading && visibleQuests.length === 0 && (
              <div className="text-center py-10">
                <CheckCircle2 className="h-10 w-10 text-emerald mx-auto mb-3" />
                <p className="text-white font-semibold">All quests complete!</p>
                <p className="text-xs text-surface-500 mt-1">
                  You have mastered the {trackCfg.label} track.
                </p>
              </div>
            )}
          </div>

          {/* Quick links */}
          {!loading && (
            <div className="pt-2 border-t border-surface-300/30">
              <p className="text-xs text-surface-600 mb-3">Earn quest progress</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: '/', label: 'Vote on Topics', icon: Vote, color: 'text-for-400' },
                  { href: '/write', label: 'Write an Argument', icon: MessageSquare, color: 'text-against-400' },
                  { href: '/debate', label: 'Join a Debate', icon: Flame, color: 'text-gold' },
                  { href: '/discover', label: 'Discover Citizens', icon: Globe, color: 'text-emerald' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-200/40 border border-surface-300/30 hover:border-surface-400/50 transition-colors"
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                    <span className="text-xs text-surface-700">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related links */}
          {!loading && (
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Link
                href="/missions"
                className="flex items-center gap-1 text-surface-500 hover:text-surface-700 transition-colors"
              >
                <Award className="h-3 w-3" />
                Daily Missions
                <ChevronRight className="h-3 w-3" />
              </Link>
              <Link
                href="/achievements"
                className="flex items-center gap-1 text-surface-500 hover:text-surface-700 transition-colors"
              >
                <Trophy className="h-3 w-3" />
                Achievements
                <ChevronRight className="h-3 w-3" />
              </Link>
              <Link
                href="/analytics"
                className="flex items-center gap-1 text-surface-500 hover:text-surface-700 transition-colors"
              >
                <Users className="h-3 w-3" />
                My Stats
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
