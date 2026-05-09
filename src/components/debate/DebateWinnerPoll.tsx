'use client'

/**
 * DebateWinnerPoll
 *
 * Post-debate "Who argued better?" community poll.
 * Distinct from the main topic vote (FOR/AGAINST the policy) — this asks
 * which side made the more compelling case in *this specific debate*.
 *
 * Users can vote once; results animate in after voting.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  ChevronRight,
  Loader2,
  Minus,
  ThumbsDown,
  ThumbsUp,
  Users,
  Vote,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { WinnerPollResult } from '@/app/api/debates/[id]/winner-poll/route'

interface DebateWinnerPollProps {
  debateId: string
  blueName: string | null
  redName: string | null
  className?: string
}

type PollOption = 'blue' | 'red' | 'tie'

const OPTIONS: { value: PollOption; icon: typeof ThumbsUp; label: string; forSide: string }[] = [
  { value: 'blue',  icon: ThumbsUp,   label: 'FOR side',     forSide: 'for' },
  { value: 'tie',   icon: Minus,      label: 'Tie',          forSide: 'tie' },
  { value: 'red',   icon: ThumbsDown, label: 'AGAINST side', forSide: 'against' },
]

const OPTION_STYLE: Record<PollOption, {
  bg: string; border: string; text: string; fill: string; selectedBg: string; selectedBorder: string
}> = {
  blue: {
    bg: 'bg-surface-200/40',
    border: 'border-surface-300/40',
    text: 'text-for-400',
    fill: 'bg-for-600/30',
    selectedBg: 'bg-for-900/50',
    selectedBorder: 'border-for-600/60',
  },
  tie: {
    bg: 'bg-surface-200/40',
    border: 'border-surface-300/40',
    text: 'text-gold',
    fill: 'bg-gold/20',
    selectedBg: 'bg-gold/20',
    selectedBorder: 'border-gold/50',
  },
  red: {
    bg: 'bg-surface-200/40',
    border: 'border-surface-300/40',
    text: 'text-against-400',
    fill: 'bg-against-600/30',
    selectedBg: 'bg-against-900/50',
    selectedBorder: 'border-against-600/60',
  },
}

function pct(count: number, total: number): number {
  if (total === 0) return 0
  return Math.round((count / total) * 100)
}

export function DebateWinnerPoll({
  debateId,
  blueName,
  redName,
  className,
}: DebateWinnerPollProps) {
  const [result, setResult] = useState<WinnerPollResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthed(!!data.user)
    })

    fetch(`/api/debates/${debateId}/winner-poll`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setResult(d as WinnerPollResult)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debateId])

  async function castVote(winner: PollOption) {
    if (!isAuthed || submitting || result?.user_vote) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/debates/${debateId}/winner-poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner }),
      })
      if (res.ok) {
        const updated = (await res.json()) as WinnerPollResult
        setResult(updated)
      }
    } catch {
      // best-effort
    } finally {
      setSubmitting(false)
    }
  }

  const hasVoted = !!result?.user_vote
  const displayName: Record<PollOption, string> = {
    blue: blueName ?? 'FOR side',
    tie: 'Tie / Draw',
    red: redName ?? 'AGAINST side',
  }

  return (
    <div className={cn('bg-surface-100 rounded-xl p-5 border border-surface-200/20', className)}>
      <div className="flex items-center gap-2 mb-1">
        <Vote className="w-4 h-4 text-purple" />
        <p className="text-sm font-semibold text-white">Who argued better?</p>
      </div>
      <p className="text-[11px] text-surface-500 font-mono mb-4">
        Independent of the topic vote — who made the stronger case?
      </p>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 text-surface-500 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {OPTIONS.map(({ value, icon: Icon, label }) => {
            const style = OPTION_STYLE[value]
            const count = result?.[value] ?? 0
            const total = result?.total ?? 0
            const percentage = pct(count, total)
            const isSelected = result?.user_vote === value
            const canVote = isAuthed && !hasVoted && !submitting

            return (
              <motion.button
                key={value}
                onClick={() => castVote(value)}
                disabled={!canVote || hasVoted}
                aria-label={`Vote ${label} as debate winner`}
                aria-pressed={isSelected}
                className={cn(
                  'relative w-full text-left rounded-xl border overflow-hidden transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50',
                  hasVoted
                    ? isSelected
                      ? `${style.selectedBg} ${style.selectedBorder}`
                      : `${style.bg} ${style.border} opacity-60`
                    : canVote
                      ? `${style.bg} ${style.border} hover:opacity-80 cursor-pointer`
                      : `${style.bg} ${style.border} cursor-default`,
                )}
                whileTap={canVote ? { scale: 0.98 } : {}}
              >
                {/* Fill bar (shown after voting) */}
                <AnimatePresence>
                  {hasVoted && (
                    <motion.div
                      key="fill"
                      className={cn('absolute inset-y-0 left-0', style.fill)}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  )}
                </AnimatePresence>

                <div className="relative flex items-center gap-3 px-4 py-3">
                  <Icon className={cn('w-4 h-4 shrink-0', style.text)} />
                  <span className={cn('flex-1 text-sm font-medium text-white truncate')}>
                    {displayName[value]}
                    <span className={cn('ml-1.5 text-[11px] font-mono', style.text)}>
                      {label === 'Tie' ? '' : `· ${label}`}
                    </span>
                  </span>

                  {hasVoted ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-white tabular-nums">
                        {percentage}%
                      </span>
                      {isSelected && (
                        <div className={cn(
                          'flex items-center justify-center h-5 w-5 rounded-full',
                          value === 'blue' ? 'bg-for-500' : value === 'red' ? 'bg-against-500' : 'bg-gold'
                        )}>
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  ) : (
                    canVote && (
                      <ChevronRight className="w-3.5 h-3.5 text-surface-500 shrink-0" />
                    )
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Vote count + login prompt */}
      <div className="mt-3 flex items-center justify-between">
        {result && result.total > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-surface-500 font-mono">
            <Users className="w-3 h-3" />
            <span>
              {result.total} {result.total === 1 ? 'vote' : 'votes'}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-surface-600 font-mono">No votes yet</span>
        )}

        {!isAuthed && !loading && (
          <span className="text-[11px] text-surface-500 font-mono">
            Sign in to vote
          </span>
        )}

        {hasVoted && (
          <span className="text-[11px] text-surface-500 font-mono">
            Vote recorded
          </span>
        )}
      </div>
    </div>
  )
}
