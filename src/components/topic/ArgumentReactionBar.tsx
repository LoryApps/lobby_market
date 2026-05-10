'use client'

/**
 * ArgumentReactionBar
 *
 * Emoji-style reactions for a single argument. Four reaction types:
 *   💡 Insightful   – shifted my thinking
 *   🔥 Compelling   – strong, well-made point
 *   ⚖️  Balanced     – considers both sides
 *   🔍 Needs source – good point, needs a citation
 *
 * Behaviour:
 *   - Loads reaction counts on mount (lazy — one fetch per visible argument)
 *   - Toggling the same reaction removes it; selecting a new one replaces the old
 *   - Optimistic UI update so the count responds instantly
 *   - Unauthenticated users see counts but cannot react
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentReactionType,
  ArgumentReactionsResponse,
  ReactionCounts,
} from '@/app/api/topics/[id]/arguments/[argId]/react/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const REACTIONS: {
  type: ArgumentReactionType
  emoji: string
  label: string
  activeClass: string
}[] = [
  {
    type: 'insightful',
    emoji: '💡',
    label: 'Insightful',
    activeClass: 'bg-gold/15 border-gold/40 text-gold',
  },
  {
    type: 'compelling',
    emoji: '🔥',
    label: 'Compelling',
    activeClass: 'bg-against-500/15 border-against-500/40 text-against-400',
  },
  {
    type: 'balanced',
    emoji: '⚖️',
    label: 'Balanced',
    activeClass: 'bg-for-500/15 border-for-500/40 text-for-400',
  },
  {
    type: 'needs_evidence',
    emoji: '🔍',
    label: 'Needs source',
    activeClass: 'bg-purple/15 border-purple/40 text-purple',
  },
]

const ZERO_COUNTS: ReactionCounts = {
  insightful: 0,
  compelling: 0,
  balanced: 0,
  needs_evidence: 0,
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArgumentReactionBarProps {
  topicId: string
  argumentId: string
  /** When false, reaction buttons are rendered but disabled */
  canReact?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArgumentReactionBar({
  topicId,
  argumentId,
  canReact = false,
}: ArgumentReactionBarProps) {
  const [counts, setCounts] = useState<ReactionCounts>(ZERO_COUNTS)
  const [userReaction, setUserReaction] = useState<ArgumentReactionType | null>(null)
  const [loading, setLoading] = useState(true)
  const [reacting, setReacting] = useState(false)
  const [tooltip, setTooltip] = useState<ArgumentReactionType | null>(null)
  const loaded = useRef(false)

  // Load once on mount
  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    fetch(`/api/topics/${topicId}/arguments/${argumentId}/react`, {
      cache: 'no-store',
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: ArgumentReactionsResponse | null) => {
        if (data) {
          setCounts(data.counts)
          setUserReaction(data.userReaction)
        }
      })
      .catch(() => { /* silent — non-critical */ })
      .finally(() => setLoading(false))
  }, [topicId, argumentId])

  const handleReact = useCallback(
    async (type: ArgumentReactionType) => {
      if (!canReact || reacting) return

      // Optimistic update
      const prevCounts = counts
      const prevUserReaction = userReaction
      const removing = userReaction === type

      setReacting(true)

      const optimisticCounts = { ...counts }
      if (prevUserReaction) optimisticCounts[prevUserReaction] = Math.max(0, optimisticCounts[prevUserReaction] - 1)
      if (!removing) optimisticCounts[type]++
      setCounts(optimisticCounts)
      setUserReaction(removing ? null : type)

      try {
        const res = await fetch(
          `/api/topics/${topicId}/arguments/${argumentId}/react`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reaction: type }),
          }
        )
        if (!res.ok) throw new Error()
        const data: ArgumentReactionsResponse = await res.json()
        setCounts(data.counts)
        setUserReaction(data.userReaction)
      } catch {
        // Rollback
        setCounts(prevCounts)
        setUserReaction(prevUserReaction)
      } finally {
        setReacting(false)
      }
    },
    [canReact, reacting, counts, userReaction, topicId, argumentId]
  )

  // Only render if there's something to show (counts > 0 or user can react)
  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0)
  if (loading || (!canReact && totalReactions === 0)) return null

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1.5" role="group" aria-label="Argument reactions">
      {REACTIONS.map(({ type, emoji, label, activeClass }) => {
        const count = counts[type]
        const isActive = userReaction === type
        const showCount = count > 0

        // Hide zero-count reactions that the user isn't hovering
        if (!showCount && !canReact) return null

        return (
          <div key={type} className="relative">
            <motion.button
              type="button"
              disabled={!canReact || reacting}
              onClick={() => handleReact(type)}
              onMouseEnter={() => setTooltip(type)}
              onMouseLeave={() => setTooltip(null)}
              aria-label={`${label}${count > 0 ? ` (${count})` : ''}`}
              aria-pressed={isActive}
              whileTap={canReact ? { scale: 0.88 } : undefined}
              className={cn(
                'flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-mono',
                'transition-all duration-150',
                isActive
                  ? activeClass
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-500',
                canReact && !isActive && 'hover:border-surface-400 hover:text-surface-300 cursor-pointer',
                !canReact && 'cursor-default',
              )}
            >
              <span aria-hidden="true" className="text-[11px] leading-none">{emoji}</span>
              <AnimatePresence mode="popLayout" initial={false}>
                {showCount && (
                  <motion.span
                    key={count}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Tooltip */}
            <AnimatePresence>
              {tooltip === type && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 pointer-events-none"
                >
                  <div className="bg-surface-100 border border-surface-300 rounded-lg px-2 py-1 text-[10px] font-mono text-white whitespace-nowrap shadow-lg">
                    {label}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
