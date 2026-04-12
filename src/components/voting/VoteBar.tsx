'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

interface VoteBarProps {
  bluePct: number
  totalVotes: number
  showLabels?: boolean
  className?: string
}

export function VoteBar({
  bluePct,
  totalVotes,
  showLabels = false,
  className,
}: VoteBarProps) {
  const redPct = 100 - bluePct
  const blueVotes = Math.round((bluePct / 100) * totalVotes)
  const redVotes = totalVotes - blueVotes
  const blueWinning = bluePct >= 50

  return (
    <div className={cn('w-full', className)}>
      {/* Percentage labels */}
      {showLabels && (
        <div className="flex justify-between mb-1.5 text-xs font-medium">
          <span className="text-for-400">{Math.round(bluePct)}% Agree</span>
          <span className="text-against-400">{Math.round(redPct)}% Disagree</span>
        </div>
      )}

      {/* Bar */}
      <div
        className={cn(
          'relative w-full h-3 rounded-full overflow-hidden bg-surface-300',
          blueWinning ? 'glow-blue' : 'glow-red'
        )}
      >
        {/* Blue side */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-l-full"
          initial={false}
          animate={{ width: `${bluePct}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          layout
        />

        {/* Red side */}
        <motion.div
          className="absolute inset-y-0 right-0 bg-gradient-to-r from-against-400 to-against-600 rounded-r-full"
          initial={false}
          animate={{ width: `${redPct}%` }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
          layout
        />
      </div>

      {/* Vote counts */}
      {showLabels && (
        <div className="flex justify-between mt-1.5 text-xs text-surface-500">
          <span>
            <AnimatedNumber value={blueVotes} /> votes
          </span>
          <span>
            <AnimatedNumber value={redVotes} /> votes
          </span>
        </div>
      )}
    </div>
  )
}
