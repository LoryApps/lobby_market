'use client'

import { useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBookmarkStore } from '@/lib/stores/bookmark-store'
import { cn } from '@/lib/utils/cn'

interface BookmarkButtonProps {
  topicId: string
  /** Size variant */
  size?: 'sm' | 'md'
  /** Override className on the button element */
  className?: string
  /** Called after a successful toggle — receives new state */
  onToggle?: (bookmarked: boolean) => void
}

export function BookmarkButton({
  topicId,
  size = 'md',
  className,
  onToggle,
}: BookmarkButtonProps) {
  const { load, toggle, isBookmarked } = useBookmarkStore()
  const bookmarked = isBookmarked(topicId)

  // Seed the store once on first render
  useEffect(() => {
    load()
  }, [load])

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await toggle(topicId)
    onToggle?.(useBookmarkStore.getState().isBookmarked(topicId))
  }

  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={bookmarked ? 'Remove bookmark' : 'Save topic'}
      aria-pressed={bookmarked}
      title={bookmarked ? 'Remove from saved' : 'Save topic'}
      className={cn(
        'flex items-center justify-center rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        isSmall
          ? 'h-8 w-8'
          : 'h-10 w-10',
        bookmarked
          ? 'bg-gold/15 text-gold hover:bg-gold/25'
          : 'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-gold',
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={bookmarked ? 'saved' : 'unsaved'}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex items-center justify-center"
        >
          <Bookmark
            className={cn(
              isSmall ? 'h-4 w-4' : 'h-5 w-5',
              bookmarked && 'fill-gold'
            )}
            aria-hidden="true"
          />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
