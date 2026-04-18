'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Crown,
  Flame,
  Medal,
  RefreshCw,
  Shield,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { CoalitionStanding, StandingsResponse, SortBy } from '@/app/api/coalitions/standings/route'

// ─── Sort config ──────────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: SortBy; label: string; icon: typeof Trophy }[] = [
  { id: 'win_rate', label: 'Win Rate', icon: Trophy },
  { id: 'wins', label: 'Most Wins', icon: Swords },
  { id: 'influence', label: 'Influence', icon: Zap },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'matches', label: 'Campaigns', icon: BarChart2 },
]

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold" aria-label="1st place" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-400" aria-label="2nd place" />
  if (rank === 3) return <Shield className="h-4 w-4 text-amber-600" aria-label="3rd place" />
  return (
    <span className="font-mono text-xs text-surface-500 w-4 text-center tabular-nums" aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  )
}

// ─── Win rate bar ─────────────────────────────────────────────────────────────

function WinRateBar({ winRate, wins, losses }: { winRate: number | null; wins: number; losses: number }) {
  const total = wins + losses
  if (total === 0) {
    return <span className="font-mono text-xs text-surface-500">No campaigns</span>
  }
  const pct = winRate ?? 0
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden min-w-[48px]">
        <motion.div
          className={cn(
            'h-full rounded-full',
            pct >= 60 ? 'bg-emerald' : pct >= 40 ? 'bg-for-500' : 'bg-against-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span
        className={cn(
          'font-mono text-xs font-bold tabular-nums shrink-0',
          pct >= 60 ? 'text-emerald' : pct >= 40 ? 'text-for-400' : 'text-against-400'
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({
  coalition,
  position,
}: {
  coalition: CoalitionStanding
  position: 1 | 2 | 3
}) {
  const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-16' }
  const colors = {
    1: {
      border: 'border-gold/40',
      bg: 'bg-gold/5',
      icon: 'bg-gold/15 border-gold/40 text-gold',
      label: 'text-gold',
      bar: 'bg-gold/30',
    },
    2: {
      border: 'border-surface-400/40',
      bg: 'bg-surface-200/60',
      icon: 'bg-surface-300 border-surface-400 text-surface-400',
      label: 'text-surface-400',
      bar: 'bg-surface-400/30',
    },
    3: {
      border: 'border-amber-700/40',
      bg: 'bg-amber-900/10',
      icon: 'bg-amber-900/20 border-amber-700/40 text-amber-600',
      label: 'text-amber-600',
      bar: 'bg-amber-700/30',
    },
  }
  const c = colors[position]
  const total = coalition.wins + coalition.losses
  const winPct = total > 0 ? Math.round((coalition.wins / total) * 100) : null

  return (
    <Link href={`/coalitions/${coalition.id}`} className="group block">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: position * 0.08 }}
        className={cn(
          'rounded-xl border p-4 text-center transition-all',
          c.border, c.bg,
          'hover:scale-[1.02]'
        )}
      >
        <div className={cn('flex items-center justify-center h-10 w-10 rounded-lg border mx-auto mb-2', c.icon)}>
          <Users className="h-5 w-5" />
        </div>
        <p className={cn('font-mono text-[10px] font-bold uppercase tracking-widest mb-0.5', c.label)}>
          #{position}
        </p>
        <h3 className="font-mono text-sm font-bold text-white line-clamp-2 leading-tight mb-2 group-hover:text-purple transition-colors">
          {coalition.name}
        </h3>
        <div className={cn('rounded-md px-2 py-1 font-mono text-xs inline-flex items-center gap-1', c.icon)}>
          <Trophy className="h-3 w-3" />
          {total === 0 ? '—' : `${winPct}% W`}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1 font-mono text-[11px] text-surface-500">
          <span className="text-emerald">{coalition.wins}W</span>
          <span>·</span>
          <span className="text-against-400">{coalition.losses}L</span>
        </div>
        {/* Podium stand */}
        <div className={cn('mt-3 -mx-4 -mb-4 rounded-b-xl', heights[position], c.bar)} />
      </motion.div>
    </Link>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

function StandingRow({
  coalition,
  index,
  sortBy,
}: {
  coalition: CoalitionStanding
  index: number
  sortBy: SortBy
}) {
  const total = coalition.wins + coalition.losses

  return (
    <motion.div
      key={coalition.id}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.6) }}
    >
      <Link
        href={`/coalitions/${coalition.id}`}
        className={cn(
          'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
          coalition.rank <= 3
            ? 'border-surface-300/60 bg-surface-100'
            : 'border-surface-300/30 bg-surface-100/40',
          'hover:border-purple/40 hover:bg-purple/[0.03]'
        )}
      >
        {/* Rank */}
        <div className="flex items-center justify-center w-6 shrink-0">
          <RankMedal rank={coalition.rank} />
        </div>

        {/* Coalition icon */}
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg border shrink-0',
          'bg-purple/10 border-purple/30 text-purple'
        )}>
          <Users className="h-4 w-4" />
        </div>

        {/* Name + description */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-white group-hover:text-purple transition-colors truncate">
            {coalition.name}
          </p>
          <p className="font-mono text-[11px] text-surface-500 truncate">
            {coalition.creator_username ? `by @${coalition.creator_username}` : ''}
            {coalition.creator_username && coalition.member_count ? ' · ' : ''}
            {coalition.member_count} member{coalition.member_count !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Stats — responsive: hide some cols on mobile */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Win / loss record */}
          <div className="hidden sm:block font-mono text-xs text-center min-w-[64px]">
            <span className="text-emerald tabular-nums">{coalition.wins}W</span>
            <span className="text-surface-500"> · </span>
            <span className="text-against-400 tabular-nums">{coalition.losses}L</span>
          </div>

          {/* Win rate bar */}
          <div className="hidden md:flex items-center gap-2 w-28">
            <WinRateBar winRate={coalition.win_rate} wins={coalition.wins} losses={coalition.losses} />
          </div>

          {/* Highlighted metric */}
          {sortBy === 'influence' ? (
            <div className="flex items-center gap-1 font-mono text-sm text-gold min-w-[60px] justify-end">
              <Zap className="h-3.5 w-3.5" />
              <span className="tabular-nums">{Math.round(coalition.coalition_influence).toLocaleString()}</span>
            </div>
          ) : sortBy === 'members' ? (
            <div className="flex items-center gap-1 font-mono text-sm text-for-400 min-w-[48px] justify-end">
              <Users className="h-3.5 w-3.5" />
              <span className="tabular-nums">{coalition.member_count}</span>
            </div>
          ) : total > 0 ? (
            <div
              className={cn(
                'font-mono text-sm font-bold tabular-nums min-w-[48px] text-right',
                (coalition.win_rate ?? 0) >= 60
                  ? 'text-emerald'
                  : (coalition.win_rate ?? 0) >= 40
                    ? 'text-for-400'
                    : 'text-against-400'
              )}
            >
              {coalition.win_rate}%
            </div>
          ) : (
            <span className="font-mono text-xs text-surface-500 min-w-[48px] text-right">—</span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-surface-300/30 bg-surface-100/40">
          <Skeleton className="w-6 h-4 rounded" />
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1.5" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16 hidden sm:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoalitionStandingsPage() {
  const [data, setData] = useState<StandingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('win_rate')

  const fetchStandings = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/coalitions/standings?sort=${sortBy}&limit=50`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json: StandingsResponse = await res.json()
      setData(json)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [sortBy])

  useEffect(() => {
    fetchStandings()
  }, [fetchStandings])

  const standings = data?.standings ?? []
  const podium = standings.slice(0, 3)

  const activeCampaigners = standings.filter((s) => s.total_matches > 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/coalitions"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
              aria-label="Back to coalitions"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Trophy className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">League Standings</h1>
                <p className="font-mono text-xs text-surface-500 mt-0.5">
                  Coalitions ranked by campaign outcomes
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchStandings}
            disabled={isLoading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white disabled:opacity-40 transition-colors"
            aria-label="Refresh standings"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
        </div>

        {/* Stats strip */}
        {!isLoading && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 text-center">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 mx-auto mb-2">
                <Users className="h-4 w-4 text-purple" />
              </div>
              <p className="font-mono text-xl font-bold text-white">
                <AnimatedNumber value={data.total_coalitions} />
              </p>
              <p className="font-mono text-[10px] text-surface-500 mt-0.5 uppercase tracking-widest">Coalitions</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 text-center">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald/10 border border-emerald/30 mx-auto mb-2">
                <Trophy className="h-4 w-4 text-emerald" />
              </div>
              <p className="font-mono text-xl font-bold text-white">
                {data.top_win_rate !== null ? (
                  <><AnimatedNumber value={data.top_win_rate} />%</>
                ) : '—'}
              </p>
              <p className="font-mono text-[10px] text-surface-500 mt-0.5 uppercase tracking-widest">Best Win Rate</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 text-center">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30 mx-auto mb-2">
                <Swords className="h-4 w-4 text-for-400" />
              </div>
              <p className="font-mono text-xl font-bold text-white">
                <AnimatedNumber value={activeCampaigners.length} />
              </p>
              <p className="font-mono text-[10px] text-surface-500 mt-0.5 uppercase tracking-widest">Active</p>
            </div>
          </motion.div>
        )}

        {/* Sort controls */}
        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Sort by">
          {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSortBy(id)}
              aria-pressed={sortBy === id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-xs font-semibold whitespace-nowrap transition-all',
                sortBy === id
                  ? 'bg-gold/15 text-gold border-gold/40'
                  : 'bg-surface-200 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Podium — top 3 */}
        {!isLoading && podium.length >= 3 && (
          <div className="mb-6">
            <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Flame className="h-3 w-3 text-gold" />
              Top Alliances
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {/* 2nd — left */}
              <PodiumCard coalition={podium[1]} position={2} />
              {/* 1st — center */}
              <PodiumCard coalition={podium[0]} position={1} />
              {/* 3rd — right */}
              <PodiumCard coalition={podium[2]} position={3} />
            </div>
          </div>
        )}

        {/* Full table */}
        <div>
          <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <BarChart2 className="h-3 w-3" />
            Full Rankings
          </h2>

          {isLoading ? (
            <SkeletonRows />
          ) : standings.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No coalitions yet"
              description="Be the first to form an alliance and start campaigning."
              actions={[{ label: 'Create Coalition', href: '/coalitions/create' }]}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={sortBy}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {standings.map((coalition, index) => (
                  <StandingRow
                    key={coalition.id}
                    coalition={coalition}
                    index={index}
                    sortBy={sortBy}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* How it works */}
        {!isLoading && standings.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 rounded-xl bg-surface-100 border border-surface-300/60 p-5"
          >
            <h3 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Shield className="h-3 w-3" />
              How Rankings Work
            </h3>
            <div className="space-y-2 font-mono text-xs text-surface-500 leading-relaxed">
              <p>
                <span className="text-emerald font-semibold">Win</span> — A coalition declared a stance on a topic and the topic resolved in their favour (FOR → Law, AGAINST → Failed).
              </p>
              <p>
                <span className="text-against-400 font-semibold">Loss</span> — The topic resolved against the coalition&apos;s declared stance.
              </p>
              <p>
                <span className="text-gold font-semibold">Win Rate</span> — Wins ÷ total resolved campaigns × 100. Coalitions with no declared stances are shown but unranked by win rate.
              </p>
              <p>
                <span className="text-purple font-semibold">Influence</span> — The coalition&apos;s accumulated Clout across all member activities: votes, arguments, debates, and laws.
              </p>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
