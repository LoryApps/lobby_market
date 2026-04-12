'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface SupportButtonProps {
  topicId: string
  supportCount: number
  threshold?: number
  hasSupported: boolean
  onSupport?: () => void
  className?: string
}

export function SupportButton(props: SupportButtonProps) {
  const {
    supportCount,
    threshold = 500,
    hasSupported,
    onSupport,
    className,
  } = props
  const progress = Math.min(supportCount / threshold, 1)
  const circumference = 2 * Math.PI * 36 // radius = 36
  const strokeDashoffset = circumference * (1 - progress)

  // Color transitions from surface-400 (low) to gold (near threshold)
  const strokeColor =
    progress < 0.3
      ? '#3f3f4a' // surface-400
      : progress < 0.6
        ? '#71717a' // surface-500
        : progress < 0.85
          ? '#d4a30a' // darker gold
          : '#f59e0b' // gold

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Progress ring */}
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          {/* Background circle */}
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="#24242e"
            strokeWidth="4"
          />
          {/* Progress arc */}
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke={strokeColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-surface-700">
            {supportCount}
          </span>
          <span className="text-[10px] text-surface-500">/ {threshold}</span>
        </div>
      </div>

      {/* Support button */}
      <button
        onClick={onSupport}
        disabled={hasSupported}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
          hasSupported
            ? 'bg-surface-200 text-emerald cursor-default'
            : 'bg-gold/20 text-gold hover:bg-gold/30'
        )}
      >
        {hasSupported ? (
          <>
            <Check className="h-4 w-4" />
            Supported
          </>
        ) : (
          'Support'
        )}
      </button>
    </div>
  )
}
