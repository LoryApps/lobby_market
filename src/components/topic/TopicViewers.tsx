'use client'

/**
 * TopicViewers
 *
 * Uses Supabase Realtime Presence to count how many browser sessions are
 * currently viewing this topic page.  The count is shown as a subtle
 * "N viewing now" badge with an animated green dot — only visible when two
 * or more sessions are active (we don't announce that *you* are watching).
 *
 * One Presence channel per topic: `topic-viewers:<topicId>`.
 * Each session tracks a random key so collisions across the same account
 * on multiple tabs are counted correctly.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

interface TopicViewersProps {
  topicId: string
  className?: string
}

export function TopicViewers({ topicId, className }: TopicViewersProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    const sessionKey = `v-${Math.random().toString(36).slice(2, 10)}`

    const channel = supabase.channel(`topic-viewers:${topicId}`, {
      config: {
        presence: { key: sessionKey },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState()
        setCount(Object.keys(state).length)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.track({ topicId, at: Date.now() })
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [topicId])

  // Don't show anything when only the current user is here
  const visible = count > 1

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
            'bg-emerald/10 border border-emerald/20',
            className
          )}
          aria-live="polite"
          aria-label={`${count} people viewing this topic now`}
        >
          {/* Pulsing dot */}
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald" />
          </span>
          <span className="text-[10px] font-mono font-semibold text-emerald tabular-nums">
            {count} viewing
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
