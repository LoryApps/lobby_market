'use client'

/**
 * /knowledge-test — Weekly Civic Knowledge Test
 *
 * 8 multiple-choice questions built from real platform data (vote counts,
 * laws passed, category stats, debate types, top users).
 * Questions change each calendar week. Score stored in localStorage so
 * you can't replay the same week's test.
 * Max 80 pts (10 per question). Graded S / A / B / C / D / F.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Share2,
  Trophy,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { KnowledgeQuestion, KnowledgeTestPayload } from '@/app/api/knowledge-test/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const PTS_PER_Q = 10
const STORAGE_KEY = 'lm_knowledge_test_v1'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedResult {
  week: string
  score: number
  total: number
  answers: number[]  // chosen index per question
}

// ─── Scoring / grading ────────────────────────────────────────────────────────

function gradeScore(score: number, max: number): {
  letter: string
  color: string
  label: string
} {
  const pct = max > 0 ? score / max : 0
  if (pct >= 0.95) return { letter: 'S',  color: 'text-gold',          label: 'Civic Oracle' }
  if (pct >= 0.80) return { letter: 'A',  color: 'text-for-300',       label: 'Civic Expert' }
  if (pct >= 0.65) return { letter: 'B',  color: 'text-emerald',       label: 'Informed Citizen' }
  if (pct >= 0.50) return { letter: 'C',  color: 'text-purple',        label: 'Learning' }
  if (pct >= 0.35) return { letter: 'D',  color: 'text-against-300',   label: 'Civic Novice' }
  return                   { letter: 'F',  color: 'text-against-400',   label: 'Political Amnesia' }
}

function buildShareText(score: number, max: number, week: string): string {
  const { letter, label } = gradeScore(score, max)
  const pct = max > 0 ? Math.round((score / max) * 100) : 0
  const filled = Math.round(pct / 10)
  const bar = '■'.repeat(filled) + '□'.repeat(10 - filled)
  return [
    `Lobby Market Civic Knowledge Test — ${week}`,
    `Score: ${score}/${max} (${pct}%) — Grade ${letter}: ${label}`,
    bar,
    'lobby.market/knowledge-test',
  ].join('\n')
}

// ─── Category badge ───────────────────────────────────────────────────────────

const CAT_CONFIG: Record<KnowledgeQuestion['category'], {
  label: string
  color: string
  bg: string
  icon: typeof Scale
}> = {
  platform: { label: 'Platform',  color: 'text-for-400',     bg: 'bg-for-500/10',      icon: Zap },
  civic:    { label: 'Civic',     color: 'text-emerald',     bg: 'bg-emerald/10',      icon: Scale },
  stats:    { label: 'Stats',     color: 'text-purple',      bg: 'bg-purple/10',       icon: BarChart2 },
  law:      { label: 'Law',       color: 'text-gold',        bg: 'bg-gold/10',         icon: Gavel },
}

function CategoryTag({ cat }: { cat: KnowledgeQuestion['category'] }) {
  const cfg = CAT_CONFIG[cat]
  const Icon = cfg.icon
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border',
      cfg.color,
      cfg.bg,
      'border-current/20',
    )}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KnowledgeTestPage() {
  const [payload, setPayload] = useState<KnowledgeTestPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Quiz state
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])          // chosen index per question
  const [revealed, setRevealed] = useState(false)               // answer revealed for current Q
  const [done, setDone] = useState(false)
  const [saved, setSaved] = useState<SavedResult | null>(null)  // already-completed this week
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load data ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/knowledge-test')
      .then((r) => {
        if (!r.ok) throw new Error('Not enough platform data yet — check back soon.')
        return r.json() as Promise<KnowledgeTestPayload>
      })
      .then((data) => {
        // Check localStorage for already-completed this week
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (raw) {
            const prev = JSON.parse(raw) as SavedResult
            if (prev.week === data.week) {
              setSaved(prev)
              setDone(true)
              setAnswers(prev.answers)
            }
          }
        } catch { /* ignore */ }
        setPayload(data)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  // ── Answer selection ───────────────────────────────────────────────────

  const choose = useCallback((choiceIdx: number) => {
    if (revealed || done) return
    const newAnswers = [...answers, choiceIdx]
    setAnswers(newAnswers)
    setRevealed(true)

    // Auto-advance after 1.8s
    timerRef.current = setTimeout(() => {
      if (!payload) return
      if (current + 1 >= payload.questions.length) {
        // Quiz complete
        const score = newAnswers.reduce((s, ans, qi) =>
          s + (ans === payload.questions[qi].correctIndex ? PTS_PER_Q : 0), 0)
        const result: SavedResult = {
          week: payload.week,
          score,
          total: payload.questions.length * PTS_PER_Q,
          answers: newAnswers,
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)) } catch { /* ignore */ }
        setSaved(result)
        setDone(true)
      } else {
        setCurrent((c) => c + 1)
        setRevealed(false)
      }
    }, 1800)
  }, [revealed, done, answers, current, payload])

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  // ── Share ──────────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (!saved || !payload) return
    const text = buildShareText(saved.score, saved.total, payload.week)
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch { /* ignore */ }
  }, [saved, payload])

  // ── Skip to next (after reveal) ────────────────────────────────────────

  const advance = useCallback(() => {
    if (!payload || !revealed) return
    if (timerRef.current) clearTimeout(timerRef.current)
    if (current + 1 >= payload.questions.length) {
      const score = answers.reduce((s, ans, qi) =>
        s + (ans === payload.questions[qi].correctIndex ? PTS_PER_Q : 0), 0)
      const result: SavedResult = {
        week: payload.week,
        score,
        total: payload.questions.length * PTS_PER_Q,
        answers,
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)) } catch { /* ignore */ }
      setSaved(result)
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setRevealed(false)
    }
  }, [payload, revealed, current, answers])

  // ─────────────────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/10 border border-gold/30">
              <BookOpen className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Civic Knowledge Test</h1>
              {payload && (
                <p className="text-xs text-surface-500">Week {payload.week} · {payload.totalQuestions} questions</p>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48 rounded-lg" />
            <Skeleton className="h-40 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Scale className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-white font-semibold mb-1">Not enough data yet</p>
            <p className="text-surface-500 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center gap-2 text-sm text-for-400 hover:text-for-300"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        )}

        {/* Quiz complete / result */}
        {!loading && !error && done && saved && payload && (
          <ResultView
            saved={saved}
            questions={payload.questions}
            week={payload.week}
            copied={copied}
            onShare={handleShare}
          />
        )}

        {/* Active quiz */}
        {!loading && !error && !done && payload && (
          <QuizView
            questions={payload.questions}
            current={current}
            answers={answers}
            revealed={revealed}
            onChoose={choose}
            onAdvance={advance}
          />
        )}

      </main>

      <BottomNav />
    </div>
  )
}

// ─── Quiz view ────────────────────────────────────────────────────────────────

function QuizView({
  questions,
  current,
  answers,
  revealed,
  onChoose,
  onAdvance,
}: {
  questions: KnowledgeQuestion[]
  current: number
  answers: number[]
  revealed: boolean
  onChoose: (i: number) => void
  onAdvance: () => void
}) {
  const q = questions[current]
  const chosen = answers[current] ?? -1
  const progress = ((current + (revealed ? 1 : 0)) / questions.length) * 100

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={current}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.25 }}
        className="space-y-5"
      >
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-surface-500">
            <span>Question {current + 1} of {questions.length}</span>
            <span>{current * PTS_PER_Q} / {questions.length * PTS_PER_Q} pts</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gold"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Category */}
        <CategoryTag cat={q.category} />

        {/* Question */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <p className="text-white font-semibold leading-snug text-[15px]">{q.question}</p>
        </div>

        {/* Choices */}
        <div className="space-y-2.5">
          {q.choices.map((choice, i) => {
            const isChosen = chosen === i
            const isCorrect = i === q.correctIndex
            let variant: 'neutral' | 'correct' | 'wrong' | 'dim' = 'neutral'
            if (revealed) {
              if (isCorrect) variant = 'correct'
              else if (isChosen) variant = 'wrong'
              else variant = 'dim'
            }

            return (
              <motion.button
                key={i}
                onClick={() => onChoose(i)}
                disabled={revealed}
                whileTap={revealed ? {} : { scale: 0.98 }}
                className={cn(
                  'w-full text-left rounded-xl border px-4 py-3.5 transition-all duration-200',
                  'flex items-center justify-between gap-3',
                  variant === 'neutral' && 'bg-surface-100 border-surface-300 hover:border-for-500/50 hover:bg-surface-200 text-white cursor-pointer',
                  variant === 'correct' && 'bg-emerald/10 border-emerald/50 text-emerald',
                  variant === 'wrong'   && 'bg-against-500/10 border-against-500/50 text-against-300',
                  variant === 'dim'     && 'bg-surface-100 border-surface-200 text-surface-500 cursor-default',
                )}
              >
                <span className="text-sm font-medium leading-snug">{choice}</span>
                {revealed && variant === 'correct' && <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald" />}
                {revealed && variant === 'wrong'   && <XCircle className="h-4 w-4 flex-shrink-0 text-against-400" />}
              </motion.button>
            )
          })}
        </div>

        {/* Explanation */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-surface-100 border border-surface-300 p-4"
            >
              <p className="text-sm text-surface-400 leading-relaxed">{q.explanation}</p>
              <button
                onClick={onAdvance}
                className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-for-400 hover:text-for-300 transition-colors"
              >
                {current + 1 < questions.length ? (
                  <>Next question <ChevronRight className="h-4 w-4" /></>
                ) : (
                  <>See results <Trophy className="h-4 w-4" /></>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Result view ──────────────────────────────────────────────────────────────

function ResultView({
  saved,
  questions,
  week,
  copied,
  onShare,
}: {
  saved: SavedResult
  questions: KnowledgeQuestion[]
  week: string
  copied: boolean
  onShare: () => void
}) {
  const grade = gradeScore(saved.score, saved.total)
  const pct = Math.round((saved.score / saved.total) * 100)
  const correct = saved.answers.filter((ans, i) => ans === questions[i]?.correctIndex).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Score card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center space-y-3">
        <p className="text-xs text-surface-500 font-medium uppercase tracking-wider">{week}</p>

        <div className={cn(
          'inline-flex items-center justify-center h-20 w-20 rounded-2xl text-4xl font-black border-2 mx-auto',
          grade.letter === 'S' ? 'bg-gold/10 border-gold/40' :
          grade.letter === 'A' ? 'bg-for-500/10 border-for-500/40' :
          grade.letter === 'B' ? 'bg-emerald/10 border-emerald/40' :
          grade.letter === 'C' ? 'bg-purple/10 border-purple/40' :
          grade.letter === 'D' ? 'bg-against-500/10 border-against-500/40' :
                                  'bg-against-500/10 border-against-500/40',
          grade.color,
        )}>
          {grade.letter}
        </div>

        <div>
          <p className={cn('text-2xl font-black', grade.color)}>{saved.score} / {saved.total}</p>
          <p className="text-surface-400 text-sm">{pct}% · {grade.label}</p>
        </div>

        <div className="flex items-center justify-center gap-4 pt-1 text-sm text-surface-500">
          <span className="flex items-center gap-1 text-emerald">
            <Check className="h-3.5 w-3.5" /> {correct} correct
          </span>
          <span className="flex items-center gap-1 text-against-400">
            <X className="h-3.5 w-3.5" /> {saved.answers.length - correct} wrong
          </span>
        </div>
      </div>

      {/* Share */}
      <button
        onClick={onShare}
        className={cn(
          'w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold border transition-all',
          copied
            ? 'bg-emerald/10 border-emerald/40 text-emerald'
            : 'bg-surface-100 border-surface-300 text-white hover:bg-surface-200',
        )}
      >
        {copied ? (
          <><CheckCircle2 className="h-4 w-4" /> Copied!</>
        ) : (
          <><Share2 className="h-4 w-4" /> Share result</>
        )}
      </button>

      {/* Answer review */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Answer Review</h2>
        {questions.map((q, qi) => {
          const chosen = saved.answers[qi] ?? -1
          const isCorrect = chosen === q.correctIndex
          return (
            <div
              key={q.id}
              className={cn(
                'rounded-xl border p-4 space-y-2',
                isCorrect ? 'bg-emerald/5 border-emerald/20' : 'bg-against-500/5 border-against-500/20',
              )}
            >
              <div className="flex items-start gap-2">
                {isCorrect
                  ? <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                  : <XCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                }
                <p className="text-sm text-white leading-snug">{q.question}</p>
              </div>
              <div className="pl-6 space-y-1 text-xs text-surface-400">
                {!isCorrect && (
                  <p className="text-against-300">
                    Your answer: <span className="font-medium">{q.choices[chosen] ?? '—'}</span>
                  </p>
                )}
                <p className={isCorrect ? 'text-emerald' : 'text-surface-400'}>
                  Correct: <span className="font-medium">{q.choices[q.correctIndex]}</span>
                </p>
                <p className="text-surface-500 leading-relaxed">{q.explanation}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Next week notice */}
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3 text-sm text-surface-400">
        <Flame className="h-4 w-4 text-gold flex-shrink-0" />
        <span>A new test drops every Monday. Come back next week for fresh questions.</span>
      </div>

      {/* CTA links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/trivia"
          className="flex items-center justify-center gap-2 rounded-xl bg-surface-100 border border-surface-300 py-3 text-sm font-semibold text-white hover:bg-surface-200 transition-colors"
        >
          <BarChart2 className="h-4 w-4 text-for-400" /> Daily Trivia
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-xl bg-for-600 border border-for-500/50 py-3 text-sm font-semibold text-white hover:bg-for-700 transition-colors"
        >
          <Zap className="h-4 w-4" /> Back to Feed
        </Link>
      </div>
    </motion.div>
  )
}
