'use client'

/**
 * /leaderboard/bridge — Bridge Builders Leaderboard
 *
 * Ranks citizens by how often they vote AGAINST their own established
 * partisan lean within each category — evidence that they follow the
 * argument, not the tribe.
 *
 * A Bridge Vote = casting a vote opposite to your usual lean in that
 * category (e.g. you normally vote ≥65% FOR in Economics but you voted
 * AGAINST on a specific Economics topic).
 *
 * Bridge Score = bridge_votes × (1 + bridge_rate) + categories_bridged × 2
 *
 * Tiers:
 *   Unifier          (≥35) — transcends tribalism; consistently follows merit
 *   Consensus Seeker (≥18) — actively finds common ground across party lines
 *   Bridge Builder   (≥8)  — regularly crosses their own categorical lean
 *   Occasional Bridge(≥3)  — sometimes breaks from their usual position
 *   Partisan         (<3)  — stays firmly within their established positions
 *
 * Distinct from:
 *   /leaderboard/dissent   — minority voters (losing side), not about crossing leans
 *   /bridge                — personal bridge analytics (this is the public ranking)
 *   /analytics/alignment   — alignment with platform, not with own history
 *   /analytics/diversity   — category breadth, not cross-lean voting
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  GitMerge,
  RefreshCw,
  Scale,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  BridgeLeaderEntry,
  BridgeMyStats,
  BridgeTier,
  BridgeLeaderboardResponse,
} from '@/app/api/leaderboard/bridge/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<BridgeTier, {
  label: string
  color: string
  bg: string
  border: string
  badge: string
  dot: string
}> = {
  unifier: {
    label: 'Unifier',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple',
    dot: 'bg-purple',
  },
  consensus_seeker: {
    label: 'Consensus Seeker',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badge: 'bg-emerald/20 text-emerald',
    dot: 'bg-emerald',
  },
  bridge_builder: {
    label: 'Bridge Builder',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400',
    dot: 'bg-for-500',
  },
  occasional_bridge: {
    label: 'Occasional Bridge',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold',
    dot: 'bg-gold',
  },
  partisan: {
    label: 'Partisan',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    badge: 'bg-surface-300 text-surface-500',
    dot: 'bg-surface-500',
  },
}

const TIER_ORDER: BridgeTier[] = [
  'unifier',
  'consensus_seeker',
  'bridge_builder',
  'occasional_bridge',
  'partisan',
]

// ─── Podium card ──────────────────────────────────────────────────────────────

const PODIUM_HEIGHTS = ['h-32', 'h-24', 'h-20'] as const
const PODIUM_MEDALS  = ['text-gold', 'text-surface-400', 'text-amber-600'] as const
const PODIUM_SIZES   = ['text-2xl', 'text-xl', 'text-lg'] as const

function PodiumCard({
  entry,
  position,
}: {
  entry: BridgeLeaderEntry
  position: 1 | 2 | 3
}) {
  const tier = TIER_CONFIG[entry.tier]
  const idx = position - 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.08 }}
      className="flex flex-col items-center gap-2"
    >
      <Link href={`/profile/${entry.username}`} className="group flex flex-col items-center gap-2 min-w-0">
        <div className="relative">
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name ?? entry.username}
            size={position === 1 ? 'xl' : 'lg'}
          />
          <span className={cn(
            'absolute -top-1 -right-1 h-5 w-5 rounded-full bg-surface-100 border border-surface-300 flex items-center justify-center text-[10px] font-mono font-bold',
            PODIUM_MEDALS[idx],
          )}>
            {position}
          </span>
        </div>
        <div className="text-center min-w-0 max-w-[90px]">
          <p className={cn('font-mono font-bold truncate', PODIUM_SIZES[idx], 'text-white group-hover:text-for-400 transition-colors')}>
            {entry.display_name ?? entry.username}
          </p>
          <p className="text-[10px] font-mono text-surface-500 truncate">@{entry.username}</p>
        </div>
      </Link>
      <span className={cn('text-[10px] font-mono font-semibold rounded-full px-2 py-0.5', tier.badge)}>
        {tier.label}
      </span>
      <div className={cn('w-full rounded-xl border flex items-end justify-center pb-3', tier.bg, tier.border, PODIUM_HEIGHTS[idx])}>
        <div className="text-center">
          <p className={cn('font-mono font-bold text-lg', tier.color)}>{entry.bridge_score}</p>
          <p className="text-[10px] font-mono text-surface-500">score</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Row entry ────────────────────────────────────────────────────────────────

function BridgeRow({
  entry,
  isMe,
}: {
  entry: BridgeLeaderEntry
  isMe: boolean
}) {
  const tier = TIER_CONFIG[entry.tier]

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
        isMe && 'border-for-500/40 bg-for-500/5',
      )}
    >
      {/* Rank */}
      <span className="w-7 text-xs font-mono font-bold text-surface-500 flex-shrink-0 text-right">
        #{entry.rank}
      </span>

      {/* Avatar + name */}
      <Link
        href={`/profile/${entry.username}`}
        className="flex items-center gap-2.5 flex-1 min-w-0 group"
      >
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-sm font-mono font-semibold text-white truncate group-hover:text-for-400 transition-colors">
            {entry.display_name ?? entry.username}
            {isMe && <span className="ml-1.5 text-xs text-for-400">(you)</span>}
          </p>
          <p className="text-[11px] font-mono text-surface-500 truncate">@{entry.username}</p>
        </div>
      </Link>

      {/* Tier badge */}
      <span className={cn('hidden sm:inline-flex text-[10px] font-mono font-semibold rounded-full px-2 py-0.5 flex-shrink-0', tier.badge)}>
        {tier.label}
      </span>

      {/* Best category tag */}
      {entry.best_bridge_category && (
        <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 flex-shrink-0">
          <Tag className="h-3 w-3" />
          {entry.best_bridge_category}
        </span>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-mono text-surface-500">{entry.bridge_votes} crossed</p>
          <p className="text-[10px] font-mono text-surface-400">{entry.bridge_rate}% rate</p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-mono font-bold', tier.color)}>{entry.bridge_score}</p>
          <p className="text-[10px] font-mono text-surface-500">score</p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats }: { stats: BridgeMyStats }) {
  const tier = TIER_CONFIG[stats.tier]

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', tier.bg, tier.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Your Bridge Profile</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-2xl font-mono font-bold', tier.color)}>
              {stats.bridge_score}
            </span>
            <span className={cn('text-xs font-mono font-semibold rounded-full px-2 py-0.5', tier.badge)}>
              {tier.label}
            </span>
          </div>
        </div>
        {stats.rank && (
          <div className="text-right">
            <p className="text-xs font-mono text-surface-500">Your rank</p>
            <p className="text-xl font-mono font-bold text-white">#{stats.rank}</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Bridge Votes', value: stats.bridge_votes, icon: GitMerge },
          { label: 'Bridge Rate', value: `${stats.bridge_rate}%`, icon: Scale },
          { label: 'Cats Bridged', value: stats.categories_bridged, icon: Tag },
          { label: 'Bridge Score', value: stats.bridge_score, icon: BarChart2 },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-200/50 border border-surface-300 p-3">
            <s.icon className="h-4 w-4 text-surface-500 mb-1" />
            <p className="text-base font-mono font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-mono text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>
      {stats.bridge_score === 0 && (
        <p className="text-xs font-mono text-surface-500 leading-relaxed">
          Bridge moments appear when you have a clear voting lean in a category (≥65% one way)
          and then vote the opposite on a specific debate. Vote more across multiple categories to
          unlock your bridge profile.
        </p>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BridgeLeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<BridgeLeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, userRes] = await Promise.all([
        fetch('/api/leaderboard/bridge', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
      ])
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as BridgeLeaderboardResponse
      setData(json)
      if (userRes.ok) {
        const userData = await userRes.json() as { id?: string }
        if (userData.id) setCurrentUserId(userData.id)
      }
    } catch {
      setError('Could not load the Bridge Builders Leaderboard. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const podiumEntries = data?.entries.slice(0, 3) ?? []
  const listEntries   = data?.entries.slice(3) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href="/leaderboard"
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-emerald flex-shrink-0" />
              <h1 className="font-mono text-2xl font-bold text-white">Bridge Builders</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
              Citizens who vote against their own partisan lean — following the argument,
              not the tribe. Ranked by cross-lean bridge moments across civic categories.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Refresh leaderboard"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tier legend */}
        <div className="grid grid-cols-5 gap-1.5">
          {TIER_ORDER.map((tier) => {
            const cfg = TIER_CONFIG[tier]
            return (
              <div key={tier} className={cn('rounded-xl border px-2 py-2 text-center', cfg.bg, cfg.border)}>
                <div className={cn('h-1.5 w-1.5 rounded-full mx-auto mb-1', cfg.dot)} />
                <p className={cn('text-[9px] sm:text-[10px] font-mono font-semibold leading-tight', cfg.color)}>
                  {tier === 'consensus_seeker' ? 'Cons. Seeker' :
                   tier === 'occasional_bridge' ? 'Occasional' :
                   cfg.label}
                </p>
              </div>
            )
          })}
        </div>

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={GitMerge}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="Could not load the Bridge Builders leaderboard"
            description={error}
            actions={[{ label: 'Try again', onClick: fetchData, variant: 'secondary', icon: RefreshCw }]}
          />
        )}

        {/* My stats */}
        {!loading && data?.my_stats && (
          <MyStatsCard stats={data.my_stats} />
        )}

        {/* No data */}
        {!loading && data && data.entries.length === 0 && (
          <EmptyState
            icon={GitMerge}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No bridge data yet"
            description="Bridge moments emerge once enough citizens have established clear voting leans across multiple civic categories. Keep voting and check back soon."
          />
        )}

        {/* Podium */}
        {!loading && podiumEntries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-mono text-sm font-semibold text-white">Top Bridge Builders</h2>
              <span className="text-xs font-mono text-surface-500 ml-auto">
                {data!.total_eligible.toLocaleString()} qualified
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {podiumEntries.map((entry, i) => (
                <PodiumCard
                  key={entry.user_id}
                  entry={entry}
                  position={(i + 1) as 1 | 2 | 3}
                />
              ))}
            </div>
          </div>
        )}

        {/* Ranked list */}
        {!loading && listEntries.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {listEntries.map((entry) => (
                <BridgeRow
                  key={entry.user_id}
                  entry={entry}
                  isMe={entry.user_id === currentUserId}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* How it works */}
        {!loading && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
            <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald" />
              How the Bridge Score works
            </h3>
            <div className="space-y-3">
              {[
                {
                  icon: GitMerge,
                  color: 'text-emerald',
                  title: 'Bridge votes',
                  desc: 'A bridge vote happens when you vote AGAINST your established lean in a category. For example: if you normally vote ≥65% FOR in Economics but vote AGAINST on a specific Economics debate, that\'s a bridge moment.',
                },
                {
                  icon: Scale,
                  color: 'text-for-400',
                  title: 'Rate multiplier',
                  desc: 'Citizens who bridge frequently get a rate bonus. A 40% bridge rate means your bridge votes are worth 1.4× — rewarding consistent independent thinking over one-off moments.',
                },
                {
                  icon: Tag,
                  color: 'text-gold',
                  title: 'Category breadth',
                  desc: 'Each additional civic category where you\'ve had a bridge moment adds +2 to your score. Bridging across Economics AND Politics is worth more than bridging Economics twice.',
                },
                {
                  icon: Users,
                  color: 'text-purple',
                  title: 'Minimum threshold',
                  desc: 'You need at least 5 total votes across 2+ categories, plus a clear lean (≥65% FOR or ≤35% FOR) in a category before bridge moments can be detected.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0">
                    <item.icon className={cn('h-4 w-4', item.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">{item.title}</p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs font-mono text-surface-500 pt-1 border-t border-surface-300 leading-relaxed">
              Formula:{' '}
              <code className="text-emerald font-mono text-[10px]">
                score = bridge_votes × (1 + bridge_rate) + categories_bridged × 2
              </code>
            </p>
          </div>
        )}

        {/* Related links */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                href: '/bridge',
                label: 'My Bridge Profile',
                desc: 'Your personal cross-lean analytics',
                icon: GitMerge,
              },
              {
                href: '/leaderboard/dissent',
                label: 'Dissent Index',
                desc: 'Citizens who vote with the minority',
                icon: ThumbsDown,
              },
              {
                href: '/analytics/alignment',
                label: 'Alignment Analytics',
                desc: 'How you align with the platform',
                icon: BarChart2,
              },
              {
                href: '/leaderboard/calibration',
                label: 'Oracle Rankings',
                desc: 'Most accurate vote predictions',
                icon: ThumbsUp,
              },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 flex items-center gap-3 transition-colors group"
              >
                <div className="h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center flex-shrink-0">
                  <link.icon className="h-4 w-4 text-surface-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-mono font-semibold text-white group-hover:text-for-400 transition-colors truncate">
                    {link.label}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 truncate">{link.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 ml-auto flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
