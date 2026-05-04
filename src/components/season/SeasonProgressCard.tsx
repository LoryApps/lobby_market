'use client'

/**
 * SeasonProgressCard
 *
 * Compact card for the Dashboard showing the current season,
 * the user's rank, and a breakdown of how points were earned.
 * Fetches from /api/me/season on mount.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  Crown,
  Gavel,
  MessageSquare,
  Sparkles,
  Target,
  ThumbsUp,
  Timer,
  Vote,
  Zap,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MeSeasonData } from '@/app/api/me/season/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Season ended'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 2) return `${d}d ${h}h left`
  if (d > 0) return `${d}d ${h}h ${m}m left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

function rankSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] ?? s[v] ?? s[0]
}

// Rank tier labels and colours
const RANK_TIERS: Array<{ maxRank: number; label: string; color: string }> = [
  { maxRank: 1,   label: 'Season Champion',    color: 'text-gold' },
  { maxRank: 3,   label: 'Silver Senator',      color: 'text-for-200' },
  { maxRank: 10,  label: 'Bronze Statesman',    color: 'text-against-300' },
  { maxRank: 25,  label: 'Rising Citizen',      color: 'text-emerald' },
  { maxRank: 100, label: 'Active Participant',  color: 'text-purple' },
]

function getRankTier(rank: number) {
  return RANK_TIERS.find((t) => rank <= t.maxRank) ?? null
}

// Point-source config
const PT_SOURCES = [
  { key: 'vote_pts',       label: 'Votes',       icon: Vote,         color: 'text-for-400',     mul: 1   },
  { key: 'argument_pts',   label: 'Arguments',   icon: MessageSquare,color: 'text-purple',       mul: 5   },
  { key: 'debate_pts',     label: 'Debates',     icon: Zap,          color: 'text-emerald',      mul: 10  },
  { key: 'law_pts',        label: 'Laws',        icon: Gavel,        color: 'text-gold',         mul: 25  },
  { key: 'upvote_pts',     label: 'Upvotes rec.',icon: ThumbsUp,     color: 'text-for-300',      mul: 3   },
  { key: 'prediction_pts', label: 'Predictions', icon: Target,       color: 'text-against-300',  mul: 15  },
] as const

type PtKey = (typeof PT_SOURCES)[number]['key']

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SeasonCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-lg" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SeasonProgressCardProps {
  className?: string
}

export function SeasonProgressCard({ className }: SeasonProgressCardProps) {
  const [data, setData] = useState<MeSeasonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    fetch('/api/me/season')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: MeSeasonData | null) => {
        if (json) {
          setData(json)
          setSecondsLeft(json.secondsLeft)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Tick the countdown
  useEffect(() => {
    if (secondsLeft <= 0) return
    const interval = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(interval)
  }, [secondsLeft])

  if (loading) return <SeasonCardSkeleton />
  if (!data?.season) return null

  const { season, myEntry, totalParticipants } = data
  const rankTier = myEntry ? getRankTier(myEntry.rank) : null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'rounded-2xl border p-5',
          'bg-gradient-to-br from-surface-100 to-surface-100/80',
          'border-gold/20',
          className,
        )}
        style={{ borderColor: `${season.theme_color}30` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0"
              style={{ backgroundColor: `${season.theme_color}20`, border: `1px solid ${season.theme_color}40` }}
            >
              <Crown className="h-3.5 w-3.5" style={{ color: season.theme_color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-mono font-semibold text-white truncate">
                {season.name}
              </p>
              {season.tagline && (
                <p className="text-[10px] font-mono text-surface-500 truncate">
                  {season.tagline}
                </p>
              )}
            </div>
          </div>
          <Link
            href="/season"
            className="flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
            aria-label="View season leaderboard"
          >
            View <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Rank + Points row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Rank */}
          <div className="rounded-xl bg-surface-200/60 border border-surface-300/50 px-3 py-2.5 text-center">
            {myEntry ? (
              <>
                <p
                  className={cn(
                    'text-xl font-mono font-bold tabular-nums',
                    rankTier?.color ?? 'text-white',
                  )}
                >
                  #{myEntry.rank}
                  <span className="text-xs align-super">{rankSuffix(myEntry.rank)}</span>
                </p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                  {rankTier?.label ?? `of ${totalParticipants}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-mono font-semibold text-surface-400">Unranked</p>
                <p className="text-[10px] font-mono text-surface-500 mt-0.5">No actions yet</p>
              </>
            )}
          </div>

          {/* Points */}
          <div className="rounded-xl bg-surface-200/60 border border-surface-300/50 px-3 py-2.5 text-center">
            <p className="text-xl font-mono font-bold tabular-nums text-gold">
              {myEntry?.total_pts?.toLocaleString() ?? '0'}
            </p>
            <p className="text-[10px] font-mono text-surface-500 mt-0.5">Season pts</p>
          </div>
        </div>

        {/* Points breakdown (only when user has earned some) */}
        {myEntry && myEntry.total_pts > 0 && (
          <div className="space-y-1.5 mb-4">
            {PT_SOURCES.filter((s) => (myEntry[s.key as PtKey] ?? 0) > 0).map((src) => {
              const pts = myEntry[src.key as PtKey] ?? 0
              const Icon = src.icon
              return (
                <div key={src.key} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('h-3 w-3', src.color)} aria-hidden />
                    <span className="text-[11px] font-mono text-surface-400">{src.label}</span>
                  </div>
                  <span className={cn('text-[11px] font-mono font-semibold tabular-nums', src.color)}>
                    +{pts.toLocaleString()} pts
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* No activity CTA */}
        {(!myEntry || myEntry.total_pts === 0) && (
          <div className="rounded-xl bg-gold/5 border border-gold/20 px-3 py-2.5 mb-4 text-center">
            <Sparkles className="h-4 w-4 text-gold mx-auto mb-1" aria-hidden />
            <p className="text-[11px] font-mono text-surface-400 leading-snug">
              Cast your first vote or write an argument to start earning Season Points.
            </p>
          </div>
        )}

        {/* Countdown footer */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-surface-300/40">
          <Timer className="h-3 w-3 text-surface-500 flex-shrink-0" aria-hidden />
          <span className="text-[10px] font-mono text-surface-500">
            {formatCountdown(secondsLeft)}
          </span>
          {totalParticipants > 0 && (
            <span className="ml-auto text-[10px] font-mono text-surface-500">
              {totalParticipants.toLocaleString()} participants
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
