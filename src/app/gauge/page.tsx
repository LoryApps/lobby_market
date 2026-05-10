'use client'

/**
 * /gauge — Civic Gauge
 *
 * Daily estimation game: 5 resolved debates. The outcome (Law/Failed) is shown.
 * The exact FOR% is hidden. Drag the slider to guess what percentage voted FOR.
 *
 * Scoring per round (max 20 pts, 100 total):
 *   ≤ 5%  off → 20 pts  Perfect!
 *   ≤ 10% off → 15 pts  Great!
 *   ≤ 20% off → 10 pts  Close
 *   ≤ 30% off →  5 pts  Fair
 *   > 30% off →  0 pts  Off target
 *
 * localStorage key: lm_gauge_v1
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Gavel,
  Share2,
  Sliders,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { GaugePayload, GaugeQuestion } from '@/app/api/gauge/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_gauge_v1'
const MAX_SCORE = 100

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuessResult {
  guess: number
  truth: number
  pts: number
  label: string
  color: string
}

interface SavedState {
  date: string
  score: number
  guesses: GuessResult[]
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreGuess(guess: number, truth: number): { pts: number; label: string; color: string } {
  const diff = Math.abs(guess - truth)
  if (diff <= 5)  return { pts: 20, label: 'Perfect!',    color: 'text-emerald' }
  if (diff <= 10) return { pts: 15, label: 'Great!',      color: 'text-for-400' }
  if (diff <= 20) return { pts: 10, label: 'Close',       color: 'text-gold' }
  if (diff <= 30) return { pts:  5, label: 'Fair',        color: 'text-gold' }
  return                  { pts:  0, label: 'Off target', color: 'text-against-400' }
}

function getGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: 'S', color: 'text-emerald' }
  if (score >= 75) return { grade: 'A', color: 'text-for-400' }
  if (score >= 55) return { grade: 'B', color: 'text-gold' }
  if (score >= 35) return { grade: 'C', color: 'text-gold' }
  if (score >= 15) return { grade: 'D', color: 'text-against-400' }
  return                  { grade: 'F', color: 'text-against-300' }
}

function buildShareText(guesses: GuessResult[], score: number, date: string): string {
  const dots = guesses.map((g) => {
    const diff = Math.abs(g.guess - g.truth)
    if (diff <= 5)  return '🟢'
    if (diff <= 10) return '🟡'
    if (diff <= 20) return '🟠'
    return '🔴'
  })
  return `Civic Gauge ${date}\n${dots.join('')}\n${score}/${MAX_SCORE} pts\nlobbymarket.app/gauge`
}

// ─── Slider ───────────────────────────────────────────────────────────────────

interface GaugeSliderProps {
  value: number
  onChange: (v: number) => void
  disabled?: boolean
}

function GaugeSlider({ value, onChange, disabled }: GaugeSliderProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const getValueFromRail = useCallback(
    (clientX: number): number => {
      const rail = railRef.current
      if (!rail) return value
      const rect = rail.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.round(pct * 100)
    },
    [value],
  )

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return
      onChange(getValueFromRail(e.clientX))
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragging.current || !e.touches[0]) return
      onChange(getValueFromRail(e.touches[0].clientX))
    }
    function stopDrag() { dragging.current = false }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopDrag)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', stopDrag)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', stopDrag)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', stopDrag)
    }
  }, [onChange, getValueFromRail])

  function startDrag(clientX: number) {
    if (disabled) return
    dragging.current = true
    onChange(getValueFromRail(clientX))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(Math.max(0, value - 1))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(100, value + 1))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] text-surface-500 font-medium px-1">
        <span>0% FOR</span>
        <span className="font-bold text-white text-base">{value}%</span>
        <span>100% FOR</span>
      </div>

      <div
        ref={railRef}
        className="relative h-10 flex items-center cursor-pointer select-none"
        onMouseDown={(e) => startDrag(e.clientX)}
        onTouchStart={(e) => { if (e.touches[0]) startDrag(e.touches[0].clientX) }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label="Percentage voted FOR"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
      >
        <div className="w-full h-2 rounded-full bg-surface-300/60 overflow-visible relative">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-against-500 via-gold to-for-500 transition-none"
            style={{ width: `${value}%` }}
          />
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 border-white shadow-lg transition-none',
              disabled ? 'bg-surface-400' : 'bg-white cursor-grab active:cursor-grabbing',
            )}
            style={{ left: `${value}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between px-1">
        {[0, 25, 50, 75, 100].map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(t)}
            className="text-[10px] text-surface-500 hover:text-surface-400 w-6 text-center"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Reveal bar ───────────────────────────────────────────────────────────────

function RevealBar({ truePct, guessPct }: { truePct: number; guessPct: number }) {
  return (
    <div className="space-y-3 py-2">
      <div>
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-surface-500">Actual FOR%</span>
          <span className="font-bold text-white">{truePct}%</span>
        </div>
        <div className="h-3 rounded-full bg-surface-300/60 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-against-500 via-gold to-for-500"
            initial={{ width: 0 }}
            animate={{ width: `${truePct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[11px] mb-1">
          <span className="text-surface-500">Your guess</span>
          <span className="font-bold text-surface-400">{guessPct}%</span>
        </div>
        <div className="h-3 rounded-full bg-surface-300/60 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-surface-400/60"
            initial={{ width: 0 }}
            animate={{ width: `${guessPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Results view ─────────────────────────────────────────────────────────────

function ResultsView({
  questions,
  guesses,
  score,
  date,
}: {
  questions: GaugeQuestion[]
  guesses: GuessResult[]
  score: number
  date: string
}) {
  const { grade, color } = getGrade(score)
  const [copied, setCopied] = useState(false)

  function handleShare() {
    const text = buildShareText(guesses, score, date)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-surface-100 border border-surface-300/50">
        <Trophy className="h-6 w-6 text-gold" />
        <span className={cn('text-6xl font-black tracking-tight', color)}>{grade}</span>
        <span className="text-2xl font-bold text-white">
          {score}
          <span className="text-sm text-surface-500 font-normal">/{MAX_SCORE}</span>
        </span>
        <p className="text-xs text-surface-500 text-center">
          {score >= 90 ? 'Exceptional civic calibration!' :
           score >= 75 ? 'Strong political intuition.' :
           score >= 55 ? 'Solid read on the community.' :
           score >= 35 ? 'Getting there — keep playing.' :
           'The community is hard to predict. Try again tomorrow.'}
        </p>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => {
          const g = guesses[i]
          if (!g) return null
          return (
            <div key={q.id} className="p-4 rounded-xl bg-surface-100 border border-surface-300/30 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-white font-medium leading-snug flex-1 line-clamp-2">{q.statement}</p>
                <span className={cn(
                  'flex-shrink-0 text-[10px] font-mono font-bold border rounded-full px-2 py-0.5',
                  q.status === 'law'
                    ? 'text-for-300 border-for-500/30 bg-for-500/10'
                    : 'text-against-300 border-against-500/30 bg-against-500/10',
                )}>
                  {q.status === 'law' ? 'LAW' : 'FAILED'}
                </span>
              </div>
              <RevealBar truePct={g.truth} guessPct={g.guess} />
              <div className="flex items-center justify-between">
                <span className={cn('text-sm font-bold', g.color)}>{g.label}</span>
                <span className="text-sm font-mono font-bold text-white">+{g.pts} pts</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-semibold transition-colors"
        >
          <Share2 className="h-4 w-4" />
          {copied ? 'Copied!' : 'Share result'}
        </button>
        <Link
          href="/arcade"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold/10 hover:bg-gold/20 text-gold text-sm font-semibold transition-colors border border-gold/20"
        >
          <Trophy className="h-4 w-4" />
          Arcade
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GaugePage() {
  const [payload, setPayload] = useState<GaugePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [round, setRound] = useState(0)
  const [guess, setGuess] = useState(50)
  const [guesses, setGuesses] = useState<GuessResult[]>([])
  const [revealed, setRevealed] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved: SavedState = JSON.parse(raw)
        if (saved.date === today) {
          setAlreadyPlayed(true)
          setGuesses(saved.guesses)
        }
      }
    } catch {
      // ignore
    }

    fetch('/api/gauge', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load questions')
        return r.json() as Promise<GaugePayload>
      })
      .then((data) => {
        setPayload(data)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [today])

  function submitGuess() {
    if (!payload) return
    const q = payload.questions[round]
    const result = scoreGuess(guess, q.true_pct)
    const newGuesses = [...guesses, { guess, truth: q.true_pct, ...result }]
    setGuesses(newGuesses)
    setRevealed(true)

    if (round + 1 >= payload.questions.length) {
      const totalScore = newGuesses.reduce((sum, g) => sum + g.pts, 0)
      try {
        const saved: SavedState = { date: today, score: totalScore, guesses: newGuesses }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
      } catch {
        // ignore
      }
    }
  }

  function nextRound() {
    if (!payload) return
    if (round + 1 >= payload.questions.length) {
      setGameOver(true)
    } else {
      setRound((r) => r + 1)
      setGuess(50)
      setRevealed(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <Sliders className="h-8 w-8 text-gold animate-pulse" />
        </div>
        <BottomNav />
      </div>
    )
  }

  if (error || !payload || payload.questions.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <XCircle className="h-8 w-8 text-against-400 mx-auto" />
            <p className="text-surface-400">{error ?? 'No questions available today.'}</p>
            <Link href="/arcade" className="text-sm text-gold hover:underline">← Back to Arcade</Link>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  const questions = payload.questions
  const totalScore = guesses.reduce((sum, g) => sum + g.pts, 0)
  const currentQ = questions[round]
  const showResults = gameOver || alreadyPlayed

  return (
    <div className="relative flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 pb-24 pt-16">
        <div className="px-4 max-w-lg mx-auto py-6 space-y-6">

          <div className="flex items-center gap-3">
            <Link href="/arcade" className="p-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors">
              <ArrowLeft className="h-4 w-4 text-surface-400" />
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-gold" />
                <h1 className="text-lg font-bold text-white">Civic Gauge</h1>
              </div>
              <p className="text-xs text-surface-500">Estimate the FOR% on 5 resolved debates</p>
            </div>
            {!showResults && (
              <span className="text-xs font-mono font-bold text-surface-500 bg-surface-200 px-2 py-1 rounded-lg">
                {round + 1}/5
              </span>
            )}
          </div>

          {showResults ? (
            <ResultsView
              questions={questions}
              guesses={guesses}
              score={alreadyPlayed
                ? (() => { try { const s: SavedState = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'); return s.score ?? totalScore } catch { return totalScore } })()
                : totalScore}
              date={today}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={round}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="flex gap-1.5">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        i < round ? 'bg-emerald' : i === round ? 'bg-gold' : 'bg-surface-300',
                      )}
                    />
                  ))}
                </div>

                <div className="p-5 rounded-2xl bg-surface-100 border border-surface-300/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-mono font-bold border rounded-full px-2 py-0.5',
                      currentQ.status === 'law'
                        ? 'text-for-300 border-for-500/30 bg-for-500/10'
                        : 'text-against-300 border-against-500/30 bg-against-500/10',
                    )}>
                      {currentQ.status === 'law' ? (
                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> LAW</span>
                      ) : (
                        <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> FAILED</span>
                      )}
                    </span>
                    {currentQ.category && (
                      <span className="text-[10px] text-surface-500">{currentQ.category}</span>
                    )}
                  </div>

                  <p className="text-base font-semibold text-white leading-snug">
                    &ldquo;{currentQ.statement}&rdquo;
                  </p>

                  <div className="flex items-center gap-2 text-xs text-surface-500">
                    <Gavel className="h-3.5 w-3.5" />
                    <span>{currentQ.total_votes.toLocaleString()} total votes</span>
                  </div>
                </div>

                {!revealed ? (
                  <div className="p-5 rounded-2xl bg-surface-100 border border-surface-300/50 space-y-4">
                    <p className="text-sm text-surface-400 font-medium">What % voted FOR?</p>
                    <GaugeSlider value={guess} onChange={setGuess} />
                    <button
                      onClick={submitGuess}
                      className="w-full py-3 rounded-xl bg-gold text-surface-900 font-bold text-sm hover:bg-gold/90 transition-colors"
                    >
                      Lock in {guess}%
                    </button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-5 rounded-2xl bg-surface-100 border border-surface-300/50 space-y-4"
                  >
                    {(() => {
                      const g = guesses[guesses.length - 1]
                      if (!g) return null
                      return (
                        <div className="flex items-center justify-between">
                          <span className={cn('text-lg font-bold', g.color)}>{g.label}</span>
                          <span className="text-lg font-mono font-bold text-white">+{g.pts} pts</span>
                        </div>
                      )
                    })()}

                    <RevealBar
                      truePct={guesses[guesses.length - 1]?.truth ?? 0}
                      guessPct={guesses[guesses.length - 1]?.guess ?? 50}
                    />

                    <div className="flex items-center justify-between text-xs text-surface-500 pt-1">
                      <span>Running total: <span className="text-white font-bold">{totalScore} pts</span></span>
                    </div>

                    <button
                      onClick={nextRound}
                      className="w-full py-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      {round + 1 >= questions.length ? (
                        <>See Results <Trophy className="h-4 w-4 text-gold" /></>
                      ) : (
                        <>Next <ArrowRight className="h-4 w-4" /></>
                      )}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
