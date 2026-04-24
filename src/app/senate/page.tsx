'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { VoteBar } from '@/components/voting/VoteBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { useVoteStore } from '@/lib/stores/vote-store'
import type { SenateTopic, SenateResponse } from '@/app/api/senate/route'

// ─── Countdown ────────────────────────────────────────────────────────────────

function useCountdown(endsAt: string | null) {
  const [ms, setMs] = useState(() =>
    endsAt ? Math.max(0, new Date(endsAt).getTime() - Date.now()) : 0
  )

  useEffect(() => {
    if (!endsAt) return
    const tick = () => setMs(Math.max(0, new Date(endsAt).getTime() - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return ms
}

function CountdownBadge({ endsAt }: { endsAt: string | null }) {
  const ms = useCountdown(endsAt)

  if (!endsAt) return null

  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  const urgent = ms > 0 && ms < 3_600_000 // under 1h
  const warning = ms > 0 && ms < 86_400_000 // under 24h

  let label: string
  if (ms <= 0) {
    label = 'ENDED'
  } else if (days > 0) {
    label = `${days}d ${hours}h left`
  } else if (hours > 0) {
    label = `${hours}h ${mins}m left`
  } else {
    label = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border',
        ms <= 0
          ? 'bg-surface-200 text-surface-500 border-surface-400'
          : urgent
            ? 'bg-against-600/20 text-against-300 border-against-500/50 animate-pulse'
            : warning
              ? 'bg-gold/15 text-gold border-gold/40'
              : 'bg-surface-200 text-surface-400 border-surface-400'
      )}
    >
      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SenateSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-24 flex-shrink-0" />
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Argument snippet ─────────────────────────────────────────────────────────

function ArgumentSnippet({
  topic,
  side,
}: {
  topic: SenateTopic
  side: 'for' | 'against'
}) {
  const arg = side === 'for' ? topic.top_for : topic.top_against
  const isFor = side === 'for'

  return (
    <div
      className={cn(
        'rounded-xl border p-3 flex flex-col gap-2 h-full',
        isFor
          ? 'bg-for-600/8 border-for-500/25'
          : 'bg-against-600/8 border-against-500/25'
      )}
    >
      <div className="flex items-center gap-1.5">
        {isFor ? (
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden="true" />
        )}
        <span
          className={cn(
            'text-[10px] font-mono font-semibold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {arg && (
          <span className="ml-auto text-[10px] text-surface-500 font-mono">
            {arg.upvotes} ↑
          </span>
        )}
      </div>

      {arg ? (
        <div className="flex items-start gap-2">
          {arg.author && (
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name || arg.author.username}
              size="xs"
              className="flex-shrink-0 mt-0.5"
            />
          )}
          <p className="text-[12px] text-surface-600 leading-snug line-clamp-3 font-mono">
            {arg.content}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-surface-500 italic font-mono">
          No argument yet — be the first.
        </p>
      )}
    </div>
  )
}

// ─── Vote panel ───────────────────────────────────────────────────────────────

function VotePanel({
  topic,
  onVoted,
}: {
  topic: SenateTopic
  onVoted: (topicId: string, side: 'blue' | 'red', newPct: number, newTotal: number) => void
}) {
  const { castVote, hasVoted, getVoteSide } = useVoteStore()
  const [voting, setVoting] = useState(false)
  const [localVote, setLocalVote] = useState<'blue' | 'red' | null>(
    topic.user_vote
  )

  const voted = localVote !== null || hasVoted(topic.id)
  const votedSide = localVote ?? getVoteSide(topic.id)

  const handleVote = async (side: 'blue' | 'red') => {
    if (voted || voting) return
    setVoting(true)
    setLocalVote(side)
    try {
      await castVote(topic.id, side)
      const newTotal = topic.total_votes + 1
      const blueVotes =
        side === 'blue'
          ? Math.round((topic.blue_pct / 100) * topic.total_votes) + 1
          : Math.round((topic.blue_pct / 100) * topic.total_votes)
      const newPct = Math.round((blueVotes / newTotal) * 100)
      onVoted(topic.id, side, newPct, newTotal)
    } finally {
      setVoting(false)
    }
  }

  if (voted) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300">
        <CheckCircle2 className="h-4 w-4 text-emerald" aria-hidden="true" />
        <span className="text-sm font-mono text-surface-400">
          You voted{' '}
          <span
            className={cn(
              'font-semibold',
              votedSide === 'blue' ? 'text-for-400' : 'text-against-400'
            )}
          >
            {votedSide === 'blue' ? 'FOR' : 'AGAINST'}
          </span>
        </span>
        <Link
          href={`/topic/${topic.id}`}
          className="ml-auto flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors"
        >
          Details <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    )
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Cast your vote">
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={voting}
        onClick={() => handleVote('blue')}
        aria-label="Vote FOR this topic"
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl',
          'text-sm font-mono font-semibold transition-colors',
          'bg-for-600 text-white hover:bg-for-500 active:bg-for-700',
          'disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {voting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        )}
        FOR
      </motion.button>

      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={voting}
        onClick={() => handleVote('red')}
        aria-label="Vote AGAINST this topic"
        className={cn(
          'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl',
          'text-sm font-mono font-semibold transition-colors',
          'bg-against-600 text-white hover:bg-against-500 active:bg-against-700',
          'disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {voting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
        )}
        AGAINST
      </motion.button>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function SenateTopicCard({
  topic: initialTopic,
}: {
  topic: SenateTopic
}) {
  const [topic, setTopic] = useState(initialTopic)

  const handleVoted = (
    topicId: string,
    _side: 'blue' | 'red',
    newPct: number,
    newTotal: number
  ) => {
    if (topicId !== topic.id) return
    setTopic((prev) => ({ ...prev, blue_pct: newPct, total_votes: newTotal }))
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors p-5 space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/topic/${topic.id}`}
            className="group flex items-start gap-1"
          >
            <h2 className="text-base font-mono font-semibold text-white leading-snug group-hover:text-for-300 transition-colors">
              {topic.statement}
            </h2>
            <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
          </Link>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <Badge variant="active" className="text-[10px]">VOTING</Badge>
            {topic.category && (
              <span className="text-[11px] text-surface-500 font-mono">{topic.category}</span>
            )}
            <span className="text-[11px] text-surface-500 font-mono">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>

        <CountdownBadge endsAt={topic.voting_ends_at} />
      </div>

      {/* Vote bar */}
      <VoteBar bluePct={topic.blue_pct} totalVotes={topic.total_votes} showLabels />

      {/* Arguments */}
      <div className="grid grid-cols-2 gap-3">
        <ArgumentSnippet topic={topic} side="for" />
        <ArgumentSnippet topic={topic} side="against" />
      </div>

      {/* Vote buttons */}
      <VotePanel topic={topic} onVoted={handleVoted} />
    </motion.article>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SenatePage() {
  const [topics, setTopics] = useState<SenateTopic[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastFocus = useRef(Date.now())

  const load = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/senate', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: SenateResponse = await res.json()
      setTopics(json.topics)
      setTotal(json.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Refresh on tab focus (in case votes changed elsewhere)
  useEffect(() => {
    const handler = () => {
      const now = Date.now()
      if (now - lastFocus.current > 10_000) {
        lastFocus.current = now
        load()
      }
    }
    window.addEventListener('focus', handler)
    return () => window.removeEventListener('focus', handler)
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/15 border border-purple/30 flex-shrink-0">
                <Vote className="h-5 w-5 text-purple" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
                  The Senate
                </h1>
                <p className="text-xs text-surface-500 font-mono mt-0.5">
                  {loading
                    ? 'Loading…'
                    : total === 0
                      ? 'No topics in voting right now'
                      : `${total} topic${total !== 1 ? 's' : ''} in final vote`}
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh voting topics"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>

          <p className="text-sm text-surface-400 leading-relaxed mt-4 font-mono">
            Topics currently in their final voting phase. These decisions close soon — your vote determines what becomes law.
          </p>

          {/* Urgency notice if any topic is very close to deadline */}
          {!loading && topics.some((t) => {
            if (!t.voting_ends_at) return false
            const ms = new Date(t.voting_ends_at).getTime() - Date.now()
            return ms > 0 && ms < 3_600_000
          }) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-against-600/15 border border-against-500/30"
            >
              <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0" aria-hidden="true" />
              <span className="text-xs text-against-300 font-mono">
                One or more topics close in under an hour — vote now.
              </span>
            </motion.div>
          )}
        </div>

        {/* Loading */}
        {loading && <SenateSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-8 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-against-300 mb-4 font-mono">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && topics.length === 0 && (
          <EmptyState
            icon={Vote}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="The Senate is in recess"
            description="No topics are in their final voting phase right now. Check back soon — active topics enter voting when they reach quorum."
            actions={[
              { label: 'View active topics', href: '/' },
              { label: 'See what\'s surging', href: '/surge', variant: 'secondary' },
            ]}
          />
        )}

        {/* Topic list */}
        {!loading && !error && topics.length > 0 && (
          <AnimatePresence initial={false} mode="popLayout">
            <div className="space-y-4">
              {topics.map((topic) => (
                <SenateTopicCard key={topic.id} topic={topic} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Footer links */}
        {!loading && !error && topics.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-4 text-xs text-surface-500 font-mono">
            <Link href="/law" className="hover:text-white transition-colors">
              View established laws →
            </Link>
            <Link href="/surge" className="hover:text-white transition-colors">
              Topics gaining momentum →
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
