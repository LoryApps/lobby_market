'use client'

/**
 * /leaderboard/rising — The Rising Stars
 *
 * Shows who's climbing fastest over the past 7 days based on a momentum
 * score that rewards consistent activity: votes cast, arguments posted,
 * upvotes earned, and achievements unlocked.
 *
 * Unlike the main leaderboard (cumulative reputation), this surface gives
 * newer and improving users visibility — the focus is growth, not seniority.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  ChevronRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Rocket,
  TrendingUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  RisingEntry,
  RisingMyStats,
  RisingLeaderboardResponse,
} from '@/app/api/leaderboard/rising/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankColor(rank: number): string {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-surface-500'
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-gold/10 border-gold/30'
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-700/10 border-amber-700/30'
  return 'bg-surface-100/50 border-surface-300/20'
}

function roleLabel(role: string): string {
  switch (role) {
    case 'lawmaker': return 'Lawmaker'
    case 'senator': return 'Senator'
    case 'debator': return 'Debator'
    case 'troll_catcher': return 'Troll Catcher'
    case 'elder': return 'Elder'
    default: return 'Citizen'
  }
}

function roleColor(role: string): string {
  switch (role) {
    case 'lawmaker': return 'text-gold'
    case 'senator': return 'text-purple'
    case 'debator': return 'text-for-400'
    case 'elder': return 'text-emerald'
    default: return 'text-surface-500'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabId = 'overall' | 'voters' | 'arguers'

const TABS: { id: TabId; label: string; icon: typeof Vote; description: string }[] = [
  {
    id: 'overall',
    label: 'Momentum',
    icon: Rocket,
    description: 'Highest combined 7-day activity score',
  },
  {
    id: 'voters',
    label: 'Most Active',
    icon: Vote,
    description: 'Most votes cast in the last 7 days',
  },
  {
    id: 'arguers',
    label: 'Top Arguers',
    icon: MessageSquare,
    description: 'Most argument upvotes earned this week',
  },
]

// ─── Row component ─────────────────────────────────────────────────────────────

function RisingRow({
  entry,
  rank,
  tab,
  index,
}: {
  entry: RisingEntry
  rank: number
  tab: TabId
  index: number
}) {
  const primaryStat =
    tab === 'voters'
      ? { value: entry.votes_7d, label: `vote${entry.votes_7d !== 1 ? 's' : ''}` }
      : tab === 'arguers'
      ? { value: entry.upvotes_7d, label: `upvote${entry.upvotes_7d !== 1 ? 's' : ''}` }
      : { value: entry.momentum, label: 'momentum' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 p-3.5 rounded-2xl border transition-all',
          'hover:border-surface-400/60 hover:bg-surface-200/40',
          rankBg(rank)
        )}
      >
        {/* Rank */}
        <div
          className={cn(
            'flex-shrink-0 w-7 text-center font-mono text-sm font-bold',
            rankColor(rank)
          )}
        >
          {rank <= 3 ? (
            <span>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
          ) : (
            rank
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {entry.display_name || entry.username}
          </p>
          <p className={cn('text-[11px] font-mono truncate', roleColor(entry.role))}>
            {roleLabel(entry.role)} · @{entry.username}
          </p>
        </div>

        {/* Activity pills */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {entry.votes_7d > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-for-500/10 border border-for-500/20 text-for-400 text-[10px] font-mono">
              <Vote className="h-2.5 w-2.5" />
              {entry.votes_7d}
            </span>
          )}
          {entry.arguments_7d > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple/10 border border-purple/20 text-purple text-[10px] font-mono">
              <MessageSquare className="h-2.5 w-2.5" />
              {entry.arguments_7d}
            </span>
          )}
          {entry.achievements_7d > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-[10px] font-mono">
              <Award className="h-2.5 w-2.5" />
              {entry.achievements_7d}
            </span>
          )}
        </div>

        {/* Primary stat */}
        <div className="flex-shrink-0 text-right">
          <p className={cn('text-base font-mono font-bold tabular-nums', rankColor(rank))}>
            {primaryStat.value.toLocaleString()}
          </p>
          <p className="text-[10px] font-mono text-surface-500">{primaryStat.label}</p>
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── My stats card ────────────────────────────────────────────────────────────

function MyStatsCard({ stats, tab }: { stats: RisingMyStats; tab: TabId }) {
  const myRank =
    tab === 'overall' ? stats.overallRank : tab === 'voters' ? stats.voterRank : stats.arguerRank

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl bg-for-600/10 border border-for-500/30 p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-mono text-for-400 font-semibold uppercase tracking-wider">
          Your 7-Day Stats
        </p>
        {myRank ? (
          <Badge variant="active" size="sm">
            #{myRank} this week
          </Badge>
        ) : (
          <span className="text-xs font-mono text-surface-500">Not ranked yet</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Votes', value: stats.votes_7d, color: 'text-for-400', icon: Vote },
          { label: 'Arguments', value: stats.arguments_7d, color: 'text-purple', icon: MessageSquare },
          { label: 'Upvotes', value: stats.upvotes_7d, color: 'text-emerald', icon: TrendingUp },
          { label: 'Achievements', value: stats.achievements_7d, color: 'text-gold', icon: Award },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="text-center">
            <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
            <p className={cn('text-lg font-mono font-bold tabular-nums', color)}>
              <AnimatedNumber value={value} />
            </p>
            <p className="text-[10px] font-mono text-surface-500">{label}</p>
          </div>
        ))}
      </div>
      {stats.momentum === 0 && (
        <p className="mt-3 text-xs text-surface-500 font-mono text-center">
          Cast a vote or post an argument to appear on the leaderboard
        </p>
      )}
    </motion.div>
  )
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function RisingSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface-100 border border-surface-300/50 animate-pulse"
        >
          <Skeleton className="h-5 w-6 rounded" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-8 w-14 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function RisingLeaderboardPage() {
  const [data, setData] = useState<RisingLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<TabId>('overall')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard/rising', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as RisingLeaderboardResponse
        setData(json)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const entries =
    data == null ? [] : tab === 'overall' ? data.overall : tab === 'voters' ? data.voters : data.arguers

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Leaderboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                <Rocket className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Rising Stars</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Most momentum in the last 7 days
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0 mt-1"
            >
              <RefreshCw
                className={cn('h-4 w-4 text-surface-400', refreshing && 'animate-spin')}
              />
            </button>
          </div>

          {data && (
            <p className="mt-3 text-xs font-mono text-surface-500 flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5" />
              Tracking activity since{' '}
              <span className="text-surface-300">{formatDate(data.weekStart)}</span>
              {' '}· Resets weekly
            </p>
          )}
        </div>

        {/* How it works callout */}
        <div className="rounded-xl bg-surface-200/40 border border-surface-300/40 px-4 py-3 mb-5 flex items-start gap-3">
          <Flame className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            Momentum score = votes × 1 · arguments × 5 · argument upvotes × 2 · achievements × 15.
            Rewards consistent engagement, not just total clout.
          </p>
        </div>

        {/* My stats */}
        {data?.myStats && data.myStats.momentum > 0 && (
          <MyStatsCard stats={data.myStats} tab={tab} />
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 mb-4 p-1 rounded-xl bg-surface-200/60 border border-surface-300/40">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                  active
                    ? 'bg-surface-100 text-white shadow-sm border border-surface-400/30'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.label.split(' ')[0]}</span>
              </button>
            )
          })}
        </div>

        {/* Tab description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-xs font-mono text-surface-500 mb-3"
          >
            {TABS.find((t) => t.id === tab)?.description}
          </motion.p>
        </AnimatePresence>

        {/* List */}
        {loading ? (
          <RisingSkeleton />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Zap className="h-8 w-8 text-surface-500" />}
            title="No activity yet"
            description="Cast a vote or post an argument to appear on this week's Rising Stars board."
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
              >
                Go to Feed
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {entries.map((entry, i) => (
                <RisingRow
                  key={entry.user_id}
                  entry={entry}
                  rank={i + 1}
                  tab={tab}
                  index={i}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer links */}
        <div className="mt-8 pt-6 border-t border-surface-300/30 grid grid-cols-2 gap-3">
          {[
            { href: '/leaderboard', label: 'All-Time Board', icon: Trophy },
            { href: '/leaderboard/week', label: 'This Week', icon: BarChart2 },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between p-3 rounded-xl bg-surface-100/60 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-all group"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  {label}
                </span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
