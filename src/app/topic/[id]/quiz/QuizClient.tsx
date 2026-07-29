'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  HelpCircle,
  Trophy,
  XCircle,
  RotateCcw,
  Lightbulb,
  ChevronRight,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicQuizData, QuizQuestion } from '@/app/api/topics/[id]/quiz/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'intro' | 'question' | 'reveal' | 'results'

interface Answer {
  questionId: string
  selectedIndex: number
  correct: boolean
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function scoreBadge(score: number, total: number) {
  const pct = total > 0 ? score / total : 0
  if (pct === 1) return { label: 'Perfect!', color: 'text-emerald' }
  if (pct >= 0.8) return { label: 'Expert', color: 'text-for-400' }
  if (pct >= 0.6) return { label: 'Well-informed', color: 'text-gold' }
  if (pct >= 0.4) return { label: 'Learning', color: 'text-surface-600' }
  return { label: 'Keep exploring', color: 'text-against-400' }
}

// ─── Option button ────────────────────────────────────────────────────────────

function OptionButton({
  label,
  index,
  selected,
  correctIndex,
  revealed,
  onSelect,
}: {
  label: string
  index: number
  selected: number | null
  correctIndex: number
  revealed: boolean
  onSelect: (i: number) => void
}) {
  const isSelected = selected === index
  const isCorrect = index === correctIndex

  let ring = 'border-surface-300 hover:border-surface-500'
  let bg = 'bg-surface-100'
  let textColor = 'text-surface-800'
  let icon: React.ReactNode = null

  if (revealed) {
    if (isCorrect) {
      ring = 'border-emerald'
      bg = 'bg-emerald/10'
      textColor = 'text-emerald'
      icon = <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald" />
    } else if (isSelected && !isCorrect) {
      ring = 'border-against-500'
      bg = 'bg-against-500/10'
      textColor = 'text-against-400'
      icon = <XCircle className="h-4 w-4 flex-shrink-0 text-against-400" />
    } else {
      ring = 'border-surface-200'
      bg = 'bg-surface-50'
      textColor = 'text-surface-600'
    }
  } else if (isSelected) {
    ring = 'border-for-500'
    bg = 'bg-for-500/10'
    textColor = 'text-for-400'
  }

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      onClick={() => !revealed && onSelect(index)}
      disabled={revealed}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all duration-200',
        ring,
        bg,
        textColor,
        !revealed && 'cursor-pointer',
        revealed && 'cursor-default',
      )}
    >
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
        {String.fromCharCode(65 + index)}
      </span>
      <span className="flex-1">{label}</span>
      {icon}
    </motion.button>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            i < current ? 'bg-for-500' : i === current ? 'bg-for-300' : 'bg-surface-200',
          )}
        />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuizClient({ topicId }: { topicId: string }) {
  const [quiz, setQuiz] = useState<TopicQuizData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('intro')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [answers, setAnswers] = useState<Answer[]>([])

  const fetchQuiz = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/quiz`)
      if (!res.ok) throw new Error('Failed to load quiz')
      const data: TopicQuizData = await res.json()
      setQuiz(data)
    } catch {
      setError('Could not load quiz. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    fetchQuiz()
  }, [fetchQuiz])

  const resetQuiz = () => {
    setPhase('intro')
    setQuestionIndex(0)
    setSelectedOption(null)
    setRevealed(false)
    setAnswers([])
    fetchQuiz()
  }

  const currentQuestion: QuizQuestion | undefined = quiz?.questions[questionIndex]

  const handleSelect = (index: number) => {
    if (revealed) return
    setSelectedOption(index)
  }

  const handleReveal = () => {
    if (selectedOption === null || !currentQuestion) return
    setRevealed(true)
    setAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        selectedIndex: selectedOption,
        correct: selectedOption === currentQuestion.correctIndex,
      },
    ])
  }

  const handleNext = () => {
    if (!quiz) return
    const nextIndex = questionIndex + 1
    if (nextIndex >= quiz.questions.length) {
      setPhase('results')
    } else {
      setQuestionIndex(nextIndex)
      setSelectedOption(null)
      setRevealed(false)
      setPhase('question')
    }
  }

  const score = answers.filter((a) => a.correct).length
  const total = quiz?.questions.length ?? 0
  const badge = scoreBadge(score, total)

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-50">
        <TopBar />
        <main className="mx-auto w-full max-w-lg flex-1 space-y-4 px-4 py-6">
          <Skeleton className="h-6 w-32 rounded-lg" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !quiz) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-50">
        <TopBar />
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-16 text-center">
          <HelpCircle className="mx-auto mb-4 h-12 w-12 text-surface-500" />
          <p className="mb-6 text-surface-700">{error ?? 'Quiz unavailable.'}</p>
          <button
            onClick={fetchQuiz}
            className="rounded-xl bg-for-500 px-6 py-3 text-sm font-semibold text-white hover:bg-for-600"
          >
            Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-50">
      <TopBar />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-surface-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to topic
        </Link>

        <AnimatePresence mode="wait">

          {/* ── Intro ─────────────────────────────────────────────────────────── */}
          {phase === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-surface-200 bg-surface-100 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-for-400" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-surface-600">
                    Topic Knowledge Quiz
                  </span>
                </div>
                <p className="text-lg font-semibold leading-snug text-surface-900">
                  {quiz.statement}
                </p>
                {quiz.category && (
                  <span className="mt-2 inline-block rounded-full bg-surface-200 px-3 py-0.5 text-xs font-medium text-surface-700">
                    {quiz.category}
                  </span>
                )}
              </div>

              <div className="space-y-3 text-sm text-surface-700">
                <p className="font-medium">How it works:</p>
                <ul className="space-y-1.5 pl-4">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-for-400" />
                    {quiz.questions.length} multiple-choice questions based on real data
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-for-400" />
                    Each question reveals an explanation after you answer
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-for-400" />
                    Score is shown at the end
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setPhase('question')}
                className="w-full rounded-xl bg-for-500 py-3.5 text-sm font-semibold text-white shadow-md hover:bg-for-600 active:scale-95 transition-all"
              >
                Start Quiz
              </button>
            </motion.div>
          )}

          {/* ── Question ──────────────────────────────────────────────────────── */}
          {(phase === 'question' || phase === 'reveal') && currentQuestion && (
            <motion.div
              key={`q-${questionIndex}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              className="space-y-5"
            >
              {/* Progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-surface-600">
                  <span>
                    Question {questionIndex + 1} of {quiz.questions.length}
                  </span>
                  <span>
                    {answers.filter((a) => a.correct).length} correct so far
                  </span>
                </div>
                <ProgressBar current={questionIndex} total={quiz.questions.length} />
              </div>

              {/* Question */}
              <div className="rounded-2xl border border-surface-200 bg-surface-100 p-5">
                <p className="text-base font-semibold leading-snug text-surface-900">
                  {currentQuestion.question}
                </p>
              </div>

              {/* Options */}
              <div className="space-y-2.5">
                {currentQuestion.options.map((opt, i) => (
                  <OptionButton
                    key={i}
                    label={opt}
                    index={i}
                    selected={selectedOption}
                    correctIndex={currentQuestion.correctIndex}
                    revealed={revealed}
                    onSelect={handleSelect}
                  />
                ))}
              </div>

              {/* Explanation (shown after reveal) */}
              <AnimatePresence>
                {revealed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 p-4 text-sm text-surface-800">
                      <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold" />
                      <p>{currentQuestion.explanation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action button */}
              {!revealed ? (
                <button
                  onClick={handleReveal}
                  disabled={selectedOption === null}
                  className={cn(
                    'w-full rounded-xl py-3.5 text-sm font-semibold transition-all',
                    selectedOption !== null
                      ? 'bg-for-500 text-white hover:bg-for-600 active:scale-95'
                      : 'cursor-not-allowed bg-surface-200 text-surface-500',
                  )}
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="w-full rounded-xl bg-surface-200 py-3.5 text-sm font-semibold text-surface-800 hover:bg-surface-300 active:scale-95 transition-all"
                >
                  {questionIndex + 1 < quiz.questions.length ? 'Next Question →' : 'See Results →'}
                </button>
              )}
            </motion.div>
          )}

          {/* ── Results ───────────────────────────────────────────────────────── */}
          {phase === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Score card */}
              <div className="rounded-2xl border border-surface-200 bg-surface-100 p-6 text-center">
                <Trophy className="mx-auto mb-3 h-10 w-10 text-gold" />
                <div className="mb-1 text-4xl font-bold text-surface-900">
                  {score}/{total}
                </div>
                <div className={cn('text-lg font-semibold', badge.color)}>{badge.label}</div>
                <div className="mt-2 text-sm text-surface-600">
                  {Math.round((score / total) * 100)}% accuracy
                </div>
              </div>

              {/* Per-question breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-600">
                  Breakdown
                </p>
                {quiz.questions.map((q, i) => {
                  const ans = answers[i]
                  return (
                    <div
                      key={q.id}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border p-3 text-sm',
                        ans?.correct
                          ? 'border-emerald/30 bg-emerald/5'
                          : 'border-against-500/30 bg-against-500/5',
                      )}
                    >
                      {ans?.correct ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-against-400" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-surface-800 leading-snug">{q.question}</p>
                        {!ans?.correct && (
                          <p className="mt-1 text-xs text-surface-600">
                            Correct: {q.options[q.correctIndex]}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={resetQuiz}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-surface-300 py-3 text-sm font-semibold text-surface-700 hover:bg-surface-200 transition-all"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake
                </button>
                <Link
                  href={`/topic/${topicId}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-for-500 py-3 text-sm font-semibold text-white hover:bg-for-600 transition-all"
                >
                  Back to Topic
                </Link>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
