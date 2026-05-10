'use client'

/**
 * CivicAlertBanner
 *
 * A slim, dismissible alert strip shown just below the trending ticker on
 * the main feed. Surfaces the single most urgent civic moment right now:
 *
 *   • law_just_passed  — a law was established in the last 2 hours
 *   • debate_soon      — a debate starts within 45 minutes
 *   • final_voting     — a topic's vote closes in < 6 hours
 *   • near_consensus   — a topic has >= 78 % agreement with 30+ votes
 *
 * The banner is hidden after the user dismisses it (stored in localStorage
 * so the same event never resurfaces in the same session). It auto-refreshes
 * every 5 minutes so it always shows the most relevant alert.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Gavel, Mic, Clock, TrendingUp, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { FeedAlert, AlertKind } from '@/app/api/feed/alert/route'

// ─── Alert kind config ────────────────────────────────────────────────────

const KIND_CONFIG: Record<
  AlertKind,
  {
    Icon: typeof Gavel
    accent: string
    bg: string
    border: string
    badge: string
    badgeText: string
  }
> = {
  law_just_passed: {
    Icon: Gavel,
    accent: 'text-gold',
    bg: 'bg-gold/8',
    border: 'border-gold/30',
    badge: 'bg-gold/20 border-gold/40 text-gold',
    badgeText: 'LAW PASSED',
  },
  debate_soon: {
    Icon: Mic,
    accent: 'text-purple',
    bg: 'bg-purple/8',
    border: 'border-purple/30',
    badge: 'bg-purple/20 border-purple/40 text-purple',
    badgeText: 'DEBATE',
  },
  final_voting: {
    Icon: Clock,
    accent: 'text-against-400',
    bg: 'bg-against-500/8',
    border: 'border-against-500/30',
    badge: 'bg-against-500/20 border-against-500/40 text-against-400',
    badgeText: 'FINAL VOTE',
  },
  near_consensus: {
    Icon: TrendingUp,
    accent: 'text-for-400',
    bg: 'bg-for-500/8',
    border: 'border-for-500/30',
    badge: 'bg-for-500/20 border-for-500/40 text-for-400',
    badgeText: 'TRENDING',
  },
  surge: {
    Icon: TrendingUp,
    accent: 'text-emerald',
    bg: 'bg-emerald/8',
    border: 'border-emerald/30',
    badge: 'bg-emerald/20 border-emerald/40 text-emerald',
    badgeText: 'SURGE',
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 5 * 60 * 1000 // 5 min

function isDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markDismissed(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {}
}

export function CivicAlertBanner() {
  const [alert, setAlert] = useState<FeedAlert | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAlert = useCallback(async () => {
    try {
      const res = await fetch('/api/feed/alert', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { alert: FeedAlert | null }
      if (!data.alert) {
        setAlert(null)
        return
      }
      // Check if user already dismissed this exact alert
      if (isDismissed(data.alert.dismissKey)) {
        setAlert(null)
        return
      }
      setAlert(data.alert)
      setDismissed(false)
    } catch {
      // Non-critical — silent fail
    }
  }, [])

  useEffect(() => {
    fetchAlert()
    timerRef.current = setInterval(fetchAlert, REFRESH_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchAlert])

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (alert) markDismissed(alert.dismissKey)
      setDismissed(true)
    },
    [alert]
  )

  const visible = !!alert && !dismissed

  const cfg = alert ? KIND_CONFIG[alert.kind] : null

  return (
    <AnimatePresence initial={false}>
      {visible && alert && cfg && (
        <motion.div
          key={alert.dismissKey}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
          className="overflow-hidden flex-shrink-0"
        >
          <Link
            href={alert.href}
            className={cn(
              'flex items-center gap-3 px-4 py-2.5 border-b',
              'transition-opacity hover:opacity-90',
              cfg.bg,
              cfg.border,
            )}
            aria-label={`${alert.headline}: ${alert.subline}`}
          >
            {/* Icon */}
            <cfg.Icon
              className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.accent)}
              aria-hidden="true"
            />

            {/* Badge */}
            <span
              className={cn(
                'hidden sm:inline-flex flex-shrink-0',
                'items-center px-2 py-0.5 rounded border',
                'text-[9px] font-mono font-bold tracking-widest uppercase leading-none',
                cfg.badge,
              )}
            >
              {cfg.badgeText}
            </span>

            {/* Text */}
            <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden">
              <span
                className={cn('text-xs font-mono font-semibold flex-shrink-0', cfg.accent)}
              >
                {alert.headline}
              </span>
              <span className="text-[11px] text-surface-500 truncate hidden sm:block">
                {alert.subline}
              </span>
            </div>

            {/* Arrow */}
            <ArrowRight
              className="h-3.5 w-3.5 flex-shrink-0 text-surface-500"
              aria-hidden="true"
            />

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className={cn(
                'flex-shrink-0 p-1 rounded-md -mr-1',
                'text-surface-500 hover:text-white hover:bg-surface-300/50',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40',
              )}
              aria-label="Dismiss alert"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
