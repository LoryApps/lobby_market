'use client'

import { useEffect } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useThesisWatchStore } from '@/lib/stores/thesis-watch-store'
import { cn } from '@/lib/utils/cn'

interface ThesisWatchButtonProps {
  thesisId: string
  size?: 'sm' | 'md'
  className?: string
}

export function ThesisWatchButton({ thesisId, size = 'md', className }: ThesisWatchButtonProps) {
  const { load, toggle, isWatching } = useThesisWatchStore()
  const watching = isWatching(thesisId)

  useEffect(() => {
    load()
  }, [load])

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await toggle(thesisId)
  }

  const isSmall = size === 'sm'

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={watching ? 'Stop watching this thesis' : 'Watch this thesis'}
      aria-pressed={watching}
      title={
        watching
          ? 'Remove from watchlist'
          : 'Watch this thesis — track it in your watchlist'
      }
      className={cn(
        'flex items-center gap-1.5 rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        isSmall ? 'h-8 px-2.5' : 'h-10 px-3',
        watching
          ? 'bg-gold/15 text-gold hover:bg-against-600/20 hover:text-against-300'
          : 'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-gold',
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={watching ? 'on' : 'off'}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.7, opacity: 0 }}
          transition={{ duration: 0.13 }}
          className="flex items-center gap-1.5"
        >
          {watching ? (
            <>
              <Bell className={isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span className={cn('font-mono font-semibold', isSmall ? 'text-[11px]' : 'text-xs')}>
                Watching
              </span>
            </>
          ) : (
            <>
              <BellOff className={isSmall ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span className={cn('font-mono font-semibold', isSmall ? 'text-[11px]' : 'text-xs')}>
                Watch
              </span>
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
