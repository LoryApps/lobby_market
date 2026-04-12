'use client'

import { useMemo, useState } from 'react'
import { ThumbsUp, Shield, Trophy } from 'lucide-react'
import type { ContinuationWithAuthor } from '@/lib/supabase/types'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

interface ContinuationListProps {
  topicId: string
  topicStatement: string
  continuations: ContinuationWithAuthor[]
  authoringActive?: boolean
  className?: string
}

interface LocalState {
  boostedIds: Set<string>
  overrides: Map<string, number>
}

export function ContinuationList({
  topicId: _topicId,
  topicStatement,
  continuations,
  authoringActive = true,
  className,
}: ContinuationListProps) {
  const [local, setLocal] = useState<LocalState>(() => ({
    boostedIds: new Set(),
    overrides: new Map(),
  }))

  const sorted = useMemo(() => {
    return [...continuations].sort((a, b) => {
      const aBoost = local.overrides.get(a.id) ?? a.boost_count
      const bBoost = local.overrides.get(b.id) ?? b.boost_count
      if (bBoost !== aBoost) return bBoost - aBoost
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [continuations, local.overrides])

  const handleBoost = async (id: string) => {
    if (local.boostedIds.has(id)) return

    // Optimistic: mark boosted + bump count
    setLocal((prev) => {
      const nextBoosted = new Set(prev.boostedIds)
      nextBoosted.add(id)
      const current = continuations.find((c) => c.id === id)
      const nextOverrides = new Map(prev.overrides)
      const base = prev.overrides.get(id) ?? current?.boost_count ?? 0
      nextOverrides.set(id, base + 1)
      return { boostedIds: nextBoosted, overrides: nextOverrides }
    })

    try {
      const res = await fetch(`/api/continuations/${id}/boost`, {
        method: 'POST',
      })

      if (!res.ok && res.status !== 409) {
        // Rollback on failure (409 = already boosted, treat as success)
        setLocal((prev) => {
          const nextBoosted = new Set(prev.boostedIds)
          nextBoosted.delete(id)
          const nextOverrides = new Map(prev.overrides)
          const current = continuations.find((c) => c.id === id)
          const base = current?.boost_count ?? 0
          nextOverrides.set(id, base)
          return { boostedIds: nextBoosted, overrides: nextOverrides }
        })
      }
    } catch (err) {
      console.error('Boost failed:', err)
    }
  }

  if (continuations.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed border-surface-300 bg-surface-100 p-6 text-center',
          className
        )}
      >
        <p className="text-sm text-surface-500">
          No continuations yet. Be the first to refine this statement.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-bold uppercase tracking-widest text-surface-500">
          Submitted continuations
        </p>
        <p className="text-xs text-surface-500 tabular-nums">
          {continuations.length} proposed
        </p>
      </div>

      {sorted.map((cont, index) => {
        const author = cont.author
        const displayName =
          author?.display_name || author?.username || 'Anonymous'
        const isFinalist = cont.status === 'finalist'
        const isWinner = cont.status === 'winner'
        const endorsed = cont.endorsement_count > 0
        const hasBoosted = local.boostedIds.has(cont.id)
        const boostCount = local.overrides.get(cont.id) ?? cont.boost_count
        const topFive = index < 5

        return (
          <div
            key={cont.id}
            className={cn(
              'rounded-2xl border bg-surface-100 p-4 transition-colors',
              isWinner && 'border-gold/50 glow-gold',
              !isWinner && isFinalist && 'border-gold/30',
              !isWinner && !isFinalist && topFive && 'border-surface-400',
              !isWinner && !isFinalist && !topFive && 'border-surface-300'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar
                  src={author?.avatar_url}
                  fallback={displayName}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {displayName}
                  </p>
                  {author?.username && (
                    <p className="text-[11px] text-surface-500 truncate">
                      @{author.username}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isWinner && (
                  <Badge variant="law" className="gap-1">
                    <Trophy className="h-3 w-3" />
                    WINNER
                  </Badge>
                )}
                {!isWinner && isFinalist && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold">
                    Finalist
                  </span>
                )}
                {endorsed && (
                  <span
                    title={`Endorsed by ${cont.endorsement_count} debator(s)`}
                    className="inline-flex items-center gap-1 rounded-full bg-for-500/15 px-2 py-0.5 text-[10px] font-semibold text-for-400"
                  >
                    <Shield className="h-3 w-3" />
                    {cont.endorsement_count}
                  </span>
                )}
              </div>
            </div>

            {/* Chained statement */}
            <p className="text-sm leading-snug text-surface-700 mb-3">
              <span className="text-surface-500">{topicStatement}</span>{' '}
              <span className="font-semibold text-gold">
                ...{cont.connector}
              </span>{' '}
              <span className="text-white font-medium">{cont.text}</span>
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-surface-300">
              <div className="flex items-center gap-1.5 text-surface-500">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span className="text-xs font-medium tabular-nums">
                  {boostCount} {boostCount === 1 ? 'boost' : 'boosts'}
                </span>
              </div>
              {authoringActive && (
                <button
                  onClick={() => handleBoost(cont.id)}
                  disabled={hasBoosted}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                    hasBoosted
                      ? 'bg-emerald/15 text-emerald cursor-default'
                      : 'bg-gold/15 text-gold hover:bg-gold/25'
                  )}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {hasBoosted ? 'Boosted' : 'Boost'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
