'use client'

/**
 * /judge — Argument Acuity Challenge
 *
 * An interactive game where users judge which side's argument is MORE
 * CONVINCING on a given topic — independent of their own position.
 *
 * After each choice, the upvote counts reveal "crowd wisdom". Users build
 * an Argument Acuity score across 8 rounds.
 *
 * Distinct from /crossfire (passive read) and /duel (coalition vs coalition).
 * This is a focused, gamified argument quality assessment.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { JudgeRound, JudgeResponse } from '@/app/api/judge/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Choice = 'for' | 'against' | null

interface RoundResult {
  roundIndex: number
  choice: 'for' | 'against'
  matchedCrowd: boolean
  forUpvotes: number
  againstUpvotes: number
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
  Other: 'text-surface-500',
}

const CATEGORY_BG: Record<string, string> = {
  Economics: 'bg-gold/10 border-gold/25',
  Politics: 'bg-for-600/10 border-for-600/25',
  Technology: 'bg-purple/10 border-purple/25',
  Science: 'bg-emerald/10 border-emerald/25',
  Ethics: 'bg-against-700/10 border-against-600/25',
  Philosophy: 'bg-for-800/10 border-for-700/25',
  Culture: 'bg-gold/10 border-gold/25',
  Health: 'bg-against-700/10 border-against-600/25',
  Environment: 'bg-emerald/10 border-emerald/25',
  Education: 'bg-purple/10 border-purple/25',
  Other: 'bg-surface-200/40 border-surface-400/25',
}

// ─── Score tier helpers ────────────────────────────────────────────────────────

function getScoreTier(correct: number, total: number): {
  label: string
  sublabel: string
  color: string
  icon: typeof Trophy
} {
  const pct = total === 0 ? 0 : (correct / total) * 100
  if (pct >= 90) return { label: 'Master Judge', sublabel: 'Exceptional argument acuity', color: 'text-gold', icon: Trophy }
  if (pct >= 75) return { label: 'Sharp Critic', sublabel: 'You read arguments well', color: 'text-purple', icon: Award }
  if (pct >= 60) return { label: 'Keen Observer', sublabel: 'Above-average acuity', color: 'text-for-400', icon: Sparkles }
  if (pct >= 40) return { label: 'Fair Witness', sublabel: 'Balanced perspective', color: 'text-surface-400', icon: Scale }
  return { label: 'Contrarian', sublabel: 'You prefer the underdog argument', color: 'text-against-400', icon: ThumbsDown }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text
}

function fmtVotes(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

// ─── Argument card component ──────────────────────────────────────────────────

function ArgumentCard({
  content,
  side,
  author,
  upvotes,
  sourceUrl,
  choice,
  revealed,
  crowdWinner,
  onClick,
}: {
  content: string
  side: 'for' | 'against'
  author: JudgeRound['for_argument']['author']
  upvotes: number
  sourceUrl: string | null
  choice: Choice
  revealed: boolean
  crowdWinner: 'for' | 'against' | 'tie' | null
  onClick: () => void
}) {
  const isFor = side === 'for'
  const isChosen = choice === side
  const isCrowdWinner = crowdWinner === side || crowdWinner === 'tie'
  const isNotChosen = choice !== null && !isChosen

  return (
    <motion.button
      onClick={onClick}
      disabled={revealed || choice !== null}
      whileHover={!revealed && choice === null ? { scale: 1.015 } : {}}
      whileTap={!revealed && choice === null ? { scale: 0.985 } : {}}
      className={cn(
        'w-full text-left rounded-2xl border p-5 transition-all duration-300 relative overflow-hidden group',
        'flex flex-col gap-3',
        // Unchosen state
        choice === null && [
          'cursor-pointer',
          isFor
            ? 'bg-for-900/15 border-for-700/30 hover:border-for-500/60 hover:bg-for-900/25 hover:shadow-lg hover:shadow-for-900/20'
            : 'bg-against-900/15 border-against-700/30 hover:border-against-500/60 hover:bg-against-900/25 hover:shadow-lg hover:shadow-against-900/20',
        ],
        // Chosen state (before reveal)
        isChosen && !revealed && [
          isFor
            ? 'bg-for-800/25 border-for-500/70 shadow-lg shadow-for-900/20'
            : 'bg-against-800/25 border-against-500/70 shadow-lg shadow-against-900/20',
        ],
        // Not chosen (before reveal)
        isNotChosen && !revealed && 'opacity-40',
        // Revealed: winner
        revealed && isCrowdWinner && isChosen && [
          isFor
            ? 'bg-for-800/30 border-for-500/80 shadow-lg shadow-for-900/25'
            : 'bg-against-800/30 border-against-500/80 shadow-lg shadow-against-900/25',
        ],
        // Revealed: loser or not-chosen
        revealed && !isCrowdWinner && 'opacity-50',
        revealed && isCrowdWinner && !isChosen && 'opacity-70',
        'disabled:cursor-default',
      )}
    >
      {/* Side label */}
      <div className="flex items-center justify-between gap-2">
        <div className={cn(
          'flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider',
          isFor ? 'text-for-400' : 'text-against-400',
        )}>
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </div>

        {/* Reveal badge */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                'flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                isCrowdWinner
                  ? 'bg-emerald/10 border-emerald/30 text-emerald'
                  : 'bg-surface-300/30 border-surface-400/30 text-surface-500',
              )}
            >
              <ThumbsUp className="h-2.5 w-2.5" />
              {fmtVotes(upvotes)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Argument content */}
      <p className="text-sm text-white/90 leading-relaxed font-medium">
        {truncate(content, 360)}
      </p>

      {/* Author + source */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
        {author ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="xs"
              className="flex-shrink-0"
            />
            <span className="text-[11px] text-surface-500 truncate">
              {author.display_name || `@${author.username}`}
            </span>
          </div>
        ) : (
          <div />
        )}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 ml-2 text-surface-600 hover:text-for-400 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* "Click to choose" hint */}
      {!revealed && choice === null && (
        <div className={cn(
          'absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
          isFor ? 'bg-gradient-to-r from-for-600 to-for-400' : 'bg-gradient-to-r from-against-600 to-against-400',
        )} />
      )}

      {/* Chosen indicator ring */}
      {isChosen && !revealed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            'absolute inset-0 rounded-2xl ring-2 pointer-events-none',
            isFor ? 'ring-for-500/50' : 'ring-against-500/50',
          )}
        />
      )}
    </motion.button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JudgePage() {
  const [rounds, setRounds] = useState<JudgeRound[]>([])
  const [loading, setLoading] = useState(true)
  const [roundIndex, setRoundIndex] = useState(0)
  const [choice, setChoice] = useState<Choice>(null)
  const [revealed, setRevealed] = useState(false)
  const [results, setResults] = useState<RoundResult[]>([])
  const [finished, setFinished] = useState(false)
  const [copied, setCopied] = useState(false)
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchRounds = useCallback(async () => {
    setLoading(true)
    setRoundIndex(0)
    setChoice(null)
    setRevealed(false)
    setResults([])
    setFinished(false)
    try {
      const res = await fetch('/api/judge?count=8')
      if (!res.ok) throw new Error('Failed to fetch')
      const data: JudgeResponse = await res.json()
      setRounds(data.rounds)
    } catch {
      setRounds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRounds()
    return () => { if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current) }
  }, [fetchRounds])

  const currentRound = rounds[roundIndex] ?? null

  function handleChoice(picked: 'for' | 'against') {
    if (choice !== null || revealed || !currentRound) return
    setChoice(picked)
    revealTimeoutRef.current = setTimeout(() => {
      setRevealed(true)
    }, 500)
  }

  function handleNext() {
    if (!currentRound || choice === null) return
    const forUp = currentRound.for_argument.upvotes
    const againstUp = currentRound.against_argument.upvotes
    let crowdWinner: 'for' | 'against' | 'tie'
    if (forUp === againstUp) crowdWinner = 'tie'
    else if (forUp > againstUp) crowdWinner = 'for'
    else crowdWinner = 'against'

    const matchedCrowd = crowdWinner === 'tie' ? true : choice === crowdWinner

    const newResult: RoundResult = {
      roundIndex,
      choice,
      matchedCrowd,
      forUpvotes: forUp,
      againstUpvotes: againstUp,
    }

    const newResults = [...results, newResult]
    setResults(newResults)

    if (roundIndex + 1 >= rounds.length) {
      setFinished(true)
    } else {
      setRoundIndex((i) => i + 1)
      setChoice(null)
      setRevealed(false)
    }
  }

  // Crowd winner for current round (after reveal)
  const crowdWinner: 'for' | 'against' | 'tie' | null = revealed && currentRound
    ? currentRound.for_argument.upvotes === currentRound.against_argument.upvotes
      ? 'tie'
      : currentRound.for_argument.upvotes > currentRound.against_argument.upvotes
      ? 'for'
      : 'against'
    : null

  const correctCount = results.filter((r) => r.matchedCrowd).length
  const totalDone = results.length
  const tier = getScoreTier(correctCount, totalDone > 0 ? totalDone : 8)

  async function copyShare() {
    const finalCorrect = results.filter((r) => r.matchedCrowd).length
    const total = results.length
    const tierFinal = getScoreTier(finalCorrect, total)
    const text = `I scored ${finalCorrect}/${total} on the Argument Acuity Challenge! Tier: ${tierFinal.label}\n\nJudge arguments at lobby.market/judge`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* best-effort */ }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72 mb-8" />
          <Skeleton className="h-4 w-full mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-56 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Empty ─────────────────────────────────────────────────────────────────────

  if (!loading && rounds.length === 0) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <EmptyState
            icon={Scale}
            title="No rounds available"
            description="There aren't enough contested topics with arguments yet. Try again soon."
            actions={[{ label: 'Browse topics', href: '/' }]}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Finished screen ───────────────────────────────────────────────────────────

  if (finished) {
    const finalCorrect = results.filter((r) => r.matchedCrowd).length
    const finalTotal = results.length
    const finalTier = getScoreTier(finalCorrect, finalTotal)
    const FinalIcon = finalTier.icon

    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Trophy icon */}
            <div className={cn(
              'inline-flex items-center justify-center h-20 w-20 rounded-full mb-6',
              'bg-surface-200/60 border border-surface-300/60',
            )}>
              <FinalIcon className={cn('h-9 w-9', finalTier.color)} />
            </div>

            <h1 className="font-mono text-3xl font-bold text-white mb-2">
              {finalTier.label}
            </h1>
            <p className="text-surface-400 font-mono text-sm mb-6">
              {finalTier.sublabel}
            </p>

            {/* Score */}
            <div className="inline-flex items-center gap-3 bg-surface-200/60 border border-surface-300/60 rounded-2xl px-8 py-5 mb-8">
              <div className="text-center">
                <p className={cn('font-mono text-4xl font-bold', finalTier.color)}>
                  {finalCorrect}
                  <span className="text-surface-500 text-2xl">/{finalTotal}</span>
                </p>
                <p className="text-[11px] text-surface-500 font-mono uppercase tracking-wider mt-1">
                  Matched crowd wisdom
                </p>
              </div>
            </div>

            {/* Round breakdown */}
            <div className="grid grid-cols-4 gap-2 mb-8">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-xl border p-2.5 text-center',
                    r.matchedCrowd
                      ? 'bg-emerald/10 border-emerald/30'
                      : 'bg-against-900/15 border-against-700/30',
                  )}
                >
                  <p className="text-[10px] font-mono text-surface-500 mb-1">Round {i + 1}</p>
                  <div className={cn(
                    'text-xs font-bold font-mono',
                    r.matchedCrowd ? 'text-emerald' : 'text-against-400',
                  )}>
                    {r.matchedCrowd ? '✓' : '✗'}
                  </div>
                  <p className={cn(
                    'text-[10px] font-mono mt-0.5',
                    r.choice === 'for' ? 'text-for-400' : 'text-against-400',
                  )}>
                    {r.choice === 'for' ? 'FOR' : 'AGN'}
                  </p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={copyShare}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm font-mono font-semibold text-white hover:bg-surface-300/60 transition-colors"
              >
                {copied ? <CheckCircle2 className="h-4 w-4 text-emerald" /> : <Share2 className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Share result'}
              </button>
              <button
                onClick={fetchRounds}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-for-600/20 border border-for-600/40 text-sm font-mono font-semibold text-for-300 hover:bg-for-600/30 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Play again
              </button>
              <Link
                href="/crossfire"
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm font-mono font-semibold text-surface-300 hover:bg-surface-300/60 transition-colors"
              >
                Browse arguments
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Active round ──────────────────────────────────────────────────────────────

  if (!currentRound) return null

  const catColor = CATEGORY_COLOR[currentRound.topic_category ?? ''] ?? 'text-surface-500'
  const catBg = CATEGORY_BG[currentRound.topic_category ?? ''] ?? 'bg-surface-200/40 border-surface-400/25'
  const currentMatchedCrowd = revealed && crowdWinner !== null
    ? (crowdWinner === 'tie' ? true : choice === crowdWinner)
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/crossfire"
            className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-sm font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-for-400" />
              Argument Judge
            </h1>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Which argument is more convincing?
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="font-mono text-xs text-surface-500">Round</p>
            <p className="font-mono text-lg font-bold text-white leading-tight">
              {roundIndex + 1}
              <span className="text-surface-600 text-sm">/{rounds.length}</span>
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-surface-200/60 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
            initial={{ width: 0 }}
            animate={{ width: `${((roundIndex) / rounds.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        {/* Score tracker */}
        {totalDone > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-2 w-2 rounded-full',
                      r.matchedCrowd ? 'bg-emerald' : 'bg-against-500',
                    )}
                  />
                ))}
              </div>
              <span className="text-xs font-mono text-surface-500">
                {correctCount}/{totalDone} matching crowd
              </span>
            </div>
            <div className={cn('text-xs font-mono font-semibold', tier.color)}>
              {tier.label}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={roundIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {/* Topic */}
            <div className="bg-surface-100/60 border border-surface-300/40 rounded-2xl p-5 mb-5">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-surface-200/60 border border-surface-300/50 flex items-center justify-center mt-0.5">
                  <Scale className="h-4 w-4 text-surface-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {currentRound.topic_category && (
                      <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', catBg, catColor)}>
                        {currentRound.topic_category}
                      </span>
                    )}
                    <Badge variant={currentRound.topic_status as 'active' | 'proposed' | 'law' | 'failed'}>
                      {currentRound.topic_status === 'law' ? 'LAW' : currentRound.topic_status.charAt(0).toUpperCase() + currentRound.topic_status.slice(1)}
                    </Badge>
                  </div>
                  <p className="text-base font-semibold text-white leading-snug">
                    {currentRound.topic_statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs font-mono text-for-400">
                      {currentRound.blue_pct}% FOR
                    </span>
                    <span className="text-xs font-mono text-surface-600">·</span>
                    <span className="text-xs font-mono text-against-400">
                      {100 - currentRound.blue_pct}% AGAINST
                    </span>
                    <span className="text-xs font-mono text-surface-600">·</span>
                    <span className="text-xs font-mono text-surface-500">
                      {currentRound.total_votes.toLocaleString()} votes
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Instruction */}
            <AnimatePresence mode="wait">
              {!revealed ? (
                <motion.p
                  key="instruction"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-xs font-mono text-surface-500 mb-4 uppercase tracking-wider"
                >
                  Choose the more convincing argument — regardless of your own position
                </motion.p>
              ) : (
                <motion.div
                  key="result-banner"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    'flex items-center justify-center gap-2 text-sm font-mono font-bold py-2 mb-4 rounded-xl border',
                    currentMatchedCrowd
                      ? 'bg-emerald/10 border-emerald/30 text-emerald'
                      : 'bg-against-900/20 border-against-700/30 text-against-400',
                  )}
                >
                  {currentMatchedCrowd ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Agreed with crowd wisdom
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      You chose differently from the crowd
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Arguments */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <ArgumentCard
                content={currentRound.for_argument.content}
                side="for"
                author={currentRound.for_argument.author}
                upvotes={currentRound.for_argument.upvotes}
                sourceUrl={currentRound.for_argument.source_url}
                choice={choice}
                revealed={revealed}
                crowdWinner={crowdWinner}
                onClick={() => handleChoice('for')}
              />
              <ArgumentCard
                content={currentRound.against_argument.content}
                side="against"
                author={currentRound.against_argument.author}
                upvotes={currentRound.against_argument.upvotes}
                sourceUrl={currentRound.against_argument.source_url}
                choice={choice}
                revealed={revealed}
                crowdWinner={crowdWinner}
                onClick={() => handleChoice('against')}
              />
            </div>

            {/* Reveal / Next actions */}
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col sm:flex-row items-center justify-between gap-3"
                >
                  {/* Link to the actual topic */}
                  <Link
                    href={`/topic/${currentRound.topic_id}`}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Vote on this topic
                  </Link>

                  {/* Next / Finish */}
                  <button
                    onClick={handleNext}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-for-600/20 border border-for-600/40 text-sm font-mono font-bold text-for-300 hover:bg-for-600/30 transition-colors"
                  >
                    {roundIndex + 1 >= rounds.length ? (
                      <>
                        <Trophy className="h-4 w-4" />
                        See your score
                      </>
                    ) : (
                      <>
                        Next round
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        {/* Info footer */}
        <div className="mt-8 pt-6 border-t border-surface-200/40 text-center">
          <p className="text-xs text-surface-600 font-mono">
            Crowd wisdom based on community upvotes · Judge on quality, not your own stance
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <Link href="/crossfire" className="text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors flex items-center gap-1">
              <Gavel className="h-3 w-3" />
              Crossfire
            </Link>
            <Link href="/pulse" className="text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Live arguments
            </Link>
            <Link href="/duel" className="text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors flex items-center gap-1">
              <Trophy className="h-3 w-3" />
              Duel
            </Link>
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
