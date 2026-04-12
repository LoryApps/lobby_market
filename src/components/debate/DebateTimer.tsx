'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { DebatePhase } from '@/lib/supabase/types'

interface DebateTimerProps {
  phase: DebatePhase
  phaseEndsAt: string | null
}

const PHASE_LABELS: Record<DebatePhase, string> = {
  opening: 'Opening Statements',
  cross_exam: 'Cross-Examination',
  closing: 'Closing Arguments',
  audience_qa: 'Audience Q&A',
  ended: 'Debate Ended',
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function DebateTimer({ phase, phaseEndsAt }: DebateTimerProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const remainingMs = phaseEndsAt
    ? Math.max(0, new Date(phaseEndsAt).getTime() - now)
    : 0
  const isUrgent = remainingMs > 0 && remainingMs < 30 * 1000
  const isEnded = phase === 'ended'

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'px-4 py-2 rounded-xl',
        'bg-black/50 backdrop-blur-md border border-surface-300',
        isUrgent && 'border-against-500/60 animate-pulse-urgent'
      )}
    >
      <div className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
        {PHASE_LABELS[phase]}
      </div>
      {!isEnded && phaseEndsAt && (
        <div
          className={cn(
            'font-mono text-2xl font-bold tabular-nums',
            isUrgent ? 'text-against-400' : 'text-white'
          )}
        >
          {formatDuration(remainingMs)}
        </div>
      )}
      {isEnded && (
        <div className="font-mono text-sm font-bold text-surface-500 uppercase tracking-wider">
          Ended
        </div>
      )}
    </div>
  )
}
