'use client'

import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'

interface SpectatorCountProps {
  className?: string
}

export function SpectatorCount({ className }: SpectatorCountProps) {
  const [count, setCount] = useState(1)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('floor-presence', {
      config: {
        presence: {
          key: `anon-${Math.random().toString(36).slice(2, 10)}`,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const unique = new Set(Object.keys(state))
        setCount(Math.max(1, unique.size))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ timestamp: Date.now() })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [])

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-surface-100/60 backdrop-blur border border-surface-300/50',
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald" />
      </span>
      <Eye className="h-3.5 w-3.5 text-surface-500" />
      <span className="text-xs font-mono text-white">
        <AnimatedNumber value={count} /> watching
      </span>
    </div>
  )
}
