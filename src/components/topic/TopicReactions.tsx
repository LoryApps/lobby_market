'use client'

/**
 * TopicReactions
 *
 * Four quick emoji reactions users can pin to a topic.
 * Each user can hold exactly one reaction at a time — tapping the same
 * reaction again removes it (toggle). Tapping a different reaction swaps.
 *
 * Layout: compact horizontal pill strip, suitable for TopicCard footers
 * and the full TopicDetail page.
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReactionType = 'insightful' | 'controversial' | 'complex' | 'surprising'

interface ReactionConfig {
  emoji: string
  label: string
  activeClass: string
}

// ─── Reaction config ──────────────────────────────────────────────────────────

const REACTIONS: { type: ReactionType; config: ReactionConfig }[] = [
  {
    type: 'insightful',
    config: {
      emoji: '💡',
      label: 'Insightful',
      activeClass: 'bg-gold/20 border-gold/60 text-gold',
    },
  },
  {
    type: 'controversial',
    config: {
      emoji: '🔥',
      label: 'Controversial',
      activeClass: 'bg-against-500/20 border-against-500/60 text-against-300',
    },
  },
  {
    type: 'complex',
    config: {
      emoji: '⚖️',
      label: 'Complex',
      activeClass: 'bg-purple/20 border-purple/60 text-purple',
    },
  },
  {
    type: 'surprising',
    config: {
      emoji: '😮',
      label: 'Surprising',
      activeClass: 'bg-for-500/20 border-for-500/60 text-for-300',
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n > 0 ? String(n) : ''
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopicReactionsProps {
  topicId: string
  /** Pre-fetched counts (SSR/RSC). If omitted, fetched client-side. */
  initialCounts?: Record<ReactionType, number>
  /** Pre-fetched user reaction. If omitted, fetched client-side. */
  initialMyReaction?: ReactionType | null
  size?: 'sm' | 'md'
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicReactions({
  topicId,
  initialCounts,
  initialMyReaction,
  size = 'sm',
  className,
}: TopicReactionsProps) {
  const [counts, setCounts] = useState<Record<ReactionType, number>>(
    initialCounts ?? { insightful: 0, controversial: 0, complex: 0, surprising: 0 }
  )
  const [myReaction, setMyReaction] = useState<ReactionType | null>(
    initialMyReaction ?? null
  )
  const [loading, setLoading] = useState(!initialCounts)
  const [toggling, setToggling] = useState<ReactionType | null>(null)

  // Fetch initial state when no SSR data provided
  useEffect(() => {
    if (initialCounts !== undefined) return
    let cancelled = false
    fetch(`/api/topics/${topicId}/reactions`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d.counts) setCounts(d.counts)
        setMyReaction(d.myReaction ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [topicId, initialCounts])

  const handleReact = useCallback(
    async (type: ReactionType) => {
      if (toggling) return
      setToggling(type)

      // Optimistic update
      const prevCounts = { ...counts }
      const prevReaction = myReaction

      if (myReaction === type) {
        // Toggle off
        setCounts((c) => ({ ...c, [type]: Math.max(0, c[type] - 1) }))
        setMyReaction(null)
      } else {
        // Swap or add
        const next = { ...counts }
        if (myReaction) next[myReaction] = Math.max(0, next[myReaction] - 1)
        next[type] = next[type] + 1
        setCounts(next)
        setMyReaction(type)
      }

      try {
        const res = await fetch(`/api/topics/${topicId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction: type }),
        })
        if (res.status === 401) {
          // Not logged in — revert
          setCounts(prevCounts)
          setMyReaction(prevReaction)
          return
        }
        const data = await res.json()
        if (data.counts) setCounts(data.counts)
        if ('myReaction' in data) setMyReaction(data.myReaction)
      } catch {
        // Revert on error
        setCounts(prevCounts)
        setMyReaction(prevReaction)
      } finally {
        setToggling(null)
      }
    },
    [topicId, counts, myReaction, toggling]
  )

  const isSm = size === 'sm'

  if (loading) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {REACTIONS.map(({ type }) => (
          <div
            key={type}
            className={cn(
              'rounded-full border border-surface-300/40 bg-surface-200/40 animate-pulse',
              isSm ? 'h-6 w-14' : 'h-7 w-16'
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label="Topic reactions"
      className={cn('flex items-center gap-1 flex-wrap', className)}
    >
      {REACTIONS.map(({ type, config }) => {
        const isActive = myReaction === type
        const isBusy = toggling === type
        const count = counts[type] ?? 0

        return (
          <motion.button
            key={type}
            whileTap={!isBusy ? { scale: 0.92 } : undefined}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleReact(type)
            }}
            aria-pressed={isActive}
            aria-label={`${isActive ? 'Remove' : 'Add'} ${config.label} reaction${count > 0 ? `, ${count} reactions` : ''}`}
            disabled={isBusy}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border font-mono font-medium',
              'transition-all duration-150 disabled:opacity-50',
              isSm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
              isActive
                ? config.activeClass
                : 'bg-surface-200/50 border-surface-300/50 text-surface-500 hover:border-surface-400/70 hover:text-surface-400'
            )}
          >
            <span aria-hidden="true">{config.emoji}</span>
            {count > 0 && (
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={count}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="tabular-nums"
                >
                  {formatCount(count)}
                </motion.span>
              </AnimatePresence>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
