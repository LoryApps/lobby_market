'use client'

/**
 * /roulette — Topic Roulette
 *
 * Serves a random active/proposed topic the user hasn't voted on yet.
 * After voting (or skipping) the user can spin for another.
 * Client-side deduplication avoids showing the same topic twice per session.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronRight,
  Dices,
  Loader2,
  RefreshCw,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { VoteBar } from '@/components/voting/VoteBar'
import { useVoteStore } from '@/lib/stores/vote-store'
import { cn } from '@/lib/utils/cn'
import { haptics } from '@/lib/hooks/useHaptics'
import type { VoteSide } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RandomTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  blue_votes: number
  red_votes: number
  scope: string | null
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Spin animation variants ──────────────────────────────────────────────────

const cardVariants = {
  enter: { opacity: 0, y: 32, scale: 0.96 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -24, scale: 0.97 },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RouletteClient() {
  const [topic, setTopic] = useState<RandomTopic | null>(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const [votedThisCard, setVotedThisCard] = useState<VoteSide | null>(null)
  const [sessionVotes, setSessionVotes] = useState(0)
  const [sessionSkips, setSessionSkips] = useState(0)
  const [direction, setDirection] = useState<'skip' | 'vote'>('skip')

  const seenRef = useRef<Set<string>>(new Set())
  const { castVote } = useVoteStore()

  const fetchNext = useCallback(async (isSkip = false) => {
    setSpinning(true)
    setDirection(isSkip ? 'skip' : 'vote')

    const excludeList = Array.from(seenRef.current).join(',')
    const url = `/api/topics/random${excludeList ? `?exclude=${encodeURIComponent(excludeList)}` : ''}`

    try {
      const res = await fetch(url, { cache: 'no-store' })
      const data = await res.json() as { topic: RandomTopic | null; exhausted?: boolean }

      if (data.exhausted || !data.topic) {
        setExhausted(true)
        setTopic(null)
      } else {
        seenRef.current.add(data.topic.id)
        setTopic(data.topic)
        setVotedThisCard(null)
        setExhausted(false)
      }
    } catch {
      // Network error — keep existing topic
    } finally {
      setSpinning(false)
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchNext()
  }, [fetchNext])

  const handleVote = useCallback(async (side: VoteSide) => {
    if (!topic || votedThisCard) return
    if (side === 'blue') haptics.voteFor()
    else haptics.voteAgainst()
    setVotedThisCard(side)
    setSessionVotes((n) => n + 1)
    await castVote(topic.id, side)
  }, [topic, votedThisCard, castVote])

  const handleSkip = useCallback(() => {
    if (spinning) return
    haptics.light()
    setSessionSkips((n) => n + 1)
    fetchNext(true)
  }, [spinning, fetchNext])

  const handleNext = useCallback(() => {
    if (spinning) return
    haptics.light()
    fetchNext(false)
  }, [spinning, fetchNext])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
            <Dices className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Topic Roulette</h1>
            <p className="text-sm font-mono text-surface-500">Discover debates you haven&apos;t seen yet</p>
          </div>
        </div>

        {/* Session stats */}
        {(sessionVotes > 0 || sessionSkips > 0) && (
          <div className="flex items-center gap-4 mb-5 px-1">
            {sessionVotes > 0 && (
              <div className="flex items-center gap-1.5 text-sm font-mono text-surface-400">
                <Trophy className="h-4 w-4 text-gold" />
                <span className="text-white font-medium">{sessionVotes}</span> voted
              </div>
            )}
            {sessionSkips > 0 && (
              <div className="flex items-center gap-1.5 text-sm font-mono text-surface-400">
                <SkipForward className="h-4 w-4" />
                <span className="text-white font-medium">{sessionSkips}</span> skipped
              </div>
            )}
          </div>
        )}

        {/* Card area */}
        <div className="relative min-h-[340px] flex items-start">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex flex-col items-center justify-center gap-4 py-24"
              >
                <Dices className="h-10 w-10 text-purple animate-pulse" />
                <p className="text-sm font-mono text-surface-500">Finding a topic for you…</p>
              </motion.div>
            ) : exhausted ? (
              <motion.div
                key="exhausted"
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="w-full"
              >
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-8 text-center">
                  <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-gold/10 border border-gold/30 mx-auto mb-4">
                    <Trophy className="h-6 w-6 text-gold" />
                  </div>
                  <h2 className="font-mono text-xl font-bold text-white mb-2">You&apos;ve seen them all!</h2>
                  <p className="text-sm font-mono text-surface-500 mb-6">
                    You&apos;ve discovered every active debate in this session.
                    New topics are added daily — check back soon.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        seenRef.current.clear()
                        setExhausted(false)
                        setLoading(true)
                        fetchNext()
                      }}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-for-600 hover:bg-for-700 text-white font-mono text-sm font-semibold transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Start over
                    </button>
                    <Link
                      href="/"
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-white font-mono text-sm transition-colors"
                    >
                      Go to feed
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ) : topic ? (
              <motion.div
                key={topic.id}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="w-full"
              >
                <TopicCard
                  topic={topic}
                  votedSide={votedThisCard}
                  spinning={spinning}
                  onVote={handleVote}
                  onSkip={handleSkip}
                  onNext={handleNext}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Spinning overlay */}
          <AnimatePresence>
            {spinning && !loading && (
              <motion.div
                key="spinner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-surface-50/60 backdrop-blur-sm rounded-2xl z-10"
              >
                <div className="flex flex-col items-center gap-3">
                  <Dices className="h-8 w-8 text-purple animate-spin" />
                  <p className="text-xs font-mono text-surface-400">
                    {direction === 'skip' ? 'Finding next topic…' : 'Loading another…'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer hint */}
        {!loading && !exhausted && (
          <p className="text-center text-[11px] font-mono text-surface-600 mt-6">
            Topics are filtered to ones you haven&apos;t voted on yet.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  votedSide,
  spinning,
  onVote,
  onSkip,
  onNext,
}: {
  topic: RandomTopic
  votedSide: VoteSide | null
  spinning: boolean
  onVote: (side: VoteSide) => void
  onSkip: () => void
  onNext: () => void
}) {
  const hasVoted = votedSide !== null

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden">
      {/* Topic header */}
      <div className="px-5 pt-5 pb-4">
        {/* Meta row */}
        <div className="flex items-center gap-2 mb-3">
          {topic.category && (
            <span className="text-[11px] font-mono text-surface-500 bg-surface-200/60 border border-surface-300/60 px-2 py-0.5 rounded-full">
              {topic.category}
            </span>
          )}
          {topic.scope && topic.scope !== 'Global' && (
            <span className="text-[11px] font-mono text-surface-600 bg-surface-200/40 border border-surface-300/40 px-2 py-0.5 rounded-full">
              {topic.scope}
            </span>
          )}
          <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="ml-auto text-[10px]">
            {STATUS_LABEL[topic.status] ?? topic.status}
          </Badge>
        </div>

        {/* Statement */}
        <p className="font-mono text-base font-semibold text-white leading-snug">
          {topic.statement}
        </p>

        {/* Description */}
        {topic.description && (
          <p className="mt-2 text-sm font-mono text-surface-400 leading-relaxed line-clamp-2">
            {topic.description}
          </p>
        )}
      </div>

      {/* Vote bar */}
      <div className="px-5 pb-3">
        <VoteBar bluePct={topic.blue_pct} totalVotes={topic.total_votes} showLabels />
      </div>

      {/* Voted confirmation */}
      <AnimatePresence>
        {hasVoted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'mx-5 mb-3 px-4 py-3 rounded-xl border flex items-center gap-3',
              votedSide === 'blue'
                ? 'bg-for-500/10 border-for-500/30'
                : 'bg-against-500/10 border-against-500/30',
            )}>
              {votedSide === 'blue' ? (
                <ThumbsUp className="h-4 w-4 text-for-400 shrink-0" />
              ) : (
                <ThumbsDown className="h-4 w-4 text-against-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-xs font-mono font-semibold',
                  votedSide === 'blue' ? 'text-for-400' : 'text-against-400',
                )}>
                  Voted {votedSide === 'blue' ? 'FOR' : 'AGAINST'}
                </p>
                <p className="text-[11px] font-mono text-surface-500 mt-0.5">Vote recorded</p>
              </div>
              <Link
                href={`/topic/${topic.id}`}
                className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors shrink-0"
              >
                View topic <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className="border-t border-surface-200/50" />

      {/* Action area */}
      {!hasVoted ? (
        <div className="p-4 space-y-3">
          {/* Vote buttons */}
          <div className="flex gap-3" role="group" aria-label="Cast your vote">
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={spinning}
              onClick={() => onVote('blue')}
              aria-label="Vote FOR this topic"
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-semibold text-sm',
                'bg-for-600 hover:bg-for-700 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
              )}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              FOR
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              disabled={spinning}
              onClick={() => onVote('red')}
              aria-label="Vote AGAINST this topic"
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-semibold text-sm',
                'bg-against-600 hover:bg-against-700 text-white',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors',
              )}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              AGAINST
            </motion.button>
          </div>

          {/* Skip */}
          <button
            disabled={spinning}
            onClick={onSkip}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl',
              'font-mono text-sm text-surface-500 hover:text-white',
              'bg-transparent hover:bg-surface-200 border border-surface-300 hover:border-surface-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors',
            )}
          >
            {spinning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SkipForward className="h-4 w-4" />
            )}
            Skip topic
          </button>
        </div>
      ) : (
        <div className="p-4 flex gap-3">
          <button
            disabled={spinning}
            onClick={onNext}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl',
              'font-mono font-semibold text-sm',
              'bg-purple/20 hover:bg-purple/30 border border-purple/40 text-purple',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors',
            )}
          >
            {spinning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Next topic
          </button>
        </div>
      )}
    </div>
  )
}
