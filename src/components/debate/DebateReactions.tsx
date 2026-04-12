'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { VoteSide } from '@/lib/supabase/types'

export interface FloatingReaction {
  id: string
  emoji: string
  side: VoteSide | null
  x: number // 0..1 horizontal within its half
}

interface DebateReactionsProps {
  reactions: FloatingReaction[]
  onExpire: (id: string) => void
}

const LIFETIME_MS = 2600

export function DebateReactions({
  reactions,
  onExpire,
}: DebateReactionsProps) {
  // Remove reactions after lifetime expires
  useEffect(() => {
    if (reactions.length === 0) return
    const timers = reactions.map((r) =>
      setTimeout(() => onExpire(r.id), LIFETIME_MS)
    )
    return () => timers.forEach(clearTimeout)
  }, [reactions, onExpire])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
      <AnimatePresence>
        {reactions.map((r) => {
          // If side is blue → left half (0-50%), red → right half (50-100%), neutral → center-ish
          const xBase =
            r.side === 'blue' ? 0 : r.side === 'red' ? 50 : 25
          const xRange = r.side === null ? 50 : 50
          const leftPct = xBase + r.x * xRange

          return (
            <motion.div
              key={r.id}
              initial={{
                opacity: 0,
                y: 0,
                scale: 0.5,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: -320,
                scale: [0.5, 1.2, 1, 0.8],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: LIFETIME_MS / 1000,
                ease: 'easeOut',
                times: [0, 0.1, 0.7, 1],
              }}
              className="absolute bottom-24 text-4xl select-none"
              style={{
                left: `${leftPct}%`,
              }}
            >
              {r.emoji}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export const BLUE_EMOJIS = ['👍', '💙', '💯', '✅', '🧠']
export const RED_EMOJIS = ['👎', '❤️', '💢', '⚡', '🛡️']
export const NEUTRAL_EMOJIS = ['🔥', '😂', '🤔', '👀', '🎯']

interface ReactionTriggerProps {
  side: VoteSide | null
  onReact: (emoji: string, side: VoteSide | null) => void
}

export function ReactionTrigger({ side, onReact }: ReactionTriggerProps) {
  const [open, setOpen] = useState(false)
  const pool =
    side === 'blue' ? BLUE_EMOJIS : side === 'red' ? RED_EMOJIS : NEUTRAL_EMOJIS

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-10 w-10 rounded-full bg-surface-200/80 backdrop-blur-md border border-surface-300 text-2xl flex items-center justify-center hover:bg-surface-300 transition-colors"
        aria-label="Send reaction"
      >
        ＋
      </button>
      {open && (
        <div className="absolute bottom-12 left-0 flex gap-1 bg-surface-200/95 backdrop-blur-md border border-surface-300 rounded-full p-1 shadow-2xl">
          {pool.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji, side)
                setOpen(false)
              }}
              className="h-9 w-9 rounded-full text-xl flex items-center justify-center hover:bg-surface-300 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
