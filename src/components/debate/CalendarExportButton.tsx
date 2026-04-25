'use client'

import { useState } from 'react'
import { CalendarPlus, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface CalendarExportButtonProps {
  debateId: string
  size?: 'sm' | 'md'
  className?: string
}

export function CalendarExportButton({
  debateId,
  size = 'md',
  className,
}: CalendarExportButtonProps) {
  const [state, setState] = useState<'idle' | 'downloading' | 'done'>('idle')

  async function handleClick() {
    if (state !== 'idle') return
    setState('downloading')

    try {
      const res = await fetch(`/api/debates/${debateId}/ics`)
      if (!res.ok) throw new Error('Failed to download')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `debate-${debateId}.ics`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setState('done')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('idle')
    }
  }

  const isSm = size === 'sm'

  return (
    <button
      onClick={handleClick}
      disabled={state === 'downloading'}
      aria-label={
        state === 'done'
          ? 'Added to calendar'
          : 'Add debate to calendar'
      }
      title={
        state === 'done'
          ? 'Calendar file downloaded'
          : 'Add to Calendar (.ics)'
      }
      className={cn(
        'inline-flex items-center gap-1.5 font-mono font-semibold transition-colors',
        'border rounded-lg',
        isSm
          ? 'text-[11px] px-2 py-1'
          : 'text-xs px-3 py-1.5',
        state === 'done'
          ? 'bg-emerald/10 border-emerald/30 text-emerald'
          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
        state === 'downloading' && 'opacity-60 cursor-wait',
        className
      )}
    >
      {state === 'downloading' ? (
        <Loader2 className={cn('animate-spin', isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      ) : state === 'done' ? (
        <Check className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      ) : (
        <CalendarPlus className={cn(isSm ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      )}
      {state === 'done' ? 'Saved' : 'Add to Calendar'}
    </button>
  )
}
