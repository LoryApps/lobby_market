'use client'

/**
 * BottomSheet
 *
 * Generic slide-up modal sheet for mobile.
 *
 * - Framer Motion spring animation in/out from the bottom
 * - Semi-transparent backdrop with blur
 * - Drag-to-dismiss: pull the handle downward > 60 px to close
 * - Closes on Escape keypress and backdrop click
 * - Portal rendered into document.body (via createPortal)
 * - Safe-area padding for iPhone home-indicator
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  /** Sheet title shown in the drag-handle row */
  title?: string
  /** Max height as a Tailwind class or inline style — defaults to 80dvh */
  maxHeight?: string
  children: React.ReactNode
  className?: string
}

export function BottomSheet({
  open,
  onClose,
  title,
  maxHeight = '80dvh',
  children,
  className,
}: BottomSheetProps) {
  const dragControls = useDragControls()
  const y = useMotionValue(0)
  // Dim the backdrop slightly as the user drags down
  const backdropOpacity = useTransform(y, [0, 200], [1, 0])
  const panelRef = useRef<HTMLDivElement>(null)

  // Trap keyboard focus inside the sheet while it is open
  useFocusTrap(panelRef, open)

  // Keyboard: close on Escape
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, onClose])

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[1000] flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ opacity: backdropOpacity }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Sheet panel */}
          <motion.div
            ref={panelRef}
            key="panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32, mass: 0.9 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 400) {
                onClose()
              } else {
                // Snap back
                y.set(0)
              }
            }}
            className={cn(
              'relative z-10 w-full max-w-lg mx-auto',
              'rounded-t-2xl bg-surface-100 border-t border-x border-surface-300',
              'shadow-2xl shadow-black/60',
              'overflow-hidden',
              className
            )}
            style={{ maxHeight, y }}
          >
            {/* Drag handle row */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b border-surface-300 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              {/* Handle pill */}
              <div className="flex-1 flex justify-start">
                <div
                  className="h-1 w-10 rounded-full bg-surface-400"
                  aria-hidden="true"
                />
              </div>

              {title && (
                <span className="text-sm font-mono font-semibold text-white absolute left-1/2 -translate-x-1/2">
                  {title}
                </span>
              )}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex items-center justify-center h-7 w-7 rounded-full bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div
              className="overflow-y-auto pb-[env(safe-area-inset-bottom)]"
              style={{ maxHeight: `calc(${maxHeight} - 64px)` }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
