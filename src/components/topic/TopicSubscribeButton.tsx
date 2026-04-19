'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'

interface TopicSubscribeButtonProps {
  topicId: string
  /** Size variant */
  size?: 'sm' | 'md'
  /** Show the follower count next to the icon */
  showCount?: boolean
  className?: string
}

export function TopicSubscribeButton({
  topicId,
  size = 'md',
  showCount = false,
  className,
}: TopicSubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics/${topicId}/subscribe`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setSubscribed(data.subscribed ?? false)
        setCount(data.count ?? 0)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [topicId])

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (pending) return
    setPending(true)

    const method = subscribed ? 'DELETE' : 'POST'
    try {
      const res = await fetch(`/api/topics/${topicId}/subscribe`, { method })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (res.ok) {
        const data = await res.json()
        setSubscribed(data.subscribed)
        setCount(data.count ?? 0)
      }
    } catch {
      // best-effort — no error shown to avoid disrupting the topic page
    } finally {
      setPending(false)
    }
  }

  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || pending}
      aria-label={subscribed ? 'Unfollow topic' : 'Follow topic'}
      aria-pressed={subscribed}
      title={subscribed ? 'Unfollow this debate' : 'Follow this debate — get notified on status changes'}
      className={cn(
        'flex items-center gap-1.5 rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isSmall ? 'h-8 px-2.5' : 'h-10 px-3',
        subscribed
          ? 'bg-for-600/20 text-for-300 hover:bg-against-600/20 hover:text-against-300'
          : 'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-for-300',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={subscribed ? 'on' : 'off'}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.13 }}
          className="flex items-center gap-1.5"
        >
          {subscribed ? (
            <Bell className={cn(isSmall ? 'h-4 w-4' : 'h-4.5 w-4.5', 'fill-for-400/30')} aria-hidden />
          ) : (
            <Bell className={cn(isSmall ? 'h-4 w-4' : 'h-4.5 w-4.5')} aria-hidden />
          )}
          {showCount && count > 0 && (
            <span className="text-xs font-mono tabular-nums">{count.toLocaleString()}</span>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
