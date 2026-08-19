'use client'

/**
 * /checkin — Civic Daily Check-In
 *
 * A focused daily ritual: one trending civic question, your for/against vote,
 * a 14-day activity grid, and a vote-streak counter. Designed as a daily
 * habit — show up, vote your conscience, keep the streak alive.
 *
 * Distinct from:
 *  /swipe        — casual card-by-card browsing of many topics
 *  /topic/[id]   — full topic page with arguments, wiki, etc.
 *  /feed         — algorithmic scroll of all topics
 *  /streaks      — historical streak leaderboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronRight,
  Flame,
  Loader2,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { CheckinResponse } from '@/app/api/checkin/route'

// ─── 14-day activity grid ─────────────────────────────────────────────────────

function ActivityGrid({ activity }: { activity: Record<string, number> }) {
  const days: { date: string; count: number; isToday: boolean }[] = []
  const today = new Date()

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push({ date: key, count: activity[key] ?? 0, isToday: i === 0 })
  }

  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-surface-500 font-mono uppercase tracking-wider">
        Last 14 days
      </p>
      <div className="flex gap-1.5 items-end">
        {days.map((d) => (
          <div key={d.date} className="flex flex-col items-center gap-0.5">
            <div
              title={`${d.date}: ${d.count} vote${d.count !== 1 ? 's' : ''}`}
              className={cn(
                'w-5 h-5 rounded-md transition-all',
                d.isToday && 'ring-1 ring-gold/60',
                d.count === 0 && 'bg-surface-300',
                d.count === 1 && 'bg-for-700/80',
                d.count === 2 && 'bg-for-500',
                d.count >= 3 && 'bg-for-300',
              )}
            />
            <span className="text-[9px] font-mono text-surface-600">
              {DOW[new Date(d.date + 'T12:00:00').getDay()]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct, animated }: { bluePct: number; animated?: boolean }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-against-400">{againstPct}% AGAINST</span>
      </div>
      <div className="h-2 bg-against-700/60 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-for-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={animated ? { duration: 0.8, ease: 'easeOut' } : { duration: 0 }}
        />
      </div>
    </div>
  )
}

// ─── Streak badge ─────────────────────────────────────────────────────────────

function StreakBadge({ streak }: { streak: number }) {
  const isHot = streak >= 7
  const isWarm = streak >= 3

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border',
        isHot && 'bg-gold/10 border-gold/30 text-gold',
        isWarm && !isHot && 'bg-orange-500/10 border-orange-500/30 text-orange-400',
        !isWarm && 'bg-surface-200 border-surface-300 text-surface-500',
      )}
    >
      <Flame className={cn('h-4 w-4', isHot && 'animate-pulse')} />
      <span className="text-sm font-bold tabular-nums">{streak}</span>
      <span className="text-xs opacity-70">day streak</span>
    </div>
  )
}

// ─── Argument excerpt ─────────────────────────────────────────────────────────

interface ArgExcerptProps {
  content: string
  side: 'blue' | 'red'
  authorUsername: string | null
  authorDisplayName: string | null
  authorAvatar: string | null
  upvotes: number
}

function ArgExcerpt({
  content, side, authorUsername, authorDisplayName, authorAvatar, upvotes,
}: ArgExcerptProps) {
  const preview = content.length > 120 ? content.slice(0, 120) + '…' : content
  const name = authorDisplayName || authorUsername || 'Anonymous'

  return (
    <div
      className={cn(
        'rounded-xl p-3 border text-xs space-y-2',
        side === 'blue'
          ? 'bg-for-900/20 border-for-700/30'
          : 'bg-against-900/20 border-against-700/30',
      )}
    >
      <div className="flex items-center gap-1.5">
        <Avatar
          src={authorAvatar}
          fallback={name}
          size="xs"
        />
        <span className="font-medium text-surface-700 truncate">{name}</span>
        <span
          className={cn(
            'ml-auto text-[10px] font-mono',
            side === 'blue' ? 'text-for-400' : 'text-against-400',
          )}
        >
          +{upvotes}
        </span>
      </div>
      <p className="text-surface-600 leading-relaxed">{preview}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'loading' | 'question' | 'voted' | 'error'

export function CheckinClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [data, setData] = useState<CheckinResponse | null>(null)
  const [votedSide, setVotedSide] = useState<'blue' | 'red' | null>(null)
  const [isVoting, setIsVoting] = useState(false)
  const [showArgs, setShowArgs] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/checkin')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: CheckinResponse = await res.json()
      setData(json)

      if (json.user?.todays_vote) {
        setVotedSide(json.user.todays_vote)
        setPhase('voted')
      } else {
        setPhase('question')
      }
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Vote ──────────────────────────────────────────────────────────────────
  const handleVote = async (side: 'blue' | 'red') => {
    if (!data?.topic || isVoting) return
    setIsVoting(true)

    try {
      const res = await fetch(`/api/topics/${data.topic.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      })

      if (res.ok) {
        setVotedSide(side)
        // Optimistically update vote bar
        setData((prev) => {
          if (!prev) return prev
          const delta = side === 'blue' ? 1 : 0
          const total = (prev.topic.total_votes ?? 0) + 1
          const blueCount = Math.round((prev.topic.blue_pct / 100) * (total - 1)) + delta
          return {
            ...prev,
            topic: {
              ...prev.topic,
              total_votes: total,
              blue_pct: (blueCount / total) * 100,
            },
          }
        })
        setPhase('voted')
      }
    } catch {
      // silent fail — let user try again
    } finally {
      setIsVoting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  const topic = data?.topic
  const user = data?.user

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-20 pt-4 px-4 max-w-lg mx-auto w-full">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
              <CalendarCheck className="h-4 w-4 text-gold" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white">Daily Check-In</h1>
              <p className="text-[11px] text-surface-500">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          {user && <StreakBadge streak={user.vote_streak} />}
        </div>

        {/* Loading */}
        <AnimatePresence mode="wait">
          {phase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-3"
            >
              <Loader2 className="h-6 w-6 text-gold animate-spin" />
              <p className="text-sm text-surface-500">Loading today's question…</p>
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-3"
            >
              <X className="h-8 w-8 text-against-400 mx-auto" />
              <p className="text-white font-semibold">Failed to load today's question</p>
              <button
                onClick={load}
                className="text-sm text-for-400 hover:text-for-300 transition-colors"
              >
                Try again
              </button>
            </motion.div>
          )}

          {topic && (phase === 'question' || phase === 'voted') && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Question card */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                {/* Topic meta */}
                <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                  {topic.category && (
                    <Badge variant="proposed" className="text-[10px]">
                      {topic.category}
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-xs text-surface-500 ml-auto">
                    <Scale className="h-3 w-3" />
                    <span>{topic.total_votes.toLocaleString()} votes</span>
                  </div>
                </div>

                {/* Statement */}
                <div className="px-5 pb-4">
                  <Link
                    href={`/topic/${topic.id}`}
                    className="group"
                  >
                    <p className="text-lg font-semibold text-white leading-snug group-hover:text-for-200 transition-colors">
                      {topic.statement}
                    </p>
                  </Link>
                </div>

                {/* Vote bar */}
                <div className="px-5 pb-4">
                  <VoteBar bluePct={topic.blue_pct} animated={phase === 'voted'} />
                </div>

                {/* Divider */}
                <div className="border-t border-surface-300 mx-5" />

                {/* Vote buttons or result */}
                <div className="p-5">
                  {phase === 'question' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-surface-500 text-center">How do you stand?</p>
                      <div className="flex gap-3">
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          disabled={isVoting}
                          onClick={() => handleVote('blue')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl',
                            'font-bold text-sm transition-all',
                            'bg-for-600 hover:bg-for-500 text-white',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                          )}
                        >
                          {isVoting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ThumbsUp className="h-4 w-4" />
                          )}
                          FOR
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.96 }}
                          disabled={isVoting}
                          onClick={() => handleVote('red')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl',
                            'font-bold text-sm transition-all',
                            'bg-against-600 hover:bg-against-500 text-white',
                            'disabled:opacity-50 disabled:cursor-not-allowed',
                          )}
                        >
                          {isVoting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ThumbsDown className="h-4 w-4" />
                          )}
                          AGAINST
                        </motion.button>
                      </div>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-3"
                    >
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-xl p-3 border',
                          votedSide === 'blue'
                            ? 'bg-for-900/20 border-for-700/40 text-for-300'
                            : 'bg-against-900/20 border-against-700/40 text-against-300',
                        )}
                      >
                        <div className="h-6 w-6 rounded-full bg-current/20 flex items-center justify-center flex-shrink-0">
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-semibold">
                          You voted{' '}
                          <span className="uppercase">
                            {votedSide === 'blue' ? 'FOR' : 'AGAINST'}
                          </span>
                        </p>
                        <span className="ml-auto text-xs opacity-60">
                          Check-in complete
                        </span>
                      </div>

                      <Link
                        href={`/topic/${topic.id}`}
                        className={cn(
                          'flex items-center justify-center gap-2 w-full py-2.5 rounded-xl',
                          'text-sm text-surface-500 hover:text-white border border-surface-300',
                          'hover:border-surface-400 transition-colors',
                        )}
                      >
                        Read full debate
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Arguments preview */}
              {(topic.top_for || topic.top_against) && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                  <button
                    onClick={() => setShowArgs((s) => !s)}
                    className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-surface-200/50 transition-colors"
                  >
                    <MessageSquare className="h-4 w-4 text-surface-500" />
                    <span className="text-sm font-semibold text-white">Top arguments</span>
                    <span className="text-xs text-surface-500 ml-1">
                      ({topic.argument_count} total)
                    </span>
                    <motion.span
                      animate={{ rotate: showArgs ? 90 : 0 }}
                      className="ml-auto"
                    >
                      <ChevronRight className="h-4 w-4 text-surface-500" />
                    </motion.span>
                  </button>

                  <AnimatePresence>
                    {showArgs && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 space-y-2.5">
                          {topic.top_for && (
                            <ArgExcerpt
                              content={topic.top_for.content}
                              side="blue"
                              authorUsername={topic.top_for.author_username}
                              authorDisplayName={topic.top_for.author_display_name}
                              authorAvatar={topic.top_for.author_avatar_url}
                              upvotes={topic.top_for.upvotes}
                            />
                          )}
                          {topic.top_against && (
                            <ArgExcerpt
                              content={topic.top_against.content}
                              side="red"
                              authorUsername={topic.top_against.author_username}
                              authorDisplayName={topic.top_against.author_display_name}
                              authorAvatar={topic.top_against.author_avatar_url}
                              upvotes={topic.top_against.upvotes}
                            />
                          )}
                          <Link
                            href={`/topic/${topic.id}?tab=arguments`}
                            className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors pt-1"
                          >
                            See all {topic.argument_count} arguments
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Activity grid (authenticated users only) */}
              {user && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-gold" />
                    <span className="text-sm font-semibold text-white">Your civic streak</span>
                  </div>
                  <ActivityGrid activity={user.recent_activity} />
                  <div className="flex items-center justify-between text-xs text-surface-500">
                    <span>
                      <span className="text-white font-semibold">{user.vote_streak}</span>{' '}
                      day{user.vote_streak !== 1 ? 's' : ''} in a row
                    </span>
                    <Link
                      href="/streaks"
                      className="text-for-400 hover:text-for-300 transition-colors flex items-center gap-0.5"
                    >
                      Leaderboard <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  href="/swipe"
                  className={cn(
                    'flex items-center gap-2 p-3.5 rounded-xl',
                    'bg-surface-100 border border-surface-300',
                    'hover:border-surface-400 transition-colors',
                    'text-sm text-surface-600 hover:text-white',
                  )}
                >
                  <TrendingUp className="h-4 w-4 text-for-400 flex-shrink-0" />
                  More topics to vote
                </Link>
                <Link
                  href="/debate"
                  className={cn(
                    'flex items-center gap-2 p-3.5 rounded-xl',
                    'bg-surface-100 border border-surface-300',
                    'hover:border-surface-400 transition-colors',
                    'text-sm text-surface-600 hover:text-white',
                  )}
                >
                  <Zap className="h-4 w-4 text-purple flex-shrink-0" />
                  Live debates
                </Link>
              </div>

              {/* Not logged in prompt */}
              {!user && phase === 'voted' && (
                <div className="rounded-2xl bg-surface-100 border border-gold/20 p-5 text-center space-y-2">
                  <p className="text-sm text-white font-semibold">
                    Sign in to track your streak
                  </p>
                  <p className="text-xs text-surface-500">
                    Your vote was recorded. Create an account to build your civic record and streak.
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold hover:text-yellow-300 transition-colors mt-1"
                  >
                    Sign in or join
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
