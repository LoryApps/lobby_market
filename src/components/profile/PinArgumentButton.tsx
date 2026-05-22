'use client'

import { useState } from 'react'
import { Pin, PinOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface PinArgumentButtonProps {
  argumentId: string
  initiallyPinned: boolean
  /** True when the user already has 3 pins and this arg is not one of them */
  atLimit: boolean
  className?: string
}

export function PinArgumentButton({
  argumentId,
  initiallyPinned,
  atLimit,
  className,
}: PinArgumentButtonProps) {
  const [pinned, setPinned] = useState(initiallyPinned)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDisabled = busy || (atLimit && !pinned)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isDisabled) return

    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/profile/pinned-arguments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argument_id: argumentId,
          action: pinned ? 'unpin' : 'pin',
        }),
      })

      if (res.ok) {
        setPinned((p) => !p)
      } else {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Failed')
        // Clear error after 2s
        setTimeout(() => setError(null), 2000)
      }
    } catch {
      setError('Network error')
      setTimeout(() => setError(null), 2000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex items-center', className)}>
      <button
        onClick={toggle}
        disabled={isDisabled}
        title={
          isDisabled && atLimit && !pinned
            ? 'Spotlight full (3/3) — unpin another to add this one'
            : pinned
              ? 'Remove from Spotlight'
              : 'Pin to Spotlight'
        }
        aria-label={pinned ? 'Remove from Spotlight' : 'Add to Spotlight'}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-semibold border transition-all',
          pinned
            ? 'bg-gold/15 border-gold/40 text-gold hover:bg-gold/25 hover:border-gold/60'
            : atLimit
              ? 'bg-surface-200/60 border-surface-400/20 text-surface-600 cursor-not-allowed opacity-50'
              : 'bg-surface-200/60 border-surface-400/30 text-surface-500 hover:bg-surface-300/60 hover:border-surface-400 hover:text-surface-300',
          'disabled:pointer-events-none',
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : pinned ? (
          <PinOff className="h-3 w-3" aria-hidden />
        ) : (
          <Pin className="h-3 w-3" aria-hidden />
        )}
        {pinned ? 'Pinned' : 'Pin'}
      </button>

      {error && (
        <span className="ml-2 text-[10px] font-mono text-against-400 animate-pulse">
          {error}
        </span>
      )}
    </div>
  )
}
