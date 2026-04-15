'use client'

/**
 * VoteSheet
 *
 * Mobile-optimised bottom sheet for casting votes on an active topic.
 *
 * Shows:
 *   - Topic statement (clamped to 3 lines)
 *   - Live FOR / AGAINST percentage bar
 *   - Vote count + optional deadline countdown
 *   - Large thumb-friendly FOR / AGAINST buttons
 *   - Post-vote confirmation state before the sheet closes
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ThumbsDown, ThumbsUp, Timer } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { StanceShareButton } from '@/components/voting/StanceShareButton'
import { cn } from '@/lib/utils/cn'
import type { Topic, VoteSide } from '@/lib/supabase/types'

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-y-0 right-0 bg-against-600 rounded-r-full"
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between text-xs font-mono">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
      </div>
    </div>
  )
}

function VoteCountdown({ endsAt }: { endsAt: string }) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    function tick() {
      const ms = new Date(endsAt).getTime() - Date.now()
      if (ms <= 0) {
        setLabel('Voting closed')
        return
      }
      const totalSec = Math.floor(ms / 1000)
      const days = Math.floor(totalSec / 86400)
      const hrs = Math.floor((totalSec % 86400) / 3600)
      const mins = Math.floor((totalSec % 3600) / 60)
      const secs = totalSec % 60

      if (days > 0) {
        setLabel(`${days}d ${hrs}h left`)
      } else if (hrs > 0) {
        setLabel(`${hrs}h ${mins}m left`)
      } else {
        setLabel(`${mins}m ${String(secs).padStart(2, '0')}s left`)
      }
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return (
    <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-surface-500">
      <Timer className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

// ─── Confirmed state ──────────────────────────────────────────────────────────

function VoteConfirmed({
  side,
  topic,
  onClose,
}: {
  side: VoteSide
  topic: Topic
  onClose: () => void
}) {
  // Auto-close after 3.5 s — slightly longer so users have time to share
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const isFor = side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="flex flex-col items-center justify-center py-8 gap-5"
    >
      <div
        className={cn(
          'flex items-center justify-center h-16 w-16 rounded-full',
          isFor
            ? 'bg-for-500/20 border-2 border-for-500/60'
            : 'bg-against-500/20 border-2 border-against-500/60'
        )}
      >
        <CheckCircle2
          className={cn('h-8 w-8', isFor ? 'text-for-400' : 'text-against-400')}
        />
      </div>
      <div className="text-center">
        <p className="text-white font-bold font-mono text-lg">
          Voted {isFor ? 'FOR' : 'AGAINST'}
        </p>
        <p className="text-surface-500 text-sm font-mono mt-0.5">
          Your vote is on the record.
        </p>
      </div>
      {/* Share stance CTA */}
      <StanceShareButton
        topicId={topic.id}
        statement={topic.statement}
        votedSide={side}
        forPct={topic.blue_pct}
        totalVotes={topic.total_votes}
        category={topic.category}
      />
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface VoteSheetProps {
  open: boolean
  onClose: () => void
  topic: Topic
  onVote: (side: VoteSide) => Promise<void> | void
  hasVoted: boolean
  votedSide: VoteSide | null | undefined
}

export function VoteSheet({
  open,
  onClose,
  topic,
  onVote,
  hasVoted,
  votedSide,
}: VoteSheetProps) {
  const [pending, setPending] = useState<VoteSide | null>(null)
  const [confirmed, setConfirmed] = useState<VoteSide | null>(null)
  const mountedRef = useRef(true)

  // Reset local state when sheet closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setPending(null)
        setConfirmed(null)
      }, 350) // after exit animation
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleVote = useCallback(
    async (side: VoteSide) => {
      if (pending || hasVoted) return
      setPending(side)
      try {
        await onVote(side)
        if (mountedRef.current) {
          setConfirmed(side)
          setPending(null)
        }
      } catch {
        if (mountedRef.current) {
          setPending(null)
        }
      }
    },
    [pending, hasVoted, onVote]
  )

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const alreadyVotedSide = hasVoted ? votedSide : null

  return (
    <BottomSheet open={open} onClose={onClose} title="Cast your vote" maxHeight="90dvh">
      <div className="px-5 py-5 space-y-5">
        <AnimatePresence mode="wait" initial={false}>
          {confirmed ? (
            <VoteConfirmed key="confirmed" side={confirmed} topic={topic} onClose={onClose} />
          ) : (
            <motion.div
              key="voting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Topic statement */}
              <p className="text-white font-semibold text-lg leading-snug line-clamp-3">
                {topic.statement}
              </p>

              {/* Live vote bar */}
              <LiveBar bluePct={topic.blue_pct ?? 50} />

              {/* Total votes */}
              <div className="flex items-center justify-between text-xs font-mono text-surface-500">
                <span>
                  {topic.total_votes.toLocaleString()}{' '}
                  {topic.total_votes === 1 ? 'vote' : 'votes'} cast
                </span>
                {topic.category && (
                  <span className="text-surface-600">{topic.category}</span>
                )}
              </div>

              {/* Deadline */}
              {topic.voting_ends_at && !hasVoted && (
                <VoteCountdown endsAt={topic.voting_ends_at} />
              )}

              {/* If already voted, show recap */}
              {hasVoted && alreadyVotedSide && (
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3 text-sm font-mono text-center',
                    alreadyVotedSide === 'blue'
                      ? 'bg-for-500/10 border-for-500/30 text-for-300'
                      : 'bg-against-500/10 border-against-500/30 text-against-300'
                  )}
                >
                  You voted{' '}
                  <strong>{alreadyVotedSide === 'blue' ? 'FOR' : 'AGAINST'}</strong>{' '}
                  this topic.
                </div>
              )}

              {/* Vote buttons */}
              {!hasVoted && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* FOR */}
                  <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => handleVote('blue')}
                    aria-label={`Vote FOR — ${forPct}% currently agree`}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-2',
                      'rounded-2xl py-5 px-3 font-mono font-bold text-sm transition-all',
                      'border-2',
                      pending === 'blue'
                        ? 'bg-for-600 border-for-500 text-white scale-95'
                        : 'bg-for-600/20 border-for-600/50 text-for-300 hover:bg-for-600/30 hover:border-for-500 active:scale-95',
                      !!pending && pending !== 'blue' && 'opacity-40 pointer-events-none'
                    )}
                  >
                    <ThumbsUp className="h-6 w-6" aria-hidden="true" />
                    <span className="tracking-widest uppercase text-xs">For</span>
                    <span className="text-xl font-bold text-white">{forPct}%</span>
                    {pending === 'blue' && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 rounded-2xl bg-for-500/20 flex items-center justify-center"
                      >
                        <span className="sr-only">Submitting…</span>
                      </motion.span>
                    )}
                  </button>

                  {/* AGAINST */}
                  <button
                    type="button"
                    disabled={!!pending}
                    onClick={() => handleVote('red')}
                    aria-label={`Vote AGAINST — ${againstPct}% currently disagree`}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-2',
                      'rounded-2xl py-5 px-3 font-mono font-bold text-sm transition-all',
                      'border-2',
                      pending === 'red'
                        ? 'bg-against-600 border-against-500 text-white scale-95'
                        : 'bg-against-600/20 border-against-600/50 text-against-300 hover:bg-against-600/30 hover:border-against-500 active:scale-95',
                      !!pending && pending !== 'red' && 'opacity-40 pointer-events-none'
                    )}
                  >
                    <ThumbsDown className="h-6 w-6" aria-hidden="true" />
                    <span className="tracking-widest uppercase text-xs">Against</span>
                    <span className="text-xl font-bold text-white">{againstPct}%</span>
                    {pending === 'red' && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 rounded-2xl bg-against-500/20 flex items-center justify-center"
                      >
                        <span className="sr-only">Submitting…</span>
                      </motion.span>
                    )}
                  </button>
                </div>
              )}

              <p className="text-center text-[11px] text-surface-600 font-mono">
                Votes are public and permanent.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BottomSheet>
  )
}
