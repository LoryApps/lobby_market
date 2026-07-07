'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const DISMISS_KEY_PREFIX = 'lm_daily_prompt_dismissed_'

function todayKey(): string {
  const d = new Date()
  return `${DISMISS_KEY_PREFIX}${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(todayKey()) === '1'
  } catch {
    return false
  }
}

function saveDismiss() {
  try {
    localStorage.setItem(todayKey(), '1')
  } catch {
    // best-effort
  }
}

interface DailyPromptTopic {
  id: string
  statement: string
  blue_pct: number
  total_votes: number
}

interface DailyPromptData {
  topic: DailyPromptTopic
  date: string
}

export function DailyPromptBanner() {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<DailyPromptData | null>(null)

  useEffect(() => {
    if (isDismissed()) return

    let cancelled = false
    fetch('/api/topics/daily-prompt')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.topic) return
        setData(json as DailyPromptData)
        setVisible(true)
      })
      .catch(() => {/* silent */})

    return () => { cancelled = true }
  }, [])

  function handleDismiss(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    saveDismiss()
    setVisible(false)
  }

  if (!data) return null

  const forPct = Math.round(data.topic.blue_pct)
  const againstPct = 100 - forPct
  const voteLabel =
    data.topic.total_votes >= 1000
      ? `${(data.topic.total_votes / 1000).toFixed(1)}k`
      : `${data.topic.total_votes}`

  const dateLabel = new Date(data.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

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
              'relative rounded-2xl px-4 py-3',
              'bg-gold/5 border border-gold/20',
              'hover:border-gold/35 transition-colors'
            )}
          >
            {/* Header row */}
            <div className="flex items-center gap-2 mb-2 pr-6">
              <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-gold/15 border border-gold/25 flex-shrink-0">
                <Sparkles className="h-3 w-3 text-gold" aria-hidden="true" />
              </div>
              <p className="text-xs font-mono font-semibold text-gold leading-none">
                Today&apos;s Debate
              </p>
              <span className="text-xs text-surface-600 leading-none">·</span>
              <span className="text-xs text-surface-600 leading-none">{dateLabel}</span>
            </div>

            {/* Topic statement */}
            <p className="text-sm font-mono font-medium text-white leading-snug mb-3 line-clamp-2">
              {data.topic.statement}
            </p>

            {/* Vote split bar + CTA */}
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {/* Split bar */}
                <div className="flex h-1.5 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="bg-for-500 transition-all"
                    style={{ width: `${forPct}%` }}
                  />
                  <div
                    className="bg-against-500 transition-all"
                    style={{ width: `${againstPct}%` }}
                  />
                </div>
                {/* Labels */}
                <div className="flex justify-between">
                  <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
                  <span className="text-[10px] font-mono text-surface-600">{voteLabel} votes</span>
                  <span className="text-[10px] font-mono text-against-400">{againstPct}% AGAINST</span>
                </div>
              </div>

              <Link
                href={`/topic/${data.topic.id}`}
                onClick={saveDismiss}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg',
                  'bg-gold/80 hover:bg-gold text-surface-50',
                  'text-xs font-mono font-semibold transition-colors'
                )}
                aria-label="Weigh in on today&apos;s debate"
              >
                Weigh in
              </Link>
            </div>

            {/* Dismiss button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-2 right-2 flex items-center justify-center h-5 w-5 rounded text-surface-600 hover:text-white transition-colors"
              aria-label="Dismiss today's debate banner"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
