'use client'

/**
 * RecommendedCoalitions
 *
 * "Suggested for You" strip on the coalitions page.
 * Fetches /api/coalitions/recommended and displays up to 5 cards in a
 * horizontally-scrollable row, each showing the coalition's key stats and
 * the user's voting-alignment percentage.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Crown, Sparkles, Trophy, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { RecommendedCoalition } from '@/app/api/coalitions/recommended/route'

// ─── Alignment badge ──────────────────────────────────────────────────────────

function AlignmentBadge({
  pct,
  stanceCount,
}: {
  pct: number
  stanceCount: number
}) {
  if (stanceCount === 0) {
    return (
      <span className="font-mono text-[9px] text-surface-500 bg-surface-200/60 px-1.5 py-0.5 rounded">
        NEW
      </span>
    )
  }

  const color =
    pct >= 75
      ? 'bg-emerald/10 text-emerald border-emerald/30'
      : pct >= 50
        ? 'bg-for-500/10 text-for-400 border-for-500/30'
        : 'bg-surface-200/60 text-surface-500 border-surface-400/30'

  return (
    <span
      className={cn(
        'font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border',
        color
      )}
    >
      {pct}% match
    </span>
  )
}

// ─── Card skeleton ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="flex-shrink-0 w-56 rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-14 rounded" />
      </div>
    </div>
  )
}

// ─── Single recommendation card ───────────────────────────────────────────────

function RecommendedCard({ coalition }: { coalition: RecommendedCoalition }) {
  const totalMatches = coalition.wins + coalition.losses
  const winRate =
    totalMatches > 0 ? Math.round((coalition.wins / totalMatches) * 100) : 0

  return (
    <Link
      href={`/coalitions/${coalition.id}`}
      className={cn(
        'group flex-shrink-0 w-56 rounded-xl bg-surface-100 border border-surface-300 p-4',
        'hover:border-purple/40 hover:bg-purple/[0.03]',
        'transition-all duration-200 block'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2 mb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple/10 border border-purple/30 text-purple flex-shrink-0">
          <Users className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-mono text-xs font-semibold text-white truncate group-hover:text-purple transition-colors">
            {coalition.name}
          </h4>
          <p className="font-mono text-[9px] text-surface-500 truncate">
            @{coalition.creator?.username ?? 'unknown'}
          </p>
        </div>
      </div>

      {/* Description */}
      {coalition.description && (
        <p className="font-mono text-[10px] text-surface-600 line-clamp-2 leading-relaxed mb-3">
          {coalition.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-300/50">
        <div className="flex items-center gap-2 font-mono text-[10px] text-surface-500">
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            <span className="tabular-nums text-surface-600">
              {coalition.member_count}
            </span>
          </span>
          {totalMatches > 0 && (
            <span className="flex items-center gap-0.5 text-emerald">
              <Trophy className="h-2.5 w-2.5" />
              <span className="tabular-nums">{winRate}%</span>
            </span>
          )}
          <span className="flex items-center gap-0.5 text-gold">
            <Crown className="h-2.5 w-2.5" />
            <span className="tabular-nums">
              {Math.round(coalition.coalition_influence)}
            </span>
          </span>
        </div>
        <AlignmentBadge
          pct={coalition.alignment_pct}
          stanceCount={coalition.stance_count}
        />
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface RecommendedCoalitionsProps {
  className?: string
}

export function RecommendedCoalitions({ className }: RecommendedCoalitionsProps) {
  const [coalitions, setCoalitions] = useState<RecommendedCoalition[]>([])
  const [votesAnalyzed, setVotesAnalyzed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/coalitions/recommended')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.coalitions?.length) {
          setCoalitions(data.coalitions)
          setVotesAnalyzed(data.votes_analyzed ?? 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (dismissed) return null
  if (!loading && coalitions.length === 0) return null

  return (
    <section className={cn('mb-8', className)} aria-label="Suggested coalitions">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple" aria-hidden="true" />
          <h2 className="font-mono text-sm font-semibold text-white">
            Suggested for You
          </h2>
          {!loading && votesAnalyzed > 0 && (
            <span className="font-mono text-[10px] text-surface-500">
              based on {votesAnalyzed} vote{votesAnalyzed !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss suggested coalitions"
          className="font-mono text-[10px] text-surface-500 hover:text-surface-700 transition-colors"
        >
          dismiss
        </button>
      </div>

      {/* Horizontal scroll row */}
      <div
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        role="list"
        aria-label="Recommended coalition cards"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
          : coalitions.map((c) => (
              <div key={c.id} role="listitem">
                <RecommendedCard coalition={c} />
              </div>
            ))}
      </div>
    </section>
  )
}
