'use client'

/**
 * /civic-verdict — Civic Verdict
 *
 * A daily jury game. Five rounds: each shows one FOR argument and one AGAINST
 * argument from a mystery civic topic. Render your verdict — then see how it
 * compares to the platform's actual consensus.
 *
 * Daily lock via localStorage (lm_verdict_v1).
 * Max score: 50 pts (10 per correct verdict).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { VerdictPayload, VerdictTopic } from '@/app/api/civic-verdict/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_verdict_v1'
const TOTAL_ROUNDS = 5
const PTS_PER_CORRECT = 10
const MAX_SCORE = TOTAL_ROUNDS * PTS_PER_CORRECT

type Phase = 'loading' | 'intro' | 'playing' | 'result'
type Pick = 'for' | 'against' | null

// ─── Storage ──────────────────────────────────────────────────────────────────

interface StoredResult {
  date: string
  picks: ('for' | 'against')[]
  score: number
  topicIds: string[]
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

// ─── Share text ───────────────────────────────────────────────────────────────

function buildShareText(score: number, picks: ('for' | 'against')[], topics: VerdictTopic[]): string {
  const grade =
    score === MAX_SCORE ? 'S' :
    score >= 40 ? 'A' :
    score >= 30 ? 'B' :
    score >= 20 ? 'C' : 'D'
  const emoji = (pick: 'for' | 'against', topic: VerdictTopic) => {
    const correct = topic.blue_pct >= 50 ? 'for' : 'against'
    if (pick === correct) return '✅'
    return '❌'
  }
  const verdictLine = picks.map((p, i) => emoji(p, topics[i])).join('')
  return `Civic Verdict — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\nScore: ${score}/${MAX_SCORE} (Grade ${grade})\n${verdictLine}\nlobby.market/civic-verdict`
}

// ─── Components ───────────────────────────────────────────────────────────────

function ProgressDots({ current, picks, topics }: { current: number; picks: Pick[]; topics: VerdictTopic[] }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
        const pick = picks[i]
        let dotClass = 'h-2 w-2 rounded-full bg-surface-300'
        if (i === current) dotClass = 'h-2.5 w-2.5 rounded-full bg-gold animate-pulse'
        else if (pick !== null && pick !== undefined) {
          const correct = topics[i]?.blue_pct >= 50 ? 'for' : 'against'
          dotClass = pick === correct
            ? 'h-2 w-2 rounded-full bg-emerald'
            : 'h-2 w-2 rounded-full bg-against-500'
        }
        return <div key={i} className={dotClass} />
      })}
    </div>
  )
}

function ArgumentCard({
  side,
  content,
  picked,
  revealed,
  correct,
  onPick,
}: {
  side: 'for' | 'against'
  content: string
  picked: boolean
  revealed: boolean
  correct: boolean
  onPick: () => void
}) {
  const isFor = side === 'for'
  const accent = isFor
    ? { border: 'border-for-500/40', hoverBorder: 'hover:border-for-500/70', icon: 'text-for-400', bg: 'bg-for-500/10', label: 'FOR', badge: 'bg-for-600/20 border-for-600/40 text-for-300' }
    : { border: 'border-against-500/40', hoverBorder: 'hover:border-against-500/70', icon: 'text-against-400', bg: 'bg-against-500/10', label: 'AGAINST', badge: 'bg-against-600/20 border-against-600/40 text-against-300' }

  const Icon = isFor ? ThumbsUp : ThumbsDown

  const ringClass = picked
    ? isFor ? 'border-for-500/80 ring-1 ring-for-500/30' : 'border-against-500/80 ring-1 ring-against-500/30'
    : `${accent.border} ${accent.hoverBorder}`

  return (
    <motion.button
      onClick={onPick}
      disabled={revealed}
      whileHover={!revealed ? { scale: 1.01 } : {}}
      whileTap={!revealed ? { scale: 0.99 } : {}}
      className={cn(
        'relative w-full text-left rounded-2xl border bg-surface-100 p-5 transition-all cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50',
        ringClass,
        revealed && 'cursor-default',
      )}
    >
      {/* Side label */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg', accent.bg)}>
          <Icon className={cn('h-3.5 w-3.5', accent.icon)} />
        </div>
        <span className={cn('font-mono text-xs font-bold px-2 py-0.5 rounded border', accent.badge)}>
          {accent.label}
        </span>
        {picked && (
          <span className="ml-auto font-mono text-xs text-surface-500">Your verdict</span>
        )}
      </div>

      {/* Argument text */}
      <p className="font-mono text-sm text-surface-200 leading-relaxed line-clamp-4">
        {content}
      </p>

      {/* Reveal: correct/incorrect indicator */}
      <AnimatePresence>
        {revealed && correct && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-3 right-3 flex items-center justify-center h-6 w-6 rounded-full bg-emerald/20 border border-emerald/40"
          >
            <Check className="h-3.5 w-3.5 text-emerald" />
          </motion.div>
        )}
        {revealed && picked && !correct && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-3 right-3 flex items-center justify-center h-6 w-6 rounded-full bg-against-500/20 border border-against-500/40"
          >
            <X className="h-3.5 w-3.5 text-against-400" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ─── Round screen ─────────────────────────────────────────────────────────────

function RoundScreen({
  topic,
  roundIndex,
  pick,
  onPick,
}: {
  topic: VerdictTopic
  roundIndex: number
  pick: Pick
  onPick: (side: 'for' | 'against') => void
}) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    setRevealed(false)
  }, [roundIndex])

  function handlePick(side: 'for' | 'against') {
    if (revealed || pick !== null) return
    onPick(side)
    setTimeout(() => setRevealed(true), 300)
  }

  const majority = topic.blue_pct >= 50 ? 'for' : 'against'
  const userCorrect = pick === majority
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-surface-500">
          Round {roundIndex + 1} of {TOTAL_ROUNDS}
        </div>
        {topic.category && (
          <Badge variant="default" className="font-mono text-[10px]">
            {topic.category}
          </Badge>
        )}
      </div>

      {/* Prompt */}
      <p className="font-mono text-sm text-surface-400 leading-snug">
        Read both arguments. Which side has the stronger case?
      </p>

      {/* Argument cards */}
      <div className="space-y-3">
        <ArgumentCard
          side="for"
          content={topic.for_argument.content}
          picked={pick === 'for'}
          revealed={revealed}
          correct={majority === 'for'}
          onPick={() => handlePick('for')}
        />
        <ArgumentCard
          side="against"
          content={topic.against_argument.content}
          picked={pick === 'against'}
          revealed={revealed}
          correct={majority === 'against'}
          onPick={() => handlePick('against')}
        />
      </div>

      {/* Reveal block */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3"
          >
            {/* Topic reveal */}
            <div>
              <p className="font-mono text-[10px] text-surface-500 uppercase tracking-widest mb-1">
                The debate
              </p>
              <p className="font-mono text-sm font-semibold text-white leading-snug">
                {topic.statement}
              </p>
            </div>

            {/* Vote bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-mono text-xs">
                <span className={cn('font-bold', majority === 'for' ? 'text-for-400' : 'text-surface-400')}>
                  {forPct}% FOR
                </span>
                <span className={cn('font-bold', majority === 'against' ? 'text-against-400' : 'text-surface-400')}>
                  {againstPct}% AGAINST
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-200 overflow-hidden flex">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${forPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-for-700 to-for-500"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${againstPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-against-500 to-against-700"
                />
              </div>
              <p className="font-mono text-xs text-surface-500">
                {topic.total_votes.toLocaleString()} votes cast
              </p>
            </div>

            {/* Verdict feedback */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border',
              userCorrect
                ? 'bg-emerald/10 border-emerald/30 text-emerald'
                : 'bg-against-500/10 border-against-500/30 text-against-400'
            )}>
              {userCorrect
                ? <Check className="h-4 w-4 shrink-0" />
                : <X className="h-4 w-4 shrink-0" />}
              <span className="font-mono text-xs font-semibold">
                {userCorrect
                  ? `Correct — +${PTS_PER_CORRECT} pts`
                  : `Wrong — the majority voted ${majority === 'for' ? 'FOR' : 'AGAINST'}`}
              </span>
            </div>

            <Link
              href={`/topic/${topic.id}`}
              className="inline-flex items-center gap-1.5 font-mono text-xs text-surface-500 hover:text-white transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              See full debate
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Result screen ────────────────────────────────────────────────────────────

function ResultScreen({
  topics,
  picks,
  score,
}: {
  topics: VerdictTopic[]
  picks: ('for' | 'against')[]
  score: number
}) {
  const [copied, setCopied] = useState(false)

  const grade =
    score === MAX_SCORE ? 'S' :
    score >= 40 ? 'A' :
    score >= 30 ? 'B' :
    score >= 20 ? 'C' : 'D'

  const gradeConfig: Record<string, { text: string; bg: string; border: string; label: string }> = {
    S: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/40', label: 'Unanimously Guilty' },
    A: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/40', label: 'Sharp Juror' },
    B: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/40', label: 'Reasonable Verdict' },
    C: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/40', label: 'Hung Jury' },
    D: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/40', label: 'Mistrail' },
  }
  const g = gradeConfig[grade]

  function handleCopy() {
    const text = buildShareText(score, picks, topics)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6">
      {/* Score card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('rounded-2xl border p-6 text-center space-y-2', g.bg, g.border)}
      >
        <p className={cn('font-mono text-xs uppercase tracking-widest', g.text)}>{g.label}</p>
        <div className={cn('font-mono text-7xl font-black', g.text)}>{grade}</div>
        <p className="font-mono text-white text-2xl font-bold">{score} / {MAX_SCORE}</p>
        <p className="font-mono text-xs text-surface-500">
          {picks.filter((p, i) => p === (topics[i].blue_pct >= 50 ? 'for' : 'against')).length} of {TOTAL_ROUNDS} verdicts matched the crowd
        </p>
      </motion.div>

      {/* Verdict breakdown */}
      <div className="space-y-2">
        {topics.map((topic, i) => {
          const pick = picks[i]
          const majority = topic.blue_pct >= 50 ? 'for' : 'against'
          const correct = pick === majority
          const forPct = Math.round(topic.blue_pct)

          return (
            <motion.div
              key={topic.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 p-3"
            >
              <div className={cn(
                'shrink-0 flex items-center justify-center h-6 w-6 rounded-full mt-0.5',
                correct ? 'bg-emerald/20 border border-emerald/40' : 'bg-against-500/20 border border-against-500/40'
              )}>
                {correct
                  ? <Check className="h-3 w-3 text-emerald" />
                  : <X className="h-3 w-3 text-against-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-surface-300 leading-snug line-clamp-2">
                  {topic.statement}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] text-for-400">{forPct}% FOR</span>
                  <span className="font-mono text-[10px] text-surface-500">·</span>
                  <span className={cn(
                    'font-mono text-[10px]',
                    correct ? 'text-emerald' : 'text-against-400'
                  )}>
                    You voted {pick === 'for' ? 'FOR' : 'AGAINST'}
                  </span>
                </div>
              </div>
              <Link
                href={`/topic/${topic.id}`}
                className="shrink-0 text-surface-500 hover:text-white transition-colors mt-0.5"
                aria-label="View topic"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          )
        })}
      </div>

      {/* Share button */}
      <button
        onClick={handleCopy}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono text-sm font-semibold',
          'border transition-all',
          copied
            ? 'bg-emerald/10 border-emerald/40 text-emerald'
            : 'bg-surface-200 border-surface-300 text-surface-300 hover:text-white hover:border-surface-400'
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied to clipboard!' : 'Share your verdict'}
      </button>

      {/* Links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/arcade"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors font-mono text-xs text-surface-400 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Arcade
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors font-mono text-xs text-surface-400 hover:text-white"
        >
          Browse topics
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/crossfire"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors font-mono text-xs text-surface-400 hover:text-white"
        >
          <Scale className="h-3.5 w-3.5" />
          Crossfire
        </Link>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VerdictClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [payload, setPayload] = useState<VerdictPayload | null>(null)
  const [picks, setPicks] = useState<('for' | 'against' | null)[]>(Array(TOTAL_ROUNDS).fill(null))
  const [currentRound, setCurrentRound] = useState(0)
  const [score, setScore] = useState(0)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setPhase('loading')
    setError(false)
    try {
      const res = await fetch('/api/civic-verdict')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = (await res.json()) as VerdictPayload
      setPayload(data)

      // Check for saved result from today
      const saved = loadResult()
      if (saved && saved.topicIds.join(',') === data.topics.map((t) => t.id).join(',')) {
        setPicks(saved.picks)
        setScore(saved.score)
        setCurrentRound(TOTAL_ROUNDS)
        setPhase('result')
      } else {
        setPhase('intro')
      }
    } catch {
      setError(true)
      setPhase('loading')
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handlePick(side: 'for' | 'against') {
    const topic = payload!.topics[currentRound]
    const majority = topic.blue_pct >= 50 ? 'for' : 'against'
    const correct = side === majority
    const pts = correct ? PTS_PER_CORRECT : 0

    const newPicks = [...picks]
    newPicks[currentRound] = side
    setPicks(newPicks)
    setScore((s) => s + pts)

    // Wait for reveal animation, then auto-advance after 2.5s
    const isLast = currentRound === TOTAL_ROUNDS - 1
    setTimeout(() => {
      if (isLast) {
        const finalPicks = newPicks as ('for' | 'against')[]
        const finalScore = finalPicks.reduce((acc, p, i) => {
          const t = payload!.topics[i]
          const maj = t.blue_pct >= 50 ? 'for' : 'against'
          return acc + (p === maj ? PTS_PER_CORRECT : 0)
        }, 0)
        const result: StoredResult = {
          date: todayStr(),
          picks: finalPicks,
          score: finalScore,
          topicIds: payload!.topics.map((t) => t.id),
        }
        saveResult(result)
        setScore(finalScore)
        setCurrentRound(TOTAL_ROUNDS)
        setPhase('result')
      } else {
        setCurrentRound((r) => r + 1)
      }
    }, 2500)
  }


  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30">
              <Gavel className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Verdict</h1>
              <p className="font-mono text-xs text-surface-500 mt-0.5">Daily jury game — 5 rounds</p>
            </div>
          </div>
          <Link
            href="/arcade"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors font-mono text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Arcade
          </Link>
        </div>

        {/* Loading */}
        {phase === 'loading' && !error && (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <Scale className="h-12 w-12 text-surface-500" />
            <p className="font-mono text-base font-bold text-white">Court is not in session</p>
            <p className="font-mono text-sm text-surface-500">
              Not enough topics with arguments on both sides yet. Check back later.
            </p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-400 hover:text-white transition-colors font-mono text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {/* Intro */}
        <AnimatePresence>
          {phase === 'intro' && payload && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Gavel className="h-5 w-5 text-against-400" />
                  <h2 className="font-mono text-lg font-bold text-white">How it works</h2>
                </div>
                <ul className="space-y-3">
                  {[
                    { icon: Scale, text: 'Each round shows one FOR and one AGAINST argument from a mystery debate.' },
                    { icon: Gavel, text: 'Read both arguments and pick which side you think is more compelling.' },
                    { icon: Trophy, text: `Earn ${PTS_PER_CORRECT} pts when your verdict matches the platform's actual majority.` },
                    { icon: Zap, text: `5 rounds. Max ${MAX_SCORE} pts. Results lock in at midnight.` },
                  ].map(({ icon: Icon, text }, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Icon className="h-4 w-4 text-against-400 mt-0.5 shrink-0" />
                      <p className="font-mono text-sm text-surface-400 leading-snug">{text}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setPhase('playing')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-against-600 hover:bg-against-500 text-white font-mono text-sm font-bold transition-colors"
              >
                <Gavel className="h-4 w-4" />
                Enter the courtroom
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 text-surface-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="font-mono text-xs">{payload.topics.length} cases loaded for {payload.date}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Playing */}
        <AnimatePresence mode="wait">
          {phase === 'playing' && payload && currentRound < TOTAL_ROUNDS && (
            <motion.div
              key={`round-${currentRound}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Progress */}
              <div className="flex items-center justify-between mb-5">
                <ProgressDots
                  current={currentRound}
                  picks={picks as Pick[]}
                  topics={payload.topics}
                />
                <div className="flex items-center gap-1.5 font-mono text-xs text-surface-500">
                  <Trophy className="h-3.5 w-3.5 text-gold" />
                  {score} pts
                </div>
              </div>

              <RoundScreen
                topic={payload.topics[currentRound]}
                roundIndex={currentRound}
                pick={picks[currentRound]}
                onPick={handlePick}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Result */}
        <AnimatePresence>
          {phase === 'result' && payload && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ResultScreen
                topics={payload.topics}
                picks={picks as ('for' | 'against')[]}
                score={score}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>
      <BottomNav />
    </div>
  )
}
