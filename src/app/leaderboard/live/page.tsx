'use client'

/**
 * /leaderboard/live — Real-time 60-minute Leaderboard
 *
 * Shows the top civic actors over the past 60 minutes, refreshed
 * automatically every 30 seconds with a live countdown timer.
 *
 * Distinct from:
 *   /leaderboard/today  — midnight-to-now daily standings
 *   /leaderboard/week   — weekly standings
 *   /now                — platform-wide activity monitor
 *   /live               — argument stream
 *
 * This is the only leaderboard showing sub-hourly live rankings with
 * a "hot" indicator for users active in the last 10 minutes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Flame,
  MessageSquare,
  Radio,
  RefreshCw,
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
  LiveLeaderboardResponse,
  LiveEntry,
  LiveMyRanks,
} from '@/app/api/leaderboard/live/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_SECONDS = 30

type TabId = 'voters' | 'arguers'

interface TabConfig {
  id: TabId
  label: string
  icon: typeof Vote
  metricLabel: string
  singularLabel: string
  accentText: string
  accentBg: string
  accentBorder: string
}

const TABS: TabConfig[] = [
  {
    id: 'voters',
    label: 'Most Active Voters',
    icon: Vote,
    metricLabel: 'votes this hour',
    singularLabel: 'vote',
    accentText: 'text-for-400',
    accentBg: 'bg-for-500/10',
    accentBorder: 'border-for-500/30',
  },
  {
    id: 'arguers',
    label: 'Top Arguers',
    icon: MessageSquare,
    metricLabel: 'arguments this hour',
    singularLabel: 'argument',
    accentText: 'text-purple',
    accentBg: 'bg-purple/10',
    accentBorder: 'border-purple/30',
  },
]

// ─── Podium row ───────────────────────────────────────────────────────────────

function PodiumBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gold/20 border border-gold/40">
        <Trophy className="h-3 w-3 text-gold" />
      </span>
    )
  if (rank === 2)
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-400/20 border border-surface-400/40">
        <span className="text-[10px] font-mono font-bold text-surface-400">2</span>
      </span>
    )
  if (rank === 3)
    return (
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/20 border border-amber-700/40">
        <span className="text-[10px] font-mono font-bold text-amber-600">3</span>
      </span>
    )
  return (
    <span className="flex items-center justify-center w-6 h-6 text-[11px] font-mono text-surface-500 tabular-nums">
      {rank}
    </span>
  )
}

function EntryRow({
  entry,
  rank,
  tab,
  isMe,
  index,
}: {
  entry: LiveEntry
  rank: number
  tab: TabConfig
  isMe: boolean
  index: number
}) {
  return (
    <motion.div
      key={entry.user_id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
          'border hover:border-surface-400/60 hover:bg-surface-200/60',
          isMe
            ? 'bg-for-600/10 border-for-600/30'
            : 'bg-surface-200/30 border-surface-300/40',
        )}
      >
        <PodiumBadge rank={rank} />

        <div className="relative flex-shrink-0">
          <Avatar
            src={entry.avatar_url}
            fallback={entry.display_name || entry.username}
            size="sm"
          />
          {entry.hot && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-against-500 rounded-full border border-surface-100 animate-pulse"
              title="Active in last 10 minutes"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {entry.display_name || entry.username}
            {isMe && (
              <span className="ml-1.5 text-[10px] font-mono text-for-400 bg-for-500/10 px-1.5 py-0.5 rounded">
                you
              </span>
            )}
          </p>
          <p className="text-[11px] text-surface-500 truncate">@{entry.username}</p>
        </div>

        <div className={cn('flex-shrink-0 text-right')}>
          <p className={cn('text-sm font-mono font-bold tabular-nums', tab.accentText)}>
            {entry.count.toLocaleString()}
          </p>
          <p className="text-[10px] text-surface-500">
            {entry.count === 1 ? tab.singularLabel : tab.metricLabel}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Countdown bar ────────────────────────────────────────────────────────────

function CountdownBar({
  seconds,
  total,
  onRefresh,
  loading,
}: {
  seconds: number
  total: number
  onRefresh: () => void
  loading: boolean
}) {
  const pct = (seconds / total) * 100

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-for-500 rounded-full"
          style={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        title="Refresh now"
        className={cn(
          'p-1 rounded text-surface-500 hover:text-white transition-colors',
          loading && 'opacity-50 cursor-not-allowed',
        )}
      >
        <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
      </button>
      <span className="text-[10px] font-mono text-surface-500 tabular-nums w-8 text-right">
        {seconds}s
      </span>
    </div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-200/30 border border-surface-300/40"
        >
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-2.5 w-16 rounded" />
          </div>
          <Skeleton className="h-4 w-10 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── My rank banner ───────────────────────────────────────────────────────────

function MyRankBanner({
  myRanks,
  tab,
}: {
  myRanks: LiveMyRanks
  tab: TabConfig
}) {
  const rank = tab.id === 'voters' ? myRanks.voterRank : myRanks.arguerRank
  const count = tab.id === 'voters' ? myRanks.voterCount : myRanks.arguerCount

  if (!rank && count === 0) return null

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2',
        'bg-gold/10 border border-gold/30',
      )}
    >
      <Zap className="h-4 w-4 text-gold flex-shrink-0" />
      <div className="flex-1 min-w-0">
        {rank ? (
          <p className="text-xs text-white font-semibold">
            You&apos;re #{rank} on the live leaderboard
          </p>
        ) : (
          <p className="text-xs text-white font-semibold">
            You&apos;re not ranked yet — keep going!
          </p>
        )}
        {count > 0 && (
          <p className="text-[11px] text-surface-500">
            {count} {count === 1 ? tab.singularLabel : tab.metricLabel} this hour
          </p>
        )}
      </div>
      {rank && (
        <span className="text-sm font-mono font-bold text-gold tabular-nums">#{rank}</span>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiveLeaderboardPage() {
  const [data, setData] = useState<LiveLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<TabId>('voters')
  const [countdown, setCountdown] = useState(REFRESH_SECONDS)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/leaderboard/live')
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as LiveLeaderboardResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setCountdown(REFRESH_SECONDS)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-refresh timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      fetchData()
    }, REFRESH_SECONDS * 1000)

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [fetchData])

  const currentTab = TABS.find((t) => t.id === tab)!
  const entries = data ? (tab === 'voters' ? data.voters : data.arguers) : []

  return (
    <div className="min-h-screen bg-surface-50 pb-20">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/leaderboard"
            className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-against-400 animate-pulse flex-shrink-0" />
              <h1 className="text-base font-bold text-white tracking-tight">Live Leaderboard</h1>
            </div>
            <p className="text-[11px] text-surface-500">Top civic actors in the last 60 minutes</p>
          </div>
        </div>

        {/* Platform stats */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-2 mb-4"
          >
            <div className="bg-surface-200/50 border border-surface-300/50 rounded-xl p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-for-600/20 flex items-center justify-center flex-shrink-0">
                <Vote className="h-4 w-4 text-for-400" />
              </div>
              <div>
                <p className="text-base font-mono font-bold text-white tabular-nums">
                  {data.totalVotes.toLocaleString()}
                </p>
                <p className="text-[10px] text-surface-500">votes this hour</p>
              </div>
            </div>
            <div className="bg-surface-200/50 border border-surface-300/50 rounded-xl p-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-4 w-4 text-purple" />
              </div>
              <div>
                <p className="text-base font-mono font-bold text-white tabular-nums">
                  {data.totalArguments.toLocaleString()}
                </p>
                <p className="text-[10px] text-surface-500">arguments this hour</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Countdown bar */}
        <div className="mb-4">
          <CountdownBar
            seconds={countdown}
            total={REFRESH_SECONDS}
            onRefresh={fetchData}
            loading={loading}
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 mb-4 p-1 bg-surface-200/50 rounded-xl border border-surface-300/40">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
                tab === t.id
                  ? 'bg-surface-100 text-white shadow-sm border border-surface-300/60'
                  : 'text-surface-500 hover:text-surface-300',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* My rank banner */}
        {data?.myRanks && <MyRankBanner myRanks={data.myRanks} tab={currentTab} />}

        {/* Hot indicator legend */}
        <div className="flex items-center gap-1.5 mb-3 text-[10px] text-surface-600">
          <span className="w-2 h-2 rounded-full bg-against-500 animate-pulse inline-block" />
          Active in last 10 min
        </div>

        {/* Leaderboard list */}
        <AnimatePresence mode="wait">
          {loading && !data ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkeletonRows />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Activity}
                title="Couldn't load live data"
                description="Live leaderboard requires an active connection. Check your network and try again."
                action={
                  <button
                    onClick={fetchData}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600/20 border border-for-600/40 text-for-400 text-xs font-semibold hover:bg-for-600/30 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry
                  </button>
                }
              />
            </motion.div>
          ) : entries.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Activity}
                title="No activity yet this hour"
                description="Be the first on the live leaderboard. Cast a vote or write an argument on any topic."
                action={
                  <Link
                    href="/"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600/20 border border-for-600/40 text-for-400 text-xs font-semibold hover:bg-for-600/30 transition-colors"
                  >
                    <Flame className="h-3.5 w-3.5" />
                    Go to feed
                  </Link>
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key={`${tab}-${data?.windowStart}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-1.5"
            >
              {entries.map((entry, i) => (
                <EntryRow
                  key={entry.user_id}
                  entry={entry}
                  rank={i + 1}
                  tab={currentTab}
                  isMe={data?.myRanks?.voterRank === i + 1 && tab === 'voters' ||
                    data?.myRanks?.arguerRank === i + 1 && tab === 'arguers'}
                  index={i}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer nav */}
        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {[
            { href: '/leaderboard/today', label: "Today's Board" },
            { href: '/leaderboard/week', label: 'This Week' },
            { href: '/leaderboard', label: 'All Rankings' },
            { href: '/vote-stream', label: 'Vote Stream' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-for-400 transition-colors"
            >
              {l.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
