'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface ReputationMeterProps {
  score: number
  max?: number
  size?: number
  className?: string
}

const MAX_REPUTATION = 10000

function stopColor(pct: number): string {
  if (pct < 0.33) return '#ef4444' // against-500 (red)
  if (pct < 0.66) return '#f59e0b' // gold
  return '#10b981' // emerald
}

export function ReputationMeter({
  score,
  max = MAX_REPUTATION,
  size = 160,
  className,
}: ReputationMeterProps) {
  const [hover, setHover] = useState(false)

  const pct = Math.min(1, Math.max(0, score / max))
  const radius = size / 2 - 10
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - pct)

  const strokeColor = stopColor(pct)

  return (
    <div
      className={cn('relative inline-flex flex-col items-center', className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <defs>
            <linearGradient
              id="reputation-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#24242e"
            strokeWidth={10}
            fill="none"
          />

          {/* Progress arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#reputation-gradient)"
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-mono text-2xl font-bold"
            style={{ color: strokeColor }}
          >
            {Math.round(score).toLocaleString()}
          </motion.div>
          <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
            Influence
          </div>
        </div>
      </div>

      {hover && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'absolute -bottom-20 left-1/2 -translate-x-1/2 z-10 w-56',
            'rounded-lg bg-surface-200 border border-surface-300 p-3',
            'text-[11px] font-mono text-surface-600 shadow-xl'
          )}
        >
          <div className="text-surface-700 font-semibold mb-1">
            Influence factors
          </div>
          <ul className="space-y-0.5">
            <li>+1 per vote cast</li>
            <li>+5 per topic authored</li>
            <li>+50 per law established</li>
          </ul>
        </motion.div>
      )}
    </div>
  )
}
