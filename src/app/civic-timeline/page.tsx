'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  Share2,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { CivicTimelinePayload, TimelineLaw } from '@/app/api/civic-timeline/route'

// ─── Constants ────────────────────────────────────────────────────────────────────────────────

const ROUND_SECONDS = 60
const TOTAL_ROUNDS = 3
const LAWS_PER_ROUND = 5
const STORAGE_KEY = 'lm_civic_timeline_v1'
const POINTS_PER_CORRECT = 4  // max 4×5×3 = 60 pts

// ─── Types ────────────────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'playing' | 'reveal' | 'done'

interface SavedState {
  date: string
  score: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Returns indices sorted by established_at ascending (oldest first). */
function correctOrder(laws: TimelineLaw[]): number[] {
  return Array.from({ length: laws.length }, (_, i) => i).sort(
    (a, b) =>
      new Date(laws[a].established_at).getTime() -
      new Date(laws[b].established_at).getTime(),
  )
}

/** Count how many positions in userOrder match correctOrder position-by-position. */
function countCorrect(userOrder: number[], correct: number[]): number {
  return userOrder.reduce(
    (acc, idx, pos) => acc + (idx === correct[pos] ? 1 : 0),
    0,
  )
}

function formatYear(isoDate: string): string {
  return new Date(isoDate).getFullYear().toString()
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function gradeScore(score: number): { letter: string; label: string; color: string } {
  const max = TOTAL_ROUNDS * LAWS_PER_ROUND * POINTS_PER_CORRECT
  const pct = score / max
  if (pct >= 0.90) return { letter: 'S', label: 'Historian', color: 'text-gold' }
  if (pct >= 0.75) return { letter: 'A', label: 'Archivist', color: 'text-for-300' }
  if (pct >= 0.60) return { letter: 'B', label: 'Chronicle', color: 'text-emerald' }
  if (pct >= 0.45) return { letter: 'C', label: 'Student', color: 'text-purple' }
  return { letter: 'D', label: 'Rookie', color: 'text-surface-400' }
}

// ─── Countdown hook ──────────────────────────────────────────────────────────────────────────────

function useCountdown(active: boolean, onExpire: () => void) {
  const [secs, setSecs] = useState(ROUND_SECONDS)
  const expiredRef = useRef(false)

  useEffect(() => {
    setSecs(ROUND_SECONDS)
    expiredRef.current = false
    if (!active) return
    const id = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(id)
          if (!expiredRef.current) {
            expiredRef.current = true
            setTimeout(onExpire, 0)
          }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return secs
}

// ─── Law card (draggable row) ──────────────────────────────────────────────────────────────────────

function LawCard({
  law,
  pos,
  total,
  onMoveUp,
  onMoveDown,
}: {
  law: TimelineLaw
  pos: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  return (
    <motion.div
      layout
      className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3"
    >
      {/* Position badge */}
      <span className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center text-[10px] font-mono font-bold text-surface-500">
        {pos + 1}
      </span>

      {/* Statement */}
      <p className="flex-1 text-sm font-mono text-white leading-snug">{law.statement}</p>

      {/* Category */}
      {law.category && (
        <span className="flex-shrink-0 text-[10px] font-mono text-surface-500 hidden sm:block">
          {law.category}
        </span>
      )}

      {/* Move buttons */}
      <div className="flex-shrink-0 flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={pos === 0}
          className="p-1 rounded text-surface-500 hover:text-white hover:bg-surface-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          aria-label="Move earlier"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={pos === total - 1}
          className="p-1 rounded text-surface-500 hover:text-white hover:bg-surface-300 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          aria-label="Move later"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Reveal card ──────────────────────────────────────────────────────────────────────────────

function RevealCard({
  law,
  userPos,
  correctPos,
  rank,
}: {
  law: TimelineLaw
  userPos: number
  correctPos: number
  rank: number  // 1-based correct chronological rank
}) {
  const correct = userPos === correctPos
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        correct
          ? 'border-emerald/40 bg-emerald/5'
          : 'border-against-500/30 bg-against-500/5',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 mt-0.5">
          {correct ? (
            <CheckCircle2 className="h-4 w-4 text-emerald" />
          ) : (
            <XCircle className="h-4 w-4 text-against-400" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white leading-snug mb-1.5">{law.statement}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Calendar className="h-3 w-3" />
              {formatDate(law.established_at)}
            </span>
            <span
              className={cn(
                'text-[11px] font-mono',
                correct ? 'text-emerald' : 'text-against-400',
              )}
            >
              #{rank} chronologically · you placed #{userPos + 1}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────────────────────

function GameSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 py-8 pb-28">
        <div className="h-7 w-40 rounded-lg bg-surface-200 animate-pulse mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-surface-200 animate-pulse" />
          ))}
        </div>
        <div className="mt-4 h-11 rounded-xl bg-surface-200 animate-pulse" />
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────────────────────────

export default function CivicTimelinePage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [payload, setPayload] = useState<CivicTimelinePayload | null>(null)
  const [round, setRound] = useState(0)
  const [order, setOrder] = useState<number[]>([])  // indices into current round's laws
  const [scores, setScores] = useState<number[]>([])
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const [savedScore, setSavedScore] = useState(0)

  const totalScore = scores.reduce((a, b) => a + b, 0)
  const currentRound = payload?.rounds[round]
  const currentLaws = currentRound
    ? order.map((i) => currentRound.laws[i])
    : []

  // Check localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const s: SavedState = JSON.parse(raw)
        if (s.date === todayStr()) {
          setAlreadyPlayed(true)
          setSavedScore(s.score)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Fetch game data
  const startGame = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/civic-timeline')
      const data: CivicTimelinePayload = await res.json()
      if (!data.rounds || data.rounds.length === 0) {
        setPhase('idle')
        return
      }
      setPayload(data)
      setRound(0)
      setScores([])
      setOrder(data.rounds[0].laws.map((_, i) => i))
      setPhase('playing')
    } catch {
      setPhase('idle')
    }
  }, [])

  // Timer expiry → auto-reveal
  const handleExpire = useCallback(() => {
    setPhase('reveal')
  }, [])

  const timerActive = phase === 'playing'
  const secs = useCountdown(timerActive, handleExpire)

  // Submit current ordering
  const submitRound = useCallback(() => {
    if (!currentRound) return
    const correct = correctOrder(currentRound.laws)
    const roundScore = countCorrect(order, correct) * POINTS_PER_CORRECT
    setScores((prev) => [...prev, roundScore])
    setPhase('reveal')
  }, [currentRound, order])

  // Advance to next round or finish
  const advanceRound = useCallback(() => {
    if (!payload) return
    const nextRound = round + 1
    if (nextRound >= TOTAL_ROUNDS) {
      setPhase('done')
    } else {
      setRound(nextRound)
      setOrder(payload.rounds[nextRound].laws.map((_, i) => i))
      setPhase('playing')
    }
  }, [payload, round])

  // Persist score when we reach 'done'
  useEffect(() => {
    if (phase === 'done') {
      try {
        const s: SavedState = { date: todayStr(), score: totalScore }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
      } catch { /* ignore */ }
    }
  }, [phase, totalScore])

  // Move a card up/down in the ordering
  function moveCard(pos: number, dir: -1 | 1) {
    const next = [...order]
    const target = pos + dir
    if (target < 0 || target >= next.length) return
    ;[next[pos], next[target]] = [next[target], next[pos]]
    setOrder(next)
  }

  const max = TOTAL_ROUNDS * LAWS_PER_ROUND * POINTS_PER_CORRECT

  // ── Idle (landing) ───────────────────────────────────────────────────────────────────────

  if (phase === 'idle') {
    const { letter, label, color } = alreadyPlayed
      ? gradeScore(savedScore)
      : { letter: '', label: '', color: '' }
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 py-10 pb-28">
          <Link href="/arcade" className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Arcade
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-purple" />
              <span className="text-xs font-mono text-purple uppercase tracking-widest">Daily · 3 rounds</span>
            </div>
            <h1 className="font-mono text-3xl font-bold text-white mb-2">Civic Timeline</h1>
            <p className="text-sm font-mono text-surface-500 leading-relaxed">
              Five established laws per round. Arrange them from <span className="text-white">oldest to newest</span> — by when the community passed them into law. 60 seconds per round.
            </p>
          </div>

          {/* How to play */}
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-5 mb-6">
            <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest mb-3">How to play</h2>
            <ul className="space-y-2.5">
              {[
                { icon: ArrowUpDown, text: 'Use ↑ ↓ buttons to reorder the 5 laws' },
                { icon: Clock, text: 'Place the oldest law at the top, newest at the bottom' },
                { icon: Calendar, text: '60 seconds per round — submit before time runs out' },
                { icon: Trophy, text: 'Score 4 pts per correctly placed law · 60 pts max' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-purple mt-0.5 flex-shrink-0" />
                  <span className="text-xs font-mono text-surface-500">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Already played today */}
          {alreadyPlayed && (
            <div className="rounded-xl border border-purple/30 bg-purple/5 p-5 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono text-surface-500 mb-1">Today&apos;s score</div>
                  <div className="font-mono text-2xl font-bold text-white">
                    {savedScore}<span className="text-surface-500 text-sm">/{max}</span>
                  </div>
                  <div className={cn('text-xs font-mono mt-0.5', color)}>
                    Grade {letter} — {label}
                  </div>
                </div>
                <div className={cn('font-mono text-5xl font-bold', color)}>{letter}</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={startGame}
            className={cn(
              'w-full py-3 rounded-xl font-mono text-sm font-semibold transition-colors',
              alreadyPlayed
                ? 'bg-surface-200 border border-surface-300 text-surface-400 hover:bg-surface-300 hover:text-white'
                : 'bg-purple hover:bg-purple/80 text-white',
            )}
          >
            {alreadyPlayed ? 'Play again (practice)' : 'Start game'}
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────────────

  if (phase === 'loading') return <GameSkeleton />

  // ── Playing ──────────────────────────────────────────────────────────────────────────

  if (phase === 'playing' && currentRound) {
    const timerPct = secs / ROUND_SECONDS
    const timerColor =
      secs > 40 ? 'bg-purple' : secs > 20 ? 'bg-gold' : 'bg-against-500'

    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 py-6 pb-28">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-surface-500">
                Round {round + 1}/{TOTAL_ROUNDS}
              </span>
              <span className="h-1 w-1 rounded-full bg-surface-500" />
              <span className="text-xs font-mono text-surface-500">
                {scores.reduce((a, b) => a + b, 0)} pts so far
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
              <Clock className="h-3.5 w-3.5" />
              {secs}s
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-1 rounded-full bg-surface-300 mb-5 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full transition-colors duration-1000', timerColor)}
              animate={{ width: `${timerPct * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }}
            />
          </div>

          <p className="text-xs font-mono text-surface-500 mb-4 text-center">
            Arrange these laws from <span className="text-white">oldest</span> (top) to <span className="text-white">newest</span> (bottom)
          </p>

          {/* Cards */}
          <div className="space-y-2">
            {currentLaws.map((law, pos) => (
              <LawCard
                key={order[pos]}
                law={law}
                pos={pos}
                total={LAWS_PER_ROUND}
                onMoveUp={() => moveCard(pos, -1)}
                onMoveDown={() => moveCard(pos, 1)}
              />
            ))}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={submitRound}
            className="mt-5 w-full py-3 rounded-xl bg-purple hover:bg-purple/80 text-white font-mono text-sm font-semibold transition-colors"
          >
            Lock in order
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Reveal ───────────────────────────────────────────────────────────────────────────

  if (phase === 'reveal' && currentRound) {
    const correct = correctOrder(currentRound.laws)
    const roundScore = countCorrect(order, correct) * POINTS_PER_CORRECT

    // Build reveal rows in the correct chronological order
    const correctLaws = correct.map((i) => currentRound.laws[i])

    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 py-6 pb-28">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-mono text-lg font-bold text-white">
              Round {round + 1} result
            </h2>
            <span className="font-mono text-xl font-bold text-white">
              {roundScore}<span className="text-surface-500 text-sm">/{LAWS_PER_ROUND * POINTS_PER_CORRECT}</span>
            </span>
          </div>

          {/* Year timeline */}
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 mb-4">
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">Correct chronological order</div>
            <div className="flex items-end gap-1 h-12">
              {correctLaws.map((law, i) => {
                const year = parseInt(formatYear(law.established_at))
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] font-mono text-surface-500 text-center leading-none">{year}</span>
                    <div className="w-full rounded-sm bg-purple/40 h-2" />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2 mb-5">
            {correctLaws.map((law, correctPos) => {
              // Find what position the user placed this law
              const originalIdx = correct[correctPos]
              const userPos = order.indexOf(originalIdx)
              return (
                <RevealCard
                  key={law.id}
                  law={law}
                  userPos={userPos}
                  correctPos={correctPos}
                  rank={correctPos + 1}
                />
              )
            })}
          </div>

          <button
            type="button"
            onClick={advanceRound}
            className="w-full py-3 rounded-xl bg-purple hover:bg-purple/80 text-white font-mono text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {round + 1 < TOTAL_ROUNDS ? (
              <>Next round <ArrowRight className="h-4 w-4" /></>
            ) : (
              'See final score'
            )}
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Done ───────────────────────────────────────────────────────────────────────────

  if (phase === 'done') {
    const { letter, label, color } = gradeScore(totalScore)
    const today = todayStr()
    const shareText = `🗓️ Civic Timeline ${today}\n${totalScore}/${max} — Grade ${letter} (${label})\nlobby.market/civic-timeline`

    async function share() {
      if (navigator.share) {
        await navigator.share({ text: shareText }).catch(() => null)
      } else {
        await navigator.clipboard.writeText(shareText).catch(() => null)
      }
    }

    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 py-10 pb-28 text-center">
          <div className={cn('font-mono text-7xl font-bold mb-2', color)}>{letter}</div>
          <div className={cn('font-mono text-lg font-semibold mb-1', color)}>{label}</div>
          <div className="text-sm font-mono text-surface-500 mb-8">
            {totalScore}/{max} pts · {TOTAL_ROUNDS} rounds completed
          </div>

          {/* Score breakdown */}
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-5 mb-8 text-left">
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4">Score breakdown</div>
            <div className="space-y-2">
              {scores.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-surface-500 w-16">Round {i + 1}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple"
                      style={{ width: `${(s / (LAWS_PER_ROUND * POINTS_PER_CORRECT)) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-white w-12 text-right">
                    {s}/{LAWS_PER_ROUND * POINTS_PER_CORRECT}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={share}
              className="w-full py-3 rounded-xl bg-purple hover:bg-purple/80 text-white font-mono text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="h-4 w-4" /> Share result
            </button>
            <button
              type="button"
              onClick={() => { setPhase('idle') }}
              className="w-full py-3 rounded-xl border border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white font-mono text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="h-4 w-4" /> Play again
            </button>
            <Link
              href="/arcade"
              className="w-full py-3 rounded-xl border border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white font-mono text-sm transition-colors flex items-center justify-center gap-2"
            >
              Back to Arcade
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return <GameSkeleton />
}
