'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  Flame,
  RotateCcw,
  Scale,
  SkipForward,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { useVoteStore } from '@/lib/stores/vote-store'
import type { BallotResponse, BallotTopic } from '@/app/api/ballot/route'

// ─── Category color map ───────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-for-400 bg-for-400/10 border-for-400/20',
  Politics:    'text-purple bg-purple/10 border-purple/20',
  Technology:  'text-for-300 bg-for-300/10 border-for-300/20',
  Science:     'text-emerald bg-emerald/10 border-emerald/20',
  Ethics:      'text-gold bg-gold/10 border-gold/20',
  Philosophy:  'text-purple bg-purple/10 border-purple/20',
  Culture:     'text-against-300 bg-against-300/10 border-against-300/20',
  Health:      'text-emerald bg-emerald/10 border-emerald/20',
  Environment: 'text-emerald bg-emerald/10 border-emerald/20',
  Education:   'text-for-400 bg-for-400/10 border-for-400/20',
}

const DEFAULT_CATEGORY_COLOR = 'text-surface-600 bg-surface-300/10 border-surface-300/20'

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BallotSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-20 pb-24">
        <div className="mt-8 space-y-6">
          <Skeleton className="h-6 w-48 mx-auto" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 space-y-5">
            <Skeleton className="h-4 w-24 rounded-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-4 pt-2">
              <Skeleton className="flex-1 h-14 rounded-xl" />
              <Skeleton className="flex-1 h-14 rounded-xl" />
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function MiniVoteBar({ bluePct }: { bluePct: number }) {
  const pct = Math.max(1, Math.min(99, Math.round(bluePct)))
  return (
    <div className="flex items-center gap-2 text-xs text-surface-500">
      <span className="text-for-400 font-medium">{pct}%</span>
      <div className="flex-1 h-1.5 rounded-full bg-against-900/50 overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-against-400 font-medium">{100 - pct}%</span>
    </div>
  )
}

// ─── Ballot card ──────────────────────────────────────────────────────────────

interface BallotCardProps {
  topic: BallotTopic
  index: number
  total: number
  onVote: (side: 'blue' | 'red') => void
  onSkip: () => void
  isVoting: boolean
}

function BallotCard({ topic, index, total, onVote, onSkip, isVoting }: BallotCardProps) {
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? DEFAULT_CATEGORY_COLOR

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-surface-500 font-mono tracking-wider">
        <span>BALLOT ITEM {index + 1} OF {total}</span>
        {topic.total_votes > 0 && (
          <span>{topic.total_votes.toLocaleString()} VOTES CAST</span>
        )}
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
        {/* Ballot top strip */}
        <div className="h-1 bg-gradient-to-r from-for-600 via-surface-400 to-against-600" />

        <div className="p-6 md:p-8 space-y-5">
          {/* Category + scope */}
          <div className="flex flex-wrap items-center gap-2">
            {topic.category && (
              <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full border', catColor)}>
                {topic.category.toUpperCase()}
              </span>
            )}
            {topic.scope && topic.scope !== 'Global' && (
              <span className="text-xs text-surface-500 border border-surface-300 px-2.5 py-1 rounded-full">
                {topic.scope.toUpperCase()}
              </span>
            )}
          </div>

          {/* Statement */}
          <h2 className="text-xl md:text-2xl font-bold text-surface-900 leading-snug tracking-tight">
            {topic.statement}
          </h2>

          {/* Description */}
          {topic.description && (
            <p className="text-sm text-surface-600 leading-relaxed line-clamp-3">
              {topic.description}
            </p>
          )}

          {/* Existing vote split */}
          {topic.total_votes > 0 && (
            <div className="pt-1">
              <MiniVoteBar bluePct={topic.blue_pct} />
            </div>
          )}

          {/* Vote buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={isVoting}
              onClick={() => onVote('blue')}
              className={cn(
                'group flex flex-col items-center gap-2 py-4 px-3 rounded-xl',
                'bg-for-950 border-2 border-for-700 text-for-300',
                'hover:bg-for-900 hover:border-for-500 hover:text-for-200',
                'transition-colors font-semibold text-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <ThumbsUp className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
              <span>AGREE</span>
              <span className="text-xs font-normal text-for-500 group-hover:text-for-400">
                Press ←
              </span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={isVoting}
              onClick={() => onVote('red')}
              className={cn(
                'group flex flex-col items-center gap-2 py-4 px-3 rounded-xl',
                'bg-against-950 border-2 border-against-700 text-against-300',
                'hover:bg-against-900 hover:border-against-500 hover:text-against-200',
                'transition-colors font-semibold text-sm',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <ThumbsDown className="h-5 w-5 transition-transform group-hover:translate-y-0.5" />
              <span>DISAGREE</span>
              <span className="text-xs font-normal text-against-500 group-hover:text-against-400">
                Press →
              </span>
            </motion.button>
          </div>

          {/* Skip */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onSkip}
              disabled={isVoting}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-600 transition-colors disabled:opacity-50"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip for now
            </button>
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-600 transition-colors"
            >
              Full debate
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ count, onStart }: { count: number; onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center text-center gap-6 py-8"
    >
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center">
          <Clipboard className="h-9 w-9 text-surface-600" />
        </div>
        {count > 0 && (
          <span className="absolute -top-2 -right-2 h-6 min-w-6 px-1.5 rounded-full bg-for-600 text-white text-xs font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-surface-900 tracking-tight">
          Your Civic Ballot
        </h1>
        <p className="text-surface-500 max-w-xs leading-relaxed">
          {count === 0
            ? "You've voted on everything active right now. Check back soon."
            : `${count} ${count === 1 ? 'debate' : 'debates'} waiting for your vote. Work through them at your own pace.`}
        </p>
      </div>

      {count > 0 && (
        <div className="w-full space-y-3">
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-for-600 hover:bg-for-700 text-white font-semibold transition-colors"
          >
            <Clipboard className="h-4 w-4" />
            Start Voting
          </button>
          <p className="text-xs text-surface-500">
            Keyboard: ← Agree · → Disagree · S to skip
          </p>
        </div>
      )}

      {count === 0 && (
        <Link
          href="/"
          className="flex items-center gap-2 py-3 px-6 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-700 font-semibold transition-colors text-sm"
        >
          Back to feed
        </Link>
      )}
    </motion.div>
  )
}

// ─── Summary screen ───────────────────────────────────────────────────────────

interface SummaryScreenProps {
  forVotes: number
  againstVotes: number
  skipped: number
  onRestart: () => void
}

function SummaryScreen({ forVotes, againstVotes, skipped, onRestart }: SummaryScreenProps) {
  const voted = forVotes + againstVotes
  const agreedPct = voted > 0 ? Math.round((forVotes / voted) * 100) : 50

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center gap-6 py-8"
    >
      <div className="w-20 h-20 rounded-full bg-emerald/10 border border-emerald/30 flex items-center justify-center">
        <ClipboardCheck className="h-9 w-9 text-emerald" />
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-surface-900 tracking-tight">Ballot Complete</h2>
        <p className="text-surface-500">
          You voted on {voted} {voted === 1 ? 'debate' : 'debates'} this session.
        </p>
      </div>

      {/* Stats */}
      <div className="w-full grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-for-950 border border-for-800 p-4">
          <div className="text-2xl font-bold text-for-300">{forVotes}</div>
          <div className="text-xs text-for-500 mt-0.5">AGREED</div>
        </div>
        <div className="rounded-xl bg-against-950 border border-against-800 p-4">
          <div className="text-2xl font-bold text-against-300">{againstVotes}</div>
          <div className="text-xs text-against-500 mt-0.5">DISAGREED</div>
        </div>
        <div className="rounded-xl bg-surface-200 border border-surface-300 p-4">
          <div className="text-2xl font-bold text-surface-600">{skipped}</div>
          <div className="text-xs text-surface-500 mt-0.5">SKIPPED</div>
        </div>
      </div>

      {/* Alignment */}
      {voted > 0 && (
        <div className="w-full rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <div className="text-xs text-surface-500 font-mono tracking-wider">YOUR ALIGNMENT TODAY</div>
          <div className="flex items-center gap-3">
            <span className="text-for-400 text-sm font-semibold w-12 text-right">{agreedPct}%</span>
            <div className="flex-1 h-2 rounded-full bg-against-900/40 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-500 rounded-full transition-all"
                style={{ width: `${agreedPct}%` }}
              />
            </div>
            <span className="text-against-400 text-sm font-semibold w-12">{100 - agreedPct}%</span>
          </div>
          <div className="flex justify-between text-xs text-surface-500">
            <span>Agree</span>
            <span>Disagree</span>
          </div>
        </div>
      )}

      {/* CTA row */}
      <div className="w-full grid grid-cols-2 gap-3">
        <button
          onClick={onRestart}
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-surface-700 font-semibold text-sm transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Vote more
        </button>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600 hover:bg-for-700 text-white font-semibold text-sm transition-colors"
        >
          <Flame className="h-4 w-4" />
          Feed
        </Link>
      </div>

      <div className="flex gap-4 text-sm">
        <Link href="/leaderboard" className="text-surface-500 hover:text-surface-600 transition-colors flex items-center gap-1">
          <Trophy className="h-3.5 w-3.5" />
          Leaderboard
        </Link>
        <Link href="/stats" className="text-surface-500 hover:text-surface-600 transition-colors flex items-center gap-1">
          <Scale className="h-3.5 w-3.5" />
          My stats
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Screen = 'welcome' | 'voting' | 'summary'

export function BallotClient() {
  const [topics, setTopics] = useState<BallotTopic[]>([])
  const [queue, setQueue] = useState<BallotTopic[]>([])
  const [skipped, setSkipped] = useState<BallotTopic[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [screen, setScreen] = useState<Screen>('welcome')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isVoting, setIsVoting] = useState(false)
  const [forVotes, setForVotes] = useState(0)
  const [againstVotes, setAgainstVotes] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [direction, setDirection] = useState<'left' | 'right'>('left')
  const [authenticated, setAuthenticated] = useState(true)

  const { castVote } = useVoteStore()

  // ── Fetch ballot topics ────────────────────────────────────────────────────

  const fetchTopics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ballot', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load ballot')
      const data: BallotResponse = await res.json()
      setTopics(data.topics)
      setQueue(data.topics)
      setAuthenticated(data.authenticated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    if (screen !== 'voting') return

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (isVoting) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleVote('blue')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleVote('red')
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        handleSkip()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, isVoting, currentIndex, queue])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const currentTopic = queue[currentIndex]
  const totalInSession = queue.length + skippedCount

  const handleStart = () => {
    setForVotes(0)
    setAgainstVotes(0)
    setSkippedCount(0)
    setCurrentIndex(0)
    setSkipped([])
    setQueue(topics)
    setScreen('voting')
  }

  const advance = () => {
    const nextIndex = currentIndex + 1
    if (nextIndex >= queue.length) {
      // If we have skipped items, append them to the end of the queue
      if (skipped.length > 0) {
        setQueue((prev) => [...prev, ...skipped])
        setSkipped([])
        setCurrentIndex(nextIndex)
      } else {
        setScreen('summary')
      }
    } else {
      setCurrentIndex(nextIndex)
    }
  }

  const handleVote = async (side: 'blue' | 'red') => {
    if (!currentTopic || isVoting) return
    if (!authenticated) {
      window.location.href = '/login'
      return
    }

    setIsVoting(true)
    setDirection(side === 'blue' ? 'left' : 'right')

    try {
      await castVote(currentTopic.id, side)
      if (side === 'blue') setForVotes((v) => v + 1)
      else setAgainstVotes((v) => v + 1)
    } catch {
      // vote-store handles errors; still advance
    }

    setIsVoting(false)
    advance()
  }

  const handleSkip = () => {
    if (!currentTopic || isVoting) return
    setSkippedCount((c) => c + 1)
    setSkipped((prev) => [...prev, currentTopic])
    // Remove from queue and don't count toward current index shift
    setQueue((prev) => prev.filter((_, i) => i !== currentIndex))
    // Don't increment index — the item at currentIndex is now the next one
    // But if we're at the end, check for summary
    if (currentIndex >= queue.length - 1) {
      if (skipped.length > 0) {
        setQueue((prev) => [...prev, ...skipped])
        setSkipped([])
      } else {
        setScreen('summary')
      }
    }
  }

  const handleRestart = async () => {
    await fetchTopics()
    setScreen('welcome')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <BallotSkeleton />

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 pt-20 pb-24 flex flex-col items-center gap-4 py-16">
          <X className="h-8 w-8 text-against-500" />
          <p className="text-surface-600">{error}</p>
          <button
            onClick={fetchTopics}
            className="py-2 px-5 rounded-lg bg-surface-200 text-surface-700 text-sm hover:bg-surface-300 transition-colors"
          >
            Try again
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const progress = screen === 'voting' && totalInSession > 0
    ? ((forVotes + againstVotes + skippedCount) / totalInSession) * 100
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-16 pb-28">
        {/* Back link */}
        <div className="mt-4 mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to feed
          </Link>
        </div>

        <AnimatePresence mode="wait">
          {screen === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WelcomeScreen count={topics.length} onStart={handleStart} />
            </motion.div>
          )}

          {screen === 'voting' && currentTopic && (
            <motion.div
              key={`topic-${currentTopic.id}`}
              initial={{ opacity: 0, x: direction === 'left' ? 60 : -60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction === 'left' ? -60 : 60 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            >
              {/* Progress */}
              <div className="mb-5 space-y-1.5">
                <div className="flex justify-between text-xs text-surface-500 font-mono">
                  <span>{forVotes + againstVotes + skippedCount} / {totalInSession} complete</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    className="h-full bg-for-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>

              <BallotCard
                topic={currentTopic}
                index={forVotes + againstVotes + skippedCount}
                total={totalInSession}
                onVote={handleVote}
                onSkip={handleSkip}
                isVoting={isVoting}
              />

              {/* Auth nudge */}
              {!authenticated && (
                <p className="mt-4 text-center text-sm text-surface-500">
                  <Link href="/login" className="text-for-400 hover:text-for-300 underline underline-offset-2">
                    Sign in
                  </Link>{' '}
                  to cast your votes and earn clout.
                </p>
              )}
            </motion.div>
          )}

          {screen === 'summary' && (
            <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SummaryScreen
                forVotes={forVotes}
                againstVotes={againstVotes}
                skipped={skippedCount}
                onRestart={handleRestart}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
