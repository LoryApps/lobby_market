'use client'

/**
 * /trivia — Daily Civic Trivia
 *
 * Guess the community's vote split on 5 real platform topics.
 * Scoring: 25 pts for within 2%, down to 1 pt for within 24%, 0 beyond.
 * Daily challenge — same 5 questions per day (seed from date).
 * Score stored in localStorage to prevent replaying same day.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Check,
  Copy,
  ExternalLink,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Target,
  ThumbsDown,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TriviaQuestion, TriviaPayload } from '@/app/api/trivia/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SCORE = 125      // 5 × 25 pts
const STORAGE_KEY = 'lm_trivia_result'

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function scoreGuess(guess: number, actual: number): number {
  const delta = Math.abs(guess - actual)
  if (delta <= 2) return 25
  if (delta <= 5) return 20
  if (delta <= 10) return 15
  if (delta <= 15) return 10
  if (delta <= 20) return 5
  if (delta <= 24) return 1
  return 0
}

function gradeScore(total: number): { letter: string; color: string; label: string } {
  const pct = total / MAX_SCORE
  if (pct >= 0.92) return { letter: 'S', color: 'text-gold',         label: 'Oracle-level' }
  if (pct >= 0.80) return { letter: 'A', color: 'text-for-300',      label: 'Civic Sage' }
  if (pct >= 0.65) return { letter: 'B', color: 'text-emerald',      label: 'Informed Citizen' }
  if (pct >= 0.50) return { letter: 'C', color: 'text-purple',       label: 'Learning' }
  if (pct >= 0.35) return { letter: 'D', color: 'text-against-300',  label: 'Off-track' }
  return               { letter: 'F', color: 'text-against-400',  label: 'Total Disconnect' }
}

function buildShareText(score: number, date: string): string {
  const { letter, label } = gradeScore(score)
  const pct = Math.round((score / MAX_SCORE) * 100)
  const filled = Math.round(pct / 10)
  const bar = '■'.repeat(filled) + '□'.repeat(10 - filled)
  return [
    `Lobby Market Civic Trivia — ${date}`,
    `Score: ${score}/${MAX_SCORE} (${pct}%) — Grade ${letter}: ${label}`,
    bar,
    'lobby.market/trivia',
  ].join('\n')
}

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-for-300',
  Science:     'text-emerald',
  Ethics:      'text-purple',
  Philosophy:  'text-purple',
  Culture:     'text-against-300',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  active:  { label: 'Active',  icon: Zap,   color: 'text-for-400' },
  voting:  { label: 'Voting',  icon: Scale, color: 'text-purple' },
  law:     { label: 'LAW',     icon: Gavel, color: 'text-gold' },
  failed:  { label: 'Failed',  icon: ThumbsDown, color: 'text-against-400' },
}

// ─── Slider component ─────────────────────────────────────────────────────────

interface SliderProps {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}

function GuessSlider({ value, onChange, disabled }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const getValueFromEvent = useCallback((clientX: number): number => {
    const track = trackRef.current
    if (!track) return value
    const rect = track.getBoundingClientRect()
    const raw = (clientX - rect.left) / rect.width
    return Math.round(Math.max(0, Math.min(100, raw * 100)))
  }, [value])

  const handleMove = useCallback((clientX: number) => {
    if (disabled || !isDragging.current) return
    onChange(getValueFromEvent(clientX))
  }, [disabled, getValueFromEvent, onChange])

  const startDrag = useCallback((clientX: number) => {
    if (disabled) return
    isDragging.current = true
    onChange(getValueFromEvent(clientX))
  }, [disabled, getValueFromEvent, onChange])

  useEffect(() => {
    const onUp = () => { isDragging.current = false }
    const onMove = (e: MouseEvent) => handleMove(e.clientX)
    const onTouch = (e: TouchEvent) => { if (e.touches[0]) handleMove(e.touches[0].clientX) }
    window.addEventListener('mouseup', onUp)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchend', onUp)
    window.addEventListener('touchmove', onTouch, { passive: true })
    return () => {
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchmove', onTouch)
    }
  }, [handleMove])

  return (
    <div className="px-2 py-4 select-none">
      {/* Labels */}
      <div className="flex justify-between text-[11px] font-mono mb-3">
        <span className="text-against-400 font-semibold">Against 0%</span>
        <span className="text-surface-500">Guess the FOR split</span>
        <span className="text-for-400 font-semibold">For 100%</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label="Guess percentage for"
        tabIndex={disabled ? -1 : 0}
        className={cn(
          'relative h-8 rounded-full cursor-pointer',
          'bg-gradient-to-r from-against-600 via-surface-400 to-for-600',
          disabled && 'cursor-default opacity-70'
        )}
        onMouseDown={(e) => startDrag(e.clientX)}
        onTouchStart={(e) => { if (e.touches[0]) startDrag(e.touches[0].clientX) }}
        onKeyDown={(e) => {
          if (disabled) return
          if (e.key === 'ArrowLeft') onChange(Math.max(0, value - 1))
          if (e.key === 'ArrowRight') onChange(Math.min(100, value + 1))
        }}
      >
        {/* 50% center mark */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/20" />

        {/* Thumb */}
        <motion.div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
            'h-9 w-9 rounded-full border-4',
            'flex items-center justify-center',
            'shadow-lg shadow-black/40',
            value >= 50
              ? 'bg-for-500 border-for-300'
              : 'bg-against-500 border-against-300',
            'transition-colors duration-150'
          )}
          style={{ left: `${value}%` }}
          animate={{ scale: isDragging.current ? 1.1 : 1 }}
        >
          <span className="text-[10px] font-mono font-bold text-white leading-none">
            {value}
          </span>
        </motion.div>
      </div>

      {/* Current value readout */}
      <div className="flex justify-center mt-4 gap-6 text-sm font-mono font-semibold">
        <span className={cn('transition-colors', value < 50 ? 'text-against-400' : 'text-surface-600')}>
          {100 - value}% Against
        </span>
        <span className="text-surface-500">/</span>
        <span className={cn('transition-colors', value >= 50 ? 'text-for-400' : 'text-surface-600')}>
          {value}% For
        </span>
      </div>
    </div>
  )
}

// ─── Reveal bar ───────────────────────────────────────────────────────────────

interface RevealBarProps {
  actual: number
  guess: number
  pts: number
}

function RevealBar({ actual, guess, pts }: RevealBarProps) {
  return (
    <div className="space-y-3">
      {/* Actual result */}
      <div>
        <div className="flex justify-between text-[11px] font-mono mb-1">
          <span className="text-surface-500">Community vote</span>
          <span className="text-white font-semibold">{actual}% For / {100 - actual}% Against</span>
        </div>
        <div className="relative h-4 rounded-full overflow-hidden bg-surface-300">
          <motion.div
            className="absolute inset-y-0 left-0 bg-for-500 rounded-l-full"
            initial={{ width: 0 }}
            animate={{ width: `${actual}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Your guess */}
      <div>
        <div className="flex justify-between text-[11px] font-mono mb-1">
          <span className="text-surface-500">Your guess</span>
          <span className="text-surface-400">{guess}% For</span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden bg-surface-300">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gold/60 rounded-l-full"
            initial={{ width: 0 }}
            animate={{ width: `${guess}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
      </div>

      {/* Score badge */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-xl',
        pts >= 20 ? 'bg-for-600/20 border border-for-500/30' :
        pts >= 10 ? 'bg-emerald/10 border border-emerald/30' :
        pts >= 5  ? 'bg-purple/10 border border-purple/30' :
                    'bg-against-600/10 border border-against-500/20'
      )}>
        <span className="text-sm font-mono text-surface-400">
          {Math.abs(actual - guess)}% off
        </span>
        <span className={cn(
          'text-lg font-mono font-bold',
          pts >= 20 ? 'text-for-300' :
          pts >= 10 ? 'text-emerald' :
          pts >= 5  ? 'text-purple' :
                      'text-against-400'
        )}>
          +{pts} pts
        </span>
      </div>
    </div>
  )
}

// ─── Results screen ───────────────────────────────────────────────────────────

interface ResultsProps {
  questions: TriviaQuestion[]
  guesses: number[]
  scores: number[]
  total: number
  date: string
  onReset: () => void
}

function Results({ questions, guesses, scores, total, date, onReset }: ResultsProps) {
  const [copied, setCopied] = useState(false)
  const { letter, color, label } = gradeScore(total)

  function handleShare() {
    const text = buildShareText(total, date)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Score card */}
      <div className="relative overflow-hidden bg-surface-200 border border-surface-300 rounded-2xl p-6 text-center">
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.15), transparent 70%)' }}
        />
        <div className="relative">
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-1">
            {date} · Civic Trivia
          </p>
          <div className={cn('text-7xl font-mono font-black mb-1', color)}>
            {letter}
          </div>
          <p className="text-lg font-bold text-white mb-0.5">{label}</p>
          <p className="text-2xl font-mono font-black text-white">
            {total}
            <span className="text-surface-500 text-lg font-semibold">/{MAX_SCORE}</span>
          </p>
          <p className="text-xs text-surface-500 mt-1">
            {Math.round((total / MAX_SCORE) * 100)}% accuracy
          </p>
        </div>
      </div>

      {/* Per-question breakdown */}
      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-surface-200 border border-surface-300 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-sm text-surface-300 leading-snug flex-1">{q.statement}</p>
              <span className={cn(
                'flex-shrink-0 text-lg font-mono font-bold',
                scores[i] >= 20 ? 'text-for-300' :
                scores[i] >= 10 ? 'text-emerald' :
                scores[i] >= 5  ? 'text-purple' :
                                  'text-against-400'
              )}>
                +{scores[i]}
              </span>
            </div>
            <div className="space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-surface-500">Actual</span>
                <span className="text-white">{q.blue_pct}% For</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Your guess</span>
                <span className="text-surface-400">{guesses[i]}% For</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={handleShare}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-xl',
            'font-mono text-sm font-semibold transition-all',
            copied
              ? 'bg-for-600/30 border border-for-500/50 text-for-300'
              : 'bg-surface-200 border border-surface-300 text-white hover:border-surface-400'
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied to clipboard' : 'Share result'}
        </button>

        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-for-600 text-white font-mono text-sm font-semibold hover:bg-for-500 transition-colors"
          >
            <Flame className="h-4 w-4" />
            Go vote
          </Link>
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 font-mono text-sm hover:text-white hover:border-surface-400 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Practice
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] font-mono text-surface-600">
        New questions tomorrow · Same seed per day
      </p>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TriviaPage() {
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<TriviaQuestion[]>([])
  const [date, setDate] = useState('')
  const [current, setCurrent] = useState(0)
  const [guess, setGuess] = useState(50)
  const [guesses, setGuesses] = useState<number[]>([])
  const [scores, setScores] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(false)
  const [practiceMode, setPracticeMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [savedResult, setSavedResult] = useState<{ total: number; guesses: number[]; scores: number[] } | null>(null)

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/trivia')
      if (!res.ok) throw new Error('Could not load questions')
      const data: TriviaPayload = await res.json()
      setQuestions(data.questions)
      setDate(data.date)
    } catch {
      setError('Failed to load today\'s trivia. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Check localStorage for today's result
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { date: string; total: number; guesses: number[]; scores: number[] }
        const today = new Date().toISOString().slice(0, 10)
        if (parsed.date === today) {
          setAlreadyDone(true)
          setSavedResult({ total: parsed.total, guesses: parsed.guesses, scores: parsed.scores })
        }
      } catch { /* ignore */ }
    }
    loadQuestions()
  }, [loadQuestions])

  function handleReveal() {
    if (!revealed) {
      setRevealed(true)
    }
  }

  function handleNext() {
    const q = questions[current]
    const pts = scoreGuess(guess, q.blue_pct)
    const newGuesses = [...guesses, guess]
    const newScores = [...scores, pts]

    if (current + 1 >= questions.length) {
      const total = newScores.reduce((a, b) => a + b, 0)
      setGuesses(newGuesses)
      setScores(newScores)
      setDone(true)
      if (!practiceMode) {
        const today = new Date().toISOString().slice(0, 10)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, total, guesses: newGuesses, scores: newScores }))
      }
    } else {
      setGuesses(newGuesses)
      setScores(newScores)
      setCurrent((c) => c + 1)
      setGuess(50)
      setRevealed(false)
    }
  }

  function handleReset() {
    setCurrent(0)
    setGuess(50)
    setGuesses([])
    setScores([])
    setRevealed(false)
    setDone(false)
    setPracticeMode(true)
  }

  const totalSoFar = scores.reduce((a, b) => a + b, 0)

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-against-400 font-semibold">{error}</p>
          <button onClick={loadQuestions} className="text-for-400 text-sm flex items-center gap-1 hover:text-for-300">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const q = questions[current]

  // ── Results / already done ─────────────────────────────────────────────────

  if (done || (alreadyDone && savedResult && questions.length > 0)) {
    const finalGuesses = done ? guesses : savedResult!.guesses
    const finalScores = done ? scores : savedResult!.scores
    const finalTotal = done
      ? finalScores.reduce((a, b) => a + b, 0)
      : savedResult!.total

    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full pb-24">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href="/" className="p-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white font-mono">Civic Trivia</h1>
              <p className="text-[11px] font-mono text-surface-500">
                {alreadyDone && !done ? "Today's completed result" : 'Final result'}
              </p>
            </div>
          </div>

          <Results
            questions={questions}
            guesses={finalGuesses}
            scores={finalScores}
            total={finalTotal}
            date={date}
            onReset={handleReset}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Game ───────────────────────────────────────────────────────────────────

  const catColor = q?.category ? (CAT_COLOR[q.category] ?? 'text-surface-400') : 'text-surface-400'
  const statusConf = q?.status ? (STATUS_CONFIG[q.status] ?? STATUS_CONFIG.active) : STATUS_CONFIG.active
  const StatusIcon = statusConf.icon

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/"
            className="p-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white font-mono">Civic Trivia</h1>
              {practiceMode && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-300 text-surface-500">
                  Practice
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-surface-500">
              Guess the community vote split
            </p>
          </div>
          {/* Score chip */}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-200 border border-surface-300">
            <Trophy className="h-3.5 w-3.5 text-gold" />
            <span className="font-mono text-sm font-bold text-white">{totalSoFar}</span>
            <span className="font-mono text-xs text-surface-500">pts</span>
          </div>
        </div>

        {/* Progress */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-500 mb-1.5">
            <span>Question {current + 1} of {questions.length}</span>
            <span>{MAX_SCORE - totalSoFar} pts remaining</span>
          </div>
          <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-for-500 rounded-full"
              animate={{ width: `${((current) / questions.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Question card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="bg-surface-200 border border-surface-300 rounded-2xl p-5 mb-4"
          >
            {/* Meta row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {q?.category && (
                <span className={cn('text-[11px] font-mono font-semibold', catColor)}>
                  {q.category}
                </span>
              )}
              {q?.scope && (
                <span className="text-[11px] font-mono text-surface-500">{q.scope}</span>
              )}
              <div className={cn('flex items-center gap-1 text-[11px] font-mono ml-auto', statusConf.color)}>
                <StatusIcon className="h-3 w-3" />
                {statusConf.label}
              </div>
            </div>

            {/* Statement */}
            <p className="text-white text-base font-semibold leading-snug mb-4">
              {q?.statement}
            </p>

            {/* Hint */}
            <p className="text-[11px] font-mono text-surface-500 flex items-center gap-1">
              <BarChart2 className="h-3 w-3" />
              {q?.total_votes.toLocaleString()} votes cast
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Slider / reveal */}
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key="slider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-surface-200 border border-surface-300 rounded-2xl px-5 pb-5 pt-3 mb-4"
            >
              <GuessSlider value={guess} onChange={setGuess} />
            </motion.div>
          ) : (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-200 border border-surface-300 rounded-2xl p-5 mb-4"
            >
              <RevealBar
                actual={q?.blue_pct ?? 50}
                guess={guess}
                pts={scoreGuess(guess, q?.blue_pct ?? 50)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        {!revealed ? (
          <button
            onClick={handleReveal}
            className="w-full py-3.5 rounded-xl bg-for-600 hover:bg-for-500 text-white font-mono text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Target className="h-4 w-4" />
            Reveal answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full py-3.5 rounded-xl bg-surface-200 border border-for-500/50 hover:border-for-500 text-white font-mono text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {current + 1 >= questions.length ? (
              <>
                <Trophy className="h-4 w-4 text-gold" />
                See final results
              </>
            ) : (
              <>
                Next question
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}

        {/* Topic link */}
        {revealed && q && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 flex justify-center"
          >
            <Link
              href={`/topic/${q.id}`}
              className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View debate
            </Link>
          </motion.div>
        )}

        {/* Scoring guide */}
        {!revealed && (
          <div className="mt-5 px-4 py-3 bg-surface-200/50 border border-surface-300/50 rounded-xl">
            <p className="text-[10px] font-mono text-surface-500 text-center mb-2 uppercase tracking-wider">
              Scoring
            </p>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
              <div className="text-for-300">≤2% off<br /><span className="font-bold">25 pts</span></div>
              <div className="text-emerald">≤10% off<br /><span className="font-bold">15 pts</span></div>
              <div className="text-against-400">&gt;24% off<br /><span className="font-bold">0 pts</span></div>
            </div>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
