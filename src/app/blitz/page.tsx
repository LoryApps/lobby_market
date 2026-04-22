'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Flame,
  Loader2,
  RefreshCw,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { RapidTopic } from '@/app/api/rapid/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const BLITZ_DURATION_S = 60
const HIGH_SCORE_KEY = 'lm_blitz_high_score_v1'
const PREFETCH_COUNT = 50

// ─── Category colour map ──────────────────────────────────────────────────────

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

function categoryColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

// ─── Local high score ─────────────────────────────────────────────────────────

function loadHighScore(): number {
  try { return parseInt(localStorage.getItem(HIGH_SCORE_KEY) ?? '0', 10) || 0 } catch { return 0 }
}
function saveHighScore(score: number) {
  try { localStorage.setItem(HIGH_SCORE_KEY, String(score)) } catch { /* best-effort */ }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'ready' | 'playing' | 'done'

interface VoteRecord {
  topicId: string
  statement: string
  side: 'blue' | 'red'
  forPct: number
  aligned: boolean
}

// ─── Timer ring ───────────────────────────────────────────────────────────────

function TimerRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const r = 24
  const circ = 2 * Math.PI * r
  const pct = secondsLeft / total
  const dash = pct * circ
  const isUrgent = secondsLeft <= 10

  return (
    <div className="relative flex items-center justify-center h-16 w-16">
      <svg width="64" height="64" className="-rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="4" stroke="currentColor" className="text-surface-400" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="4"
          stroke="currentColor"
          className={cn('transition-all duration-1000', isUrgent ? 'text-against-400' : 'text-for-400')}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn(
        'absolute font-mono font-bold tabular-nums text-lg',
        isUrgent ? 'text-against-300 animate-pulse' : 'text-white'
      )}>
        {secondsLeft}
      </span>
    </div>
  )
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScorePip({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={cn('font-mono font-bold text-2xl tabular-nums', accent)}>{value}</span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

// ─── Single topic card ────────────────────────────────────────────────────────

function BlitzCard({
  topic,
  onVote,
  disabled,
}: {
  topic: RapidTopic
  onVote: (side: 'blue' | 'red') => void
  disabled: boolean
}) {
  const colors = categoryColor(topic.category)
  const [voted, setVoted] = useState<'blue' | 'red' | null>(null)

  function handleVote(side: 'blue' | 'red') {
    if (voted || disabled) return
    setVoted(side)
    onVote(side)
  }

  const isFor = voted === 'blue'
  const isAgainst = voted === 'red'

  return (
    <motion.div
      key={topic.id}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-2xl border p-5 bg-surface-100 shadow-xl shadow-black/40',
        'flex flex-col gap-4',
        voted === 'blue' && 'border-for-500/60 bg-for-950/20',
        voted === 'red' && 'border-against-500/60 bg-against-950/20',
        !voted && 'border-surface-300',
      )}
    >
      {/* Category pill */}
      {topic.category && (
        <div className={cn(
          'self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono font-semibold',
          colors.bg, colors.border, colors.text
        )}>
          {topic.category}
        </div>
      )}

      {/* Statement */}
      <p className="text-white font-medium text-base leading-snug line-clamp-4">
        {topic.statement}
      </p>

      {/* Vote distribution preview */}
      <div className="flex items-center gap-2 text-[11px] font-mono">
        <span className="text-for-400 w-8 text-right shrink-0">{Math.round(topic.blue_pct)}%</span>
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
            style={{ width: `${Math.round(topic.blue_pct)}%` }}
          />
        </div>
        <span className="text-against-400 w-8 shrink-0">{100 - Math.round(topic.blue_pct)}%</span>
      </div>

      {/* Vote buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleVote('blue')}
          disabled={!!voted || disabled}
          className={cn(
            'flex items-center justify-center gap-2 h-11 rounded-xl border font-mono text-sm font-semibold transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
            isFor
              ? 'bg-for-600 border-for-500 text-white'
              : 'bg-for-600/10 border-for-500/30 text-for-400 hover:bg-for-600/20 hover:border-for-500/60',
            (voted && !isFor) && 'opacity-30 cursor-not-allowed',
            disabled && !voted && 'cursor-not-allowed opacity-50',
          )}
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          FOR
        </button>
        <button
          onClick={() => handleVote('red')}
          disabled={!!voted || disabled}
          className={cn(
            'flex items-center justify-center gap-2 h-11 rounded-xl border font-mono text-sm font-semibold transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-against-500/50',
            isAgainst
              ? 'bg-against-600 border-against-500 text-white'
              : 'bg-against-600/10 border-against-500/30 text-against-400 hover:bg-against-600/20 hover:border-against-500/60',
            (voted && !isAgainst) && 'opacity-30 cursor-not-allowed',
            disabled && !voted && 'cursor-not-allowed opacity-50',
          )}
        >
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
          AGAINST
        </button>
      </div>

      {/* Voted confirmation */}
      <AnimatePresence>
        {voted && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-1.5 text-xs font-mono"
          >
            <CheckCircle2 className={cn('h-3.5 w-3.5', isFor ? 'text-for-400' : 'text-against-400')} />
            <span className={isFor ? 'text-for-400' : 'text-against-400'}>
              Voted {isFor ? 'FOR' : 'AGAINST'} — next topic loading…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  votes,
  highScore,
  isNewHigh,
  onRestart,
}: {
  votes: VoteRecord[]
  highScore: number
  isNewHigh: boolean
  onRestart: () => void
}) {
  const total = votes.length
  const aligned = votes.filter((v) => v.aligned).length
  const accuracy = total > 0 ? Math.round((aligned / total) * 100) : 0

  async function handleShare() {
    const text = `I voted on ${total} topics in 60 seconds on Lobby Market! 🏛️ ${accuracy}% aligned with the majority.\nhttps://lobby.market/blitz`
    try {
      if (navigator.share) await navigator.share({ text })
      else await navigator.clipboard.writeText(text)
    } catch { /* best-effort */ }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      {/* Trophy */}
      <div className="flex flex-col items-center gap-3 py-4">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
          className={cn(
            'flex items-center justify-center h-20 w-20 rounded-2xl border',
            isNewHigh
              ? 'bg-gold/10 border-gold/40'
              : total >= 10
                ? 'bg-for-500/10 border-for-500/30'
                : 'bg-surface-200 border-surface-300'
          )}
        >
          <Trophy className={cn(
            'h-10 w-10',
            isNewHigh ? 'text-gold' : total >= 10 ? 'text-for-400' : 'text-surface-500'
          )} />
        </motion.div>
        <div className="text-center">
          <h2 className="font-mono text-2xl font-bold text-white">
            {isNewHigh ? 'New Record!' : total >= 15 ? 'Blazing speed!' : total >= 8 ? 'Solid run!' : 'Round complete!'}
          </h2>
          {isNewHigh && (
            <p className="text-xs font-mono text-gold mt-0.5">Personal best — {total} votes</p>
          )}
        </div>
      </div>

      {/* Score grid */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <div className="grid grid-cols-3 divide-x divide-surface-300">
          <ScorePip label="Votes Cast" value={total} accent="text-white" />
          <div className="px-4">
            <ScorePip label="Majority" value={`${accuracy}%`} accent={accuracy >= 60 ? 'text-for-400' : 'text-against-400'} />
          </div>
          <div className="pl-4">
            <ScorePip label="Best Ever" value={highScore} accent="text-gold" />
          </div>
        </div>
      </div>

      {/* Per-vote log (last 10) */}
      {votes.length > 0 && (
        <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-300">
            <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">Your Votes</h3>
          </div>
          <div className="divide-y divide-surface-300 max-h-64 overflow-y-auto">
            {votes.slice(-15).reverse().map((v) => (
              <div key={v.topicId} className="flex items-start gap-3 px-4 py-2.5">
                <span className={cn(
                  'flex-shrink-0 mt-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded',
                  v.side === 'blue'
                    ? 'bg-for-600/20 text-for-400'
                    : 'bg-against-600/20 text-against-400'
                )}>
                  {v.side === 'blue' ? 'FOR' : 'AGN'}
                </span>
                <p className="flex-1 text-xs text-surface-600 leading-snug line-clamp-2">{v.statement}</p>
                <span className={cn(
                  'flex-shrink-0 text-[10px] font-mono',
                  v.aligned ? 'text-for-500' : 'text-surface-600'
                )}>
                  {v.aligned ? '✓' : '·'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Share
        </button>
        <button
          onClick={onRestart}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Play Again
        </button>
      </div>

      <Link
        href="/rapid"
        className="flex items-center justify-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
      >
        Switch to Rapid Fire (no timer) <ChevronRight className="h-3 w-3" />
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BlitzPage() {
  const [phase, setPhase] = useState<Phase>('ready')
  const [topics, setTopics] = useState<RapidTopic[]>([])
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(BLITZ_DURATION_S)
  const [votes, setVotes] = useState<VoteRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [highScore, setHighScore] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const votingRef = useRef(false)

  // Load high score on mount
  useEffect(() => {
    setHighScore(loadHighScore())
  }, [])

  const endRound = useCallback((finalVotes: VoteRecord[]) => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null

    const score = finalVotes.length
    const prev = loadHighScore()
    const newHigh = score > prev
    if (newHigh) {
      saveHighScore(score)
      setHighScore(score)
      setIsNewHigh(true)
    } else {
      setIsNewHigh(false)
    }
    setPhase('done')
  }, [])

  async function fetchTopics() {
    setLoading(true)
    try {
      const res = await fetch(`/api/rapid?limit=${PREFETCH_COUNT}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch topics')
      const json = await res.json()
      setTopics(json.topics ?? [])
      setAuthenticated(json.authenticated ?? false)
    } catch {
      setTopics([])
    } finally {
      setLoading(false)
    }
  }

  async function startRound() {
    if (loading) return
    setVotes([])
    setIndex(0)
    setSecondsLeft(BLITZ_DURATION_S)
    setIsNewHigh(false)
    votingRef.current = false

    await fetchTopics()
    setPhase('playing')
  }

  // Start timer when playing
  useEffect(() => {
    if (phase !== 'playing') return

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setVotes((v) => {
            endRound(v)
            return v
          })
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, endRound])

  async function handleVote(side: 'blue' | 'red') {
    const topic = topics[index]
    if (!topic || votingRef.current) return
    votingRef.current = true

    // Determine alignment (did they vote with current majority?)
    const forMajority = topic.blue_pct >= 50
    const aligned = (side === 'blue' && forMajority) || (side === 'red' && !forMajority)

    const record: VoteRecord = {
      topicId: topic.id,
      statement: topic.statement,
      side,
      forPct: topic.blue_pct,
      aligned,
    }

    setVotes((prev) => [...prev, record])

    // Fire-and-forget vote to API (no blocking)
    if (authenticated) {
      fetch(`/api/topics/${topic.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side }),
      }).catch(() => {})
    }

    // Advance after short delay to show feedback
    setTimeout(() => {
      votingRef.current = false
      setIndex((i) => {
        const next = i + 1
        if (next >= topics.length) {
          // No more topics — fetch more or end early
          endRound([...votes, record])
        }
        return next
      })
    }, 600)
  }

  const currentTopic = topics[index]
  const isPlaying = phase === 'playing'
  const isDone = phase === 'done'
  const isReady = phase === 'ready'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
              <h1 className="font-mono text-xl font-bold text-white">Blitz Mode</h1>
              <Badge variant="active" className="text-[10px]">BETA</Badge>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              60 seconds · vote as fast as you can
            </p>
          </div>

          {/* Live stats during round */}
          {isPlaying && (
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <p className="font-mono text-lg font-bold text-white tabular-nums">{votes.length}</p>
                <p className="text-[10px] font-mono text-surface-500">votes</p>
              </div>
              <TimerRing secondsLeft={secondsLeft} total={BLITZ_DURATION_S} />
            </div>
          )}
        </div>

        {/* ── READY SCREEN ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {isReady && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {/* Hero */}
              <div className="rounded-3xl bg-surface-100 border border-surface-300 p-8 flex flex-col items-center gap-5 text-center">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className="flex items-center justify-center h-20 w-20 rounded-2xl bg-gold/10 border border-gold/30"
                >
                  <Timer className="h-10 w-10 text-gold" aria-hidden="true" />
                </motion.div>

                <div>
                  <h2 className="font-mono text-2xl font-bold text-white">Ready to blitz?</h2>
                  <p className="text-sm text-surface-500 mt-2 leading-relaxed max-w-xs mx-auto">
                    Vote FOR or AGAINST as many topics as you can in <strong className="text-white">60 seconds</strong>.
                    Your score is the number of votes cast.
                  </p>
                </div>

                {/* Rules */}
                <div className="w-full rounded-xl bg-surface-200/60 border border-surface-300 p-4 text-left space-y-2.5">
                  {[
                    { icon: Zap, color: 'text-gold', text: 'Vote on as many topics as possible' },
                    { icon: Timer, color: 'text-for-400', text: '60 seconds on the clock' },
                    { icon: Trophy, color: 'text-purple', text: 'Beat your personal best score' },
                    { icon: Flame, color: 'text-against-400', text: 'Votes count toward your profile' },
                  ].map(({ icon: Icon, color, text }) => (
                    <div key={text} className="flex items-center gap-3">
                      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} aria-hidden="true" />
                      <span className="text-sm text-surface-600">{text}</span>
                    </div>
                  ))}
                </div>

                {/* High score */}
                {highScore > 0 && (
                  <div className="flex items-center gap-2 text-sm font-mono">
                    <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
                    <span className="text-surface-500">Personal best:</span>
                    <span className="text-gold font-bold">{highScore} votes</span>
                  </div>
                )}

                <button
                  onClick={startRound}
                  disabled={loading}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl',
                    'bg-for-600 hover:bg-for-500 text-white font-mono font-semibold text-base',
                    'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
                    loading && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {loading ? (
                    <><Loader2 className="h-5 w-5 animate-spin" />Loading topics…</>
                  ) : (
                    <><Zap className="h-5 w-5" />Start Blitz</>
                  )}
                </button>
              </div>

              {/* Related modes */}
              <div className="flex gap-3">
                <Link
                  href="/rapid"
                  className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-white">Rapid Fire</p>
                    <p className="text-xs text-surface-500 mt-0.5">No timer — go at your pace</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
                </Link>
                <Link
                  href="/challenge"
                  className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-white">Daily Quorum</p>
                    <p className="text-xs text-surface-500 mt-0.5">Complete today&apos;s 5 topics</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── PLAYING ──────────────────────────────────────────────────────── */}
          {isPlaying && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Progress bar */}
              <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-for-500 rounded-full"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(secondsLeft / BLITZ_DURATION_S) * 100}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>

              {/* Topic card */}
              <AnimatePresence mode="wait">
                {currentTopic ? (
                  <BlitzCard
                    key={currentTopic.id}
                    topic={currentTopic}
                    onVote={handleVote}
                    disabled={false}
                  />
                ) : (
                  <motion.div
                    key="loading-next"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-48 rounded-2xl bg-surface-100 border border-surface-300"
                  >
                    <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
                    <p className="text-xs font-mono text-surface-600 mt-2">Loading more topics…</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom hint */}
              <p className="text-center text-[11px] font-mono text-surface-600">
                Topic {index + 1} · {topics.length - index - 1} more ready
              </p>
            </motion.div>
          )}

          {/* ── DONE ─────────────────────────────────────────────────────────── */}
          {isDone && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ResultsScreen
                votes={votes}
                highScore={highScore}
                isNewHigh={isNewHigh}
                onRestart={() => {
                  setPhase('ready')
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
