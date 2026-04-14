'use client'

/**
 * DailyQuorumNudge
 *
 * A lightweight, dismissible card injected into the feed (above the first
 * topic) that reminds users to complete today's Daily Quorum.
 *
 * Rules:
 *  - Shown once per calendar day (dismissed state stored per-day in localStorage).
 *  - On dismiss, vanishes with a slide-up animation.
 *  - No API call — just a quick visual reminder that links to /challenge.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Flame, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const NUDGE_KEY_PREFIX = 'lm_quorum_nudge_dismissed_'

function todayKey(): string {
  const d = new Date()
  return `${NUDGE_KEY_PREFIX}${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(todayKey()) === '1'
  } catch {
    return false
  }
}

function dismiss() {
  try {
    localStorage.setItem(todayKey(), '1')
  } catch {
    // best-effort
  }
}

export function DailyQuorumNudge() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isDismissed()) {
      setVisible(true)
    }
  }, [])

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    dismiss()
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="feed-card"
          style={{ padding: '0 1rem' }}
        >
          <div
            className={cn(
              'relative flex items-center gap-4 rounded-2xl px-4 py-3',
              'bg-for-600/10 border border-for-500/25',
              'hover:border-for-500/40 transition-colors'
            )}
          >
            <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-for-600/20 border border-for-500/30">
              <Flame className="h-4 w-4 text-for-400" aria-hidden="true" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white font-mono leading-tight mb-0.5">
                Daily Quorum available
              </p>
              <p className="text-xs text-surface-500 leading-tight">
                Vote on 3 curated topics and earn +10 Clout today.
              </p>
            </div>

            <Link
              href="/challenge"
              onClick={() => dismiss()}
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg',
                'bg-for-600 hover:bg-for-500 text-white',
                'text-xs font-mono font-semibold transition-colors'
              )}
              aria-label="Go to Daily Quorum"
            >
              Go
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>

            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-2 right-2 flex items-center justify-center h-5 w-5 rounded text-surface-600 hover:text-white transition-colors"
              aria-label="Dismiss Daily Quorum reminder"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
