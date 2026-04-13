'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { VoteSide } from '@/lib/supabase/types'
import { ConfettiBurst } from '@/components/simulation/ConfettiBurst'

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

  const [burstTrigger, setBurstTrigger] = useState(0)
  const [burstSide, setBurstSide] = useState<'blue' | 'red'>('blue')

  const handleVote = (side: VoteSide) => {
    if (disabled) return
    setBurstSide(side === 'blue' ? 'blue' : 'red')
    setBurstTrigger((t) => t + 1)
    onVote(side)
  }

  return (
    <div className="relative flex gap-3 w-full" role="group" aria-label="Cast your vote">
      {/* Agree button */}
      <motion.button
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        disabled={disabled}
        onClick={() => handleVote('blue')}
        aria-label={hasVoted && votedSide === 'blue' ? 'Your vote: Agree' : 'Vote Agree'}
        aria-pressed={hasVoted ? votedSide === 'blue' : undefined}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors',
          !hasVoted && !disabled && 'bg-for-600 text-white hover:bg-for-700',
          hasVoted && votedSide === 'blue' && 'bg-for-600 text-white',
          hasVoted && votedSide !== 'blue' && 'bg-transparent border border-surface-300 text-surface-500',
          disabled && 'bg-surface-300 text-surface-500 cursor-not-allowed'
        )}
      >
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        AGREE
      </motion.button>

      {/* Disagree button */}
      <motion.button
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        disabled={disabled}
        onClick={() => handleVote('red')}
        aria-label={hasVoted && votedSide === 'red' ? 'Your vote: Disagree' : 'Vote Disagree'}
        aria-pressed={hasVoted ? votedSide === 'red' : undefined}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors',
          !hasVoted && !disabled && 'bg-against-600 text-white hover:bg-against-700',
          hasVoted && votedSide === 'red' && 'bg-against-600 text-white',
          hasVoted && votedSide !== 'red' && 'bg-transparent border border-surface-300 text-surface-500',
          disabled && 'bg-surface-300 text-surface-500 cursor-not-allowed'
        )}
      >
        <ThumbsDown className="h-4 w-4" aria-hidden="true" />
        DISAGREE
      </motion.button>

      {/* Confetti burst overlay */}
      <ConfettiBurst trigger={burstTrigger} side={burstSide} />
    </div>
  )
}
