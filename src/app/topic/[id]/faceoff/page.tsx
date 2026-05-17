'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { haptics } from '@/lib/hooks/useHaptics'
import type { TopicFaceoffResponse, FaceoffArg, TopicFaceoffLeader } from '@/app/api/topics/[id]/faceoff/route'

// ─── Grade badge ──────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, string> = {
  'A+': 'text-emerald border-emerald/40 bg-emerald/10',
  'A':  'text-emerald border-emerald/40 bg-emerald/10',
  'A-': 'text-emerald border-emerald/40 bg-emerald/10',
  'B+': 'text-for-400 border-for-500/40 bg-for-500/10',
  'B':  'text-for-400 border-for-500/40 bg-for-500/10',
  'B-': 'text-for-400 border-for-500/40 bg-for-500/10',
  'C+': 'text-gold border-gold/40 bg-gold/10',
  'C':  'text-gold border-gold/40 bg-gold/10',
  'C-': 'text-gold border-gold/40 bg-gold/10',
  'D':  'text-surface-500 border-surface-500/40 bg-surface-300/10',
  'F':  'text-against-400 border-against-500/40 bg-against-500/10',
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  return (
    <span className={cn(
      'inline-flex items-center justify-center h-5 w-8 rounded border text-[10px] font-mono font-bold',
      GRADE_COLORS[grade] ?? 'text-surface-500 border-surface-500/40 bg-surface-300/10'
    )}>
      {grade}
    </span>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

interface ArgCardProps {
  arg: FaceoffArg
  side: 'for' | 'against'
  voted: boolean
  winner: boolean
  loser: boolean
  onVote: () => void
  disabled: boolean
}

function ArgCard({ arg, side, voted, winner, loser, onVote, disabled }: ArgCardProps) {
  const isFor = side === 'for'
  const accentText = isFor ? 'text-for-400' : 'text-against-400'
  const accentBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const accentBg = isFor ? 'bg-for-500/8' : 'bg-against-500/8'
  const accentButtonBg = isFor ? 'bg-for-500 hover:bg-for-600' : 'bg-against-500 hover:bg-against-600'
  const accentWinnerBorder = isFor ? 'border-for-400' : 'border-against-400'
  const accentWinnerBg = isFor ? 'bg-for-500/15' : 'bg-against-500/15'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const Icon = isFor ? ThumbsUp : ThumbsDown

  const winRate = arg.arena.bouts > 0 && arg.arena.win_pct !== null
    ? `${arg.arena.win_pct}% wins`
    : null

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col rounded-2xl border transition-all',
        voted
          ? winner
            ? cn('border-2', accentWinnerBorder, accentWinnerBg)
            : loser
            ? 'border border-surface-300 bg-surface-100/50 opacity-60'
            : 'border border-surface-300 bg-surface-100'
          : cn('border', accentBorder, accentBg)
      )}
    >
      {/* Side label */}
      <div className={cn('flex items-center gap-2 px-4 pt-3 pb-2', accentText)}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-xs font-mono font-bold tracking-wider">{sideLabel}</span>
        {winner && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="ml-auto flex items-center gap-1 text-xs font-mono font-bold"
          >
            <Trophy className="h-3 w-3" />
            More compelling
          </motion.span>
        )}
      </div>

      {/* Argument content */}
      <div className="px-4 pb-3 flex-1">
        <p className="text-sm text-surface-700 leading-relaxed line-clamp-6">{arg.content}</p>
      </div>

      {/* Footer: author + grade + arena stats */}
      <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
        <Avatar
          src={arg.author.avatar_url}
          username={arg.author.username}
          size={18}
        />
        <Link
          href={`/profile/${arg.author.username}`}
          className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
          onClick={e => e.stopPropagation()}
        >
          {arg.author.display_name ?? arg.author.username}
        </Link>
        <GradeBadge grade={arg.ai_grade} />
        <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-surface-600">
          <span className="flex items-center gap-0.5">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes}
          </span>
          {arg.arena.bouts > 0 && (
            <span className="flex items-center gap-0.5">
              <Swords className="h-3 w-3" />
              {arg.arena.wins}/{arg.arena.bouts}
              {winRate && <span className="text-surface-600 ml-1">{winRate}</span>}
            </span>
          )}
        </div>
      </div>

      {/* Vote button */}
      {!voted && (
        <div className="px-4 pb-4">
          <button
            onClick={onVote}
            disabled={disabled}
            className={cn(
              'w-full h-10 rounded-xl text-sm font-mono font-semibold text-white transition-all',
              'flex items-center justify-center gap-2',
              accentButtonBg,
              disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.97]'
            )}
          >
            <Check className="h-4 w-4" />
            More compelling
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Vote result reveal ───────────────────────────────────────────────────────

function ResultReveal({
  winnerId,
  forArg,
  againstArg: _againstArg,
  onNext,
  onReset,
  hasMore,
}: {
  winnerId: string
  forArg: FaceoffArg
  againstArg: FaceoffArg
  onNext: () => void
  onReset: () => void
  hasMore: boolean
}) {
  const winnerIsFor = winnerId === forArg.id
  const accentText = winnerIsFor ? 'text-for-400' : 'text-against-400'
  const accentBg = winnerIsFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const accentBorder = winnerIsFor ? 'border-for-500/30' : 'border-against-500/30'
  const label = winnerIsFor ? 'FOR wins' : 'AGAINST wins'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('mt-4 rounded-xl border p-4 text-center', accentBorder, accentBg)}
    >
      <div className={cn('text-sm font-mono font-bold mb-3', accentText)}>
        <Trophy className="inline h-4 w-4 mr-1 mb-0.5" />
        {label}
      </div>
      <div className="flex justify-center gap-3">
        {hasMore ? (
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-for-500 hover:bg-for-600 text-white text-sm font-mono font-semibold transition-colors"
          >
            Next round
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 h-9 px-5 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono font-semibold transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Restart
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

function Leaderboard({ leaders }: { leaders: TopicFaceoffLeader[]; topicId: string }) {
  if (leaders.length === 0) return null

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-4 w-4 text-gold" />
        <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
          Arena champions · this debate
        </h2>
      </div>
      <div className="space-y-2">
        {leaders.map((leader, i) => {
          const isFor = leader.side === 'blue'
          const accentText = isFor ? 'text-for-400' : 'text-against-400'
          const rankColors = ['text-gold', 'text-surface-400', 'text-surface-500']

          return (
            <Link
              key={leader.id}
              href={`/arguments/${leader.id}`}
              className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 p-3 hover:border-surface-400 transition-colors group"
            >
              <span className={cn('font-mono font-bold text-sm mt-0.5 w-4 flex-shrink-0', rankColors[i] ?? 'text-surface-600')}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-600 line-clamp-2 leading-relaxed">{leader.content}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={cn('text-[10px] font-mono font-bold', accentText)}>
                    {isFor ? 'FOR' : 'AGAINST'}
                  </span>
                  <span className="text-[10px] font-mono text-surface-600">
                    {leader.wins} wins · {leader.win_pct}% win rate
                  </span>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-white transition-colors mt-0.5 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FaceoffSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-3/4" />
      <div className="grid grid-cols-1 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="flex items-center gap-2 mt-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TopicFaceoffPage() {
  const params = useParams<{ id: string }>()
  const topicId = params.id

  const [data, setData] = useState<TopicFaceoffResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [roundCount, setRoundCount] = useState(0)
  const [noMorePairs, setNoMorePairs] = useState(false)
  const loadedRef = useRef(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setWinnerId(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/faceoff`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as TopicFaceoffResponse
      setData(json)
      // If user_vote already set, show the result immediately
      if (json.pair.user_vote) {
        setWinnerId(json.pair.user_vote)
      }
      setNoMorePairs(!json.pair.for_arg || !json.pair.against_arg)
    } catch {
      // Silent — page will show error state
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    loadData()
  }, [loadData])

  async function handleVote(winningArgId: string, losingArgId: string) {
    if (voting || winnerId) return
    setVoting(true)
    haptics.impact()

    const [canonA, canonB] = [winningArgId, losingArgId].sort()

    try {
      const res = await fetch('/api/arguments/faceoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argument_a_id: canonA,
          argument_b_id: canonB,
          winner_id: winningArgId,
        }),
      })

      if (res.ok) {
        setWinnerId(winningArgId)
        setRoundCount(r => r + 1)
        haptics.success()
      } else {
        const err = (await res.json()) as { error?: string }
        if (err.error === 'Already voted on this pair') {
          setWinnerId(winningArgId) // treat as voted
        }
      }
    } catch {
      // Silent
    } finally {
      setVoting(false)
    }
  }

  function handleNext() {
    loadedRef.current = false
    loadData()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-6 w-40" />
          </div>
          <FaceoffSkeleton />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center space-y-3">
            <Swords className="h-10 w-10 text-surface-500 mx-auto" />
            <p className="font-mono text-surface-500">Failed to load faceoff.</p>
            <button onClick={loadData} className="text-sm text-for-400 hover:underline">
              Try again
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, pair, leaderboard, total_faceoffs } = data
  const hasForArg = !!pair.for_arg
  const hasAgainstArg = !!pair.against_arg
  const hasPair = hasForArg && hasAgainstArg
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const STATUS_LABELS: Record<string, string> = {
    proposed: 'Proposed', active: 'Active', voting: 'Voting', law: 'LAW', failed: 'Failed',
  }
  const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Swords className="h-4 w-4 text-purple flex-shrink-0" />
            <h1 className="font-mono text-base font-bold text-white truncate">Argument Faceoff</h1>
          </div>
          {total_faceoffs > 0 && (
            <div className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500 flex-shrink-0">
              <Users className="h-3 w-3" />
              {total_faceoffs.toLocaleString()} rounds
            </div>
          )}
        </div>

        {/* Topic card */}
        <Link
          href={`/topic/${topicId}`}
          className="block rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5 hover:border-surface-400 transition-colors group"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={STATUS_VARIANT[topic.status] ?? 'active'}>
              {STATUS_LABELS[topic.status] ?? topic.status}
            </Badge>
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
            )}
          </div>
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-surface-700 transition-colors">
            {topic.statement}
          </p>
          {/* Vote bar */}
          <div className="mt-3 space-y-1">
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-for-400">{forPct}% FOR</span>
              <span className="text-against-400">{againstPct}% AGAINST</span>
            </div>
          </div>
        </Link>

        {/* Round counter */}
        {roundCount > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 mb-4 text-xs font-mono text-surface-500"
          >
            <Zap className="h-3.5 w-3.5 text-gold" />
            {roundCount} round{roundCount !== 1 ? 's' : ''} voted
          </motion.div>
        )}

        {/* Faceoff section */}
        {!hasPair ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center space-y-3">
            <Swords className="h-8 w-8 text-surface-500 mx-auto" />
            <p className="font-mono text-sm text-surface-500">
              {!hasForArg && !hasAgainstArg
                ? 'No arguments yet for this debate.'
                : !hasForArg
                ? 'No FOR arguments yet — be the first!'
                : 'No AGAINST arguments yet — challenge the consensus!'}
            </p>
            <Link
              href={`/topic/${topicId}`}
              className="inline-flex items-center gap-1.5 text-sm text-for-400 hover:underline font-mono"
            >
              Write an argument
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Question prompt */}
            <div className="text-center">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                Which argument is more compelling?
              </p>
            </div>

            {/* Argument cards */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${pair.for_arg!.id}-${pair.against_arg!.id}-${winnerId}`}
                className="space-y-3"
              >
                <ArgCard
                  arg={pair.for_arg!}
                  side="for"
                  voted={!!winnerId}
                  winner={winnerId === pair.for_arg!.id}
                  loser={!!winnerId && winnerId !== pair.for_arg!.id}
                  onVote={() => handleVote(pair.for_arg!.id, pair.against_arg!.id)}
                  disabled={voting || !!winnerId}
                />

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-surface-300" />
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">vs</span>
                  <div className="h-px flex-1 bg-surface-300" />
                </div>

                <ArgCard
                  arg={pair.against_arg!}
                  side="against"
                  voted={!!winnerId}
                  winner={winnerId === pair.against_arg!.id}
                  loser={!!winnerId && winnerId !== pair.against_arg!.id}
                  onVote={() => handleVote(pair.against_arg!.id, pair.for_arg!.id)}
                  disabled={voting || !!winnerId}
                />

                {/* Loading overlay while voting */}
                {voting && (
                  <div className="flex justify-center pt-2">
                    <Loader2 className="h-4 w-4 text-for-400 animate-spin" />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Result + next button */}
            <AnimatePresence>
              {winnerId && (
                <ResultReveal
                  winnerId={winnerId}
                  forArg={pair.for_arg!}
                  againstArg={pair.against_arg!}
                  onNext={handleNext}
                  onReset={() => { setRoundCount(0); handleNext() }}
                  hasMore={!noMorePairs}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Arena leaderboard for this topic */}
        <Leaderboard leaders={leaderboard} topicId={topicId} />

        {/* Explore more faceoffs CTA */}
        <div className="mt-8 pt-6 border-t border-surface-300 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/arena"
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors flex-1"
          >
            <Trophy className="h-4 w-4 text-gold" />
            Global Arena
          </Link>
          <Link
            href="/faceoffs"
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors flex-1"
          >
            <Swords className="h-4 w-4 text-purple" />
            All Faceoffs
          </Link>
          <Link
            href={`/topic/${topicId}/impact`}
            className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-surface-200 hover:bg-surface-300 text-sm font-mono text-white transition-colors flex-1"
          >
            <Zap className="h-4 w-4 text-for-400" />
            Argument Impact
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
