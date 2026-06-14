'use client'

/**
 * /leaderboard/reputation — Reputation Leaderboard
 *
 * Ranks all citizens by their civic reputation score — a composite metric
 * earned through votes cast (×1), topics authored (×5), and laws passed (×50).
 *
 * Tiers (matching the /reputation page milestones):
 *   Legend   (≥10,000) — prolific lawmaker with deep civic history
 *   Lawmaker (≥5,000)  — has shaped national policy through persistent debate
 *   Senator  (≥2,000)  — consistent participant with law-making track record
 *   Elder    (≥1,000)  — long-standing member with significant contributions
 *   Debator  (≥500)    — active debater building meaningful reputation
 *   Citizen  (<500)    — early-stage civic journey
 *
 * Distinct from:
 *   /leaderboard         — overall ranking by clout + votes
 *   /leaderboard/grades  — argument quality ranking (A–F grades)
 *   /reputation          — your personal reputation breakdown
 *   /karma               — holistic five-dimension credit score
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Crown,
  FileText,
  Gavel,
  Info,
  RefreshCw,
  Shield,
  Sparkles,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RepLeaderEntry,
  RepMyStats,
  RepTier,
  RepLeaderboardResponse,
} from '@/app/api/leaderboard/reputation/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<RepTier, {
  label: string
  threshold: string
  color: string
  bg: string
  border: string
  badge: string
  icon: typeof Crown
}> = {
  legend: {
    label: 'Legend',
    threshold: '≥10,000',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple',
    icon: Crown,
  },
  lawmaker: {
    label: 'Lawmaker',
    threshold: '≥5,000',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold',
    icon: Gavel,
  },
  senator: {
    label: 'Senator',
    threshold: '≥2,000',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400',
    icon: Shield,
  },
  elder: {
    label: 'Elder',
    threshold: '≥1,000',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    badge: 'bg-emerald-500/20 text-emerald-400',
    icon: Sparkles,
  },
  debator: {
    label: 'Debator',
    threshold: '≥500',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    badge: 'bg-against-500/20 text-against-400',
    icon: BarChart2,
  },
  citizen: {
    label: 'Citizen',
    threshold: '<500',
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    badge: 'bg-surface-300/60 text-surface-400',
    icon: ThumbsUp,
  },
}

const TIER_ORDER: RepTier[] = ['legend', 'lawmaker', 'senator', 'elder', 'debator', 'citizen']

function fmtScore(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({ entry, position }: { entry: RepLeaderEntry; position: 1 | 2 | 3 }) {
  const tier = TIER_CONFIG[entry.tier]
  const TierIcon = tier.icon
  const medalColor =
    position === 1 ? 'text-gold border-gold/40 bg-gold/10'
    : position === 2 ? 'text-surface-400 border-surface-500/40 bg-surface-200'
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
        <p className={cn('text-lg font-mono font-bold', tier.color)}>{fmtScore(entry.reputation_score)}</p>
        <p className="text-[10px] font-mono text-surface-500">Reputation</p>
      </div>
      <div className="grid grid-cols-3 gap-2 w-full text-center text-[10px] font-mono text-surface-500">
        <div>
          <p className="text-sm font-bold text-white">{entry.total_votes.toLocaleString()}</p>
          <p>Votes</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{entry.topics_authored}</p>
          <p>Topics</p>
        </div>
        <div>
          <p className="text-sm font-bold text-white">{entry.laws_authored}</p>
          <p>Laws</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function RepRow({ entry, isMe }: { entry: RepLeaderEntry; isMe: boolean }) {
  const tier = TIER_CONFIG[entry.tier]
  const rankColor =
    entry.rank <= 3
      ? entry.rank === 1 ? 'text-gold'
      : entry.rank === 2 ? 'text-surface-400'
      : 'text-amber-600'
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
      <span className={cn('hidden sm:inline-flex items-center gap-1 text-[10px] font-mono font-semibold rounded-full px-2 py-0.5 flex-shrink-0', tier.badge)}>
        {tier.label}
      </span>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-shrink-0 text-right">
        <div className="hidden sm:block text-right">
          <p className="text-xs font-mono text-surface-500">{entry.total_votes.toLocaleString()} votes</p>
          <p className="text-[10px] font-mono text-surface-400">{entry.laws_authored} laws</p>
        </div>
        <div className="text-right">
          <p className={cn('text-sm font-mono font-bold', tier.color)}>{fmtScore(entry.reputation_score)}</p>
          <p className="text-[10px] font-mono text-surface-500">rep</p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats, platformAvg }: { stats: RepMyStats; platformAvg: number }) {
  const tier = TIER_CONFIG[stats.tier]
  const TierIcon = tier.icon
  const nextTier = TIER_ORDER[TIER_ORDER.indexOf(stats.tier) - 1]
  const nextCfg = nextTier ? TIER_CONFIG[nextTier] : null
  const nextThreshold = nextTier
    ? ({ legend: 10000, lawmaker: 5000, senator: 2000, elder: 1000, debator: 500, citizen: 0 }[nextTier])
    : null

  return (
    <div className={cn('rounded-2xl border p-5 space-y-4', tier.bg, tier.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Your Reputation</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-2xl font-mono font-bold', tier.color)}>
              {fmtScore(stats.reputation_score)}
            </span>
            <span className={cn('inline-flex items-center gap-1 text-xs font-mono font-semibold rounded-full px-2 py-0.5', tier.badge)}>
              <TierIcon className="h-3 w-3" />
              {tier.label}
            </span>
          </div>
          {stats.percentile !== null && (
            <p className="text-xs font-mono text-surface-500 mt-1">
              Top {100 - stats.percentile}% of citizens · Avg: {fmtScore(platformAvg)}
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
          { label: 'Votes Cast', value: stats.total_votes.toLocaleString(), icon: Vote, points: '+1 each' },
          { label: 'Topics Filed', value: stats.topics_authored, icon: FileText, points: '+5 each' },
          { label: 'Laws Passed', value: stats.laws_authored, icon: Gavel, points: '+50 each' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-surface-200/50 border border-surface-300 p-3">
            <s.icon className="h-4 w-4 text-surface-500 mb-1" />
            <p className="text-base font-mono font-bold text-white">{s.value}</p>
            <p className="text-[10px] font-mono text-surface-500">{s.label}</p>
            <p className="text-[10px] font-mono text-surface-400 mt-0.5">{s.points}</p>
          </div>
        ))}
      </div>

      {nextCfg && nextThreshold !== null && nextThreshold > stats.reputation_score && (
        <div className="rounded-xl bg-surface-200/50 border border-surface-300 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-mono text-surface-500">Next tier: <span className={nextCfg.color}>{nextCfg.label}</span></p>
            <p className="text-xs font-mono text-surface-500">{fmtScore(nextThreshold - stats.reputation_score)} away</p>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300">
            <div
              className={cn('h-full rounded-full transition-all', nextCfg.color.replace('text-', 'bg-'))}
              style={{ width: `${Math.min(100, (stats.reputation_score / nextThreshold) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <Link
        href="/reputation"
        className="flex items-center gap-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
        View full reputation breakdown
        <ArrowRight className="h-3.5 w-3.5 ml-auto" />
      </Link>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReputationLeaderboardPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RepLeaderboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, userRes] = await Promise.all([
        fetch('/api/leaderboard/reputation', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
      ])
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as RepLeaderboardResponse
      setData(json)
      if (userRes.ok) {
        const userData = await userRes.json() as { id?: string }
        if (userData.id) setCurrentUserId(userData.id)
      }
    } catch {
      setError('Could not load the Reputation Leaderboard. Try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const podiumEntries = (data?.entries ?? []).slice(0, 3)
  const listEntries = (data?.entries ?? []).slice(3)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href="/leaderboard"
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white">Reputation Leaderboard</h1>
            <p className="text-sm font-mono text-surface-500 mt-1 leading-relaxed">
              Citizens ranked by civic reputation — earned through voting, authoring topics, and passing laws.
              {data && (
                <span className="ml-1 text-surface-400">{data.total_citizens.toLocaleString()} citizens ranked.</span>
              )}
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            aria-label="Refresh leaderboard"
            className="mt-1 h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center hover:bg-surface-300 transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Tier legend */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {TIER_ORDER.map((tier) => {
            const cfg = TIER_CONFIG[tier]
            const TierIcon = cfg.icon
            return (
              <div key={tier} className={cn('rounded-xl border px-2 py-2 text-center', cfg.bg, cfg.border)}>
                <TierIcon className={cn('h-3.5 w-3.5 mx-auto mb-1', cfg.color)} />
                <p className={cn('text-[10px] font-mono font-semibold', cfg.color)}>{cfg.label}</p>
                <p className="text-[9px] font-mono text-surface-500">{cfg.threshold}</p>
              </div>
            )
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}
            </div>
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={Shield}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Could not load the Reputation Leaderboard"
            description={error}
            actions={[{ label: 'Try again', onClick: fetchData, variant: 'secondary', icon: RefreshCw }]}
          />
        )}

        {/* My stats */}
        {!loading && data?.my_stats && (
          <MyStatsCard stats={data.my_stats} platformAvg={data.platform_avg} />
        )}

        {/* No data */}
        {!loading && data && data.entries.length === 0 && (
          <EmptyState
            icon={Trophy}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No reputation data yet"
            description="Reputation is earned by voting on topics, proposing debates, and having your topics become law. Start participating to appear here."
            actions={[{ label: 'Browse topics', href: '/', icon: Zap }]}
          />
        )}

        {/* Podium */}
        {!loading && podiumEntries.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="font-mono text-sm font-semibold text-white">Top Citizens</h2>
              <span className="text-xs font-mono text-surface-500 ml-auto">
                Avg: {fmtScore(data!.platform_avg)} rep
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
                <RepRow
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
              <Info className="h-4 w-4 text-for-400" />
              How Reputation is Earned
            </h3>
            <div className="space-y-3">
              {[
                {
                  icon: Vote,
                  color: 'text-for-400',
                  title: 'Voting (+1 each)',
                  desc: 'Every vote cast on any active or resolved topic adds 1 reputation point. Cast more votes to build your civic record.',
                },
                {
                  icon: FileText,
                  color: 'text-purple',
                  title: 'Topic authorship (+5 each)',
                  desc: 'Proposing a topic for debate earns 5 reputation points per topic — regardless of whether it passes or fails.',
                },
                {
                  icon: Gavel,
                  color: 'text-gold',
                  title: 'Law authorship (+50 each)',
                  desc: 'When a topic you authored achieves consensus and becomes law, you earn 50 reputation points — the highest single reward.',
                },
                {
                  icon: Crown,
                  color: 'text-purple',
                  title: 'Tier progression',
                  desc: 'Reach 500 points to become a Debator, 1,000 for Elder, 2,000 for Senator, 5,000 for Lawmaker, and 10,000 for Legend status.',
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
              Formula: <code className="text-for-400 font-mono text-[10px]">rep = votes×1 + topics×5 + laws×50</code>
            </p>
          </div>
        )}

        {/* Related links */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/reputation', label: 'My Reputation', desc: 'Full personal breakdown', icon: BarChart2 },
            { href: '/leaderboard/grades', label: 'Argument Quality', desc: 'Ranked by AI grade score', icon: Trophy },
            { href: '/leaderboard/impact', label: 'Civic Impact', desc: 'Law authorship impact scores', icon: Gavel },
            { href: '/karma', label: 'Civic Karma', desc: 'Five-dimension credit score', icon: Sparkles },
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
