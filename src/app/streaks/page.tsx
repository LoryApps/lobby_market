'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Crown,
  Flame,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { streakTier } from '@/lib/utils/streak-tier'
import type { StreakEntry, StreaksResponse } from '@/app/api/streaks/route'

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

const ROLE_BADGE: Record<string, 'person' | 'debator' | 'troll_catcher' | 'elder'> = {
  person: 'person',
  debator: 'debator',
  troll_catcher: 'troll_catcher',
  elder: 'elder',
}

// ─── Flame icon component (stacked for higher tiers) ─────────────────────────

function StreakFlame({ days, className }: { days: number; className?: string }) {
  const tier = streakTier(days)
  const flameCount = days >= 100 ? 3 : days >= 30 ? 2 : 1
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {Array.from({ length: flameCount }).map((_, i) => (
        <Flame key={i} className={cn('h-3.5 w-3.5', tier.color)} aria-hidden />
      ))}
    </span>
  )
}

// ─── Streak badge pill ────────────────────────────────────────────────────────

function StreakBadge({ days }: { days: number }) {
  const tier = streakTier(days)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold border',
        tier.color,
        tier.bg,
        tier.border,
        tier.glow,
      )}
    >
      <Flame className="h-2.5 w-2.5" aria-hidden />
      {tier.label}
    </span>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StreaksSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {/* Podium */}
      <div className="flex items-end justify-center gap-3">
        <Skeleton className="h-36 w-28 rounded-xl" />
        <Skeleton className="h-44 w-28 rounded-xl" />
        <Skeleton className="h-32 w-28 rounded-xl" />
      </div>
      {/* List */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Stats banner ─────────────────────────────────────────────────────────────

function StatBanner({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Flame
  label: string
  value: number
  sub?: string
  color: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-mono', color)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {label}
      </div>
      <div className="text-2xl font-mono font-bold text-white tabular-nums">
        <AnimatedNumber value={value} />
      </div>
      {sub && (
        <div className="text-[11px] font-mono text-surface-500">{sub}</div>
      )}
    </div>
  )
}

// ─── Podium card ──────────────────────────────────────────────────────────────

const PODIUM_HEIGHT: Record<number, string> = {
  1: 'h-44',
  2: 'h-36',
  3: 'h-32',
}

const PODIUM_RANK_SIZE: Record<number, string> = {
  1: 'text-2xl',
  2: 'text-xl',
  3: 'text-lg',
}

function PodiumCard({ entry }: { entry: StreakEntry }) {
  const tier = streakTier(entry.vote_streak)
  const rankNum = entry.rank
  const podiumH = PODIUM_HEIGHT[rankNum] ?? 'h-28'
  const rankSz = PODIUM_RANK_SIZE[rankNum] ?? 'text-base'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rankNum * 0.08 }}
      className={cn('flex flex-col items-center gap-2', rankNum === 1 && '-mt-4')}
    >
      <Avatar
        src={entry.avatar_url}
        fallback={entry.display_name || entry.username}
        size={rankNum === 1 ? 'lg' : 'md'}
        className={cn('ring-2', tier.border)}
      />
      <div className="text-center min-w-0 max-w-[7rem]">
        <Link
          href={`/profile/${entry.username}`}
          className="text-xs font-mono text-white hover:text-for-300 transition-colors truncate block"
        >
          {entry.display_name ?? `@${entry.username}`}
        </Link>
        <div className={cn('font-mono font-bold text-white tabular-nums', rankSz)}>
          {entry.vote_streak}
          <span className="text-xs text-surface-500 ml-0.5">d</span>
        </div>
      </div>
      <StreakBadge days={entry.vote_streak} />
      {/* Podium block */}
      <div
        className={cn(
          'w-24 rounded-t-lg border-t border-x flex items-center justify-center',
          podiumH,
          rankNum === 1
            ? 'bg-gold/10 border-gold/30 text-gold'
            : rankNum === 2
              ? 'bg-for-500/10 border-for-500/30 text-for-400'
              : 'bg-against-500/10 border-against-500/30 text-against-400',
        )}
      >
        <span className="text-3xl font-black font-mono opacity-30">
          {rankNum}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Row in leaderboard list ──────────────────────────────────────────────────

function StreakRow({
  entry,
  index,
  isYou,
}: {
  entry: StreakEntry
  index: number
  isYou: boolean
}) {
  const tier = streakTier(entry.vote_streak)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors group',
          isYou
            ? 'bg-for-500/10 border-for-500/30 hover:bg-for-500/15'
            : 'bg-surface-100 border-surface-300 hover:bg-surface-200',
        )}
      >
        {/* Rank */}
        <span
          className={cn(
            'w-7 text-center text-sm font-mono font-bold flex-shrink-0 tabular-nums',
            entry.rank <= 3 ? 'text-gold' : 'text-surface-500',
          )}
        >
          {entry.rank}
        </span>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
          className={cn('flex-shrink-0 ring-1', tier.border)}
        />

        {/* Name + role */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-sm font-mono font-medium truncate',
                isYou ? 'text-for-300' : 'text-white group-hover:text-for-300 transition-colors',
              )}
            >
              {entry.display_name ?? `@${entry.username}`}
            </span>
            {isYou && (
              <span className="text-[10px] font-mono text-for-400 bg-for-500/20 rounded-full px-1.5 py-0.5">
                you
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant={ROLE_BADGE[entry.role] ?? 'person'}>
              {ROLE_LABEL[entry.role] ?? entry.role}
            </Badge>
          </div>
        </div>

        {/* Streak count + badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <StreakFlame days={entry.vote_streak} />
            <span className={cn('text-lg font-black font-mono tabular-nums', tier.color)}>
              {entry.vote_streak}
            </span>
            <span className="text-xs font-mono text-surface-500">d</span>
          </div>
          <StreakBadge days={entry.vote_streak} />
        </div>

        {/* Votes + clout — hidden on small screens */}
        <div className="hidden sm:flex flex-shrink-0 flex-col items-end gap-0.5 w-20">
          <span className="text-xs font-mono text-surface-400">
            {entry.total_votes.toLocaleString()} votes
          </span>
          <span className="text-xs font-mono text-gold">
            {entry.clout.toLocaleString()} ¢
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Tier legend ──────────────────────────────────────────────────────────────

const TIERS = [
  { days: 100 },
  { days: 60 },
  { days: 30 },
  { days: 14 },
  { days: 7 },
  { days: 3 },
] as const

function TierLegend() {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-purple" aria-hidden />
        <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
          Streak Tiers
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TIERS.map(({ days }) => {
          const tier = streakTier(days)
          return (
            <div
              key={tier.label}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 border text-xs font-mono',
                tier.color,
                tier.bg,
                tier.border,
              )}
            >
              <Flame className="h-3 w-3 flex-shrink-0" aria-hidden />
              <div>
                <div className="font-semibold">{tier.label}</div>
                <div className="opacity-60">{tier.min}+ days</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StreaksPage() {
  const [data, setData] = useState<StreaksResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/streaks')
      if (!res.ok) throw new Error('Failed to load streaks')
      const json = (await res.json()) as StreaksResponse
      setData(json)
    } catch {
      setError('Failed to load the Streak Hall. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const top3 = data?.leaderboard.slice(0, 3) ?? []
  const rest = data?.leaderboard.slice(3) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Flame className="h-5 w-5 text-against-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Streak Hall
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Most consistent daily voters in the Lobby
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              aria-hidden
            />
          </button>
        </div>

        {/* Your rank banner */}
        {data && data.your_rank !== null && data.your_streak !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-3 rounded-xl bg-for-500/10 border border-for-500/30 px-4 py-3"
          >
            <Target className="h-4 w-4 text-for-400 flex-shrink-0" aria-hidden />
            <span className="text-sm font-mono text-for-300">
              Your current streak:{' '}
              <span className="font-bold text-white">
                {data.your_streak} day{data.your_streak !== 1 ? 's' : ''}
              </span>
            </span>
            <span className="ml-auto text-sm font-mono font-semibold text-for-400">
              #{data.your_rank}
            </span>
          </motion.div>
        )}

        {loading ? (
          <StreaksSkeleton />
        ) : error ? (
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-500 text-sm font-mono mb-4">{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="text-for-400 hover:text-for-300 text-sm font-mono transition-colors"
            >
              Try again
            </button>
          </div>
        ) : !data || data.leaderboard.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="No active streaks yet"
            description="Be the first to build a daily voting streak in the Lobby."
            actions={[{ label: 'Start voting', href: '/', variant: 'primary' }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Global stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBanner
                  icon={Users}
                  label="Active Streakers"
                  value={data.stats.total_active}
                  sub="voting daily"
                  color="text-for-400"
                />
                <StatBanner
                  icon={Flame}
                  label="Longest Streak"
                  value={data.stats.max_streak}
                  sub="days in a row"
                  color="text-against-400"
                />
                <StatBanner
                  icon={Sparkles}
                  label="Blazing (14d+)"
                  value={data.stats.total_blazing}
                  sub="on fire right now"
                  color="text-emerald"
                />
                <StatBanner
                  icon={TrendingUp}
                  label="Avg Streak"
                  value={data.stats.avg_streak}
                  sub="days average"
                  color="text-purple"
                />
              </div>

              {/* Top 3 podium */}
              {top3.length >= 2 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Trophy className="h-4 w-4 text-gold" aria-hidden />
                    <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                      Top Streakers
                    </span>
                  </div>
                  <div className="flex items-end justify-center gap-4 sm:gap-6">
                    {/* 2nd place */}
                    {top3[1] && <PodiumCard entry={top3[1]} />}
                    {/* 1st place — tallest */}
                    {top3[0] && <PodiumCard entry={top3[0]} />}
                    {/* 3rd place */}
                    {top3[2] && <PodiumCard entry={top3[2]} />}
                  </div>
                </div>
              )}

              {/* Tier legend */}
              <TierLegend />

              {/* Full leaderboard — rank 4+ */}
              {rest.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-3.5 w-3.5 text-surface-500" aria-hidden />
                    <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                      Full Leaderboard
                    </span>
                    <span className="text-xs font-mono text-surface-600 ml-auto">
                      {data.leaderboard.length} streakers shown
                    </span>
                  </div>
                  <div className="space-y-2">
                    {rest.map((entry, i) => (
                      <StreakRow
                        key={entry.id}
                        entry={entry}
                        index={i}
                        isYou={entry.is_you}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Crown className="h-4 w-4 text-gold" aria-hidden />
                  <span className="text-sm font-mono text-surface-400">
                    Keep voting every day to climb the hall
                  </span>
                </div>
                <Link
                  href="/"
                  className="flex items-center gap-1 text-sm font-mono text-for-400 hover:text-for-300 transition-colors flex-shrink-0"
                >
                  Vote now <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
