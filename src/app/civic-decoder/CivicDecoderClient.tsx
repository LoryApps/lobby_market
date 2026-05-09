'use client'

/**
 * /civic-decoder — Civic Decoder
 *
 * A daily puzzle where players read 3 real arguments from a mystery civic
 * topic and identify which of 4 topic statements those arguments came from.
 *
 * 5 rounds — 10 pts per correct answer — 50 pts max.
 * Daily lock: once played, results are stored in localStorage.
 * Same puzzle (same seed) for every player each calendar day.
 *
 * Storage key: lm_decoder_v1 → { date, score, answers[] }
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Gamepad2,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DecoderPayload, DecoderRound, DecoderOption } from '@/app/api/civic-decoder/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_decoder_v1'
const TOTAL_ROUNDS = 5
const PTS_PER_CORRECT = 10
const SECONDS_PER_ROUND = 30

// ─── Storage helpers ──────────────────────────────────────────────────────────

interface RoundAnswer {
  correct: boolean
  picked_index: number
  answer_index: number
  time_taken: number
}

interface StoredResult {
  date: string
  score: number
  answers: RoundAnswer[]
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadResult(): StoredResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredResult
    return parsed.date === todayStr() ? parsed : null
  } catch {
    return null
  }
}

function saveResult(r: StoredResult) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r))
  } catch {}
}

function buildShareText(score: number, answers: RoundAnswer[]): string {
  const pips = answers
    .map((a) => (a.correct ? '🟩' : '🟥'))
    .join('')
  return [
    `Civic Decoder — ${todayStr()}`,
    pips,
    `${score}/${TOTAL_ROUNDS * PTS_PER_CORRECT} pts`,
    'lobby.market/civic-decoder',
  ].join('\n')
}

// ─── Category colour ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-for-300',
  Philosophy: 'text-purple',
  Culture: 'text-against-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

function catColor(c: string | null) {
  if (!c) return 'text-surface-400'
  for (const [k, v] of Object.entries(CAT_COLOR)) {
    if (c.toLowerCase().includes(k.toLowerCase())) return v
  }
  return 'text-surface-400'
}

// ─── Timer bar ────────────────────────────────────────────────────────────────

function TimerBar({ seconds, total }: { seconds: number; total: number }) {
  const pct = (seconds / total) * 100
  const color =
    pct > 50
      ? 'bg-emerald'
      : pct > 20
      ? 'bg-gold'
      : 'bg-against-500'

  return (
    <div className="w-full h-1.5 bg-surface-300/40 rounded-full overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full transition-colors', color)}
        style={{ width: `${pct}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  )
}

// ─── Snippet card ─────────────────────────────────────────────────────────────

function SnippetCard({
  text,
  side,
  index,
}: {
  text: string
  side: 'blue' | 'red'
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cn(
        'p-3.5 rounded-xl border text-sm font-mono',
        side === 'blue'
          ? 'bg-for-500/8 border-for-500/25 text-surface-700'
          : 'bg-against-500/8 border-against-500/25 text-surface-700'
      )}
    >
      <div className="flex items-center gap-1.5 mb-2">
        {side === 'blue' ? (
          <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'text-[10px] font-bold tracking-widest uppercase',
            side === 'blue' ? 'text-for-400' : 'text-against-400'
          )}
        >
          {side === 'blue' ? 'FOR' : 'AGAINST'}
        </span>
      </div>
      <p className="text-white/90 leading-relaxed">&ldquo;{text}&rdquo;</p>
    </motion.div>
  )
}

// ─── Option button ────────────────────────────────────────────────────────────

function OptionButton({
  option,
  index,
  picked,
  answerIndex,
  revealed,
  onPick,
}: {
  option: DecoderOption
  index: number
  picked: number | null
  answerIndex: number
  revealed: boolean
  onPick: (i: number) => void
}) {
  const isCorrect = index === answerIndex
  const isPicked = index === picked
  const isWrong = isPicked && !isCorrect

  let base =
    'w-full text-left px-4 py-3 rounded-xl border font-mono text-sm transition-all duration-200'

  if (!revealed) {
    base += isPicked
      ? ' bg-purple/20 border-purple/50 text-white'
      : ' bg-surface-200/60 border-surface-300/50 text-surface-700 hover:border-surface-400/70 hover:text-white'
  } else {
    if (isCorrect) {
      base += ' bg-emerald/15 border-emerald/50 text-white'
    } else if (isWrong) {
      base += ' bg-against-500/15 border-against-500/40 text-surface-500 line-through'
    } else {
      base += ' bg-surface-200/30 border-surface-300/30 text-surface-600 opacity-50'
    }
  }

  const letters = ['A', 'B', 'C', 'D']

  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 + 0.2 }}
      className={base}
      onClick={() => !revealed && onPick(index)}
      disabled={revealed}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold mt-0.5',
            revealed && isCorrect
              ? 'bg-emerald text-white'
              : revealed && isWrong
              ? 'bg-against-500 text-white'
              : 'bg-surface-300/60 text-surface-500'
          )}
        >
          {revealed && isCorrect ? (
            <Check className="h-3 w-3" />
          ) : revealed && isWrong ? (
            <X className="h-3 w-3" />
          ) : (
            letters[index]
          )}
        </span>
        <span className="leading-snug">{option.statement}</span>
      </div>
    </motion.button>
  )
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultScreen({
  score,
  answers,
}: {
  score: number
  answers: RoundAnswer[]
}) {
  const [copied, setCopied] = useState(false)
  const max = TOTAL_ROUNDS * PTS_PER_CORRECT
  const pct = Math.round((score / max) * 100)

  async function copy() {
    try {
      await navigator.clipboard.writeText(buildShareText(score, answers))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const grade =
    score === max
      ? 'Perfect Decode'
      : score >= 40
      ? 'Sharp Decoder'
      : score >= 30
      ? 'Solid Reader'
      : score >= 20
      ? 'Getting Warmer'
      : 'Keep Practicing'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-lg mx-auto"
    >
      {/* Score card */}
      <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-6 text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Trophy className="h-5 w-5 text-gold" />
          <span className="text-xs font-mono font-bold text-gold tracking-widest uppercase">
            {grade}
          </span>
        </div>
        <div className="font-mono text-6xl font-bold text-white mt-2">
          {score}
          <span className="text-2xl text-surface-500">/{max}</span>
        </div>
        <p className="text-sm text-surface-500 font-mono mt-1">{pct}% correct</p>

        {/* Round pips */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {answers.map((a, i) => (
            <div
              key={i}
              className={cn(
                'h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono',
                a.correct
                  ? 'bg-emerald/20 text-emerald border border-emerald/40'
                  : 'bg-against-500/15 text-against-400 border border-against-500/30'
              )}
            >
              {a.correct ? '+10' : '0'}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={copy}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-sm font-mono text-white hover:bg-surface-300/60 transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-emerald" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Share Result'}
        </button>
        <Link
          href="/arcade"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple/20 border border-purple/40 text-sm font-mono text-white hover:bg-purple/30 transition-colors"
        >
          <Gamepad2 className="h-4 w-4 text-purple" />
          More Games
        </Link>
      </div>

      {/* Come back tomorrow */}
      <p className="text-center text-xs text-surface-600 font-mono">
        New puzzle available tomorrow. Come back daily to keep your civic intuition sharp.
      </p>
    </motion.div>
  )
}

// ─── Main game ────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'intro' | 'playing' | 'done' | 'already_done' | 'error'

export function CivicDecoderClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [payload, setPayload] = useState<DecoderPayload | null>(null)
  const [currentRound, setCurrentRound] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState<RoundAnswer[]>([])
  const [storedResult, setStoredResult] = useState<StoredResult | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_ROUND)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundStartRef = useRef<number>(Date.now())

  // Load stored result on mount
  useEffect(() => {
    const stored = loadResult()
    if (stored) {
      setStoredResult(stored)
      setScore(stored.score)
      setAnswers(stored.answers)
      setPhase('already_done')
    } else {
      setPhase('intro')
    }
  }, [])

  // Fetch puzzle data
  const fetchPuzzle = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/civic-decoder')
      if (!res.ok) throw new Error('Failed to load puzzle')
      const data: DecoderPayload = await res.json()
      setPayload(data)
      setPhase('intro')
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    const stored = loadResult()
    if (!stored) fetchPuzzle()
  }, [fetchPuzzle])

  // Timer logic
  function startTimer() {
    clearTimer()
    roundStartRef.current = Date.now()
    setSecondsLeft(SECONDS_PER_ROUND)
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearTimer()
          handleTimeout()
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function handleTimeout() {
    if (revealed) return
    const round = payload!.rounds[currentRound]
    const answer: RoundAnswer = {
      correct: false,
      picked_index: -1,
      answer_index: round.answer_index,
      time_taken: SECONDS_PER_ROUND,
    }
    setAnswers((prev) => [...prev, answer])
    setRevealed(true)
  }

  function handlePick(index: number) {
    if (revealed || !payload) return
    clearTimer()

    const round = payload.rounds[currentRound]
    const isCorrect = index === round.answer_index
    const timeTaken = Math.round((Date.now() - roundStartRef.current) / 1000)

    const answer: RoundAnswer = {
      correct: isCorrect,
      picked_index: index,
      answer_index: round.answer_index,
      time_taken: timeTaken,
    }

    setPicked(index)
    setRevealed(true)
    if (isCorrect) setScore((s) => s + PTS_PER_CORRECT)
    setAnswers((prev) => [...prev, answer])
  }

  function handleNext() {
    if (!payload) return
    const nextRound = currentRound + 1

    if (nextRound >= TOTAL_ROUNDS) {
      const finalAnswers = [...answers]
      const finalScore = finalAnswers.filter((a) => a.correct).length * PTS_PER_CORRECT
      const result: StoredResult = {
        date: todayStr(),
        score: finalScore,
        answers: finalAnswers,
      }
      saveResult(result)
      setStoredResult(result)
      setPhase('done')
    } else {
      setCurrentRound(nextRound)
      setPicked(null)
      setRevealed(false)
      startTimer()
    }
  }

  function handleStart() {
    setPhase('playing')
    setCurrentRound(0)
    setPicked(null)
    setRevealed(false)
    setScore(0)
    setAnswers([])
    startTimer()
  }

  useEffect(() => {
    return () => clearTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const round: DecoderRound | undefined = payload?.rounds[currentRound]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/arcade"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200/60 border border-surface-300/50 text-surface-500 hover:text-white transition-colors"
            aria-label="Back to Arcade"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="font-mono text-xl font-bold text-white">Civic Decoder</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Read 3 arguments. Identify the topic. 5 rounds.
            </p>
          </div>
          <Badge variant="proposed">Daily</Badge>
        </div>

        {/* ── Loading ── */}
        {phase === 'loading' && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <div className="text-center py-16">
            <p className="text-surface-500 font-mono text-sm mb-4">
              Could not load today&apos;s puzzle. Try again?
            </p>
            <button
              onClick={fetchPuzzle}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300/60 text-sm font-mono text-white hover:bg-surface-300/60 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* ── Intro ── */}
        {phase === 'intro' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-purple/10 border border-purple/30">
              <Search className="h-10 w-10 text-purple" />
            </div>
            <h2 className="font-mono text-2xl font-bold text-white mb-2">Crack the Code</h2>
            <p className="text-surface-500 font-mono text-sm leading-relaxed mb-8">
              Each round shows{' '}
              <span className="text-white font-semibold">3 real arguments</span> from a mystery civic topic.
              Read them carefully and pick which of 4 topics they came from.
            </p>
            <div className="grid grid-cols-3 gap-3 mb-8 text-center">
              {[
                { icon: Timer, label: '30 sec', sub: 'per round', color: 'text-gold' },
                { icon: Zap, label: '5 rounds', sub: '10 pts each', color: 'text-emerald' },
                { icon: Trophy, label: '50 pts', sub: 'max score', color: 'text-gold' },
              ].map(({ icon: Icon, label, sub, color }) => (
                <div
                  key={label}
                  className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-3"
                >
                  <Icon className={cn('h-5 w-5 mx-auto mb-1', color)} />
                  <p className={cn('font-mono text-sm font-bold', color)}>{label}</p>
                  <p className="font-mono text-[11px] text-surface-500 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
            <button
              onClick={handleStart}
              className="w-full py-4 rounded-xl bg-purple font-mono font-bold text-white text-base hover:bg-purple/80 transition-colors flex items-center justify-center gap-2"
            >
              Start Decoding
              <ArrowRight className="h-5 w-5" />
            </button>
          </motion.div>
        )}

        {/* ── Already done ── */}
        {phase === 'already_done' && storedResult && (
          <div>
            <div className="text-center mb-6">
              <p className="text-sm font-mono text-surface-500 mb-2">
                You already cracked today&apos;s puzzle.
              </p>
              <p className="text-xs font-mono text-surface-600">
                New puzzle resets at midnight.
              </p>
            </div>
            <ResultScreen score={storedResult.score} answers={storedResult.answers} />
          </div>
        )}

        {/* ── Playing ── */}
        {phase === 'playing' && round && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentRound}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              {/* Progress + timer */}
              <div className="flex items-center justify-between text-xs font-mono text-surface-500 mb-1">
                <span>
                  Round{' '}
                  <span className="text-white font-bold">{currentRound + 1}</span>
                  {' '}of {TOTAL_ROUNDS}
                </span>
                <span
                  className={cn(
                    'font-bold tabular-nums',
                    secondsLeft <= 10 ? 'text-against-400' : secondsLeft <= 20 ? 'text-gold' : 'text-emerald'
                  )}
                >
                  {secondsLeft}s
                </span>
              </div>
              <TimerBar seconds={secondsLeft} total={SECONDS_PER_ROUND} />

              {/* Category hint */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-surface-600">Category:</span>
                <span className={cn('text-xs font-mono font-bold', catColor(round.category))}>
                  {round.category ?? 'Unknown'}
                </span>
              </div>

              {/* Instruction */}
              <p className="text-xs font-mono text-surface-600 -mt-1">
                Which topic do these arguments come from?
              </p>

              {/* Snippets */}
              <div className="flex flex-col gap-2.5">
                {round.snippets.map((s, i) => (
                  <SnippetCard key={i} text={s.text} side={s.side} index={i} />
                ))}
              </div>

              {/* Options */}
              <div className="flex flex-col gap-2 mt-2">
                {round.options.map((opt, i) => (
                  <OptionButton
                    key={opt.id}
                    option={opt}
                    index={i}
                    picked={picked}
                    answerIndex={round.answer_index}
                    revealed={revealed}
                    onPick={handlePick}
                  />
                ))}
              </div>

              {/* Feedback + next */}
              <AnimatePresence>
                {revealed && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between pt-2"
                  >
                    <div className="flex items-center gap-2">
                      {picked === round.answer_index ? (
                        <>
                          <div className="h-6 w-6 rounded-full bg-emerald/20 flex items-center justify-center">
                            <Check className="h-3.5 w-3.5 text-emerald" />
                          </div>
                          <span className="text-sm font-mono font-bold text-emerald">
                            +{PTS_PER_CORRECT} pts
                          </span>
                        </>
                      ) : picked === -1 ? (
                        <>
                          <div className="h-6 w-6 rounded-full bg-against-500/20 flex items-center justify-center">
                            <Timer className="h-3.5 w-3.5 text-against-400" />
                          </div>
                          <span className="text-sm font-mono text-against-400">Time&apos;s up!</span>
                        </>
                      ) : (
                        <>
                          <div className="h-6 w-6 rounded-full bg-against-500/20 flex items-center justify-center">
                            <X className="h-3.5 w-3.5 text-against-400" />
                          </div>
                          <span className="text-sm font-mono text-against-400">Incorrect</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={handleNext}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple font-mono text-sm font-bold text-white hover:bg-purple/80 transition-colors"
                    >
                      {currentRound + 1 >= TOTAL_ROUNDS ? 'See Results' : 'Next'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Done ── */}
        {phase === 'done' && (
          <ResultScreen score={score} answers={answers} />
        )}
      </main>
      <BottomNav />
    </div>
  )
}
