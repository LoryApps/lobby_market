'use client'

/**
 * /session/weekly — The Weekly Civic Summit
 *
 * Ten curated civic topics, refreshed every Monday. Vote on all ten to earn
 * a 75-Clout Summit bonus. Topics are deterministic per ISO week — every
 * citizen sees the same ten debates. Distinct from:
 *   /session       — 5 topics, daily (quick daily duty)
 *   /blitz         — 60-second timed sprint
 *   /swipe         — unlimited, no structure
 *
 * Pick reasons:
 *   week_top  — highest vote engagement this week
 *   contested — split within ±15% of 50/50
 *   near_law  — strong FOR majority, approaching law threshold
 *   viral     — highest feed_score momentum
 *   new_law   — became law this week (reflect on what passed)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
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
  Trophy,
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
import type { WeeklySummitResponse, WeeklySummitTopic } from '@/app/api/session/weekly/route'

// ─── Pick-reason config ───────────────────────────────────────────────────────

const REASON_META: Record<
  WeeklySummitTopic['pick_reason'],
  { label: string; icon: typeof Flame; color: string }
> = {
  week_top:  { label: "Week's Best",   icon: Trophy,     color: 'text-gold' },
  contested: { label: 'Neck & Neck',   icon: Scale,      color: 'text-purple' },
  near_law:  { label: 'Near Law',      icon: Gavel,      color: 'text-emerald' },
  viral:     { label: 'Trending',      icon: TrendingUp, color: 'text-for-400' },
  new_law:   { label: 'New Law',       icon: Sparkles,   color: 'text-gold' },
  diverse:   { label: 'Diverse Pick',  icon: Flame,      color: 'text-against-400' },
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

function formatWeek(weekStart: string, weekEnd: string): string {
  const s = new Date(weekStart + 'T00:00:00Z')
  const e = new Date(weekEnd + 'T00:00:00Z')
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return `${fmt(s)} – ${fmt(e)}`
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SummitSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
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

function SummitProgress({
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
        ? 'bg-gold/10 border-gold/30'
        : 'bg-surface-100 border-surface-300',
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
          <Trophy className="h-3.5 w-3.5 text-gold" />
          Weekly Summit Progress
        </div>
        <div className={cn(
          'flex items-center gap-1.5 text-xs font-mono font-medium',
          isComplete ? 'text-gold' : 'text-surface-500',
        )}>
          <Coins className="h-3.5 w-3.5" />
          +{bonus} Clout
        </div>
      </div>

      <div className="h-2 bg-surface-300 rounded-full overflow-hidden mb-3">
        <motion.div
          className={cn(
            'h-full rounded-full transition-colors duration-500',
            isComplete
              ? 'bg-gradient-to-r from-gold to-gold/70'
              : 'bg-gradient-to-r from-for-600 to-for-400',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-3">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-1 rounded-full transition-all duration-300',
              i < voted
                ? isComplete ? 'bg-gold' : 'bg-for-500'
                : 'bg-surface-300',
            )}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs font-mono">
        <span className={cn(
          'transition-colors duration-300',
          isComplete ? 'text-gold font-semibold' : 'text-surface-500',
        )}>
          {isComplete
            ? 'Summit complete!'
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
  topic: WeeklySummitTopic
  index: number
  isAuthenticated: boolean
  onVote: (topicId: string, side: 'blue' | 'red') => void
  votedSide: 'blue' | 'red' | null
  isPending: boolean
}

function SummitTopicCard({
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
      transition={{ duration: 0.3, delay: Math.min(index, 4) * 0.06 }}
      className={cn(
        'rounded-2xl border p-5 transition-all duration-300',
        hasVoted
          ? 'bg-surface-100/60 border-surface-300/50'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-4">
        {/* Step number / check */}
        <div className={cn(
          'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold mt-0.5 transition-all duration-300',
          hasVoted
            ? 'bg-gold/20 text-gold border border-gold/30'
            : 'bg-surface-200 text-surface-500 border border-surface-300',
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
            hasVoted ? 'text-surface-500' : 'text-surface-900',
          )}>
            {topic.statement}
          </p>
        </div>

        {/* External link */}
        <Link
          href={`/topic/${topic.id}`}
          className="flex-shrink-0 h-7 w-7 flex items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          aria-label={`Open full debate: ${topic.statement}`}
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
              : 'bg-transparent border-surface-300 text-surface-500',
          )}>
            <ThumbsUp className="h-4 w-4" />
            AGREE
          </div>
          <div className={cn(
            'flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border',
            votedSide === 'red'
              ? 'bg-against-600 text-white border-against-600'
              : 'bg-transparent border-surface-300 text-surface-500',
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

function CompletionCard({ bonus }: { bonus: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl bg-gold/10 border border-gold/30 p-6 text-center space-y-4"
    >
      <div className="flex items-center justify-center">
        <div className="h-16 w-16 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
          <Trophy className="h-8 w-8 text-gold" />
        </div>
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-bold text-surface-900">Weekly Summit Complete</h2>
        <p className="text-sm text-surface-500">
          You&apos;ve cast all 10 votes in this week&apos;s summit
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gold/20 border border-gold/30 text-gold font-mono font-semibold">
        <Coins className="h-4 w-4" />
        +{bonus} Summit Clout earned
      </div>

      <p className="text-xs font-mono text-surface-500">
        Next summit refreshes every Monday at midnight UTC
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
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gold text-surface-50 text-sm font-medium hover:bg-gold/90 transition-colors"
        >
          <BarChart2 className="h-4 w-4" />
          My Analytics
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WeeklySummitClient() {
  const router = useRouter()
  const [data, setData] = useState<WeeklySummitResponse | null>(null)
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
      const res = await fetch('/api/session/weekly')
      if (!res.ok) throw new Error('Failed to load summit')
      const json: WeeklySummitResponse = await res.json()

      const seeds: Record<string, 'blue' | 'red'> = {}
      for (const t of json.topics) {
        if (t.voted && t.vote_side) seeds[t.id] = t.vote_side
      }
      setLocalVotes(seeds)
      setData(json)
    } catch {
      setError("Couldn't load this week's summit. Please try again.")
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

  const votedCount = data
    ? data.topics.filter((t) => {
        const side = localVotes[t.id] ?? (storeHasVoted(t.id) ? getVoteSide(t.id) : null)
        return !!side
      }).length
    : 0

  const isComplete = data
    ? votedCount >= data.topics.length && data.topics.length > 0
    : false

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
            <Trophy className="h-3.5 w-3.5 text-gold" />
            Weekly Civic Summit
          </div>
          <h1 className="text-2xl font-bold text-surface-900 mb-1">
            This Week&apos;s Summit
          </h1>
          {data && (
            <div className="flex items-center gap-2 text-sm text-surface-500 font-mono">
              <Calendar className="h-3.5 w-3.5" />
              {formatWeek(data.week_start, data.week_end)}
              <span className="text-surface-600">·</span>
              <span className="text-gold font-semibold">{data.week}</span>
            </div>
          )}
        </div>

        {/* Intro box */}
        {!loading && !error && data && !isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-gold/5 border border-gold/20 px-4 py-3 mb-5 flex items-start gap-3"
          >
            <Award className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              Vote on all 10 topics to earn the{' '}
              <span className="text-gold font-semibold">+{data.clout_bonus} Clout summit bonus</span>.
              Topics reset every Monday — same 10 for every citizen.
            </p>
          </motion.div>
        )}

        {loading && <SummitSkeleton />}

        {!loading && error && (
          <EmptyState
            icon={<Zap className="h-8 w-8" />}
            title="Summit unavailable"
            description={error}
            action={
              <button
                onClick={load}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-surface-50 text-sm font-medium hover:bg-gold/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            }
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-5">
            {/* Progress */}
            <SummitProgress
              voted={votedCount}
              total={data.topics.length}
              isComplete={isComplete}
              bonus={data.clout_bonus}
            />

            {/* Completion */}
            <AnimatePresence>
              {justCompleted && (
                <CompletionCard bonus={data.clout_bonus} />
              )}
            </AnimatePresence>

            {/* Topic cards */}
            {data.topics.length === 0 ? (
              <EmptyState
                icon={<Vote className="h-8 w-8" />}
                title="No topics this week"
                description="The summit is empty. Check back once more debates are active."
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
                  <SummitTopicCard
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

            {/* Footer */}
            <div className="pt-4 pb-2 flex flex-col gap-3">
              <div className="text-xs font-mono text-surface-500 text-center">
                Ten topics, refreshed every Monday at midnight UTC.
                <br />
                The same summit for every citizen.
              </div>
              <div className="flex items-center justify-center gap-4 text-xs font-mono flex-wrap">
                <Link href="/session" className="text-surface-500 hover:text-surface-300 flex items-center gap-1">
                  Daily session <ChevronRight className="h-3 w-3" />
                </Link>
                <span className="text-surface-600">·</span>
                <Link href="/missions" className="text-surface-500 hover:text-surface-300 flex items-center gap-1">
                  Daily missions <ChevronRight className="h-3 w-3" />
                </Link>
                <span className="text-surface-600">·</span>
                <Link href="/blitz" className="text-surface-500 hover:text-surface-300 flex items-center gap-1">
                  Blitz mode <ChevronRight className="h-3 w-3" />
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
