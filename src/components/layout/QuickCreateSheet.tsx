'use client'

import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  FileText,
  Gavel,
  MessageSquarePlus,
  Mic,
  TrendingUp,
  Landmark,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { haptics } from '@/lib/hooks/useHaptics'

interface QuickAction {
  href: string
  label: string
  sublabel: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
}

const ACTIONS: QuickAction[] = [
  {
    href: '/topic/create',
    label: 'Propose a Topic',
    sublabel: 'Start a new civic debate',
    icon: FileText,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  {
    href: '/write',
    label: 'Write an Argument',
    sublabel: 'Craft a compelling civic argument',
    icon: MessageSquarePlus,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  {
    href: '/argue',
    label: 'Back Your Vote',
    sublabel: 'Argue topics you voted on',
    icon: Gavel,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  {
    href: '/debate/create',
    label: 'Schedule a Debate',
    sublabel: 'Set up a live debate session',
    icon: Mic,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  {
    href: '/predictions',
    label: 'Make a Prediction',
    sublabel: 'Bet clout on an outcome',
    icon: TrendingUp,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  {
    href: '/floor',
    label: 'Enter The Floor',
    sublabel: 'Watch live consensus forming',
    icon: Landmark,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
]

interface QuickCreateSheetProps {
  open: boolean
  onClose: () => void
}

export function QuickCreateSheet({ open, onClose }: QuickCreateSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    haptics.light()
    onClose()
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, handleClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Sheet */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Quick create"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className={cn(
              'fixed bottom-0 left-0 right-0 z-[61]',
              'bg-surface-100 border-t border-surface-300',
              'rounded-t-2xl',
              'pb-[calc(env(safe-area-inset-bottom)+4rem)]',
            )}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-surface-400" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
                  <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-mono font-bold text-white">Quick Create</p>
                  <p className="text-[11px] text-surface-500 font-mono">What do you want to do?</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close"
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-full',
                  'bg-surface-200 hover:bg-surface-300 transition-colors',
                  'text-surface-500 hover:text-white',
                )}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 space-y-2">
              {ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    onClick={() => {
                      haptics.medium()
                      handleClose()
                    }}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3.5 rounded-xl',
                      'bg-surface-200 border border-surface-300',
                      'hover:border-surface-400 active:scale-[0.98]',
                      'transition-all duration-150',
                      'group',
                    )}
                  >
                    <div className={cn(
                      'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0',
                      'border transition-colors',
                      action.bg,
                      action.border,
                    )}>
                      <Icon className={cn('h-5 w-5', action.color)} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white group-hover:text-for-300 transition-colors">
                        {action.label}
                      </p>
                      <p className="text-xs text-surface-500 truncate">
                        {action.sublabel}
                      </p>
                    </div>
                    <svg
                      className="h-4 w-4 text-surface-500 flex-shrink-0 group-hover:text-surface-400 group-hover:translate-x-0.5 transition-transform"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
