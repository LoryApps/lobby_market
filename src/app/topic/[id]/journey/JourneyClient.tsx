'use client'

/**
 * /topic/[id]/journey — My Civic Journey
 *
 * Shows the logged-in user's complete personal history with a specific topic:
 * their vote, arguments they wrote (and upvotes received), and any predictions
 * they staked. A narrative timeline of their engagement with the debate.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  ExternalLink,
  Flame,
  Gavel,
  LogIn,
  MessageSquare,
  RefreshCw,
  Scale,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Vote,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  JourneyArgument,
  JourneyPrediction,
  JourneyResponse,
  JourneyVote,
} from '@/app/api/topics/[id]/journey/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function absoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-purple' },
  law:      { label: 'LAW',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-surface-500' },
}

const AI_SCORE_CONFIG: Record<string, { label: string; color: string }> = {
  A: { label: 'A', color: 'text-emerald' },
  B: { label: 'B', color: 'text-for-400' },
  C: { label: 'C', color: 'text-purple' },
  D: { label: 'D', color: 'text-gold' },
  F: { label: 'F', color: 'text-against-400' },
}

function scoreLabel(score: number | null): string | null {
  if (score === null) return null
  if (score >= 4.5) return 'A'
  if (score >= 3.5) return 'B'
  if (score >= 2.5) return 'C'
  if (score >= 1.5) return 'D'
  return 'F'
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string
  value: string | number
  icon: typeof Vote
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 flex flex-col gap-2">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5 uppercase tracking-wide">{label}</p>
      </div>
    </div>
  )
}

// ─── Vote card ─────────────────────────────────────────────────────────────────

function VoteCard({ vote, topicId }: { vote: JourneyVote; topicId: string }) {
  const isFor = vote.side === 'blue'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5',
        isFor
          ? 'bg-for-500/5 border-for-500/25'
          : 'bg-against-500/5 border-against-500/25'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0',
            isFor ? 'bg-for-500/15 border border-for-500/30' : 'bg-against-500/15 border border-against-500/30'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-5 w-5 text-for-400" />
          ) : (
            <ThumbsDown className="h-5 w-5 text-against-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-mono font-bold text-sm', isFor ? 'text-for-300' : 'text-against-300')}>
              You voted {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {vote.agreesWithMajority ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald/10 text-emerald border border-emerald/25 rounded-full px-2 py-0.5">
                <CheckCircle2 className="h-2.5 w-2.5" />
                With majority
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-gold/10 text-gold border border-gold/25 rounded-full px-2 py-0.5">
                <Star className="h-2.5 w-2.5" />
                Contrarian
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-surface-500 mt-1">
            Cast {absoluteDate(vote.created_at)} · {relativeTime(vote.created_at)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/topic/${topicId}/voters`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
        >
          <Vote className="h-3.5 w-3.5" />
          See all voters
        </Link>
        <span className="text-surface-600">·</span>
        <Link
          href={`/topic/${topicId}/reasons`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Why people voted
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Argument card ─────────────────────────────────────────────────────────────

function ArgumentCard({ arg, index }: { arg: JourneyArgument; index: number }) {
  const isFor = arg.side === 'blue'
  const grade = scoreLabel(arg.ai_score)
  const gradeConfig = grade ? AI_SCORE_CONFIG[grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-4"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0 mt-0.5',
            isFor ? 'bg-for-500/15 border border-for-500/30' : 'bg-against-500/15 border border-against-500/30'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={cn('text-[10px] font-mono font-semibold', isFor ? 'text-for-400' : 'text-against-400')}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {gradeConfig && grade && (
              <span className={cn('text-[10px] font-mono font-bold', gradeConfig.color)}>
                AI: {gradeConfig.label}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-500 ml-auto">
              {relativeTime(arg.created_at)}
            </span>
          </div>
          <p className="text-sm text-surface-700 leading-relaxed">
            {truncate(arg.content, 200)}
          </p>
          <div className="flex items-center gap-3 mt-2.5">
            <span className="inline-flex items-center gap-1 text-xs font-mono text-gold">
              <ThumbsUp className="h-3 w-3" />
              {arg.upvotes.toLocaleString()} upvote{arg.upvotes !== 1 ? 's' : ''}
            </span>
            {arg.reply_count > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-surface-500">
                <MessageSquare className="h-3 w-3" />
                {arg.reply_count} repl{arg.reply_count !== 1 ? 'ies' : 'y'}
              </span>
            )}
            <Link
              href={`/arguments/${arg.id}`}
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-surface-400 hover:text-white transition-colors"
            >
              View <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Prediction card ──────────────────────────────────────────────────────────

function PredictionCard({ pred, index }: { pred: JourneyPrediction; index: number }) {
  const isResolved = pred.correct !== null
  const isCorrect = pred.correct === true

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'rounded-2xl border p-4',
        isResolved
          ? isCorrect
            ? 'bg-emerald/5 border-emerald/25'
            : 'bg-against-500/5 border-against-500/25'
          : 'bg-purple/5 border-purple/25'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0 mt-0.5',
            isResolved
              ? isCorrect
                ? 'bg-emerald/15 border border-emerald/30'
                : 'bg-against-500/15 border border-against-500/30'
              : 'bg-purple/15 border border-purple/30'
          )}
        >
          {isResolved ? (
            isCorrect ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-against-400" />
            )
          ) : (
            <Target className="h-3.5 w-3.5 text-purple" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono font-semibold text-white">
              Predicted: {pred.predicted_law ? 'Becomes LAW' : 'Fails'}
            </span>
            <span className="text-[10px] font-mono text-surface-500">
              {Math.round(pred.confidence * 100)}% confidence
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isResolved ? (
              <>
                <span
                  className={cn(
                    'text-xs font-mono font-semibold',
                    isCorrect ? 'text-emerald' : 'text-against-400'
                  )}
                >
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </span>
                {pred.clout_earned !== null && pred.clout_earned > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gold">
                    <Coins className="h-3 w-3" />
                    +{pred.clout_earned} Clout
                  </span>
                )}
                {pred.resolved_at && (
                  <span className="text-[10px] font-mono text-surface-500">
                    Resolved {relativeTime(pred.resolved_at)}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[10px] font-mono text-purple">Awaiting resolution</span>
            )}
            <span className="text-[10px] font-mono text-surface-500 ml-auto">
              {relativeTime(pred.created_at)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function JourneyClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<JourneyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/journey`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as JourneyResponse
      setData(json)
    } catch {
      setError('Could not load your civic journey.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const topic = data?.topic
  const status = topic ? (STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-500' }) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        {/* Back link + breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          {topic ? (
            <Link
              href={`/topic/${topicId}`}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to topic
            </Link>
          ) : (
            <Skeleton className="h-4 w-28" />
          )}
        </div>

        {/* Header */}
        <div className="mb-6">
          {topic ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
                  <Flame className="h-4.5 w-4.5 text-for-400" />
                </div>
                <div>
                  <h1 className="font-mono text-xl font-bold text-white leading-tight">
                    My Civic Journey
                  </h1>
                  <p className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', status?.color)}>
                    {status?.label}
                    {topic.category && (
                      <span className="text-surface-500 font-normal normal-case tracking-normal ml-1.5">
                        · {topic.category}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <p className="text-sm text-surface-600 leading-relaxed">
                {topic.statement}
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
        </div>

        {/* Loading state */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" exit={{ opacity: 0 }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-36 rounded-2xl" />
              <Skeleton className="h-32 rounded-2xl" />
            </motion.div>
          )}

          {/* Error state */}
          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center"
            >
              <p className="text-sm text-surface-500 mb-4">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </motion.div>
          )}

          {/* Not authenticated */}
          {!loading && data?.notAuthenticated && (
            <motion.div
              key="unauth"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-for-500/10 border border-for-500/25 flex items-center justify-center">
                  <LogIn className="h-6 w-6 text-for-400" />
                </div>
              </div>
              <h2 className="font-mono text-lg font-bold text-white mb-2">Sign in to see your journey</h2>
              <p className="text-sm text-surface-500 mb-6">
                Track your vote, arguments, and predictions on this debate.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </Link>
                <Link
                  href={`/topic/${topicId}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
                >
                  View debate
                </Link>
              </div>
            </motion.div>
          )}

          {/* Loaded — no interactions yet */}
          {!loading && data && !data.notAuthenticated && data.stats.totalInteractions === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <EmptyState
                icon={Vote}
                title="You haven't engaged with this debate yet"
                description="Vote FOR or AGAINST, write an argument, or make a prediction to start your civic journey."
                action={{
                  label: 'Go to debate',
                  href: `/topic/${topicId}`,
                }}
              />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Link
                  href={`/topic/${topicId}`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-for-500/25 bg-for-500/5 p-4 hover:bg-for-500/10 transition-colors"
                >
                  <ThumbsUp className="h-5 w-5 text-for-400" />
                  <span className="text-xs font-mono text-for-300">Vote</span>
                </Link>
                <Link
                  href={`/topic/${topicId}/arguments`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-purple/25 bg-purple/5 p-4 hover:bg-purple/10 transition-colors"
                >
                  <MessageSquare className="h-5 w-5 text-purple" />
                  <span className="text-xs font-mono text-purple">Argue</span>
                </Link>
                <Link
                  href={`/topic/${topicId}/predictions`}
                  className="flex flex-col items-center gap-2 rounded-xl border border-gold/25 bg-gold/5 p-4 hover:bg-gold/10 transition-colors"
                >
                  <Target className="h-5 w-5 text-gold" />
                  <span className="text-xs font-mono text-gold">Predict</span>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Loaded — has interactions */}
          {!loading && data && !data.notAuthenticated && data.stats.totalInteractions > 0 && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Stat grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Interactions"
                  value={data.stats.totalInteractions}
                  icon={Zap}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10 border border-for-500/25"
                />
                <StatCard
                  label="Upvotes earned"
                  value={data.stats.totalUpvotesReceived}
                  icon={Trophy}
                  iconColor="text-gold"
                  iconBg="bg-gold/10 border border-gold/25"
                />
                <StatCard
                  label="Arguments"
                  value={data.myArguments.length}
                  icon={MessageSquare}
                  iconColor="text-purple"
                  iconBg="bg-purple/10 border border-purple/25"
                />
                <StatCard
                  label="Days engaged"
                  value={data.stats.daysSinceFirst === 0 ? 'Today' : `${data.stats.daysSinceFirst}d`}
                  icon={Calendar}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10 border border-emerald/25"
                />
              </div>

              {/* Since date banner */}
              {data.stats.firstInteractionAt && (
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 px-1">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  You first engaged with this debate on{' '}
                  <span className="text-white">{absoluteDate(data.stats.firstInteractionAt)}</span>
                </div>
              )}

              {/* ── My Vote ── */}
              {data.myVote && (
                <section>
                  <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Vote className="h-3.5 w-3.5" />
                    My Vote
                  </h2>
                  <VoteCard vote={data.myVote} topicId={topicId} />
                </section>
              )}

              {/* ── My Arguments ── */}
              {data.myArguments.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5" />
                      My Arguments ({data.myArguments.length})
                    </h2>
                    <Link
                      href={`/topic/${topicId}/arguments`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
                    >
                      All arguments <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {data.myArguments.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} index={i} />
                    ))}
                  </div>

                  {/* Total upvote callout */}
                  {data.stats.totalUpvotesReceived > 0 && (
                    <div className="mt-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 flex items-center gap-3">
                      <Award className="h-5 w-5 text-gold flex-shrink-0" />
                      <p className="text-sm font-mono text-gold">
                        Your arguments on this topic have earned{' '}
                        <span className="font-bold">
                          {data.stats.totalUpvotesReceived.toLocaleString()} upvote
                          {data.stats.totalUpvotesReceived !== 1 ? 's' : ''}
                        </span>{' '}
                        total.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* ── My Predictions ── */}
              {data.myPredictions.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5" />
                      My Predictions ({data.myPredictions.length})
                    </h2>
                    <Link
                      href={`/topic/${topicId}/predictions`}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-purple hover:text-purple/80 transition-colors"
                    >
                      View market <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {data.myPredictions.map((pred, i) => (
                      <PredictionCard key={pred.id} pred={pred} index={i} />
                    ))}
                  </div>

                  {/* Prediction accuracy summary */}
                  {(() => {
                    const resolved = data.myPredictions.filter((p) => p.correct !== null)
                    const correct = resolved.filter((p) => p.correct === true)
                    if (resolved.length === 0) return null
                    const accuracy = Math.round((correct.length / resolved.length) * 100)
                    const totalClout = data.myPredictions.reduce(
                      (s, p) => s + (p.clout_earned ?? 0),
                      0
                    )
                    return (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-purple/25 bg-purple/5 px-4 py-3">
                          <p className="font-mono text-2xl font-bold text-purple">{accuracy}%</p>
                          <p className="text-[10px] font-mono text-surface-500 mt-0.5">Prediction accuracy</p>
                        </div>
                        {totalClout > 0 && (
                          <div className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-3">
                            <p className="font-mono text-2xl font-bold text-gold">+{totalClout}</p>
                            <p className="text-[10px] font-mono text-surface-500 mt-0.5">Clout earned</p>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </section>
              )}

              {/* ── CTAs for missing engagement ── */}
              {(!data.myVote || data.myArguments.length === 0 || data.myPredictions.length === 0) && (
                <section>
                  <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Gavel className="h-3.5 w-3.5" />
                    Keep engaging
                  </h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {!data.myVote && (
                      <Link
                        href={`/topic/${topicId}`}
                        className="flex items-center gap-3 rounded-xl border border-for-500/25 bg-for-500/5 px-4 py-3 hover:bg-for-500/10 transition-colors group"
                      >
                        <ThumbsUp className="h-4 w-4 text-for-400 flex-shrink-0" />
                        <span className="text-sm font-mono text-for-300 group-hover:text-for-200">Cast your vote</span>
                        <ChevronRight className="h-3.5 w-3.5 text-for-500 ml-auto group-hover:text-for-400" />
                      </Link>
                    )}
                    {data.myArguments.length === 0 && (
                      <Link
                        href={`/topic/${topicId}/arguments`}
                        className="flex items-center gap-3 rounded-xl border border-purple/25 bg-purple/5 px-4 py-3 hover:bg-purple/10 transition-colors group"
                      >
                        <MessageSquare className="h-4 w-4 text-purple flex-shrink-0" />
                        <span className="text-sm font-mono text-purple group-hover:text-purple/80">Write an argument</span>
                        <ChevronRight className="h-3.5 w-3.5 text-purple/50 ml-auto group-hover:text-purple/80" />
                      </Link>
                    )}
                    {data.myPredictions.length === 0 && (
                      <Link
                        href={`/topic/${topicId}/predictions`}
                        className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 hover:bg-gold/10 transition-colors group"
                      >
                        <Target className="h-4 w-4 text-gold flex-shrink-0" />
                        <span className="text-sm font-mono text-gold group-hover:text-gold/80">Make a prediction</span>
                        <ChevronRight className="h-3.5 w-3.5 text-gold/50 ml-auto group-hover:text-gold/80" />
                      </Link>
                    )}
                  </div>
                </section>
              )}

              {/* ── Topic at a glance ── */}
              <section className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <h2 className="font-mono text-xs font-bold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Scale className="h-3.5 w-3.5" />
                  Topic at a glance
                </h2>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-for-300">
                    {Math.round(topic?.blue_pct ?? 50)}% FOR
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-surface-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-for-600 to-for-400 transition-all"
                      style={{ width: `${Math.round(topic?.blue_pct ?? 50)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-against-300">
                    {100 - Math.round(topic?.blue_pct ?? 50)}% AGAINST
                  </span>
                </div>
                <p className="text-[10px] font-mono text-surface-500">
                  {(topic?.total_votes ?? 0).toLocaleString()} total votes
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <Link
                    href={`/topic/${topicId}`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    View full debate <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href={`/topic/${topicId}/timeline`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    Vote timeline
                  </Link>
                </div>
              </section>

              {/* Refresh */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
