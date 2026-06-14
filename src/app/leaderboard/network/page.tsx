'use client'

/**
 * /leaderboard/network — Network Influence Leaderboard
 *
 * Ranks citizens by their social reach and bridge-building on Lobby Market.
 * Three sort modes reveal different dimensions of network impact:
 *
 *   Influence Score  — composite: followers × 10 + influencer bonus + coalition bridges × 30
 *   Reach            — estimated 2nd-degree audience size
 *   Bridge Builders  — ranked by coalition memberships (cross-community connectors)
 *
 * Tiers:
 *   Viral        (≥5,000) — platform-wide voice with massive following
 *   Influencer   (≥2,000) — major voice across multiple communities
 *   Connector    (≥1,000) — well-networked across coalitions and debates
 *   Networker    (≥300)   — building meaningful civic connections
 *   Participant  (<300)   — early-stage network presence
 *
 * Distinct from:
 *   /leaderboard/engagement — well-roundedness across 5 participation dimensions
 *   /leaderboard/reputation — civic reputation score from votes + topics + laws
 *   /leaderboard/impact     — argument influence on vote shifts
 *   /network                — your personal network topology
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  Globe,
  Info,
  Network,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
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
  NetworkLeaderEntry,
  NetworkMyStats,
  NetworkSort,
  NetworkTier,
  NetworkLeaderboardResponse,
} from '@/app/api/leaderboard/network/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<NetworkTier, {
  label: string
  threshold: string
  color: string
  bg: string
  border: string
  badge: string
  icon: typeof Crown
}> = {
  viral: {
    label: 'Viral',
    threshold: '≥5,000',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple',
    icon: Radio,
  },
  influencer: {
    label: 'Influencer',
    threshold: '≥2,000',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold',
    icon: Star,
  },
  connector: {
    label: 'Connector',
    threshold: '≥1,000',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400',
    icon: Network,
  },
  networker: {
    label: 'Networker',
    threshold: '≥300',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badge: 'bg-emerald/20 text-emerald',
    icon: Users,
  },
  participant: {
    label: 'Participant',
    threshold: '<300',
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    badge: 'bg-surface-300/60 text-surface-400',
    icon: Globe,
  },
}

const SORT_TABS: { id: NetworkSort; label: string; description: string }[] = [
  { id: 'score', label: 'Influence Score', description: 'Composite: followers + coalition bridging + influencer status' },
  { id: 'reach', label: 'Reach', description: 'Estimated 2nd-degree audience size' },
  { id: 'bridge', label: 'Bridge Builders', description: 'Most coalition memberships — connecting diverse communities' },
]

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  position,
  sort,
}: {
  entry: NetworkLeaderEntry
  position: 1 | 2 | 3
  sort: NetworkSort
}) {
  const tier = TIER_CONFIG[entry.tier]
  const TierIcon = tier.icon
  const medalColor =
    position === 1 ? 'text-gold border-gold/40 bg-gold/10'
    : position === 2 ? 'text-surface-400 border-surface-500/40 bg-surface-200'
    : 'text-amber-600 border-amber-600/40 bg-amber-600/10'

  const primaryValue =
    sort === 'reach' ? fmtNum(entry.reach_estimate)
    : sort === 'bridge' ? entry.coalition_count.toString()
    : fmtNum(entry.network_score)

  const primaryLabel =
    sort === 'reach' ? 'Reach'
    : sort === 'bridge' ? 'Coalitions'
    : 'Score'

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
        <Link
          href={`/profile/${entry.username}`}
          className="font-mono text-sm font-semibold text-white hover:text-for-400 transition-colors"
        >
          {entry.display_name ?? `@${entry.username}`}
        </Link>
        <div className={cn('mt-1 inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full', tier.badge)}>
          <TierIcon className="h-3 w-3" />
          {tier.label}
        </div>
      </div>
      <div className={cn('rounded-xl border px-3 py-2 w-full', tier.bg, tier.border)}>
        <p className={cn('text-lg font-mono font-bold', tier.color)}>{primaryValue}</p>
        <p className="text-[10px] font-mono text-surface-500">{primaryLabel}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full text-center text-[10px] font-mono text-surface-500">
        <div>
          <p className="text-sm font-bold text-white">{fmtNum(entry.followers_count)}</p>
          <p>Followers</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{fmtNum(entry.reach_estimate)}</p>
          <p>Reach</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{entry.coalition_count}</p>
          <p>Coalitions</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function NetworkRow({
  entry,
  isMe,
  sort,
}: {
  entry: NetworkLeaderEntry
  isMe: boolean
  sort: NetworkSort
}) {
  const tier = TIER_CONFIG[entry.tier]
  const rankColor =
    entry.rank <= 3
      ? entry.rank === 1 ? 'text-gold'
      : entry.rank === 2 ? 'text-surface-400'
      : 'text-amber-600'
    : 'text-surface-500'

  const primaryValue =
    sort === 'reach' ? fmtNum(entry.reach_estimate)
    : sort === 'bridge' ? entry.coalition_count.toString()
    : fmtNum(entry.network_score)

  const primaryLabel =
    sort === 'reach' ? 'reach'
    : sort === 'bridge' ? 'coalitions'
    : 'score'

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
            {entry.is_influencer && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-mono text-gold bg-gold/10 border border-gold/30 px-1.5 py-0.5 rounded-full">
                <Zap className="h-2.5 w-2.5" />
                Influencer
              </span>
            )}
          </p>
          <p className="text-[11px] font-mono text-surface-500 truncate">@{entry.username}</p>
        </div>
      </Link>

      {/* Tier badge */}
      <span className={cn('hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-full px-2 py-0.5 flex-shrink-0', tier.badge)}>
        {tier.label}
      </span>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-mono text-surface-500">{fmtNum(entry.followers_count)} followers</p>
          <p className="text-[10px] font-mono text-surface-400">{entry.coalition_count} coalitions</p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-mono font-bold', tier.color)}>{primaryValue}</p>
          <p className="text-[10px] font-mono text-surface-500">{primaryLabel}</p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats, platformAvg }: { stats: NetworkMyStats; platformAvg: number }) {
  const tier = TIER_CONFIG[stats.tier]
  const TierIcon = tier.icon

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', tier.bg, tier.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Your Network</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-2xl font-mono font-bold', tier.color)}>
              {fmtNum(stats.network_score)}
            </span>
            <span className={cn('inline-flex items-center gap-1 text-xs font-mono font-semibold rounded-full px-2 py-0.5', tier.badge)}>
              <TierIcon className="h-3 w-3" />
              {tier.label}
            </span>
          </div>
          {stats.percentile !== null && (
            <p className="text-xs font-mono text-surface-500 mt-1">
              Top {100 - stats.percentile}% of networked citizens · Avg: {platformAvg.toLocaleString()} followers
            </p>
          )}
        </div>
        {stats.rank && (
          <div className="text-right">
            <p className="text-xs font-mono text-surface-500">Your rank</p>
            <p className="text-xl font-mono font-bold text-white">#{stats.rank}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Followers', value: fmtNum(stats.followers_count), icon: Users, sub: 'direct audience' },
          { label: 'Est. Reach', value: fmtNum(stats.reach_estimate), icon: Globe, sub: '2nd-degree' },
          { label: 'Coalitions', value: stats.coalition_count.toString(), icon: Shield, sub: 'bridge building' },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-3 text-center"
          >
            <s.icon className="h-4 w-4 mx-auto mb-1 text-surface-500" />
            <p className="text-lg font-mono font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">{s.label}</p>
            <p className="text-[9px] font-mono text-surface-600">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tier legend ──────────────────────────────────────────────────────────────

function TierLegend({ activeSort }: { activeSort: NetworkSort }) {
  const tiers: NetworkTier[] = ['viral', 'influencer', 'connector', 'networker', 'participant']
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-surface-500" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
          {activeSort === 'bridge' ? 'Bridge Score' : activeSort === 'reach' ? 'Reach Tiers' : 'Network Influence Tiers'}
        </span>
      </div>
      {tiers.map((tier) => {
        const cfg = TIER_CONFIG[tier]
        const Icon = cfg.icon
        return (
          <div key={tier} className="flex items-center gap-3">
            <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold rounded-full px-2 py-0.5 flex-shrink-0 w-24', cfg.badge)}>
              <Icon className="h-3 w-3" />
              {cfg.label}
            </span>
            <span className="text-[11px] font-mono text-surface-400">{cfg.threshold} score</span>
          </div>
        )
      })}
      <p className="text-[10px] font-mono text-surface-600 pt-2 border-t border-surface-300/60">
        Score = followers × 10 + influencer bonus (500) + coalitions × 30
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NetworkLeaderboardPage() {
  const [sort, setSort] = useState<NetworkSort>('score')
  const [data, setData] = useState<NetworkLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const load = useCallback(async (s: NetworkSort) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/leaderboard/network?sort=${s}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as NetworkLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the Network Leaderboard. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(sort) }, [sort, load])

  const handleSortChange = (s: NetworkSort) => {
    if (s === sort) return
    setSort(s)
  }

  const podiumEntries = data?.entries.slice(0, 3) ?? []
  const listEntries = data?.entries.slice(3) ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white flex items-center gap-2">
                <Network className="h-6 w-6 text-for-400" />
                Network Influence
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Citizens ranked by social reach, coalition bridging, and influence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfo((v) => !v)}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
                showInfo
                  ? 'bg-for-500/20 border-for-500/40 text-for-400'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
              )}
              aria-label="Toggle tier info"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={() => load(sort)}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </motion.div>

        {/* ── Tier legend (collapsible) ── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <TierLegend activeSort={sort} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sort tabs ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {SORT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleSortChange(tab.id)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-xl text-sm font-mono font-semibold border transition-all',
                sort === tab.id
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
              title={tab.description}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── My stats ── */}
        {data?.my_stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <MyStatsCard stats={data.my_stats} platformAvg={data.platform_avg_followers} />
          </motion.div>
        )}

        {/* ── Loading state ── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Error state ── */}
        {!loading && error && (
          <EmptyState
            icon={Network}
            title="Couldn't load leaderboard"
            description={error}
            action={{ label: 'Try again', onClick: () => load(sort) }}
          />
        )}

        {/* ── Podium (top 3) ── */}
        {!loading && !error && data && (
          <>
            {podiumEntries.length >= 3 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="mb-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-gold" />
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Top Network Citizens</span>
                  <span className="ml-auto text-xs font-mono text-surface-600">
                    {data.total_citizens.toLocaleString()} networked citizens
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <PodiumCard entry={podiumEntries[1]} position={2} sort={sort} />
                  <PodiumCard entry={podiumEntries[0]} position={1} sort={sort} />
                  <PodiumCard entry={podiumEntries[2]} position={3} sort={sort} />
                </div>
              </motion.div>
            )}

            {/* ── Ranked list (4–100) ── */}
            {listEntries.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                    {sort === 'bridge' ? 'Coalition Bridge Builders'
                      : sort === 'reach' ? 'Widest Reach'
                      : 'Highest Influence Score'}
                  </span>
                </div>
                {listEntries.map((entry) => (
                  <NetworkRow
                    key={entry.user_id}
                    entry={entry}
                    isMe={false}
                    sort={sort}
                  />
                ))}
              </div>
            )}

            {/* ── Empty state ── */}
            {data.entries.length === 0 && (
              <EmptyState
                icon={Network}
                title="No networked citizens yet"
                description="Follow other citizens to build your network presence."
                action={{ label: 'Find citizens to follow', href: '/citizens' }}
              />
            )}

            {/* ── Footer ── */}
            {data.entries.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8 pt-6 border-t border-surface-300/60 text-center"
              >
                <p className="text-[11px] font-mono text-surface-600">
                  Showing top {data.entries.length} of {data.total_citizens.toLocaleString()} networked citizens ·{' '}
                  Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex items-center justify-center gap-4 mt-3">
                  <Link
                    href="/following"
                    className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                  >
                    Your following feed →
                  </Link>
                  <Link
                    href="/coalitions"
                    className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                  >
                    Browse coalitions →
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                  >
                    All leaderboards →
                  </Link>
                </div>
              </motion.div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
