'use client'

/**
 * /civic-recall — Civic Recall
 *
 * A daily flash-memory game: players study a "classified briefing" of
 * 6 civic topics for 15 seconds, then must identify those 6 topics
 * from a grid of 12 (6 targets + 6 decoys).
 *
 * Daily lock: results stored in localStorage under lm_recall_v1.
 * Deterministic daily seed so every player gets the same puzzle.
 *
 * Scoring:
 *   10 pts per correct pick (max 60)
 *   −5 pts per wrong pick (minimum 0)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Gamepad2,
  Gavel,
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
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { RecallItem, RecallPayload } from '@/app/api/civic-recall/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_recall_v1'
const BRIEFING_SECONDS = 15
const TARGET_COUNT = 6
const PTS_PER_CORRECT = 10
const PTS_WRONG = 5
const MAX_SCORE = TARGET_COUNT * PTS_PER_CORRECT

type Phase = 'loading' | 'briefing' | 'recall' | 'result'

// ─── Storage helpers ──────────────────────────────────────────────────────────

interface StoredResult {
  date: string
  score: number
  picked: string[]
  targets: string[]
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

function computeScore(picked: string[], targets: string[]): number {
  const targetSet = new Set(targets)
  let score = 0
  for (const id of picked) {
    if (targetSet.has(id)) {
      score += PTS_PER_CORRECT
    } else {
      score = Math.max(0, score - PTS_WRONG)
    }
  }
  return score
}

function buildShareText(score: number, picked: string[], targets: string[]): string {
  const targetSet = new Set(targets)
  const pips = picked.map((id) => (targetSet.has(id) ? '🟩' : '🟥'))
  const missed = TARGET_COUNT - picked.filter((id) => targetSet.has(id)).length
  const missedPips = Array.from({ length: missed }, () => '⬜')
  return [
    `Civic Recall — ${todayStr()}`,
    [...pips, ...missedPips].join(''),
    `${score}/${MAX_SCORE} pts`,
    'lobby.market/civic-recall',
  ].join('\n')
}

// ─── Category colour helpers ──────────────────────────────────────────────────

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',       bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30' },
}

function catStyle(cat: string | null) {
  return cat && CAT_COLOR[cat]
    ? CAT_COLOR[cat]
    : { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-300/30' }
}

// ─── Briefing item ────────────────────────────────────────────────────────────

function BriefingItem({ item, index }: { item: RecallItem; index: number }) {
  const cs = catStyle(item.category)
  const forPct = Math.round(item.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl border border-purple/25 bg-purple/5 p-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-purple/15 border border-purple/30 mt-0.5">
          <span className="text-[11px] font-mono font-bold text-purple">{index + 1}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {item.status === 'law' && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald/15 text-emerald border border-emerald/30">
                <Gavel className="h-2.5 w-2.5" />
                LAW
              </span>
            )}
            {item.category && (
              <span className={cn('text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full border', cs.text, cs.bg, cs.border)}>
                {item.category}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-white/95 leading-snug line-clamp-2">
            {item.statement}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
            <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />
            <span className="text-[10px] font-mono text-surface-500">
              {forPct}% / {againstPct}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Grid item ────────────────────────────────────────────────────────────────

function GridItem({
  item,
  selected,
  disabled,
  result,
  onClick,
}: {
  item: RecallItem
  selected: boolean
  disabled: boolean
  result?: 'correct' | 'wrong' | 'missed'
  onClick: () => void
}) {
  const cs = catStyle(item.category)

  const baseClass =
    'relative rounded-xl border p-3 text-left transition-all duration-150 cursor-pointer select-none'

  const stateClass = result
    ? result === 'correct'
      ? 'border-emerald/50 bg-emerald/10'
      : result === 'wrong'
      ? 'border-against-500/50 bg-against-500/10'
      : 'border-gold/40 bg-gold/5 opacity-70'
    : selected
    ? 'border-purple/60 bg-purple/15 ring-1 ring-purple/40'
    : disabled
    ? 'border-surface-300/30 bg-surface-100/50 opacity-50 cursor-default'
    : 'border-surface-300/40 bg-surface-100 hover:border-purple/40 hover:bg-purple/5 active:scale-[0.98]'

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileTap={!disabled && !result ? { scale: 0.97 } : {}}
      className={cn(baseClass, stateClass)}
      onClick={!disabled && !result ? onClick : undefined}
      disabled={disabled || !!result}
    >
      {/* Status indicator */}
      {result && (
        <div className={cn(
          'absolute top-2 right-2 h-5 w-5 rounded-full flex items-center justify-center',
          result === 'correct' ? 'bg-emerald text-white' :
          result === 'wrong' ? 'bg-against-500 text-white' :
          'bg-gold/70 text-white'
        )}>
          {result === 'correct' ? <Check className="h-3 w-3" /> :
           result === 'wrong' ? <X className="h-3 w-3" /> :
           <Eye className="h-3 w-3" />}
        </div>
      )}

      {selected && !result && (
        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-purple flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Category badge */}
      {item.category && (
        <span className={cn('inline-block text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full border mb-1.5', cs.text, cs.bg, cs.border)}>
          {item.category}
        </span>
      )}
      {item.status === 'law' && !item.category && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald/15 text-emerald border border-emerald/30 mb-1.5">
          <Gavel className="h-2.5 w-2.5" />
          LAW
        </span>
      )}

      <p className="text-xs font-medium text-white/90 leading-snug line-clamp-3 pr-5">
        {item.statement}
      </p>
    </motion.button>
  )
}

// ─── Timer arc ────────────────────────────────────────────────────────────────

function TimerArc({ remaining, total }: { remaining: number; total: number }) {
  const pct = remaining / total
  const r = 20
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - pct)
  const color = remaining > total * 0.5 ? '#22c55e' : remaining > total * 0.25 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative flex items-center justify-center">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#2a2a35" strokeWidth="3" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
        />
      </svg>
      <span
        className="absolute text-lg font-mono font-bold tabular-nums"
        style={{ color }}
      >
        {remaining}
      </span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RecallSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RecallClient() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [payload, setPayload] = useState<RecallPayload | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(BRIEFING_SECONDS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [stored, setStored] = useState<StoredResult | null>(null)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load puzzle ──────────────────────────────────────────────────────────
  const loadPuzzle = useCallback(async () => {
    setPhase('loading')
    setFetchError(null)
    try {
      const res = await fetch('/api/civic-recall', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load puzzle')
      const data = await res.json() as RecallPayload
      setPayload(data)

      // Check for existing today's result
      const prev = loadResult()
      if (prev) {
        setStored(prev)
        setScore(prev.score)
        setSelected(new Set(prev.picked))
        setSubmitted(true)
        setPhase('result')
      } else {
        setPhase('briefing')
        setTimeLeft(BRIEFING_SECONDS)
      }
    } catch {
      setFetchError('Failed to load today\'s puzzle. Please try again.')
      setPhase('loading')
    }
  }, [])

  useEffect(() => {
    loadPuzzle()
  }, [loadPuzzle])

  // ── Briefing timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'briefing') return
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          setPhase('recall')
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase])

  // ── Selection logic ──────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    if (submitted) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else if (next.size < TARGET_COUNT) {
        next.add(id)
      }
      return next
    })
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!payload) return
    const targetIds = payload.targets.map((t) => t.id)
    const pickedArr = Array.from(selected)
    const finalScore = computeScore(pickedArr, targetIds)
    setScore(finalScore)
    setSubmitted(true)
    const result: StoredResult = {
      date: todayStr(),
      score: finalScore,
      picked: pickedArr,
      targets: targetIds,
    }
    saveResult(result)
    setStored(result)
    setPhase('result')
  }

  // ── Copy share ────────────────────────────────────────────────────────────
  function handleCopy() {
    if (!payload) return
    const targetIds = payload.targets.map((t) => t.id)
    const pickedArr = stored?.picked ?? Array.from(selected)
    const text = buildShareText(score, pickedArr, targetIds)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const targetSet = new Set(payload?.targets.map((t) => t.id) ?? [])
  const pickedArr = stored?.picked ?? Array.from(selected)
  const pickedSet = new Set(pickedArr)

  function getResult(id: string): 'correct' | 'wrong' | 'missed' | undefined {
    if (!submitted) return undefined
    if (pickedSet.has(id)) {
      return targetSet.has(id) ? 'correct' : 'wrong'
    }
    if (targetSet.has(id)) return 'missed'
    return undefined
  }

  const correctCount = pickedArr.filter((id) => targetSet.has(id)).length

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/arcade"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300/60 text-surface-400 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to arcade"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Brain className="h-5 w-5 text-purple" />
          </div>

          <div>
            <h1 className="text-base font-mono font-bold text-white">Civic Recall</h1>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5">
              Daily flash-memory challenge
            </p>
          </div>

          {phase === 'loading' && !fetchError && (
            <RefreshCw className="ml-auto h-4 w-4 text-surface-500 animate-spin" />
          )}
        </div>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {fetchError && (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-300 mb-4">{fetchError}</p>
            <button
              onClick={loadPuzzle}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {phase === 'loading' && !fetchError && <RecallSkeleton />}

        {/* ── BRIEFING phase ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {phase === 'briefing' && payload && (
            <motion.div
              key="briefing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Instruction banner */}
              <div className="rounded-2xl border border-purple/30 bg-purple/10 p-4 mb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Eye className="h-4 w-4 text-purple flex-shrink-0" />
                    <div>
                      <p className="text-sm font-mono font-bold text-purple">BRIEFING</p>
                      <p className="text-[11px] font-mono text-purple/70 mt-0.5">
                        Memorise these 6 civic topics before time runs out
                      </p>
                    </div>
                  </div>
                  <TimerArc remaining={timeLeft} total={BRIEFING_SECONDS} />
                </div>
              </div>

              {/* 6 target items */}
              <div className="space-y-2.5">
                {payload.targets.map((item, i) => (
                  <BriefingItem key={item.id} item={item} index={i} />
                ))}
              </div>

              {/* Skip button */}
              <button
                onClick={() => {
                  if (timerRef.current) clearInterval(timerRef.current)
                  setPhase('recall')
                }}
                className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-surface-300/40 bg-surface-100 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <EyeOff className="h-4 w-4" />
                I&apos;m ready — start recall
              </button>
            </motion.div>
          )}

          {/* ── RECALL phase ────────────────────────────────────────────── */}
          {phase === 'recall' && payload && (
            <motion.div
              key="recall"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Instruction banner */}
              <div className="rounded-2xl border border-for-500/30 bg-for-500/5 p-4 mb-5">
                <div className="flex items-start gap-2.5">
                  <Brain className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-mono font-bold text-for-400">RECALL</p>
                    <p className="text-[11px] font-mono text-for-400/70 mt-0.5">
                      Select the 6 topics you just memorised from the 12 below
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-lg font-mono font-bold text-white tabular-nums">{selected.size}</span>
                    <span className="text-[10px] font-mono text-surface-500">/{TARGET_COUNT}</span>
                  </div>
                </div>

                {/* Selection progress bar */}
                <div className="mt-3 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full transition-all duration-200"
                    style={{ width: `${(selected.size / TARGET_COUNT) * 100}%` }}
                  />
                </div>
              </div>

              {/* 12-item grid */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {payload.grid.map((item) => (
                  <GridItem
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    disabled={selected.size >= TARGET_COUNT && !selected.has(item.id)}
                    onClick={() => toggleSelect(item.id)}
                  />
                ))}
              </div>

              {/* Submit button */}
              <motion.div
                initial={false}
                animate={selected.size > 0 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                className="mt-5"
              >
                <button
                  onClick={handleSubmit}
                  disabled={selected.size === 0}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm transition-all duration-200',
                    selected.size === TARGET_COUNT
                      ? 'bg-for-500 text-white hover:bg-for-600 shadow-lg shadow-for-500/20'
                      : 'bg-surface-200 border border-surface-300 text-surface-400 hover:bg-surface-300 hover:text-white'
                  )}
                >
                  <Zap className="h-4 w-4" />
                  {selected.size === TARGET_COUNT ? 'Submit Recall' : `Select ${TARGET_COUNT - selected.size} more`}
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ── RESULT phase ────────────────────────────────────────────── */}
          {phase === 'result' && payload && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Score card */}
              <div className={cn(
                'rounded-2xl border p-5 mb-6 text-center',
                score === MAX_SCORE
                  ? 'border-gold/40 bg-gold/5'
                  : score >= MAX_SCORE * 0.6
                  ? 'border-emerald/30 bg-emerald/5'
                  : 'border-surface-300/40 bg-surface-100'
              )}>
                {score === MAX_SCORE ? (
                  <Trophy className="h-10 w-10 text-gold mx-auto mb-2" />
                ) : score >= MAX_SCORE * 0.6 ? (
                  <Check className="h-10 w-10 text-emerald mx-auto mb-2" />
                ) : (
                  <Brain className="h-10 w-10 text-surface-400 mx-auto mb-2" />
                )}

                <p className={cn(
                  'text-4xl font-mono font-bold tabular-nums',
                  score === MAX_SCORE ? 'text-gold' : score >= MAX_SCORE * 0.6 ? 'text-emerald' : 'text-white'
                )}>
                  {score}
                </p>
                <p className="text-sm font-mono text-surface-500 mt-0.5">out of {MAX_SCORE} pts</p>

                <p className={cn(
                  'text-sm font-mono font-semibold mt-3',
                  score === MAX_SCORE ? 'text-gold' :
                  score >= MAX_SCORE * 0.8 ? 'text-emerald' :
                  score >= MAX_SCORE * 0.5 ? 'text-for-400' :
                  'text-surface-400'
                )}>
                  {score === MAX_SCORE
                    ? 'Perfect recall — photographic memory!'
                    : score >= MAX_SCORE * 0.8
                    ? `${correctCount}/6 recalled — excellent memory`
                    : score >= MAX_SCORE * 0.5
                    ? `${correctCount}/6 recalled — solid recall`
                    : score > 0
                    ? `${correctCount}/6 recalled — keep training`
                    : 'No correct picks — try again tomorrow'}
                </p>

                {/* Stat pills */}
                <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-surface-300/30">
                  <div className="text-center">
                    <p className="text-lg font-mono font-bold text-emerald tabular-nums">{correctCount}</p>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Correct</p>
                  </div>
                  <div className="h-8 w-px bg-surface-300/40" />
                  <div className="text-center">
                    <p className="text-lg font-mono font-bold text-against-400 tabular-nums">
                      {pickedArr.filter((id) => !targetSet.has(id)).length}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Wrong</p>
                  </div>
                  <div className="h-8 w-px bg-surface-300/40" />
                  <div className="text-center">
                    <p className="text-lg font-mono font-bold text-gold tabular-nums">
                      {TARGET_COUNT - correctCount}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Missed</p>
                  </div>
                </div>
              </div>

              {/* Result grid */}
              <div className="mb-5">
                <p className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider mb-3">
                  All 12 topics
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {payload.grid.map((item) => {
                    const r = getResult(item.id)
                    if (!r && !targetSet.has(item.id)) return null
                    return (
                      <GridItem
                        key={item.id}
                        item={item}
                        selected={false}
                        disabled={true}
                        result={r ?? (targetSet.has(item.id) ? 'missed' : undefined)}
                        onClick={() => {}}
                      />
                    )
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-300/40 bg-surface-100 text-sm font-mono font-semibold text-surface-400 hover:text-white hover:border-surface-400 hover:bg-surface-200 transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied!' : 'Share result'}
                </button>
                <Link
                  href="/arcade"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple/10 border border-purple/30 text-sm font-mono font-semibold text-purple hover:bg-purple/20 transition-colors"
                >
                  <Gamepad2 className="h-4 w-4" />
                  More games
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Link>
              </div>

              {/* Come back tomorrow */}
              <div className="mt-4 rounded-xl border border-surface-300/30 bg-surface-100 p-3 flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-surface-500 flex-shrink-0" />
                <p className="text-[11px] font-mono text-surface-500">
                  New briefing tomorrow. The puzzle resets at midnight UTC.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
