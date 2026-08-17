'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { DailyPromptResponse } from '@/app/api/topics/daily-prompt/route'

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

export function DailyPromptBanner() {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<DailyPromptResponse | null>(null)

  useEffect(() => {
    if (isDismissed()) return

    let cancelled = false
    fetch('/api/topics/daily-prompt')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.topic) return
        setData(json as DailyPromptResponse)
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

  const { topic, date, user_vote } = data
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const voteLabel =
    topic.total_votes >= 1000
      ? `${(topic.total_votes / 1000).toFixed(1)}k`
      : `${topic.total_votes}`

  const dateLabel = new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })

  const hasVoted = user_vote !== null
  const forArg = topic.top_for_argument
  const againstArg = topic.top_against_argument
  const showArgs = forArg || againstArg

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
            <div className="flex items-center gap-2 mb-2 pr-6 flex-wrap">
              <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-gold/15 border border-gold/25 flex-shrink-0">
                <Sparkles className="h-3 w-3 text-gold" aria-hidden="true" />
              </div>
              <p className="text-xs font-mono font-semibold text-gold leading-none">
                Today&apos;s Debate
              </p>
              <span className="text-xs text-surface-600 leading-none">·</span>
              <span className="text-xs text-surface-600 leading-none">{dateLabel}</span>
              {topic.category && (
                <>
                  <span className="text-xs text-surface-600 leading-none">·</span>
                  <span className="text-xs text-surface-500 leading-none capitalize">{topic.category}</span>
                </>
              )}
              {hasVoted && (
                <span
                  className={cn(
                    'ml-auto flex items-center gap-1 text-[10px] font-mono font-semibold leading-none px-1.5 py-0.5 rounded',
                    user_vote === 'blue'
                      ? 'text-for-400 bg-for-950/60 border border-for-800/40'
                      : 'text-against-400 bg-against-950/60 border border-against-800/40'
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {user_vote === 'blue' ? 'Voted FOR' : 'Voted AGAINST'}
                </span>
              )}
            </div>

            {/* Topic statement */}
            <p className="text-sm font-mono font-medium text-white leading-snug mb-3 line-clamp-2 pr-2">
              {topic.statement}
            </p>

            {/* Top arguments */}
            {showArgs && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* FOR argument */}
                {forArg ? (
                  <div
                    className={cn(
                      'rounded-xl p-2.5 border transition-colors',
                      'bg-for-950/40 border-for-800/30',
                      user_vote === 'blue' && 'border-for-600/50 bg-for-950/60'
                    )}
                  >
                    <div className="flex items-center gap-1 mb-1.5">
                      <ThumbsUp className="h-2.5 w-2.5 text-for-400 flex-shrink-0" aria-hidden="true" />
                      <span className="text-[9px] font-mono font-bold text-for-400 uppercase tracking-wide">
                        For
                      </span>
                      {forArg.upvotes > 0 && (
                        <span className="ml-auto text-[9px] font-mono text-surface-600">
                          +{forArg.upvotes}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-surface-300 leading-relaxed line-clamp-3">
                      {forArg.content}
                    </p>
                    <p className="text-[9px] font-mono text-surface-600 mt-1 truncate">
                      @{forArg.author_username}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl p-2.5 border border-for-800/20 bg-for-950/20 flex items-center justify-center min-h-[64px]">
                    <p className="text-[10px] font-mono text-surface-600 text-center leading-snug">
                      Be first to argue FOR
                    </p>
                  </div>
                )}

                {/* AGAINST argument */}
                {againstArg ? (
                  <div
                    className={cn(
                      'rounded-xl p-2.5 border transition-colors',
                      'bg-against-950/40 border-against-800/30',
                      user_vote === 'red' && 'border-against-600/50 bg-against-950/60'
                    )}
                  >
                    <div className="flex items-center gap-1 mb-1.5">
                      <ThumbsDown className="h-2.5 w-2.5 text-against-400 flex-shrink-0" aria-hidden="true" />
                      <span className="text-[9px] font-mono font-bold text-against-400 uppercase tracking-wide">
                        Against
                      </span>
                      {againstArg.upvotes > 0 && (
                        <span className="ml-auto text-[9px] font-mono text-surface-600">
                          +{againstArg.upvotes}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-surface-300 leading-relaxed line-clamp-3">
                      {againstArg.content}
                    </p>
                    <p className="text-[9px] font-mono text-surface-600 mt-1 truncate">
                      @{againstArg.author_username}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl p-2.5 border border-against-800/20 bg-against-950/20 flex items-center justify-center min-h-[64px]">
                    <p className="text-[10px] font-mono text-surface-600 text-center leading-snug">
                      Be first to argue AGAINST
                    </p>
                  </div>
                )}
              </div>
            )}

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
                href={`/topic/${topic.id}`}
                onClick={saveDismiss}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg',
                  'bg-gold/80 hover:bg-gold text-surface-50',
                  'text-xs font-mono font-semibold transition-colors'
                )}
                aria-label={hasVoted ? "View today's debate" : "Weigh in on today's debate"}
              >
                {hasVoted ? 'View debate' : 'Weigh in'}
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
