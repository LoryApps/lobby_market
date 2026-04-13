'use client'

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Award, CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { ToastContext, type Toast, type ToastContextValue } from '@/lib/hooks/useToast'
import { cn } from '@/lib/utils/cn'

// ─── Tier config ──────────────────────────────────────────────────────────────

const tierConfig = {
  common: {
    label: 'COMMON',
    border: 'border-surface-400',
    badge: 'bg-surface-400/20 text-surface-400',
    glow: '',
  },
  rare: {
    label: 'RARE',
    border: 'border-for-500',
    badge: 'bg-for-500/20 text-for-400',
    glow: 'shadow-for-900/40',
  },
  epic: {
    label: 'EPIC',
    border: 'border-purple',
    badge: 'bg-purple/20 text-purple',
    glow: 'shadow-purple/20',
  },
  legendary: {
    label: 'LEGENDARY',
    border: 'border-gold',
    badge: 'bg-gold/20 text-gold',
    glow: 'shadow-gold/30',
  },
}

// ─── Single Toast Item ────────────────────────────────────────────────────────

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast
  onRemove: (id: string) => void
}) {
  const duration = toast.duration ?? 5000
  const progressRef = useRef<HTMLDivElement>(null)

  // Animate progress bar
  useEffect(() => {
    const el = progressRef.current
    if (!el) return
    el.style.transition = `width ${duration}ms linear`
    // force reflow then start animation
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetWidth
    el.style.width = '0%'
  }, [duration])

  if (toast.variant === 'achievement') {
    const tier = toast.tier ?? 'common'
    const cfg = tierConfig[tier]
    return (
      <motion.div
        layout
        initial={{ opacity: 0, x: 80, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 80, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className={cn(
          'relative w-80 rounded-2xl border bg-surface-100 overflow-hidden',
          cfg.border,
          cfg.glow && `shadow-lg ${cfg.glow}`
        )}
      >
        {/* Shimmer line at top */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-px',
            tier === 'legendary'
              ? 'bg-gradient-to-r from-transparent via-gold to-transparent'
              : tier === 'epic'
              ? 'bg-gradient-to-r from-transparent via-purple to-transparent'
              : tier === 'rare'
              ? 'bg-gradient-to-r from-transparent via-for-400 to-transparent'
              : 'bg-transparent'
          )}
        />

        <div className="p-4 pr-10">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0',
                tier === 'legendary'
                  ? 'bg-gold/20'
                  : tier === 'epic'
                  ? 'bg-purple/20'
                  : tier === 'rare'
                  ? 'bg-for-500/20'
                  : 'bg-surface-300'
              )}
            >
              <Award
                className={cn(
                  'h-3.5 w-3.5',
                  tier === 'legendary'
                    ? 'text-gold'
                    : tier === 'epic'
                    ? 'text-purple'
                    : tier === 'rare'
                    ? 'text-for-400'
                    : 'text-surface-500'
                )}
              />
            </div>
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
              Achievement Unlocked
            </span>
            <span
              className={cn(
                'ml-auto text-[9px] font-mono font-bold px-1.5 py-0.5 rounded',
                cfg.badge
              )}
            >
              {cfg.label}
            </span>
          </div>

          {/* Icon + content */}
          <div className="flex items-start gap-3">
            {toast.icon && (
              <span
                className="text-2xl leading-none flex-shrink-0 mt-0.5"
                role="img"
                aria-hidden="true"
              >
                {toast.icon}
              </span>
            )}
            <div>
              <p className="text-sm font-semibold text-white leading-snug">
                {toast.title}
              </p>
              {toast.body && (
                <p className="text-xs text-surface-500 mt-0.5 leading-snug">
                  {toast.body}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => onRemove(toast.id)}
          className="absolute top-3 right-3 flex items-center justify-center h-5 w-5 rounded-md text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3 w-3" />
        </button>

        {/* Progress bar */}
        <div className="h-0.5 bg-surface-300">
          <div
            ref={progressRef}
            className={cn(
              'h-full',
              tier === 'legendary'
                ? 'bg-gold'
                : tier === 'epic'
                ? 'bg-purple'
                : tier === 'rare'
                ? 'bg-for-500'
                : 'bg-surface-400'
            )}
            style={{ width: '100%' }}
          />
        </div>
      </motion.div>
    )
  }

  // Generic variant
  const genericConfig = {
    success: {
      Icon: CheckCircle2,
      iconClass: 'text-emerald',
      border: 'border-emerald/30',
      bar: 'bg-emerald',
    },
    error: {
      Icon: AlertCircle,
      iconClass: 'text-against-400',
      border: 'border-against-500/30',
      bar: 'bg-against-500',
    },
    info: {
      Icon: Info,
      iconClass: 'text-for-400',
      border: 'border-for-500/30',
      bar: 'bg-for-500',
    },
  }[toast.variant as 'success' | 'error' | 'info'] ?? {
    Icon: Info,
    iconClass: 'text-for-400',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
  }

  const { Icon, iconClass, border, bar } = genericConfig

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={cn(
        'relative w-80 rounded-xl border bg-surface-100 overflow-hidden',
        border
      )}
    >
      <div className="p-4 pr-10 flex items-start gap-3">
        {/* Show emoji icon if provided, otherwise fall back to Lucide icon */}
        {toast.icon ? (
          <span
            className="text-xl leading-none flex-shrink-0 mt-0.5"
            role="img"
            aria-hidden="true"
          >
            {toast.icon}
          </span>
        ) : (
          <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', iconClass)} />
        )}
        <div>
          <p className="text-sm font-medium text-white">{toast.title}</p>
          {toast.body && (
            <p className="text-xs text-surface-500 mt-0.5">{toast.body}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="absolute top-3 right-3 flex items-center justify-center h-5 w-5 rounded-md text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="h-0.5 bg-surface-300">
        <div
          ref={progressRef}
          className={cn('h-full', bar)}
          style={{ width: '100%' }}
        />
      </div>
    </motion.div>
  )
}

// ─── Toast Stack ──────────────────────────────────────────────────────────────

function ToastStack({
  toasts,
  onRemove,
}: {
  toasts: Toast[]
  onRemove: (id: string) => void
}) {
  // Show newest on top (visually), max 4 visible
  const visible = toasts.slice(-4)

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-20 right-4 md:bottom-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-none"
    >
      <AnimatePresence mode="sync">
        {visible.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={onRemove} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Toast Provider ───────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      const newToast: Toast = { duration: 5000, ...toast, id }
      setToasts((prev) => [...prev, newToast])
      setTimeout(() => removeToast(id), newToast.duration ?? 5000)
    },
    [removeToast]
  )

  const value: ToastContextValue = { toasts, addToast, removeToast }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}
