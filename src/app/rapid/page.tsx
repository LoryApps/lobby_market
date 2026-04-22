'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flame,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { RapidTopic, RapidResponse } from '@/app/api/rapid/route'

// Pixels of horizontal drag required to commit a swipe vote
const SWIPE_THRESHOLD = 80

// ─── Category colour map ──────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Ethics:      { text: 'text-against-300',   bg: 'bg-against-500/10',  border: 'border-against-500/20' },
  Philosophy:  { text: 'text-for-300',       bg: 'bg-for-400/10',      border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
  Health:      { text: 'text-against-300',   bg: 'bg-against-400/10',  border: 'border-against-400/20' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Education:   { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
}

function categoryColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

// ─── Status badge map ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Vote state per card ──────────────────────────────────────────────────────

type VoteState = 'idle' | 'voting' | 'voted_for' | 'voted_against' | 'error'

// ─── Card flip component ──────────────────────────────────────────────────────

interface TopicCardProps {
  topic: RapidTopic
  onVote: (side: 'blue' | 'red') => Promise<{ blue_pct: number; total_votes: number } | null>
  onNext: () => void
  isAuthenticated: boolean
}

function TopicCard({ topic, onVote, onNext, isAuthenticated }: TopicCardProps) {
  const [voteState, setVoteState] = useState<VoteState>('idle')
  const [chosenSide, setChosenSide] = useState<'blue' | 'red' | null>(null)
  const [resultPct, setResultPct] = useState<number>(topic.blue_pct)
  const [resultVotes, setResultVotes] = useState<number>(topic.total_votes)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drag state for swipe-to-vote
  const dragX = useMotionValue(0)
  const cardRotate = useTransform(dragX, [-120, 0, 120], [-8, 0, 8])
  const forOverlayOpacity = useTransform(dragX, [0, SWIPE_THRESHOLD], [0, 1])
  const againstOverlayOpacity = useTransform(dragX, [-SWIPE_THRESHOLD, 0], [1, 0])

  const colors = categoryColor(topic.category)
  const statusBadge = STATUS_BADGE[topic.status] ?? 'proposed'
  const canSwipe = voteState === 'idle' && isAuthenticated

  async function handleVote(side: 'blue' | 'red') {
    if (voteState !== 'idle' || !isAuthenticated) return
    setVoteState('voting')
    setChosenSide(side)

    const result = await onVote(side)

    if (result) {
      setResultPct(result.blue_pct)
      setResultVotes(result.total_votes)
      setVoteState(side === 'blue' ? 'voted_for' : 'voted_against')
    } else {
      setVoteState('error')
    }

    // Auto-advance to next card after 2 seconds
    autoAdvanceRef.current = setTimeout(onNext, 2000)
  }

  function handleDragEnd(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const offset = info.offset.x
    if (offset > SWIPE_THRESHOLD) {
      handleVote('blue')
    } else if (offset < -SWIPE_THRESHOLD) {
      handleVote('red')
    }
    // Spring back if threshold not met — Framer handles this via dragConstraints
    dragX.set(0)
  }

  useEffect(() => {
    return () => {
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
    }
  }, [])

  const voted = voteState === 'voted_for' || voteState === 'voted_against'
  const forPct  = Math.round(resultPct)
  const agPct   = 100 - forPct

  return (
    <div className="relative w-full max-w-md mx-auto flex flex-col h-full min-h-0">
      {/* Card body — draggable when idle and authenticated */}
      <motion.div
        layout
        style={{ rotate: cardRotate, x: dragX }}
        drag={canSwipe ? 'x' : false}
        dragDirectionLock
        dragElastic={{ left: 0.18, right: 0.18 }}
        dragConstraints={{ left: 0, right: 0 }}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        className={cn(
          'flex-1 flex flex-col rounded-3xl border overflow-hidden relative',
          'bg-surface-100 shadow-2xl shadow-black/60',
          canSwipe && 'cursor-grab active:cursor-grabbing touch-none',
          voted
            ? chosenSide === 'blue'
              ? 'border-for-500/50'
              : 'border-against-500/50'
            : 'border-surface-300'
        )}
      >
        {/* FOR swipe overlay (drag right) */}
        {canSwipe && (
          <motion.div
            style={{ opacity: forOverlayOpacity }}
            className="absolute inset-0 rounded-3xl bg-for-500/20 border-2 border-for-500/60 z-10 pointer-events-none flex items-center justify-end pr-8"
          >
            <div className="flex flex-col items-center gap-1">
              <ThumbsUp className="h-10 w-10 text-for-400 drop-shadow-lg" aria-hidden="true" />
              <span className="text-xs font-mono font-bold text-for-300 uppercase tracking-widest">FOR</span>
            </div>
          </motion.div>
        )}

        {/* AGAINST swipe overlay (drag left) */}
        {canSwipe && (
          <motion.div
            style={{ opacity: againstOverlayOpacity }}
            className="absolute inset-0 rounded-3xl bg-against-500/20 border-2 border-against-500/60 z-10 pointer-events-none flex items-center justify-start pl-8"
          >
            <div className="flex flex-col items-center gap-1">
              <ThumbsDown className="h-10 w-10 text-against-400 drop-shadow-lg" aria-hidden="true" />
              <span className="text-xs font-mono font-bold text-against-300 uppercase tracking-widest">AGAINST</span>
            </div>
          </motion.div>
        )}

        {/* Header strip */}
        <div className={cn('px-5 pt-5 pb-3 flex items-start justify-between gap-3', colors.bg)}>
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', colors.text)}>
                {topic.category}
              </span>
            )}
            <Badge variant={statusBadge}>
              {topic.status === 'voting' ? 'Voting' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
            </Badge>
          </div>
          <Link
            href={`/topic/${topic.id}`}
            className="flex-shrink-0 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            aria-label="View full topic"
            draggable={false}
          >
            Full debate
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Topic statement */}
        <div className="flex-1 flex items-center px-5 py-6">
          <p className="text-xl sm:text-2xl font-semibold text-white leading-snug select-none">
            {topic.statement}
          </p>
        </div>

        {/* Swipe hint — only shown before first interaction */}
        {canSwipe && (
          <div className="px-5 pb-2 flex items-center justify-center gap-3 text-[10px] font-mono text-surface-600 select-none">
            <span className="flex items-center gap-1">
              <ThumbsDown className="h-2.5 w-2.5 text-against-600" aria-hidden="true" />
              swipe left
            </span>
            <span className="h-3 w-px bg-surface-600" />
            <span className="flex items-center gap-1">
              swipe right
              <ThumbsUp className="h-2.5 w-2.5 text-for-600" aria-hidden="true" />
            </span>
          </div>
        )}

        {/* Result bar — shown after voting */}
        <AnimatePresence>
          {voted && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-5 pb-4"
            >
              {/* Split bar */}
              <div className="flex h-2 rounded-full overflow-hidden mb-2">
                <motion.div
                  className="bg-for-500 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${forPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
                <motion.div
                  className="bg-against-500 h-full flex-1"
                  initial={{ width: 0 }}
                  animate={{ width: `${agPct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono">
                <span className="text-for-400 font-semibold">{forPct}% FOR</span>
                <span className="text-surface-500">{resultVotes.toLocaleString()} votes</span>
                <span className="text-against-400 font-semibold">{agPct}% AGAINST</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vote buttons */}
        <div className="px-4 pb-5 flex gap-3">
          {voted ? (
            // Post-vote: big Next button
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onNext}
              className={cn(
                'flex-1 h-14 rounded-2xl flex items-center justify-center gap-2',
                'text-sm font-semibold transition-colors',
                chosenSide === 'blue'
                  ? 'bg-for-600/20 border border-for-500/40 text-for-400'
                  : 'bg-against-600/20 border border-against-500/40 text-against-400'
              )}
            >
              <Check className="h-4 w-4" />
              Voted · Next
            </motion.button>
          ) : (
            <>
              {/* AGAINST */}
              <button
                onClick={() => handleVote('red')}
                disabled={voteState === 'voting' || !isAuthenticated}
                aria-label="Vote AGAINST"
                className={cn(
                  'flex-1 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5',
                  'border-2 transition-all active:scale-95 font-semibold text-sm',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'bg-against-950/60 border-against-600 text-against-400',
                  'hover:bg-against-900/60 hover:border-against-500',
                )}
              >
                {voteState === 'voting' && chosenSide === 'red' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ThumbsDown className="h-5 w-5" />
                    <span className="text-[10px] font-mono uppercase tracking-wide">Against</span>
                  </>
                )}
              </button>

              {/* FOR */}
              <button
                onClick={() => handleVote('blue')}
                disabled={voteState === 'voting' || !isAuthenticated}
                aria-label="Vote FOR"
                className={cn(
                  'flex-1 h-14 rounded-2xl flex flex-col items-center justify-center gap-0.5',
                  'border-2 transition-all active:scale-95 font-semibold text-sm',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  'bg-for-950/60 border-for-600 text-for-400',
                  'hover:bg-for-900/60 hover:border-for-500',
                )}
              >
                {voteState === 'voting' && chosenSide === 'blue' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ThumbsUp className="h-5 w-5" />
                    <span className="text-[10px] font-mono uppercase tracking-wide">For</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>

        {/* Auth nudge */}
        {!isAuthenticated && (
          <div className="px-4 pb-4 -mt-2">
            <Link
              href="/login"
              className="block text-center text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Sign in to cast real votes →
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Done screen ──────────────────────────────────────────────────────────────

function DoneScreen({ votedCount, onRefresh, loading }: { votedCount: number; onRefresh: () => void; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6"
    >
      <div className="flex items-center justify-center h-20 w-20 rounded-3xl bg-for-500/10 border border-for-500/30">
        <Flame className="h-10 w-10 text-for-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Queue cleared</h2>
        <p className="text-surface-500 text-sm">
          You cast <span className="text-white font-semibold">{votedCount}</span> vote{votedCount !== 1 ? 's' : ''} this session.
        </p>
        <p className="text-surface-600 text-xs mt-1">Check back later for new topics.</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onRefresh}
          disabled={loading}
          className={cn(
            'w-full h-12 rounded-xl flex items-center justify-center gap-2',
            'bg-for-600 text-white font-semibold text-sm',
            'hover:bg-for-700 transition-colors disabled:opacity-50'
          )}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Try again
        </button>
        <Link
          href="/"
          className="w-full h-12 rounded-xl flex items-center justify-center gap-2 bg-surface-200 text-surface-700 hover:bg-surface-300 hover:text-white font-semibold text-sm transition-colors"
        >
          Back to feed
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RapidPage() {
  const [topics, setTopics] = useState<RapidTopic[]>([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [sessionVotes, setSessionVotes] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)

  const fetchTopics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/rapid?limit=15')
      if (!res.ok) throw new Error('fetch failed')
      const data = (await res.json()) as RapidResponse
      setTopics(data.topics)
      setAuthenticated(data.authenticated)
      setIndex(0)
    } catch {
      // leave state as-is
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  async function handleVote(side: 'blue' | 'red'): Promise<{ blue_pct: number; total_votes: number } | null> {
    const topic = topics[index]
    if (!topic) return null

    try {
      const res = await fetch(`/api/topics/${topic.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      })
      if (!res.ok) return null
      const data = await res.json() as { topic: { blue_pct: number; total_votes: number } }
      setSessionVotes((n) => n + 1)
      return { blue_pct: data.topic?.blue_pct ?? topic.blue_pct, total_votes: data.topic?.total_votes ?? topic.total_votes }
    } catch {
      return null
    }
  }

  function handleNext() {
    setDirection(1)
    setIndex((i) => i + 1)
  }

  const currentTopic = topics[index]
  const isFinished = !loading && (!currentTopic)
  const progress = topics.length > 0 ? Math.min(index / topics.length, 1) : 0

  return (
    <div className="flex flex-col h-[100dvh] bg-surface-50">
      <TopBar />

      {/* Sub-header */}
      <div className="flex-shrink-0 border-b border-surface-300 bg-surface-100 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            aria-label="Back to feed"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-gold" aria-hidden="true" />
            <span className="text-sm font-semibold text-white">Rapid Fire</span>
          </div>
        </div>

        {/* Session vote counter */}
        <div className="flex items-center gap-2">
          {sessionVotes > 0 && (
            <span className="text-xs font-mono text-gold font-semibold">
              {sessionVotes} cast
            </span>
          )}
          {topics.length > 0 && !isFinished && (
            <span className="text-xs font-mono text-surface-500">
              {index + 1} / {topics.length}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 h-0.5 bg-surface-300">
        <motion.div
          className="h-full bg-for-500"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-0 px-4 py-4 pb-20">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 text-surface-500 animate-spin" />
          </div>
        ) : isFinished ? (
          <DoneScreen
            votedCount={sessionVotes}
            onRefresh={fetchTopics}
            loading={loading}
          />
        ) : (
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentTopic.id}
              custom={direction}
              initial={{ opacity: 0, x: direction * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -60 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              className="flex-1 flex flex-col min-h-0"
            >
              <TopicCard
                topic={currentTopic}
                onVote={handleVote}
                onNext={handleNext}
                isAuthenticated={authenticated}
              />
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      {/* Skip button — only show when card hasn't been voted yet */}
      {!loading && !isFinished && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 flex justify-center pb-2 pointer-events-none">
          <button
            onClick={handleNext}
            className="pointer-events-auto text-xs font-mono text-surface-600 hover:text-surface-400 transition-colors px-3 py-1"
          >
            Skip →
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
