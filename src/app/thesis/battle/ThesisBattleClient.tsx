'use client'

/**
 * /thesis/battle — Thesis Faceoff
 *
 * Two active civic theses shown side by side. The user votes agree or
 * disagree on each, then advances to the next pair. Uses the existing
 * /api/thesis/[id]/vote endpoint — no new database table required.
 *
 * Session state (rounds played, streak) is kept in component state only
 * and resets on page reload.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  RefreshCw,
  Scale,
  Scroll,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { BattleThesis, ThesisBattleResponse } from '@/app/api/thesis/battle/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  economics:   'text-gold border-gold/40 bg-gold/10',
  politics:    'text-for-400 border-for-500/40 bg-for-500/10',
  technology:  'text-purple border-purple/40 bg-purple/10',
  science:     'text-emerald border-emerald/40 bg-emerald/10',
  ethics:      'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy:  'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture:     'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health:      'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education:   'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function fmtResolution(date: string | null): string | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  if (diff < 0) return 'Past due'
  const days = Math.ceil(diff / 86_400_000)
  if (days <= 0) return 'Due today'
  if (days === 1) return '1 day left'
  if (days <= 30) return `${days} days left`
  const months = Math.round(days / 30)
  return `~${months} month${months !== 1 ? 's' : ''} left`
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ─── ThesisCard ───────────────────────────────────────────────────────────────

interface ThesisCardProps {
  thesis: BattleThesis
  vote: boolean | null
  onVote: (agree: boolean) => void
  busy: boolean
  side: 'left' | 'right'
}

function ThesisCard({ thesis, vote, onVote, busy, side }: ThesisCardProps) {
  const [expanded, setExpanded] = useState(false)
  const total = (thesis.agree_count ?? 0) + (thesis.disagree_count ?? 0)
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50
  const catClass = CAT_COLORS[thesis.category] ?? 'text-surface-400 border-surface-400/40 bg-surface-300/20'
  const countdown = fmtResolution(thesis.resolution_date)

  const hasVoted = vote !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: side === 'left' ? 0 : 0.1 }}
      className={cn(
        'relative flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-200',
        hasVoted
          ? vote
            ? 'border-for-500/50 bg-for-500/5'
            : 'border-against-500/50 bg-against-500/5'
          : 'border-surface-300 bg-surface-100 hover:border-surface-400',
      )}
    >
      {/* Vote overlay indicator */}
      {hasVoted && (
        <div
          className={cn(
            'absolute inset-0 rounded-2xl pointer-events-none border-2 transition-all',
            vote ? 'border-for-500/60' : 'border-against-500/60',
          )}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border', catClass)}>
          {thesis.category}
        </span>
        {countdown && (
          <span className="flex items-center gap-1 text-[10px] text-surface-500 font-mono shrink-0">
            <Clock className="h-3 w-3" />
            {countdown}
          </span>
        )}
      </div>

      {/* Author */}
      {thesis.author && (
        <Link href={`/profile/${thesis.author.username}`} className="flex items-center gap-2 group w-fit">
          <Avatar
            src={thesis.author.avatar_url}
            fallback={thesis.author.display_name || thesis.author.username}
            size="xs"
          />
          <span className="text-xs text-surface-500 group-hover:text-surface-300 transition-colors font-mono">
            {thesis.author.display_name || thesis.author.username}
          </span>
        </Link>
      )}

      {/* Statement */}
      <div className="flex items-start gap-2">
        <Scroll className="h-4 w-4 text-surface-500 shrink-0 mt-0.5" />
        <p className="text-sm text-white font-medium leading-relaxed">
          {thesis.statement}
        </p>
      </div>

      {/* Rationale (collapsible) */}
      {thesis.rationale && (
        <div className="border-t border-surface-300 pt-2">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors"
          >
            <BookOpen className="h-3 w-3" />
            <span>Rationale</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 text-xs text-surface-400 leading-relaxed overflow-hidden"
              >
                {thesis.rationale}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Agree bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] font-mono text-surface-500">
          <span>{agreePct}% agree</span>
          <span>{fmtCount(total)} votes</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400 transition-all duration-700"
            style={{ width: `${agreePct}%` }}
          />
        </div>
      </div>

      {/* Vote buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onVote(true)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
            vote === true
              ? 'bg-for-500 text-white shadow-lg shadow-for-500/20'
              : 'bg-for-500/10 text-for-300 border border-for-500/30 hover:bg-for-500/20 hover:text-for-200',
            busy && 'opacity-50 cursor-not-allowed',
          )}
        >
          {vote === true ? <Check className="h-3.5 w-3.5" /> : <ThumbsUp className="h-3.5 w-3.5" />}
          Agree
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onVote(false)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all',
            vote === false
              ? 'bg-against-500 text-white shadow-lg shadow-against-500/20'
              : 'bg-against-500/10 text-against-300 border border-against-500/30 hover:bg-against-500/20 hover:text-against-200',
            busy && 'opacity-50 cursor-not-allowed',
          )}
        >
          {vote === false ? <Check className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
          Disagree
        </button>
      </div>

      {/* View full thesis link */}
      <Link
        href={`/thesis/${thesis.id}`}
        className="flex items-center justify-center gap-1 text-[10px] text-surface-600 hover:text-surface-400 transition-colors py-1"
      >
        View full thesis
        <ArrowRight className="h-3 w-3" />
      </Link>
    </motion.div>
  )
}

// ─── Session summary ──────────────────────────────────────────────────────────

interface SessionSummaryProps {
  rounds: number
  votedAgree: number
  votedDisagree: number
  onRestart: () => void
}

function SessionSummary({ rounds, votedAgree, votedDisagree, onRestart }: SessionSummaryProps) {
  const total = votedAgree + votedDisagree
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 py-12 text-center max-w-sm mx-auto"
    >
      <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-gold/10 border border-gold/30">
        <Trophy className="h-9 w-9 text-gold" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Battle Complete</h2>
        <p className="text-surface-500 font-mono text-sm">
          You fought {rounds} round{rounds !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 w-full">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-surface-200 border border-surface-300 p-3">
          <span className="text-xl font-bold text-white">{rounds}</span>
          <span className="text-[10px] text-surface-500 font-mono uppercase tracking-wider">Rounds</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-for-500/10 border border-for-500/30 p-3">
          <span className="text-xl font-bold text-for-300">{votedAgree}</span>
          <span className="text-[10px] text-surface-500 font-mono uppercase tracking-wider">Agreed</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-against-500/10 border border-against-500/30 p-3">
          <span className="text-xl font-bold text-against-300">{votedDisagree}</span>
          <span className="text-[10px] text-surface-500 font-mono uppercase tracking-wider">Disagreed</span>
        </div>
      </div>

      <p className="text-xs text-surface-500">
        You voted on {total} thesis{total !== 1 ? 'es' : ''} total.
        Your votes help surface the most debated predictions on the platform.
      </p>

      <div className="flex flex-col gap-3 w-full">
        <button
          type="button"
          onClick={onRestart}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-for-500 hover:bg-for-400 text-white font-semibold py-3 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Battle Again
        </button>
        <Link
          href="/thesis"
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-surface-300 bg-surface-200 hover:bg-surface-300 text-surface-300 hover:text-white font-semibold py-3 transition-colors"
        >
          <Scroll className="h-4 w-4" />
          Browse All Theses
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ThesisBattleClient() {
  // Queue of paired theses — consumed two at a time
  const [queue, setQueue] = useState<BattleThesis[]>([])
  const [loading, setLoading] = useState(true)
  const [currentIdx, setCurrentIdx] = useState(0)

  // Per-round vote state for the currently visible pair
  const [leftVote, setLeftVote] = useState<boolean | null>(null)
  const [rightVote, setRightVote] = useState<boolean | null>(null)
  const [leftBusy, setLeftBusy] = useState(false)
  const [rightBusy, setRightBusy] = useState(false)

  // Session stats
  const [rounds, setRounds] = useState(0)
  const [votedAgree, setVotedAgree] = useState(0)
  const [votedDisagree, setVotedDisagree] = useState(0)

  const [done, setDone] = useState(false)
  const fetchedRef = useRef(false)

  const loadBattle = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/thesis/battle?count=20')
      if (!res.ok) return
      const data: ThesisBattleResponse = await res.json()
      const shuffled = shuffle(data.theses)
      setQueue(shuffled)
      setCurrentIdx(0)
      setLeftVote(null)
      setRightVote(null)
      setRounds(0)
      setVotedAgree(0)
      setVotedDisagree(0)
      setDone(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      loadBattle()
    }
  }, [loadBattle])

  const leftThesis = queue[currentIdx] ?? null
  const rightThesis = queue[currentIdx + 1] ?? null
  const hasPair = leftThesis && rightThesis

  // Check if both in current pair have been voted on
  const bothVoted = leftVote !== null && rightVote !== null

  async function castVote(
    thesisId: string,
    agree: boolean,
    side: 'left' | 'right'
  ) {
    const setBusy = side === 'left' ? setLeftBusy : setRightBusy
    const setVote = side === 'left' ? setLeftVote : setRightVote
    const currentVote = side === 'left' ? leftVote : rightVote

    setBusy(true)
    // Optimistic update
    const newVote = currentVote === agree ? null : agree
    setVote(newVote)

    // Tally optimistically
    if (newVote !== null) {
      if (newVote) setVotedAgree((c) => c + 1)
      else setVotedDisagree((c) => c + 1)
    }

    try {
      const res = await fetch(`/api/thesis/${thesisId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agree }),
      })
      if (!res.ok && res.status !== 401) {
        // Revert on failure
        setVote(currentVote)
      }
    } catch {
      setVote(currentVote)
    } finally {
      setBusy(false)
    }
  }

  function advance() {
    const nextIdx = currentIdx + 2
    if (nextIdx >= queue.length - 1) {
      setDone(true)
      return
    }
    setCurrentIdx(nextIdx)
    setLeftVote(null)
    setRightVote(null)
    setRounds((r) => r + 1)
  }

  function skip() {
    advance()
  }

  const totalPairs = Math.floor(queue.length / 2)
  const currentPair = Math.floor(currentIdx / 2) + 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/thesis"
              className="flex items-center justify-center h-9 w-9 rounded-xl border border-surface-300 bg-surface-200 hover:bg-surface-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-surface-400" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Swords className="h-5 w-5 text-against-400" />
                Thesis Faceoff
              </h1>
              <p className="text-xs text-surface-500 font-mono">
                Two civic predictions enter — you decide
              </p>
            </div>
          </div>

          {/* Progress */}
          {!loading && !done && totalPairs > 0 && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-mono text-surface-400">
                Round {currentPair} / {totalPairs}
              </span>
              <div className="h-1.5 w-24 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className="h-full rounded-full bg-for-500 transition-all duration-500"
                  style={{ width: `${(currentPair / totalPairs) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Session stats bar */}
        {!loading && rounds > 0 && !done && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-4 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono"
          >
            <span className="text-surface-500">Session:</span>
            <span className="flex items-center gap-1 text-for-400">
              <ThumbsUp className="h-3 w-3" />
              {votedAgree} agreed
            </span>
            <span className="flex items-center gap-1 text-against-400">
              <ThumbsDown className="h-3 w-3" />
              {votedDisagree} disagreed
            </span>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
                <Skeleton className="h-4 w-24 rounded-full" />
                <Skeleton className="h-3 w-32 rounded" />
                <Skeleton className="h-16 w-full rounded" />
                <Skeleton className="h-8 w-full rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Done state */}
        {!loading && done && (
          <SessionSummary
            rounds={rounds + 1}
            votedAgree={votedAgree}
            votedDisagree={votedDisagree}
            onRestart={() => {
              fetchedRef.current = false
              loadBattle()
            }}
          />
        )}

        {/* Empty state */}
        {!loading && !done && !hasPair && (
          <EmptyState
            icon={<Scale className="h-8 w-8 text-surface-500" />}
            title="No theses available"
            description="There aren't enough active civic theses to battle right now. Check back soon or publish your own."
            action={
              <Link
                href="/thesis/create"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-for-500 hover:bg-for-400 text-white text-sm font-semibold transition-colors"
              >
                <Zap className="h-4 w-4" />
                Publish a Thesis
              </Link>
            }
          />
        )}

        {/* Battle cards */}
        {!loading && !done && hasPair && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Battle cards layout */}
              <div className="relative">
                {/* flex-col on mobile so VS sits between cards; grid on md+ */}
                <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
                  <ThesisCard
                    thesis={leftThesis}
                    vote={leftVote}
                    onVote={(agree) => castVote(leftThesis.id, agree, 'left')}
                    busy={leftBusy}
                    side="left"
                  />
                  {/* Mobile VS divider — hidden on desktop */}
                  <div className="md:hidden flex items-center gap-3 -my-1">
                    <div className="flex-1 h-px bg-surface-300" />
                    <span className="text-xs font-bold text-surface-500">VS</span>
                    <div className="flex-1 h-px bg-surface-300" />
                  </div>
                  <ThesisCard
                    thesis={rightThesis}
                    vote={rightVote}
                    onVote={(agree) => castVote(rightThesis.id, agree, 'right')}
                    busy={rightBusy}
                    side="right"
                  />
                </div>
                {/* Desktop VS badge — absolute overlay between columns */}
                <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 items-center justify-center h-9 w-9 rounded-full bg-surface-100 border-2 border-surface-300 text-xs font-bold text-surface-400 pointer-events-none">
                  VS
                </div>
              </div>

              {/* Action row */}
              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={skip}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white text-xs font-semibold transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Skip pair
                </button>

                <AnimatePresence>
                  {bothVoted && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      type="button"
                      onClick={advance}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-500 hover:bg-for-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-for-500/20"
                    >
                      Next pair
                      <ArrowRight className="h-4 w-4" />
                    </motion.button>
                  )}
                </AnimatePresence>

                {!bothVoted && (
                  <span className="text-xs text-surface-600 font-mono">
                    Vote on both to advance
                  </span>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Navigation links */}
        {!loading && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-3 text-xs font-mono">
            <Link href="/thesis/hot" className="flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors">
              <Zap className="h-3 w-3" /> Hot Theses
            </Link>
            <Link href="/thesis/rising" className="flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors">
              <ArrowRight className="h-3 w-3" /> Rising
            </Link>
            <Link href="/thesis/compare" className="flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors">
              <Scale className="h-3 w-3" /> Compare
            </Link>
            <Link href="/thesis/leaderboard" className="flex items-center gap-1 text-surface-500 hover:text-surface-300 transition-colors">
              <Trophy className="h-3 w-3" /> Leaderboard
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
