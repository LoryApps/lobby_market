'use client'

/**
 * /leaderboard/legacy — The Civic Legacy Leaderboard
 *
 * Ranks citizens by their enduring, quality contributions over time —
 * not just recent activity, but lasting civic impact.
 *
 * Legacy Score (composite):
 *   50%  Law Quality:        Laws co-authored, weighted by vote margin and engagement
 *   30%  Argument Longevity: Upvotes earned on arguments, weighted by argument age
 *   20%  Tenure Consistency: Longest streak × years on platform (log-scaled)
 *
 * Distinct from:
 *   /leaderboard/lawmakers     — raw count of laws co-authored, not quality-weighted
 *   /leaderboard/impact        — overall recent impact score
 *   /leaderboard/engagement    — decathlon-style all-dimensions engagement
 *   /leaderboard/legends       — single-category all-time record holders
 *   /leaderboard/reputation    — reputation score (different signal mix)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  Info,
  RefreshCw,
  Scroll,
  Sparkles,
  Star,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LegacyLeaderEntry,
  LegacyMyStats,
  LegacyLeaderboardResponse,
  LegacyTier,
} from '@/app/api/leaderboard/legacy/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  LegacyTier,
  { label: string; color: string; bg: string; border: string; icon: typeof Star }
> = {
  founder: {
    label: 'Founder',
    color: 'text-gold',
    bg: 'bg-gold/15',
    border: 'border-gold/50',
    icon: Star,
  },
  elder: {
    label: 'Elder',
    color: 'text-purple',
    bg: 'bg-purple/15',
    border: 'border-purple/40',
    icon: Scroll,
  },
  veteran: {
    label: 'Veteran',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: Gavel,
  },
  established: {
    label: 'Established',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: TrendingUp,
  },
  rising: {
    label: 'Rising',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    icon: Sparkles,
  },
}

const RANK_COLORS: Record<number, { ring: string; medal: string }> = {
  1: { ring: 'ring-2 ring-gold/60', medal: 'text-gold' },
  2: { ring: 'ring-2 ring-surface-500/60', medal: 'text-surface-500' },
  3: { ring: 'ring-2 ring-amber-700/60', medal: 'text-amber-700' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LegacyRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="text-right space-y-1 flex-shrink-0">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function LegacyRow({
  entry,
  index,
}: {
  entry: LegacyLeaderEntry
  index: number
}) {
  const tierCfg = TIER_CONFIG[entry.tier]
  const TierIcon = tierCfg.icon
  const rankStyle = RANK_COLORS[entry.rank]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-4 py-3 px-4 rounded-2xl',
          'bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/60',
          'transition-colors group',
        )}
      >
        {/* Rank */}
        <div
          className={cn(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
            'bg-surface-200 border border-surface-300 text-xs font-mono font-bold',
            entry.rank === 1 && 'bg-gold/10 border-gold/40 text-gold',
            entry.rank === 2 && 'bg-surface-300/40 border-surface-400 text-surface-500',
            entry.rank === 3 && 'bg-amber-900/20 border-amber-800/40 text-amber-600',
            entry.rank > 3 && 'text-surface-500',
          )}
          aria-label={`Rank ${entry.rank}`}
        >
          {entry.rank <= 3 ? (
            <Trophy
              className={cn(
                'h-3.5 w-3.5',
                entry.rank === 1 && 'text-gold',
                entry.rank === 2 && 'text-surface-400',
                entry.rank === 3 && 'text-amber-600',
              )}
            />
          ) : (
            <span>{entry.rank}</span>
          )}
        </div>

        {/* Avatar */}
        <div className={cn('flex-shrink-0 rounded-full', rankStyle?.ring)}>
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name || entry.username}
            size="md"
          />
        </div>

        {/* Name + tier */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
              {entry.display_name || entry.username}
            </p>
            <span
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold border flex-shrink-0',
                tierCfg.bg,
                tierCfg.border,
                tierCfg.color,
              )}
            >
              <TierIcon className="h-2.5 w-2.5" />
              {tierCfg.label}
            </span>
          </div>
          {/* Sub-stats */}
          <div className="flex items-center gap-3 mt-1 text-[11px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Gavel className="h-2.5 w-2.5 text-gold" />
              {entry.laws_coauthored} law{entry.laws_coauthored !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
              {entry.argument_upvotes.toLocaleString()} votes
            </span>
            <span className="flex items-center gap-1">
              <Flame className="h-2.5 w-2.5 text-against-400" />
              {entry.longest_streak}d streak
            </span>
          </div>
        </div>

        {/* Legacy score */}
        <div className="text-right flex-shrink-0">
          <p className="text-base font-mono font-bold text-white">
            {entry.legacy_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] font-mono text-surface-500">legacy pts</p>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats }: { stats: LegacyMyStats }) {
  const tierCfg = TIER_CONFIG[stats.tier]
  const TierIcon = tierCfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Star className="h-4 w-4 text-gold" />
          </div>
          <div>
            <p className="text-xs font-mono font-semibold text-white">Your Civic Legacy</p>
            <p className="text-[10px] font-mono text-surface-500">
              {stats.rank !== null ? `Rank #${stats.rank}` : 'Unranked'}{' '}
              {stats.percentile !== null && stats.percentile > 0
                ? `· Top ${100 - stats.percentile}%`
                : ''}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-semibold border',
            tierCfg.bg,
            tierCfg.border,
            tierCfg.color,
          )}
        >
          <TierIcon className="h-3 w-3" />
          {tierCfg.label}
        </span>
      </div>

      {/* Score */}
      <div className="text-center py-2">
        <p className="text-4xl font-mono font-bold text-white">
          {stats.legacy_score.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="text-xs font-mono text-surface-500 mt-1">legacy points</p>
      </div>

      {/* Components breakdown */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2.5 rounded-xl bg-surface-200 border border-surface-300">
          <Gavel className="h-4 w-4 text-gold mx-auto mb-1" />
          <p className="text-sm font-mono font-bold text-white">{stats.laws_coauthored}</p>
          <p className="text-[10px] font-mono text-surface-500">laws</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-surface-200 border border-surface-300">
          <ThumbsUp className="h-4 w-4 text-for-400 mx-auto mb-1" />
          <p className="text-sm font-mono font-bold text-white">
            {Math.round(stats.argument_longevity_score).toLocaleString()}
          </p>
          <p className="text-[10px] font-mono text-surface-500">longevity</p>
        </div>
        <div className="text-center p-2.5 rounded-xl bg-surface-200 border border-surface-300">
          <Flame className="h-4 w-4 text-against-400 mx-auto mb-1" />
          <p className="text-sm font-mono font-bold text-white">{stats.longest_streak}</p>
          <p className="text-[10px] font-mono text-surface-500">streak</p>
        </div>
      </div>

      {stats.legacy_score === 0 && (
        <p className="text-[11px] font-mono text-surface-500 text-center">
          Vote on topics, write arguments, and build your streak to grow your legacy score.
        </p>
      )}
    </motion.div>
  )
}

// ─── Score explainer ──────────────────────────────────────────────────────────

function ScoreExplainer() {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl bg-surface-200/50 border border-surface-300 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-surface-200/80 transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-mono text-surface-500">
          <Info className="h-3.5 w-3.5" />
          How is Legacy Score calculated?
        </span>
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-surface-500 transition-transform',
            open && 'rotate-90',
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gold/15 border border-gold/30 flex items-center justify-center mt-0.5">
                  <Gavel className="h-3 w-3 text-gold" />
                </div>
                <div>
                  <p className="text-xs font-mono font-semibold text-surface-600">
                    Law Quality Score <span className="text-gold">50%</span>
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                    Laws you helped pass, weighted by how decisive the vote margin was
                    and how much community engagement they attracted.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-md bg-for-500/10 border border-for-500/30 flex items-center justify-center mt-0.5">
                  <ThumbsUp className="h-3 w-3 text-for-400" />
                </div>
                <div>
                  <p className="text-xs font-mono font-semibold text-surface-600">
                    Argument Longevity <span className="text-for-400">30%</span>
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                    Upvotes on your arguments, weighted by age — older arguments that
                    still earn upvotes signal lasting persuasive impact.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-md bg-against-500/10 border border-against-500/30 flex items-center justify-center mt-0.5">
                  <Flame className="h-3 w-3 text-against-400" />
                </div>
                <div>
                  <p className="text-xs font-mono font-semibold text-surface-600">
                    Tenure Consistency <span className="text-against-400">20%</span>
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                    Your longest streak × years on the platform (log-scaled). Rewards
                    citizens who show up consistently, year after year.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LegacyLeaderboardPage() {
  const [entries, setEntries] = useState<LegacyLeaderEntry[]>([])
  const [myStats, setMyStats] = useState<LegacyMyStats | null>(null)
  const [totalCitizens, setTotalCitizens] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/leaderboard/legacy?limit=50', {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as LegacyLeaderboardResponse
      setEntries(data.entries)
      setMyStats(data.my_stats)
      setTotalCitizens(data.total_citizens)
    } catch {
      setError('Could not load the Legacy Leaderboard. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-3"
            >
              <ArrowLeft className="h-3 w-3" />
              All Leaderboards
            </Link>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center flex-shrink-0">
                <Scroll className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="text-2xl font-mono font-bold text-white">
                  Civic Legacy
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Enduring quality contributions — not just recent activity
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 border border-surface-300 transition-colors disabled:opacity-40"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Context banner ── */}
        <div className="mb-6 flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-gold/5 border border-gold/20">
          <Sparkles className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              Legacy is not about how much you&rsquo;ve done this week — it&rsquo;s about what you&rsquo;ve
              built over time. The citizens here have shaped the Lobby through quality laws,
              enduring arguments, and consistent civic presence.
            </p>
            {totalCitizens > 0 && (
              <p className="text-[11px] font-mono text-surface-500 mt-1.5 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {totalCitizens.toLocaleString()} citizens with legacy standing
              </p>
            )}
          </div>
        </div>

        {/* ── My stats ── */}
        {myStats !== null && !loading && (
          <div className="mb-6">
            <MyStatsCard stats={myStats} />
          </div>
        )}

        {/* ── Score explainer ── */}
        <div className="mb-6">
          <ScoreExplainer />
        </div>

        {/* ── Tier legend ── */}
        <div className="mb-6">
          <p className="text-[11px] font-mono text-surface-500 mb-3 uppercase tracking-wider">
            Legacy Tiers
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(Object.entries(TIER_CONFIG) as [LegacyTier, typeof TIER_CONFIG.founder][]).map(
              ([tier, cfg]) => {
                const Icon = cfg.icon
                return (
                  <div
                    key={tier}
                    className={cn(
                      'flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-mono',
                      cfg.bg,
                      cfg.border,
                      cfg.color,
                    )}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span>{cfg.label}</span>
                  </div>
                )
              },
            )}
          </div>
        </div>

        {/* ── Leaderboard ── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <LegacyRowSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Scroll}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="Legacy Unavailable"
            description={error}
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Scroll}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No Legacy Yet"
            description="Vote on topics, write arguments, and engage consistently to start building your civic legacy."
            actions={[
              { label: 'Browse Topics', href: '/' },
              { label: 'View Leaderboard', href: '/leaderboard' },
            ]}
          />
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <LegacyRow key={entry.user_id} entry={entry} index={i} />
            ))}
          </div>
        )}

        {/* ── Related leaderboards ── */}
        {!loading && entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-10 pt-6 border-t border-surface-300"
          >
            <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-4">
              Related Leaderboards
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  href: '/leaderboard/lawmakers',
                  label: 'Lawmakers',
                  desc: 'Most laws co-authored',
                  icon: Gavel,
                  color: 'text-gold',
                },
                {
                  href: '/leaderboard/arguments',
                  label: 'Top Arguers',
                  desc: 'Most argument upvotes',
                  icon: ThumbsUp,
                  color: 'text-for-400',
                },
                {
                  href: '/leaderboard/legends',
                  label: 'Hall of Legends',
                  desc: 'All-time record holders',
                  icon: Trophy,
                  color: 'text-purple',
                },
                {
                  href: '/leaderboard/reputation',
                  label: 'Reputation',
                  desc: 'Civic reputation score',
                  icon: Star,
                  color: 'text-emerald',
                },
              ].map(({ href, label, desc, icon: Icon, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors truncate">
                      {label}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 truncate">{desc}</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-surface-500 flex-shrink-0 ml-auto" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
