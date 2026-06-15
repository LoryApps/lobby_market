'use client'

/**
 * /leaderboard/tribunal — The Civic Tribunal Leaderboard
 *
 * Two views of platform-wide civic justice:
 *
 *   Jurors      — citizens who serve most as tribunal jurors, ranked by
 *                 service count weighted by verdict accuracy.
 *                 Score = verdicts_cast × 2 + correct_verdicts × 3
 *
 *   Challengers — citizens who most accurately identify bad-faith arguments,
 *                 ranked by challenges that result in a sustained verdict.
 *
 * Tiers (Jurors):
 *   Chief Justice  (≥150) — legendary service record
 *   Senior Juror   (≥60)  — trusted deliberator
 *   Juror          (≥20)  — established member
 *   Associate      (≥5)   — early service
 *   Observer       (<5)   — learning the ropes
 *
 * Distinct from:
 *   /tribunal            — live case browser (open/deliberating cases)
 *   /moderation          — moderator queue (elevated privileges)
 *   /leaderboard/dissent — contrarians by voting pattern (not justice system)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Gavel,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  TribunalJurorEntry,
  TribunalChallengerEntry,
  TribunalMyStats,
  TribunalStats,
  TribunalLeaderboardResponse,
  TribunalTier,
} from '@/app/api/leaderboard/tribunal/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<TribunalTier, {
  label: string
  color: string
  bg: string
  border: string
  badge: string
}> = {
  chief_justice: {
    label: 'Chief Justice',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badge: 'bg-gold/20 text-gold',
  },
  senior_juror: {
    label: 'Senior Juror',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 text-for-400',
  },
  juror: {
    label: 'Juror',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badge: 'bg-emerald/20 text-emerald',
  },
  associate: {
    label: 'Associate',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    badge: 'bg-purple/20 text-purple',
  },
  observer: {
    label: 'Observer',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    badge: 'bg-surface-300 text-surface-500',
  },
}

// ─── Medal helpers ────────────────────────────────────────────────────────────

function rankIcon(rank: number) {
  if (rank === 1) return <Trophy className="h-4 w-4 text-gold" />
  if (rank === 2) return <Trophy className="h-4 w-4 text-surface-400" />
  if (rank === 3) return <Trophy className="h-4 w-4 text-amber-600" />
  return null
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300">
      <Skeleton className="h-4 w-6" />
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {[0, 1, 2].map(i => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1">
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

// ─── Juror row ────────────────────────────────────────────────────────────────

function JurorRow({ entry, isMe }: { entry: TribunalJurorEntry; isMe: boolean }) {
  const tier = TIER_CONFIG[entry.tier]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        isMe
          ? 'bg-for-600/10 border-for-500/40 ring-1 ring-for-500/20'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Rank */}
      <div className="w-6 flex-shrink-0 text-center">
        {rankIcon(entry.rank) ?? (
          <span className="text-xs font-mono text-surface-500">{entry.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
        <Avatar src={entry.avatar_url} fallback={entry.display_name || entry.username} size="sm" />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/profile/${entry.username}`}
            className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {entry.display_name || entry.username}
          </Link>
          <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', tier.badge, tier.border)}>
            {tier.label}
          </span>
          {isMe && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-for-600/20 border border-for-500/40 text-for-400">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-surface-500 font-mono">
          <span>{entry.verdicts_cast} verdicts</span>
          <span className="text-emerald">{pct(entry.accuracy)} accuracy</span>
          <span>{entry.cases_served} cases</span>
        </div>
      </div>

      {/* Score */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold font-mono text-white">
          <AnimatedNumber value={entry.juror_score} />
        </div>
        <div className="text-[10px] text-surface-500">score</div>
      </div>
    </motion.div>
  )
}

// ─── Challenger row ───────────────────────────────────────────────────────────

function ChallengerRow({ entry, isMe }: { entry: TribunalChallengerEntry; isMe: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors',
        isMe
          ? 'bg-for-600/10 border-for-500/40 ring-1 ring-for-500/20'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Rank */}
      <div className="w-6 flex-shrink-0 text-center">
        {rankIcon(entry.rank) ?? (
          <span className="text-xs font-mono text-surface-500">{entry.rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
        <Avatar src={entry.avatar_url} fallback={entry.display_name || entry.username} size="sm" />
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Link
            href={`/profile/${entry.username}`}
            className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {entry.display_name || entry.username}
          </Link>
          {isMe && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-for-600/20 border border-for-500/40 text-for-400">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-surface-500 font-mono">
          <span>{entry.total_challenges} raised</span>
          <span className="text-emerald">{entry.sustained_challenges} sustained</span>
          {entry.pending_challenges > 0 && (
            <span className="text-gold">{entry.pending_challenges} pending</span>
          )}
        </div>
      </div>

      {/* Accuracy */}
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold font-mono text-white">
          {pct(entry.accuracy)}
        </div>
        <div className="text-[10px] text-surface-500">accuracy</div>
      </div>
    </motion.div>
  )
}

// ─── Stats banner ─────────────────────────────────────────────────────────────

function StatsBanner({ stats }: { stats: TribunalStats }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-5">
      {[
        { label: 'Total Cases',  value: stats.total_cases,      color: 'text-white' },
        { label: 'Sustained',    value: stats.sustained_total,  color: 'text-against-400' },
        { label: 'Dismissed',    value: stats.dismissed_total,  color: 'text-for-400' },
      ].map(s => (
        <div key={s.label} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
          <div className={cn('text-xl font-bold font-mono', s.color)}>
            <AnimatedNumber value={s.value} />
          </div>
          <div className="text-[10px] text-surface-500 mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── My Stats panel ──────────────────────────────────────────────────────────

function MyStatPanel({ stats }: { stats: TribunalMyStats }) {
  const tier = TIER_CONFIG[stats.juror_tier]
  return (
    <div className="rounded-xl bg-for-600/10 border border-for-500/30 p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-for-400" />
          <span className="text-sm font-semibold text-for-300">Your Tribunal Record</span>
        </div>
        <span className={cn('text-xs font-mono px-2 py-0.5 rounded-full', tier.badge, tier.border)}>
          {tier.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-surface-400">
        <div>
          <div className="text-white font-bold">{stats.verdicts_cast}</div>
          <div>verdicts cast</div>
        </div>
        <div>
          <div className="text-emerald font-bold">{pct(stats.juror_accuracy)}</div>
          <div>juror accuracy</div>
        </div>
        <div>
          <div className="text-white font-bold">{stats.total_challenges}</div>
          <div>challenges raised</div>
        </div>
        <div>
          <div className="text-gold font-bold">
            {stats.juror_rank ? `#${stats.juror_rank}` : '—'}
          </div>
          <div>juror rank</div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'jurors' | 'challengers'

export default function TribunalLeaderboardPage() {
  const [data, setData] = useState<TribunalLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('jurors')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard/tribunal', { cache: 'no-store' })
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
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-100 border border-surface-300 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Gavel className="h-5 w-5 text-gold" />
              Tribunal Leaderboard
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Top jurors and challengers in the Civic Tribunal
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-100 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats banner */}
        {loading
          ? <StatsSkeleton />
          : data?.stats
            ? <StatsBanner stats={data.stats} />
            : null
        }

        {/* My stats */}
        {data?.my_stats && <MyStatPanel stats={data.my_stats} />}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-surface-100 border border-surface-300">
          {([
            { id: 'jurors' as Tab,      icon: Scale,  label: 'Jurors',      desc: 'Service record' },
            { id: 'challengers' as Tab, icon: Swords, label: 'Challengers', desc: 'Challenge accuracy' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex flex-col items-center py-2 px-3 rounded-lg text-xs font-mono transition-all',
                tab === t.id
                  ? 'bg-surface-200 text-white border border-surface-400 shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <t.icon className="h-4 w-4 mb-0.5" />
              <span className="font-semibold">{t.label}</span>
              <span className="text-[10px] text-surface-500">{t.desc}</span>
            </button>
          ))}
        </div>

        {/* List */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map(i => <RowSkeleton key={i} />)}
            </motion.div>
          ) : tab === 'jurors' ? (
            <motion.div key="jurors" className="space-y-2">
              {data?.jurors.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No jurors yet"
                  description="The Tribunal needs citizens with Debator+ roles to serve as jurors. Cast your first verdict to appear here."
                  action={<Link href="/tribunal" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-sm font-mono hover:bg-gold/30 transition-colors">View open cases <ArrowRight className="h-3.5 w-3.5" /></Link>}
                />
              ) : (
                data?.jurors.map(entry => (
                  <JurorRow
                    key={entry.user_id}
                    entry={entry}
                    isMe={data.my_stats?.juror_rank === entry.rank}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="challengers" className="space-y-2">
              {data?.challengers.length === 0 ? (
                <EmptyState
                  icon={Swords}
                  title="No challengers yet"
                  description="Citizens challenge arguments they believe are misleading or fallacious. Successful challengers appear here."
                  action={<Link href="/tribunal" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-sm font-mono hover:bg-gold/30 transition-colors">Browse arguments <ArrowRight className="h-3.5 w-3.5" /></Link>}
                />
              ) : (
                data?.challengers.map(entry => (
                  <ChallengerRow
                    key={entry.user_id}
                    entry={entry}
                    isMe={data.my_stats?.challenger_rank === entry.rank}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* How it works */}
        <div className="mt-8 rounded-xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart2 className="h-4 w-4 text-surface-500" />
            <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">How it works</h2>
          </div>
          <div className="space-y-3 text-xs text-surface-500">
            <div className="flex gap-3">
              <Scale className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-white font-semibold">Juror Score</span> = verdicts cast × 2 + correct verdicts × 3.
                Minimum {3} deliberating verdicts to rank. Accuracy is how often your verdict matched the final outcome.
              </div>
            </div>
            <div className="flex gap-3">
              <Swords className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-white font-semibold">Challenger Accuracy</span> = sustained challenges ÷ resolved challenges.
                Each argument needs 3 challenges to open a Tribunal case. When the jury votes ⅔ &quot;sustained&quot;, the argument is flagged.
              </div>
            </div>
            <div className="flex gap-3">
              <Shield className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-white font-semibold">Jurors earn +5 Clout</span> per decided verdict they participate in.
                Only citizens with <span className="text-for-400">Debator+</span> role can serve as jurors.
              </div>
            </div>
          </div>
        </div>

        {/* Navigation footer */}
        <div className="mt-4 flex items-center justify-between">
          <Link
            href="/leaderboard"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Leaderboards
          </Link>
          <Link
            href="/tribunal"
            className="flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors font-mono"
          >
            Open Tribunal Cases
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
