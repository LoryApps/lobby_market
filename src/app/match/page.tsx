'use client'

/**
 * /match — Civic Priority Match
 *
 * A fast, infinite head-to-head game: two topics appear side-by-side and you
 * pick which one deserves more urgent attention. Each pick builds a personal
 * "urgency list" and contributes to a community priority ranking.
 *
 * Mechanics:
 *  - 5 pairs per round, fetched from /api/match
 *  - Seen pair keys are excluded from future fetches (localStorage)
 *  - Each session ends with a summary of your top-priority topics
 *  - No auth required — anonymous contributions count too
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Flame,
  RefreshCw,
  Scale,
  Swords,
  Target,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MatchPair, MatchResponse, MatchTopic } from '@/app/api/match/route'

// ─── Local storage ────────────────────────────────────────────────────────────

const SEEN_KEY = 'lm_match_seen_v1'
const PICKS_KEY = 'lm_match_picks_v1'

interface PickRecord {
  topicId: string
  statement: string
  category: string | null
  wins: number
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveSeen(key: string) {
  try {
    const seen = loadSeen()
    seen.add(key)
    const arr = Array.from(seen).slice(-500)
    localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
  } catch {}
}

function loadPicks(): PickRecord[] {
  try {
    return JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]') as PickRecord[]
  } catch {
    return []
  }
}

function recordPick(topic: MatchTopic) {
  try {
    const picks = loadPicks()
    const existing = picks.find((p) => p.topicId === topic.id)
    if (existing) {
      existing.wins += 1
    } else {
      picks.push({
        topicId: topic.id,
        statement: topic.statement,
        category: topic.category,
        wins: 1,
      })
    }
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks))
  } catch {}
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}


const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  side,
  chosen,
  rejected,
  onPick,
  disabled,
}: {
  topic: MatchTopic
  side: 'left' | 'right'
  chosen: boolean
  rejected: boolean
  onPick: () => void
  disabled: boolean
}) {
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={`Pick: ${topic.statement}`}
      whileHover={!disabled && !chosen && !rejected ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      animate={chosen ? { scale: 1.04 } : rejected ? { scale: 0.96, opacity: 0.5 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative flex flex-col items-start text-left rounded-2xl border p-5 md:p-7',
        'transition-colors w-full min-h-[200px] md:min-h-[240px]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
        chosen
          ? side === 'left'
            ? 'bg-for-600/15 border-for-500/60 shadow-lg shadow-for-900/20'
            : 'bg-for-600/15 border-for-500/60 shadow-lg shadow-for-900/20'
          : rejected
            ? 'bg-surface-100 border-surface-300/30 cursor-not-allowed'
            : 'bg-surface-100 border-surface-300 hover:border-for-500/40 hover:bg-surface-200/50 cursor-pointer'
      )}
    >
      {/* Category */}
      {topic.category && (
        <span className={cn('text-[11px] font-mono uppercase tracking-wide mb-2', catColor)}>
          {topic.category}
        </span>
      )}

      {/* Statement */}
      <p className={cn(
        'text-base md:text-lg font-semibold leading-snug flex-1',
        chosen ? 'text-white' : rejected ? 'text-surface-500' : 'text-white'
      )}>
        {topic.statement}
      </p>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
          {topic.status === 'voting' ? 'Voting' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
        </Badge>
        {topic.total_votes > 0 && (
          <span className="text-xs font-mono text-surface-500">
            {topic.total_votes.toLocaleString()} votes
          </span>
        )}
        {topic.scope && topic.scope !== 'Global' && (
          <span className="text-xs font-mono text-surface-500">{topic.scope}</span>
        )}
      </div>

      {/* Chosen indicator */}
      {chosen && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute top-3 right-3 flex items-center justify-center h-7 w-7 rounded-full bg-for-500 shadow-md"
        >
          <ThumbsUp className="h-3.5 w-3.5 text-white" aria-hidden="true" />
        </motion.div>
      )}
    </motion.button>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="w-full h-1.5 bg-surface-300 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-for-500 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Session summary ──────────────────────────────────────────────────────────

function SessionSummary({ picks, onReset }: { picks: PickRecord[]; onReset: () => void }) {
  const sorted = [...picks].sort((a, b) => b.wins - a.wins).slice(0, 8)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="h-6 w-6 text-gold" aria-hidden="true" />
        </div>
        <h2 className="font-mono text-2xl font-bold text-white">Your Priority List</h2>
        <p className="text-sm text-surface-500 font-mono">
          Based on your picks, here&apos;s what you think matters most.
        </p>
      </div>

      <div className="space-y-2">
        {sorted.map((pick, idx) => {
          const catColor = CATEGORY_COLORS[pick.category ?? ''] ?? 'text-surface-500'
          return (
            <motion.div
              key={pick.topicId}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <Link
                href={`/topic/${pick.topicId}`}
                className={cn(
                  'flex items-center gap-4 rounded-xl border border-surface-300 bg-surface-100',
                  'px-4 py-3 hover:border-for-500/40 hover:bg-surface-200/50 transition-colors group'
                )}
              >
                {/* Rank */}
                <span className={cn(
                  'font-mono text-sm font-bold flex-shrink-0 w-6 text-center',
                  idx === 0 ? 'text-gold' : idx === 1 ? 'text-surface-500' : 'text-surface-600'
                )}>
                  #{idx + 1}
                </span>

                {/* Statement */}
                <span className="text-sm text-surface-700 group-hover:text-white transition-colors flex-1 leading-snug min-w-0 line-clamp-2">
                  {pick.statement}
                </span>

                {/* Category + wins */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {pick.category && (
                    <span className={cn('text-[11px] font-mono hidden sm:block', catColor)}>
                      {pick.category}
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-for-400 flex-shrink-0">
                    {pick.wins}W
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" />
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onReset}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl',
            'bg-for-600 text-white text-sm font-medium',
            'hover:bg-for-700 transition-colors'
          )}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Play Again
        </button>
        <Link
          href="/trending"
          className={cn(
            'flex-1 flex items-center justify-center gap-2 h-11 rounded-xl',
            'bg-surface-200 text-surface-700 text-sm font-medium',
            'hover:bg-surface-300 transition-colors'
          )}
        >
          Browse Topics
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MatchPage() {
  const [pairs, setPairs] = useState<MatchPair[]>([])
  const [pairIdx, setPairIdx] = useState(0)
  const [chosenSide, setChosenSide] = useState<'left' | 'right' | null>(null)
  const [sessionPicks, setSessionPicks] = useState<PickRecord[]>([])
  const [roundComplete, setRoundComplete] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalSeen, setTotalSeen] = useState(0)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPairs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const seen = loadSeen()
      const excludeIds = Array.from(seen).join(',')
      const url = excludeIds ? `/api/match?exclude=${encodeURIComponent(excludeIds)}` : '/api/match'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = (await res.json()) as MatchResponse
      if (data.pairs.length === 0) {
        // All topics seen — clear seen list and retry
        localStorage.removeItem(SEEN_KEY)
        const res2 = await fetch('/api/match')
        const data2 = (await res2.json()) as MatchResponse
        setPairs(data2.pairs)
      } else {
        setPairs(data.pairs)
      }
      setPairIdx(0)
      setChosenSide(null)
      setRoundComplete(false)
    } catch {
      setError('Could not load topics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount and also load session picks
  useEffect(() => {
    fetchPairs()
    setSessionPicks(loadPicks())
    setTotalSeen(loadSeen().size)
  }, [fetchPairs])

  const currentPair = pairs[pairIdx] ?? null

  function handlePick(side: 'left' | 'right') {
    if (chosenSide !== null || !currentPair) return

    const winner = side === 'left' ? currentPair.left : currentPair.right
    setChosenSide(side)
    recordPick(winner)
    saveSeen(currentPair.pair_key)

    // Update session picks from storage
    const fresh = loadPicks()
    setSessionPicks(fresh)
    setTotalSeen((n) => n + 1)

    // Advance after short delay
    advanceTimer.current = setTimeout(() => {
      const next = pairIdx + 1
      if (next >= pairs.length) {
        setRoundComplete(true)
      } else {
        setPairIdx(next)
        setChosenSide(null)
      }
    }, 700)
  }

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [])

  function handleReset() {
    fetchPairs()
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/arcade"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors'
              )}
              aria-label="Back to Arcade"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Swords className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Match</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Which topic deserves more urgent attention?
              </p>
            </div>
          </div>

          {/* Stats */}
          {totalSeen > 0 && (
            <div className="text-right flex-shrink-0">
              <span className="text-2xl font-mono font-bold text-for-400">{totalSeen}</span>
              <p className="text-[11px] font-mono text-surface-500">matches played</p>
            </div>
          )}
        </div>

        {/* How to play */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
          <Target className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-surface-500 leading-relaxed">
            Pick the topic you think is <span className="text-white font-medium">most urgent</span> for society to address. Your choices build a community priority ranking.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-52 rounded-2xl" />
              <Skeleton className="h-52 rounded-2xl" />
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={<Flame className="h-8 w-8" />}
            title="Something went wrong"
            description={error}
            action={
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm hover:bg-for-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            }
          />
        )}

        {/* Round complete — show summary */}
        {!loading && !error && roundComplete && (
          <SessionSummary
            picks={sessionPicks}
            onReset={handleReset}
          />
        )}

        {/* Match in progress */}
        {!loading && !error && !roundComplete && currentPair && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentPair.pair_key}-${pairIdx}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {/* Progress */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-surface-500 flex-shrink-0">
                  {pairIdx + 1} / {pairs.length}
                </span>
                <ProgressBar current={pairIdx + (chosenSide ? 1 : 0)} total={pairs.length} />
              </div>

              {/* VS divider label */}
              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px bg-surface-300" />
                <span className="text-xs font-mono font-bold text-surface-500 px-2 flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                  PICK ONE
                </span>
                <div className="flex-1 h-px bg-surface-300" />
              </div>

              {/* Topic cards side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TopicCard
                  topic={currentPair.left}
                  side="left"
                  chosen={chosenSide === 'left'}
                  rejected={chosenSide === 'right'}
                  onPick={() => handlePick('left')}
                  disabled={chosenSide !== null}
                />

                {/* Mobile OR divider */}
                <div className="flex sm:hidden items-center gap-3">
                  <div className="flex-1 h-px bg-surface-300" />
                  <span className="text-xs font-mono text-surface-500">OR</span>
                  <div className="flex-1 h-px bg-surface-300" />
                </div>

                <TopicCard
                  topic={currentPair.right}
                  side="right"
                  chosen={chosenSide === 'right'}
                  rejected={chosenSide === 'left'}
                  onPick={() => handlePick('right')}
                  disabled={chosenSide !== null}
                />
              </div>

              {/* Skip */}
              {chosenSide === null && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentPair) return
                      saveSeen(currentPair.pair_key)
                      const next = pairIdx + 1
                      if (next >= pairs.length) {
                        setRoundComplete(true)
                      } else {
                        setPairIdx(next)
                        setChosenSide(null)
                      }
                    }}
                    className="text-xs font-mono text-surface-500 hover:text-surface-700 transition-colors px-3 py-1.5"
                  >
                    Skip this pair →
                  </button>
                </div>
              )}

              {/* Chosen feedback */}
              {chosenSide && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 py-2"
                >
                  <Zap className="h-4 w-4 text-for-400" aria-hidden="true" />
                  <span className="text-sm font-mono text-for-400">Recorded — next up…</span>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Bottom links */}
        {!loading && !roundComplete && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-between text-xs font-mono text-surface-500">
            <span>All topics from the live debate floor</span>
            <Link href="/trending" className="text-for-400 hover:text-for-300 transition-colors">
              Browse all →
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
