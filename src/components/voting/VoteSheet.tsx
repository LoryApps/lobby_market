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
 *   - Post-vote confirmation state with related-topic nudges
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, CheckCircle2, Compass, ThumbsDown, ThumbsUp, Timer } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { StanceShareButton } from '@/components/voting/StanceShareButton'
import { cn } from '@/lib/utils/cn'
import type { Topic, VoteSide } from '@/lib/supabase/types'

// ─── Related topic type (matches /api/topics/[id]/related response) ──────────

interface RelatedTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

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

// ─── Compact related-topic chip ───────────────────────────────────────────────

function RelatedChip({ topic, onClose }: { topic: RelatedTopic; onClose: () => void }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const isVoting = topic.status === 'voting'
  const isLaw = topic.status === 'law'

  return (
    <Link
      href={`/topic/${topic.id}`}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        'bg-surface-200/60 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
        'group'
      )}
    >
      {/* Mini vote bar */}
      <div className="flex-shrink-0 w-1 h-8 rounded-full overflow-hidden bg-surface-300">
        <div
          className={cn(
            'w-full rounded-full transition-all',
            isLaw ? 'bg-gold' : isVoting ? 'bg-purple' : 'bg-for-500'
          )}
          style={{ height: `${forPct}%` }}
        />
      </div>

      {/* Statement */}
      <p className="flex-1 text-[11px] font-mono text-surface-400 group-hover:text-surface-200 line-clamp-2 leading-relaxed transition-colors">
        {topic.statement}
      </p>

      <ArrowRight className="flex-shrink-0 h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden="true" />
    </Link>
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
  const [related, setRelated] = useState<RelatedTopic[]>([])
  const [loadingRelated, setLoadingRelated] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFor = side === 'blue'

  // Fetch related topics in the background
  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics/${topic.id}/related`)
      .then((res) => (res.ok ? res.json() : { topics: [] }))
      .then((data) => {
        if (!cancelled) {
          setRelated((data.topics ?? []).slice(0, 3))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingRelated(false)
      })
    return () => { cancelled = true }
  }, [topic.id])

  // Auto-close: 5 s normally; if related topics arrive, extend to 10 s
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const delay = !loadingRelated && related.length > 0 ? 10_000 : 5_000
    timerRef.current = setTimeout(onClose, delay)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onClose, loadingRelated, related.length])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="flex flex-col items-center py-6 gap-5 w-full"
    >
      {/* Confirmation icon */}
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
          aria-hidden="true"
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

      {/* ── Related topics nudge ─────────────────────────────────────────── */}
      <AnimatePresence>
        {!loadingRelated && related.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full space-y-2"
          >
            <div className="flex items-center gap-2 px-0.5">
              <Compass className="h-3 w-3 text-surface-500 flex-shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
                Keep exploring
              </span>
            </div>
            <div className="space-y-1.5">
              {related.map((t) => (
                <RelatedChip key={t.id} topic={t} onClose={onClose} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
