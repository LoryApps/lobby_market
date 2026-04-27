'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  MessageSquare,
  RefreshCw,
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
  TodayLeaderboardResponse,
  TodayEntry,
  TodayMyRanks,
} from '@/app/api/leaderboard/today/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TabId = 'voters' | 'arguers' | 'upvoted'

interface TabConfig {
  id: TabId
  label: string
  icon: typeof Vote
  metricLabel: string
  singularLabel: string
  accentText: string
  accentBg: string
  accentBorder: string
  accentRing: string
}

const TABS: TabConfig[] = [
  {
    id: 'voters',
    label: 'Most Active Voters',
    icon: Vote,
    metricLabel: 'votes today',
    singularLabel: 'vote',
    accentText: 'text-for-400',
    accentBg: 'bg-for-500/10',
    accentBorder: 'border-for-500/30',
    accentRing: 'ring-for-500/30',
  },
  {
    id: 'arguers',
    label: 'Top Arguers',
    icon: MessageSquare,
    metricLabel: 'arguments today',
    singularLabel: 'argument',
    accentText: 'text-purple',
    accentBg: 'bg-purple/10',
    accentBorder: 'border-purple/30',
    accentRing: 'ring-purple/30',
  },
  {
    id: 'upvoted',
    label: 'Most Upvoted',
    icon: ThumbsUp,
    metricLabel: 'upvotes received',
    singularLabel: 'upvote',
    accentText: 'text-emerald',
    accentBg: 'bg-emerald/10',
    accentBorder: 'border-emerald/30',
    accentRing: 'ring-emerald/30',
  },
]

function rankColor(rank: number): string {
  if (rank === 1) return 'text-gold'
  if (rank === 2) return 'text-surface-300'
  if (rank === 3) return 'text-amber-600'
  return 'text-surface-500'
}

function rankBg(rank: number): string {
  if (rank === 1) return `bg-gold/10 border-gold/30 ring-1 ring-gold/30`
  if (rank === 2) return 'bg-surface-300/10 border-surface-400/30'
  if (rank === 3) return 'bg-amber-700/10 border-amber-700/30'
  return 'bg-surface-100/50 border-surface-300/20'
}

function rankLabel(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    person: 'Citizen',
    debator: 'Debator',
    troll_catcher: 'Troll Catcher',
    elder: 'Elder',
    lawmaker: 'Lawmaker',
    senator: 'Senator',
  }
  return map[role] ?? role
}

function fmtCount(n: number, tabId: TabId): string {
  const cfg = TABS.find((t) => t.id === tabId)!
  const label = n === 1 ? cfg.singularLabel : cfg.metricLabel
  return `${n.toLocaleString()} ${label}`
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({
  entry,
  rank,
  cfg,
}: {
  entry: TodayEntry | undefined
  rank: number
  cfg: TabConfig
}) {
  const isFirst = rank === 1
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 flex flex-col items-center gap-2 transition-all',
        entry
          ? cn('bg-surface-100', rankBg(rank))
          : 'bg-surface-100 border-surface-300 opacity-40'
      )}
    >
      <div className={cn('text-xs font-mono font-bold uppercase tracking-wider', rankColor(rank))}>
        {rankLabel(rank)}
      </div>
      {entry ? (
        <>
          <Link href={`/profile/${entry.username}`}>
            <Avatar
              src={entry.avatar_url}
              fallback={entry.display_name || entry.username}
              size={isFirst ? 'lg' : 'md'}
              className="ring-2 ring-surface-300/50"
            />
          </Link>
          <Link
            href={`/profile/${entry.username}`}
            className={cn('font-semibold text-sm text-center hover:underline truncate max-w-full', isFirst ? 'text-base' : 'text-sm')}
          >
            {entry.display_name || entry.username}
          </Link>
          <span className={cn('text-xs font-mono font-bold', cfg.accentText)}>
            {entry.count.toLocaleString()}
          </span>
        </>
      ) : (
        <>
          <div className={cn('rounded-full bg-surface-300/30', isFirst ? 'h-14 w-14' : 'h-11 w-11')} />
          <span className="text-xs text-surface-500 font-mono">—</span>
        </>
      )}
    </div>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function LeaderRow({
  entry,
  rank,
  cfg,
  isMe,
}: {
  entry: TodayEntry
  rank: number
  cfg: TabConfig
  isMe: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.5) }}
      className={cn(
        'flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0 hover:bg-surface-200/40 transition-colors',
        isMe && 'bg-for-500/5'
      )}
    >
      <span className={cn('text-sm font-mono font-bold w-7 shrink-0 text-right', rankColor(rank))}>
        {rank}
      </span>
      <Link href={`/profile/${entry.username}`} className="shrink-0">
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${entry.username}`}
            className="font-semibold text-sm text-white hover:underline truncate"
          >
            {entry.display_name || entry.username}
          </Link>
          {isMe && (
            <span className="text-[10px] font-mono text-for-400 border border-for-500/30 bg-for-500/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              You
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-surface-500">{roleLabel(entry.role)}</span>
          {entry.vote_streak > 1 && (
            <span className="text-[10px] text-against-400 font-mono flex items-center gap-0.5">
              <Flame className="h-2.5 w-2.5" />
              {entry.vote_streak}d
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <span className={cn('text-sm font-mono font-bold', cfg.accentText)}>
          {entry.count.toLocaleString()}
        </span>
      </div>
    </motion.div>
  )
}

// ─── My rank banner ───────────────────────────────────────────────────────────

function MyRankBanner({
  myRanks,
  activeTab,
  cfg,
}: {
  myRanks: TodayMyRanks
  activeTab: TabId
  cfg: TabConfig
}) {
  const rank = activeTab === 'voters' ? myRanks.voterRank : activeTab === 'arguers' ? myRanks.arguerRank : myRanks.upvoteRank
  const count = activeTab === 'voters' ? myRanks.voterCount : activeTab === 'arguers' ? myRanks.arguerCount : myRanks.upvoteCount

  if (count === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border px-4 py-3 flex items-center gap-3 mb-4',
        cfg.accentBg,
        cfg.accentBorder
      )}
    >
      <Trophy className={cn('h-4 w-4 shrink-0', cfg.accentText)} />
      <div className="flex-1 min-w-0">
        {rank ? (
          <span className="text-sm font-mono text-white">
            You&apos;re ranked{' '}
            <span className={cn('font-bold', cfg.accentText)}>#{rank}</span>{' '}
            today
          </span>
        ) : (
          <span className="text-sm font-mono text-surface-400">
            You&apos;re not in the top {25} yet
          </span>
        )}
      </div>
      <span className={cn('text-xs font-mono font-bold shrink-0', cfg.accentText)}>
        {fmtCount(count, activeTab)}
      </span>
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 60_000

export default function TodayLeaderboardPage() {
  const [data, setData] = useState<TodayLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('voters')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard/today')
      if (!res.ok) throw new Error('Failed to fetch')
      const json: TodayLeaderboardResponse = await res.json()
      setData(json)
    } catch {
      // silent fail — keep stale data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    intervalRef.current = setInterval(() => load(), POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load])

  const entries: TodayEntry[] =
    !data ? [] :
    activeTab === 'voters' ? data.voters :
    activeTab === 'arguers' ? data.arguers :
    data.upvoted

  const cfg = TABS.find((t) => t.id === activeTab)!

  // Format today's date
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 shrink-0">
              <Flame className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Today&apos;s Civic Leaders</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">{todayLabel} · resets at midnight UTC</p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh leaderboard"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-50 mt-1"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Back link */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3 w-3" />
          All Leaderboards
        </Link>

        {/* Live pill */}
        <div className="flex items-center gap-2 mb-5">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono text-against-400 border border-against-500/30 bg-against-500/10 px-2.5 py-1 rounded-full">
            <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
            LIVE
          </span>
          <span className="text-xs text-surface-500 font-mono">Updates every minute</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 scrollbar-none">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono whitespace-nowrap transition-all shrink-0',
                  isActive
                    ? cn('text-white font-semibold', tab.accentBg, tab.accentBorder, 'border')
                    : 'text-surface-400 hover:text-white hover:bg-surface-200/60'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? tab.accentText : '')} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* My rank banner */}
        {data?.myRanks && (
          <MyRankBanner myRanks={data.myRanks} activeTab={activeTab} cfg={cfg} />
        )}

        {/* Podium: top 3 */}
        {loading ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 0, 2].map((rank) => (
              <div key={rank} className={`rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col items-center gap-2 ${rank === 0 ? 'ring-1 ring-surface-400/30' : ''}`}>
                <Skeleton className={`rounded-full ${rank === 0 ? 'h-14 w-14' : 'h-11 w-11'}`} />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + '-podium'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-3 gap-3 mb-6"
            >
              {/* Podium order: 2nd, 1st, 3rd */}
              {[1, 0, 2].map((podiumIndex) => {
                const rank = podiumIndex + 1
                return (
                  <PodiumCard
                    key={rank}
                    entry={entries[podiumIndex]}
                    rank={rank}
                    cfg={cfg}
                  />
                )
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Ranked list #4–25 */}
        {loading ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-surface-300 last:border-0">
                <Skeleton className="h-4 w-6 shrink-0" />
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-14 shrink-0" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No activity yet today"
            description="Be the first to make your mark. Every vote and argument counts."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + '-list'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
            >
              {entries.slice(3).map((entry, idx) => (
                <LeaderRow
                  key={entry.user_id}
                  entry={entry}
                  rank={idx + 4}
                  cfg={cfg}
                  isMe={false}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap items-center gap-4 text-xs font-mono text-surface-500">
          <Link href="/leaderboard/week" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowRight className="h-3 w-3" />
            Weekly Leaderboard
          </Link>
          <Link href="/leaderboard" className="hover:text-white transition-colors flex items-center gap-1">
            <Trophy className="h-3 w-3" />
            All-Time Rankings
          </Link>
          <Link href="/streaks" className="hover:text-white transition-colors flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Streak Hall of Fame
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
