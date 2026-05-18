'use client'

/**
 * /argument-battle — The Daily Argument Battle
 *
 * 8 of the best arguments from the past 48 hours compete in a
 * single-elimination bracket. FOR (blue) vs AGAINST (red) arguments
 * are seeded to alternate, so each matchup pits opposite sides against
 * each other.
 *
 * Round 1: 4 matchups (arguments 0v1, 2v3, 4v5, 6v7)
 * Semis  : 2 matchups (winners of R1)
 * Final  : 1 matchup  (champions crowned with animation)
 *
 * Bracket state is stored in localStorage under `lm_argbattle_<date>` so
 * refreshing the page restores progress for the current day's bracket.
 *
 * Scoring: no leaderboard persisted — this is a pure daily engagement loop.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  ChevronRight,
  ExternalLink,
  Flame,
  Loader2,
  Quote,
  RefreshCw,
  Scale,
  Share2,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { RoleBadge } from '@/components/profile/RoleBadge'
import { cn } from '@/lib/utils/cn'
import type { BattleArgument, BattlePayload } from '@/app/api/argument-battle/route'
import type { UserRole } from '@/lib/supabase/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'lm_argbattle_'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BracketState {
  date: string
  // winners[round][matchupInRound] = index into `arguments` array
  winners: Array<Array<number>>
  currentRound: number
  currentMatchup: number
  done: boolean
  championIdx: number | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function loadState(date: string): BracketState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + date)
    if (!raw) return null
    return JSON.parse(raw) as BracketState
  } catch {
    return null
  }
}

function saveState(state: BracketState) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + state.date, JSON.stringify(state))
  } catch { /* ignore */ }
}

function freshState(date: string): BracketState {
  return {
    date,
    winners: [[], [], []],   // round 0 = R1, round 1 = semis, round 2 = final
    currentRound: 0,
    currentMatchup: 0,
    done: false,
    championIdx: null,
  }
}

// Compute the two argument indices for a given matchup in a given round.
function getMatchup(
  args: BattleArgument[],
  state: BracketState,
  round: number,
  matchupInRound: number
): [number, number] | null {
  if (round === 0) {
    // Round 1: args[0]v[1], [2]v[3], [4]v[5], [6]v[7]
    const a = matchupInRound * 2
    const b = matchupInRound * 2 + 1
    if (b >= args.length) return null
    return [a, b]
  }
  if (round === 1) {
    // Semis: winners[0][0]v[1], winners[0][2]v[3]
    const prev = state.winners[0]
    const a = prev[matchupInRound * 2]
    const b = prev[matchupInRound * 2 + 1]
    if (a === undefined || b === undefined) return null
    return [a, b]
  }
  if (round === 2) {
    // Final: winners[1][0] v winners[1][1]
    const prev = state.winners[1]
    if (prev[0] === undefined || prev[1] === undefined) return null
    return [prev[0], prev[1]]
  }
  return null
}

function matchupsInRound(args: BattleArgument[], round: number): number {
  if (round === 0) return Math.floor(args.length / 2)
  if (round === 1) return Math.floor(Math.floor(args.length / 2) / 2)
  return 1
}

const ROUND_LABELS = ['Round 1', 'Semifinals', 'The Final']

// ─── Side config ─────────────────────────────────────────────────────────────

const SIDE_CONFIG = {
  blue: {
    label: 'FOR',
    bg: 'bg-for-600/10 hover:bg-for-600/20',
    border: 'border-for-600/30 hover:border-for-500/60',
    selectedBg: 'bg-for-600/25',
    selectedBorder: 'border-for-500',
    text: 'text-for-300',
    badge: 'text-for-400 bg-for-500/10 border-for-500/30',
    glow: 'shadow-for-500/20',
    bar: 'bg-for-500',
    icon: ThumbsUp,
  },
  red: {
    label: 'AGAINST',
    bg: 'bg-against-600/10 hover:bg-against-600/20',
    border: 'border-against-600/30 hover:border-against-500/60',
    selectedBg: 'bg-against-600/25',
    selectedBorder: 'border-against-500',
    text: 'text-against-300',
    badge: 'text-against-400 bg-against-500/10 border-against-500/30',
    glow: 'shadow-against-500/20',
    bar: 'bg-against-500',
    icon: ThumbsDown,
  },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  picked,
  lost,
  onPick,
}: {
  arg: BattleArgument
  picked: boolean
  lost: boolean
  onPick: () => void
}) {
  const cfg = SIDE_CONFIG[arg.side]
  const SideIcon = cfg.icon

  return (
    <motion.button
      onClick={onPick}
      disabled={picked || lost}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: lost ? 0.35 : 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={!picked && !lost ? { scale: 1.01 } : {}}
      whileTap={!picked && !lost ? { scale: 0.99 } : {}}
      className={cn(
        'relative w-full text-left rounded-2xl border p-5 transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
        picked
          ? cn(cfg.selectedBg, cfg.selectedBorder, 'ring-1', cfg.selectedBorder, 'shadow-lg', cfg.glow)
          : lost
            ? 'bg-surface-200/40 border-surface-300/30 cursor-default'
            : cn(cfg.bg, cfg.border, 'cursor-pointer')
      )}
    >
      {/* Side badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold border', cfg.badge)}>
          <SideIcon className="h-3 w-3" />
          {cfg.label}
        </span>
        <div className="flex items-center gap-2">
          {arg.ai_grade && (
            <span className="text-[10px] font-mono text-surface-400 bg-surface-300/50 px-1.5 py-0.5 rounded">
              {arg.ai_grade}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
            <Zap className="h-3 w-3 text-gold" />
            {arg.upvotes}
          </span>
        </div>
      </div>

      {/* Argument content */}
      <p className={cn(
        'text-sm leading-relaxed mb-4 font-sans',
        lost ? 'text-surface-500' : 'text-surface-100'
      )}>
        <Quote className={cn('inline-block h-3.5 w-3.5 mr-1 flex-shrink-0 -mt-0.5', cfg.text)} />
        {arg.content}
      </p>

      {/* Topic context */}
      <div className={cn(
        'text-[11px] font-mono leading-snug mb-3 px-2 py-1 rounded-lg',
        'bg-surface-300/30 border border-surface-300/20 text-surface-500'
      )}>
        <span className="text-surface-600">On: </span>
        {arg.topic_statement.length > 80
          ? arg.topic_statement.slice(0, 80) + '…'
          : arg.topic_statement}
      </div>

      {/* Author */}
      <div className="flex items-center gap-2">
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name || arg.author_username}
          size="xs"
        />
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium text-surface-300 truncate">
            {arg.author_display_name || arg.author_username}
          </span>
          {arg.author_role !== 'person' && (
            <RoleBadge role={arg.author_role as UserRole} size="sm" />
          )}
        </div>
        <Link
          href={`/topic/${arg.topic_id}`}
          onClick={(e) => e.stopPropagation()}
          className="ml-auto flex-shrink-0 text-surface-600 hover:text-white transition-colors"
          aria-label="View topic"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Winner crown overlay */}
      {picked && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/20 border border-gold/40 text-gold text-[11px] font-mono font-semibold"
        >
          <Trophy className="h-3 w-3" />
          Advancing
        </motion.div>
      )}
    </motion.button>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-surface-300/30 bg-surface-100 p-5 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-16 rounded" />
        <Skeleton className="h-5 w-10 rounded" />
      </div>
      <Skeleton className="h-4 w-full rounded" />
      <Skeleton className="h-4 w-4/5 rounded" />
      <Skeleton className="h-4 w-2/3 rounded" />
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArgumentBattleClient() {
  const [loading, setLoading] = useState(true)
  const [args, setArgs] = useState<BattleArgument[]>([])
  const [bracketState, setBracketState] = useState<BracketState | null>(null)
  const [animKey, setAnimKey] = useState(0)
  const [choosing, setChoosing] = useState<number | null>(null) // temp highlight before advance
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch arguments ─────────────────────────────────────────────────────────
  const fetchArgs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/argument-battle')
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as BattlePayload
      setArgs(data.arguments)

      const today = todayStr()
      const existing = loadState(today)
      if (existing && existing.date === today) {
        setBracketState(existing)
      } else {
        const fresh = freshState(today)
        setBracketState(fresh)
        saveState(fresh)
      }
    } catch {
      setError('Could not load today\'s battle. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchArgs() }, [fetchArgs])

  // ── Pick a winner for the current matchup ────────────────────────────────────
  const pickWinner = useCallback((winnerIdx: number) => {
    if (!bracketState || bracketState.done) return

    setChoosing(winnerIdx)

    setTimeout(() => {
      setChoosing(null)
      setBracketState((prev) => {
        if (!prev) return prev
        const next: BracketState = {
          ...prev,
          winners: prev.winners.map((r) => [...r]),
        }
        next.winners[prev.currentRound] = [...(next.winners[prev.currentRound] ?? []), winnerIdx]

        const totalInRound = matchupsInRound(args, prev.currentRound)
        const nextMatchupInRound = prev.currentMatchup + 1

        if (nextMatchupInRound >= totalInRound) {
          // Move to next round
          if (prev.currentRound === 2) {
            // Final done
            next.done = true
            next.championIdx = winnerIdx
          } else {
            next.currentRound = prev.currentRound + 1
            next.currentMatchup = 0
          }
        } else {
          next.currentMatchup = nextMatchupInRound
        }

        saveState(next)
        setAnimKey((k) => k + 1)
        return next
      })
    }, 600)
  }, [bracketState, args])

  // ── Share ────────────────────────────────────────────────────────────────────
  const share = useCallback(() => {
    if (!bracketState?.championIdx === undefined || !args.length) return
    const champion = bracketState?.championIdx !== null ? args[bracketState.championIdx] : null
    const text = champion
      ? `Today's Argument Battle champion on Lobby Market:\n\n"${champion.content.slice(0, 120)}…"\n\n— @${champion.author_username}`
      : 'Playing the Argument Battle on Lobby Market!'
    if (navigator.share) {
      navigator.share({ title: 'Argument Battle · Lobby Market', text, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text + '\n' + window.location.href).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }, [bracketState, args])

  // ── Derived state ─────────────────────────────────────────────────────────────
  const state = bracketState
  const currentMatchup = state
    ? getMatchup(args, state, state.currentRound, state.currentMatchup)
    : null

  const champion = state?.championIdx !== null && state?.championIdx !== undefined
    ? args[state.championIdx]
    : null

  const totalMatchups = args.length >= 8 ? 7 : 0 // 4 + 2 + 1
  const completedMatchups = state
    ? state.winners.reduce((sum, r) => sum + r.length, 0)
    : 0

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-28">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-6 flex items-start gap-4">
          <Link
            href="/"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Swords className="h-5 w-5 text-gold" />
              <h1 className="font-mono text-2xl font-bold text-white">Argument Battle</h1>
            </div>
            <p className="text-xs font-mono text-surface-500">
              8 arguments · 3 rounds · 1 champion · resets daily
            </p>
          </div>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            {/* Progress skeleton */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <Skeleton className="h-4 w-32 mb-3 rounded" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="text-center text-xs font-mono text-surface-500 py-2">
              <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
              Loading today&apos;s bracket…
            </div>
            <div className="grid grid-cols-1 gap-4">
              <SkeletonCard />
              <div className="flex items-center justify-center py-2">
                <span className="text-xs font-mono text-surface-600 bg-surface-200/60 border border-surface-300/40 px-3 py-1 rounded-full">VS</span>
              </div>
              <SkeletonCard />
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-2xl bg-against-900/20 border border-against-800/40 p-6 text-center">
            <p className="text-against-300 text-sm mb-4">{error}</p>
            <button
              onClick={fetchArgs}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* ── Not enough data ────────────────────────────────────────────── */}
        {!loading && !error && args.length < 4 && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Flame className="h-8 w-8 text-gold mx-auto mb-3 opacity-50" />
            <p className="text-white font-mono font-semibold mb-2">No battle today</p>
            <p className="text-surface-500 text-sm">Not enough arguments in the last 48 hours to run the bracket. Come back once more debates are active!</p>
            <Link href="/" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-for-600/20 border border-for-600/40 text-for-300 text-sm font-mono hover:bg-for-600/30 transition-colors">
              Join Debates <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Main battle UI ────────────────────────────────────────────── */}
        {!loading && !error && args.length >= 4 && state && (

          <div className="space-y-5">

            {/* Progress bar */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-white">
                    {state.done ? 'Battle Complete!' : ROUND_LABELS[state.currentRound]}
                  </span>
                  {!state.done && (
                    <span className="text-xs font-mono text-surface-500">
                      Matchup {completedMatchups + 1} of {totalMatchups}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-surface-500">
                  {completedMatchups}/{totalMatchups} decided
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-for-500 to-gold"
                  initial={{ width: 0 }}
                  animate={{ width: totalMatchups > 0 ? `${(completedMatchups / totalMatchups) * 100}%` : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              {/* Round pill trail */}
              <div className="flex items-center gap-2 mt-2.5">
                {ROUND_LABELS.map((label, i) => (
                  <span
                    key={label}
                    className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded-full transition-colors',
                      i < state.currentRound || state.done
                        ? 'bg-emerald/20 text-emerald border border-emerald/30'
                        : i === state.currentRound && !state.done
                          ? 'bg-gold/20 text-gold border border-gold/30'
                          : 'bg-surface-300/50 text-surface-600 border border-surface-300/20'
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* ── Active matchup ─────────────────────────────────────────── */}
            {!state.done && currentMatchup && (
              <AnimatePresence mode="wait">
                <motion.div
                  key={animKey}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-3"
                >
                  {/* Round label */}
                  <div className="flex items-center gap-2 justify-center">
                    <div className="h-px flex-1 bg-surface-300/40" />
                    <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider px-3">
                      {ROUND_LABELS[state.currentRound]} · Pick the stronger argument
                    </span>
                    <div className="h-px flex-1 bg-surface-300/40" />
                  </div>

                  {/* Argument A */}
                  <ArgumentCard
                    arg={args[currentMatchup[0]]}
                    picked={choosing === currentMatchup[0]}
                    lost={false}
                    onPick={() => pickWinner(currentMatchup[0])}
                  />

                  {/* VS divider */}
                  <div className="flex items-center justify-center py-1">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-200 border border-surface-300">
                      <Scale className="h-3.5 w-3.5 text-surface-500" />
                      <span className="text-xs font-mono font-bold text-surface-400">VS</span>
                      <Scale className="h-3.5 w-3.5 text-surface-500" />
                    </div>
                  </div>

                  {/* Argument B */}
                  <ArgumentCard
                    arg={args[currentMatchup[1]]}
                    picked={choosing === currentMatchup[1]}
                    lost={false}
                    onPick={() => pickWinner(currentMatchup[1])}
                  />

                  <p className="text-center text-[11px] font-mono text-surface-600 pt-1">
                    Tap the argument you find more compelling
                  </p>
                </motion.div>
              </AnimatePresence>
            )}

            {/* ── Champion reveal ─────────────────────────────────────────── */}
            {state.done && champion && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, type: 'spring' }}
                className="space-y-4"
              >
                {/* Crown banner */}
                <div className="rounded-2xl bg-gradient-to-br from-gold/10 to-gold/5 border border-gold/30 p-6 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                    className="flex items-center justify-center mb-3"
                  >
                    <div className="h-14 w-14 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center">
                      <Trophy className="h-7 w-7 text-gold" />
                    </div>
                  </motion.div>
                  <h2 className="font-mono text-xl font-bold text-white mb-1">Champion Crowned</h2>
                  <p className="text-xs font-mono text-surface-500 mb-4">
                    Today&apos;s strongest civic argument — as judged by you
                  </p>

                  {/* Champion card */}
                  <div className={cn(
                    'rounded-xl border p-4 text-left',
                    champion.side === 'blue'
                      ? 'bg-for-600/15 border-for-500/30'
                      : 'bg-against-600/15 border-against-500/30'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border',
                        champion.side === 'blue'
                          ? 'text-for-300 bg-for-500/10 border-for-500/30'
                          : 'text-against-300 bg-against-500/10 border-against-500/30'
                      )}>
                        {champion.side === 'blue' ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                        {champion.side === 'blue' ? 'FOR' : 'AGAINST'}
                      </span>
                      {champion.ai_grade && (
                        <span className="text-[10px] font-mono text-surface-400 bg-surface-300/60 px-1.5 py-0.5 rounded">
                          Grade: {champion.ai_grade}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white leading-relaxed mb-3 font-sans">
                      <Quote className={cn(
                        'inline-block h-3.5 w-3.5 mr-1 -mt-0.5',
                        champion.side === 'blue' ? 'text-for-400' : 'text-against-400'
                      )} />
                      {champion.content}
                    </p>
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={champion.author_avatar_url}
                        fallback={champion.author_display_name || champion.author_username}
                        size="xs"
                      />
                      <span className="text-xs text-surface-300 font-medium">
                        {champion.author_display_name || champion.author_username}
                      </span>
                      <Link
                        href={`/topic/${champion.topic_id}`}
                        className="ml-auto text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                      >
                        View topic <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={share}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm font-mono font-semibold hover:bg-gold/20 transition-colors"
                  >
                    {copied ? (
                      <>Copied!</>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4" />
                        Share Champion
                      </>
                    )}
                  </button>
                  <Link
                    href="/argument-battle"
                    onClick={() => {
                      // Clear today's state to reset (play again mode — same arguments, fresh picks)
                      const today = todayStr()
                      try { localStorage.removeItem(STORAGE_KEY_PREFIX + today) } catch { /* */ }
                    }}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 text-sm font-mono hover:bg-surface-300 hover:text-white transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Replay
                  </Link>
                </div>

                {/* Explore links */}
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/gallery"
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400/60 transition-colors group"
                  >
                    <Award className="h-4 w-4 text-gold" />
                    <div>
                      <p className="text-xs font-mono font-semibold text-white">Argument Gallery</p>
                      <p className="text-[10px] font-mono text-surface-500">All-time best</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-white ml-auto transition-colors" />
                  </Link>
                  <Link
                    href="/duel"
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400/60 transition-colors group"
                  >
                    <Swords className="h-4 w-4 text-against-400" />
                    <div>
                      <p className="text-xs font-mono font-semibold text-white">Argument Duel</p>
                      <p className="text-[10px] font-mono text-surface-500">FOR vs AGAINST</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-white ml-auto transition-colors" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── Round summary (between rounds) ─────────────────────────── */}
            {!state.done && state.currentMatchup === 0 && state.currentRound > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="h-4 w-4 text-gold" />
                  <span className="text-xs font-mono font-semibold text-white">
                    {ROUND_LABELS[state.currentRound - 1]} Complete
                  </span>
                </div>
                <div className="space-y-1.5">
                  {state.winners[state.currentRound - 1].map((winIdx, i) => {
                    const w = args[winIdx]
                    if (!w) return null
                    return (
                      <div key={i} className={cn(
                        'flex items-center gap-2 p-2 rounded-lg text-xs font-mono',
                        w.side === 'blue' ? 'bg-for-600/10 text-for-300' : 'bg-against-600/10 text-against-300'
                      )}>
                        <Trophy className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{w.content.slice(0, 60)}…</span>
                        <span className="ml-auto flex-shrink-0 text-surface-500">
                          @{w.author_username}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}

          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
