'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Crown, Medal, Trophy, Minus, TrendingUp, TrendingDown } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { RoleBadge, getRoleRingClass } from '@/components/profile/RoleBadge'
import type { Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export type TrendDirection = 'up' | 'down' | 'flat'

export interface LeaderboardRow {
  profile: Profile
  rank: number
  metricValue: number
  trend?: TrendDirection
}

interface LeaderboardTableProps {
  rows: LeaderboardRow[]
  metricLabel: string
  startIndex?: number
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gold/20 border border-gold/40">
        <Crown className="h-5 w-5 text-gold" />
      </div>
    )
  }
  if (rank === 2) {
    return (
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-400/30 border border-surface-500/40">
        <Medal className="h-5 w-5 text-surface-600" />
      </div>
    )
  }
  if (rank === 3) {
    return (
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#cd7f32]/20 border border-[#cd7f32]/40">
        <Trophy className="h-5 w-5 text-[#cd7f32]" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-200 border border-surface-300">
      <span className="font-mono text-sm font-bold text-surface-600">
        {rank}
      </span>
    </div>
  )
}

function TrendIcon({ trend }: { trend?: TrendDirection }) {
  if (!trend || trend === 'flat') {
    return <Minus className="h-3.5 w-3.5 text-surface-500" />
  }
  if (trend === 'up') {
    return <TrendingUp className="h-3.5 w-3.5 text-emerald" />
  }
  return <TrendingDown className="h-3.5 w-3.5 text-against-500" />
}

export function LeaderboardTable({
  rows,
  metricLabel,
  startIndex = 0,
}: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
        <div className="text-sm font-mono text-surface-500">
          No data yet in this category.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="divide-y divide-surface-300">
        {rows.slice(startIndex).map((row, idx) => {
          const displayName = row.profile.display_name || row.profile.username
          const ring = getRoleRingClass(row.profile.role)

          return (
            <motion.div
              key={row.profile.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.02 }}
            >
              <Link
                href={`/profile/${row.profile.username}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-surface-200 transition-colors"
              >
                <RankBadge rank={row.rank} />

                <div
                  className={cn(
                    'flex-shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-surface-100',
                    ring
                  )}
                >
                  <Avatar
                    src={row.profile.avatar_url}
                    fallback={displayName}
                    size="md"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate text-sm font-semibold text-white">
                      {displayName}
                    </span>
                    {row.profile.is_influencer && (
                      <span className="text-gold text-xs">★</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
                    <span className="truncate">@{row.profile.username}</span>
                    <RoleBadge role={row.profile.role} size="sm" />
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="font-mono text-base font-bold text-white">
                      {row.metricValue.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                      {metricLabel}
                    </div>
                  </div>
                  <div className="hidden sm:block">
                    <TrendIcon trend={row.trend} />
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
