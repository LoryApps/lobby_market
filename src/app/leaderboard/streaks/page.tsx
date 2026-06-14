'use client'

/**
 * /leaderboard/streaks — Streak Masters
 *
 * Ranks citizens by their current consecutive daily voting streak.
 * Tiers: Platinum (90+ days), Gold (30+), Silver (7+), Bronze (3+), Ember (<3).
 *
 * Filter tabs let users narrow by tier so they can find their cohort.
 * Top 3 get a podium treatment. Every entry shows estimated streak start date.
 *
 * Distinct from:
 *   /leaderboard/today    — votes cast today (single-day snapshot)
 *   /leaderboard/legends  — shows one Stalwart record holder all-time
 *   /analytics/streak     — your own streak history and breakdown
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Flame,
  RefreshCw,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  StreakEntry,
  StreakFilter,
  StreakLeaderboardResponse,
} from '@/app/api/leaderboard/streaks/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  platinum: {
    label: 'Platinum',
    color: 'text-[#e5e4e2]',
    bg: 'bg-[#e5e4e2]/10',
    border: 'border-[#e5e4e2]/30',
    dot: 'bg-[#e5e4e2]',
  },
  gold: {
    label: 'Gold',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    dot: 'bg-gold',
  },
  silver: {
    label: 'Silver',
    color: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/30',
    dot: 'bg-surface-400',
  },
  bronze: {
    label: 'Bronze',
    color: 'text-amber-600',
    bg: 'bg-amber-600/10',
    border: 'border-amber-600/30',
    dot: 'bg-amber-600',
  },
  ember: {
    label: 'Ember',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/20',
    dot: 'bg-against-400',
  },
} as const

const PODIUM_COLORS = [
  { ring: 'ring-gold/60',    bg: 'bg-gold/10',     text: 'text-gold',     label: '#1' },
  { ring: 'ring-surface-400/50', bg: 'bg-surface-300/20', text: 'text-surface-400', label: '#2' },
  { ring: 'ring-amber-600/50',   bg: 'bg-amber-600/10',   text: 'text-amber-600',   label: '#3' },
]

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTERS: { id: StreakFilter; label: string; threshold: string }[] = [
  { id: 'all',      label: 'All Streaks',   threshold: '3+ days' },
  { id: 'platinum', label: 'Platinum',      threshold: '90+ days' },
  { id: 'gold',     label: 'Gold',          threshold: '30+ days' },
  { id: 'silver',   label: 'Silver',        threshold: '7+ days' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pluralDays(n: number): string {
  return `${n.toLocaleString()} day${n === 1 ? '' : 's'}`
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PodiumCard({ entry, podiumIdx }: { entry: StreakEntry; podiumIdx: number }) {
  const style = PODIUM_COLORS[podiumIdx]
  const tier = TIER_CONFIG[entry.tier]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: podiumIdx * 0.08 }}
      className={cn(
        'flex flex-col items-center gap-2 flex-1 px-3 py-5 rounded-2xl',
        'bg-surface-100 border',
        style.ring.replace('ring-', 'border-'),
      )}
    >
      <span className={cn('text-xs font-mono font-bold', style.text)}>{style.label}</span>
      <div className={cn('rounded-full ring-2 p-0.5', style.ring)}>
        <Avatar
          src={entry.avatar_url}
          username={entry.username}
          size={podiumIdx === 0 ? 'lg' : 'md'}
        />
      </div>
      <div className="text-center min-w-0 w-full">
        <p className="font-mono text-sm font-semibold text-white truncate">
          {entry.display_name ?? entry.username}
        </p>
        <p className="font-mono text-xs text-surface-500 truncate">@{entry.username}</p>
      </div>
      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full', tier.bg, tier.border, 'border')}>
        <Flame className={cn('h-3.5 w-3.5', tier.color)} aria-hidden />
        <span className={cn('font-mono text-sm font-bold', tier.color)}>
          {pluralDays(entry.vote_streak)}
        </span>
      </div>
      <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border', tier.color, tier.bg, tier.border)}>
        {tier.label}
      </span>
    </motion.div>
  )
}

function StreakRow({ entry, idx }: { entry: StreakEntry; idx: number }) {
  const tier = TIER_CONFIG[entry.tier]

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: idx * 0.03 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className="flex items-center gap-3 rounded-2xl bg-surface-100 border border-surface-300 px-4 py-3.5 hover:bg-surface-200 transition-colors group"
      >
        {/* Rank */}
        <span className="font-mono text-xs font-bold text-surface-500 w-6 flex-shrink-0 text-right">
          {entry.rank}
        </span>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar src={entry.avatar_url} username={entry.username} size="sm" />
          <span className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-surface-100', tier.dot)} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
            {entry.display_name ?? entry.username}
          </p>
          <p className="font-mono text-xs text-surface-500 truncate">
            Since {shortDate(entry.streak_started_est)} · {entry.total_votes.toLocaleString()} votes total
          </p>
        </div>

        {/* Streak badge */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full border', tier.bg, tier.border)}>
            <Flame className={cn('h-3 w-3', tier.color)} aria-hidden />
            <span className={cn('font-mono text-sm font-bold', tier.color)}>
              {entry.vote_streak}d
            </span>
          </div>
          <span className={cn('text-[10px] font-mono font-semibold', tier.color)}>
            {tier.label}
          </span>
        </div>

        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 transition-colors" aria-hidden />
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StreakMastersPage() {
  const [data, setData] = useState<StreakLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<StreakFilter>('all')
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (f: StreakFilter, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/leaderboard/streaks?filter=${f}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: StreakLeaderboardResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load streak leaderboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(filter)
  }, [filter, fetchData])

  const entries = data?.entries ?? []
  const top3    = entries.slice(0, 3)
  const rest    = entries.slice(3)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to Leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Flame className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">
                Streak Masters
              </h1>
              <p className="text-xs font-mono text-surface-500">
                Longest active daily voting streaks on the Lobby
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchData(filter, true)}
            disabled={refreshing || loading}
            aria-label="Refresh streak leaderboard"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', refreshing && 'animate-spin')} aria-hidden />
          </button>
        </div>

        {/* Explainer card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/10 border border-against-500/20 flex-shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-against-400" aria-hidden />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-white mb-1">
                Daily Consecutive Voting
              </p>
              <p className="font-mono text-xs text-surface-500 leading-relaxed">
                A streak counts every day you cast at least one vote. Miss a day and it resets to zero.
                Tier up from Ember → Bronze → Silver → Gold → Platinum as you keep the flame alive.
              </p>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { icon: Users, label: 'Active Streakers', value: data.total_active, color: 'text-for-400' },
              { icon: Trophy, label: 'Platinum (90+ d)', value: data.platinum_count, color: 'text-[#e5e4e2]' },
              { icon: Award, label: 'Gold (30+ d)', value: data.gold_count, color: 'text-gold' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
              >
                <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} aria-hidden />
                <p className={cn('font-mono text-lg font-bold', color)}>{value.toLocaleString()}</p>
                <p className="font-mono text-[10px] text-surface-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors border',
                filter === f.id
                  ? 'bg-against-500/20 border-against-500/40 text-against-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400',
              )}
            >
              <Flame className="h-3 w-3" aria-hidden />
              {f.label}
              <span className="opacity-60">· {f.threshold}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-40 w-full rounded-2xl mb-5" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="font-mono text-sm text-against-400 mb-3">{error}</p>
            <button
              onClick={() => fetchData(filter)}
              className="font-mono text-xs text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Flame className="h-8 w-8 text-surface-500" />}
            title="No active streaks"
            description="No one is currently on a streak matching this filter. Be the first to start one!"
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-xl bg-for-500 px-4 py-2 font-mono text-sm font-semibold text-white hover:bg-for-600 transition-colors"
              >
                <Zap className="h-4 w-4" aria-hidden />
                Vote now
              </Link>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Podium — top 3 */}
              {top3.length > 0 && (
                <div className="flex gap-3 mb-5">
                  {/* Reorder to 2-1-3 podium layout */}
                  {([1, 0, 2] as const).map((pos) => {
                    const entry = top3[pos]
                    if (!entry) return null
                    return <PodiumCard key={entry.user_id} entry={entry} podiumIdx={pos} />
                  })}
                </div>
              )}

              {/* Rank label */}
              {rest.length > 0 && (
                <p className="font-mono text-[10px] text-surface-600 uppercase tracking-widest mb-3 px-1">
                  Ranked {4}–{3 + rest.length}
                </p>
              )}

              {/* Rows 4+ */}
              <div className="space-y-2">
                {rest.map((entry, i) => (
                  <StreakRow key={entry.user_id} entry={entry} idx={i} />
                ))}
              </div>

              {/* Footer note */}
              {data && (
                <p className="font-mono text-[10px] text-surface-600 text-center mt-8">
                  Showing top {entries.length} of {data.total_active} active streakers ·{' '}
                  Updated {new Date(data.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
