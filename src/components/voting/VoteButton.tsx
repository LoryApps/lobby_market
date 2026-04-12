'use client'

import { motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { VoteSide } from '@/lib/supabase/types'

interface VoteButtonProps {
  topicId: string
  bluePct: number
  onVote: (side: VoteSide) => void
  disabled?: boolean
  votedSide?: VoteSide | null
}

export function VoteButton(props: VoteButtonProps) {
  const {
    onVote,
    disabled = false,
    votedSide,
  } = props
  const hasVoted = votedSide !== null && votedSide !== undefined

  return (
    <div className="flex gap-3 w-full">
      {/* Agree button */}
      <motion.button
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        disabled={disabled}
        onClick={() => onVote('blue')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors',
          !hasVoted && !disabled && 'bg-for-600 text-white hover:bg-for-700',
          hasVoted && votedSide === 'blue' && 'bg-for-600 text-white',
          hasVoted && votedSide !== 'blue' && 'bg-transparent border border-surface-300 text-surface-500',
          disabled && 'bg-surface-300 text-surface-500 cursor-not-allowed'
        )}
      >
        <ThumbsUp className="h-4 w-4" />
        AGREE
      </motion.button>

      {/* Disagree button */}
      <motion.button
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        disabled={disabled}
        onClick={() => onVote('red')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors',
          !hasVoted && !disabled && 'bg-against-600 text-white hover:bg-against-700',
          hasVoted && votedSide === 'red' && 'bg-against-600 text-white',
          hasVoted && votedSide !== 'red' && 'bg-transparent border border-surface-300 text-surface-500',
          disabled && 'bg-surface-300 text-surface-500 cursor-not-allowed'
        )}
      >
        <ThumbsDown className="h-4 w-4" />
        DISAGREE
      </motion.button>
    </div>
  )
}
