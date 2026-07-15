'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Crown,
  Flame,
  Medal,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TraderStats, ExchangeLeaderboardResponse } from '@/app/api/exchange/leaderboard/route'

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_TABS = [
  { id: 'win_rate', label: 'Win Rate', icon: Target },
  { id: 'return',   label: 'Return',   icon: TrendingUp },
  { id: 'volume',   label: 'Volume',   icon: BarChart2 },
] as const

type SortId = (typeof SORT_TABS)[number]['id']

const PERIOD_TABS = [
  { id: 'all',   label: 'All Time' },
  { id: 'month', label: 'This Month' },
] as const

type PeriodId = (typeof PERIOD_TABS)[number]['id']

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  elder:         { label: 'Elder',         color: 'text-gold' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  debator:       { label: 'Debator',       color: 'text-for-400' },
  person:        { label: 'Citizen',       color: 'text-surface-500' },
}

function getRoleConfig(role: string) {
  return ROLE_CONFIG[role] ?? { label: 'Citizen', color: 'text-surface-500' }
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankDisplay({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-gold" />
  if (rank === 2) return <Medal className="h-5 w-5 text-surface-500" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
  return (
    <span className="w-5 text-center text-sm font-mono font-bold text-surface-600">
      {rank}
    </span>
  )
}

// ─── Win rate bar ─────────────────────────────────────────────────────────────

function WinRateBar({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-surface-600 text-xs">—</span>
  const color = rate >= 70 ? 'bg-emerald' : rate >= 50 ? 'bg-for-500' : 'bg-against-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${rate}%` }}
        />
      </div>
      <span
        className={cn(
          'text-xs font-mono font-bold tabular-nums',
          rate >= 70 ? 'text-emerald' : rate >= 50 ? 'text-for-400' : 'text-against-400',
        )}
      >
        {rate}%
      </span>
    </div>
  )
}

// ─── Return display ───────────────────────────────────────────────────────────

function ReturnDisplay({ value }: { value: number }) {
  const positive = value >= 0
  return (
    <span
      className={cn(
        'text-sm font-mono font-bold tabular-nums',
        positive ? 'text-emerald' : 'text-against-400',
      )}
    >
      {positive ? '+' : ''}
      {value.toFixed(1)}
    </span>
  )
}

// ─── Trader row ───────────────────────────────────────────────────────────────

function TraderRow({
  trader,
  rank,
  sort,
  index,
}: {
  trader: TraderStats
  rank: number
  sort: SortId
  index: number
}) {
  const roleConfig = getRoleConfig(trader.role)
  const catColor = trader.top_category ? (CAT_COLOR[trader.top_category] ?? 'text-surface-500') : 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
    >
      <Link
        href={`/profile/${trader.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all group',
          rank <= 3
            ? 'bg-surface-200/80 border-surface-400/60 hover:border-gold/40 hover:bg-surface-200'
            : 'bg-surface-100/60 border-surface-300/50 hover:border-surface-400/80 hover:bg-surface-100/90',
        )}
      >
        {/* Rank */}
        <div className="flex-shrink-0 flex items-center justify-center w-6">
          <RankDisplay rank={rank} />
        </div>

        {/* Avatar */}
        <Avatar
          src={trader.avatar_url}
          fallback={trader.display_name || trader.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-white truncate">
              {trader.display_name || trader.username}
            </span>
            {rank <= 3 && (
              <Badge
                size="sm"
                className={cn(
                  'flex-shrink-0 border font-mono text-[10px]',
                  rank === 1
                    ? 'bg-gold/15 text-gold border-gold/30'
                    : rank === 2
                    ? 'bg-surface-500/20 text-surface-400 border-surface-500/30'
                    : 'bg-amber-600/15 text-amber-500 border-amber-600/30',
                )}
              >
                #{rank}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[11px] font-medium', roleConfig.color)}>
              {roleConfig.label}
            </span>
            {trader.top_category && (
              <>
                <span className="text-surface-600 text-[11px]">·</span>
                <span className={cn('text-[11px] font-medium', catColor)}>
                  {trader.top_category}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Primary metric */}
        <div className="flex-shrink-0 text-right">
          {sort === 'win_rate' ? (
            <div className="w-28">
              <WinRateBar rate={trader.win_rate} />
              <p className="text-[10px] text-surface-600 mt-0.5 text-right">
                {trader.wins}W · {trader.losses}L · {trader.total_settled} settled
              </p>
            </div>
          ) : sort === 'return' ? (
            <div className="text-right">
              <ReturnDisplay value={trader.total_return} />
              <p className="text-[10px] text-surface-600 mt-0.5">
                {trader.total_settled} settled
              </p>
            </div>
          ) : (
            <div className="text-right">
              <span className="text-sm font-mono font-bold text-white">
                {trader.total_positions.toLocaleString()}
              </span>
              <p className="text-[10px] text-surface-600 mt-0.5">
                {trader.open_positions} open · {trader.total_settled} settled
              </p>
            </div>
          )}
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-surface-100/60 border border-surface-300/50"
        >
          <Skeleton className="w-6 h-5 rounded" />
          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-2.5 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-24 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip({ traders }: { traders: TraderStats[] }) {
  if (traders.length === 0) return null

  const totalSettled = traders.reduce((s, t) => s + t.total_settled, 0)
  const totalPositions = traders.reduce((s, t) => s + t.total_positions, 0)
  const avgWinRate = (() => {
    const withRate = traders.filter((t) => t.win_rate !== null)
    if (withRate.length === 0) return null
    return Math.round(withRate.reduce((s, t) => s + (t.win_rate ?? 0), 0) / withRate.length)
  })()

  const leader = traders[0]

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        {
          icon: Trophy,
          label: 'Traders',
          value: traders.length.toString(),
          sub: 'with settled markets',
          color: 'text-gold',
          bg: 'bg-gold/10',
          border: 'border-gold/20',
        },
        {
          icon: Zap,
          label: 'Settled Trades',
          value: totalSettled.toLocaleString(),
          sub: `${totalPositions.toLocaleString()} total positions`,
          color: 'text-for-400',
          bg: 'bg-for-500/10',
          border: 'border-for-500/20',
        },
        {
          icon: Target,
          label: 'Avg Win Rate',
          value: avgWinRate !== null ? `${avgWinRate}%` : '—',
          sub: leader ? `Leader: ${leader.display_name || leader.username}` : '',
          color: 'text-emerald',
          bg: 'bg-emerald/10',
          border: 'border-emerald/20',
        },
      ].map(({ icon: Icon, label, value, sub, color, bg, border }) => (
        <div
          key={label}
          className={cn('rounded-xl p-3 border', bg, border)}
        >
          <Icon className={cn('h-3.5 w-3.5 mb-1.5', color)} />
          <p className="text-[11px] text-surface-600">{label}</p>
          <p className={cn('text-lg font-mono font-bold', color)}>{value}</p>
          <p className="text-[10px] text-surface-600 truncate">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaderboardClient() {
  const [traders, setTraders] = useState<TraderStats[]>([])
  const [totalTraders, setTotalTraders] = useState(0)
  const [sort, setSort] = useState<SortId>('win_rate')
  const [period, setPeriod] = useState<PeriodId>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (s: SortId, p: PeriodId, isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await fetch(`/api/exchange/leaderboard?sort=${s}&period=${p}`)
        if (!res.ok) throw new Error('failed')
        const data: ExchangeLeaderboardResponse = await res.json()
        setTraders(data.traders)
        setTotalTraders(data.total_traders)
      } catch {
        // keep previous data on error
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(sort, period)
  }, [sort, period, load])

  function handleSort(s: SortId) {
    setSort(s)
    load(s, period)
  }

  function handlePeriod(p: PeriodId) {
    setPeriod(p)
    load(sort, p)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + header */}
        <div className="mb-6">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Civic Exchange
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="h-5 w-5 text-gold" />
                <h1 className="text-xl font-bold text-white">Prediction Leaderboard</h1>
              </div>
              <p className="text-sm text-surface-500">
                Top civic market traders ranked by accuracy and portfolio performance
              </p>
            </div>
            <button
              onClick={() => load(sort, period, true)}
              disabled={refreshing}
              className="flex-shrink-0 p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh leaderboard"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Period filter */}
        <div className="flex gap-2 mb-4">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handlePeriod(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                period === tab.id
                  ? 'bg-for-600/30 border-for-500/50 text-for-300'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white',
              )}
            >
              {tab.id === 'month' ? <Flame className="h-3 w-3" /> : <Trophy className="h-3 w-3" />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sort tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {SORT_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => handleSort(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border whitespace-nowrap transition-all',
                  sort === tab.id
                    ? 'bg-gold/20 border-gold/40 text-gold'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Stats strip */}
        {!loading && traders.length > 0 && (
          <StatsStrip traders={traders} />
        )}

        {/* Content */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : traders.length === 0 ? (
          <EmptyState
            icon={<Users className="h-10 w-10 text-surface-600" />}
            title="No traders yet"
            description={
              period === 'month'
                ? 'No markets have settled this month. Check back soon or switch to All Time.'
                : 'Markets need to settle before traders appear here. Start voting on active markets to build your portfolio.'
            }
            action={
              <Link
                href="/exchange"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-semibold hover:bg-for-500 transition-colors"
              >
                Browse Markets
              </Link>
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${sort}-${period}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-2"
            >
              {traders.map((trader, i) => (
                <TraderRow
                  key={trader.user_id}
                  trader={trader}
                  rank={i + 1}
                  sort={sort}
                  index={i}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer note */}
        {!loading && traders.length > 0 && (
          <p className="mt-6 text-center text-[11px] text-surface-600">
            Ranked across {totalTraders} traders with settled market positions ·{' '}
            {period === 'month' ? 'Last 30 days' : 'All time'} ·{' '}
            Win rate = correct calls on settled markets
          </p>
        )}

        {/* Portfolio link */}
        <div className="mt-8 p-4 rounded-xl bg-surface-200/60 border border-surface-300/50 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Wallet className="h-3.5 w-3.5 text-purple" />
              <p className="text-xs font-semibold text-white">Your Portfolio</p>
            </div>
            <p className="text-[11px] text-surface-500">
              Track your own market positions and P&amp;L
            </p>
          </div>
          <Link
            href="/exchange/portfolio"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/20 border border-purple/30 text-purple text-xs font-semibold hover:bg-purple/30 transition-colors"
          >
            <Wallet className="h-3 w-3" />
            My Portfolio
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
