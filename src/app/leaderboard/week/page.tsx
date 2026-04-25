'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Coins,
  Crown,
  Flame,
  MessageSquare,
  RefreshCw,
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
  WeeklyLeaderboardResponse,
  WeeklyEntry,
  WeeklyMyRanks,
} from '@/app/api/leaderboard/weekly/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

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
    case 'person': return 'Citizen'
    case 'debator': return 'Debator'
    case 'troll_catcher': return 'Troll Catcher'
    case 'elder': return 'Elder'
    default: return 'Citizen'
  }
}

function fmtCount(n: number, tab: TabId): string {
  const s = n.toLocaleString('en-US')
  if (tab === 'voters') return `${s} vote${n !== 1 ? 's' : ''}`
  if (tab === 'debators') return `${s} upvote${n !== 1 ? 's' : ''}`
  return `${s} clout`
}

// ─── Tab config ────────────────────────────────────────────────────────────────

type TabId = 'voters' | 'debators' | 'earners'

interface TabConfig {
  id: TabId
  label: string
  icon: typeof Vote
  description: string
  metricLabel: string
  color: string
  activeBg: string
  activeBorder: string
  activeText: string
}

const TABS: TabConfig[] = [
  {
    id: 'voters',
    label: 'Top Voters',
    icon: Vote,
    description: 'Most votes cast this week',
    metricLabel: 'Votes',
    color: 'text-for-400',
    activeBg: 'bg-for-500/15',
    activeBorder: 'border-for-500/40',
    activeText: 'text-for-300',
  },
  {
    id: 'debators',
    label: 'Top Debators',
    icon: MessageSquare,
    description: 'Most argument upvotes received',
    metricLabel: 'Upvotes',
    color: 'text-purple',
    activeBg: 'bg-purple/15',
    activeBorder: 'border-purple/40',
    activeText: 'text-purple',
  },
  {
    id: 'earners',
    label: 'Top Earners',
    icon: Coins,
    description: 'Most clout earned this week',
    metricLabel: 'Clout',
    color: 'text-gold',
    activeBg: 'bg-gold/15',
    activeBorder: 'border-gold/40',
    activeText: 'text-gold',
  },
]

// ─── My Rank Banner ───────────────────────────────────────────────────────────

function MyRankBanner({
  myRanks,
  tab,
}: {
  myRanks: WeeklyMyRanks
  tab: TabId
}) {
  const rank =
    tab === 'voters'
      ? myRanks.voterRank
      : tab === 'debators'
        ? myRanks.debatorRank
        : myRanks.earnerRank
  const count =
    tab === 'voters'
      ? myRanks.voterCount
      : tab === 'debators'
        ? myRanks.debatorCount
        : myRanks.earnerCount

  const tabCfg = TABS.find((t) => t.id === tab)!

  if (rank === null && count === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'mb-4 rounded-xl border px-4 py-3 flex items-center gap-3',
        tabCfg.activeBg,
        tabCfg.activeBorder,
      )}
    >
      <div className={cn('flex-shrink-0 font-mono text-lg font-bold', tabCfg.activeText)}>
        {rank ? `#${rank}` : '—'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">Your rank this week</p>
        <p className="text-xs text-surface-500 mt-0.5">
          {count > 0
            ? fmtCount(count, tab)
            : `No ${tab === 'voters' ? 'votes' : tab === 'debators' ? 'upvotes' : 'clout'} yet — get started!`}
        </p>
      </div>
      {rank && rank <= 3 && (
        <Trophy className={cn('h-5 w-5 flex-shrink-0', tabCfg.activeText)} />
      )}
    </motion.div>
  )
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  rank,
  tab,
  isMe,
}: {
  entry: WeeklyEntry
  rank: number
  tab: TabId
  isMe: boolean
}) {
  const tabCfg = TABS.find((t) => t.id === tab)!

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(rank * 0.04, 0.5) }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
          'hover:bg-surface-200/60',
          isMe
            ? cn(tabCfg.activeBg, tabCfg.activeBorder)
            : rankBg(rank),
        )}
      >
        {/* Rank */}
        <div
          className={cn(
            'flex-shrink-0 w-7 text-center font-mono text-sm font-bold',
            rankColor(rank),
          )}
        >
          {rank === 1 ? (
            <Crown className="h-4 w-4 mx-auto text-gold" />
          ) : (
            rank
          )}
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-white text-sm truncate">
              {entry.display_name ?? entry.username}
            </span>
            {isMe && (
              <span className="flex-shrink-0 text-[10px] font-mono font-bold text-for-400 bg-for-500/20 px-1.5 py-0.5 rounded">
                YOU
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant={entry.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}
              className="text-[10px]"
            >
              {roleLabel(entry.role)}
            </Badge>
            <span className="text-[11px] text-surface-500 font-mono">
              {entry.clout.toLocaleString()} clout
            </span>
          </div>
        </div>

        {/* Metric */}
        <div className="flex-shrink-0 text-right">
          <div className={cn('font-mono font-bold text-sm', tabCfg.color)}>
            <AnimatedNumber value={entry.count} />
          </div>
          <div className="text-[10px] text-surface-500 mt-0.5 font-mono">
            {tabCfg.metricLabel}
          </div>
        </div>

        <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300/20">
          <Skeleton className="w-7 h-4 rounded" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-2.5 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-12 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WeeklyLeaderboardPage() {
  const [data, setData] = useState<WeeklyLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('voters')
  const [myUserId, setMyUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/weekly')
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as WeeklyLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load weekly leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Load current user id for "YOU" highlight
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setMyUserId(user.id)
      })
    })
  }, [load])

  const tabCfg = TABS.find((t) => t.id === activeTab)!
  const entries: WeeklyEntry[] = data
    ? activeTab === 'voters'
      ? data.voters
      : activeTab === 'debators'
        ? data.debators
        : data.earners
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back link ─────────────────────────────────────── */}
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All Leaderboards
        </Link>

        {/* ── Header ────────────────────────────────────────── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                This Week
              </h1>
              {data && (
                <p className="text-sm font-mono text-surface-500 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatWeekRange(data.weekStart, data.weekEnd)}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-200 transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Description ───────────────────────────────────── */}
        <p className="text-sm text-surface-500 mb-6 font-mono leading-relaxed">
          Weekly rankings reset every Monday. Top performers earn bonus clout and
          recognition. Keep voting, debating, and engaging to climb the board.
        </p>

        {/* ── Tabs ──────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium whitespace-nowrap transition-all',
                  isActive
                    ? cn(tab.activeBg, tab.activeBorder, tab.activeText)
                    : 'bg-surface-100 border-surface-300/30 text-surface-500 hover:text-surface-300 hover:border-surface-400/40',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab description ───────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.p
            key={activeTab}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="text-xs text-surface-500 font-mono mb-4 flex items-center gap-1.5"
          >
            <tabCfg.icon className={cn('h-3.5 w-3.5', tabCfg.color)} />
            {tabCfg.description}
          </motion.p>
        </AnimatePresence>

        {/* ── My rank banner ────────────────────────────────── */}
        {data?.myRanks && <MyRankBanner myRanks={data.myRanks} tab={activeTab} />}

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-against-500/10 border border-against-500/30 text-against-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* ── Content ───────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SkeletonRows />
            </motion.div>
          ) : entries.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={activeTab === 'voters' ? Vote : activeTab === 'debators' ? MessageSquare : Coins}
                title="No activity yet this week"
                description={
                  activeTab === 'voters'
                    ? 'Be the first to cast a vote this week and claim the top spot.'
                    : activeTab === 'debators'
                      ? 'Post compelling arguments and earn upvotes to rank here.'
                      : 'Earn clout by voting, debating, and achieving milestones.'
                }
                actions={[{ label: 'Explore topics', href: '/' }]}
              />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {entries.map((entry, i) => (
                <EntryRow
                  key={entry.user_id}
                  entry={entry}
                  rank={i + 1}
                  tab={activeTab}
                  isMe={entry.user_id === myUserId}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer note ───────────────────────────────────── */}
        {!loading && entries.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-center text-xs text-surface-600 font-mono"
          >
            Top {entries.length} of this week · Resets Monday midnight UTC
          </motion.p>
        )}

        {/* ── Navigation to other boards ────────────────���───── */}
        <div className="mt-8 flex flex-col gap-2">
          <p className="text-xs text-surface-600 font-mono uppercase tracking-wider mb-1">
            More boards
          </p>
          {[
            { href: '/leaderboard', label: 'All-time Leaderboard', icon: Trophy },
            { href: '/leaderboard/categories', label: 'Category Power Rankings', icon: Flame },
            { href: '/streaks', label: 'Streak Hall', icon: Zap },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300/20 hover:border-surface-400/40 hover:bg-surface-200/50 transition-colors group"
            >
              <Icon className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
              <span className="text-sm text-surface-400 group-hover:text-white transition-colors font-mono">
                {label}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 ml-auto transition-colors" />
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
