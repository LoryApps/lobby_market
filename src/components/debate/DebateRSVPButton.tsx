'use client'

/**
 * DebateRSVPButton
 *
 * Shown on scheduled debates.  Lets authenticated users toggle their
 * attendance intent.  Displays an attendee count alongside the button.
 *
 * Props
 * ─────
 * debateId        – debate UUID
 * initialCount    – pre-fetched count (optional, avoids waterfall)
 * initialHasRsvp  – pre-fetched flag  (optional)
 * size            – 'sm' (default) | 'md'
 * className       – extra Tailwind classes
 */

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, CalendarPlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Props {
  debateId: string
  initialCount?: number
  initialHasRsvp?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function DebateRSVPButton({
  debateId,
  initialCount = 0,
  initialHasRsvp = false,
  size = 'sm',
  className,
}: Props) {
  const [count, setCount] = useState(initialCount)
  const [hasRsvp, setHasRsvp] = useState(initialHasRsvp)
  const [loading, setLoading] = useState(initialCount === 0 && !initialHasRsvp)
  const [toggling, setToggling] = useState(false)

  // Fetch on mount when no initial data provided
  useEffect(() => {
    if (initialCount > 0 || initialHasRsvp) {
      setLoading(false)
      return
    }
    let cancelled = false
    fetch(`/api/debates/${debateId}/rsvp`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setCount(d.count ?? 0)
        setHasRsvp(d.hasRsvp ?? false)
      })
      .catch(() => {
        // Best-effort — keep defaults
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debateId, initialCount, initialHasRsvp])

  const toggle = useCallback(async () => {
    if (toggling) return
    setToggling(true)

    // Optimistic update
    const prevCount = count
    const prevHasRsvp = hasRsvp
    setCount((c) => (hasRsvp ? Math.max(0, c - 1) : c + 1))
    setHasRsvp((v) => !v)

    try {
      const res = await fetch(`/api/debates/${debateId}/rsvp`, {
        method: 'POST',
      })
      if (res.status === 401) {
        // Not logged in — revert and redirect
        setCount(prevCount)
        setHasRsvp(prevHasRsvp)
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCount(data.count ?? 0)
      setHasRsvp(data.hasRsvp ?? false)
    } catch {
      // Revert on error
      setCount(prevCount)
      setHasRsvp(prevHasRsvp)
    } finally {
      setToggling(false)
    }
  }, [debateId, toggling, count, hasRsvp])

  const isSm = size === 'sm'

  return (
    <button
      onClick={(e) => {
        e.preventDefault() // prevent Link bubbling on card
        toggle()
      }}
      disabled={loading || toggling}
      aria-label={hasRsvp ? 'Cancel attendance' : 'RSVP to this debate'}
      aria-pressed={hasRsvp}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-lg border font-mono font-medium transition-all duration-150',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        isSm ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs',
        hasRsvp
          ? 'bg-for-600/20 border-for-500/50 text-for-300 hover:bg-against-500/20 hover:border-against-500/50 hover:text-against-300'
          : 'bg-surface-200/70 border-surface-400/50 text-surface-500 hover:bg-for-600/20 hover:border-for-500/50 hover:text-for-300',
        className
      )}
    >
      {loading || toggling ? (
        <Loader2 className={cn('animate-spin', isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      ) : hasRsvp ? (
        <CalendarCheck className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      ) : (
        <CalendarPlus className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      )}

      <span>
        {hasRsvp ? 'Attending' : 'Attend'}
      </span>

      {!loading && count > 0 && (
        <span
          className={cn(
            'rounded-full px-1 tabular-nums',
            isSm ? 'text-[10px]' : 'text-[11px]',
            hasRsvp
              ? 'bg-for-500/30 text-for-200'
              : 'bg-surface-400/40 text-surface-500'
          )}
        >
          {count.toLocaleString()}
        </span>
      )}
    </button>
  )
}
