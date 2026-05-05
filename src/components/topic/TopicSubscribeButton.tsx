'use client'

import { useEffect } from 'react'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSubscriptionStore } from '@/lib/stores/subscription-store'
import { cn } from '@/lib/utils/cn'

interface TopicSubscribeButtonProps {
  topicId: string
  size?: 'sm' | 'md'
  showCount?: boolean
  className?: string
}

export function TopicSubscribeButton({
  topicId,
  size = 'md',
  showCount = false,
  className,
}: TopicSubscribeButtonProps) {
  const { load, toggle, isSubscribed } = useSubscriptionStore()
  const subscribed = isSubscribed(topicId)

  useEffect(() => {
    load()
  }, [load])

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await toggle(topicId)
  }

  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={subscribed ? 'Unfollow topic' : 'Follow topic'}
      aria-pressed={subscribed}
      title={subscribed ? 'Unfollow this debate' : 'Follow this debate — get notified on status changes'}
      className={cn(
        'flex items-center gap-1.5 rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/40',
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
            <Bell className={cn(isSmall ? 'h-4 w-4' : 'h-[18px] w-[18px]', 'fill-for-400/30')} aria-hidden />
          ) : (
            <Bell className={cn(isSmall ? 'h-4 w-4' : 'h-[18px] w-[18px]')} aria-hidden />
          )}
          {showCount && subscribed && (
            <span className="text-xs font-mono tabular-nums sr-only">Following</span>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
