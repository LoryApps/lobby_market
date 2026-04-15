'use client'

/**
 * CoalitionLeaderboard
 *
 * Ranks public coalitions across three sort modes:
 *   - Influence (default) — coalition_influence score
 *   - Win Rate — wins / (wins + losses), minimum 3 matches to qualify
 *   - Size      — member_count
 *
 * Features:
 *   - Podium (top 3) with gold / silver / bronze treatment
 *   - Ranked list (4–25) with key stats
 *   - Sort mode tabs
 *   - Animated entrance via Framer Motion
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Crown,
  Medal,
  Shield,
  Swords,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import type { Coalition } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortMode = 'influence' | 'winrate' | 'size'

interface CoalitionRow {
  coalition: Coalition
  rank: number
  primaryValue: string
  secondaryValue: string
  winRate: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function winRate(c: Coalition): number | null {
  const total = c.wins + c.losses
  return total >= 3 ? Math.round((c.wins / total) * 100) : null
}

function sortAndBuild(
  coalitions: Coalition[],
  mode: SortMode
): CoalitionRow[] {
  const sorted = [...coalitions].sort((a, b) => {
    if (mode === 'influence') {
      return b.coalition_influence - a.coalition_influence
    }
    if (mode === 'size') {
      return b.member_count - a.member_count
    }
    // winrate — unqualified go to end
    const wrA = winRate(a) ?? -1
    const wrB = winRate(b) ?? -1
    if (wrB !== wrA) return wrB - wrA
    return b.wins - a.wins
  })

  return sorted.slice(0, 25).map((coalition, idx) => {
    const wr = winRate(coalition)
    const totalMatches = coalition.wins + coalition.losses

    let primaryValue = ''
    let secondaryValue = ''

    if (mode === 'influence') {
      primaryValue = Math.round(coalition.coalition_influence).toLocaleString()
      secondaryValue = `${coalition.member_count} members`
    } else if (mode === 'winrate') {
      primaryValue = wr !== null ? `${wr}%` : '—'
      secondaryValue = totalMatches > 0 ? `${coalition.wins}W · ${coalition.losses}L` : 'No matches'
    } else {
      primaryValue = coalition.member_count.toLocaleString()
      secondaryValue = `${Math.round(coalition.coalition_influence)} influence`
    }

    return {
      coalition,
      rank: idx + 1,
      primaryValue,
      secondaryValue,
      winRate: wr,
    }
  })
}

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold/15 border border-gold/40 flex-shrink-0">
        <Crown className="h-4 w-4 text-gold" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-300/60 border border-surface-400/60 flex-shrink-0">
        <Medal className="h-4 w-4 text-surface-400" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#b45309]/15 border border-[#b45309]/40 flex-shrink-0">
        <Medal className="h-4 w-4 text-[#b45309]" />
      </div>
    )
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
      <span className="font-mono text-sm font-bold text-surface-500 tabular-nums">
        {rank}
      </span>
    </div>
  )
}

// ─── Podium card (top 3) ──────────────────────────────────────────────────────

function PodiumCard({
  row,
  delay = 0,
}: {
  row: CoalitionRow
  delay?: number
}) {
  const { coalition, rank, primaryValue, secondaryValue, winRate: wr } = row

  const rankStyle =
    rank === 1
      ? { border: 'border-gold/30', bg: 'bg-gold/5', text: 'text-gold', iconBg: 'bg-gold/15' }
      : rank === 2
      ? { border: 'border-surface-400/40', bg: 'bg-surface-200/60', text: 'text-surface-400', iconBg: 'bg-surface-300/60' }
      : { border: 'border-[#b45309]/30', bg: 'bg-[#b45309]/5', text: 'text-[#b45309]', iconBg: 'bg-[#b45309]/15' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link
        href={`/coalitions/${coalition.id}`}
        className={cn(
          'block rounded-xl border p-4 transition-all duration-200',
          'hover:scale-[1.02] hover:shadow-lg',
          rankStyle.border,
          rankStyle.bg
        )}
      >
        {/* Rank + name */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border flex-shrink-0',
              rankStyle.iconBg,
              rankStyle.border
            )}
          >
            {rank === 1 ? (
              <Crown className={cn('h-5 w-5', rankStyle.text)} />
            ) : (
              <Shield className={cn('h-5 w-5', rankStyle.text)} />
            )}
          </div>
          <div className="min-w-0">
            <p className={cn('font-mono text-xs font-bold uppercase tracking-wider', rankStyle.text)}>
              #{rank}
            </p>
            <h3 className="font-mono text-sm font-bold text-white truncate mt-0.5">
              {coalition.name}
            </h3>
          </div>
        </div>

        {/* Primary metric */}
        <div className="text-center py-2">
          <p className={cn('font-mono text-2xl font-black tabular-nums', rankStyle.text)}>
            {primaryValue}
          </p>
          <p className="font-mono text-[11px] text-surface-500 mt-0.5">{secondaryValue}</p>
        </div>

        {/* Stats strip */}
        <div className="mt-2 pt-2 border-t border-surface-300/40 flex items-center justify-between font-mono text-[11px]">
          <span className="flex items-center gap-1 text-surface-500">
            <Users className="h-3 w-3" />
            {coalition.member_count}
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-emerald" />
            <span className="text-emerald">{coalition.wins}</span>
            <span className="text-surface-500">/</span>
            <span className="text-against-400">{coalition.losses}</span>
          </span>
          {wr !== null && (
            <span
              className={cn(
                'font-bold',
                wr >= 50 ? 'text-emerald' : 'text-against-400'
              )}
            >
              {wr}% W
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Table row (rank 4+) ──────────────────────────────────────────────────────

function LeaderRow({ row, delay = 0 }: { row: CoalitionRow; delay?: number }) {
  const { coalition, rank, primaryValue, secondaryValue, winRate: wr } = row
  const totalMatches = coalition.wins + coalition.losses

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.25 }}
    >
      <Link
        href={`/coalitions/${coalition.id}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl',
          'border border-surface-300/60 bg-surface-100',
          'hover:border-purple/30 hover:bg-purple/[0.03]',
          'transition-all duration-150'
        )}
      >
        <RankBadge rank={rank} />

        {/* Coalition icon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple/10 border border-purple/25 flex-shrink-0">
          <Shield className="h-4 w-4 text-purple" />
        </div>

        {/* Name + secondary */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-white truncate">
            {coalition.name}
          </p>
          <p className="font-mono text-[11px] text-surface-500 truncate">
            {secondaryValue}
          </p>
        </div>

        {/* Wins / losses */}
        {totalMatches > 0 && (
          <div className="hidden sm:flex items-center gap-1 font-mono text-[11px] flex-shrink-0">
            <Swords className="h-3 w-3 text-surface-500" />
            <span className="text-emerald">{coalition.wins}W</span>
            <span className="text-surface-600">/</span>
            <span className="text-against-400">{coalition.losses}L</span>
            {wr !== null && (
              <span
                className={cn(
                  'ml-1 font-bold',
                  wr >= 50 ? 'text-emerald' : 'text-against-400'
                )}
              >
                {wr}%
              </span>
            )}
          </div>
        )}

        {/* Primary metric */}
        <div className="text-right flex-shrink-0 min-w-[60px]">
          <p className="font-mono text-sm font-bold text-white tabular-nums">
            {primaryValue}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Sort mode tabs ───────────────────────────────────────────────────────────

const SORT_TABS: { id: SortMode; label: string; icon: typeof Zap }[] = [
  { id: 'influence', label: 'Influence', icon: Zap },
  { id: 'winrate', label: 'Win Rate', icon: Trophy },
  { id: 'size', label: 'Members', icon: Users },
]

// ─── Main component ───────────────────────────────────────────────────────────

interface CoalitionLeaderboardProps {
  coalitions: Coalition[]
}

export function CoalitionLeaderboard({ coalitions }: CoalitionLeaderboardProps) {
  const [sortMode, setSortMode] = useState<SortMode>('influence')

  const rows = useMemo(() => sortAndBuild(coalitions, sortMode), [coalitions, sortMode])
  const podium = rows.slice(0, 3)
  const rest = rows.slice(3)

  if (coalitions.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-10 text-center">
        <Shield className="mx-auto h-8 w-8 text-surface-500 mb-3" />
        <p className="font-mono text-sm text-surface-500">
          No public coalitions yet. Be the first to form one.
        </p>
        <Link
          href="/coalitions/create"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-purple/15 border border-purple/30 text-purple font-mono text-sm font-semibold hover:bg-purple/25 transition-colors"
        >
          Form a Coalition
        </Link>
      </div>
    )
  }

  const sortConfig = {
    influence: { label: 'Influence', unit: 'pts' },
    winrate: { label: 'Win Rate', unit: '%' },
    size: { label: 'Members', unit: '' },
  }[sortMode]

  return (
    <div>
      {/* Sort tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
        {SORT_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = sortMode === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSortMode(tab.id)}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium whitespace-nowrap transition',
                isActive
                  ? 'bg-purple/15 text-purple border border-purple/30'
                  : 'text-surface-500 hover:text-surface-700 hover:bg-surface-200'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
        <span className="ml-auto font-mono text-[11px] text-surface-500 whitespace-nowrap">
          {coalitions.length} coalitions
        </span>
      </div>

      {/* Top 3 podium */}
      {podium.length > 0 && (
        <div
          className={cn(
            'grid gap-3 mb-6',
            podium.length === 1
              ? 'grid-cols-1 max-w-sm mx-auto'
              : podium.length === 2
              ? 'grid-cols-2'
              : 'grid-cols-3'
          )}
        >
          {podium.map((row, i) => (
            <PodiumCard key={row.coalition.id} row={row} delay={i * 0.05} />
          ))}
        </div>
      )}

      {/* Ranked list (4+) */}
      {rest.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-xs text-surface-500 uppercase tracking-wider">
              Ranked by {sortConfig.label}
            </p>
            <p className="font-mono text-xs text-surface-500 uppercase tracking-wider hidden sm:block">
              W / L · {sortConfig.label}
            </p>
          </div>
          {rest.map((row, i) => (
            <LeaderRow key={row.coalition.id} row={row} delay={i * 0.03} />
          ))}
        </div>
      )}
    </div>
  )
}
