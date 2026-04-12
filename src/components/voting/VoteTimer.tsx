'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'

interface VoteTimerProps {
  endsAt: string
  className?: string
}

function getTimeRemaining(endsAt: string) {
  const now = Date.now()
  const end = new Date(endsAt).getTime()
  const diff = end - now

  if (diff <= 0) return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  return { expired: false, days, hours, minutes, seconds, totalMs: diff }
}

function formatTime(t: ReturnType<typeof getTimeRemaining>): string {
  if (t.expired) return 'VOTING ENDED'

  const totalHours = t.days * 24 + t.hours

  // Under 1 hour: mm:ss format
  if (totalHours < 1) {
    return `${String(t.minutes).padStart(2, '0')}:${String(t.seconds).padStart(2, '0')}`
  }

  // Under 24 hours: Xh Xm
  if (t.days < 1) {
    return `${t.hours}h ${t.minutes}m left`
  }

  // Over 24 hours: Xd Xh
  return `${t.days}d ${t.hours}h left`
}

export function VoteTimer({ endsAt, className }: VoteTimerProps) {
  const [time, setTime] = useState(() => getTimeRemaining(endsAt))

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeRemaining(endsAt))
    }, 1000)

    return () => clearInterval(interval)
  }, [endsAt])

  const totalHours = time.days * 24 + time.hours

  // Visual state
  const isCalm = !time.expired && totalHours >= 24
  const isAmber = !time.expired && totalHours >= 1 && totalHours < 24
  const isUrgent = !time.expired && totalHours < 1

  return (
    <span
      className={cn(
        'inline-flex items-center text-sm font-mono font-medium tabular-nums',
        isCalm && 'text-white',
        isAmber && 'text-yellow-400 animate-pulse-urgent',
        isUrgent && 'text-against-400 animate-pulse-critical',
        time.expired && 'text-surface-500',
        className
      )}
    >
      {formatTime(time)}
    </span>
  )
}
