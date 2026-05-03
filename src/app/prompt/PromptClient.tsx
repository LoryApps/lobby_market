'use client'

/**
 * /prompt — Civic Prompt of the Day
 *
 * One featured civic question per day, deterministically selected from
 * active topics with an interesting split. Users vote, optionally add a
 * hot-take reason, then see the live community result and the best FOR /
 * AGAINST arguments from seasoned citizens.
 *
 * Distinct from:
 *   /quiz    — 8-question civic alignment quiz
 *   /swipe   — card-by-card voting through many topics
 *   /duel    — head-to-head argument showdown
 *   /challenge — daily quorum voting challenge
 *
 * This is one focused question + community reveal + shareable.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Flame,
  Loader2,
  MessageSquare,
  Quote,
  RefreshCw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { DailyPromptResponse, DailyPromptTopic } from '@/app/api/topics/daily-prompt/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}


const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
  Other: 'text-surface-500',
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
}: {
  arg: NonNullable<DailyPromptTopic['top_for_argument']>
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3',
        isFor
          ? 'bg-for-600/5 border-for-500/20'
          : 'bg-against-600/5 border-against-500/20'
      )}
    >
      <div className="flex items-center gap-2">
        {isFor ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-xs font-mono font-bold uppercase tracking-wider',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? 'Top FOR argument' : 'Top AGAINST argument'}
        </span>
        <span className="ml-auto text-xs font-mono text-surface-500 flex items-center gap-1">
          <Award className="h-3 w-3" />
          {arg.upvotes}
        </span>
      </div>

      <div className="flex items-start gap-2">
        <Quote
          className={cn(
            'h-4 w-4 mt-0.5 flex-shrink-0 opacity-40',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        />
        <p className="text-sm text-surface-400 leading-relaxed line-clamp-3">
          {arg.content}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name ?? arg.author_username}
          size="xs"
        />
        <span className="text-xs font-mono text-surface-500">
          @{arg.author_username}
        </span>
        <Link
          href={`/arguments/${arg.id}`}
          className="ml-auto text-xs font-mono text-surface-600 hover:text-white transition-colors flex items-center gap-1"
        >
          Read <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ─── Hot take row ──────────────────────────────────────────────────────────────

function HotTakeRow({
  take,
}: {
  take: DailyPromptResponse['hot_takes'][number]
}) {
  const isFor = take.side === 'blue'
  return (
    <div className="flex items-start gap-3 py-3 border-b border-surface-300/60 last:border-0">
      <Avatar
        src={take.avatar_url}
        fallback={take.display_name ?? take.username}
        size="xs"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href={`/profile/${take.username}`}
            className="text-xs font-mono font-medium text-surface-400 hover:text-white transition-colors truncate"
          >
            @{take.username}
          </Link>
          <span
            className={cn(
              'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0',
              isFor
                ? 'bg-for-500/15 text-for-400'
                : 'bg-against-500/15 text-against-400'
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
        <p className="text-xs text-surface-500 leading-relaxed">{take.reason}</p>
      </div>
    </div>
  )
}

// ─── Vote result display ───────────────────────────────────────────────────────

function ResultBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-3">
      <div className="relative h-4 rounded-full overflow-hidden bg-surface-300/40">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-against-700 to-against-500 rounded-r-full"
        />
      </div>
      <div className="flex justify-between text-sm font-mono font-bold">
        <span className="text-for-400">{forPct}% FOR</span>
        <span className="text-against-400">{againstPct}% AGAINST</span>
      </div>
    </div>
  )
}

// ─── Main client ───────────────────────────────────────────────────────────────

type Phase = 'loading' | 'question' | 'voting' | 'reveal' | 'error'

export function PromptClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [data, setData] = useState<DailyPromptResponse | null>(null)
  const [chosenSide, setChosenSide] = useState<'blue' | 'red' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shared, setShared] = useState(false)
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/topics/daily-prompt')
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as DailyPromptResponse
      setData(json)
      if (json.user_vote) {
        setChosenSide(json.user_vote)
        setPhase('reveal')
      } else {
        setPhase('question')
      }
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      if (shareTimer.current) clearTimeout(shareTimer.current)
    }
  }, [load])

  const handleVote = useCallback(
    async (side: 'blue' | 'red') => {
      if (!data) return
      setChosenSide(side)
      setPhase('voting')
    },
    [data]
  )

  const handleSubmit = useCallback(async () => {
    if (!data || !chosenSide) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/topics/${data.topic.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: chosenSide,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      })
      if (!res.ok && res.status !== 409) throw new Error('Vote failed')
      const refreshed = await fetch('/api/topics/daily-prompt')
      if (refreshed.ok) {
        const json = (await refreshed.json()) as DailyPromptResponse
        setData(json)
      }
      setPhase('reveal')
    } catch {
      setPhase('reveal')
    } finally {
      setSubmitting(false)
    }
  }, [data, chosenSide, reason])

  const handleShare = useCallback(() => {
    if (!data) return
    const url = `https://lobby.market/prompt`
    const text = `Today's Civic Prompt: "${data.topic.statement}" — Vote on Lobby Market!`
    if (navigator.share) {
      navigator.share({ title: "Civic Prompt of the Day", text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
      setShared(true)
      shareTimer.current = setTimeout(() => setShared(false), 2000)
    }
  }, [data])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-xl mx-auto px-4 pt-10 pb-24 md:pb-12">
          <div className="space-y-6 animate-pulse">
            <div className="h-6 w-40 bg-surface-200 rounded-lg" />
            <div className="h-32 bg-surface-200 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 bg-surface-200 rounded-xl" />
              <div className="h-20 bg-surface-200 rounded-xl" />
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (phase === 'error' || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-xl mx-auto px-4 pt-16 pb-24 md:pb-12 text-center">
          <p className="text-surface-500 font-mono mb-4">No prompt available today.</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, date, hot_takes } = data
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLOR[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Feed
          </Link>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-surface-500" />
            <span className="text-xs font-mono text-surface-500">{formatDate(date)}</span>
          </div>
        </div>

        {/* ── Eyebrow ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-gold" />
          </div>
          <div>
            <h1 className="font-mono text-sm font-bold text-white">Civic Prompt of the Day</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">One question. Your voice. Today only.</p>
          </div>
        </div>

        {/* ── Topic card ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-5"
        >
          {topic.category && (
            <span className={cn('text-xs font-mono uppercase tracking-widest mb-2 block', catColor)}>
              {topic.category}
            </span>
          )}
          <p className="text-lg font-semibold text-white leading-snug mb-2">
            {topic.statement}
          </p>
          {topic.description && (
            <p className="text-sm text-surface-500 leading-relaxed line-clamp-2">
              {topic.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-4 text-xs font-mono text-surface-600">
            <span>{topic.total_votes.toLocaleString()} votes cast</span>
            <span>·</span>
            <Badge variant={topic.status === 'law' ? 'law' : topic.status === 'voting' ? 'active' : 'active'}>
              {topic.status}
            </Badge>
            <Link
              href={`/topic/${topic.id}`}
              className="ml-auto flex items-center gap-1 text-surface-500 hover:text-white transition-colors"
            >
              Full debate <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </motion.div>

        {/* ── Phase: question — choose side ──────────────────────────── */}
        <AnimatePresence mode="wait">
          {phase === 'question' && (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <p className="text-center text-sm font-mono text-surface-500 mb-2">
                What do you think?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleVote('blue')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                    'bg-for-600/10 border-for-500/30 hover:bg-for-600/20 hover:border-for-500/60',
                    'group active:scale-95'
                  )}
                >
                  <ThumbsUp className="h-7 w-7 text-for-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-mono font-bold text-for-400">FOR</span>
                  <span className="text-xs font-mono text-for-600/80">{forPct}% agree</span>
                </button>
                <button
                  onClick={() => handleVote('red')}
                  className={cn(
                    'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-against-500/50',
                    'bg-against-600/10 border-against-500/30 hover:bg-against-600/20 hover:border-against-500/60',
                    'group active:scale-95'
                  )}
                >
                  <ThumbsDown className="h-7 w-7 text-against-400 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-mono font-bold text-against-400">AGAINST</span>
                  <span className="text-xs font-mono text-against-600/80">{againstPct}% oppose</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ── Phase: voting — add hot take ──────────────────────────── */}
          {phase === 'voting' && chosenSide && (
            <motion.div
              key="voting"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <div
                className={cn(
                  'flex items-center gap-3 p-4 rounded-xl border',
                  chosenSide === 'blue'
                    ? 'bg-for-600/10 border-for-500/30'
                    : 'bg-against-600/10 border-against-500/30'
                )}
              >
                {chosenSide === 'blue' ? (
                  <ThumbsUp className="h-5 w-5 text-for-400 flex-shrink-0" />
                ) : (
                  <ThumbsDown className="h-5 w-5 text-against-400 flex-shrink-0" />
                )}
                <div>
                  <p className={cn('text-sm font-mono font-bold', chosenSide === 'blue' ? 'text-for-400' : 'text-against-400')}>
                    You chose {chosenSide === 'blue' ? 'FOR' : 'AGAINST'}
                  </p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Add a hot take? (optional, max 140 chars)
                  </p>
                </div>
                <button
                  onClick={() => setPhase('question')}
                  className="ml-auto text-xs font-mono text-surface-600 hover:text-white transition-colors"
                >
                  Change
                </button>
              </div>

              <div className="relative">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 140))}
                  placeholder="Why do you feel this way? (optional)"
                  rows={3}
                  className="w-full bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500 outline-none resize-none focus:border-surface-400 transition-colors font-mono"
                />
                <span className="absolute bottom-3 right-3 text-xs font-mono text-surface-600">
                  {140 - reason.length}
                </span>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-bold transition-all focus:outline-none focus-visible:ring-2',
                  chosenSide === 'blue'
                    ? 'bg-for-600 hover:bg-for-500 text-white focus-visible:ring-for-500/50'
                    : 'bg-against-600 hover:bg-against-500 text-white focus-visible:ring-against-500/50',
                  submitting && 'opacity-60 cursor-not-allowed'
                )}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Cast my vote
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* ── Phase: reveal ─────────────────────────────────────────── */}
          {phase === 'reveal' && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-6"
            >
              {/* Your vote */}
              {chosenSide && (
                <div
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-xl border',
                    chosenSide === 'blue'
                      ? 'bg-for-600/10 border-for-500/30'
                      : 'bg-against-600/10 border-against-500/30'
                  )}
                >
                  {chosenSide === 'blue' ? (
                    <ThumbsUp className="h-5 w-5 text-for-400 flex-shrink-0" />
                  ) : (
                    <ThumbsDown className="h-5 w-5 text-against-400 flex-shrink-0" />
                  )}
                  <div>
                    <p className={cn('text-sm font-mono font-bold', chosenSide === 'blue' ? 'text-for-400' : 'text-against-400')}>
                      You voted {chosenSide === 'blue' ? 'FOR' : 'AGAINST'}
                    </p>
                    <p className="text-xs font-mono text-surface-500 mt-0.5">
                      {chosenSide === 'blue' && forPct >= 50
                        ? `You're with the ${forPct}% majority.`
                        : chosenSide === 'red' && againstPct >= 50
                        ? `You're with the ${againstPct}% majority.`
                        : `You're in the minority — keep fighting.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Community result */}
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
                <h2 className="text-sm font-mono font-bold text-white mb-4">
                  Community Verdict
                </h2>
                <ResultBar bluePct={topic.blue_pct} />
                <p className="text-xs font-mono text-surface-600 mt-3 text-center">
                  {topic.total_votes.toLocaleString()} citizens have spoken
                </p>
              </div>

              {/* Top arguments */}
              {(topic.top_for_argument || topic.top_against_argument) && (
                <div className="space-y-3">
                  <h2 className="text-sm font-mono font-semibold text-surface-400">
                    Best arguments
                  </h2>
                  {topic.top_for_argument && (
                    <ArgumentCard arg={topic.top_for_argument} side="for" />
                  )}
                  {topic.top_against_argument && (
                    <ArgumentCard arg={topic.top_against_argument} side="against" />
                  )}
                </div>
              )}

              {/* Hot takes */}
              {hot_takes.length > 0 && (
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
                  <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2 mb-3">
                    <Flame className="h-4 w-4 text-against-400" />
                    Hot takes
                  </h2>
                  <div>
                    {hot_takes.slice(0, 4).map((take, i) => (
                      <HotTakeRow key={i} take={take} />
                    ))}
                  </div>
                  {hot_takes.length > 4 && (
                    <Link
                      href={`/topic/${topic.id}`}
                      className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <MessageSquare className="h-3 w-3" />
                      See all hot takes on the full debate
                    </Link>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-sm font-mono text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50"
                >
                  {shared ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald" />
                      <span className="text-emerald">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      Share
                    </>
                  )}
                </button>
                <Link
                  href={`/topic/${topic.id}`}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600 hover:bg-for-500 text-sm font-mono font-semibold text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50"
                >
                  Full debate
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Tomorrow CTA */}
              <div className="text-center">
                <p className="text-xs font-mono text-surface-600">
                  A new prompt arrives tomorrow. Want more now?
                </p>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <Link href="/swipe" className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
                    Swipe & Vote →
                  </Link>
                  <Link href="/quiz" className="text-xs font-mono text-purple hover:text-purple/80 transition-colors">
                    Civic Quiz →
                  </Link>
                  <Link href="/duel" className="text-xs font-mono text-gold hover:text-gold/80 transition-colors">
                    Argument Duel →
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
