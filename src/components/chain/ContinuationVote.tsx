'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, XCircle, Clock, AlertCircle } from 'lucide-react'
import type { ContinuationWithAuthor } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { VoteTimer } from '@/components/voting/VoteTimer'
import { cn } from '@/lib/utils/cn'

interface ContinuationVoteProps {
  topicId: string
  topicStatement: string
  finalists: ContinuationWithAuthor[]
  votingEndsAt: string
  className?: string
}

const NONE_OF_THESE = '__none__'

export function ContinuationVote({
  topicId: _topicId,
  topicStatement,
  finalists,
  votingEndsAt,
  className,
}: ContinuationVoteProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [voted, setVoted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Local vote overrides (after user casts their vote).
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map())

  const topFive = useMemo(() => finalists.slice(0, 5), [finalists])

  const totalVotes = useMemo(() => {
    return topFive.reduce(
      (sum, c) => sum + (overrides.get(c.id) ?? c.vote_count),
      0
    )
  }, [topFive, overrides])

  const handleSubmit = async () => {
    if (!selected || submitting || voted) return

    setSubmitting(true)
    setError(null)

    try {
      // "None of these" short-circuits without an API call; it's a protest slot.
      if (selected !== NONE_OF_THESE) {
        const res = await fetch(
          `/api/continuations/${selected}/vote`,
          {
            method: 'POST',
          }
        )

        if (res.status === 401) {
          setError('You must be signed in to vote.')
          return
        }
        if (res.status === 409) {
          setError('You have already voted in this continuation round.')
          return
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null
          setError(body?.error ?? 'Failed to cast vote.')
          return
        }

        // Optimistic bump
        setOverrides((prev) => {
          const next = new Map(prev)
          const current = topFive.find((c) => c.id === selected)
          const base = prev.get(selected) ?? current?.vote_count ?? 0
          next.set(selected, base + 1)
          return next
        })
      }

      setVoted(true)
    } catch (err) {
      console.error('Continuation vote failed:', err)
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (topFive.length === 0) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed border-surface-300 bg-surface-100 p-6 text-center',
          className
        )}
      >
        <p className="text-sm text-surface-500">
          Waiting for finalists. No continuations have been promoted yet.
        </p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-2xl border border-gold/30 bg-surface-100 p-5 space-y-4 glow-gold',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-surface-300">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold">
            Pick a continuation
          </p>
          <p className="text-[11px] text-surface-500 mt-0.5">
            One vote per topic. Plurality wins.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-gold" />
          <VoteTimer endsAt={votingEndsAt} className="text-gold" />
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {topFive.map((cont) => {
          const voteCount = overrides.get(cont.id) ?? cont.vote_count
          const pct =
            totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0
          const isSelected = selected === cont.id
          const showBars = voted

          return (
            <button
              key={cont.id}
              type="button"
              disabled={voted || submitting}
              onClick={() => setSelected(cont.id)}
              className={cn(
                'relative w-full overflow-hidden rounded-xl border p-4 text-left transition-colors',
                'disabled:cursor-not-allowed',
                !voted &&
                  (isSelected
                    ? 'border-gold bg-gold/10'
                    : 'border-surface-300 bg-surface-50 hover:border-surface-400'),
                voted &&
                  (isSelected
                    ? 'border-gold bg-surface-50'
                    : 'border-surface-300 bg-surface-50 opacity-80')
              )}
            >
              {/* Progress bar underlay after voting */}
              {showBars && (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gold/10"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                />
              )}

              <div className="relative flex items-start gap-3">
                {/* Radio */}
                <div
                  className={cn(
                    'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isSelected
                      ? 'border-gold bg-gold'
                      : 'border-surface-400 bg-transparent'
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-black" />}
                </div>

                {/* Statement */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-snug">
                    <span className="text-surface-500">{topicStatement}</span>{' '}
                    <span className="font-semibold text-gold">
                      ...{cont.connector}
                    </span>{' '}
                    <span className="text-white">{cont.text}</span>
                  </p>

                  {/* Results */}
                  {showBars && (
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-surface-500">
                      <span className="font-mono font-bold tabular-nums text-gold">
                        {pct}%
                      </span>
                      <span className="tabular-nums">
                        {voteCount} {voteCount === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </button>
          )
        })}

        {/* None of these */}
        <button
          type="button"
          disabled={voted || submitting}
          onClick={() => setSelected(NONE_OF_THESE)}
          className={cn(
            'w-full rounded-xl border border-dashed p-3 text-left transition-colors',
            'disabled:cursor-not-allowed',
            selected === NONE_OF_THESE
              ? 'border-surface-500 bg-surface-200/50'
              : 'border-surface-300 bg-transparent hover:border-surface-400'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                selected === NONE_OF_THESE
                  ? 'border-surface-600 bg-surface-600'
                  : 'border-surface-400 bg-transparent'
              )}
            >
              {selected === NONE_OF_THESE && (
                <XCircle className="h-2.5 w-2.5 text-black" />
              )}
            </div>
            <span className="text-sm text-surface-500">None of these</span>
          </div>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-against-500/30 bg-against-500/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-against-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-against-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-2 border-t border-surface-300">
        <Button
          variant="gold"
          size="md"
          disabled={!selected || submitting || voted}
          onClick={handleSubmit}
        >
          {voted ? 'Vote recorded' : submitting ? 'Casting...' : 'Cast vote'}
        </Button>
      </div>
    </div>
  )
}
