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
 *   - Optional "hot take" reason input (≤140 chars) before confirming
 *   - Post-vote confirmation state with related-topic nudges
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2, Compass, GitMerge, MessageSquare, ThumbsDown, ThumbsUp, Timer } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { StanceShareButton } from '@/components/voting/StanceShareButton'
import { Avatar } from '@/components/ui/Avatar'
import { haptics } from '@/lib/hooks/useHaptics'
import { cn } from '@/lib/utils/cn'
import type { Topic, VoteSide } from '@/lib/supabase/types'
import type { DelegateVoteResponse } from '@/app/api/topics/[id]/delegate-vote/route'

// ─── Argument type (matches /api/topics/[id]/top-arguments response) ─────────

interface TopArgument {
  id: string
  content: string
  upvotes: number
}

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

// ─── Opposing-side arguments panel ───────────────────────────────────────────

function OpposingArguments({
  topicId,
  votedSide,
}: {
  topicId: string
  votedSide: VoteSide
}) {
  const [args, setArgs] = useState<TopArgument[]>([])
  const [loading, setLoading] = useState(true)

  const isFor = votedSide === 'blue'

  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics/${topicId}/top-arguments`)
      .then((res) => (res.ok ? res.json() : { forArgs: [], againstArgs: [] }))
      .then((data) => {
        if (!cancelled) {
          const opposing: TopArgument[] = isFor
            ? (data.againstArgs ?? (data.againstArg ? [data.againstArg] : []))
            : (data.forArgs ?? (data.forArg ? [data.forArg] : []))
          setArgs(opposing.slice(0, 3))
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [topicId, isFor])

  if (loading || args.length === 0) return null

  const opposingColor = isFor ? 'against' : 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
      className="w-full space-y-2"
    >
      <div className="flex items-center gap-2 px-0.5">
        <MessageSquare className="h-3 w-3 text-surface-500 flex-shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">
          The strongest case {isFor ? 'against' : 'for'}
        </span>
      </div>
      <div className="space-y-1.5">
        {args.map((arg) => (
          <div
            key={arg.id}
            className={cn(
              'rounded-xl border px-3 py-2.5',
              opposingColor === 'against'
                ? 'bg-against-500/5 border-against-500/20'
                : 'bg-for-500/5 border-for-500/20'
            )}
          >
            <p
              className={cn(
                'text-[11px] font-mono leading-relaxed line-clamp-3',
                opposingColor === 'against' ? 'text-against-300' : 'text-for-300'
              )}
            >
              {arg.content}
            </p>
            {arg.upvotes > 0 && (
              <span
                className={cn(
                  'text-[10px] font-mono mt-1 block',
                  opposingColor === 'against' ? 'text-against-500/70' : 'text-for-500/70'
                )}
              >
                {arg.upvotes} {arg.upvotes === 1 ? 'upvote' : 'upvotes'}
              </span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Confirmed state ──────────────────────────────────────────────────────────

function VoteConfirmed({
  side,
  reason,
  topic,
  onClose,
}: {
  side: VoteSide
  reason: string | null
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

      {/* Show the reason if provided */}
      {reason && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className={cn(
            'w-full rounded-xl border px-4 py-3',
            isFor
              ? 'bg-for-600/10 border-for-500/30'
              : 'bg-against-600/10 border-against-500/30'
          )}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquare className="h-3 w-3 text-surface-500" aria-hidden="true" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500">Your hot take</span>
          </div>
          <p className="text-sm font-mono text-surface-300 leading-relaxed">&ldquo;{reason}&rdquo;</p>
        </motion.div>
      )}

      {/* Share stance CTA */}
      <StanceShareButton
        topicId={topic.id}
        statement={topic.statement}
        votedSide={side}
        forPct={topic.blue_pct}
        totalVotes={topic.total_votes}
        category={topic.category}
      />

      {/* Why people voted link */}
      <Link
        href={`/topic/${topic.id}/reasons`}
        onClick={onClose}
        className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
      >
        <MessageSquare className="h-3 w-3" aria-hidden />
        See why others voted
      </Link>

      {/* ── Opposing arguments ───────────────────────────────────────────── */}
      <OpposingArguments topicId={topic.id} votedSide={side} />

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

// ─── Reason step ──────────────────────────────────────────────────────────────

const MAX_REASON = 140

function ReasonStep({
  side,
  onSubmit,
  onBack,
  disabled,
}: {
  side: VoteSide
  onSubmit: (reason: string | null) => void
  onBack: () => void
  disabled: boolean
}) {
  const [text, setText] = useState('')
  const isFor = side === 'blue'
  const remaining = MAX_REASON - text.length
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus the textarea when this step mounts
  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div
      key="reason"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Side badge */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back to vote selection"
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-mono font-bold',
            isFor
              ? 'bg-for-600/20 border border-for-600/40 text-for-400'
              : 'bg-against-600/20 border border-against-600/40 text-against-400'
          )}
        >
          {isFor ? <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />}
          Voting {isFor ? 'FOR' : 'AGAINST'}
        </div>
      </div>

      {/* Prompt */}
      <div>
        <label htmlFor="vote-reason" className="block text-sm font-semibold text-white mb-1">
          Add your hot take <span className="text-surface-500 font-normal">(optional)</span>
        </label>
        <p className="text-xs font-mono text-surface-500">
          Why do you vote this way? Up to 140 characters.
        </p>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          id="vote-reason"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_REASON))}
          placeholder={isFor
            ? 'e.g. "This benefits the most people by…"'
            : 'e.g. "The evidence doesn\'t support this because…"'}
          rows={3}
          disabled={disabled}
          aria-describedby="reason-char-count"
          className={cn(
            'w-full resize-none rounded-xl border px-4 py-3',
            'bg-surface-200 text-white text-sm font-mono leading-relaxed',
            'placeholder:text-surface-600',
            'focus:outline-none focus:ring-2',
            isFor
              ? 'border-surface-300 focus:border-for-500/50 focus:ring-for-500/20'
              : 'border-surface-300 focus:border-against-500/50 focus:ring-against-500/20',
            'transition-colors disabled:opacity-50'
          )}
        />
        <span
          id="reason-char-count"
          aria-live="polite"
          className={cn(
            'absolute bottom-2.5 right-3 text-[10px] font-mono tabular-nums',
            remaining <= 20 ? 'text-against-400' : 'text-surface-600'
          )}
        >
          {remaining}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmit(null)}
          className={cn(
            'flex-1 py-3 rounded-xl font-mono font-semibold text-sm',
            'border border-surface-400 text-surface-400',
            'hover:border-surface-300 hover:text-surface-300',
            'transition-colors disabled:opacity-40'
          )}
        >
          Skip
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSubmit(text.trim() || null)}
          className={cn(
            'flex-[2] py-3 rounded-xl font-mono font-bold text-sm',
            'transition-colors disabled:opacity-40',
            isFor
              ? 'bg-for-600 text-white hover:bg-for-500'
              : 'bg-against-600 text-white hover:bg-against-500'
          )}
        >
          {disabled ? 'Casting vote…' : 'Cast Vote'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Delegate vote banner ─────────────────────────────────────────────────────

function DelegateVoteBanner({
  topicId,
  onMirror,
}: {
  topicId: string
  onMirror: (side: VoteSide) => void
}) {
  const [delegation, setDelegation] = useState<DelegateVoteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/topics/${topicId}/delegate-vote`)
      .then((r) => (r.ok ? r.json() : { delegation: null }))
      .then((data) => {
        if (!cancelled) setDelegation(data.delegation ?? null)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [topicId])

  if (loading || dismissed || !delegation) return null
  // Only show if the delegate has actually voted
  if (!delegation.delegateSide) return null

  const isFor = delegation.delegateSide === 'blue'
  const displayName = delegation.delegateDisplayName || `@${delegation.delegateUsername}`
  const scopeLabel = delegation.delegationScope === 'topic'
    ? 'on this topic'
    : delegation.delegationScope === 'category'
    ? 'for this category'
    : 'globally'

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-xl border px-3 py-2.5 flex items-center gap-3',
        isFor
          ? 'bg-for-500/10 border-for-500/30'
          : 'bg-against-500/10 border-against-500/30'
      )}
    >
      <div className="flex-shrink-0">
        <Avatar
          src={delegation.delegateAvatarUrl}
          fallback={displayName}
          size="sm"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <GitMerge className="h-3 w-3 text-surface-500 flex-shrink-0" aria-hidden />
          <span className="text-[11px] font-mono text-surface-400 leading-tight">
            Your delegate{' '}
            <Link
              href={`/profile/${delegation.delegateUsername}`}
              className="text-white font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {displayName}
            </Link>{' '}
            voted{' '}
            <span className={cn('font-bold', isFor ? 'text-for-300' : 'text-against-300')}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>{' '}
            <span className="text-surface-600">{scopeLabel}</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => onMirror(delegation.delegateSide!)}
          className={cn(
            'text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all active:scale-95',
            isFor
              ? 'bg-for-600/20 border-for-500/40 text-for-300 hover:bg-for-600/30'
              : 'bg-against-600/20 border-against-500/40 text-against-300 hover:bg-against-600/30'
          )}
          aria-label={`Mirror delegate's ${isFor ? 'FOR' : 'AGAINST'} vote`}
        >
          Mirror
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex items-center justify-center h-5 w-5 rounded text-surface-600 hover:text-surface-400 transition-colors"
          aria-label="Dismiss delegate suggestion"
        >
          ×
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface VoteSheetProps {
  open: boolean
  onClose: () => void
  topic: Topic
  onVote: (side: VoteSide, reason?: string) => Promise<void> | void
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
  // 'select' → user picks FOR/AGAINST
  // 'reason' → optional hot take input
  // 'confirmed' → submitted, showing post-vote state
  const [step, setStep] = useState<'select' | 'reason' | 'confirmed'>('select')
  const [selectedSide, setSelectedSide] = useState<VoteSide | null>(null)
  const [confirmedSide, setConfirmedSide] = useState<VoteSide | null>(null)
  const [confirmedReason, setConfirmedReason] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const mountedRef = useRef(true)

  // Reset local state when sheet closes
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setStep('select')
        setSelectedSide(null)
        setConfirmedSide(null)
        setConfirmedReason(null)
        setSubmitting(false)
      }, 350) // after exit animation
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleSideSelect = useCallback(
    (side: VoteSide) => {
      if (submitting || hasVoted) return
      setSelectedSide(side)
      setStep('reason')
    },
    [submitting, hasVoted]
  )

  const handleMirror = useCallback(
    (side: VoteSide) => {
      if (submitting || hasVoted) return
      haptics.selection()
      setSelectedSide(side)
      setStep('reason')
    },
    [submitting, hasVoted]
  )

  const handleReasonSubmit = useCallback(
    async (reason: string | null) => {
      if (!selectedSide || submitting) return
      setSubmitting(true)
      if (selectedSide === 'blue') { haptics.voteFor() } else { haptics.voteAgainst() }
      try {
        await onVote(selectedSide, reason ?? undefined)
        if (mountedRef.current) {
          haptics.success()
          setConfirmedSide(selectedSide)
          setConfirmedReason(reason)
          setStep('confirmed')
          setSubmitting(false)
        }
      } catch {
        if (mountedRef.current) {
          haptics.error()
          setSubmitting(false)
        }
      }
    },
    [selectedSide, submitting, onVote]
  )

  const handleBack = useCallback(() => {
    setStep('select')
    setSelectedSide(null)
  }, [])

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  const alreadyVotedSide = hasVoted ? votedSide : null

  return (
    <BottomSheet open={open} onClose={onClose} title="Cast your vote" maxHeight="90dvh">
      <div className="px-5 py-5 space-y-5">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'confirmed' && confirmedSide ? (
            <VoteConfirmed
              key="confirmed"
              side={confirmedSide}
              reason={confirmedReason}
              topic={topic}
              onClose={onClose}
            />
          ) : step === 'reason' && selectedSide ? (
            <ReasonStep
              key="reason"
              side={selectedSide}
              onSubmit={handleReasonSubmit}
              onBack={handleBack}
              disabled={submitting}
            />
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

              {/* Delegate vote suggestion — only for users who haven't voted yet */}
              {!hasVoted && (
                <DelegateVoteBanner
                  topicId={topic.id}
                  onMirror={handleMirror}
                />
              )}

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
                    disabled={submitting}
                    onClick={() => handleSideSelect('blue')}
                    aria-label={`Vote FOR — ${forPct}% currently agree`}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-2',
                      'rounded-2xl py-5 px-3 font-mono font-bold text-sm transition-all',
                      'border-2',
                      'bg-for-600/20 border-for-600/50 text-for-300 hover:bg-for-600/30 hover:border-for-500 active:scale-95',
                      submitting && 'opacity-40 pointer-events-none'
                    )}
                  >
                    <ThumbsUp className="h-6 w-6" aria-hidden="true" />
                    <span className="tracking-widest uppercase text-xs">For</span>
                    <span className="text-xl font-bold text-white">{forPct}%</span>
                  </button>

                  {/* AGAINST */}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSideSelect('red')}
                    aria-label={`Vote AGAINST — ${againstPct}% currently disagree`}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-2',
                      'rounded-2xl py-5 px-3 font-mono font-bold text-sm transition-all',
                      'border-2',
                      'bg-against-600/20 border-against-600/50 text-against-300 hover:bg-against-600/30 hover:border-against-500 active:scale-95',
                      submitting && 'opacity-40 pointer-events-none'
                    )}
                  >
                    <ThumbsDown className="h-6 w-6" aria-hidden="true" />
                    <span className="tracking-widest uppercase text-xs">Against</span>
                    <span className="text-xl font-bold text-white">{againstPct}%</span>
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
