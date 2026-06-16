'use client'

/**
 * /leaderboard/proposals — The Proposal Makers Leaderboard
 *
 * Ranks citizens by the success of the civic topics they've submitted.
 * A proposal that becomes a law earns 15 pts; one that reaches the
 * voting phase earns 5; active debate earns 2; even a failed proposal
 * earns 1 for trying. Quality bonuses reward high law-conversion rates
 * and topics that attracted significant community debate.
 *
 * Tiers:
 *   Architect   (≥60)  — master proposal writers; multiple laws passed
 *   Visionary   (≥25)  — consistent high-traction topic submitters
 *   Advocate    (≥10)  — reliable contributors to the civic debate corpus
 *   Contributor (≥ 3)  — growing their proposal track record
 *   Newcomer    (< 3)  — first steps on the proposal path
 *
 * Distinct from:
 *   /leaderboard/lawmakers   — who voted FOR laws that passed (co-authors)
 *   /leaderboard/arguments   — who wrote the best arguments
 *   /leaderboard/impact      — overall influence score (multi-dimensional)
 *   /topics                  — the topics themselves, not their creators
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  ChevronRight,
  Crown,
  ExternalLink,
  FileText,
  Gavel,
  Lightbulb,
  RefreshCw,
  Scale,
  Sparkles,
  Trophy,
  TrendingUp,
  Wand2,
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
  ProposalLeaderEntry,
  ProposalMyStats,
  ProposalTier,
  ProposalLeaderboardResponse,
} from '@/app/api/leaderboard/proposals/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<ProposalTier, {
  label: string
  color: string
  bg: string
  border: string
  badge: string
  icon: React.ComponentType<{ className?: string }>
}> = {
  architect: {
    label: 'Architect',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold border-gold/30',
    icon: Crown,
  },
  visionary: {
    label: 'Visionary',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple border-purple/30',
    icon: Sparkles,
  },
  advocate: {
    label: 'Advocate',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400 border-for-500/30',
    icon: Lightbulb,
  },
  contributor: {
    label: 'Contributor',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badge: 'bg-emerald/20 text-emerald border-emerald/30',
    icon: FileText,
  },
  newcomer: {
    label: 'Newcomer',
    color: 'text-surface-500',
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/30',
    badge: 'bg-surface-300/40 text-surface-500 border-surface-400/30',
    icon: BookOpen,
  },
}

const RANK_MEDAL: Record<number, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  1: { icon: Crown, color: 'text-gold' },
  2: { icon: Trophy, color: 'text-surface-300' },
  3: { icon: Award, color: 'text-amber-700' },
}

// ─── Status breakdown mini-bar ────────────────────────────────────────────────

function StatusBreakdown({ entry }: { entry: ProposalLeaderEntry }) {
  const total = entry.total_topics
  if (total === 0) return null

  const lawPct    = (entry.law_count    / total) * 100
  const votingPct = (entry.voting_count / total) * 100
  const activePct = (entry.active_count / total) * 100
  const failedPct = (entry.failed_count / total) * 100
  const pendPct   = (entry.proposed_count / total) * 100

  return (
    <div className="flex items-center gap-0.5 h-1.5 w-full rounded-full overflow-hidden bg-surface-300/40">
      {entry.law_count    > 0 && <div style={{ width: `${lawPct}%`    }} className="h-full bg-emerald" />}
      {entry.voting_count > 0 && <div style={{ width: `${votingPct}%` }} className="h-full bg-purple" />}
      {entry.active_count > 0 && <div style={{ width: `${activePct}%` }} className="h-full bg-for-500" />}
      {entry.failed_count > 0 && <div style={{ width: `${failedPct}%` }} className="h-full bg-against-500" />}
      {entry.proposed_count > 0 && <div style={{ width: `${pendPct}%` }} className="h-full bg-surface-400" />}
    </div>
  )
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function ProposalRow({ entry, index }: { entry: ProposalLeaderEntry; index: number }) {
  const tier = TIER_CONFIG[entry.tier]
  const TierIcon = tier.icon
  const medal = RANK_MEDAL[entry.rank]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 p-3 sm:p-4 rounded-2xl border transition-all',
          'bg-surface-100 hover:bg-surface-200 hover:border-surface-400',
          entry.rank <= 3
            ? 'border-surface-400/70'
            : 'border-surface-300',
        )}
      >
        {/* Rank */}
        <div className="w-7 flex-shrink-0 text-center">
          {medal ? (
            <medal.icon className={cn('h-5 w-5 mx-auto', medal.color)} />
          ) : (
            <span className="text-sm font-mono font-bold text-surface-500">
              {entry.rank}
            </span>
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="md"
          className="flex-shrink-0"
        />

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">
              {entry.display_name ?? entry.username}
            </span>
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border',
                tier.badge,
              )}
            >
              <TierIcon className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
              {tier.label}
            </span>
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5 truncate">
            @{entry.username}
          </p>

          {/* Status breakdown bar */}
          <div className="mt-2">
            <StatusBreakdown entry={entry} />
          </div>

          {/* Stat row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {entry.law_count > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-emerald">
                <Gavel className="h-3 w-3" />
                {entry.law_count} law{entry.law_count !== 1 ? 's' : ''}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <FileText className="h-3 w-3" />
              {entry.total_topics} topic{entry.total_topics !== 1 ? 's' : ''}
            </span>
            {entry.law_rate > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-gold">
                <TrendingUp className="h-3 w-3" />
                {entry.law_rate}% law rate
              </span>
            )}
            {entry.avg_votes > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                <BarChart2 className="h-3 w-3" />
                avg {entry.avg_votes.toLocaleString()} votes
              </span>
            )}
          </div>
        </div>

        {/* Score */}
        <div className="flex-shrink-0 text-right">
          <p className={cn('text-base font-mono font-bold', tier.color)}>
            {entry.proposal_score.toFixed(0)}
          </p>
          <p className="text-[10px] font-mono text-surface-500">pts</p>
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 hidden sm:block" />
      </Link>
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats }: { stats: ProposalMyStats }) {
  const tier = TIER_CONFIG[stats.tier]
  const TierIcon = tier.icon

  return (
    <div className={cn('rounded-2xl border p-4', tier.bg, tier.border)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TierIcon className={cn('h-4 w-4', tier.color)} />
          <span className={cn('text-sm font-mono font-bold', tier.color)}>
            Your Proposal Stats
          </span>
        </div>
        {stats.rank && (
          <span className="text-xs font-mono text-surface-500">
            #{stats.rank} overall
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xl font-mono font-bold text-white">
            <AnimatedNumber value={stats.total_topics} />
          </p>
          <p className="text-[10px] font-mono text-surface-500">submitted</p>
        </div>
        <div>
          <p className="text-xl font-mono font-bold text-emerald">
            <AnimatedNumber value={stats.law_count} />
          </p>
          <p className="text-[10px] font-mono text-surface-500">laws passed</p>
        </div>
        <div>
          <p className="text-xl font-mono font-bold text-gold">
            <AnimatedNumber value={Math.round(stats.proposal_score)} />
          </p>
          <p className="text-[10px] font-mono text-surface-500">score</p>
        </div>
      </div>

      {stats.law_rate > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-300/40 flex items-center justify-between text-xs font-mono">
          <span className="text-surface-500">Law conversion rate</span>
          <span className="text-gold font-semibold">{stats.law_rate}%</span>
        </div>
      )}

      {!stats.rank && (
        <p className="mt-3 text-xs text-surface-500 font-mono text-center">
          Submit a topic that gains traction to appear on this leaderboard.
        </p>
      )}
    </div>
  )
}

// ─── Platform stats bar ───────────────────────────────────────────────────────

function PlatformBar({
  total_topics,
  total_laws,
  platform_law_rate,
  avg_votes_per_topic,
}: ProposalLeaderboardResponse['platform']) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Topics submitted', value: total_topics.toLocaleString(), icon: FileText, color: 'text-for-400' },
        { label: 'Laws established', value: total_laws.toLocaleString(), icon: Gavel, color: 'text-emerald' },
        { label: 'Platform law rate', value: `${platform_law_rate}%`, icon: TrendingUp, color: 'text-gold' },
        { label: 'Avg votes/topic', value: avg_votes_per_topic.toLocaleString(), icon: BarChart2, color: 'text-purple' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center"
        >
          <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
          <p className={cn('text-lg font-mono font-bold', color)}>{value}</p>
          <p className="text-[10px] font-mono text-surface-500">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProposalSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-5 w-7" />
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-10" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalLeaderboardPage() {
  const [data, setData] = useState<ProposalLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard/proposals', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Leaderboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Wand2 className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Proposal Makers
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Citizens ranked by the success of their civic proposals
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0 mt-1"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Scoring legend */}
        <div className="mb-6 p-4 rounded-2xl border border-surface-300 bg-surface-100">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="h-4 w-4 text-for-400" />
            <span className="text-xs font-mono font-semibold text-surface-300 uppercase tracking-widest">
              Scoring formula
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: 'Law passed', pts: '15 pts', color: 'text-emerald', icon: Gavel },
              { label: 'Voting phase', pts: '5 pts', color: 'text-purple', icon: Scale },
              { label: 'Active debate', pts: '2 pts', color: 'text-for-400', icon: Zap },
              { label: 'Failed topic', pts: '1 pt', color: 'text-against-400', icon: FileText },
              { label: 'Quality bonus', pts: '+ rate', color: 'text-gold', icon: Sparkles },
            ].map(({ label, pts, color, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center p-2 rounded-lg bg-surface-200/60 text-center">
                <Icon className={cn('h-3.5 w-3.5 mb-1', color)} />
                <p className={cn('text-sm font-mono font-bold', color)}>{pts}</p>
                <p className="text-[10px] text-surface-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <ProposalSkeleton />
          </div>
        ) : !data ? (
          <EmptyState
            icon={Wand2}
            title="Data unavailable"
            description="Could not load the Proposal Makers leaderboard. Try refreshing."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Platform stats */}
              <PlatformBar {...data.platform} />

              {/* My stats */}
              {data.my_stats && (
                <MyStatsCard stats={data.my_stats} />
              )}

              {/* Tier legend */}
              <div className="flex flex-wrap gap-2">
                {(Object.entries(TIER_CONFIG) as [ProposalTier, typeof TIER_CONFIG[ProposalTier]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon
                  return (
                    <div
                      key={key}
                      className={cn(
                        'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border',
                        cfg.badge,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </div>
                  )
                })}
              </div>

              {/* Leaderboard */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-mono text-surface-500">
                    {data.total_participants.toLocaleString()} citizens ranked
                    · {data.platform.total_proposers.toLocaleString()} total proposers
                  </p>
                  <p className="text-xs font-mono text-surface-500">
                    Top 100 shown
                  </p>
                </div>

                {data.entries.length === 0 ? (
                  <EmptyState
                    icon={Wand2}
                    title="No proposals yet"
                    description="Be the first to submit a topic that gains community traction."
                    actions={[{ label: 'Submit a topic', href: '/topic/create', icon: Wand2, variant: 'primary' }]}
                  />
                ) : (
                  <div className="space-y-2">
                    {data.entries.map((entry, idx) => (
                      <ProposalRow key={entry.user_id} entry={entry} index={idx} />
                    ))}
                  </div>
                )}
              </div>

              {/* Status legend */}
              <div className="p-4 rounded-2xl border border-surface-300 bg-surface-100">
                <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-widest">
                  Status bar legend
                </p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { color: 'bg-emerald', label: 'Became law' },
                    { color: 'bg-purple', label: 'In voting' },
                    { color: 'bg-for-500', label: 'Active debate' },
                    { color: 'bg-against-500', label: 'Failed' },
                    { color: 'bg-surface-400', label: 'Pending' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={cn('h-2 w-4 rounded-sm', color)} />
                      <span className="text-[11px] font-mono text-surface-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/topic/create"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                >
                  <Wand2 className="h-4 w-4" />
                  Submit a new topic
                </Link>
                <Link
                  href="/topics"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-200 hover:bg-surface-300 border border-surface-300 text-surface-300 hover:text-white text-sm font-mono font-semibold transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Browse all topics
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
