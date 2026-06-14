'use client'

/**
 * /leaderboard/dissent — The Dissent Index
 *
 * Celebrates the Lobby's most principled contrarians: citizens who consistently
 * vote in the losing minority AND back their position with well-argued, upvoted
 * arguments. Independent thinkers who refuse to follow the crowd.
 *
 * Dissent Score = minority_votes × (1 + dissent_rate) + minority_args × 3 + minority_upvotes
 *
 * Tiers:
 *   Iconoclast  (≥200) — legendary dissenter, shapes the minority record
 *   Rebel       (≥80)  — consistent contrarian with strong argument output
 *   Challenger  (≥25)  — regularly challenges consensus positions
 *   Skeptic     (≥8)   — occasionally swims against the tide
 *   Observer    (<8)   — early dissent journey
 *
 * Distinct from:
 *   /leaderboard/calibration  — most ACCURATE voters (winning side)
 *   /analytics/contrarian     — personal contrarian deep-dive
 *   /analytics/alignment      — alignment vs. platform majority
 *   /fingerprint              — uniqueness of civic voice
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Flame,
  RefreshCw,
  Scale,
  Shuffle,
  Sparkles,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DissentEntry,
  DissentMyStats,
  DissentTier,
  DissentLeaderboardResponse,
} from '@/app/api/leaderboard/dissent/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<DissentTier, {
  label: string
  color: string
  bg: string
  border: string
  badge: string
}> = {
  iconoclast: {
    label: 'Iconoclast',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple',
  },
  rebel: {
    label: 'Rebel',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    badge: 'bg-against-500/20 text-against-400',
  },
  challenger: {
    label: 'Challenger',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold',
  },
  skeptic: {
    label: 'Skeptic',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400',
  },
  observer: {
    label: 'Observer',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    badge: 'bg-surface-300 text-surface-500',
  },
}

const TIER_ORDER: DissentTier[] = ['iconoclast', 'rebel', 'challenger', 'skeptic', 'observer']

// ─── Podium ───────────────────────────────────────────────────────────────────

function PodiumCard({ entry, position }: { entry: DissentEntry; position: 1 | 2 | 3 }) {
  const tier = TIER_CONFIG[entry.tier]
  const medalColor =
    position === 1 ? 'text-gold border-gold/40 bg-gold/10'
    : position === 2 ? 'text-surface-600 border-surface-500/40 bg-surface-200'
    : 'text-amber-600 border-amber-600/40 bg-amber-600/10'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.08 }}
      className={cn(
        'rounded-2xl border p-4 flex flex-col items-center gap-3 text-center',
        position === 1 ? 'bg-surface-100 border-gold/30' : 'bg-surface-100 border-surface-300',
        position !== 1 && 'mt-4'
      )}
    >
      <div className={cn('h-7 w-7 rounded-full border-2 flex items-center justify-center text-sm font-mono font-bold', medalColor)}>
        {position}
      </div>
      <Link href={`/profile/${entry.username}`}>
        <Avatar src={entry.avatar_url} username={entry.username} size="lg" />
      </Link>
      <div>
        <Link href={`/profile/${entry.username}`} className="font-mono text-sm font-semibold text-white hover:text-for-400 transition-colors">
          {entry.display_name ?? `@${entry.username}`}
        </Link>
        <div className={cn('text-xs font-mono mt-1 px-2 py-0.5 rounded-full inline-block', tier.badge)}>
          {tier.label}
        </div>
      </div>
      <div className={cn('rounded-xl border px-3 py-2 w-full', tier.bg, tier.border)}>
        <p className={cn('text-lg font-mono font-bold', tier.color)}>{entry.dissent_score}</p>
        <p className="text-[10px] font-mono text-surface-500">Dissent Score</p>
      </div>
      <div className="grid grid-cols-2 gap-2 w-full text-center">
        <div>
          <p className="text-sm font-mono font-semibold text-white">{entry.minority_votes}</p>
          <p className="text-[10px] font-mono text-surface-500">Minority Votes</p>
        </div>
        <div>
          <p className="text-sm font-mono font-semibold text-white">{entry.dissent_rate}%</p>
          <p className="text-[10px] font-mono text-surface-500">Dissent Rate</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function DissentRow({ entry, isMe }: { entry: DissentEntry; isMe: boolean }) {
  const tier = TIER_CONFIG[entry.tier]
  const rankColor =
    entry.rank <= 3 ? (entry.rank === 1 ? 'text-gold' : entry.rank === 2 ? 'text-surface-600' : 'text-amber-600')
    : 'text-surface-500'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors',
        isMe
          ? 'bg-for-900/30 border-for-500/30'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Rank */}
      <span className={cn('w-7 text-center text-sm font-mono font-bold flex-shrink-0', rankColor)}>
        {entry.rank}
      </span>

      {/* Avatar + name */}
      <Link href={`/profile/${entry.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
        <Avatar src={entry.avatar_url} username={entry.username} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-mono font-semibold text-white truncate">
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

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-mono text-surface-500">{entry.minority_votes} votes</p>
          <p className="text-[10px] font-mono text-surface-400">{entry.dissent_rate}% rate</p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-mono font-bold', tier.color)}>{entry.dissent_score}</p>
          <p className="text-[10px] font-mono text-surface-500">score</p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats }: { stats: DissentMyStats }) {
  const tier = TIER_CONFIG[stats.tier]
  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', tier.bg, tier.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Your Dissent Profile</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-2xl font-mono font-bold', tier.color)}>{stats.dissent_score}</span>
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
          { label: 'Minority Votes', value: stats.minority_votes, icon: Scale },
          { label: 'Dissent Rate', value: `${stats.dissent_rate}%`, icon: Shuffle },
          { label: 'Minority Args', value: stats.minority_arguments, icon: BarChart2 },
          { label: 'Upvotes Earned', value: stats.minority_upvotes, icon: Zap },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-200/50 border border-surface-300 p-3">
            <s.icon className="h-4 w-4 text-surface-500 mb-1" />
            <p className="text-base font-mono font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-mono text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function DissentLeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DissentLeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch leaderboard and current user id in parallel
      const [res, userRes] = await Promise.all([
        fetch('/api/leaderboard/dissent', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
      ])
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as DissentLeaderboardResponse
      setData(json)
      if (userRes.ok) {
        const userData = await userRes.json() as { id?: string }
        if (userData.id) setCurrentUserId(userData.id)
      }
    } catch {
      setError('Could not load the Dissent Index. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const podiumEntries = data?.entries.slice(0, 3) ?? []
  const listEntries = data?.entries.slice(3) ?? []

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
            <h1 className="font-mono text-2xl font-bold text-white">The Dissent Index</h1>
            <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
              The Lobby&apos;s most principled contrarians — citizens who consistently vote in the minority and argue their case anyway.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0 disabled:opacity-50"
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
                <p className={cn('text-[10px] font-mono font-semibold', cfg.color)}>{cfg.label}</p>
              </div>
            )
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
            </div>
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={Scale}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Could not load the Dissent Index"
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
            icon={Shuffle}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No dissent data yet"
            description="The Dissent Index requires civic topics to fully resolve. Check back once more debates have concluded."
          />
        )}

        {/* Podium */}
        {!loading && podiumEntries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-mono text-sm font-semibold text-white">Top Dissenters</h2>
              <span className="text-xs font-mono text-surface-500 ml-auto">
                {data!.total_eligible.toLocaleString()} eligible
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {podiumEntries.map((entry, i) => (
                <PodiumCard key={entry.user_id} entry={entry} position={(i + 1) as 1 | 2 | 3} />
              ))}
            </div>
          </div>
        )}

        {/* Ranked list */}
        {!loading && listEntries.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {listEntries.map((entry) => (
                <DissentRow
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
              <Sparkles className="h-4 w-4 text-purple" />
              How the Dissent Score works
            </h3>
            <div className="space-y-3">
              {[
                {
                  icon: Scale,
                  color: 'text-against-400',
                  title: 'Minority votes',
                  desc: 'Every vote you cast on the losing side of a resolved debate — voted FOR on a topic that failed, or AGAINST on a topic that became law.',
                },
                {
                  icon: Shuffle,
                  color: 'text-purple',
                  title: 'Dissent rate bonus',
                  desc: 'Citizens who dissent chronically earn a multiplier. A 60% dissent rate doubles your minority vote contribution.',
                },
                {
                  icon: BarChart2,
                  color: 'text-for-400',
                  title: 'Argument quality',
                  desc: 'Arguments posted on the losing side earn 3 points each. Upvotes received on those arguments add 1 point each.',
                },
                {
                  icon: Flame,
                  color: 'text-gold',
                  title: 'Minimum threshold',
                  desc: 'At least 5 resolved votes required to appear on the index. Noble Dissent requires genuine engagement.',
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
              Formula: <code className="text-purple font-mono text-[10px]">score = minority_votes × (1 + dissent_rate) + minority_args × 3 + minority_upvotes</code>
            </p>
          </div>
        )}

        {/* Links to related leaderboards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/leaderboard/calibration', label: 'Oracle Rankings', desc: 'Most accurate voters', icon: ThumbsUp },
            { href: '/analytics/contrarian', label: 'My Contrarian Stats', desc: 'Your dissent deep-dive', icon: Shuffle },
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
                <p className="text-sm font-mono font-semibold text-white group-hover:text-for-400 transition-colors">{link.label}</p>
                <p className="text-[11px] font-mono text-surface-500">{link.desc}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-500 ml-auto flex-shrink-0" />
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
