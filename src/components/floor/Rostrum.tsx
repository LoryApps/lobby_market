'use client'

import { useEffect, useState } from 'react'
import type { Topic } from '@/lib/supabase/types'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'

interface RostrumProps {
  topic: Topic
  className?: string
}

function formatTimeLeft(endsAt: string | null): string | null {
  if (!endsAt) return null
  const end = new Date(endsAt).getTime()
  const now = Date.now()
  const diff = end - now
  if (diff <= 0) return 'ended'
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  if (hours > 24) return `${Math.floor(hours / 24)}d left`
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

export function Rostrum({ topic, className }: RostrumProps) {
  const [timeLeft, setTimeLeft] = useState<string | null>(
    formatTimeLeft(topic.voting_ends_at)
  )

  useEffect(() => {
    if (!topic.voting_ends_at) return
    const id = setInterval(() => {
      setTimeLeft(formatTimeLeft(topic.voting_ends_at))
    }, 15000)
    return () => clearInterval(id)
  }, [topic.voting_ends_at])

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-1/2 top-[6%] -translate-x-1/2',
        'flex flex-col items-center text-center px-6 max-w-3xl w-full',
        className
      )}
    >
      {/* Tiny eyebrow label */}
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-surface-500 mb-3">
        The Floor · {topic.category ?? 'General'}
      </div>

      {/* Statement — the centerpiece */}
      <h1
        className="text-2xl md:text-4xl font-bold text-white leading-tight"
        style={{
          textShadow:
            '0 0 24px rgba(255,255,255,0.25), 0 0 48px rgba(59, 130, 246, 0.25)',
        }}
      >
        {topic.statement}
      </h1>

      {/* Meta strip */}
      <div className="mt-4 flex items-center gap-4 text-xs font-mono text-surface-500">
        <span>
          <AnimatedNumber
            value={topic.total_votes}
            className="text-white font-semibold"
          />{' '}
          votes cast
        </span>
        <span className="h-3 w-px bg-surface-400/50" />
        <span className="text-for-400">
          {Math.round(topic.blue_pct)}% agree
        </span>
        <span className="h-3 w-px bg-surface-400/50" />
        <span className="text-against-400">
          {Math.round(100 - topic.blue_pct)}% disagree
        </span>
        {timeLeft && (
          <>
            <span className="h-3 w-px bg-surface-400/50" />
            <span className="text-gold">{timeLeft}</span>
          </>
        )}
      </div>
    </div>
  )
}
