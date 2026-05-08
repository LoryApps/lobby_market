'use client'

/**
 * /leaderboard/coalitions — Coalition Standings Leaderboard
 *
 * Full dedicated league table for public coalitions, with four sort modes:
 *   Win Rate  — best campaign win/loss ratio (minimum 1 match)
 *   Most Wins — raw wins count
 *   Influence — coalition_influence score (the default platform metric)
 *   Members   — coalition size
 *
 * Includes a podium for the top 3 and a ranked list for the rest.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Crown,
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

// ─── Sort tabs ────────────────────────────────────────────────────────────────

const SORT_TABS: { id: SortBy; label: string; icon: typeof Trophy; desc: string }[] = [
  { id: 'influence', label: 'Influence',  icon: Zap,     desc: 'Ranked by coalition influence score' },
  { id: 'win_rate', label: 'Win Rate',    icon: Trophy,  desc: 'Best campaign win / loss ratio (min 1 match)' },
  { id: 'wins',     label: 'Most Wins',   icon: Swords,  desc: 'Coalitions with the most campaign victories' },
  { id: 'members',  label: 'Members',     icon: Users,   desc: 'Largest coalitions by member count' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtInfluence(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown  className="h-4 w-4 text-gold"        aria-label="1st place" />
  if (rank === 2) return <Medal  className="h-4 w-4 text-surface-400" aria-label="2nd place" />
  if (rank === 3) return <Shield className="h-4 w-4 text-amber-600"   aria-label="3rd place" />
  return (
    <span className="font-mono text-xs text-surface-500 w-4 text-center tabular-nums" aria-label={`Rank ${rank}`}>
      {rank}
    </span>
  )
}

// ─── Win-rate bar ─────────────────────────────────────────────────────────────

function WinBar({ winRate, wins, losses }: { winRate: number | null; wins: number; losses: number }) {
  const total = wins + losses
  if (total === 0) {
    return <span className="font-mono text-[11px] text-surface-600">No campaigns</span>
  }
  const pct = winRate ?? 0
  const color = pct >= 70 ? 'bg-emerald' : pct >= 50 ? 'bg-for-500' : 'bg-against-500'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden min-w-[40px]">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] text-surface-500 flex-shrink-0 tabular-nums">
        {wins}W–{losses}L
      </span>
    </div>
  )
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({
  standing,
  sort,
  index,
}: {
  standing: CoalitionStanding
  sort: SortBy
  index: number
}) {
  const height = index === 0 ? 'pt-4' : index === 1 ? 'pt-10' : 'pt-14'
  const border = index === 0 ? 'border-gold/50 bg-gold/5' : index === 1 ? 'border-surface-400/50 bg-surface-200/60' : 'border-amber-600/50 bg-amber-900/10'
  const medal = index === 0 ? <Crown className="h-5 w-5 text-gold" /> : index === 1 ? <Medal className="h-5 w-5 text-surface-400" /> : <Shield className="h-5 w-5 text-amber-600" />

  const metricLabel = sort === 'influence' ? 'influence' : sort === 'win_rate' ? 'win rate' : sort === 'wins' ? 'wins' : 'members'
  const metricValue =
    sort === 'influence' ? fmtInfluence(standing.coalition_influence) :
    sort === 'win_rate'  ? (standing.win_rate !== null ? `${standing.win_rate}%` : '—') :
    sort === 'wins'      ? standing.wins.toString() :
    standing.member_count.toString()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className={cn('flex flex-col items-center gap-2 flex-1', height)}
    >
      <Link
        href={`/coalitions/${standing.id}`}
        className={cn(
          'group w-full flex flex-col items-center gap-2 rounded-2xl border px-3 py-4',
          'hover:bg-surface-200/80 transition-all duration-150',
          border,
        )}
      >
        <div className="flex items-center gap-1 text-surface-400 font-mono text-xs">
          {medal}
          <span>#{standing.rank}</span>
        </div>
        <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
          <Shield className="h-5 w-5 text-purple" aria-hidden />
        </div>
        <p className="font-mono text-sm font-semibold text-white text-center leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
          {standing.name}
        </p>
        <div className="text-center">
          <p className="font-mono text-xl font-bold text-white tabular-nums">
            {metricValue}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            {metricLabel}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-600">
          <Users className="h-3 w-3" />
          {standing.member_count} member{standing.member_count !== 1 ? 's' : ''}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Ranked row ───────────────────────────────────────────────────────────────

function CoalitionRow({
  standing,
  sort,
  index,
}: {
  standing: CoalitionStanding
  sort: SortBy
  index: number
}) {
  const metricValue =
    sort === 'influence' ? fmtInfluence(standing.coalition_influence) :
    sort === 'win_rate'  ? (standing.win_rate !== null ? `${standing.win_rate}%` : '—') :
    sort === 'wins'      ? standing.wins.toString() :
    standing.member_count.toString()
  const metricLabel =
    sort === 'influence' ? 'influence' :
    sort === 'win_rate'  ? 'win rate' :
    sort === 'wins'      ? 'wins' :
    'members'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
    >
      <Link
        href={`/coalitions/${standing.id}`}
        className={cn(
          'group flex items-center gap-3 px-4 py-3 rounded-xl',
          'bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/60 transition-all duration-150',
        )}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-6 flex items-center justify-center">
          <RankMedal rank={standing.rank} />
        </div>

        {/* Avatar / icon */}
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-purple/10 border border-purple/20 flex-shrink-0">
          <Shield className="h-4 w-4 text-purple" aria-hidden />
        </div>

        {/* Name + creator */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-white leading-tight group-hover:text-for-300 transition-colors truncate">
            {standing.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-600">
              <Users className="h-3 w-3" />
              {standing.member_count}/{standing.max_members}
            </span>
            {standing.creator_username && (
              <span className="text-[11px] font-mono text-surface-600">
                by @{standing.creator_username}
              </span>
            )}
            <span className="text-[11px] font-mono text-surface-600">
              est. {fmtDate(standing.created_at)}
            </span>
          </div>
        </div>

        {/* Campaign record */}
        <div className="hidden sm:flex flex-col items-end gap-1 w-36 flex-shrink-0">
          <WinBar winRate={standing.win_rate} wins={standing.wins} losses={standing.losses} />
        </div>

        {/* Primary metric */}
        <div className="text-right flex-shrink-0 w-20">
          <p className="font-mono text-base font-bold text-white tabular-nums">
            {metricValue}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            {metricLabel}
          </p>
        </div>

        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3.5 w-24 hidden sm:block" />
          <Skeleton className="h-5 w-14" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CoalitionLeaderboardPage() {
  const [sort, setSort] = useState<SortBy>('influence')
  const [data, setData] = useState<StandingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStandings = useCallback(async (s: SortBy) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/standings?sort=${s}&limit=50`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: StandingsResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load standings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStandings(sort)
  }, [sort, fetchStandings])

  const standings = data?.standings ?? []
  const top3 = standings.slice(0, 3)
  const rest = standings.slice(3)

  const activeTab = SORT_TABS.find((t) => t.id === sort) ?? SORT_TABS[0]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/leaderboard"
                aria-label="Back to leaderboard"
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                  'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors'
                )}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                  <Shield className="h-5 w-5 text-purple" aria-hidden />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white leading-none">
                    Coalition Standings
                  </h1>
                  <p className="text-xs font-mono text-surface-500 mt-1">
                    {data ? `${data.total_coalitions.toLocaleString()} public coalitions` : 'The most powerful alliances in the Lobby'}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => fetchStandings(sort)}
              disabled={loading}
              aria-label="Refresh standings"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors disabled:opacity-40 disabled:pointer-events-none'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
            </button>
          </div>

          {/* Platform stats strip */}
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-3 gap-3 mb-4"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-center">
                <p className="font-mono text-xl font-bold text-white">
                  <AnimatedNumber value={data.total_coalitions} />
                </p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Coalitions</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-center">
                <p className="font-mono text-xl font-bold text-white">
                  {data.top_win_rate !== null ? `${data.top_win_rate}%` : '—'}
                </p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Top Win Rate</p>
              </div>
              <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 text-center">
                <p className="font-mono text-xl font-bold text-white">
                  <AnimatedNumber value={data.top_wins} />
                </p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">Most Wins</p>
              </div>
            </motion.div>
          )}

          {/* Sort tabs */}
          <div
            className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            role="group"
            aria-label="Sort coalitions by"
          >
            {SORT_TABS.map((tab) => {
              const Icon = tab.icon
              const active = sort === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setSort(tab.id)}
                  aria-pressed={active}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-150 border',
                    active
                      ? 'bg-purple/15 text-purple border-purple/40'
                      : 'bg-surface-200/60 text-surface-500 border-surface-300 hover:text-surface-700 hover:border-surface-400'
                  )}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Sort description */}
          <p className="mt-2 text-xs font-mono text-surface-600 pl-1">
            {activeTab.desc}
          </p>
        </div>

        {/* ── Content ───────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Shield className="h-8 w-8 text-surface-500 mx-auto mb-3" aria-hidden />
            <p className="font-mono text-sm text-surface-500 mb-4">{error}</p>
            <button
              onClick={() => fetchStandings(sort)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-surface-600 hover:bg-surface-300 text-sm font-mono transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        ) : standings.length === 0 ? (
          <EmptyState
            icon={Shield}
            iconColor="text-purple/60"
            iconBg="bg-purple/5"
            iconBorder="border-purple/20"
            title="No coalitions yet"
            description="Be the first to form a public coalition and claim the top spot."
            actions={[{ label: 'Browse coalitions', href: '/coalitions', icon: Users }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={sort}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* Podium — top 3 */}
              {top3.length > 0 && (
                <div className="mb-6">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 pl-1">
                    Top Coalitions
                  </p>
                  <div className="flex items-end gap-2">
                    {/* Reorder: 2nd, 1st, 3rd for visual podium effect */}
                    {top3.length >= 2 && <PodiumCard standing={top3[1]} sort={sort} index={1} />}
                    {top3.length >= 1 && <PodiumCard standing={top3[0]} sort={sort} index={0} />}
                    {top3.length >= 3 && <PodiumCard standing={top3[2]} sort={sort} index={2} />}
                  </div>
                </div>
              )}

              {/* Ranked list — 4th onwards */}
              {rest.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3 pl-1">
                    Full Rankings
                  </p>
                  {rest.map((s, i) => (
                    <CoalitionRow key={s.id} standing={s} sort={sort} index={i} />
                  ))}
                </div>
              )}

              {standings.length > 0 && (
                <p className="mt-6 text-center text-xs font-mono text-surface-600">
                  {standings.length.toLocaleString()} coalition{standings.length !== 1 ? 's' : ''} ranked
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Footer CTAs ───────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <Link
            href="/coalitions"
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl',
              'bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20',
              'font-mono text-sm font-medium transition-colors'
            )}
          >
            <Shield className="h-4 w-4" />
            Browse all coalitions
          </Link>
          <Link
            href="/coalitions/create"
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl',
              'bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white',
              'font-mono text-sm font-medium transition-colors'
            )}
          >
            <Users className="h-4 w-4" />
            Form a coalition
          </Link>
          <Link
            href="/coalitions/standings"
            className={cn(
              'flex items-center justify-center gap-2 px-5 py-3 rounded-xl',
              'bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white',
              'font-mono text-sm font-medium transition-colors'
            )}
          >
            <ArrowRight className="h-4 w-4" />
            Campaign view
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
