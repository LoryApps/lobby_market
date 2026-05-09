'use client'

/**
 * /civic-imposter — Civic Imposter
 *
 * Daily "Spot the Fake Law" game. Six law statements appear — five are
 * real established laws from the Lobby Codex, one is a plausible-sounding
 * fake. Tap the one you think doesn't exist. One guess per day.
 *
 * Scoring: daily streak of consecutive correct answers.
 * Storage key: lm_imposter_v1 → { date, correct, streak }
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  Search,
  Share2,
  Skull,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ImposterLaw, ImposterPayload } from '@/app/api/civic-imposter/route'

// ─── localStorage helpers ─────────────────────────────────────────────────────

const STORAGE_KEY = 'lm_imposter_v1'

interface StoredResult {
  date: string
  correct: boolean
  streak: number
  picked_id: string
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
  } catch {
    // ignore
  }
}

function buildShareText(correct: boolean, streak: number, date: string): string {
  const emoji = correct ? '✅' : '❌'
  const lines = [
    `Civic Imposter — ${date}`,
    `${emoji} ${correct ? 'Found the fake!' : 'Fooled by the imposter!'}`,
    streak > 1 ? `🔥 ${streak}-day streak` : '',
    'lobby.market/civic-imposter',
  ].filter(Boolean)
  return lines.join('\n')
}

// ─── Category colour ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Politics:      'text-for-400',
  Economics:     'text-gold',
  Technology:    'text-purple',
  Science:       'text-emerald',
  Ethics:        'text-against-300',
  Philosophy:    'text-for-300',
  Culture:       'text-gold',
  Health:        'text-against-300',
  Environment:   'text-emerald',
  Education:     'text-purple',
  Labour:        'text-for-400',
  Democracy:     'text-for-300',
  Justice:       'text-purple',
  Housing:       'text-gold',
  Transparency:  'text-emerald',
  Transport:     'text-for-400',
  Governance:    'text-gold',
  'Consumer Rights': 'text-against-300',
}

function catColor(cat: string | null): string {
  return CAT_COLOR[cat ?? ''] ?? 'text-surface-500'
}

// ─── Law card ─────────────────────────────────────────────────────────────────

interface LawCardProps {
  law: ImposterLaw
  index: number
  phase: 'picking' | 'revealed'
  pickedId: string | null
  onPick: (id: string) => void
}

function LawCard({ law, index, phase, pickedId, onPick }: LawCardProps) {
  const isPicked = pickedId === law.id
  const isFake = law.is_fake
  const isRevealed = phase === 'revealed'

  const cardState = (() => {
    if (!isRevealed) {
      return isPicked
        ? 'selected'
        : 'idle'
    }
    if (isFake && isPicked) return 'correct'
    if (isFake && !isPicked) return 'missed_fake'
    if (!isFake && isPicked) return 'wrong_pick'
    return 'idle_real'
  })()

  const borderClass = {
    idle:        'border-surface-300 hover:border-surface-400',
    selected:    'border-against-400 ring-1 ring-against-400/40',
    correct:     'border-emerald ring-2 ring-emerald/40',
    missed_fake: 'border-against-400 ring-2 ring-against-400/40 bg-against-500/5',
    wrong_pick:  'border-against-400/40',
    idle_real:   'border-surface-300 opacity-60',
  }[cardState]

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onClick={() => phase === 'picking' && onPick(law.id)}
      disabled={phase === 'revealed'}
      aria-label={`Law ${index + 1}: ${law.statement}`}
      className={cn(
        'relative w-full text-left p-4 rounded-2xl bg-surface-100 border transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-against-400',
        borderClass,
        phase === 'picking' && 'cursor-pointer hover:bg-surface-100/80 active:scale-[0.99]',
        phase === 'revealed' && 'cursor-default',
      )}
    >
      {/* Number badge */}
      <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-surface-200 border border-surface-300 text-[10px] font-mono font-bold text-surface-500">
        {index + 1}
      </span>

      {/* Reveal icons */}
      {isRevealed && (cardState === 'correct' || cardState === 'missed_fake') && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2"
        >
          {cardState === 'correct' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald drop-shadow" />
          ) : (
            <Skull className="h-5 w-5 text-against-400 drop-shadow" />
          )}
        </motion.div>
      )}
      {isRevealed && cardState === 'wrong_pick' && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2"
        >
          <XCircle className="h-5 w-5 text-against-400 drop-shadow" />
        </motion.div>
      )}

      {/* Content */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex-shrink-0 mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center',
          isRevealed && isFake ? 'bg-against-500/15' : 'bg-surface-200',
        )}>
          {isRevealed && isFake ? (
            <Skull className="h-3.5 w-3.5 text-against-400" />
          ) : (
            <Gavel className="h-3.5 w-3.5 text-surface-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {law.category && (
            <p className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide mb-1', catColor(law.category))}>
              {law.category}
            </p>
          )}
          <p className={cn(
            'text-sm font-mono leading-relaxed',
            isRevealed && isFake ? 'text-against-300' : 'text-surface-300',
          )}>
            {law.statement}
          </p>
          {isRevealed && isFake && (
            <p className="mt-1.5 text-[10px] font-mono text-against-400 font-semibold uppercase tracking-wider">
              — The Imposter
            </p>
          )}
          {isRevealed && !isFake && (
            <Link
              href={`/law/${law.id}`}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-2.5 w-2.5" />
              View in Codex
            </Link>
          )}
        </div>
      </div>
    </motion.button>
  )
}

// ─── Result banner ────────────────────────────────────────────────────────────

function ResultBanner({ correct, streak }: { correct: boolean; streak: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={cn(
        'rounded-2xl border p-5 text-center',
        correct
          ? 'bg-emerald/5 border-emerald/30'
          : 'bg-against-500/5 border-against-500/30',
      )}
    >
      <div className="flex items-center justify-center gap-2 mb-1">
        {correct ? (
          <CheckCircle2 className="h-5 w-5 text-emerald" />
        ) : (
          <XCircle className="h-5 w-5 text-against-400" />
        )}
        <span className={cn('font-mono font-bold text-lg', correct ? 'text-emerald' : 'text-against-400')}>
          {correct ? 'Imposter found!' : 'The Lobby fooled you'}
        </span>
      </div>
      <p className="text-xs font-mono text-surface-500">
        {correct
          ? 'You spotted the fake law hiding in the Codex.'
          : 'That statement doesn\'t exist in the Codex — but it fooled you.'}
      </p>
      {streak > 1 && correct && (
        <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 border border-gold/30">
          <Zap className="h-3.5 w-3.5 text-gold" />
          <span className="text-xs font-mono text-gold font-semibold">{streak}-day streak</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ImposterSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

type Phase = 'loading' | 'error' | 'picking' | 'revealed'

export function ImposterClient() {
  const [payload, setPayload] = useState<ImposterPayload | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [correct, setCorrect] = useState(false)
  const [streak, setStreak] = useState(0)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch('/api/civic-imposter')
      if (!res.ok) throw new Error()
      const data = (await res.json()) as ImposterPayload
      setPayload(data)

      // Check if already played today
      const stored = loadResult()
      if (stored && stored.date === data.date) {
        setPickedId(stored.picked_id)
        setCorrect(stored.correct)
        setStreak(stored.streak)
        setPhase('revealed')
      } else {
        setPhase('picking')
      }
    } catch {
      setPhase('error')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handlePick = useCallback((id: string) => {
    if (!payload || phase !== 'picking') return
    const isCorrect = id === 'fake'

    // Calculate new streak
    const stored = loadResult()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    const prevStreak = stored?.date === yesterdayStr && stored.correct ? stored.streak : 0
    const newStreak = isCorrect ? prevStreak + 1 : 0

    const result: StoredResult = {
      date: payload.date,
      correct: isCorrect,
      streak: newStreak,
      picked_id: id,
    }
    saveResult(result)

    setPickedId(id)
    setCorrect(isCorrect)
    setStreak(newStreak)
    setPhase('revealed')
  }, [payload, phase])

  const handleShare = useCallback(async () => {
    if (!payload) return
    const text = buildShareText(correct, streak, payload.date)
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Civic Imposter', text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // ignore
    }
  }, [correct, streak, payload])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6">
          <Link
            href="/arcade"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Civic Arcade
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
                <Search className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Imposter</h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  {phase === 'revealed'
                    ? payload?.date ?? 'Daily challenge'
                    : '5 real laws · 1 fake · find the imposter'}
                </p>
              </div>
            </div>
            {phase === 'revealed' && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={correct ? 'active' : 'failed'} className="text-[10px]">
                  {correct ? 'Found it!' : 'Fooled'}
                </Badge>
                {streak > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gold/10 border border-gold/20">
                    <Zap className="h-3 w-3 text-gold" />
                    <span className="text-[11px] font-mono text-gold font-semibold">{streak}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Instructions strip ── */}
        {phase === 'picking' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-5 rounded-xl bg-against-500/5 border border-against-500/20 px-4 py-3 flex items-start gap-3"
          >
            <Scale className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-against-300 leading-relaxed">
              One of these six laws{' '}
              <span className="text-against-200 font-semibold">does not exist</span> in the Lobby
              Codex — it was invented to fool you. Read carefully and tap the imposter.
            </p>
          </motion.div>
        )}

        {/* ── Content ── */}
        <AnimatePresence mode="wait">
          {phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ImposterSkeleton />
            </motion.div>
          )}

          {phase === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-12 text-center space-y-3"
            >
              <Scale className="h-8 w-8 text-surface-500 mx-auto" />
              <p className="font-mono text-white font-semibold">Couldn&apos;t load today&apos;s challenge</p>
              <p className="text-sm font-mono text-surface-500">
                The Codex needs enough established laws to run the game.
              </p>
              <button
                onClick={load}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-against-600 hover:bg-against-500 text-white text-sm font-mono font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </motion.div>
          )}

          {(phase === 'picking' || phase === 'revealed') && payload && (
            <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

              {/* Result banner */}
              {phase === 'revealed' && (
                <div className="mb-5">
                  <ResultBanner correct={correct} streak={streak} />
                </div>
              )}

              {/* Law cards */}
              <div className="space-y-2.5">
                {payload.laws.map((law, i) => (
                  <LawCard
                    key={law.id + i}
                    law={law}
                    index={i}
                    phase={phase}
                    pickedId={pickedId}
                    onPick={handlePick}
                  />
                ))}
              </div>

              {/* Post-reveal actions */}
              {phase === 'revealed' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 flex flex-col sm:flex-row items-center gap-3"
                >
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors w-full sm:w-auto justify-center"
                  >
                    {copied ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4 text-surface-400" />
                        Share result
                      </>
                    )}
                  </button>
                  <Link
                    href="/law"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold/10 border border-gold/30 text-sm font-mono text-gold hover:bg-gold/15 transition-colors w-full sm:w-auto justify-center"
                  >
                    <Gavel className="h-4 w-4" />
                    Browse the Codex
                  </Link>
                  <Link
                    href="/arcade"
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors w-full sm:w-auto justify-center"
                  >
                    More games
                  </Link>
                </motion.div>
              )}

              {/* Copy share text button (visible only during picking) */}
              {phase === 'picking' && (
                <div className="mt-5 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-100 border border-surface-300">
                  <Copy className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
                  <p className="text-[11px] font-mono text-surface-600">
                    One guess per day · Come back tomorrow for a new challenge
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
