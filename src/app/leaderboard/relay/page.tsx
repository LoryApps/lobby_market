'use client'

/**
 * /leaderboard/relay — Relay Runners Leaderboard
 *
 * Ranks citizens by their contributions to Civic Relays — the
 * collaborative argument-chaining format where up to 5 citizens
 * build a collective case FOR or AGAINST a topic.
 *
 * Relay Score = legs_written × 2 + relays_completed × 5
 *             + compelling_rate × 0.1 + compelling_votes × 0.5
 *
 * Tiers:
 *   Relay Master  (≥50) — veteran collaborative debater
 *   Chain Builder (≥20) — active relay participant
 *   Link          (≥8)  — meaningful contributor
 *   Newcomer      (<8)  — just getting started
 *
 * Distinct from:
 *   /relay              — the relay hub itself (start / join relays)
 *   /leaderboard/arena  — solo argument faceoffs, not collaborative
 *   /leaderboard/arguments — solo argument volume
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  Link2,
  Loader2,
  Medal,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  RelayLeaderEntry,
  RelayMyStats,
  RelayTier,
  RelayLeaderboardResponse,
} from '@/app/api/leaderboard/relay/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<RelayTier, {
  label: string
  color: string
  bg: string
  border: string
  badge: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  relay_master: {
    label: 'Relay Master',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple',
    icon: Trophy,
  },
  chain_builder: {
    label: 'Chain Builder',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold',
    icon: Link2,
  },
  link: {
    label: 'Link',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400',
    icon: Zap,
  },
  newcomer: {
    label: 'Newcomer',
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    badge: 'bg-surface-300 text-surface-400',
    icon: Users,
  },
}

// ─── Podium card (top 3) ──────────────────────────────────────────────────────

function PodiumCard({
  entry,
  pos,
  isMe,
}: {
  entry: RelayLeaderEntry
  pos: 1 | 2 | 3
  isMe: boolean
}) {
  const tier = TIER_CONFIG[entry.tier]
  const MEDAL_COLOR = {
    1: 'text-gold',
    2: 'text-surface-400',
    3: 'text-amber-700',
  }[pos]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: pos * 0.05 }}
      className={cn(
        'relative flex flex-col items-center gap-2 p-4 rounded-2xl border',
        'bg-surface-100 border-surface-300',
        pos === 1 && 'border-gold/40 bg-gold/5',
        isMe && 'ring-1 ring-for-500/50',
      )}
    >
      {pos === 1 && (
        <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-5 text-gold" />
      )}
      <div className="relative">
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="md"
        />
        <span className={cn(
          'absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-surface-200 border border-surface-300',
          'flex items-center justify-center text-[10px] font-mono font-bold',
          MEDAL_COLOR,
        )}>
          {pos}
        </span>
      </div>
      <div className="text-center min-w-0 w-full">
        <Link
          href={`/profile/${entry.username}`}
          className="text-xs font-mono font-semibold text-white hover:text-for-400 transition-colors truncate block"
        >
          {entry.display_name ?? entry.username}
        </Link>
        <span className={cn('text-[10px] font-mono font-semibold rounded-full px-1.5 py-0.5', tier.badge)}>
          {tier.label}
        </span>
      </div>
      <div className="text-center">
        <p className={cn('text-lg font-mono font-bold', tier.color)}>
          <AnimatedNumber value={entry.relay_score} />
        </p>
        <p className="text-[10px] font-mono text-surface-500">score</p>
      </div>
      <div className="grid grid-cols-2 gap-1 w-full">
        <div className="rounded bg-surface-200/60 p-1.5 text-center">
          <p className="text-xs font-mono font-bold text-white">{entry.legs_written}</p>
          <p className="text-[9px] font-mono text-surface-500">legs</p>
        </div>
        <div className="rounded bg-surface-200/60 p-1.5 text-center">
          <p className="text-xs font-mono font-bold text-white">{entry.relays_completed}</p>
          <p className="text-[9px] font-mono text-surface-500">completed</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── List entry ───────────────────────────────────────────────────────────────

function LeaderEntry({
  entry,
  isMe,
}: {
  entry: RelayLeaderEntry
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
      <span className="w-7 text-xs font-mono font-bold text-surface-500 flex-shrink-0 text-right">
        #{entry.rank}
      </span>

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

      <span className={cn('hidden sm:inline-flex text-[10px] font-mono font-semibold rounded-full px-2 py-0.5 flex-shrink-0', tier.badge)}>
        {tier.label}
      </span>

      <div className="hidden md:flex items-center gap-1 text-[10px] font-mono text-surface-500 flex-shrink-0">
        <Link2 className="h-3 w-3" />
        {entry.legs_written} legs
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-mono text-surface-500">{entry.relays_started} started</p>
          <p className="text-[10px] font-mono text-surface-400">{entry.compelling_rate}% compelling</p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-mono font-bold', tier.color)}>{entry.relay_score}</p>
          <p className="text-[10px] font-mono text-surface-500">score</p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats }: { stats: RelayMyStats }) {
  const tier = TIER_CONFIG[stats.tier]
  const TierIcon = tier.icon

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', tier.bg, tier.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Your Relay Profile</p>
          <div className="flex items-center gap-2 mt-1">
            <TierIcon className={cn('h-4 w-4', tier.color)} />
            <span className={cn('text-2xl font-mono font-bold', tier.color)}>
              {stats.relay_score}
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
          { label: 'Legs Written', value: stats.legs_written, icon: Link2 },
          { label: 'Relays Started', value: stats.relays_started, icon: Sparkles },
          { label: 'Completed', value: stats.relays_completed, icon: Medal },
          { label: 'Compelling Rate', value: `${stats.compelling_rate}%`, icon: ThumbsUp },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-200/50 border border-surface-300 p-3">
            <s.icon className="h-4 w-4 text-surface-500 mb-1" />
            <p className="text-base font-mono font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-mono text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>
      {stats.relay_score === 0 && (
        <p className="text-xs font-mono text-surface-500 leading-relaxed">
          Join a relay at{' '}
          <Link href="/relay" className="text-for-400 hover:underline">/relay</Link>{' '}
          to build your first collective argument chain. Each leg you write earns relay score.
        </p>
      )}
    </div>
  )
}

// ─── Platform stat pill ───────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 text-center">
      <p className="text-lg font-mono font-bold text-white">{value.toLocaleString()}</p>
      <p className="text-[10px] font-mono text-surface-500">{label}</p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
      </div>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RelayLeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RelayLeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, userRes] = await Promise.all([
        fetch('/api/leaderboard/relay', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
      ])
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as RelayLeaderboardResponse
      setData(json)
      if (userRes.ok) {
        const userData = await userRes.json() as { id?: string }
        if (userData.id) setCurrentUserId(userData.id)
      }
    } catch {
      setError('Could not load the Relay Runners Leaderboard. Try again.')
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
              <Link2 className="h-5 w-5 text-purple flex-shrink-0" />
              <h1 className="font-mono text-2xl font-bold text-white">Relay Runners</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
              The most dedicated builders of collaborative argument chains — citizens
              who write relay legs, launch new relays, and craft collective cases
              that the community finds compelling.
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Refresh leaderboard"
          >
            {loading
              ? <Loader2 className="h-4 w-4 text-surface-500 animate-spin" />
              : <RefreshCw className="h-4 w-4 text-surface-500" />
            }
          </button>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-mono font-semibold text-white">
            <Sparkles className="h-4 w-4 text-purple" />
            How Relay Score Works
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-surface-400">
            <div className="rounded-lg bg-surface-200/60 border border-surface-300 px-3 py-2">
              <p className="text-white font-semibold">+2 pts</p>
              <p>per leg written</p>
            </div>
            <div className="rounded-lg bg-surface-200/60 border border-surface-300 px-3 py-2">
              <p className="text-white font-semibold">+5 pts</p>
              <p>per relay completed</p>
            </div>
            <div className="rounded-lg bg-surface-200/60 border border-surface-300 px-3 py-2">
              <p className="text-white font-semibold">+0.5 pts</p>
              <p>per compelling vote</p>
            </div>
            <div className="rounded-lg bg-surface-200/60 border border-surface-300 px-3 py-2">
              <p className="text-white font-semibold">×bonus</p>
              <p>compelling rate</p>
            </div>
          </div>
          <Link
            href="/relay"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            <Link2 className="h-3 w-3" />
            Join or start a relay
          </Link>
        </div>

        {/* Platform stats */}
        {data && (
          <div className="grid grid-cols-3 gap-3">
            <StatPill label="Total Relays" value={data.platform_relays} />
            <StatPill label="Legs Written" value={data.platform_legs} />
            <StatPill label="Participants" value={data.total_participants} />
          </div>
        )}

        {/* My stats */}
        {data?.my_stats && (
          <AnimatePresence>
            <motion.div
              key="my-stats"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <MyStatsCard stats={data.my_stats} />
            </motion.div>
          </AnimatePresence>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-sm font-mono text-against-400">
            {error}
            <button onClick={fetchData} className="ml-2 underline">Retry</button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingSkeleton />
        ) : !data || data.entries.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No relay runners yet"
            description="Be the first to build a civic relay chain. Head to /relay to start or join one."
            action={{ label: 'Go to Relays', href: '/relay' }}
          />
        ) : (
          <>
            {/* Podium */}
            {podiumEntries.length >= 3 && (
              <div>
                <h2 className="font-mono text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Top Relay Runners
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {([1, 0, 2] as const).map((idx, pos) => {
                    const entry = podiumEntries[idx]
                    if (!entry) return null
                    return (
                      <PodiumCard
                        key={entry.user_id}
                        entry={entry}
                        pos={([2, 1, 3] as const)[pos]}
                        isMe={entry.user_id === currentUserId}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Tier sections */}
            {(
              ['relay_master', 'chain_builder', 'link', 'newcomer'] as RelayTier[]
            ).map((tier) => {
              const tierEntries = listEntries.filter((e) => e.tier === tier)
              if (tierEntries.length === 0) return null
              const cfg = TIER_CONFIG[tier]
              const TierIcon = cfg.icon
              return (
                <div key={tier}>
                  <div className={cn('flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg', cfg.bg)}>
                    <TierIcon className={cn('h-4 w-4 flex-shrink-0', cfg.color)} />
                    <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="ml-auto text-[10px] font-mono text-surface-500">
                      {tierEntries.length} citizen{tierEntries.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {tierEntries.map((entry) => (
                      <LeaderEntry
                        key={entry.user_id}
                        entry={entry}
                        isMe={entry.user_id === currentUserId}
                      />
                    ))}
                  </div>
                </div>
              )
            })}

            {/* CTA */}
            <div className="rounded-2xl border border-purple/30 bg-purple/5 p-5 text-center space-y-2">
              <Link2 className="h-8 w-8 text-purple mx-auto" />
              <p className="text-sm font-mono font-semibold text-white">
                Build your relay legacy
              </p>
              <p className="text-xs font-mono text-surface-500">
                Collaborative arguments carry more weight than solo ones. Start a relay,
                recruit contributors, and let the community judge your collective case.
              </p>
              <Link
                href="/relay"
                className="inline-flex items-center gap-2 rounded-xl bg-purple/20 border border-purple/30 text-purple text-xs font-mono font-semibold px-4 py-2 hover:bg-purple/30 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" />
                Go to Relays
              </Link>
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
