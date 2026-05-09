'use client'

/**
 * /civic-mirror — Civic Mirror
 *
 * Five real platform topics per day. Vote FOR or AGAINST purely on gut
 * instinct — no vote splits shown yet. After each tap, reveal the
 * community's actual majority and see if you're aligned or a contrarian.
 *
 * Scoring: 1 pt for each vote you cast with the community majority.
 * Storage key: lm_mirror_v1 → { date, score, total, answers: [] }
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
  Gauge,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MirrorTopic, MirrorPayload } from '@/app/api/civic-mirror/route'

// ─── localStorage ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_mirror_v1'

interface StoredResult {
  date: string
  score: number
  total: number
  answers: Array<{ id: string; picked: 'blue' | 'red'; withMajority: boolean }>
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadResult(): StoredResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredResult) : null
  } catch {
    return null
  }
}

function saveResult(r: StoredResult) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r))
  } catch {}
}

function buildShareText(score: number): string {
  const pips = Array.from({ length: 5 }, (_, i) => (i < score ? '🟦' : '⬜')).join('')
  return [`Civic Mirror — ${todayStr()}`, pips, `${score}/5 with the majority`, 'lobby.market/civic-mirror'].join('\n')
}

// ─── Category colour ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Healthcare: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
  Technology: 'text-for-300',
  Justice: 'text-against-400',
  Immigration: 'text-surface-400',
}

function catColor(c: string | null) {
  if (!c) return 'text-surface-400'
  for (const [k, v] of Object.entries(CAT_COLOR)) {
    if (c.toLowerCase().includes(k.toLowerCase())) return v
  }
  return 'text-surface-400'
}

// ─── Question phase ───────────────────────────────────────────────────────────

interface QuestionProps {
  topic: MirrorTopic
  index: number
  total: number
  onAnswer: (side: 'blue' | 'red') => void
}

function QuestionPhase({ topic, index, total, onAnswer }: QuestionProps) {
  const [picked, setPicked] = useState<'blue' | 'red' | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pick = useCallback(
    (side: 'blue' | 'red') => {
      if (picked) return
      setPicked(side)
      timerRef.current = setTimeout(() => onAnswer(side), 700)
    },
    [picked, onAnswer],
  )

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <motion.div
      key={topic.id}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-all duration-300',
                i < index ? 'bg-for-500' : i === index ? 'bg-gold' : 'bg-surface-300',
              )}
            />
          ))}
        </div>
        <span className="text-xs text-surface-500 font-mono shrink-0">{index + 1}/{total}</span>
      </div>

      {topic.category && (
        <span className={cn('text-xs font-semibold uppercase tracking-widest', catColor(topic.category))}>
          {topic.category}
        </span>
      )}

      <div className="text-xl sm:text-2xl font-bold text-surface-100 leading-snug">
        {topic.statement}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <button
          onClick={() => pick('blue')}
          disabled={!!picked}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 py-7 px-4 transition-all font-bold text-sm uppercase tracking-wider',
            picked === 'blue'
              ? 'border-for-500 bg-for-500/20 text-for-300 scale-95'
              : picked === 'red'
              ? 'border-surface-400 bg-surface-100/30 text-surface-500 opacity-40'
              : 'border-for-500/30 bg-for-500/5 text-for-400 hover:bg-for-500/15 hover:border-for-500/60 active:scale-95',
          )}
        >
          <ThumbsUp className="h-6 w-6" />
          For
        </button>
        <button
          onClick={() => pick('red')}
          disabled={!!picked}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 py-7 px-4 transition-all font-bold text-sm uppercase tracking-wider',
            picked === 'red'
              ? 'border-against-500 bg-against-500/20 text-against-300 scale-95'
              : picked === 'blue'
              ? 'border-surface-400 bg-surface-100/30 text-surface-500 opacity-40'
              : 'border-against-500/30 bg-against-500/5 text-against-400 hover:bg-against-500/15 hover:border-against-500/60 active:scale-95',
          )}
        >
          <ThumbsDown className="h-6 w-6" />
          Against
        </button>
      </div>

      {!picked && (
        <p className="text-xs text-surface-500 text-center">
          Vote your gut — the community split reveals after you answer
        </p>
      )}
    </motion.div>
  )
}

// ─── Reveal phase ─────────────────────────────────────────────────────────────

interface RevealProps {
  topic: MirrorTopic
  picked: 'blue' | 'red'
  withMajority: boolean
  onNext: () => void
  isLast: boolean
}

function RevealPhase({ topic, picked, withMajority, onNext, isLast }: RevealProps) {
  const forPct = topic.blue_pct
  const againstPct = 100 - forPct
  const majority = forPct >= 50 ? 'blue' : 'red'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-5"
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-5 py-4',
          withMajority ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30',
        )}
      >
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-full shrink-0', withMajority ? 'bg-for-500/20' : 'bg-against-500/20')}>
          {withMajority ? <Check className="h-5 w-5 text-for-400" /> : <X className="h-5 w-5 text-against-400" />}
        </div>
        <div>
          <p className={cn('font-bold text-base', withMajority ? 'text-for-300' : 'text-against-300')}>
            {withMajority ? 'With the majority' : 'Contrarian view'}
          </p>
          <p className="text-xs text-surface-400">
            You voted {picked === 'blue' ? 'FOR' : 'AGAINST'} · {picked === majority ? 'majority' : 'minority'} position
          </p>
        </div>
      </div>

      <p className="text-sm text-surface-400 font-medium">{topic.statement}</p>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-for-400">FOR {forPct}%</span>
          <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
          <span className="text-against-400">AGAINST {againstPct}%</span>
        </div>
        <div className="relative h-4 rounded-full overflow-hidden bg-surface-300 flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-for-500"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${againstPct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="h-full bg-against-500"
          />
        </div>
        <div className="flex justify-between text-[10px] text-surface-500 font-mono">
          <span>{picked === 'blue' ? '← Your vote' : ''}</span>
          <span>{picked === 'red' ? 'Your vote →' : ''}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href={`/topic/${topic.id}`} className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors">
          <ExternalLink className="h-3.5 w-3.5" />
          See debate
        </Link>
        <div className="flex-1" />
        <button
          onClick={onNext}
          className="flex items-center gap-2 rounded-xl bg-for-600 hover:bg-for-500 px-5 py-2.5 text-sm font-bold text-white transition-colors"
        >
          {isLast ? 'See results' : 'Next'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Results screen ───────────────────────────────────────────────────────────

interface ResultsProps {
  score: number
  total: number
  answers: StoredResult['answers']
  topics: MirrorTopic[]
}

function ResultsScreen({ score, total, answers, topics }: ResultsProps) {
  const [copied, setCopied] = useState(false)
  const pct = Math.round((score / total) * 100)

  const label =
    pct >= 80 ? 'Consensus Voice' :
    pct >= 60 ? 'Civic Centrist' :
    pct >= 40 ? 'Independent Thinker' :
    'Contrarian Outsider'

  const labelColor =
    pct >= 80 ? 'text-for-300' :
    pct >= 60 ? 'text-gold' :
    pct >= 40 ? 'text-purple' :
    'text-against-400'

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildShareText(score))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }, [score])

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 py-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-200 border-2 border-surface-300">
          <span className="text-4xl font-black text-surface-100">{score}</span>
        </div>
        <p className="text-surface-400 text-sm">out of {total} with the majority</p>
        <span className={cn('text-base font-bold', labelColor)}>{label}</span>
      </div>

      <div className="flex flex-col gap-2">
        {answers.map((ans) => {
          const topic = topics.find((t) => t.id === ans.id)
          if (!topic) return null
          return (
            <div
              key={ans.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                ans.withMajority ? 'border-for-500/20 bg-for-500/5' : 'border-surface-300 bg-surface-100/30',
              )}
            >
              <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ans.withMajority ? 'bg-for-500/20' : 'bg-surface-300')}>
                {ans.withMajority ? <Check className="h-3.5 w-3.5 text-for-400" /> : <X className="h-3.5 w-3.5 text-surface-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-300 truncate">{topic.statement}</p>
                <p className="text-[10px] text-surface-500 mt-0.5">
                  You: {ans.picked === 'blue' ? 'FOR' : 'AGAINST'} · Community: {topic.blue_pct}% FOR / {100 - topic.blue_pct}% AGAINST
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3">
        <button
          onClick={copy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-surface-400 bg-surface-200 hover:bg-surface-300 px-4 py-3 text-sm font-semibold text-surface-200 transition-colors"
        >
          {copied ? <Check className="h-4 w-4 text-for-400" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied!' : 'Share'}
        </button>
        <Link
          href="/arcade"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-for-600 hover:bg-for-500 px-4 py-3 text-sm font-bold text-white transition-colors"
        >
          <Zap className="h-4 w-4" />
          More Games
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'loading' | 'error' | 'question' | 'reveal' | 'done'

export function MirrorClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [topics, setTopics] = useState<MirrorTopic[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [pickedSide, setPickedSide] = useState<'blue' | 'red' | null>(null)
  const [answers, setAnswers] = useState<StoredResult['answers']>([])
  const [storedResult, setStoredResult] = useState<StoredResult | null>(null)

  const fetchTopics = useCallback(() => {
    setPhase('loading')
    fetch('/api/civic-mirror')
      .then((r) => r.json())
      .then((data: MirrorPayload) => {
        if (!data.topics?.length) { setPhase('error'); return }
        setTopics(data.topics)
        setPhase('question')
      })
      .catch(() => setPhase('error'))
  }, [])

  useEffect(() => {
    const saved = loadResult()
    if (saved?.date === todayStr()) {
      setAnswers(saved.answers)
      setStoredResult(saved)
      setPhase('done')
      return
    }
    fetchTopics()
  }, [fetchTopics])

  const handleAnswer = useCallback(
    (side: 'blue' | 'red') => {
      if (phase !== 'question') return
      setPickedSide(side)
      setPhase('reveal')
    },
    [phase],
  )

  const handleNext = useCallback(() => {
    const topic = topics[currentIndex]
    if (!topic || pickedSide === null) return

    const majority = topic.blue_pct >= 50 ? 'blue' : 'red'
    const withMajority = pickedSide === majority
    const newAnswer = { id: topic.id, picked: pickedSide, withMajority }
    const newAnswers = [...answers, newAnswer]
    setAnswers(newAnswers)

    if (currentIndex + 1 >= topics.length) {
      const score = newAnswers.filter((a) => a.withMajority).length
      const result: StoredResult = { date: todayStr(), score, total: topics.length, answers: newAnswers }
      saveResult(result)
      setStoredResult(result)
      setPhase('done')
    } else {
      setCurrentIndex((i) => i + 1)
      setPickedSide(null)
      setPhase('question')
    }
  }, [topics, currentIndex, pickedSide, answers])

  const currentTopic = topics[currentIndex]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28 md:pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/arcade" className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-400 bg-surface-200 hover:bg-surface-300 transition-colors">
            <ArrowLeft className="h-4 w-4 text-surface-300" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-for-500/10 border border-for-500/20">
              <Gauge className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-surface-100 leading-none">Civic Mirror</h1>
              <p className="text-xs text-surface-500 mt-0.5">Daily · {todayStr()}</p>
            </div>
          </div>
          <div className="flex-1" />
          <Badge variant="outline" className="text-for-400 border-for-500/30 bg-for-500/10 text-xs">Daily</Badge>
        </div>

        {phase === 'question' && currentIndex === 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 p-4 mb-6 text-sm text-surface-400">
            <Users className="h-4 w-4 text-surface-500 mt-0.5 shrink-0" />
            <p>Vote your gut on 5 civic topics. After each answer, see how your view compares to the community majority. No wrong answers — just your mirror.</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-16 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </div>
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-surface-400">Could not load today&apos;s topics. Try again.</p>
              <button onClick={fetchTopics} className="flex items-center gap-2 rounded-xl border border-surface-400 bg-surface-200 px-4 py-2 text-sm font-semibold text-surface-200">
                <RefreshCw className="h-4 w-4" /> Retry
              </button>
            </motion.div>
          )}

          {phase === 'question' && currentTopic && (
            <QuestionPhase
              key={`q-${currentIndex}`}
              topic={currentTopic}
              index={currentIndex}
              total={topics.length}
              onAnswer={handleAnswer}
            />
          )}

          {phase === 'reveal' && currentTopic && pickedSide && (
            <RevealPhase
              key={`r-${currentIndex}`}
              topic={currentTopic}
              picked={pickedSide}
              withMajority={pickedSide === (currentTopic.blue_pct >= 50 ? 'blue' : 'red')}
              onNext={handleNext}
              isLast={currentIndex + 1 >= topics.length}
            />
          )}

          {phase === 'done' && storedResult && (
            <ResultsScreen
              key="done"
              score={storedResult.score}
              total={storedResult.total}
              answers={storedResult.answers}
              topics={topics.length > 0 ? topics : storedResult.answers.map((a) => ({
                id: a.id,
                statement: '',
                category: null,
                blue_pct: 50,
                total_votes: 0,
              }))}
            />
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
