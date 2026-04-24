'use client'

import Link from 'next/link'
import { Share2, Eye, ThumbsUp, ThumbsDown, MapPin, Flame, Clock, Gavel, Swords, TrendingUp, Zap, X } from 'lucide-react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { Topic, VoteSide } from '@/lib/supabase/types'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { VoteBar } from '@/components/voting/VoteBar'
import { VoteButton } from '@/components/voting/VoteButton'
import { VoteTimer } from '@/components/voting/VoteTimer'
import { SupportButton } from '@/components/voting/SupportButton'
import { useVoteStore } from '@/lib/stores/vote-store'
import { useFeedStore } from '@/lib/stores/feed-store'
import { BookmarkButton } from '@/components/ui/BookmarkButton'
import { StanceShareButton } from '@/components/voting/StanceShareButton'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'
import { TopicReactions } from '@/components/topic/TopicReactions'

// ── Signal icon map ───────────────────────────────────────────────────────────

const SIGNAL_ICONS: Record<string, typeof Flame> = {
  ending_soon:    Clock,
  brink_of_law:   Gavel,
  deadlock:       Swords,
  trending:       TrendingUp,
  gaining_support: Zap,
  strong_majority: Flame,
}

interface TopicCardProps {
  topic: Topic
  authorName?: string
  authorAvatar?: string | null
}

const statusLabel: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const statusBadgeVariant: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

function glowForStatus(status: string): 'blue' | 'red' | 'gold' | undefined {
  if (status === 'law') return 'gold'
  return undefined
}

// How many pixels of drag before the vote is committed
const SWIPE_THRESHOLD = 88

export function TopicCard({ topic, authorName, authorAvatar }: TopicCardProps) {
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const updateTopic = useFeedStore((s) => s.updateTopic)
  const votedSide = getVoteSide(topic.id)
  const isVotable = topic.status === 'active' || topic.status === 'voting'
  const isProposed = topic.status === 'proposed'
  const isLaw = topic.status === 'law'
  const signal = getTopicSignal(topic)

  // Hot-take (vote reason) inline prompt state
  const [pendingVoteSide, setPendingVoteSide] = useState<VoteSide | null>(null)
  const [hotTakeText, setHotTakeText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedHotTake, setSubmittedHotTake] = useState<string | null>(null)
  const hotTakeRef = useRef<HTMLTextAreaElement>(null)

  // Swipe gesture is only available on active/voting topics the user hasn't voted on yet
  const canSwipeVote = isVotable && !hasVoted(topic.id) && !pendingVoteSide

  // ── Motion values ──────────────────────────────────────────────────────────
  const x = useMotionValue(0)

  // Card tilt as it's dragged
  const rotate = useTransform(x, [-160, 0, 160], [-7, 0, 7])

  // FOR overlay fades in as card drags right
  const forOpacity = useTransform(x, [20, SWIPE_THRESHOLD, 160], [0, 0.75, 1])
  // AGAINST overlay fades in as card drags left
  const againstOpacity = useTransform(x, [-160, -SWIPE_THRESHOLD, -20], [1, 0.75, 0])

  // Slight scale-up on the active overlay icon
  const forIconScale = useTransform(x, [SWIPE_THRESHOLD * 0.5, SWIPE_THRESHOLD * 1.2], [0.8, 1.15])
  const againstIconScale = useTransform(x, [-SWIPE_THRESHOLD * 1.2, -SWIPE_THRESHOLD * 0.5], [1.15, 0.8])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleVote = async (side: VoteSide, reason?: string) => {
    // Best-effort haptic feedback on devices that support it (Android / some PWA)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(40)
    }
    await castVote(topic.id, side, reason)
    const isBlue = side === 'blue'
    updateTopic(topic.id, {
      total_votes: topic.total_votes + 1,
      blue_votes: topic.blue_votes + (isBlue ? 1 : 0),
      red_votes: topic.red_votes + (isBlue ? 0 : 1),
      blue_pct:
        ((topic.blue_votes + (isBlue ? 1 : 0)) / (topic.total_votes + 1)) * 100,
    })
  }

  // Button tap: show hot-take form before committing the vote
  const handleVoteIntent = (side: VoteSide) => {
    if (hasVoted(topic.id)) return
    setPendingVoteSide(side)
    setHotTakeText('')
    setTimeout(() => hotTakeRef.current?.focus(), 60)
  }

  // Confirm vote after the hot-take form (reason is optional)
  const handleConfirmVote = async (reason?: string) => {
    if (!pendingVoteSide || isSubmitting) return
    setIsSubmitting(true)
    const side = pendingVoteSide
    setPendingVoteSide(null)
    setHotTakeText('')
    if (reason) setSubmittedHotTake(reason)
    try {
      await handleVote(side, reason)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSupport = async () => {
    try {
      const res = await fetch(`/api/topics/${topic.id}/support`, { method: 'POST' })
      if (res.ok) {
        const { topic: updated } = await res.json()
        updateTopic(topic.id, {
          support_count: updated.support_count,
          status: updated.status,
        })
      }
    } catch (err) {
      console.error('Support failed:', err)
    }
  }

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = `${window.location.origin}/topic/${topic.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: topic.statement, url })
      } catch {
        // User cancelled share sheet
      }
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  // Called by Framer Motion when the user releases the drag
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    const dx = info.offset.x
    const vx = info.velocity.x

    const votedRight = dx > SWIPE_THRESHOLD || vx > 550
    const votedLeft = dx < -SWIPE_THRESHOLD || vx < -550

    if (votedRight) {
      handleVote('blue')
    } else if (votedLeft) {
      handleVote('red')
    }

    // Spring card back to center
    animate(x, 0, { type: 'spring', stiffness: 380, damping: 32 })
  }

  return (
    <div
      role="article"
      aria-label={topic.statement}
      className="feed-card relative flex items-center justify-center px-4 py-6"
    >
      {/*
       * motion.div wraps only the card (not the action rail) so the rail
       * stays fixed while the card tilts and slides during swipe.
       */}
      <motion.div
        className={cn(
          'w-full max-w-lg relative',
          canSwipeVote && 'touch-pan-y' // allow vertical scroll to pass through
        )}
        style={{ x, rotate }}
        drag={canSwipeVote ? 'x' : false}
        dragDirectionLock
        dragElastic={{ left: 0.18, right: 0.18 }}
        dragConstraints={{ left: 0, right: 0 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
      >
        {/* ── FOR overlay (right swipe) ──────────────────────────────────── */}
        {canSwipeVote && (
          <motion.div
            className={cn(
              'absolute inset-0 z-20 rounded-2xl pointer-events-none',
              'flex items-center justify-end pr-8',
              'bg-for-500/20 border-2 border-for-500/60',
            )}
            style={{ opacity: forOpacity }}
            aria-hidden="true"
          >
            <motion.div
              className="flex flex-col items-center gap-2"
              style={{ scale: forIconScale }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-for-500/30 border-2 border-for-400">
                <ThumbsUp className="h-7 w-7 text-for-300" />
              </div>
              <span className="text-xs font-bold font-mono tracking-widest text-for-300 uppercase">
                For
              </span>
            </motion.div>
          </motion.div>
        )}

        {/* ── AGAINST overlay (left swipe) ──────────────────────────────── */}
        {canSwipeVote && (
          <motion.div
            className={cn(
              'absolute inset-0 z-20 rounded-2xl pointer-events-none',
              'flex items-center justify-start pl-8',
              'bg-against-500/20 border-2 border-against-500/60',
            )}
            style={{ opacity: againstOpacity }}
            aria-hidden="true"
          >
            <motion.div
              className="flex flex-col items-center gap-2"
              style={{ scale: againstIconScale }}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-against-500/30 border-2 border-against-400">
                <ThumbsDown className="h-7 w-7 text-against-300" />
              </div>
              <span className="text-xs font-bold font-mono tracking-widest text-against-300 uppercase">
                Against
              </span>
            </motion.div>
          </motion.div>
        )}

        {/* ── Card ──────────────────────────────────────────────────────── */}
        <Link href={`/topic/${topic.id}`} draggable={false}>
          <Card
            glow={glowForStatus(topic.status)}
            className={cn(
              'relative flex flex-col h-full min-h-[70dvh] max-h-[85dvh]',
              'bg-surface-100 overflow-hidden',
            )}
          >
            {/* Top row: category + scope (left) / status (right) */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {topic.category && (
                    <Badge variant="proposed" className="text-surface-500">
                      {topic.category}
                    </Badge>
                  )}
                  {topic.scope && topic.scope !== 'Global' && (
                    <span className={cn(
                      'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
                      topic.scope === 'National' && 'bg-emerald/10 text-emerald border-emerald/30',
                      topic.scope === 'Regional' && 'bg-gold/10 text-gold border-gold/30',
                      topic.scope === 'Local' && 'bg-against-500/10 text-against-300 border-against-500/30',
                    )}>
                      <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
                      {topic.scope}
                    </span>
                  )}
                </div>
                {/* Relevance signal pill */}
                {signal && (() => {
                  const classes = SIGNAL_PILL_CLASSES[signal.color]
                  const Icon = SIGNAL_ICONS[signal.id] ?? Flame
                  return (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border w-fit',
                        classes.pill,
                      )}
                      title={signal.description}
                      aria-label={signal.description}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', classes.dot)} aria-hidden="true" />
                      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                      {signal.label}
                    </span>
                  )
                })()}
              </div>
              <Badge variant={statusBadgeVariant[topic.status] ?? 'proposed'}>
                {statusLabel[topic.status] ?? topic.status}
              </Badge>
            </div>

            {/* Center: statement + optional context snippet */}
            <div className="flex-1 flex flex-col items-center justify-center py-4 gap-3">
              <p className="text-2xl md:text-3xl font-bold text-center text-white leading-tight">
                {topic.statement}
              </p>
              {topic.description && (
                <p className="text-xs text-surface-500 text-center leading-relaxed line-clamp-2 max-w-xs px-2">
                  {topic.description}
                </p>
              )}
            </div>

            {/* Bottom: voting / support / law */}
            <div className="mt-auto space-y-4">
              {isVotable && (
                <>
                  <VoteBar
                    bluePct={topic.blue_pct}
                    totalVotes={topic.total_votes}
                  />

                  {/* Hot-take inline form — shown when a vote side is pending */}
                  <AnimatePresence mode="wait">
                    {pendingVoteSide ? (
                      <motion.div
                        key="hot-take-form"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="space-y-2.5"
                        onClick={(e) => e.preventDefault()}
                      >
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-[11px] font-bold font-mono uppercase tracking-widest',
                            pendingVoteSide === 'blue' ? 'text-for-400' : 'text-against-400',
                          )}>
                            {pendingVoteSide === 'blue' ? 'Voting FOR' : 'Voting AGAINST'}
                          </span>
                          <button
                            onClick={() => { setPendingVoteSide(null); setHotTakeText('') }}
                            aria-label="Cancel vote"
                            className="text-surface-600 hover:text-surface-400 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Textarea */}
                        <div className="relative">
                          <textarea
                            ref={hotTakeRef}
                            value={hotTakeText}
                            onChange={(e) => setHotTakeText(e.target.value.slice(0, 140))}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') { setPendingVoteSide(null); setHotTakeText('') }
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault()
                                handleConfirmVote(hotTakeText.trim() || undefined)
                              }
                            }}
                            placeholder="What's your take? (optional)"
                            rows={2}
                            aria-label="Add your hot take"
                            className={cn(
                              'w-full bg-surface-100/80 border rounded-xl px-3 py-2.5',
                              'text-sm text-white placeholder-surface-600 resize-none',
                              'focus:outline-none transition-colors font-mono',
                              pendingVoteSide === 'blue'
                                ? 'border-for-600/40 focus:border-for-500/60'
                                : 'border-against-600/40 focus:border-against-500/60',
                            )}
                          />
                          <span
                            id="hot-take-char-count"
                            aria-live="polite"
                            className={cn(
                              'absolute bottom-2 right-2.5 text-[10px] font-mono tabular-nums pointer-events-none',
                              hotTakeText.length > 120 ? 'text-against-400' : 'text-surface-600',
                            )}
                          >
                            {hotTakeText.length}/140
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleConfirmVote()}
                            disabled={isSubmitting}
                            className="px-3 py-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
                          >
                            Skip
                          </button>
                          <button
                            onClick={() => handleConfirmVote(hotTakeText.trim() || undefined)}
                            disabled={isSubmitting}
                            aria-label={hotTakeText.trim() ? 'Submit hot take and vote' : 'Cast vote'}
                            className={cn(
                              'px-4 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors disabled:opacity-50',
                              pendingVoteSide === 'blue'
                                ? 'bg-for-600/80 border-for-600/50 text-white hover:bg-for-600'
                                : 'bg-against-600/80 border-against-600/50 text-white hover:bg-against-600',
                            )}
                          >
                            {isSubmitting ? '…' : hotTakeText.trim() ? 'Submit & Vote' : 'Vote'}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="vote-button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        onClick={(e) => e.preventDefault()}
                      >
                        <VoteButton
                          topicId={topic.id}
                          bluePct={topic.blue_pct}
                          onVote={handleVoteIntent}
                          disabled={hasVoted(topic.id)}
                          votedSide={votedSide}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Share stance + submitted hot take — appears after voting */}
                  {hasVoted(topic.id) && votedSide && (
                    <div
                      className="space-y-2"
                      onClick={(e) => e.preventDefault()}
                    >
                      <div className="flex justify-center">
                        <StanceShareButton
                          topicId={topic.id}
                          statement={topic.statement}
                          votedSide={votedSide}
                          forPct={topic.blue_pct}
                          totalVotes={topic.total_votes}
                          category={topic.category}
                        />
                      </div>
                      {/* Show submitted hot take as feedback */}
                      {submittedHotTake && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            'flex items-start gap-2 px-3 py-2 rounded-xl border text-[11px] font-mono',
                            votedSide === 'blue'
                              ? 'bg-for-600/10 border-for-600/30 text-for-300'
                              : 'bg-against-600/10 border-against-600/30 text-against-300',
                          )}
                        >
                          <span className="opacity-60 shrink-0 mt-0.5">Your take:</span>
                          <span className="leading-relaxed">&ldquo;{submittedHotTake}&rdquo;</span>
                        </motion.div>
                      )}
                    </div>
                  )}
                  {topic.voting_ends_at && (
                    <div className="flex justify-center">
                      <VoteTimer endsAt={topic.voting_ends_at} />
                    </div>
                  )}
                </>
              )}

              {isProposed && (
                <div
                  className="flex justify-center"
                  onClick={(e) => e.preventDefault()}
                >
                  <SupportButton
                    topicId={topic.id}
                    supportCount={topic.support_count}
                    threshold={topic.activation_threshold}
                    hasSupported={false}
                    onSupport={handleSupport}
                  />
                </div>
              )}

              {isLaw && (
                <div className="flex justify-center">
                  <Badge variant="law" className="text-base px-4 py-1.5">
                    LAW
                  </Badge>
                </div>
              )}

              {/* Reactions row */}
              <div
                className="pt-1"
                onClick={(e) => e.preventDefault()}
              >
                <TopicReactions topicId={topic.id} size="sm" />
              </div>

              {/* Author + view count row */}
              <div className="flex items-center justify-between pt-2 border-t border-surface-300">
                <div className="flex items-center gap-2">
                  <Avatar
                    src={authorAvatar}
                    fallback={authorName || 'U'}
                    size="sm"
                  />
                  <span className="text-sm text-surface-500">
                    {authorName || 'Anonymous'}
                  </span>
                </div>
                <div
                  className="flex items-center gap-1 text-xs text-surface-500"
                  aria-label={`${topic.view_count} views`}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <AnimatedNumber value={topic.view_count} />
                </div>
              </div>

              {/* Swipe affordance hint — only on unvoted active cards with no pending vote */}
              {canSwipeVote && !pendingVoteSide && (
                <div
                  className="flex items-center justify-center gap-2 pb-0.5 select-none pointer-events-none"
                  aria-hidden="true"
                >
                  <ThumbsDown className="h-3 w-3 text-against-500/50" />
                  <span className="text-[10px] font-mono text-surface-600 tracking-widest uppercase">
                    swipe to vote
                  </span>
                  <ThumbsUp className="h-3 w-3 text-for-500/50" />
                </div>
              )}
            </div>
          </Card>
        </Link>
      </motion.div>

      {/* Screen-reader live region: announces vote count changes without visual disruption */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {topic.total_votes > 0
          ? `${topic.total_votes.toLocaleString()} votes cast — ${Math.round(topic.blue_pct)}% agree`
          : 'No votes yet'}
      </div>

      {/* Right-side action rail — outside motion.div so it stays fixed */}
      <div className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-1" aria-hidden="true">
          <span className="text-xs text-surface-500">Votes</span>
          <span className="text-sm font-semibold text-white">
            <AnimatedNumber value={topic.total_votes} />
          </span>
        </div>
        <BookmarkButton topicId={topic.id} />
        <button
          onClick={handleShare}
          className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          aria-label="Share topic"
        >
          <Share2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
