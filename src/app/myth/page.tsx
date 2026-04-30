'use client'

/**
 * /myth — Law or Myth
 *
 * Daily civic fact-check game. Five statements: did the Lobby community pass
 * each one into law, or did it fail / get rejected? Binary choice per round.
 * Scoring: 20 pts per correct answer (max 100). Same questions per calendar day.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  Trophy,
  X,
  XCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MythQuestion, MythPayload } from '@/app/api/myth/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_myth_result'
const PTS_PER_CORRECT = 20

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Education:   'text-for-300',
  Environment: 'text-emerald',
}

function categoryColor(cat: string | null): string {
  return CATEGORY_COLORS[cat ?? ''] ?? 'text-surface-500'
}

// ─── Score rank ───────────────────────────────────────────────────────────────

function scoreRank(score: number): { label: string; color: string } {
  if (score >= 100) return { label: 'Perfect — you know the Codex cold', color: 'text-gold' }
  if (score >= 80)  return { label: 'Sharp — very few fool you', color: 'text-emerald' }
  if (score >= 60)  return { label: 'Solid — decent civic memory', color: 'text-for-400' }
  if (score >= 40)  return { label: 'Shaky — the Codex needs more study', color: 'text-gold' }
  return { label: 'Rough — keep reading the Codex', color: 'text-against-400' }
}

// ─── Result emoji squares ─────────────────────────────────────────────────────

function resultSquares(answers: Array<'law' | 'myth'>, questions: MythQuestion[]): string {
  return answers
    .map((a, i) => (questions[i] && a === questions[i].answer ? '🟦' : '🟥'))
    .join('')
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

interface SavedResult {
  date: string
  score: number
  answers: Array<'law' | 'myth'>
  gameOver: true
}

function loadSaved(): SavedResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SavedResult
  } catch {
    return null
  }
}

function saveResult(date: string, score: number, answers: Array<'law' | 'myth'>) {
  try {
    const data: SavedResult = { date, score, answers, gameOver: true }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // best-effort
  }
}

// ─── Share text ───────────────────────────────────────────────────────────────

function buildShareText(
  date: string,
  score: number,
  answers: Array<'law' | 'myth'>,
  questions: MythQuestion[],
): string {
  const squares = resultSquares(answers, questions)
  return `Law or Myth · ${date}\nScore: ${score}/100\n${squares}\nlobby.market/myth`
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'loading' | 'error' | 'playing' | 'done' | 'already_played'

export default function MythPage() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<MythQuestion[]>([])
  const [date, setDate] = useState('')
  const [questionIdx, setQuestionIdx] = useState(0)
  const [answers, setAnswers] = useState<Array<'law' | 'myth'>>([])
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [copied, setCopied] = useState(false)
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/myth')
      if (!res.ok) {
        setPhase('error')
        return
      }
      const data = (await res.json()) as MythPayload

      // Check if already played today
      const saved = loadSaved()
      if (saved?.date === data.date && saved.gameOver) {
        setQuestions(data.questions)
        setDate(data.date)
        setAnswers(saved.answers)
        setScore(saved.score)
        setPhase('already_played')
        return
      }

      setQuestions(data.questions)
      setDate(data.date)
      setPhase('playing')
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current)
    }
  }, [load])

  // ── Answer handler ──────────────────────────────────────────────────────────

  function handleAnswer(choice: 'law' | 'myth') {
    if (revealed) return
    const correct = questions[questionIdx]?.answer === choice
    const pts = correct ? PTS_PER_CORRECT : 0
    const newAnswers = [...answers, choice]
    const newScore = score + pts
    setAnswers(newAnswers)
    setScore(newScore)
    setRevealed(true)

    // Auto-advance after 1.8 s
    revealTimer.current = setTimeout(() => {
      advance(newAnswers, newScore)
    }, 1800)
  }

  function advance(currentAnswers: Array<'law' | 'myth'>, currentScore: number) {
    if (revealTimer.current) clearTimeout(revealTimer.current)
    setRevealed(false)
    const nextIdx = questionIdx + 1
    if (nextIdx >= questions.length) {
      saveResult(date, currentScore, currentAnswers)
      setPhase('done')
    } else {
      setQuestionIdx(nextIdx)
    }
  }

  // ── Share ────────────────────────────────────────────────────────────────────

  async function handleShare() {
    const text = buildShareText(date, score, answers, questions)
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch { /* best-effort */ }
    }
  }

  // ─── Current question ────────────────────────────────────────────────────────

  const q = questions[questionIdx]
  const lastAnswer = answers[answers.length - 1]
  const lastCorrect = revealed && q && lastAnswer === q.answer

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-6 pb-28">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/arcade"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to arcade"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Law or Myth</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Did the Lobby pass it — or myth?</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/20">
            <Gavel className="h-3.5 w-3.5 text-gold" />
            <span className="text-xs font-mono font-bold text-gold">DAILY</span>
          </div>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {phase === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-48 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <XCircle className="h-10 w-10 text-against-500" />
            <p className="text-surface-500 text-sm text-center">
              Couldn&apos;t load today&apos;s questions. The Codex may be unavailable.
            </p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-white text-sm hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}

        {/* ── Playing ──────────────────────────────────────────────────── */}
        {phase === 'playing' && q && (
          <div className="flex flex-col gap-5">

            {/* Progress bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex gap-1">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors duration-300',
                      i < answers.length
                        ? answers[i] === questions[i].answer
                          ? 'bg-emerald'
                          : 'bg-against-500'
                        : i === questionIdx
                        ? 'bg-gold'
                        : 'bg-surface-300',
                    )}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-surface-500 tabular-nums">
                {questionIdx + 1}/{questions.length}
              </span>
            </div>

            {/* Question card */}
            <AnimatePresence mode="wait">
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6 min-h-[180px] flex flex-col gap-4"
              >
                {/* Category */}
                {q.category && (
                  <span className={cn('text-[11px] font-mono font-semibold uppercase tracking-widest', categoryColor(q.category))}>
                    {q.category}
                  </span>
                )}

                {/* Statement */}
                <p className="text-base font-semibold text-white leading-relaxed flex-1">
                  &ldquo;{q.statement}&rdquo;
                </p>

                {/* Reveal banner */}
                <AnimatePresence>
                  {revealed && (
                    <motion.div
                      key="reveal"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        'flex items-start gap-3 rounded-xl p-3 border',
                        lastCorrect
                          ? 'bg-emerald/10 border-emerald/30'
                          : 'bg-against-500/10 border-against-500/30',
                      )}
                    >
                      {lastCorrect
                        ? <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                        : <XCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                      }
                      <div className="min-w-0">
                        <p className={cn('text-sm font-semibold', lastCorrect ? 'text-emerald' : 'text-against-400')}>
                          {lastCorrect ? 'Correct!' : `Wrong — it was a ${q.answer === 'law' ? 'LAW' : 'MYTH'}`}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {q.answer === 'law'
                            ? `The community voted ${q.blue_pct}% FOR — this became law.`
                            : `The community voted ${q.blue_pct}% FOR — not enough to pass.`
                          }
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>

            {/* Choice buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAnswer('law')}
                disabled={revealed}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all',
                  'font-mono font-bold text-sm',
                  revealed && lastAnswer === 'law'
                    ? q.answer === 'law'
                      ? 'bg-emerald/20 border-emerald text-emerald'
                      : 'bg-against-500/20 border-against-500 text-against-400'
                    : revealed
                    ? 'opacity-30 bg-surface-200 border-surface-300 text-surface-500'
                    : 'bg-for-600/20 border-for-500/60 text-for-300 hover:bg-for-600/30 hover:border-for-500 active:scale-95',
                )}
              >
                <Gavel className="h-6 w-6" />
                LAW
                <span className="text-[10px] font-normal text-current opacity-70">It passed</span>
              </button>

              <button
                onClick={() => handleAnswer('myth')}
                disabled={revealed}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all',
                  'font-mono font-bold text-sm',
                  revealed && lastAnswer === 'myth'
                    ? q.answer === 'myth'
                      ? 'bg-emerald/20 border-emerald text-emerald'
                      : 'bg-against-500/20 border-against-500 text-against-400'
                    : revealed
                    ? 'opacity-30 bg-surface-200 border-surface-300 text-surface-500'
                    : 'bg-against-600/20 border-against-500/60 text-against-300 hover:bg-against-600/30 hover:border-against-500 active:scale-95',
                )}
              >
                <X className="h-6 w-6" />
                MYTH
                <span className="text-[10px] font-normal text-current opacity-70">It failed</span>
              </button>
            </div>

            {/* Manual advance when revealed */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-center"
                >
                  <button
                    onClick={() => advance(answers, score)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono font-semibold transition-colors"
                  >
                    {questionIdx + 1 >= questions.length ? 'See results' : 'Next'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Score tracker */}
            <div className="flex items-center justify-center gap-1.5">
              {answers.map((a, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    a === questions[i]?.answer ? 'bg-emerald' : 'bg-against-500',
                  )}
                />
              ))}
              {Array.from({ length: questions.length - answers.length }).map((_, i) => (
                <div key={`empty-${i}`} className="h-2.5 w-2.5 rounded-full bg-surface-300" />
              ))}
            </div>
          </div>
        )}

        {/* ── Done / Already played ────────────────────────────────────── */}
        {(phase === 'done' || phase === 'already_played') && questions.length > 0 && (
          <ResultScreen
            score={score}
            date={date}
            answers={answers}
            questions={questions}
            copied={copied}
            onShare={handleShare}
            alreadyPlayed={phase === 'already_played'}
          />
        )}

      </main>

      <BottomNav />
    </div>
  )
}

// ─── Result screen ────────────────────────────────────────────────────────────

interface ResultScreenProps {
  score: number
  date: string
  answers: Array<'law' | 'myth'>
  questions: MythQuestion[]
  copied: boolean
  onShare: () => void
  alreadyPlayed: boolean
}

function ResultScreen({
  score,
  date: _date,
  answers,
  questions,
  copied,
  onShare,
  alreadyPlayed,
}: ResultScreenProps) {
  const rank = scoreRank(score)
  const correctCount = answers.filter((a, i) => questions[i] && a === questions[i].answer).length

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-5"
    >
      {alreadyPlayed && (
        <div className="text-center text-xs font-mono text-surface-500 mb-1">
          Already played today — come back tomorrow for a new set
        </div>
      )}

      {/* Score card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 flex flex-col items-center gap-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-full bg-gold/10 border border-gold/20">
          {score >= 80
            ? <Trophy className="h-8 w-8 text-gold" />
            : score >= 60
            ? <CheckCircle2 className="h-8 w-8 text-emerald" />
            : <Scale className="h-8 w-8 text-for-400" />
          }
        </div>

        <div className="text-center">
          <p className="text-4xl font-mono font-bold text-white tabular-nums">{score}<span className="text-xl text-surface-500">/100</span></p>
          <p className="text-sm text-surface-500 mt-1">{correctCount}/{questions.length} correct</p>
        </div>

        <p className={cn('text-sm font-mono text-center', rank.color)}>{rank.label}</p>

        {/* Answer squares */}
        <div className="flex items-center gap-2">
          {answers.map((a, i) => {
            const correct = questions[i] && a === questions[i].answer
            return (
              <div
                key={i}
                className={cn(
                  'h-10 w-10 rounded-lg flex items-center justify-center border-2',
                  correct
                    ? 'bg-emerald/10 border-emerald/40'
                    : 'bg-against-500/10 border-against-500/40',
                )}
                title={questions[i]?.statement.slice(0, 60)}
              >
                {correct
                  ? <Check className="h-5 w-5 text-emerald" />
                  : <X className="h-5 w-5 text-against-400" />
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Answer breakdown */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-300">
          <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">Answer Key</h2>
        </div>
        <div className="divide-y divide-surface-300">
          {questions.map((q, i) => {
            const correct = answers[i] === q.answer
            return (
              <div key={q.id} className="flex items-start gap-3 px-4 py-3">
                <div className={cn(
                  'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full mt-0.5',
                  correct ? 'bg-emerald/10' : 'bg-against-500/10',
                )}>
                  {correct
                    ? <Check className="h-3.5 w-3.5 text-emerald" />
                    : <X className="h-3.5 w-3.5 text-against-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-surface-400 leading-snug line-clamp-2">&ldquo;{q.statement}&rdquo;</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                      'text-[10px] font-mono font-bold uppercase tracking-wide',
                      q.answer === 'law' ? 'text-for-400' : 'text-against-400',
                    )}>
                      {q.answer === 'law' ? 'LAW' : 'MYTH'}
                    </span>
                    <span className="text-[10px] text-surface-600">
                      {q.blue_pct}% FOR
                    </span>
                    {q.category && (
                      <span className={cn('text-[10px] font-mono', categoryColor(q.category))}>
                        {q.category}
                      </span>
                    )}
                  </div>
                </div>
                {q.answer === 'law' && (
                  <Link
                    href={`/topic/${q.id}`}
                    className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded text-surface-500 hover:text-white transition-colors"
                    aria-label="View topic"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onShare}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono font-semibold transition-colors border border-surface-300"
        >
          {copied
            ? <><Check className="h-4 w-4 text-emerald" /> Copied!</>
            : <><Copy className="h-4 w-4" /> Share result</>
          }
        </button>
        <Link
          href="/law"
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-for-600/20 hover:bg-for-600/30 text-for-300 text-sm font-mono font-semibold transition-colors border border-for-500/30"
        >
          <Gavel className="h-4 w-4" />
          The Codex
        </Link>
      </div>

      {/* Tomorrow hint */}
      <p className="text-center text-[11px] font-mono text-surface-600">
        New questions every day at midnight · <Link href="/arcade" className="hover:text-white transition-colors underline underline-offset-2">Back to Arcade</Link>
      </p>

      {/* Sparkles easter egg for perfect score */}
      {score === 100 && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, type: 'spring' }}
          className="flex items-center justify-center gap-2 py-2 rounded-xl bg-gold/10 border border-gold/20"
        >
          <Sparkles className="h-4 w-4 text-gold" />
          <span className="text-sm font-mono font-bold text-gold">Perfect Codex knowledge!</span>
          <Sparkles className="h-4 w-4 text-gold" />
        </motion.div>
      )}
    </motion.div>
  )
}
