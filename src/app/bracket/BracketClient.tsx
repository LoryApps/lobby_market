'use client'

/**
 * BracketClient — interactive single-elimination tournament UI.
 *
 * 8 topics seed → 4 R1 matches → 2 SF matches → 1 Final → Champion
 *
 * Votes are persisted in localStorage under `lm_bracket_<weekKey>` so the
 * bracket carries state across page refreshes for the entire week.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  ChevronRight,
  ExternalLink,
  Flame,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { BracketTopic, BracketResponse } from '@/app/api/bracket/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'lm_bracket_'

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Ethics: 'text-emerald',
  Culture: 'text-gold',
  Economics: 'text-against-400',
  Science: 'text-for-300',
  Philosophy: 'text-purple',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

// Round labels
const ROUND_LABELS = ['Round 1', 'Semifinal', 'Final']

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A match has two contestant slots (null = TBD) and an optional winner ID.
 * topicA = upper seed, topicB = lower seed.
 */
interface Match {
  topicA: BracketTopic | null
  topicB: BracketTopic | null
  winnerId: string | null
  /** Which round this match belongs to: 0=R1, 1=SF, 2=Final */
  round: number
  /** Position within the round (0-indexed) */
  slot: number
}

interface BracketState {
  topics: BracketTopic[]
  /** Map of "round-slot" → winnerId */
  votes: Record<string, string>
  weekKey: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildMatches(state: BracketState): Match[] {
  const { topics, votes } = state
  const t = topics

  // Round 0: 4 matches
  const r0: Match[] = [
    { topicA: t[0] ?? null, topicB: t[1] ?? null, winnerId: votes['0-0'] ?? null, round: 0, slot: 0 },
    { topicA: t[2] ?? null, topicB: t[3] ?? null, winnerId: votes['0-1'] ?? null, round: 0, slot: 1 },
    { topicA: t[4] ?? null, topicB: t[5] ?? null, winnerId: votes['0-2'] ?? null, round: 0, slot: 2 },
    { topicA: t[6] ?? null, topicB: t[7] ?? null, winnerId: votes['0-3'] ?? null, round: 0, slot: 3 },
  ]

  const winnerOf = (match: Match): BracketTopic | null => {
    if (!match.winnerId) return null
    return match.topicA?.id === match.winnerId ? match.topicA : match.topicB
  }

  // Round 1: 2 matches (winners of 0-0 vs 0-1, winners of 0-2 vs 0-3)
  const r1: Match[] = [
    {
      topicA: winnerOf(r0[0]),
      topicB: winnerOf(r0[1]),
      winnerId: votes['1-0'] ?? null,
      round: 1,
      slot: 0,
    },
    {
      topicA: winnerOf(r0[2]),
      topicB: winnerOf(r0[3]),
      winnerId: votes['1-1'] ?? null,
      round: 1,
      slot: 1,
    },
  ]

  // Round 2: Final
  const r2: Match[] = [
    {
      topicA: winnerOf(r1[0]),
      topicB: winnerOf(r1[1]),
      winnerId: votes['2-0'] ?? null,
      round: 2,
      slot: 0,
    },
  ]

  return [...r0, ...r1, ...r2]
}

function getChampion(matches: Match[]): BracketTopic | null {
  const final = matches.find((m) => m.round === 2)
  if (!final?.winnerId) return null
  return final.topicA?.id === final.winnerId ? final.topicA : final.topicB
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VoteBar({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full bg-surface-300 rounded-full overflow-hidden">
      <div
        className="h-full bg-for-500 rounded-full"
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  )
}

function MatchCard({
  match,
  onVote,
}: {
  match: Match
  onVote: (matchKey: string, topicId: string) => void
}) {
  const matchKey = `${match.round}-${match.slot}`
  const isTBD = !match.topicA || !match.topicB
  const isDone = !!match.winnerId

  const renderSide = (topic: BracketTopic | null) => {
    if (!topic) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 border-dashed opacity-40">
          <div className="w-6 h-6 rounded-full bg-surface-300 flex items-center justify-center text-xs text-surface-500">
            ?
          </div>
          <span className="text-surface-500 text-xs italic">TBD</span>
        </div>
      )
    }

    const isWinner = isDone && match.winnerId === topic.id
    const isLoser = isDone && match.winnerId !== null && match.winnerId !== topic.id
    const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-600'
    const canVote = !isTBD && !isDone

    return (
      <motion.button
        whileHover={canVote ? { scale: 1.01 } : undefined}
        whileTap={canVote ? { scale: 0.98 } : undefined}
        onClick={canVote ? () => onVote(matchKey, topic.id) : undefined}
        disabled={!canVote}
        className={cn(
          'w-full text-left rounded-xl border transition-all duration-200',
          'p-3 group',
          canVote
            ? 'cursor-pointer border-surface-300 hover:border-for-500/60 hover:bg-surface-200/60'
            : 'cursor-default',
          isWinner && 'border-gold/60 bg-gold/5',
          isLoser && 'border-surface-300 opacity-40',
          !isDone && !isTBD && 'border-surface-300'
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-xs leading-snug line-clamp-2 font-medium',
                isWinner ? 'text-gold' : isLoser ? 'text-surface-500' : 'text-surface-800'
              )}
            >
              {topic.statement}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {topic.category && (
                <span className={cn('text-[10px] font-mono uppercase tracking-wide', catColor)}>
                  {topic.category}
                </span>
              )}
              <span className="text-[10px] text-surface-500">
                {topic.total_votes.toLocaleString()} votes
              </span>
            </div>
            {topic.total_votes > 0 && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <ThumbsUp className="h-2.5 w-2.5 text-for-400 shrink-0" />
                <VoteBar pct={topic.blue_pct} />
                <ThumbsDown className="h-2.5 w-2.5 text-against-400 shrink-0" />
                <span className="text-[10px] text-surface-500 w-8 text-right">
                  {Math.round(topic.blue_pct)}%
                </span>
              </div>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-center gap-1">
            {isWinner && <Trophy className="h-4 w-4 text-gold" />}
            {canVote && (
              <ChevronRight className="h-4 w-4 text-surface-400 group-hover:text-for-400 transition-colors" />
            )}
          </div>
        </div>
      </motion.button>
    )
  }

  return (
    <div
      className={cn(
        'bg-surface-100 border rounded-2xl p-3 flex flex-col gap-2',
        isDone ? 'border-surface-300' : 'border-surface-300',
        isTBD && 'opacity-60'
      )}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
          {ROUND_LABELS[match.round]} · Match {match.slot + 1}
        </span>
        {!isDone && !isTBD && (
          <span className="text-[10px] text-for-400 flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            Vote to advance
          </span>
        )}
        {isDone && (
          <span className="text-[10px] text-gold flex items-center gap-0.5">
            <Trophy className="h-2.5 w-2.5" />
            Decided
          </span>
        )}
      </div>
      {renderSide(match.topicA)}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-surface-300" />
        <span className="text-[10px] font-bold text-surface-500">VS</span>
        <div className="flex-1 h-px bg-surface-300" />
      </div>
      {renderSide(match.topicB)}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BracketClient() {
  const [state, setState] = useState<BracketState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const weekKeyRef = useRef<string>('')

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bracket')
      if (!res.ok) throw new Error('Failed to load bracket')
      const data: BracketResponse = await res.json()

      weekKeyRef.current = data.weekKey
      const storageKey = STORAGE_KEY_PREFIX + data.weekKey

      // On force-refresh, clear stored votes for this week
      if (forceRefresh) localStorage.removeItem(storageKey)

      const stored = localStorage.getItem(storageKey)
      let votes: Record<string, string> = {}
      let topics = data.topics

      if (stored && !forceRefresh) {
        try {
          const parsed = JSON.parse(stored)
          votes = parsed.votes ?? {}
          // Preserve topic list from this session if same week
          if (parsed.topics?.length === 8) topics = parsed.topics
        } catch {
          // ignore corrupt localStorage
        }
      }

      const newState: BracketState = { topics, votes, weekKey: data.weekKey }
      setState(newState)
      localStorage.setItem(storageKey, JSON.stringify(newState))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleVote = useCallback(
    (matchKey: string, topicId: string) => {
      setState((prev) => {
        if (!prev) return prev
        const next: BracketState = {
          ...prev,
          votes: { ...prev.votes, [matchKey]: topicId },
        }
        localStorage.setItem(
          STORAGE_KEY_PREFIX + next.weekKey,
          JSON.stringify(next)
        )
        return next
      })
    },
    []
  )

  const matches = state ? buildMatches(state) : []
  const champion = state ? getChampion(matches) : null

  const r0 = matches.filter((m) => m.round === 0)
  const r1 = matches.filter((m) => m.round === 1)
  const r2 = matches.filter((m) => m.round === 2)

  const totalVotesCast = state ? Object.keys(state.votes).length : 0
  const totalMatches = 7

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Link href="/" className="text-surface-500 hover:text-surface-700">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" />
              The Civic Bracket
            </h1>
          </div>
          <p className="text-sm text-surface-500 ml-6">
            Which topic most deserves resolution this week? Vote through the bracket to crown a champion.
          </p>
        </div>

        {/* Progress bar */}
        {!loading && state && (
          <div className="mb-6 bg-surface-100 border border-surface-300 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-surface-500">
                Week {state.weekKey} · {totalVotesCast}/{totalMatches} matches voted
              </span>
              <button
                onClick={() => load(true)}
                className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                New bracket
              </button>
            </div>
            <div className="h-1.5 w-full bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gold rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${(totalVotesCast / totalMatches) * 100}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* Champion banner */}
        <AnimatePresence>
          {champion && (
            <motion.div
              key="champion"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="mb-6 bg-gold/10 border border-gold/40 rounded-2xl p-4 flex items-start gap-3"
            >
              <Award className="h-6 w-6 text-gold mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gold font-mono uppercase tracking-widest mb-1">
                  This week&apos;s champion
                </p>
                <p className="font-semibold text-surface-900 leading-snug mb-2">
                  {champion.statement}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {champion.category && (
                    <Badge variant="outline" className="text-xs">
                      {champion.category}
                    </Badge>
                  )}
                  <Link
                    href={`/topic/${champion.id}`}
                    className="inline-flex items-center gap-1 text-xs text-for-400 hover:text-for-300"
                  >
                    View topic <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-20">
            <Scale className="h-8 w-8 text-surface-400 mx-auto mb-3" />
            <p className="text-surface-500 mb-4">{error}</p>
            <Button onClick={() => load()} size="sm">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {/* Bracket */}
        {!loading && state && (
          <div className="space-y-10">
            {/* Desktop: 3-column layout */}
            <div className="hidden lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-start">
              {/* Round 1 — left column (matches 0 & 1) */}
              <div className="space-y-4">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-against-400" />
                  Round 1
                </h2>
                {r0.slice(0, 2).map((m) => (
                  <MatchCard key={`${m.round}-${m.slot}`} match={m} onVote={handleVote} />
                ))}
              </div>

              {/* Arrow 1 */}
              <div className="flex flex-col items-center justify-center pt-16 gap-1 text-surface-400">
                <ChevronRight className="h-5 w-5" />
              </div>

              {/* Semifinal — center column (both SF matches + Final) */}
              <div className="space-y-4">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-for-400" />
                  Semifinal
                </h2>
                {r1.map((m) => (
                  <MatchCard key={`${m.round}-${m.slot}`} match={m} onVote={handleVote} />
                ))}
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mt-6 mb-2 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-gold" />
                  Final
                </h2>
                {r2.map((m) => (
                  <MatchCard key={`${m.round}-${m.slot}`} match={m} onVote={handleVote} />
                ))}
              </div>

              {/* Arrow 2 */}
              <div className="flex flex-col items-center justify-center pt-16 gap-1 text-surface-400">
                <ChevronRight className="h-5 w-5" />
              </div>

              {/* Round 1 — right column (matches 2 & 3) */}
              <div className="space-y-4">
                <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-against-400" />
                  Round 1
                </h2>
                {r0.slice(2, 4).map((m) => (
                  <MatchCard key={`${m.round}-${m.slot}`} match={m} onVote={handleVote} />
                ))}
              </div>
            </div>

            {/* Mobile: stacked rounds */}
            <div className="lg:hidden space-y-8">
              {[
                { label: 'Round 1', icon: <Flame className="h-3.5 w-3.5 text-against-400" />, items: r0 },
                { label: 'Semifinal', icon: <Zap className="h-3.5 w-3.5 text-for-400" />, items: r1 },
                { label: 'Final', icon: <Trophy className="h-3.5 w-3.5 text-gold" />, items: r2 },
              ].map(({ label, icon, items }) => (
                <div key={label}>
                  <h2 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    {icon}
                    {label}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map((m) => (
                      <MatchCard key={`${m.round}-${m.slot}`} match={m} onVote={handleVote} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* How to play */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
              <h3 className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                How it works
              </h3>
              <ul className="space-y-2 text-sm text-surface-600">
                <li className="flex items-start gap-2">
                  <span className="text-for-400 font-bold shrink-0">1.</span>
                  Eight of this week&apos;s most contested topics compete for the title of{' '}
                  <em>Most Deserving of Resolution</em>.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-for-400 font-bold shrink-0">2.</span>
                  In each matchup, click the topic you think is more urgent or important to resolve.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-for-400 font-bold shrink-0">3.</span>
                  Winners advance to the Semifinal and then the Final. Crown the champion.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-gold font-bold shrink-0">4.</span>
                  Your bracket resets each week with a fresh set of topics.
                </li>
              </ul>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
