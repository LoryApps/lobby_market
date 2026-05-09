'use client'

/**
 * /odd-one-out — Civic Odd One Out
 *
 * Four civic topics appear — three share the same category, one doesn't.
 * Tap the topic that doesn't belong. 5 rounds per day.
 * Scoring: 20 pts per correct answer (max 100).
 * Results and streak persist in localStorage.
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
  ExternalLink,
  Gamepad2,
  Heart,
  RefreshCw,
  Sparkles,
  Tag,
  Trophy,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { OddItem, OddOneOutRound, OddOneOutPayload } from '@/app/api/odd-one-out/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_odd_one_out'
const PTS_PER_CORRECT = 20
const LIVES_START = 3

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',          border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400',  bg: 'bg-against-500/10',   border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { text: 'text-against-300',  bg: 'bg-against-600/10',   border: 'border-against-600/30' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',      bg: 'bg-for-400/10',       border: 'border-for-400/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',       border: 'border-emerald/30' },
}

function catStyle(cat: string): { text: string; bg: string; border: string } {
  return CATEGORY_COLORS[cat] ?? { text: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30' }
}

// ─── Score rank ───────────────────────────────────────────────────────────────

function scoreRank(score: number, rounds: number): { label: string; color: string } {
  const pct = rounds > 0 ? score / (rounds * PTS_PER_CORRECT) : 0
  if (pct >= 1.0) return { label: 'Perfect civic categorist', color: 'text-gold' }
  if (pct >= 0.8) return { label: 'Sharp civic thinker', color: 'text-emerald' }
  if (pct >= 0.6) return { label: 'Solid civic knowledge', color: 'text-for-400' }
  if (pct >= 0.4) return { label: 'Keep reading the Codex', color: 'text-gold' }
  return { label: 'The categories need more study', color: 'text-against-400' }
}

// ─── localStorage ─────────────────────────────────────────────────────────────

interface SavedResult {
  date: string
  score: number
  answers: boolean[]
  streak: number
}

function loadSaved(): SavedResult | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedResult) : null
  } catch {
    return null
  }
}

function saveResult(result: SavedResult) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
  } catch {}
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Statement truncation ─────────────────────────────────────────────────────

function truncate(text: string, max = 90): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

// ─── Share text ───────────────────────────────────────────────────────────────

function buildShare(score: number, answers: boolean[]): string {
  const squares = answers
    .map((correct) => (correct ? '🟦' : '🟥'))
    .join('')
  return `Civic Odd One Out — ${score}/${answers.length * PTS_PER_CORRECT}\n${squares}\n\nhttps://lobby.market/odd-one-out`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusVariant(status: string): 'proposed' | 'active' | 'law' | 'failed' {
  if (status === 'law') return 'law'
  if (status === 'failed') return 'failed'
  if (status === 'voting' || status === 'active') return 'active'
  return 'proposed'
}

// ─── Lives display ────────────────────────────────────────────────────────────

function LivesDisplay({ lives, max }: { lives: number; max: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${lives} lives remaining`}>
      {Array.from({ length: max }).map((_, i) => (
        <Heart
          key={i}
          className={cn(
            'h-4 w-4 transition-all duration-300',
            i < lives ? 'text-against-400 fill-against-400' : 'text-surface-500 fill-surface-700'
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// ─── Round timer card ─────────────────────────────────────────────────────────

type ItemState = 'idle' | 'selected-correct' | 'selected-wrong' | 'revealed-correct' | 'revealed-wrong-selection' | 'faded'

function TopicCard({
  item,
  state,
  onClick,
  disabled,
}: {
  item: OddItem
  state: ItemState
  onClick: () => void
  disabled: boolean
}) {
  const style = catStyle(item.category)
  const isCorrect = state === 'selected-correct' || state === 'revealed-correct'
  const isWrong = state === 'selected-wrong'
  const isFaded = state === 'faded'
  const isRevealedWrong = state === 'revealed-wrong-selection'

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      className={cn(
        'relative w-full text-left rounded-2xl border p-4 transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
        // Base
        state === 'idle' && 'bg-surface-100 border-surface-300 hover:border-surface-400 cursor-pointer',
        // Correct selection
        isCorrect && 'bg-emerald/10 border-emerald/50 ring-2 ring-emerald/30',
        // Wrong selection
        isWrong && 'bg-against-500/10 border-against-500/50 ring-2 ring-against-500/30',
        // Revealed correct (not selected, but is the odd one out)
        state === 'revealed-correct' && 'bg-emerald/10 border-emerald/50',
        // Revealed as wrong selection (user picked this wrong, correct revealed elsewhere)
        isRevealedWrong && 'bg-against-500/10 border-against-500/50',
        // Faded (majority items after reveal)
        isFaded && 'opacity-40',
        // Disabled
        disabled && state === 'idle' && 'cursor-not-allowed',
      )}
      aria-pressed={state !== 'idle' && state !== 'faded'}
    >
      {/* Correct/wrong indicator */}
      {isCorrect && (
        <span className="absolute top-3 right-3">
          <CheckCircle2 className="h-5 w-5 text-emerald" aria-label="Correct" />
        </span>
      )}
      {isWrong && (
        <span className="absolute top-3 right-3">
          <XCircle className="h-5 w-5 text-against-400" aria-label="Wrong" />
        </span>
      )}

      {/* Category chip */}
      <div className="mb-2 flex items-center gap-1.5">
        <Tag className="h-3 w-3 text-surface-500 flex-shrink-0" aria-hidden="true" />
        <span
          className={cn(
            'text-[10px] font-mono font-semibold uppercase tracking-wide',
            isCorrect || state === 'revealed-correct' ? 'text-emerald' : style.text
          )}
        >
          {item.category}
        </span>
      </div>

      {/* Statement */}
      <p className={cn(
        'font-mono text-xs font-medium leading-snug',
        state === 'idle' ? 'text-white' : isFaded ? 'text-surface-500' : 'text-white'
      )}>
        {truncate(item.statement)}
      </p>

      {/* Status chip (subtle) */}
      <div className="mt-2">
        <Badge variant={statusVariant(item.status)} className="text-[9px] py-0 px-1.5">
          {item.status === 'law' ? 'LAW' : item.status}
        </Badge>
      </div>
    </motion.button>
  )
}

// ─── Game component ───────────────────────────────────────────────────────────

type GamePhase = 'loading' | 'playing' | 'round-result' | 'done'

export function OddOneOutClient() {
  const [phase, setPhase] = useState<GamePhase>('loading')
  const [rounds, setRounds] = useState<OddOneOutRound[]>([])
  const [roundIndex, setRoundIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LIVES_START)
  const [answers, setAnswers] = useState<boolean[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null)
  const [itemStates, setItemStates] = useState<ItemState[]>(['idle', 'idle', 'idle', 'idle'])
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [streak, setStreak] = useState(0)
  const [alreadyPlayed, setAlreadyPlayed] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load data
  const loadGame = useCallback(async () => {
    setPhase('loading')
    setError(null)

    // Check if already played today
    const saved = loadSaved()
    const today = todayUTC()
    if (saved?.date === today && saved.answers.length > 0) {
      setScore(saved.score)
      setAnswers(saved.answers)
      setStreak(saved.streak)
      setAlreadyPlayed(true)
    }
    if (saved?.streak) setStreak(saved.streak)

    try {
      const res = await fetch('/api/odd-one-out', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load rounds')
      const payload: OddOneOutPayload = await res.json()
      setRounds(payload.rounds)

      if (saved?.date === today && saved.answers.length >= payload.rounds.length) {
        setAlreadyPlayed(true)
        setPhase('done')
      } else {
        setPhase('playing')
        setItemStates(['idle', 'idle', 'idle', 'idle'])
        setRoundIndex(0)
        setScore(0)
        setLives(LIVES_START)
        setAnswers([])
        setSelectedIndex(null)
        setWasCorrect(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setPhase('loading')
    }
  }, [])

  useEffect(() => {
    loadGame()
  }, [loadGame])

  // Handle a card selection
  function handleSelect(idx: number) {
    if (phase !== 'playing' || selectedIndex !== null) return
    const round = rounds[roundIndex]
    if (!round) return

    const correct = idx === round.oddIndex
    setSelectedIndex(idx)
    setWasCorrect(correct)

    // Build item states for reveal
    const newStates: ItemState[] = round.items.map((_, i) => {
      if (i === idx && correct) return 'selected-correct'
      if (i === idx && !correct) return 'selected-wrong'
      if (i === round.oddIndex && !correct) return 'revealed-correct'
      return 'faded'
    })
    setItemStates(newStates)

    const newAnswers = [...answers, correct]
    const newScore = correct ? score + PTS_PER_CORRECT : score
    const newLives = correct ? lives : lives - 1

    setScore(newScore)
    setAnswers(newAnswers)
    if (!correct) setLives(newLives)

    // Move to round result phase
    setPhase('round-result')
  }

  // Advance to next round (or finish)
  function advance() {
    const nextRound = roundIndex + 1
    const gameOver = nextRound >= rounds.length || lives - (wasCorrect ? 0 : 1) <= 0

    const finalLives = wasCorrect ? lives : Math.max(0, lives - 1)

    if (gameOver || finalLives <= 0) {
      // Save to localStorage
      const saved = loadSaved()
      const today = todayUTC()
      const previousStreak = saved?.date === today ? (saved?.streak ?? 0) : 0
      const newStreak = wasCorrect && answers.length === rounds.length - 1
        ? previousStreak + 1
        : previousStreak

      saveResult({
        date: today,
        score,
        answers,
        streak: newStreak,
      })
      setStreak(newStreak)
      setPhase('done')
      return
    }

    setRoundIndex(nextRound)
    setSelectedIndex(null)
    setWasCorrect(null)
    setItemStates(['idle', 'idle', 'idle', 'idle'])
    setPhase('playing')
  }

  async function handleCopy() {
    const text = buildShare(score, answers)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const currentRound = rounds[roundIndex]
  const totalRounds = rounds.length || 5

  // ── Loading ────────────────────────────────────────────────────────────────

  if (phase === 'loading' && !error) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 pt-6 pb-28">
          <div className="flex items-center gap-3 mb-8">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 pt-6 pb-28 flex flex-col items-center gap-4">
          <XCircle className="h-12 w-12 text-against-400 mt-16" />
          <p className="font-mono text-white text-center">{error}</p>
          <button
            onClick={loadGame}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white font-mono text-sm hover:bg-for-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Done / Already Played ──────────────────────────────────────────────────

  if (phase === 'done' || alreadyPlayed) {
    const rank = scoreRank(score, answers.length || totalRounds)
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 pt-6 pb-28">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Link
              href="/arcade"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
              aria-label="Back to Arcade"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Civic Odd One Out</h1>
              <p className="text-xs font-mono text-surface-500">Today&apos;s result</p>
            </div>
          </div>

          {/* Score card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-surface-100 border border-surface-300 p-8 text-center mb-6"
          >
            <Trophy className="h-10 w-10 text-gold mx-auto mb-4" aria-hidden="true" />
            <p className="font-mono text-5xl font-bold text-white mb-1">{score}</p>
            <p className="font-mono text-surface-500 text-sm mb-4">
              out of {answers.length * PTS_PER_CORRECT}
            </p>

            {/* Answer squares */}
            <div className="flex justify-center gap-2 mb-5">
              {answers.map((correct, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    correct ? 'bg-for-500/30 border border-for-500/50' : 'bg-against-500/30 border border-against-500/50'
                  )}
                  aria-label={`Round ${i + 1}: ${correct ? 'correct' : 'wrong'}`}
                >
                  {correct
                    ? <Check className="h-4 w-4 text-for-400" />
                    : <X className="h-4 w-4 text-against-400" />
                  }
                </div>
              ))}
            </div>

            <p className={cn('font-mono text-sm font-semibold', rank.color)}>{rank.label}</p>

            {streak > 1 && (
              <p className="font-mono text-xs text-gold mt-2 flex items-center justify-center gap-1">
                <Zap className="h-3 w-3" aria-hidden="true" />
                {streak}-day streak
              </p>
            )}
          </motion.div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center justify-center gap-2 w-full py-3 rounded-xl font-mono text-sm font-semibold transition-all',
                copied
                  ? 'bg-emerald/20 border border-emerald/40 text-emerald'
                  : 'bg-surface-200 border border-surface-300 text-white hover:bg-surface-300'
              )}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Share result'}
            </button>

            <Link
              href="/arcade"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-mono text-sm font-semibold bg-for-600/20 border border-for-600/30 text-for-300 hover:bg-for-600/30 transition-all"
            >
              <Gamepad2 className="h-4 w-4" aria-hidden="true" />
              More games
            </Link>
          </div>

          {/* Come back message */}
          {alreadyPlayed && (
            <p className="text-center font-mono text-xs text-surface-500 mt-6">
              Come back tomorrow for a new set of topics.
            </p>
          )}
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Playing ────────────────────────────────────────────────────────────────

  if (!currentRound) return null

  const isRevealed = phase === 'round-result'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-lg mx-auto px-4 pt-6 pb-28">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/arcade"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
              aria-label="Back to Arcade"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-lg font-bold text-white leading-tight">
                Civic Odd One Out
              </h1>
              <p className="text-[11px] font-mono text-surface-500">
                Round {roundIndex + 1} of {totalRounds}
              </p>
            </div>
          </div>

          {/* HUD */}
          <div className="flex items-center gap-3">
            <LivesDisplay lives={lives} max={LIVES_START} />
            <div className="flex items-center gap-1 bg-gold/10 border border-gold/30 rounded-lg px-2 py-1">
              <Sparkles className="h-3 w-3 text-gold" aria-hidden="true" />
              <span className="font-mono text-xs font-bold text-gold">{score}</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-surface-300 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-for-500 rounded-full transition-all duration-500"
            style={{ width: `${((roundIndex) / totalRounds) * 100}%` }}
          />
        </div>

        {/* Question prompt */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`prompt-${roundIndex}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-5 text-center"
          >
            {!isRevealed ? (
              <>
                <p className="font-mono text-base font-semibold text-white">
                  Which topic doesn&apos;t belong?
                </p>
                <p className="font-mono text-xs text-surface-500 mt-1">
                  Three share the same category — find the odd one out.
                </p>
              </>
            ) : wasCorrect ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald flex-shrink-0" aria-hidden="true" />
                <p className="font-mono text-sm font-semibold text-emerald">
                  Correct! +{PTS_PER_CORRECT} pts
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <XCircle className="h-5 w-5 text-against-400 flex-shrink-0" aria-hidden="true" />
                <p className="font-mono text-sm font-semibold text-against-400">
                  Wrong — lost a life
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Category reveal (shown after answer) */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 rounded-xl bg-surface-100 border border-surface-300 p-3"
            >
              <p className="font-mono text-xs text-surface-500 mb-1">The Majority Category</p>
              <p className={cn('font-mono text-sm font-bold', catStyle(currentRound.majorityCategory).text)}>
                {currentRound.majorityCategory}
              </p>
              <p className="font-mono text-xs text-surface-500 mt-1.5">
                The odd one out was in:{' '}
                <span className={cn('font-semibold', catStyle(currentRound.oddCategory).text)}>
                  {currentRound.oddCategory}
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Topic cards — 2x2 grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`round-${roundIndex}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="grid grid-cols-2 gap-3"
          >
            {currentRound.items.map((item, idx) => (
              <TopicCard
                key={item.id}
                item={item}
                state={itemStates[idx]}
                onClick={() => handleSelect(idx)}
                disabled={isRevealed}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Next / Done button */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex gap-3"
            >
              {/* Link to the odd topic */}
              <Link
                href={`/topic/${currentRound.items[currentRound.oddIndex].id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
                aria-label="View the odd topic"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                View topic
              </Link>

              <button
                onClick={advance}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl',
                  'font-mono text-sm font-semibold transition-all',
                  roundIndex + 1 >= totalRounds || lives <= 1
                    ? 'bg-gold/20 border border-gold/40 text-gold hover:bg-gold/30'
                    : 'bg-for-600 text-white hover:bg-for-500'
                )}
              >
                {roundIndex + 1 >= totalRounds || lives <= 1 ? (
                  <>
                    <Trophy className="h-4 w-4" aria-hidden="true" />
                    See results
                  </>
                ) : (
                  <>
                    Next round
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
