'use client'

/**
 * /civic-rank — Civic Rank
 *
 * Daily law-sorting challenge: 5 rounds, each with 4 established laws
 * presented in a random order. Sort them from highest community support
 * (% voted FOR) to lowest. Score is how many you place correctly (0–4 per
 * round, 20 max total). Same 20 laws for every player each calendar day.
 *
 * No sign-in required. Best score stored in localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowUpDown,
  BarChart2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Share2,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { RankLaw, RankRound, CivicRankPayload } from '@/app/api/civic-rank/route'

// ─── Constants ───────────────────────────────────────────────────────────────────────────────

const ROUND_SECONDS = 25
const TOTAL_ROUNDS = 5
const LAWS_PER_ROUND = 4
const STORAGE_KEY = 'lm_civic_rank_v1'

// ─── Types ─────────────────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'playing' | 'reveal' | 'done'

interface StoredResult {
  date: string
  score: number
}

interface RoundResult {
  userOrder: number[]    // indices into round.laws[] as user arranged them
  correctOrder: number[] // sorted indices (highest blue_pct first)
  correctCount: number
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────

function loadBest(): StoredResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredResult
  } catch {
    return null
  }
}

function saveBest(date: string, score: number): void {
  try {
    const existing = loadBest()
    if (!existing || existing.date !== date || score > existing.score) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ date, score }))
    }
  } catch { /* ignore */ }
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function gradeScore(score: number): { letter: string; label: string; color: string } {
  const pct = score / (TOTAL_ROUNDS * LAWS_PER_ROUND)
  if (pct >= 0.90) return { letter: 'S', label: 'Impeccable', color: 'text-gold' }
  if (pct >= 0.75) return { letter: 'A', label: 'Sharp', color: 'text-for-300' }
  if (pct >= 0.60) return { letter: 'B', label: 'Solid', color: 'text-emerald' }
  if (pct >= 0.45) return { letter: 'C', label: 'Getting There', color: 'text-purple' }
  return { letter: 'D', label: 'Keep Practising', color: 'text-surface-400' }
}

/** Sort indices 0–3 by blue_pct descending (correct answer). */
function correctOrder(laws: RankLaw[]): number[] {
  return [0, 1, 2, 3]
    .slice(0, laws.length)
    .sort((a, b) => laws[b].blue_pct - laws[a].blue_pct)
}

function countCorrect(userOrder: number[], correct: number[]): number {
  return userOrder.reduce((acc, idx, pos) => acc + (idx === correct[pos] ? 1 : 0), 0)
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Countdown hook ──────────────────────────────────────────────────────────────────

function useCountdown(active: boolean, onExpire: () => void) {
  const [seconds, setSeconds] = useState(ROUND_SECONDS)
  const cbRef = useRef(onExpire)
  cbRef.current = onExpire

  useEffect(() => {
    setSeconds(ROUND_SECONDS)
  }, [active])

  useEffect(() => {
    if (!active) return
    if (seconds <= 0) { cbRef.current(); return }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [active, seconds])

  return seconds
}

// ─── Law card (draggable-style with up/down buttons) ────────────────────────────────

function LawCard({
  law,
  position,
  total,
  onMoveUp,
  onMoveDown,
  disabled,
}: {
  law: RankLaw
  position: number   // 1-indexed display
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  disabled: boolean
}) {
  const catColor = CATEGORY_COLOR[law.category ?? ''] ?? 'text-surface-400'

  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="flex items-stretch gap-2 bg-surface-100 border border-surface-300 rounded-xl overflow-hidden"
    >
      {/* Position badge */}
      <div className="flex items-center justify-center w-8 bg-surface-200 flex-shrink-0">
        <span className="text-xs font-mono font-bold text-surface-400">{position}</span>
      </div>

      {/* Content */}
      <div className="flex-1 py-3 pr-2 min-w-0">
        {law.category && (
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', catColor)}>
            {law.category}
          </span>
        )}
        <p className="text-sm text-surface-100 leading-snug mt-0.5 line-clamp-3">
          {law.statement}
        </p>
        <div className="flex items-center gap-1 mt-1.5">
          <Gavel className="h-3 w-3 text-gold flex-shrink-0" />
          <span className="text-[10px] font-mono text-surface-500">Established Law</span>
        </div>
      </div>

      {/* Up/Down controls */}
      <div className="flex flex-col justify-center gap-1 pr-2 flex-shrink-0">
        <button
          onClick={onMoveUp}
          disabled={disabled || position === 1}
          aria-label="Move up"
          className="h-7 w-7 rounded-lg flex items-center justify-center bg-surface-200 hover:bg-surface-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronUp className="h-4 w-4 text-surface-300" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={disabled || position === total}
          aria-label="Move down"
          className="h-7 w-7 rounded-lg flex items-center justify-center bg-surface-200 hover:bg-surface-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronDown className="h-4 w-4 text-surface-300" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Reveal card (shows result after locking in) ─────────────────────────────────

function RevealCard({
  law,
  position,
  correctPosition,
  isCorrect,
}: {
  law: RankLaw
  position: number
  correctPosition: number
  isCorrect: boolean
}) {
  const catColor = CATEGORY_COLOR[law.category ?? ''] ?? 'text-surface-400'
  const forPct = Math.round(law.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: position * 0.1 }}
      className={cn(
        'flex items-stretch gap-2 rounded-xl overflow-hidden border',
        isCorrect
          ? 'border-emerald/40 bg-emerald/5'
          : 'border-against-500/40 bg-against-500/5'
      )}
    >
      {/* Position badge */}
      <div
        className={cn(
          'flex flex-col items-center justify-center w-8 flex-shrink-0',
          isCorrect ? 'bg-emerald/15' : 'bg-against-500/15'
        )}
      >
        <span className={cn('text-xs font-mono font-bold', isCorrect ? 'text-emerald' : 'text-against-400')}>
          {correctPosition}
        </span>
        {isCorrect
          ? <CheckCircle2 className="h-3 w-3 text-emerald mt-0.5" />
          : <XCircle className="h-3 w-3 text-against-400 mt-0.5" />
        }
      </div>

      {/* Content */}
      <div className="flex-1 py-3 min-w-0">
        {law.category && (
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', catColor)}>
            {law.category}
          </span>
        )}
        <p className="text-sm text-surface-100 leading-snug mt-0.5 line-clamp-2">
          {law.statement}
        </p>
      </div>

      {/* FOR% revealed */}
      <div className="flex flex-col items-end justify-center pr-3 flex-shrink-0 gap-1">
        <span className="text-base font-mono font-bold text-for-400">{forPct}%</span>
        <span className="text-[10px] font-mono text-surface-500">FOR</span>
        <div className="w-10 h-1 bg-surface-300 rounded-full overflow-hidden mt-0.5">
          <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────────────────

function GameSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 bg-surface-100 border border-surface-300 rounded-xl p-3">
          <Skeleton className="h-12 w-6 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-7 w-7 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────────────────

export default function CivicRankPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [payload, setPayload] = useState<CivicRankPayload | null>(null)
  const [roundIdx, setRoundIdx] = useState(0)
  const [order, setOrder] = useState<number[]>([0, 1, 2, 3])
  const [results, setResults] = useState<RoundResult[]>([])
  const [totalScore, setTotalScore] = useState(0)
  const [copied, setCopied] = useState(false)
  const [stored, setStored] = useState<StoredResult | null>(null)

  useEffect(() => {
    setStored(loadBest())
  }, [])

  const currentRound: RankRound | null = payload?.rounds[roundIdx] ?? null

  const handleExpire = useCallback(() => {
    if (phase !== 'playing') return
    lockIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roundIdx, order, currentRound])

  const timerSeconds = useCountdown(phase === 'playing', handleExpire)

  async function startGame() {
    setPhase('loading')
    setRoundIdx(0)
    setResults([])
    setTotalScore(0)

    try {
      const res = await fetch('/api/civic-rank')
      if (!res.ok) throw new Error('Failed')
      const data: CivicRankPayload = await res.json()
      if (!data.rounds.length) throw new Error('No rounds')
      setPayload(data)
      // Start with identity order (0,1,2,3)
      setOrder([0, 1, 2, 3])
      setPhase('playing')
    } catch {
      setPhase('idle')
    }
  }

  function moveUp(pos: number) {
    if (pos === 0) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[pos - 1], next[pos]] = [next[pos], next[pos - 1]]
      return next
    })
  }

  function moveDown(pos: number) {
    if (pos >= LAWS_PER_ROUND - 1) return
    setOrder((prev) => {
      const next = [...prev]
      ;[next[pos], next[pos + 1]] = [next[pos + 1], next[pos]]
      return next
    })
  }

  function lockIn() {
    if (!currentRound) return
    const correct = correctOrder(currentRound.laws)
    const count = countCorrect(order, correct)
    const result: RoundResult = {
      userOrder: [...order],
      correctOrder: correct,
      correctCount: count,
    }
    const newResults = [...results, result]
    const newScore = newResults.reduce((s, r) => s + r.correctCount, 0)
    setResults(newResults)
    setTotalScore(newScore)
    setPhase('reveal')
  }

  function nextRound() {
    if (roundIdx + 1 >= TOTAL_ROUNDS) {
      // Game over
      if (payload) saveBest(payload.date, totalScore)
      setStored(loadBest())
      setPhase('done')
    } else {
      setRoundIdx((i) => i + 1)
      setOrder([0, 1, 2, 3])
      setPhase('playing')
    }
  }

  function share() {
    const today = todayUTC()
    const grade = gradeScore(totalScore)
    const text = `🏙️ Civic Rank ${today}\n${totalScore}/${TOTAL_ROUNDS * LAWS_PER_ROUND} — ${grade.label}\nlobby.market/civic-rank`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const timerColor =
    timerSeconds > 15 ? 'bg-emerald' : timerSeconds > 8 ? 'bg-gold' : 'bg-against-500'

  // ── Idle screen ───────────────────────────────────────────────────────────────────────────
  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24 gap-6">
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="h-20 w-20 rounded-3xl bg-gradient-to-br from-for-600/30 to-gold/20 border border-surface-400/40 flex items-center justify-center"
          >
            <ArrowDownUp className="h-9 w-9 text-gold" />
          </motion.div>

          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <h1 className="text-2xl font-bold text-white mb-1">Civic Rank</h1>
            <p className="text-sm text-surface-400 max-w-xs">
              Sort 4 laws by community support — most FOR% first. 5 rounds, same laws every day.
            </p>
          </motion.div>

          {/* How it works */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="w-full max-w-sm bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3"
          >
            {[
              { icon: ArrowUpDown, label: '4 laws per round — use ↑↓ to reorder', color: 'text-gold' },
              { icon: Timer, label: '25 seconds per round', color: 'text-against-400' },
              { icon: BarChart2, label: 'Sorted by % voted FOR — highest first', color: 'text-for-400' },
              { icon: Trophy, label: 'Score = laws in correct position (max 20)', color: 'text-gold' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-lg bg-surface-200 flex items-center justify-center flex-shrink-0">
                  <Icon className={cn('h-4 w-4', color)} />
                </div>
                <p className="text-xs text-surface-300">{label}</p>
              </div>
            ))}
          </motion.div>

          {/* Best score */}
          {stored && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-2 text-xs font-mono text-surface-500"
            >
              <Trophy className="h-3.5 w-3.5 text-gold" />
              <span>
                {stored.date === todayUTC()
                  ? `Today's score: ${stored.score}/${TOTAL_ROUNDS * LAWS_PER_ROUND}`
                  : `Best: ${stored.score}/${TOTAL_ROUNDS * LAWS_PER_ROUND} (${stored.date})`}
              </span>
            </motion.div>
          )}

          <motion.button
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            onClick={startGame}
            disabled={phase === 'loading'}
            className="w-full max-w-sm h-12 rounded-2xl font-semibold text-sm bg-gradient-to-r from-for-600 to-for-500 hover:from-for-500 hover:to-for-400 text-white disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {phase === 'loading' ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Loading rounds…</>
            ) : (
              <><ArrowDownUp className="h-4 w-4" /> Start Ranking</>
            )}
          </motion.button>

          <Link href="/arcade" className="text-xs font-mono text-surface-600 hover:text-surface-400 flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Back to Arcade
          </Link>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Playing screen ─────────────────────────────────────────────────────────────────────
  if (phase === 'playing' && currentRound) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col px-4 pt-4 pb-24 gap-4 max-w-lg mx-auto w-full">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDownUp className="h-4 w-4 text-gold" />
              <span className="text-sm font-mono font-bold text-white">
                Round {roundIdx + 1}<span className="text-surface-500">/{TOTAL_ROUNDS}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Timer className={cn('h-3.5 w-3.5', timerSeconds <= 8 ? 'text-against-400' : timerSeconds <= 15 ? 'text-gold' : 'text-emerald')} />
              <span className={cn('text-sm font-mono font-bold tabular-nums w-6 text-right', timerSeconds <= 8 ? 'text-against-400' : timerSeconds <= 15 ? 'text-gold' : 'text-emerald')}>
                {timerSeconds}
              </span>
            </div>
          </div>

          {/* Timer bar */}
          <div className="h-1 w-full bg-surface-300 rounded-full overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full transition-colors duration-500', timerColor)}
              animate={{ width: `${(timerSeconds / ROUND_SECONDS) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Instruction */}
          <p className="text-xs font-mono text-surface-500 text-center">
            Sort from <span className="text-for-400 font-semibold">most FOR%</span> (top) to{' '}
            <span className="text-against-400 font-semibold">least FOR%</span> (bottom)
          </p>

          {/* Score progress */}
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: TOTAL_ROUNDS }, (_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full',
                  i < roundIdx
                    ? 'bg-for-500'
                    : i === roundIdx
                    ? 'bg-surface-400'
                    : 'bg-surface-600'
                )}
              />
            ))}
          </div>

          {/* Law cards */}
          <div className="flex flex-col gap-2">
            {order.map((lawIdx, pos) => (
              <LawCard
                key={lawIdx}
                law={currentRound.laws[lawIdx]}
                position={pos + 1}
                total={LAWS_PER_ROUND}
                onMoveUp={() => moveUp(pos)}
                onMoveDown={() => moveDown(pos)}
                disabled={false}
              />
            ))}
          </div>

          {/* Lock In button */}
          <button
            onClick={lockIn}
            className="w-full h-11 rounded-2xl font-semibold text-sm bg-for-600 hover:bg-for-500 text-white transition-colors flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            Lock In
          </button>

          {/* Running score */}
          {results.length > 0 && (
            <p className="text-xs font-mono text-surface-500 text-center">
              Running score: <span className="text-white font-semibold">{totalScore}</span>/{results.length * LAWS_PER_ROUND}
            </p>
          )}
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Reveal screen ────────────────────────────────────────────────────────────────────────
  if (phase === 'reveal' && currentRound) {
    const lastResult = results[results.length - 1]
    const correct = lastResult.correctOrder

    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col px-4 pt-4 pb-24 gap-4 max-w-lg mx-auto w-full">
          {/* Round result header */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center"
          >
            <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-1">
              Round {roundIdx + 1} Result
            </p>
            <p className="text-3xl font-bold text-white">
              {lastResult.correctCount}/{LAWS_PER_ROUND}
              <span className="text-lg font-mono text-surface-500 ml-2">correct</span>
            </p>
          </motion.div>

          {/* Correct order revealed */}
          <div className="flex flex-col gap-2">
            {correct.map((lawIdx, pos) => (
              <RevealCard
                key={lawIdx}
                law={currentRound.laws[lawIdx]}
                position={pos + 1}
                correctPosition={pos + 1}
                isCorrect={lastResult.userOrder[pos] === lawIdx}
              />
            ))}
          </div>

          {/* Running total */}
          <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 flex items-center justify-between">
            <span className="text-xs font-mono text-surface-500">
              Total ({roundIdx + 1}/{TOTAL_ROUNDS} rounds)
            </span>
            <span className="text-sm font-mono font-bold text-white">
              {totalScore}/{(roundIdx + 1) * LAWS_PER_ROUND}
            </span>
          </div>

          {/* Next / Finish */}
          <button
            onClick={nextRound}
            className="w-full h-11 rounded-2xl font-semibold text-sm bg-for-600 hover:bg-for-500 text-white transition-colors flex items-center justify-center gap-2"
          >
            {roundIdx + 1 >= TOTAL_ROUNDS ? (
              <><Trophy className="h-4 w-4" /> See Final Score</>
            ) : (
              <>Round {roundIdx + 2} →</>
            )}
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Done / results screen ───────────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const grade = gradeScore(totalScore)
    const maxScore = TOTAL_ROUNDS * LAWS_PER_ROUND

    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col px-4 pt-4 pb-24 gap-5 max-w-lg mx-auto w-full">
          {/* Trophy / grade */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-gold/30 to-for-600/20 border border-gold/30 flex items-center justify-center">
              <span className={cn('text-4xl font-bold font-mono', grade.color)}>
                {grade.letter}
              </span>
            </div>
            <div className="text-center">
              <p className={cn('text-lg font-bold', grade.color)}>{grade.label}</p>
              <p className="text-3xl font-bold text-white mt-0.5">
                {totalScore}<span className="text-xl text-surface-500">/{maxScore}</span>
              </p>
              <p className="text-xs font-mono text-surface-500 mt-1">
                {Math.round((totalScore / maxScore) * 100)}% correct
              </p>
            </div>
          </motion.div>

          {/* Round breakdown */}
          <div className="bg-surface-100 border border-surface-300 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-surface-300/50">
              <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">Round Breakdown</span>
            </div>
            <div className="divide-y divide-surface-300/50">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-mono text-surface-400">Round {i + 1}</span>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: LAWS_PER_ROUND }, (_, p) => (
                      <div
                        key={p}
                        className={cn(
                          'h-2 w-2 rounded-full',
                          r.userOrder[p] === r.correctOrder[p] ? 'bg-emerald' : 'bg-against-500'
                        )}
                      />
                    ))}
                    <span className="text-xs font-mono font-bold text-white ml-1">
                      {r.correctCount}/{LAWS_PER_ROUND}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Best score */}
          {stored && (
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-surface-500">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              <span>Best today: <span className="text-gold font-semibold">{stored.score}/{maxScore}</span></span>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={share}
              className="w-full h-11 rounded-2xl font-semibold text-sm bg-surface-200 hover:bg-surface-300 text-white transition-colors flex items-center justify-center gap-2 border border-surface-400/40"
            >
              {copied ? <><Check className="h-4 w-4 text-emerald" /> Copied!</> : <><Copy className="h-4 w-4" /><Share2 className="h-4 w-4" /> Share Result</>}
            </button>
            <button
              onClick={startGame}
              className="w-full h-11 rounded-2xl font-semibold text-sm bg-for-600 hover:bg-for-500 text-white transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Play Again
            </button>
          </div>

          {/* Links */}
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/law"
              className="text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> Browse Laws
            </Link>
            <Link
              href="/arcade"
              className="text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" /> Arcade
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // Fallback loading state
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col px-4 pt-4 pb-24 gap-4 max-w-lg mx-auto w-full">
        <GameSkeleton />
      </main>
      <BottomNav />
    </div>
  )
}
