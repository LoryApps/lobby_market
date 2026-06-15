'use client'

/**
 * /leaderboard/velocity — Civic Velocity Rankings
 *
 * Who is growing the FASTEST right now, independent of seniority?
 *
 * Velocity = recent contributions (votes, arguments, upvotes, achievements)
 * normalised by sqrt(account_age_days) — so a newcomer who posts 10 great
 * arguments this week can outrank a veteran with 1,000 reputation but no
 * recent activity.
 *
 * Three ranked views:
 *   Overall Velocity — composite growth score
 *   Clout Surge      — biggest clout gain (via upvotes) in 7 days
 *   Argument Surge   — most upvotes on arguments posted this week
 *
 * Distinct from:
 *   /leaderboard/rising  — momentum based on raw activity counts
 *   /leaderboard/reputation — cumulative all-time reputation
 *   /leaderboard/streaks — consistency, not growth rate
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Coins,
  Crown,
  Flame,
  Medal,
  MessageSquare,
  RefreshCw,
  Rocket,
  Sparkles,
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
  VelocityEntry,
  VelocityLeaderboardResponse,
} from '@/app/api/leaderboard/velocity/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtAge(days: number): string {
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}yr`
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-300 flex-shrink-0" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600 flex-shrink-0" />
  return (
    <span className="text-xs font-mono text-surface-500 w-4 text-center flex-shrink-0">
      {rank}
    </span>
  )
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-700/10 border-amber-700/30'
  return 'bg-surface-100/50 border-surface-300/20'
}

function VelocityBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0
  return (
    <div className="h-1 w-16 rounded-full bg-surface-200 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="h-full rounded-full bg-gradient-to-r from-for-600 to-purple"
      />
    </div>
  )
}

function StatChip({ icon: Icon, value, color }: { icon: typeof Vote; value: string | number; color: string }) {
  return (
    <span className={cn('flex items-center gap-0.5 text-[10px] font-mono', color)}>
      <Icon className="h-2.5 w-2.5" />
      {value}
    </span>
  )
}

// ─── User row ─────────────────────────────────────────────────────────────────

function VelocityRow({
  entry,
  view,
  index,
  maxScore,
}: {
  entry: VelocityEntry
  view: View
  index: number
  maxScore: number
}) {
  const rank = index + 1

  const primaryMetric =
    view === 'clout'
      ? `+${fmtNum(entry.clout_7d_est)} C`
      : view === 'arguers'
        ? `${fmtNum(entry.upvotes_7d)} ↑`
        : entry.velocity_score.toFixed(1)

  const primaryColor =
    view === 'clout' ? 'text-gold' : view === 'arguers' ? 'text-purple' : 'text-for-300'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors hover:border-surface-400/60',
          rankBg(rank)
        )}
      >
        <RankMedal rank={rank} />

        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
        />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {entry.display_name || entry.username}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {entry.votes_7d > 0 && (
              <StatChip icon={Vote} value={entry.votes_7d} color="text-for-400" />
            )}
            {entry.arguments_7d > 0 && (
              <StatChip icon={MessageSquare} value={entry.arguments_7d} color="text-purple" />
            )}
            {entry.upvotes_7d > 0 && (
              <StatChip icon={Zap} value={`${entry.upvotes_7d}↑`} color="text-emerald" />
            )}
            {entry.achievements_7d > 0 && (
              <StatChip icon={Trophy} value={entry.achievements_7d} color="text-gold" />
            )}
            <span className="text-[10px] font-mono text-surface-600">
              {fmtAge(entry.account_age_days)} old
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className={cn('text-sm font-mono font-bold', primaryColor)}>
            {primaryMetric}
          </span>
          {view === 'overall' && (
            <VelocityBar score={entry.velocity_score} max={maxScore} />
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300"
        >
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-5 w-12 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── View tabs ────────────────────────────────────────────────────────────────

type View = 'overall' | 'clout' | 'arguers'

const VIEWS: { id: View; label: string; icon: typeof Rocket; description: string }[] = [
  {
    id: 'overall',
    label: 'Velocity',
    icon: Rocket,
    description: 'Composite growth score · dampened by account age so newcomers can compete',
  },
  {
    id: 'clout',
    label: 'Clout Surge',
    icon: Coins,
    description: 'Biggest estimated clout gain from argument upvotes this week',
  },
  {
    id: 'arguers',
    label: 'Argument Surge',
    icon: MessageSquare,
    description: 'Most upvotes received on arguments posted in the last 7 days',
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function VelocityLeaderboardPage() {
  const [data, setData] = useState<VelocityLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('overall')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/velocity')
      if (!res.ok) throw new Error('Failed to load velocity data')
      const json = (await res.json()) as VelocityLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the Velocity leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const activeList =
    view === 'overall'
      ? data?.overall ?? []
      : view === 'clout'
        ? data?.byCloutGain ?? []
        : data?.byArguerVelocity ?? []

  const maxScore =
    view === 'overall' && activeList.length > 0
      ? (activeList[0] as VelocityEntry).velocity_score
      : 0

  const myStats = data?.myStats

  const weekLabel = data?.weekStart
    ? new Date(data.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/leaderboard"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-white" />
            </Link>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight flex items-center gap-2">
                <Rocket className="h-5 w-5 text-for-300" />
                Civic Velocity
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Who&rsquo;s growing the fastest?{weekLabel ? ` · Since ${weekLabel}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4 text-white', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── How velocity works ───────────────────────────────────────────── */}
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            <span className="text-white font-semibold">Velocity</span> rewards recent effort — not
            seniority. A citizen who voted 10×, posted 3 arguments, and earned 2 achievements this
            week can outrank someone with 5,000 reputation but no recent activity.
            Score is dampened by account age so newcomers can compete on equal footing.
          </p>
        </div>

        {/* ── My stats ────────────────────────────────────────────────────── */}
        {myStats && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-100 border border-for-500/30 p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-for-300">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider">
                Your Week
              </span>
              {myStats.overallRank && (
                <span className="ml-auto text-xs font-mono text-surface-400">
                  Rank <span className="text-white font-semibold">#{myStats.overallRank}</span>
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Vote, value: myStats.votes_7d, label: 'Votes', color: 'text-for-400' },
                { icon: MessageSquare, value: myStats.arguments_7d, label: 'Args', color: 'text-purple' },
                { icon: Zap, value: myStats.upvotes_7d, label: 'Upvotes', color: 'text-emerald' },
                { icon: Trophy, value: myStats.achievements_7d, label: 'Badges', color: 'text-gold' },
              ].map(({ icon: Icon, value, label, color }) => (
                <div key={label} className="text-center">
                  <Icon className={cn('h-3.5 w-3.5 mx-auto mb-0.5', color)} />
                  <p className="text-sm font-mono font-bold text-white">{value}</p>
                  <p className="text-[10px] font-mono text-surface-500">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-surface-300 text-[11px] font-mono">
              <span className="text-surface-400">
                Velocity score: <span className="text-white font-semibold">{myStats.velocity_score.toFixed(1)}</span>
              </span>
              <span className="text-surface-400">
                Account age: <span className="text-white">{fmtAge(myStats.account_age_days)}</span>
              </span>
            </div>
          </motion.div>
        )}

        {/* ── View tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 px-1.5 rounded-lg text-center transition-all',
                view === v.id
                  ? 'bg-surface-50 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <v.icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono font-semibold leading-tight">{v.label}</span>
            </button>
          ))}
        </div>

        <p className="text-xs font-mono text-surface-500 -mt-3">
          {VIEWS.find((v) => v.id === view)?.description}
        </p>

        {/* ── Leaderboard ──────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<Rocket className="h-8 w-8 text-surface-400" />}
                title="Could not load velocity"
                description={error}
                action={
                  <button
                    onClick={load}
                    className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
                  >
                    Try again
                  </button>
                }
              />
            </motion.div>
          ) : activeList.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <EmptyState
                icon={<Flame className="h-8 w-8 text-surface-400" />}
                title="No velocity data yet"
                description="Be active this week — vote, post arguments, earn achievements — and you'll appear here."
                action={
                  <Link
                    href="/"
                    className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
                  >
                    Go to Feed
                  </Link>
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key={`list-${view}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {activeList.map((entry, i) => (
                <VelocityRow
                  key={entry.user_id}
                  entry={entry}
                  view={view}
                  index={i}
                  maxScore={maxScore}
                />
              ))}
              {activeList.length >= 30 && (
                <p className="text-center text-xs font-mono text-surface-500 pt-2">
                  Showing top 30 · resets weekly
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Related ──────────────────────────────────────────────────────── */}
        <section className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
            Related Rankings
          </h2>
          {[
            { href: '/leaderboard/rising', label: 'Rising Stars', desc: '7-day momentum by activity volume' },
            { href: '/leaderboard/reputation', label: 'Reputation', desc: 'All-time cumulative reputation' },
            { href: '/leaderboard/streaks', label: 'Streak Masters', desc: 'Consecutive daily voting streaks' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between gap-2 py-2 border-b border-surface-300 last:border-0 hover:text-white transition-colors group"
            >
              <div>
                <p className="text-sm font-mono text-white group-hover:text-for-300 transition-colors">
                  {link.label}
                </p>
                <p className="text-[11px] font-mono text-surface-500">{link.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
            </Link>
          ))}
        </section>

        <div className="flex items-center justify-center pt-2">
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Leaderboards
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
