'use client'

/**
 * /sprint — Civic Sprint
 *
 * 10-round prediction game using CLOSED topics (law or failed).
 * Each round: read the topic statement and community stats, then
 * guess whether the Lobby voted it into law or it failed.
 *
 * Scoring:
 *   Correct = +10 pts
 *   Wrong   = +0 pts
 *   Speed bonus: up to +5 pts for answers in under 5 seconds
 *
 * Max score: 150 (10 × 15). Best score saved to localStorage.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ExternalLink,
  Flame,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Share2,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { SprintResponse, SprintTopic } from '@/app/api/sprint/route'

// ─── Constants ───────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_sprint_best_v1'
const STORAGE_TODAY_KEY = 'lm_sprint_today_v1'
const ROUND_SECONDS = 15
const TOTAL_ROUNDS = 10
const POINTS_CORRECT = 10
const POINTS_SPEED_MAX = 5

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────

function loadBest(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const n = parseInt(raw, 10)
    return isNaN(n) ? 0 : n
  } catch {
    return 0
  }
}

function saveBest(score: number) {
  try {
    const current = loadBest()
    if (score > current) localStorage.setItem(STORAGE_KEY, String(score))
  } catch {
    // best-effort
  }
}

function saveTodayResult(score: number, seed: string) {
  try {
    localStorage.setItem(STORAGE_TODAY_KEY, JSON.stringify({ score, seed, ts: Date.now() }))
  } catch {
    // best-effort
  }
}

function loadTodayResult(seed: string): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_TODAY_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (obj.seed !== seed) return null
    return typeof obj.score === 'number' ? obj.score : null
  } catch {
    return null
  }
}

function categoryColor(cat: string | null): string {
  switch (cat) {
    case 'Politics':    return 'text-for-400 bg-for-500/10 border-for-500/30'
    case 'Economics':   return 'text-gold bg-gold/10 border-gold/30'
    case 'Technology':  return 'text-purple bg-purple/10 border-purple/30'
    case 'Science':     return 'text-emerald bg-emerald/10 border-emerald/30'
    case 'Social':      return 'text-against-400 bg-against-500/10 border-against-500/30'
    case 'Environment': return 'text-emerald bg-emerald/10 border-emerald/30'
    default:            return 'text-surface-400 bg-surface-300/20 border-surface-400/30'
  }
}

function formatVotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── Round result overlay ─────────────────────────────────────────────────────────────────────────────

interface RevealProps {
  correct: boolean
  outcome: 'law' | 'failed'
  blue_pct: number
  points: number
  onNext: () => void
  isLast: boolean
}

function RevealOverlay({ correct, outcome, blue_pct, points, onNext, isLast }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-0 flex flex-col items-center justify-center z-20 p-6 bg-surface-100/95 backdrop-blur-sm rounded-2xl"
    >
      <motion.div
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className={cn(
          'flex items-center justify-center h-20 w-20 rounded-full mb-4',
          correct ? 'bg-for-500/20 border-2 border-for-500/50' : 'bg-against-500/20 border-2 border-against-500/50',
        )}
      >
        {correct
          ? <CheckCircle2 className="h-10 w-10 text-for-400" />
          : <XCircle className="h-10 w-10 text-against-400" />}
      </motion.div>

      <p className={cn('text-2xl font-bold font-mono mb-1', correct ? 'text-for-400' : 'text-against-400')}>
        {correct ? 'Correct!' : 'Wrong'}
      </p>

      <div className="flex items-center gap-2 mb-4">
        {outcome === 'law'
          ? <Gavel className="h-4 w-4 text-gold" />
          : <XCircle className="h-4 w-4 text-surface-500" />}
        <span className="text-sm font-mono text-surface-300">
          {outcome === 'law' ? 'Became law' : 'Failed to pass'}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-500/10 border border-for-500/20">
          <div className="h-2 rounded-full bg-for-500" style={{ width: `${Math.min(40, blue_pct * 0.4)}px` }} />
          <span className="text-xs font-mono text-for-400">{blue_pct}% FOR</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-against-500/10 border border-against-500/20">
          <span className="text-xs font-mono text-against-400">{100 - blue_pct}% AGAINST</span>
        </div>
      </div>

      <div className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl mb-6 mt-2',
        correct ? 'bg-for-500/10 border border-for-500/20' : 'bg-surface-200 border border-surface-300/50',
      )}>
        <Zap className={cn('h-4 w-4', correct ? 'text-gold' : 'text-surface-500')} />
        <span className={cn('text-sm font-mono font-bold', correct ? 'text-gold' : 'text-surface-500')}>
          +{points} pts
        </span>
      </div>

      <button
        onClick={onNext}
        className={cn(
          'flex items-center gap-2 px-6 py-3 rounded-xl font-mono font-semibold text-sm',
          'bg-for-600 hover:bg-for-500 text-white transition-colors',
        )}
      >
        {isLast ? 'See Results' : 'Next Round'}
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  )
}

// ─── Results screen ─────────────────────────────────────────────────────────────────────────────

interface ResultsProps {
  score: number
  answers: { correct: boolean; topic: SprintTopic; points: number }[]
  best: number
  onReplay: () => void
}

function ResultsScreen({ score, answers, best, onReplay }: ResultsProps) {
  const correct = answers.filter((a) => a.correct).length
  const pct = Math.round((score / (TOTAL_ROUNDS * (POINTS_CORRECT + POINTS_SPEED_MAX))) * 100)

  let grade = 'C'
  let gradeColor = 'text-gold'
  if (pct >= 90) { grade = 'S'; gradeColor = 'text-gold' }
  else if (pct >= 75) { grade = 'A'; gradeColor = 'text-for-400' }
  else if (pct >= 60) { grade = 'B'; gradeColor = 'text-for-400' }
  else if (pct >= 40) { grade = 'C'; gradeColor = 'text-surface-400' }
  else { grade = 'D'; gradeColor = 'text-against-400' }

  function handleShare() {
    const text = `Civic Sprint — ${score} pts (${correct}/${TOTAL_ROUNDS} correct) · Grade ${grade}\nTest your civic judgment at Lobby Market`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).catch(() => {})
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto"
    >
      {/* Grade circle */}
      <div className="relative flex flex-col items-center">
        <div className={cn(
          'flex items-center justify-center h-28 w-28 rounded-full border-4',
          'bg-surface-200/80',
          pct >= 75 ? 'border-for-500/60' : pct >= 50 ? 'border-gold/60' : 'border-against-500/40',
        )}>
          <span className={cn('text-5xl font-black font-mono', gradeColor)}>{grade}</span>
        </div>
        {score >= best && score > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="absolute -top-3 -right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/20 border border-gold/40"
          >
            <Trophy className="h-3 w-3 text-gold" />
            <span className="text-[10px] font-mono text-gold">New best!</span>
          </motion.div>
        )}
      </div>

      {/* Score */}
      <div className="text-center">
        <p className="text-4xl font-black font-mono text-white">{score} pts</p>
        <p className="text-sm font-mono text-surface-400 mt-1">
          {correct} of {TOTAL_ROUNDS} correct · best: {best} pts
        </p>
      </div>

      {/* Round recap */}
      <div className="w-full grid grid-cols-5 gap-1.5">
        {answers.map((a, i) => (
          <div
            key={i}
            className={cn(
              'flex flex-col items-center gap-1 p-2 rounded-lg border',
              a.correct
                ? 'bg-for-500/10 border-for-500/30'
                : 'bg-against-500/10 border-against-500/30',
            )}
          >
            <span className="text-[10px] font-mono text-surface-500">R{i + 1}</span>
            {a.correct
              ? <CheckCircle2 className="h-4 w-4 text-for-400" />
              : <XCircle className="h-4 w-4 text-against-400" />}
            <span className={cn('text-[10px] font-mono', a.correct ? 'text-for-400' : 'text-surface-500')}>
              +{a.points}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 w-full">
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-400/40 bg-surface-200 hover:bg-surface-300 text-surface-300 hover:text-white font-mono text-sm font-semibold transition-colors"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
        <button
          onClick={onReplay}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600 hover:bg-for-500 text-white font-mono text-sm font-semibold transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Play Again
        </button>
      </div>

      <Link
        href="/arcade"
        className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Arcade
      </Link>
    </motion.div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────────────────────

type GameState = 'loading' | 'intro' | 'playing' | 'reveal' | 'done' | 'error'

export function SprintClient() {
  const [gameState, setGameState] = useState<GameState>('loading')
  const [topics, setTopics] = useState<SprintTopic[]>([])
  const [seed, setSeed] = useState('')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [answers, setAnswers] = useState<{ correct: boolean; topic: SprintTopic; points: number }[]>([])
  const [lastResult, setLastResult] = useState<{ correct: boolean; points: number } | null>(null)
  const [todayResult, setTodayResult] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundStartRef = useRef<number>(Date.now())

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const loadGame = useCallback(async () => {
    setGameState('loading')
    try {
      const res = await fetch('/api/sprint')
      const data: SprintResponse = await res.json()
      if (!data.topics || data.topics.length === 0) {
        setGameState('error')
        return
      }
      setTopics(data.topics)
      setSeed(data.seed)
      const todayScore = loadTodayResult(data.seed)
      setTodayResult(todayScore)
      setBest(loadBest())
      setGameState('intro')
    } catch {
      setGameState('error')
    }
  }, [])

  useEffect(() => { loadGame() }, [loadGame])

  // Countdown timer during play
  useEffect(() => {
    if (gameState !== 'playing') {
      stopTimer()
      return
    }
    setTimeLeft(ROUND_SECONDS)
    roundStartRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time expired — auto-answer wrong
          stopTimer()
          const topic = topics[round]
          const newAnswers = [...answers, { correct: false, topic, points: 0 }]
          setAnswers(newAnswers)
          setLastResult({ correct: false, points: 0 })
          setGameState('reveal')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return stopTimer
  }, [gameState, round]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleGuess(guess: 'law' | 'failed') {
    stopTimer()
    const topic = topics[round]
    const correct = guess === topic.outcome
    const elapsed = (Date.now() - roundStartRef.current) / 1000
    const speedBonus = correct
      ? Math.max(0, Math.round(POINTS_SPEED_MAX * (1 - elapsed / ROUND_SECONDS)))
      : 0
    const pts = correct ? POINTS_CORRECT + speedBonus : 0
    const newScore = score + pts
    const newAnswers = [...answers, { correct, topic, points: pts }]
    setScore(newScore)
    setAnswers(newAnswers)
    setLastResult({ correct, points: pts })
    setGameState('reveal')
  }

  function handleNext() {
    const nextRound = round + 1
    if (nextRound >= topics.length) {
      saveBest(score)
      saveTodayResult(score, seed)
      setBest(loadBest())
      setGameState('done')
    } else {
      setRound(nextRound)
      setLastResult(null)
      setGameState('playing')
    }
  }

  function startGame() {
    setRound(0)
    setScore(0)
    setAnswers([])
    setLastResult(null)
    setGameState('playing')
  }

  const currentTopic = topics[round] ?? null
  const timerPct = (timeLeft / ROUND_SECONDS) * 100
  const timerColor = timeLeft > 8 ? 'bg-for-500' : timeLeft > 4 ? 'bg-gold' : 'bg-against-500'

  // ─── Loading ─────────────────────────────────────────────────────────────────────────────

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 text-for-400 animate-spin" />
          <p className="text-sm font-mono text-surface-400">Loading today&apos;s sprint…</p>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ─── Error ─────────────────────────────────────────────────────────────────────────────

  if (gameState === 'error') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
          <Scale className="h-10 w-10 text-against-400" />
          <p className="text-sm font-mono text-surface-400 text-center">
            Not enough closed topics to generate a sprint yet. Check back soon.
          </p>
          <Link href="/arcade" className="text-sm font-mono text-for-400 hover:underline">
            Back to Arcade
          </Link>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ─── Done ─────────────────────────────────────────────────────────────────────────────

  if (gameState === 'done') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 py-8 max-w-lg mx-auto w-full">
          <ResultsScreen
            score={score}
            answers={answers}
            best={best}
            onReplay={() => {
              setRound(0)
              setScore(0)
              setAnswers([])
              setGameState('intro')
            }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ─── Intro ─────────────────────────────────────────────────────────────────────────────

  if (gameState === 'intro') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 max-w-lg mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-5 text-center"
          >
            <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-gold/10 border border-gold/30">
              <Timer className="h-10 w-10 text-gold" />
            </div>

            <div>
              <h1 className="text-3xl font-black font-mono text-white mb-1">Civic Sprint</h1>
              <p className="text-sm font-mono text-surface-400">
                {TOTAL_ROUNDS} rounds · {ROUND_SECONDS}s each · predict law or fail
              </p>
            </div>

            <div className="w-full rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4 text-left space-y-2.5">
              {[
                { icon: Scale, text: 'Read each closed topic and its community stats', color: 'text-for-400' },
                { icon: Gavel, text: 'Guess: did it become law or fail to pass?', color: 'text-gold' },
                { icon: Timer, text: `Answer within ${ROUND_SECONDS}s — speed bonus for quick calls`, color: 'text-purple' },
                { icon: Award, text: `Up to ${POINTS_CORRECT + POINTS_SPEED_MAX} pts per round · max ${TOTAL_ROUNDS * (POINTS_CORRECT + POINTS_SPEED_MAX)} total`, color: 'text-emerald' },
              ].map(({ icon: Icon, text, color }, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', color)} />
                  <p className="text-xs font-mono text-surface-300">{text}</p>
                </div>
              ))}
            </div>

            {todayResult !== null && (
              <div className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-gold/10 border border-gold/30">
                <Trophy className="h-4 w-4 text-gold flex-shrink-0" />
                <p className="text-xs font-mono text-gold">
                  Today&apos;s score: <strong>{todayResult} pts</strong> — play again for fun
                </p>
              </div>
            )}

            {best > 0 && (
              <p className="text-xs font-mono text-surface-500">
                Personal best: <span className="text-gold">{best} pts</span>
              </p>
            )}
          </motion.div>

          <button
            onClick={startGame}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-4 rounded-2xl',
              'bg-gold hover:bg-gold/90 text-surface-50 font-mono font-black text-lg',
              'transition-colors shadow-lg shadow-gold/20',
            )}
          >
            <Zap className="h-5 w-5" />
            Start Sprint
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ─── Playing / Reveal ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 flex flex-col px-4 pt-4 pb-24 md:pb-8 max-w-lg mx-auto w-full gap-4">

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <Link
            href="/arcade"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 flex gap-1">
            {Array.from({ length: topics.length }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-300',
                  i < round
                    ? (answers[i]?.correct ? 'bg-for-500' : 'bg-against-500')
                    : i === round
                    ? 'bg-white/60'
                    : 'bg-surface-300/40',
                )}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-surface-400 flex-shrink-0">
            {round + 1}/{topics.length}
          </span>
        </div>

        {/* Score strip */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-against-400" />
            <span className="text-sm font-mono text-white font-bold">{score} pts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-gold" />
            <span className="text-xs font-mono text-surface-400">best {best}</span>
          </div>
        </div>

        {/* Timer bar */}
        {gameState === 'playing' && (
          <div className="h-1.5 w-full rounded-full bg-surface-300/40 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full transition-colors', timerColor)}
              style={{ width: `${timerPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}

        {/* Topic card */}
        {currentTopic && (
          <div className="relative flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={round}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <div className="relative rounded-2xl bg-surface-100 border border-surface-300/60 p-5 flex flex-col gap-4 min-h-[280px]">
                  {/* Timer + category */}
                  <div className="flex items-center justify-between">
                    {currentTopic.category && (
                      <span className={cn(
                        'text-[11px] font-mono font-semibold px-2 py-0.5 rounded border',
                        categoryColor(currentTopic.category),
                      )}>
                        {currentTopic.category}
                      </span>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <Timer className={cn('h-3.5 w-3.5', timeLeft <= 4 ? 'text-against-400' : 'text-surface-400')} />
                      <span className={cn(
                        'text-xs font-mono font-bold',
                        timeLeft <= 4 ? 'text-against-400' : timeLeft <= 8 ? 'text-gold' : 'text-surface-400',
                      )}>
                        {timeLeft}s
                      </span>
                    </div>
                  </div>

                  {/* Statement */}
                  <p className="text-base font-semibold text-white leading-snug flex-1">
                    {currentTopic.statement}
                  </p>

                  {/* Community stats hint */}
                  <div className="flex items-center gap-3 pt-2 border-t border-surface-300/40">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-surface-400">
                      <Scale className="h-3.5 w-3.5" />
                      <span>{formatVotes(currentTopic.total_votes)} votes cast</span>
                    </div>
                    <Link
                      href={`/topic/${currentTopic.id}`}
                      target="_blank"
                      className="ml-auto text-surface-500 hover:text-white transition-colors"
                      aria-label="View topic"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  {/* Reveal overlay */}
                  <AnimatePresence>
                    {gameState === 'reveal' && lastResult && (
                      <RevealOverlay
                        correct={lastResult.correct}
                        outcome={currentTopic.outcome}
                        blue_pct={currentTopic.blue_pct}
                        points={lastResult.points}
                        onNext={handleNext}
                        isLast={round >= topics.length - 1}
                      />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Guess buttons — only during playing */}
        {gameState === 'playing' && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => handleGuess('law')}
              className={cn(
                'flex flex-col items-center gap-2 py-5 rounded-2xl border',
                'bg-for-600/20 border-for-500/40 hover:bg-for-600/40 hover:border-for-400/60',
                'transition-all',
              )}
            >
              <Gavel className="h-6 w-6 text-for-400" />
              <span className="text-sm font-mono font-bold text-for-300">Became Law</span>
              <span className="text-[10px] font-mono text-for-500/80">passed 67%+</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => handleGuess('failed')}
              className={cn(
                'flex flex-col items-center gap-2 py-5 rounded-2xl border',
                'bg-against-600/20 border-against-500/40 hover:bg-against-600/40 hover:border-against-400/60',
                'transition-all',
              )}
            >
              <XCircle className="h-6 w-6 text-against-400" />
              <span className="text-sm font-mono font-bold text-against-300">Didn&apos;t Pass</span>
              <span className="text-[10px] font-mono text-against-500/80">failed or rejected</span>
            </motion.button>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
