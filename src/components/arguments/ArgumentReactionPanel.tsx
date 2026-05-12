'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

// ─── Types (mirror the API route) ─────────────────────────────────────────────

export type ArgumentReactionType = 'insightful' | 'compelling' | 'balanced' | 'needs_evidence'

export interface ReactionCounts {
  insightful: number
  compelling: number
  balanced: number
  needs_evidence: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const REACTIONS: {
  id: ArgumentReactionType
  emoji: string
  label: string
  title: string
  activeClass: string
  hoverClass: string
}[] = [
  {
    id: 'insightful',
    emoji: '💡',
    label: 'Insightful',
    title: 'Insightful — shifted my thinking',
    activeClass: 'bg-gold/20 border-gold/60 text-gold',
    hoverClass: 'hover:bg-gold/10 hover:border-gold/40 hover:text-gold',
  },
  {
    id: 'compelling',
    emoji: '🔥',
    label: 'Compelling',
    title: 'Compelling — strong, well-made point',
    activeClass: 'bg-against-500/20 border-against-500/60 text-against-300',
    hoverClass: 'hover:bg-against-500/10 hover:border-against-500/40 hover:text-against-300',
  },
  {
    id: 'balanced',
    emoji: '⚖️',
    label: 'Balanced',
    title: 'Balanced — fair and nuanced take',
    activeClass: 'bg-for-500/20 border-for-500/60 text-for-300',
    hoverClass: 'hover:bg-for-500/10 hover:border-for-500/40 hover:text-for-300',
  },
  {
    id: 'needs_evidence',
    emoji: '🔍',
    label: 'Needs source',
    title: 'Needs source — good point, but cite it',
    activeClass: 'bg-purple/20 border-purple/60 text-purple',
    hoverClass: 'hover:bg-purple/10 hover:border-purple/40 hover:text-purple',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  argId: string
  /** Pre-loaded counts (e.g. from server fetch on a single-argument page). */
  initialCounts?: ReactionCounts
  /** Pre-loaded current user's reaction. */
  initialUserReaction?: ArgumentReactionType | null
  /**
   * compact=true → small pill buttons for use inside argument list cards.
   * compact=false → larger labelled buttons for the dedicated argument page.
   */
  compact?: boolean
  className?: string
}

export function ArgumentReactionPanel({
  topicId,
  argId,
  initialCounts,
  initialUserReaction = null,
  compact = true,
  className,
}: Props) {
  const [counts, setCounts] = useState<ReactionCounts | null>(initialCounts ?? null)
  const [userReaction, setUserReaction] = useState<ArgumentReactionType | null>(initialUserReaction)
  const [pending, setPending] = useState(false)

  const handleReact = useCallback(
    async (reaction: ArgumentReactionType) => {
      if (pending) return
      setPending(true)

      // Optimistic update
      const prev = userReaction
      const prevCounts = counts
      const isToggleOff = userReaction === reaction

      setUserReaction(isToggleOff ? null : reaction)
      if (counts) {
        setCounts((c) => {
          if (!c) return c
          const next = { ...c }
          if (prev && prev in next) next[prev] = Math.max(0, next[prev] - 1)
          if (!isToggleOff) next[reaction] = next[reaction] + 1
          return next
        })
      }

      try {
        const res = await fetch(`/api/topics/${topicId}/arguments/${argId}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction }),
        })

        if (!res.ok) {
          // Revert on error
          setUserReaction(prev)
          setCounts(prevCounts)
        } else {
          const data = await res.json() as { counts: ReactionCounts; userReaction: ArgumentReactionType | null }
          setCounts(data.counts)
          setUserReaction(data.userReaction)
        }
      } catch {
        setUserReaction(prev)
        setCounts(prevCounts)
      } finally {
        setPending(false)
      }
    },
    [pending, userReaction, counts, topicId, argId]
  )

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1 flex-wrap', className)}>
        {REACTIONS.map((r) => {
          const isActive = userReaction === r.id
          const count = counts?.[r.id] ?? 0
          return (
            <button
              key={r.id}
              onClick={() => handleReact(r.id)}
              disabled={pending}
              title={r.title}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono border transition-all',
                'border-surface-400/30 text-surface-500',
                !isActive && r.hoverClass,
                isActive && r.activeClass,
                pending && 'opacity-60 cursor-not-allowed',
              )}
            >
              <span className="text-[13px] leading-none">{r.emoji}</span>
              {count > 0 && (
                <span className={cn('font-semibold tabular-nums', isActive ? '' : 'text-surface-400')}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <Link
          href="/arguments/reactions"
          className="text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors ml-0.5 flex-shrink-0"
          title="View reaction leaderboard"
        >
          ↗
        </Link>
      </div>
    )
  }

  // Full-size labelled panel
  return (
    <div className={cn('rounded-xl border border-surface-300 bg-surface-100 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
          Community Reactions
        </span>
        <Link
          href="/arguments/reactions"
          className="text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
        >
          Leaderboard →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {REACTIONS.map((r) => {
          const isActive = userReaction === r.id
          const count = counts?.[r.id] ?? 0
          return (
            <button
              key={r.id}
              onClick={() => handleReact(r.id)}
              disabled={pending}
              title={r.title}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left',
                'border-surface-400/30 text-surface-400',
                !isActive && r.hoverClass,
                isActive && r.activeClass,
                pending && 'opacity-60 cursor-not-allowed',
              )}
            >
              <span className="text-base leading-none flex-shrink-0">{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold truncate">
                  {r.label}
                </p>
              </div>
              {count > 0 && (
                <span className={cn(
                  'text-xs font-mono font-bold tabular-nums flex-shrink-0',
                  isActive ? '' : 'text-surface-500',
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {userReaction && (
        <p className="mt-2.5 text-[10px] font-mono text-surface-600 text-center">
          You reacted with {REACTIONS.find((r) => r.id === userReaction)?.emoji}{' '}
          {REACTIONS.find((r) => r.id === userReaction)?.label} · tap again to remove
        </p>
      )}
    </div>
  )
}
