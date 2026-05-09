'use client'

/**
 * /gauntlet — The Civic Gauntlet
 *
 * Sudden-death survival game. Topics arrive in order from easiest
 * (strong majority) to hardest (near 50/50 deadlock). Each round you
 * pick FOR or AGAINST within 10 seconds. Choose the community's majority
 * side and you survive — choose the losing side and the run ends.
 *
 * Scoring: +1 point per survival. Best streak saved to localStorage.
 * The Gauntlet is fully playable without an account.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Flame,
  Loader2,
  RefreshCw,
  Scale,
  Share2,
  Shield,
  Skull,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { GauntletTopic, GauntletResponse } from '@/app/api/gauntlet/route'

// ─── Constants ─────────────────────────────────────────────────────────────────────────────

const ROUND_SECONDS = 10
const BEST_STREAK_KEY = 'lm_gauntlet_best_v1'
const REVEAL_MS = 1_800  // how long to show the result before advancing

// ─── Local storage helpers ───────────────────────────────────────────────────────────────────────

function loadBest(): number {
  try { return parseInt(localStorage.getItem(BEST_STREAK_KEY) ?? '0', 10) || 0 } catch { return 0 }
}
function saveBest(n: number) {
  try { localStorage.setItem(BEST_STREAK_KEY, String(n)) } catch { /* best-effort */ }
}

// ─── Category colour map ──────────────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',     border: 'border-for-500/20' },
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Ethics:      { text: 'text-against-300',   bg: 'bg-against-500/10',  border: 'border-against-500/20' },
  Philosophy:  { text: 'text-for-300',       bg: 'bg-for-400/10',      border: 'border-for-400/20' },
  Culture:     { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/20' },
  Health:      { text: 'text-against-300',   bg: 'bg-against-400/10',  border: 'border-against-400/20' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/20' },
  Education:   { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/20' },
}

function catColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Difficulty label ────────────────────────────────────────────────────────────────────────────

function difficultyLabel(contestedness: number) {
  if (contestedness > 30) return { label: 'Easy',    color: 'text-emerald',     bg: 'bg-emerald/10',    border: 'border-emerald/30' }
  if (contestedness > 20) return { label: 'Medium',  color: 'text-gold',        bg: 'bg-gold/10',       border: 'border-gold/30' }
  if (contestedness > 10) return { label: 'Hard',    color: 'text-against-300', bg: 'bg-against-500/10',border: 'border-against-500/30' }
  return                           { label: 'Extreme',color: 'text-against-400', bg: 'bg-against-600/10',border: 'border-against-600/40' }
}

// ─── Round result type ────────────────────────────────────────────────────────────────────────────

type RoundResult = 'survived' | 'eliminated' | 'timeout'

interface RoundRecord {
  topic: GauntletTopic
  pick: 'for' | 'against' | null
  result: RoundResult
}

// ─── Countdown hook ───────────────────────────────────────────────────────────────────────────

function useCountdown(active: boolean, onExpire: () => void) {
  const [seconds, setSeconds] = useState(ROUND_SECONDS)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (!active) {
      setSeconds(ROUND_SECONDS)
      expiredRef.current = false
      return
    }
    setSeconds(ROUND_SECONDS)
    expiredRef.current = false
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval)
          if (!expiredRef.current) {
            expiredRef.current = true
            onExpire()
          }
          return 0
        }
        return s - 1
      })
    }, 1_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return seconds
}

// ─── Game phases ─────────────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'countdown' | 'playing' | 'reveal' | 'dead'

// ─── Share text ───────────────────────────────────────────────────────────────────────────

function buildShareText(score: number, best: number): string {
  const medal = score >= 20 ? '🏆' : score >= 10 ? '🥈' : score >= 5 ? '🥉' : '⚔️'
  return `${medal} I survived ${score} round${score !== 1 ? 's' : ''} in the Civic Gauntlet (best: ${best})! How far can you go? lobby.market/gauntlet`
}

// ─── Component ─────────────────────────────────────────────────────────────────────────────

export default function GauntletPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [rounds, setRounds] = useState<GauntletTopic[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pick, setPick] = useState<'for' | 'against' | null>(null)
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null)
  const [history, setHistory] = useState<RoundRecord[]>([])
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [copied, setCopied] = useState(false)

  const pickLocked = useRef(false)

  // Load best on mount
  useEffect(() => { setBest(loadBest()) }, [])

  const topic = rounds[currentIdx] ?? null

  // ── Timer ─────────────────────────────────────────────────────────────────────────────

  const handleTimeout = useCallback(() => {
    if (pickLocked.current) return
    pickLocked.current = true
    const record: RoundRecord = { topic: topic!, pick: null, result: 'timeout' }
    setHistory((h) => [...h, record])
    setRoundResult('timeout')
    setPhase('reveal')
    setTimeout(() => setPhase('dead'), REVEAL_MS)
  }, [topic])

  const seconds = useCountdown(phase === 'playing', handleTimeout)

  // ── Load topics ────────────────────────────────────────────────────────────────────────────

  async function loadTopics() {
    setPhase('loading')
    try {
      const res = await fetch('/api/gauntlet')
      if (!res.ok) throw new Error('fetch failed')
      const data: GauntletResponse = await res.json()
      if (!data.rounds.length) {
        setPhase('idle')
        return
      }
      setRounds(data.rounds)
      setCurrentIdx(0)
      setHistory([])
      setScore(0)
      setPick(null)
      setRoundResult(null)
      pickLocked.current = false
      setPhase('countdown')
    } catch {
      setPhase('idle')
    }
  }

  // ── Countdown before first round ────────────────────────────────────────────────────────────

  const [precount, setPrecount] = useState(3)

  useEffect(() => {
    if (phase !== 'countdown') return
    setPrecount(3)
    const t1 = setTimeout(() => setPrecount(2), 1_000)
    const t2 = setTimeout(() => setPrecount(1), 2_000)
    const t3 = setTimeout(() => setPhase('playing'), 3_000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [phase])

  // ── Handle pick ───────────────────────────────────────────────────────────────────────────

  function handlePick(side: 'for' | 'against') {
    if (phase !== 'playing' || pickLocked.current || !topic) return
    pickLocked.current = true
    setPick(side)

    const majorSide: 'for' | 'against' = topic.blue_pct >= 50 ? 'for' : 'against'
    const survived = side === majorSide
    const result: RoundResult = survived ? 'survived' : 'eliminated'

    setRoundResult(result)
    setPhase('reveal')

    if (survived) {
      const newScore = score + 1
      setScore(newScore)
      setBest((prev) => {
        const nb = Math.max(prev, newScore)
        saveBest(nb)
        return nb
      })

      setHistory((h) => [...h, { topic, pick: side, result }])

      // Advance to next round after reveal pause
      setTimeout(() => {
        if (currentIdx + 1 >= rounds.length) {
          setPhase('dead') // won the whole gauntlet!
        } else {
          setCurrentIdx((i) => i + 1)
          setPick(null)
          setRoundResult(null)
          pickLocked.current = false
          setPhase('playing')
        }
      }, REVEAL_MS)
    } else {
      setHistory((h) => [...h, { topic, pick: side, result }])
      setTimeout(() => setPhase('dead'), REVEAL_MS)
    }
  }

  // ── Keyboard controls ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase !== 'playing') return
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') handlePick('for')
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') handlePick('against')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, topic, score])

  // ── Share ─────────────────────────────────────────────────────────────────────────────

  function handleShare() {
    const text = buildShareText(score, best)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2_000)
    }).catch(() => {})
  }

  // ──────────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────────────────────────────────────────

  const timerPct = (seconds / ROUND_SECONDS) * 100
  const timerColor =
    seconds > 6 ? 'bg-emerald' : seconds > 3 ? 'bg-gold' : 'bg-against-500'

  // ──────────────────────────────────────────────────────────────────────────────────
  // IDLE screen
  // ──────────────────────────────────────────────────────────────────────────────────

  if (phase === 'idle' || phase === 'loading') {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md text-center space-y-6"
          >
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-20 w-20 rounded-3xl bg-against-600/20 border border-against-500/30 flex items-center justify-center">
                  <Swords className="h-10 w-10 text-against-400" />
                </div>
                <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-against-500 flex items-center justify-center">
                  <Skull className="h-3 w-3 text-white" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">The Civic Gauntlet</h1>
              <p className="text-sm text-surface-500 mt-1 font-mono">SUDDEN DEATH SURVIVAL</p>
            </div>

            {/* Rules */}
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-3 text-left">
              {[
                { icon: Swords,        text: 'Topics get harder each round — deadlocks await' },
                { icon: Timer,         text: '10 seconds per round — don\'t hesitate' },
                { icon: ThumbsUp,      text: 'Pick the majority side (FOR or AGAINST) to survive' },
                { icon: Skull,         text: 'One wrong answer ends your run' },
                { icon: Trophy,        text: 'Your best streak is saved — can you beat it?' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-start gap-3">
                  <Icon className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-surface-200">{text}</p>
                </div>
              ))}
            </div>

            {/* Best streak */}
            {best > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Trophy className="h-4 w-4 text-gold" />
                <span className="text-surface-400">Best streak:</span>
                <span className="text-gold font-bold font-mono">{best}</span>
              </div>
            )}

            {/* Keyboard hint */}
            <p className="text-xs text-surface-600 font-mono">
              Tip: use <kbd className="px-1 py-0.5 rounded bg-surface-200 text-surface-400 text-[10px]">←</kbd> for FOR,{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-200 text-surface-400 text-[10px]">→</kbd> for AGAINST
            </p>

            {/* Start button */}
            <button
              onClick={loadTopics}
              disabled={phase === 'loading'}
              className={cn(
                'w-full py-4 rounded-2xl font-bold text-lg transition-all',
                'bg-against-600 hover:bg-against-500 text-white border border-against-500/50',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'flex items-center justify-center gap-2'
              )}
            >
              {phase === 'loading' ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Loading rounds…</>
              ) : (
                <><Swords className="h-5 w-5" /> Enter the Gauntlet</>
              )}
            </button>

            <Link
              href="/arcade"
              className="flex items-center justify-center gap-1 text-sm text-surface-500 hover:text-surface-300 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to Arcade
            </Link>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────────────
  // COUNTDOWN screen
  // ──────────────────────────────────────────────────────────────────────────────────

  if (phase === 'countdown') {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex flex-col items-center justify-center pb-24">
          <AnimatePresence mode="wait">
            <motion.div
              key={precount}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-8xl font-black text-against-400"
            >
              {precount}
            </motion.div>
          </AnimatePresence>
          <p className="mt-6 text-surface-500 font-mono text-sm">Get ready…</p>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────────────
  // DEAD / END screen
  // ──────────────────────────────────────────────────────────────────────────────────

  if (phase === 'dead') {
    const lastRecord = history[history.length - 1]
    const won = score > 0 && currentIdx >= rounds.length
    const majorSide = lastRecord?.topic
      ? lastRecord.topic.blue_pct >= 50 ? 'for' : 'against'
      : null
    const isTimeout = lastRecord?.result === 'timeout'

    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-28">
          <div className="max-w-md mx-auto px-4 py-8 space-y-5">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-2"
            >
              <div className="flex justify-center mb-3">
                {won ? (
                  <div className="h-16 w-16 rounded-2xl bg-gold/20 border border-gold/40 flex items-center justify-center">
                    <Trophy className="h-8 w-8 text-gold" />
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-against-600/20 border border-against-500/30 flex items-center justify-center">
                    <Skull className="h-8 w-8 text-against-400" />
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white">
                {won ? 'Gauntlet Conquered!' : 'Eliminated!'}
              </h2>
              <p className="text-sm text-surface-500">
                {won
                  ? 'You survived every round. Legendary civic instincts.'
                  : isTimeout
                    ? 'You ran out of time.'
                    : 'You picked the losing side.'}
              </p>
            </motion.div>

            {/* Score cards */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 text-center">
                <p className="text-xs font-mono text-surface-500 mb-1">SURVIVED</p>
                <p className="text-4xl font-black text-white">{score}</p>
                <p className="text-xs text-surface-500 mt-0.5">rounds</p>
              </div>
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 text-center">
                <p className="text-xs font-mono text-surface-500 mb-1">BEST EVER</p>
                <p className={cn('text-4xl font-black', score >= best ? 'text-gold' : 'text-white')}>{best}</p>
                {score >= best && score > 0 && (
                  <p className="text-xs text-gold mt-0.5">New record!</p>
                )}
              </div>
            </motion.div>

            {/* What killed you */}
            {lastRecord && !won && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-against-600/10 border border-against-500/30 rounded-2xl p-4 space-y-3"
              >
                <p className="text-xs font-mono text-against-400">ROUND {score + 1} — FATAL</p>
                <p className="text-sm text-white font-medium leading-snug">
                  {lastRecord.topic.statement}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className={cn(
                    'rounded-xl border p-2.5 text-center text-xs font-bold',
                    majorSide === 'for'
                      ? 'bg-for-500/20 border-for-500/40 text-for-300'
                      : 'bg-surface-200/30 border-surface-300 text-surface-500'
                  )}>
                    <ThumbsUp className="h-4 w-4 mx-auto mb-1" />
                    FOR {Math.round(lastRecord.topic.blue_pct)}%
                    {majorSide === 'for' && <span className="block text-[10px] mt-0.5">← majority</span>}
                  </div>
                  <div className={cn(
                    'rounded-xl border p-2.5 text-center text-xs font-bold',
                    majorSide === 'against'
                      ? 'bg-against-500/20 border-against-500/40 text-against-300'
                      : 'bg-surface-200/30 border-surface-300 text-surface-500'
                  )}>
                    <ThumbsDown className="h-4 w-4 mx-auto mb-1" />
                    AGAINST {100 - Math.round(lastRecord.topic.blue_pct)}%
                    {majorSide === 'against' && <span className="block text-[10px] mt-0.5">← majority</span>}
                  </div>
                </div>
                {lastRecord.pick !== null && (
                  <p className="text-xs text-surface-500 text-center">
                    You picked{' '}
                    <span className={lastRecord.pick === 'for' ? 'text-for-400' : 'text-against-400'}>
                      {lastRecord.pick.toUpperCase()}
                    </span>
                    {' '}— the majority was{' '}
                    <span className={majorSide === 'for' ? 'text-for-400' : 'text-against-400'}>
                      {majorSide?.toUpperCase()}
                    </span>
                  </p>
                )}
                <Link
                  href={`/topic/${lastRecord.topic.id}`}
                  className="flex items-center justify-center gap-1 text-xs text-surface-500 hover:text-white transition-colors mt-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  See full debate
                </Link>
              </motion.div>
            )}

            {/* Round history */}
            {history.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="space-y-1.5"
              >
                <p className="text-xs font-mono text-surface-600 px-1">ROUND LOG</p>
                {history.map((rec, i) => {
                  const isLast = i === history.length - 1 && !won
                  const maj = rec.topic.blue_pct >= 50 ? 'for' : 'against'
                  return (
                    <div
                      key={rec.topic.id}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs',
                        isLast
                          ? 'bg-against-600/10 border-against-500/30'
                          : 'bg-surface-100 border-surface-300'
                      )}
                    >
                      <span className="font-mono text-surface-500 w-5 flex-shrink-0">
                        {i + 1}
                      </span>
                      {rec.result === 'survived' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                      )}
                      <span className={cn('flex-1 truncate', isLast ? 'text-white' : 'text-surface-400')}>
                        {rec.topic.statement}
                      </span>
                      <span className={cn(
                        'flex-shrink-0 font-mono text-[10px]',
                        maj === 'for' ? 'text-for-400' : 'text-against-400'
                      )}>
                        {maj.toUpperCase()} {Math.round(Math.abs(rec.topic.blue_pct - 50) + 50)}%
                      </span>
                    </div>
                  )
                })}
              </motion.div>
            )}

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3 pt-1"
            >
              <button
                onClick={loadTopics}
                className="w-full py-3.5 rounded-2xl font-bold text-base bg-against-600 hover:bg-against-500 text-white border border-against-500/50 flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>

              <button
                onClick={handleShare}
                className="w-full py-3 rounded-2xl font-semibold text-sm bg-surface-200 hover:bg-surface-300 text-surface-100 border border-surface-300 flex items-center justify-center gap-2 transition-all"
              >
                {copied ? (
                  <><CheckCircle2 className="h-4 w-4 text-emerald" /> Copied!</>
                ) : (
                  <><Share2 className="h-4 w-4" /> Share result</>
                )}
              </button>

              <Link
                href="/arcade"
                className="flex items-center justify-center gap-1 text-sm text-surface-500 hover:text-surface-300 transition-colors py-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Arcade
              </Link>
            </motion.div>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────────────
  // PLAYING / REVEAL screen
  // ──────────────────────────────────────────────────────────────────────────────────

  if (!topic) return null

  const cat = catColor(topic.category)
  const diff = difficultyLabel(topic.contestedness)
  const majorSidePlaying: 'for' | 'against' = topic.blue_pct >= 50 ? 'for' : 'against'

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 flex flex-col pb-24">
        {/* Top bar: score + progress */}
        <div className="sticky top-0 z-10 bg-surface-50/90 backdrop-blur border-b border-surface-300/50 px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-emerald" />
            <span className="text-sm font-bold text-white font-mono">{score}</span>
            <span className="text-xs text-surface-500">survived</span>
          </div>
          <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
            <div
              className="h-full bg-emerald/70 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((score / rounds.length) * 100, 100)}%` }}
            />
          </div>
          <div className="text-xs font-mono text-surface-500">
            {currentIdx + 1}/{rounds.length}
          </div>
        </div>

        <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 py-5 gap-4">
          {/* Timer bar */}
          {phase === 'playing' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Timer className={cn('h-4 w-4', seconds <= 3 ? 'text-against-400 animate-pulse' : 'text-surface-500')} />
                  <span className={cn(
                    'text-sm font-bold font-mono tabular-nums',
                    seconds <= 3 ? 'text-against-400' : seconds <= 6 ? 'text-gold' : 'text-surface-400'
                  )}>
                    {seconds}s
                  </span>
                </div>
                <span className={cn(
                  'text-xs font-mono px-2 py-0.5 rounded-full border',
                  diff.color, diff.bg, diff.border
                )}>
                  {diff.label}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full transition-colors', timerColor)}
                  animate={{ width: `${timerPct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          )}

          {/* Topic card */}
          <motion.div
            key={topic.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'bg-surface-100 border rounded-2xl p-5 space-y-4 relative overflow-hidden',
              phase === 'reveal' && roundResult === 'survived' && 'border-emerald/50 bg-emerald/5',
              phase === 'reveal' && roundResult !== 'survived' && 'border-against-500/50 bg-against-600/5',
              phase === 'playing' && 'border-surface-300'
            )}
          >
            {/* Result overlay */}
            <AnimatePresence>
              {phase === 'reveal' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                >
                  {roundResult === 'survived' ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-16 w-16 text-emerald drop-shadow-lg" />
                      <span className="text-emerald font-black text-xl tracking-wide">SURVIVED</span>
                    </div>
                  ) : roundResult === 'timeout' ? (
                    <div className="flex flex-col items-center gap-2">
                      <Timer className="h-16 w-16 text-gold drop-shadow-lg" />
                      <span className="text-gold font-black text-xl tracking-wide">TIME UP</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Skull className="h-16 w-16 text-against-400 drop-shadow-lg" />
                      <span className="text-against-400 font-black text-xl tracking-wide">ELIMINATED</span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className={cn(phase === 'reveal' ? 'opacity-40' : 'opacity-100', 'transition-opacity')}>
              {/* Category + status */}
              <div className="flex items-center gap-2 flex-wrap">
                {topic.category && (
                  <span className={cn(
                    'text-xs font-mono px-2 py-0.5 rounded-full border',
                    cat.text, cat.bg, cat.border
                  )}>
                    {topic.category}
                  </span>
                )}
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
                  {topic.status.toUpperCase()}
                </Badge>
                <span className="text-xs text-surface-600 font-mono ml-auto">
                  {topic.total_votes.toLocaleString()} votes
                </span>
              </div>

              {/* Statement */}
              <p className="text-base font-semibold text-white leading-snug mt-3">
                {topic.statement}
              </p>

              {/* Vote bar hint — only shown after reveal */}
              {phase === 'reveal' && (
                <div className="mt-4 space-y-1.5">
                  <div className="flex text-xs font-mono justify-between">
                    <span className="text-for-400">FOR {Math.round(topic.blue_pct)}%</span>
                    <span className="text-against-400">AGAINST {100 - Math.round(topic.blue_pct)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-against-500/30 overflow-hidden">
                    <div
                      className="h-full bg-for-500 rounded-full transition-all"
                      style={{ width: `${topic.blue_pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Vote buttons */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePick('for')}
              disabled={phase !== 'playing'}
              className={cn(
                'flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                phase === 'reveal' && pick === 'for' && roundResult === 'survived'
                  ? 'bg-for-500/30 border-for-400 text-for-300 scale-105'
                  : phase === 'reveal' && pick === 'for' && roundResult !== 'survived'
                    ? 'bg-against-500/20 border-against-400 text-against-300'
                    : phase === 'reveal' && majorSidePlaying === 'for'
                      ? 'bg-for-500/20 border-for-500/50 text-for-400'
                      : 'bg-for-600/10 border-for-600/30 text-for-400 hover:bg-for-600/20 hover:border-for-500/50'
              )}
            >
              <ThumbsUp className="h-6 w-6" />
              <span>FOR</span>
              <span className="text-[10px] font-mono opacity-60">← key</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePick('against')}
              disabled={phase !== 'playing'}
              className={cn(
                'flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 font-bold text-sm transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                phase === 'reveal' && pick === 'against' && roundResult === 'survived'
                  ? 'bg-against-500/30 border-against-400 text-against-300 scale-105'
                  : phase === 'reveal' && pick === 'against' && roundResult !== 'survived'
                    ? 'bg-against-500/20 border-against-400 text-against-300'
                    : phase === 'reveal' && majorSidePlaying === 'against'
                      ? 'bg-against-500/20 border-against-500/50 text-against-400'
                      : 'bg-against-600/10 border-against-600/30 text-against-400 hover:bg-against-600/20 hover:border-against-500/50'
              )}
            >
              <ThumbsDown className="h-6 w-6" />
              <span>AGAINST</span>
              <span className="text-[10px] font-mono opacity-60">→ key</span>
            </motion.button>
          </div>

          {/* Round context */}
          <div className="flex items-center justify-between text-xs text-surface-600 font-mono px-1">
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3" />
              Streak: {score}
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-3 w-3 text-gold" />
              Best: {best}
            </span>
            {topic.contestedness > 0 && (
              <span className="flex items-center gap-1">
                <Scale className="h-3 w-3" />
                {Math.round(topic.contestedness)}pt margin
              </span>
            )}
          </div>

          {/* Topic link */}
          <Link
            href={`/topic/${topic.id}`}
            target="_blank"
            className="flex items-center justify-center gap-1 text-xs text-surface-600 hover:text-surface-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            View full debate
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
