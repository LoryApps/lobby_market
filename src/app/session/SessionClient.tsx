'use client'

/**
 * /session — The Daily Legislative Session
 *
 * Five curated civic topics, hand-picked by the platform each day. Vote on
 * all five to earn a Clout bonus and complete your daily session. Topics are
 * deterministic per day — everyone gets the same five debates.
 *
 * Pick reasons shown on each card:
 *   urgent  — voting closes within 72 h
 *   close   — split is within ±8 % of 50/50
 *   rising  — high feed_score
 *   new     — posted in the last 48 h
 *   active  — consistently active debate
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  LayoutGrid,
  LogIn,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useVoteStore } from '@/lib/stores/vote-store'
import { haptics } from '@/lib/hooks/useHaptics'
import { cn } from '@/lib/utils/cn'
import type { SessionResponse, SessionTopic } from '@/app/api/session/daily/route'

// ─── Pick-reason config ───────────────────────────────────────────────────────

const REASON_META: Record<
  SessionTopic['pick_reason'],
  { label: string; icon: typeof Clock; color: string }
> = {
  urgent:  { label: 'Closing Soon', icon: Clock,      color: 'text-against-400' },
  close:   { label: 'Neck & Neck',  icon: Scale,      color: 'text-purple' },
  rising:  { label: 'Rising Fast',  icon: TrendingUp, color: 'text-gold' },
  new:     { label: 'New Today',    icon: Sparkles,   color: 'text-emerald' },
  active:  { label: 'Active',       icon: Flame,      color: 'text-for-400' },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-emerald',
  Science:     'text-purple',
  Ethics:      'text-against-400',
  Philosophy:  'text-surface-500',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SessionSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
            </div>
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-11 rounded-xl" />
            <Skeleton className="h-11 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function SessionProgress({
  voted,
  total,
  isComplete,
  bonus,
}: {
  voted: number
  total: number
  isComplete: boolean
  bonus: number
}) {
  const pct = total > 0 ? (voted / total) * 100 : 0

  return (
    <div className={cn(
      'rounded-2xl border p-5 transition-colors duration-500',
      isComplete
        ? 'bg-emerald/10 border-emerald/30'
        : 'bg-surface-100 border-surface-300'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
          <Vote className="h-3.5 w-3.5" />
          Session Progress
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-mono font-medium',
          isComplete ? 'text-emerald' : 'text-surface-500'
        )}>
          <Coins className="h-3.5 w-3.5" />
          +{bonus} Clout bonus
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-surface-300 rounded-full overflow-hidden mb-3">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-500',
            isComplete
              ? 'bg-gradient-to-r from-emerald to-emerald/70'
              : 'bg-gradient-to-r from-for-600 to-for-400'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between text-xs font-mono">
        <span className={cn(
          'transition-colors duration-300',
          isComplete ? 'text-emerald font-semibold' : 'text-surface-500'
        )}>
          {isComplete
            ? 'Session complete!'
            : `${voted} of ${total} votes cast`}
        </span>
        <span className="text-surface-600">
          {total - voted > 0 ? `${total - voted} remaining` : 'All done'}
        </span>
      </div>
    </div>
  )
}

// ─── Individual topic card ────────────────────────────────────────────────────

interface TopicCardProps {
  topic: SessionTopic
  index: number
  isAuthenticated: boolean
  onVote: (topicId: string, side: 'blue' | 'red') => void
  votedSide: 'blue' | 'red' | null
  isPending: boolean
}

function SessionTopicCard({
  topic,
  index,
  isAuthenticated,
  onVote,
  votedSide,
  isPending,
}: TopicCardProps) {
  const reason = REASON_META[topic.pick_reason]
  const ReasonIcon = reason.icon
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'
  const hasVoted = votedSide !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className={cn(
        'rounded-2xl border p-5 transition-all duration-300',
        hasVoted
          ? 'bg-surface-100/60 border-surface-300/50'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-4">
        {/* Step number / check */}
        <div className={cn(
          'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold mt-0.5 transition-all duration-300',
          hasVoted
            ? 'bg-emerald/20 text-emerald border border-emerald/30'
            : 'bg-surface-200 text-surface-500 border border-surface-300'
        )}>
          {hasVoted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            {topic.category && (
              <span className={cn('text-[10px] font-mono uppercase tracking-wider font-medium', catColor)}>
                {topic.category}
              </span>
            )}
            <span className="text-surface-600 text-[10px]">·</span>
            <span className={cn('flex items-center gap-1 text-[10px] font-mono', reason.color)}>
              <ReasonIcon className="h-3 w-3" />
              {reason.label}
            </span>
            <span className="text-surface-600 text-[10px]">·</span>
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>

          {/* Statement */}
          <p className={cn(
            'text-sm font-medium leading-snug transition-colors duration-300',
            hasVoted ? 'text-surface-500' : 'text-surface-900'
          )}>
            {topic.statement}
          </p>
        </div>

        {/* External link */}
        <Link
          href={`/topic/${topic.id}`}
          className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          aria-label={`Open full topic: ${topic.statement}`}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Vote bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[10px] font-mono mb-1">
          <span className="text-for-400">{forPct}% FOR</span>
          <span className="text-against-400">{againstPct}% AGAINST</span>
        </div>
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-700"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Vote buttons */}
      {!isAuthenticated ? (
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-for-600/20 border border-for-500/30 text-for-400 text-sm font-medium hover:bg-for-600/30 transition-colors"
        >
          <LogIn className="h-4 w-4" />
          Sign in to vote
        </Link>
      ) : hasVoted ? (
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border',
            votedSide === 'blue'
              ? 'bg-for-600 text-white border-for-600'
              : 'bg-transparent border-surface-300 text-surface-500'
          )}>
            <ThumbsUp className="h-4 w-4" />
            AGREE
          </div>
          <div className={cn(
            'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border',
            votedSide === 'red'
              ? 'bg-against-600 text-white border-against-600'
              : 'bg-transparent border-surface-300 text-surface-500'
          )}>
            <ThumbsDown className="h-4 w-4" />
            DISAGREE
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={isPending}
            onClick={() => onVote(topic.id, 'blue')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600 text-white text-sm font-semibold hover:bg-for-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <ThumbsUp className="h-4 w-4" />
            AGREE
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            disabled={isPending}
            onClick={() => onVote(topic.id, 'red')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-against-600 text-white text-sm font-semibold hover:bg-against-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <ThumbsDown className="h-4 w-4" />
            DISAGREE
          </motion.button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Completion card ──────────────────────────────────────────────────────────

function CompletionCard({
  bonus,
  votedCount,
}: {
  bonus: number
  votedCount: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl bg-emerald/10 border border-emerald/30 p-6 text-center space-y-4"
    >
      <div className="flex items-center justify-center">
        <div className="h-16 w-16 rounded-full bg-emerald/20 border border-emerald/40 flex items-center justify-center">
          <Award className="h-8 w-8 text-emerald" />
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold text-surface-900">Session Complete</h2>
        <p className="text-sm text-surface-500">
          You voted on all {votedCount} topics in today&apos;s session
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-emerald/20 border border-emerald/30 text-emerald font-mono font-semibold">
        <Coins className="h-4 w-4" />
        +{bonus} Clout earned
      </div>

      <p className="text-xs font-mono text-surface-500">
        Next session refreshes at midnight UTC
      </p>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link
          href="/"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-200 text-surface-700 text-sm font-medium hover:bg-surface-300 transition-colors"
        >
          <LayoutGrid className="h-4 w-4" />
          Back to Feed
        </Link>
        <Link
          href="/analytics"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-for-600 text-white text-sm font-medium hover:bg-for-700 transition-colors"
        >
          <BarChart2 className="h-4 w-4" />
          My Analytics
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SessionClient() {
  const router = useRouter()
  const [data, setData] = useState<SessionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localVotes, setLocalVotes] = useState<Record<string, 'blue' | 'red'>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)

  const { castVote, hasVoted: storeHasVoted, getVoteSide } = useVoteStore()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/session/daily')
      if (!res.ok) throw new Error('Failed to load session')
      const json: SessionResponse = await res.json()

      // Seed local votes from server data (already-voted topics)
      const seeds: Record<string, 'blue' | 'red'> = {}
      for (const t of json.topics) {
        if (t.voted && t.vote_side) seeds[t.id] = t.vote_side
      }
      setLocalVotes(seeds)
      setData(json)
    } catch {
      setError('Could not load today\'s session. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleVote = useCallback(async (topicId: string, side: 'blue' | 'red') => {
    if (!data?.is_authenticated) {
      router.push('/login')
      return
    }
    if (pendingId) return

    haptics.voteFor()
    setPendingId(topicId)

    setLocalVotes((prev) => ({ ...prev, [topicId]: side }))

    try {
      await castVote(topicId, side)
    } catch {
      // Revert optimistic on failure
      setLocalVotes((prev) => {
        const copy = { ...prev }
        delete copy[topicId]
        return copy
      })
      haptics.error()
    } finally {
      setPendingId(null)
    }
  }, [data, pendingId, castVote, router])

  // Derived state: how many topics have the user voted on
  const votedCount = data
    ? data.topics.filter((t) => {
        const side = localVotes[t.id] ?? (storeHasVoted(t.id) ? getVoteSide(t.id) : null)
        return !!side
      }).length
    : 0

  const isComplete = data ? votedCount >= data.topics.length && data.topics.length > 0 : false

  // Fire the just-completed animation once
  useEffect(() => {
    if (isComplete && !justCompleted && data && !loading) {
      setJustCompleted(true)
      haptics.milestone()
    }
  }, [isComplete, justCompleted, data, loading])

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-xl mx-auto w-full px-4 pb-28 pt-6">

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-1.5">
            <Gavel className="h-3.5 w-3.5 text-gold" />
            Daily Legislative Session
          </div>
          <h1 className="text-2xl font-bold text-surface-900 mb-1">
            Today&apos;s Session
          </h1>
          {data?.date && (
            <p className="text-sm text-surface-500 font-mono">
              {formatDate(data.date)}
            </p>
          )}
        </div>

        {loading && <SessionSkeleton />}

        {!loading && error && (
          <EmptyState
            icon={<Zap className="h-8 w-8" />}
            title="Session unavailable"
            description={error}
            action={
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-medium hover:bg-for-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            }
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-5">
            {/* Progress bar */}
            <SessionProgress
              voted={votedCount}
              total={data.topics.length}
              isComplete={isComplete}
              bonus={data.session_clout_bonus}
            />

            {/* Completion card */}
            <AnimatePresence>
              {justCompleted && (
                <CompletionCard
                  bonus={data.session_clout_bonus}
                  votedCount={votedCount}
                />
              )}
            </AnimatePresence>

            {/* Topic cards */}
            {data.topics.length === 0 ? (
              <EmptyState
                icon={<Vote className="h-8 w-8" />}
                title="No topics today"
                description="The session queue is empty. Check back tomorrow or browse the main feed."
                action={
                  <Link
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 text-white text-sm font-medium hover:bg-for-700 transition-colors"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Browse Feed
                  </Link>
                }
              />
            ) : (
              data.topics.map((topic, i) => {
                const side =
                  (localVotes[topic.id] as 'blue' | 'red' | undefined) ??
                  (storeHasVoted(topic.id) ? (getVoteSide(topic.id) as 'blue' | 'red' | null) : null)

                return (
                  <SessionTopicCard
                    key={topic.id}
                    topic={topic}
                    index={i}
                    isAuthenticated={data.is_authenticated}
                    onVote={handleVote}
                    votedSide={side}
                    isPending={pendingId === topic.id}
                  />
                )
              })
            )}

            {/* Footer links */}
            <div className="pt-4 pb-2 flex flex-col gap-3">
              <div className="text-xs font-mono text-surface-500 text-center">
                Five topics, refreshed daily at midnight UTC.
                <br />
                Same session for every citizen.
              </div>
              <div className="flex items-center justify-center gap-4 text-xs font-mono">
                <Link href="/swipe" className="text-surface-500 hover:text-surface-300 flex items-center gap-1">
                  Swipe mode <ChevronRight className="h-3 w-3" />
                </Link>
                <span className="text-surface-600">·</span>
                <Link href="/missions" className="text-surface-500 hover:text-surface-300 flex items-center gap-1">
                  Daily missions <ChevronRight className="h-3 w-3" />
                </Link>
                <span className="text-surface-600">·</span>
                <Link href="/analytics" className="text-surface-500 hover:text-surface-300 flex items-center gap-1">
                  Analytics <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
