'use client'

/**
 * /crucible — The Civic Crucible
 *
 * A daily argument competition. The most contested active topic on the
 * platform becomes today's crucible — and the community's arguments compete
 * for the top spot. FOR vs AGAINST ranked leaderboards, refreshed every 60s.
 *
 * Distinct from:
 *  - /pulse      (all arguments platform-wide, no competition)
 *  - /crossfire  (list of contested topics, 1 arg each)
 *  - /live       (real-time raw stream of new arguments)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Timer,
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
import { renderWithMentions } from '@/lib/utils/mentions'
import type {
  CrucibleResponse,
  CrucibleArgument,
  CruciblePreviousWinner,
} from '@/app/api/crucible/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 60_000

const RANK_MEDALS: Record<number, { icon: string; color: string }> = {
  1: { icon: '🥇', color: 'text-gold' },
  2: { icon: '🥈', color: 'text-surface-300' },
  3: { icon: '🥉', color: 'text-amber-600' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CrucibleSkeleton() {
  return (
    <div className="space-y-6">
      {/* Topic header */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      {/* Score banner */}
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      {/* Argument lists */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-5 w-24" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-8 ml-auto" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  index,
}: {
  arg: CrucibleArgument
  index: number
}) {
  const isFor = arg.side === 'blue'
  const medal = RANK_MEDALS[arg.rank]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.4) }}
      className={cn(
        'rounded-xl border p-4 space-y-2.5 transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Rank + Author row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Rank badge */}
        <span
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-md text-xs font-mono font-bold',
            medal
              ? medal.color
              : isFor
                ? 'bg-for-500/15 text-for-500'
                : 'bg-against-500/15 text-against-500'
          )}
          aria-label={`Rank ${arg.rank}`}
        >
          {medal ? medal.icon : `#${arg.rank}`}
        </span>

        <Avatar
          src={arg.author?.avatar_url ?? null}
          fallback={arg.author?.display_name || arg.author?.username || '?'}
          size="xs"
        />
        <span className="text-xs font-medium text-white truncate max-w-[100px]">
          {arg.author?.display_name || arg.author?.username || 'Anonymous'}
        </span>

        {/* Upvote count */}
        {arg.upvotes > 0 && (
          <span
            className={cn(
              'ml-auto flex-shrink-0 flex items-center gap-1 text-xs font-mono font-semibold',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            <ChevronUp className="h-3.5 w-3.5" />
            {arg.upvotes}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-surface-200 leading-relaxed">
        &ldquo;{renderWithMentions(truncate(arg.content, 200))}&rdquo;
      </p>

      {/* Timestamp */}
      <p className="text-[10px] font-mono text-surface-600">
        {relativeTime(arg.created_at)}
      </p>
    </motion.div>
  )
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColumnHeader({
  side,
  score,
  count,
  isLeading,
}: {
  side: 'for' | 'against'
  score: number
  count: number
  isLeading: boolean
}) {
  const isFor = side === 'for'
  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        className={cn(
          'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0',
          isFor
            ? 'bg-for-500/15 border border-for-500/30'
            : 'bg-against-500/15 border border-against-500/30'
        )}
      >
        {isFor
          ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-xs font-mono font-semibold uppercase tracking-wider',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {isLeading && (
            <span
              className={cn(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase',
                isFor
                  ? 'bg-for-500/15 text-for-400 border border-for-500/20'
                  : 'bg-against-500/15 text-against-400 border border-against-500/20'
              )}
            >
              <Zap className="h-2.5 w-2.5" />
              leading
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-surface-600">
          {count} argument{count !== 1 ? 's' : ''} · {score} upvote{score !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

// ─── Score banner ─────────────────────────────────────────────────────────────

function ScoreBanner({
  forScore,
  againstScore,
  leadingSide,
}: {
  forScore: number
  againstScore: number
  leadingSide: 'for' | 'against' | 'tied'
}) {
  const total = forScore + againstScore

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      {/* Score numbers */}
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <p className={cn('text-2xl font-bold font-mono', leadingSide === 'for' ? 'text-for-400' : 'text-for-600')}>
            {forScore}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">For</p>
        </div>

        <div className="flex flex-col items-center gap-1 px-4">
          <Swords className="h-4 w-4 text-surface-500" />
          <p className="text-[10px] font-mono text-surface-600 font-semibold">
            {leadingSide === 'tied' ? 'TIED' : leadingSide === 'for' ? 'FOR LEADS' : 'AGAINST LEADS'}
          </p>
        </div>

        <div className="text-center flex-1">
          <p className={cn('text-2xl font-bold font-mono', leadingSide === 'against' ? 'text-against-400' : 'text-against-600')}>
            {againstScore}
          </p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Against</p>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
          <motion.div
            className="h-full bg-gradient-to-r from-for-700 to-for-500"
            initial={{ width: 0 }}
            animate={{ width: `${(forScore / total) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.div
            className="h-full bg-gradient-to-r from-against-500 to-against-700 ml-auto"
            initial={{ width: 0 }}
            animate={{ width: `${(againstScore / total) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Previous winner card ─────────────────────────────────────────────────────

function PreviousWinnerCard({ winner }: { winner: CruciblePreviousWinner }) {
  const isFor = winner.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 space-y-2',
        isFor
          ? 'bg-for-500/5 border-for-500/20'
          : 'bg-against-500/5 border-against-500/20'
      )}
    >
      <div className="flex items-center gap-2">
        <Trophy className="h-3.5 w-3.5 text-gold flex-shrink-0" />
        <span className="text-xs font-mono text-gold font-semibold">
          Yesterday&apos;s Champion · {formatDate(winner.date)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Avatar
          src={winner.author?.avatar_url ?? null}
          fallback={winner.author?.display_name || winner.author?.username || '?'}
          size="xs"
        />
        <span className="text-xs font-medium text-white">
          {winner.author?.display_name || winner.author?.username || 'Anonymous'}
        </span>
        <span
          className={cn(
            'ml-auto flex items-center gap-1 text-xs font-mono font-semibold flex-shrink-0',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          <ChevronUp className="h-3.5 w-3.5" />
          {winner.upvotes}
        </span>
      </div>

      <p className="text-sm text-surface-300 leading-relaxed line-clamp-2">
        &ldquo;{winner.content}&rdquo;
      </p>

      {winner.topic_statement && (
        <p className="text-[10px] font-mono text-surface-600 line-clamp-1">
          on: {truncate(winner.topic_statement, 70)}
        </p>
      )}
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CruciblePage() {
  const [data, setData] = useState<CrucibleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/crucible')
      if (!res.ok) throw new Error('Failed to load crucible data')
      const json = await res.json() as CrucibleResponse
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    pollRef.current = setInterval(() => fetchData(), POLL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchData])

  const isEmpty = !loading && data && !data.topic

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-against-500/20 border border-against-500/30 flex-shrink-0">
                <Flame className="h-4 w-4 text-against-400" />
              </div>
              <h1 className="text-xl font-bold text-white font-mono">The Crucible</h1>
              {!loading && data?.topic && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-against-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-against-500" />
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-0.5 ml-11">
              Today&apos;s most contested topic — best arguments ranked by community upvotes
            </p>
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0',
              refreshing && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Timer strip ────────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="flex items-center gap-3 mb-5 px-1 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
              <Timer className="h-3.5 w-3.5" />
              <span>Round closes in <strong className="text-surface-300">{data.hoursRemaining}h</strong></span>
            </div>
            <div className="h-3 w-px bg-surface-500/40" aria-hidden />
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
              <Scale className="h-3.5 w-3.5" />
              <span>
                {data.roundDate
                  ? new Date(data.roundDate + 'T00:00:00Z').toLocaleDateString('en-US', {
                      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
                    })
                  : ''}
              </span>
            </div>
            <div className="h-3 w-px bg-surface-500/40" aria-hidden />
            <span className="text-[11px] font-mono text-surface-500">
              Refreshes every 60s
            </span>
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────────────────── */}
        {loading && <CrucibleSkeleton />}

        {/* ── Empty ──────────────────────────────────────────────────────── */}
        {isEmpty && (
          <EmptyState
            icon={Flame}
            title="No active debates yet"
            description="The Crucible lights up when contested topics have active votes. Check back soon."
            actions={[{ label: 'Browse Topics', href: '/', icon: Flame }]}
          />
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {!loading && data?.topic && (
          <div className="space-y-6">

            {/* ── Topic card ────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-start gap-3">
                {/* Status / category icon */}
                <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-400">
                  {data.topic.status === 'voting'
                    ? <Scale className="h-4 w-4 text-purple" />
                    : <Gavel className="h-4 w-4 text-for-400" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap mb-1">
                    <h2 className="text-base font-semibold text-white leading-snug flex-1">
                      {data.topic.statement}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={data.topic.status as 'active' | 'proposed' | 'law' | 'failed'}>
                      {data.topic.status.toUpperCase()}
                    </Badge>
                    {data.topic.category && (
                      <span className="text-[10px] font-mono text-surface-500">
                        {data.topic.category}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-surface-500">
                      {data.topic.total_votes.toLocaleString()} votes
                    </span>
                  </div>
                </div>

                <Link
                  href={`/topic/${data.topic.id}`}
                  className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  aria-label="View full topic"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Vote bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-for-400">{data.topic.blue_pct}% FOR</span>
                  <span className="text-against-400">{100 - data.topic.blue_pct}% AGAINST</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
                  <motion.div
                    className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.topic.blue_pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>

            {/* ── Score banner ──────────────────────────────────────────── */}
            <ScoreBanner
              forScore={data.forScore}
              againstScore={data.againstScore}
              leadingSide={data.leadingSide}
            />

            {/* ── Argument leaderboards ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* FOR arguments */}
              <div>
                <ColumnHeader
                  side="for"
                  score={data.forScore}
                  count={data.totalForArguments}
                  isLeading={data.leadingSide === 'for'}
                />
                {data.forArguments.length === 0 ? (
                  <div className="rounded-xl bg-surface-100 border border-dashed border-surface-400 p-6 text-center">
                    <ThumbsUp className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                    <p className="text-xs text-surface-500 font-mono">No FOR arguments yet</p>
                    <Link
                      href={`/topic/${data.topic.id}`}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs text-for-400 hover:text-for-300 font-mono transition-colors"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      Be the first
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {data.forArguments.map((arg, i) => (
                        <ArgumentCard key={arg.id} arg={arg} index={i} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* AGAINST arguments */}
              <div>
                <ColumnHeader
                  side="against"
                  score={data.againstScore}
                  count={data.totalAgainstArguments}
                  isLeading={data.leadingSide === 'against'}
                />
                {data.againstArguments.length === 0 ? (
                  <div className="rounded-xl bg-surface-100 border border-dashed border-surface-400 p-6 text-center">
                    <ThumbsDown className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                    <p className="text-xs text-surface-500 font-mono">No AGAINST arguments yet</p>
                    <Link
                      href={`/topic/${data.topic.id}`}
                      className="inline-flex items-center gap-1.5 mt-3 text-xs text-against-400 hover:text-against-300 font-mono transition-colors"
                    >
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                      Be the first
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence mode="popLayout">
                      {data.againstArguments.map((arg, i) => (
                        <ArgumentCard key={arg.id} arg={arg} index={i} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>

            {/* ── CTA — join the crucible ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/20">
                  <Award className="h-5 w-5 text-against-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white mb-1">
                    Enter the Crucible
                  </h3>
                  <p className="text-xs text-surface-400 leading-relaxed mb-3">
                    Vote on this topic, then post your best argument. The most upvoted arguments
                    claim the top spots — and the round champion earns clout.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/topic/${data.topic.id}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-against-700 hover:bg-against-600 text-white text-xs font-mono font-semibold transition-colors"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      Enter Debate
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/pulse"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-300 text-xs font-mono font-semibold transition-colors border border-surface-400"
                    >
                      Community Pulse
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ── Yesterday's champion ───────────────────────────────────── */}
            {data.previousWinner && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-gold" />
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                    Previous Champion
                  </h2>
                  <div className="flex-1 h-px bg-surface-300" />
                </div>
                <PreviousWinnerCard winner={data.previousWinner} />
              </div>
            )}

          </div>
        )}

        {/* Refreshing indicator */}
        {refreshing && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-surface-200 border border-surface-300 shadow-lg text-xs font-mono text-surface-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing…
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
