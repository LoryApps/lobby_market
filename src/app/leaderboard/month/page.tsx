'use client'

/**
 * /leaderboard/month — Monthly Civic Leaderboard
 *
 * Ranks citizens by civic contributions in a given calendar month.
 * Four ranked views:
 *   Voters       — most votes cast this month
 *   Arguers      — most arguments posted
 *   Influencers  — most upvotes received on arguments
 *   Lawmakers    — most laws co-authored (voted FOR topics that became law)
 *
 * Navigate backward/forward with month arrows. Defaults to current month.
 *
 * Distinct from:
 *   /leaderboard/today   — single day
 *   /leaderboard/week    — current ISO week
 *   /leaderboard         — all-time rankings
 *   /leaderboard/rising  — newest high-activity users
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Crown,
  Gavel,
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
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  MonthlyLeaderboardResponse,
  MonthlyEntry,
  MonthlyMyRanks,
} from '@/app/api/leaderboard/monthly/route'

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
  if (rank === 3) return 'bg-amber-600/10 border-amber-600/30'
  return 'bg-surface-200/50 border-surface-300/50'
}

function rankIcon(rank: number) {
  if (rank === 1) return <Crown className="h-3.5 w-3.5 text-gold" />
  if (rank === 2) return <Trophy className="h-3.5 w-3.5 text-surface-300" />
  if (rank === 3) return <Trophy className="h-3.5 w-3.5 text-amber-600" />
  return null
}

const ROLE_COLORS: Record<string, string> = {
  elder: 'text-gold',
  troll_catcher: 'text-emerald',
  debator: 'text-for-400',
  senator: 'text-purple',
  lawmaker: 'text-gold',
  person: 'text-surface-500',
}
const ROLE_LABELS: Record<string, string> = {
  elder: 'Elder',
  troll_catcher: 'Troll Catcher',
  debator: 'Debator',
  senator: 'Senator',
  lawmaker: 'Lawmaker',
  person: 'Member',
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  rank,
  unit,
}: {
  entry: MonthlyEntry
  rank: number
  unit: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03, duration: 0.2 }}
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl border transition-colors hover:border-surface-400/60',
        rankBg(rank)
      )}
    >
      <div className={cn('w-6 text-center font-mono text-sm font-bold flex-shrink-0 flex items-center justify-center', rankColor(rank))}>
        {rank <= 3 ? rankIcon(rank) : <span>{rank}</span>}
      </div>

      <Link href={`/profile/${entry.username}`} className="flex-shrink-0">
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name || entry.username}
          size="sm"
        />
      </Link>

      <Link href={`/profile/${entry.username}`} className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">
          {entry.display_name || entry.username}
        </p>
        <p className="text-[11px] text-surface-500 truncate">
          @{entry.username}
          {' · '}
          <span className={cn('font-medium', ROLE_COLORS[entry.role] ?? 'text-surface-500')}>
            {ROLE_LABELS[entry.role] ?? 'Member'}
          </span>
        </p>
      </Link>

      <div className="flex-shrink-0 text-right">
        <p className={cn('text-sm font-mono font-bold', rankColor(rank))}>
          <AnimatedNumber value={entry.count} />
        </p>
        <p className="text-[10px] text-surface-500">{unit}</p>
      </div>
    </motion.div>
  )
}

function EntrySkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-300/50 bg-surface-200/50">
      <Skeleton className="h-4 w-6 flex-shrink-0" />
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="text-right space-y-1">
        <Skeleton className="h-4 w-10 ml-auto" />
        <Skeleton className="h-3 w-8 ml-auto" />
      </div>
    </div>
  )
}

// ─── My rank card ─────────────────────────────────────────────────────────────

function MyRankCard({ ranks, activeTab }: { ranks: MonthlyMyRanks; activeTab: string }) {
  const stat = {
    voters:    { rank: ranks.voterRank,    count: ranks.voterCount,    unit: 'votes',     icon: Vote,          color: 'text-for-400'  },
    arguers:   { rank: ranks.arguerRank,   count: ranks.arguerCount,   unit: 'args',      icon: MessageSquare, color: 'text-purple'   },
    earners:   { rank: ranks.earnerRank,   count: ranks.earnerCount,   unit: 'upvotes',   icon: ThumbsUp,      color: 'text-emerald'  },
    lawmakers: { rank: ranks.lawmakerRank, count: ranks.lawmakerCount, unit: 'laws',      icon: Gavel,         color: 'text-gold'     },
  }[activeTab]

  if (!stat) return null
  const { rank, count, unit, icon: Icon, color } = stat

  return (
    <motion.div
      key={activeTab}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-for-500/5 border border-for-500/20 mb-4"
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} aria-hidden="true" />
      <div className="flex-1 text-sm font-mono text-surface-400">Your rank this month</div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-sm font-mono font-bold', color)}>
          {count} {unit}
        </span>
        {rank ? (
          <span className={cn('text-sm font-mono font-bold', rankColor(rank))}>#{rank}</span>
        ) : (
          <span className="text-xs text-surface-500 font-mono">Unranked</span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type Tab = 'voters' | 'arguers' | 'earners' | 'lawmakers'

const TABS: {
  id: Tab
  label: string
  icon: typeof Vote
  unit: string
  color: string
  border: string
  activeBg: string
}[] = [
  { id: 'voters',    label: 'Voters',       icon: Vote,          unit: 'votes',           color: 'text-for-400', border: 'border-for-500/40', activeBg: 'bg-for-500/10'  },
  { id: 'arguers',   label: 'Arguers',      icon: MessageSquare, unit: 'arguments',       color: 'text-purple',  border: 'border-purple/40',  activeBg: 'bg-purple/10'   },
  { id: 'earners',   label: 'Influencers',  icon: ThumbsUp,      unit: 'upvotes',         color: 'text-emerald', border: 'border-emerald/40', activeBg: 'bg-emerald/10'  },
  { id: 'lawmakers', label: 'Lawmakers',    icon: Gavel,         unit: 'laws co-authored',color: 'text-gold',    border: 'border-gold/40',    activeBg: 'bg-gold/10'     },
]

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function MonthlyLeaderboardInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const now = new Date()
  const yearParam = searchParams.get('year')
  const monthParam = searchParams.get('month')
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear()
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1

  const [data, setData] = useState<MonthlyLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('voters')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (y: number, m: number) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/leaderboard/monthly?year=${y}&month=${m}`, {
        signal: ctrl.signal,
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(year, month)
  }, [year, month, load])

  function navigate(delta: number) {
    let y = year
    let m = month + delta
    if (m < 1) { y -= 1; m = 12 }
    if (m > 12) { y += 1; m = 1 }
    const nowY = now.getFullYear()
    const nowM = now.getMonth() + 1
    if (y > nowY || (y === nowY && m > nowM)) return
    router.replace(`/leaderboard/month?year=${y}&month=${m}`)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const tabConfig = TABS.find((t) => t.id === tab)!
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const entries: MonthlyEntry[] = data
    ? tab === 'voters' ? data.voters
      : tab === 'arguers' ? data.arguers
      : tab === 'earners' ? data.earners
      : data.lawmakers
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12" id="main-content">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/leaderboard"
                aria-label="Back to Leaderboard"
                className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </Link>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-purple" aria-hidden="true" />
                  Monthly Leaderboard
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Top civic contributors by calendar month
                </p>
              </div>
            </div>

            <button
              onClick={() => load(year, month)}
              aria-label="Refresh leaderboard"
              className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Month navigator ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            aria-label="Previous month"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex-1 text-center">
            <p className="font-mono text-lg font-bold text-white">
              {data?.monthLabel ?? `${MONTH_NAMES[month - 1]} ${year}`}
            </p>
            {isCurrentMonth && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono text-for-400">
                <Zap className="h-3 w-3" aria-hidden="true" />
                Current month
              </span>
            )}
          </div>

          <button
            onClick={() => navigate(1)}
            disabled={isCurrentMonth}
            aria-label="Next month"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Leaderboard categories"
          className="flex gap-1.5 overflow-x-auto pb-1 mb-5 scrollbar-none"
        >
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold whitespace-nowrap flex-shrink-0',
                  'border transition-all',
                  active
                    ? cn(t.activeBg, t.border, t.color)
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── My rank card ────────────────────────────────────────────────── */}
        {data?.myRanks && (
          <MyRankCard ranks={data.myRanks} activeTab={tab} />
        )}

        {/* ── Leaderboard list ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {Array.from({ length: 10 }).map((_, i) => (
                <EntrySkeleton key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={<CalendarDays className="h-6 w-6 text-surface-500" />}
                title="Could not load leaderboard"
                description="Please try refreshing."
                action={
                  <button
                    onClick={() => load(year, month)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600/20 border border-for-600/40 text-for-300 text-sm font-mono hover:bg-for-600/30 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Retry
                  </button>
                }
              />
            </motion.div>
          ) : entries.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={<CalendarDays className="h-6 w-6 text-surface-500" />}
                title="No activity yet"
                description={`No civic activity recorded for ${data?.monthLabel ?? 'this month'} in this category.`}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`${tab}-${year}-${month}`}
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
                  unit={tabConfig.unit}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer nav ──────────────────────────────────────────────────── */}
        {!loading && !error && entries.length > 0 && (
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-surface-300 pt-6">
            <Link
              href="/leaderboard/today"
              className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Today
            </Link>
            <Link
              href="/leaderboard"
              className="text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              All-time →
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonthlyLeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-50">
          <TopBar />
          <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
            <div className="flex items-center gap-3 mb-6">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-7 w-52" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50">
                  <Skeleton className="h-4 w-6 flex-shrink-0" />
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                </div>
              ))}
            </div>
          </main>
          <BottomNav />
        </div>
      }
    >
      <MonthlyLeaderboardInner />
    </Suspense>
  )
}
