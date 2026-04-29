'use client'

/**
 * /cloze — Civic Cloze
 *
 * Daily fill-in-the-blank challenge. Each question shows a real platform
 * law or debate statement with one key word removed. The player picks the
 * correct word from four options.
 *
 * 5 questions per day. Score: 1 pt per correct answer. Daily lock (same day
 * = same puzzle, can't replay). Share result as emoji grid.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Gavel,
  Loader2,
  RefreshCw,
  Scroll,
  Share2,
  Sparkles,
  Trophy,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { ClozePayload, ClozeQuestion } from '@/app/api/cloze/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_cloze_v1'
const QUESTION_COUNT = 5

// ─── Types ────────────────────────────────────────────────────────────────────

type GamePhase = 'loading' | 'playing' | 'done' | 'already_done' | 'error'

interface StoredResult {
  date: string
  score: number
  answers: (number | null)[] // selected option index per question
  correct: boolean[]
}

// ─── Category style ───────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
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

const CAT_BG: Record<string, string> = {
  Economics:   'bg-gold/10 border-gold/30',
  Politics:    'bg-for-500/10 border-for-500/30',
  Technology:  'bg-purple/10 border-purple/30',
  Science:     'bg-emerald/10 border-emerald/30',
  Ethics:      'bg-against-500/10 border-against-500/30',
  Philosophy:  'bg-for-400/10 border-for-400/30',
  Culture:     'bg-gold/10 border-gold/30',
  Health:      'bg-against-400/10 border-against-400/30',
  Environment: 'bg-emerald/10 border-emerald/30',
  Education:   'bg-purple/10 border-purple/30',
}

function catColor(cat: string | null): string {
  return CAT_COLOR[cat ?? ''] ?? 'text-surface-400'
}
function catBg(cat: string | null): string {
  return CAT_BG[cat ?? ''] ?? 'bg-surface-300/20 border-surface-400/30'
}

// ─── Score message ────────────────────────────────────────────────────────────

function scoreMessage(score: number, total: number): { text: string; color: string } {
  const pct = score / total
  if (pct === 1)   return { text: 'Perfect! Civic lexicon mastered.', color: 'text-gold' }
  if (pct >= 0.8)  return { text: 'Excellent civic vocabulary!', color: 'text-emerald' }
  if (pct >= 0.6)  return { text: 'Solid command of the Lobby.', color: 'text-for-300' }
  if (pct >= 0.4)  return { text: 'Keep engaging with the debates.', color: 'text-gold' }
  return { text: 'The Lobby awaits your study.', color: 'text-against-400' }
}

// ─── Share text ───────────────────────────────────────────────────────────────

function buildShareText(score: number, correct: boolean[], date: string): string {
  const grid = correct.map((c) => (c ? '🟩' : '🟥')).join('')
  return `Civic Cloze ${date}\n${score}/${correct.length} ${grid}\n\nlobby.market/cloze`
}

// ─── Option label ─────────────────────────────────────────────────────────────

const OPTION_LABELS = ['A', 'B', 'C', 'D']

// ─── Render clue with blank ───────────────────────────────────────────────────

function ClueSentence({ clue, answer, revealed }: { clue: string; answer: string; revealed: boolean }) {
  const parts = clue.split('_____')
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span
              className={cn(
                'inline-block px-2 py-0.5 mx-1 rounded font-bold font-mono transition-all duration-300',
                revealed
                  ? 'bg-emerald/20 text-emerald border border-emerald/40'
                  : 'bg-surface-300/80 text-surface-500 border border-surface-400/50 min-w-[80px] text-center'
              )}
            >
              {revealed ? answer : '_____'}
            </span>
          )}
        </span>
      ))}
    </span>
  )
}

// ─── Question progress dots ───────────────────────────────────────────────────

function ProgressDots({
  total,
  current,
  correct,
}: {
  total: number
  current: number
  correct: (boolean | null)[]
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const isAnswered = i < current
        const wasCorrect = correct[i]
        return (
          <div
            key={i}
            className={cn(
              'h-2 rounded-full transition-all duration-300',
              i === current ? 'w-6 bg-for-400' : 'w-2',
              isAnswered && wasCorrect === true ? 'bg-emerald' : '',
              isAnswered && wasCorrect === false ? 'bg-against-500' : '',
              !isAnswered && i !== current ? 'bg-surface-400' : '',
            )}
          />
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ClozeClient() {
  const [phase, setPhase] = useState<GamePhase>('loading')
  const [questions, setQuestions] = useState<ClozeQuestion[]>([])
  const [date, setDate] = useState('')
  const [currentQ, setCurrentQ] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [correctArr, setCorrectArr] = useState<(boolean | null)[]>([])
  const [finalScore, setFinalScore] = useState(0)
  const [storedResult, setStoredResult] = useState<StoredResult | null>(null)
  const [copied, setCopied] = useState(false)
  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/cloze')
      if (!res.ok) throw new Error('Failed')
      const data: ClozePayload = await res.json()
      if (!data.questions.length) {
        setPhase('error')
        return
      }
      setDate(data.date)

      // Check stored result
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as StoredResult
        if (parsed.date === data.date) {
          setStoredResult(parsed)
          setQuestions(data.questions)
          setFinalScore(parsed.score)
          setAnswers(parsed.answers)
          setCorrectArr(parsed.correct)
          setPhase('already_done')
          return
        }
      }

      setQuestions(data.questions)
      setAnswers(new Array(data.questions.length).fill(null))
      setCorrectArr(new Array(data.questions.length).fill(null))
      setPhase('playing')
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    load()
    return () => { if (revealTimeout.current) clearTimeout(revealTimeout.current) }
  }, [load])

  function handleSelect(optionIndex: number) {
    if (revealed || selectedIndex !== null) return
    setSelectedIndex(optionIndex)
    setRevealed(true)

    const q = questions[currentQ]
    const isCorrect = optionIndex === q.correctIndex

    const newAnswers = [...answers]
    newAnswers[currentQ] = optionIndex
    setAnswers(newAnswers)

    const newCorrect = [...correctArr]
    newCorrect[currentQ] = isCorrect
    setCorrectArr(newCorrect)

    // Auto-advance after 1.2s
    revealTimeout.current = setTimeout(() => {
      advanceOrFinish(newAnswers, newCorrect as boolean[])
    }, 1200)
  }

  function advanceOrFinish(newAnswers: (number | null)[], newCorrect: boolean[]) {
    const nextQ = currentQ + 1

    if (nextQ >= questions.length) {
      const score = newCorrect.filter(Boolean).length
      setFinalScore(score)
      const result: StoredResult = {
        date,
        score,
        answers: newAnswers,
        correct: newCorrect,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      setStoredResult(result)
      setPhase('done')
    } else {
      setCurrentQ(nextQ)
      setSelectedIndex(null)
      setRevealed(false)
    }
  }

  function handleNext() {
    if (revealTimeout.current) {
      clearTimeout(revealTimeout.current)
      revealTimeout.current = null
    }
    advanceOrFinish(answers, correctArr as boolean[])
  }

  async function handleShare() {
    const result = storedResult ?? {
      score: finalScore,
      correct: correctArr as boolean[],
      date,
      answers,
    }
    const text = buildShareText(result.score, result.correct, result.date)
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      await navigator.clipboard.writeText(text).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // ── Render: loading ────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 text-surface-500 animate-spin" />
            <p className="text-sm font-mono text-surface-500">Loading today&apos;s puzzle…</p>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── Render: error ──────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <XCircle className="h-10 w-10 text-against-400" />
            <p className="text-sm font-mono text-surface-500">
              Not enough laws yet to run the puzzle. Check back soon!
            </p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── Render: done or already_done ───────────────────────────────────────────
  if (phase === 'done' || phase === 'already_done') {
    const displayResult = storedResult ?? { score: finalScore, correct: correctArr as boolean[], date, answers }
    const msg = scoreMessage(displayResult.score, QUESTION_COUNT)
    const shareText = buildShareText(displayResult.score, displayResult.correct, displayResult.date)
    const totalQ = questions.length || QUESTION_COUNT

    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-24 md:pb-12">
          <div className="max-w-xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-2 mb-8">
              <Link
                href="/arcade"
                className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Arcade
              </Link>
            </div>

            {/* Result card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface-100 border border-surface-300 rounded-2xl p-6 text-center mb-6"
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <Scroll className="h-5 w-5 text-gold" />
                <h1 className="font-mono text-xl font-bold text-white">Civic Cloze</h1>
              </div>
              <p className="text-xs font-mono text-surface-500 mb-5">{displayResult.date}</p>

              {/* Score */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <Trophy className="h-8 w-8 text-gold" />
                <span className="font-mono text-5xl font-bold text-white">
                  {displayResult.score}
                  <span className="text-2xl text-surface-500">/{totalQ}</span>
                </span>
              </div>

              <p className={cn('text-sm font-mono font-semibold mb-5', msg.color)}>{msg.text}</p>

              {/* Emoji grid */}
              <div className="flex items-center justify-center gap-1.5 mb-5">
                {displayResult.correct.map((c, i) => (
                  <span key={i} className="text-xl">
                    {c ? '🟩' : '🟥'}
                  </span>
                ))}
              </div>

              {/* Share */}
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-5 py-2.5 bg-for-600 hover:bg-for-700 text-white rounded-xl font-mono font-semibold text-sm transition-colors mx-auto"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4" />
                    Share result
                  </>
                )}
              </button>
            </motion.div>

            {/* Question review */}
            {questions.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Review</p>
                {questions.map((q, i) => {
                  const wasCorrect = displayResult.correct[i]
                  const chosen = displayResult.answers[i]
                  return (
                    <motion.div
                      key={q.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className={cn(
                        'bg-surface-100 border rounded-xl p-4',
                        wasCorrect
                          ? 'border-emerald/30 bg-emerald/5'
                          : 'border-against-500/30 bg-against-500/5'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {wasCorrect ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald" />
                          ) : (
                            <XCircle className="h-4 w-4 text-against-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono text-surface-400 mb-1 leading-relaxed">
                            <ClueSentence clue={q.clue} answer={q.answer} revealed />
                          </p>
                          {!wasCorrect && chosen !== null && (
                            <p className="text-[11px] font-mono text-against-400">
                              You chose: <span className="font-bold">{q.options[chosen]}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {q.category && (
                              <span className={cn('text-[10px] font-mono font-semibold', catColor(q.category))}>
                                {q.category}
                              </span>
                            )}
                            <span className={cn(
                              'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                              q.source === 'law'
                                ? 'text-gold bg-gold/10 border-gold/30'
                                : 'text-for-400 bg-for-500/10 border-for-500/30'
                            )}>
                              {q.source === 'law' ? 'LAW' : 'DEBATE'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}

            {/* Copy share text fallback */}
            <div className="mt-6 bg-surface-100 border border-surface-300 rounded-xl p-4">
              <p className="text-xs font-mono text-surface-500 mb-2">Share text</p>
              <pre className="text-xs font-mono text-white whitespace-pre-wrap break-all">{shareText}</pre>
              <button
                onClick={() => { navigator.clipboard.writeText(shareText).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-surface-200 border border-surface-300 rounded-lg text-xs font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Nav links */}
            <div className="mt-6 flex gap-3">
              <Link
                href="/arcade"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-200 border border-surface-300 rounded-xl text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Arcade
              </Link>
              <Link
                href="/law"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-200 border border-surface-300 rounded-xl text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <Gavel className="h-4 w-4" />
                The Codex
              </Link>
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Render: playing ────────────────────────────────────────────────────────
  const q = questions[currentQ]
  if (!q) return null

  const isLastQ = currentQ === questions.length - 1
  const correctSoFar = (correctArr as (boolean | null)[]).filter((c) => c === true).length

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24 md:pb-12">
        <div className="max-w-xl mx-auto px-4 py-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/arcade"
              className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Arcade
            </Link>
            <div className="flex items-center gap-2">
              <Scroll className="h-4 w-4 text-gold" />
              <span className="font-mono text-sm font-bold text-white">Civic Cloze</span>
              <span className="font-mono text-xs text-surface-500">· Daily</span>
            </div>
            <span className="font-mono text-sm text-surface-500">
              {currentQ + 1}/{questions.length}
            </span>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center mb-6">
            <ProgressDots
              total={questions.length}
              current={currentQ}
              correct={correctArr}
            />
          </div>

          {/* Score strip */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald/10 border border-emerald/30 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
              <span className="text-xs font-mono font-bold text-emerald">{correctSoFar} correct</span>
            </div>
            {q.category && (
              <span className={cn('text-xs font-mono font-semibold px-2.5 py-1 rounded-full border', catBg(q.category), catColor(q.category))}>
                {q.category}
              </span>
            )}
            <span className={cn(
              'text-xs font-mono font-semibold px-2.5 py-1 rounded-full border',
              q.source === 'law'
                ? 'text-gold bg-gold/10 border-gold/30'
                : 'text-for-400 bg-for-500/10 border-for-500/30'
            )}>
              {q.source === 'law' ? (
                <><Gavel className="h-3 w-3 inline mr-1" />LAW</>
              ) : (
                <><FileText className="h-3 w-3 inline mr-1" />DEBATE</>
              )}
            </span>
          </div>

          {/* Question card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
              className="bg-surface-100 border border-surface-300 rounded-2xl p-6 mb-6"
            >
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                Complete the statement
              </p>
              <p className="text-base font-medium text-white leading-relaxed">
                <ClueSentence clue={q.clue} answer={q.answer} revealed={revealed} />
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Options */}
          <div className="space-y-2.5 mb-6">
            {q.options.map((option, idx) => {
              const isSelected = selectedIndex === idx
              const isCorrect = idx === q.correctIndex
              const showResult = revealed

              let btnClass = 'bg-surface-100 border-surface-300 text-white hover:bg-surface-200 hover:border-surface-400'
              if (showResult) {
                if (isCorrect) btnClass = 'bg-emerald/15 border-emerald/50 text-emerald'
                else if (isSelected && !isCorrect) btnClass = 'bg-against-500/15 border-against-500/50 text-against-300'
                else btnClass = 'bg-surface-100 border-surface-300/50 text-surface-500'
              } else if (isSelected) {
                btnClass = 'bg-for-500/20 border-for-500/50 text-for-300'
              }

              return (
                <motion.button
                  key={idx}
                  whileTap={!revealed ? { scale: 0.98 } : undefined}
                  onClick={() => handleSelect(idx)}
                  disabled={revealed}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all duration-200 text-left',
                    btnClass
                  )}
                >
                  <span className={cn(
                    'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-xs font-mono font-bold border',
                    showResult && isCorrect ? 'bg-emerald/20 border-emerald/50 text-emerald' :
                    showResult && isSelected && !isCorrect ? 'bg-against-500/20 border-against-500/50 text-against-300' :
                    'bg-surface-200 border-surface-400 text-surface-400'
                  )}>
                    {showResult && isCorrect ? <Check className="h-3.5 w-3.5" /> :
                     showResult && isSelected && !isCorrect ? <X className="h-3.5 w-3.5" /> :
                     OPTION_LABELS[idx]}
                  </span>
                  <span className="font-mono text-sm font-semibold">{option}</span>
                </motion.button>
              )
            })}
          </div>

          {/* Next button (visible after answering) */}
          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                {/* Feedback message */}
                <div className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl mb-4 text-sm font-mono font-semibold',
                  selectedIndex === q.correctIndex
                    ? 'bg-emerald/10 border border-emerald/30 text-emerald'
                    : 'bg-against-500/10 border border-against-500/30 text-against-300'
                )}>
                  {selectedIndex === q.correctIndex ? (
                    <><Sparkles className="h-4 w-4" />Correct! The word was <span className="text-white">&ldquo;{q.answer}&rdquo;</span></>
                  ) : (
                    <><Zap className="h-4 w-4" />The correct word was <span className="text-emerald">&ldquo;{q.answer}&rdquo;</span></>
                  )}
                </div>

                <button
                  onClick={handleNext}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-for-600 hover:bg-for-700 text-white rounded-xl font-mono font-semibold text-sm transition-colors"
                >
                  {isLastQ ? (
                    <><Trophy className="h-4 w-4" />See Results</>
                  ) : (
                    <><ArrowRight className="h-4 w-4" />Next Question</>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
