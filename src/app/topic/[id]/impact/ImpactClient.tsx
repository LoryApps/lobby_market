'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicImpactData, ImpactArgument } from '@/app/api/topics/[id]/impact/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  B: { text: 'text-for-300', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  C: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  D: { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  F: { text: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/40' },
}

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F']

// ─── Impact bar ───────────────────────────────────────────────────────────────

function ImpactBar({
  score,
  maxScore,
  side,
}: {
  score: number
  maxScore: number
  side: 'for' | 'against'
}) {
  const pct = maxScore > 0 ? Math.min(100, (score / maxScore) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-200 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', side === 'for' ? 'bg-for-500' : 'bg-against-500')}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-500 w-8 text-right">{score}</span>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentImpactCard({
  arg,
  maxScore,
  rank,
}: {
  arg: ImpactArgument
  maxScore: number
  rank: number
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = arg.body.length > 140 ? arg.body.slice(0, 140) + '…' : arg.body
  const grade = arg.ai_grade
  const gradeStyle = grade ? GRADE_COLOR[grade] : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'rounded-xl border bg-surface-100 p-4 space-y-3',
        arg.side === 'for' ? 'border-for-500/20' : 'border-against-500/20',
      )}
    >
      {/* Rank + grade */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
              rank === 1
                ? 'bg-gold/20 text-gold'
                : rank === 2
                  ? 'bg-surface-300 text-surface-600'
                  : rank === 3
                    ? 'bg-against-500/20 text-against-400'
                    : 'bg-surface-200 text-surface-500',
            )}
          >
            {rank}
          </span>
          {gradeStyle && (
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                gradeStyle.text,
                gradeStyle.bg,
                gradeStyle.border,
              )}
            >
              {grade}
            </span>
          )}
        </div>
        <Link
          href={`/arguments/${arg.id}`}
          className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
        >
          View <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>

      {/* Body */}
      <p
        className={cn(
          'text-sm text-surface-700 leading-relaxed cursor-pointer',
          !expanded && 'line-clamp-2',
        )}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? arg.body : preview}
      </p>
      {arg.body.length > 140 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Read more
            </>
          )}
        </button>
      )}

      {/* Impact bar */}
      <ImpactBar score={arg.impact_score} maxScore={maxScore} side={arg.side} />

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-2.5 w-2.5" />
            {arg.upvotes}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-2.5 w-2.5" />
            {arg.reply_count}
          </span>
          {arg.citation_count > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen className="h-2.5 w-2.5" />
              {arg.citation_count}
            </span>
          )}
        </div>
        {arg.author && (
          <div className="flex items-center gap-1.5">
            <Avatar
              src={arg.author.avatar_url}
              username={arg.author.username}
              size="xs"
            />
            <Link
              href={`/profile/${arg.author.username}`}
              className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              {arg.author.display_name ?? arg.author.username}
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Grade distribution bar ───────────────────────────────────────────────────

function GradeDistribution({ dist, total }: { dist: Record<string, number>; total: number }) {
  if (total === 0 || Object.keys(dist).length === 0) return null

  return (
    <div className="space-y-1.5">
      {GRADE_ORDER.filter((g) => (dist[g] ?? 0) > 0).map((g) => {
        const count = dist[g] ?? 0
        const pct = Math.round((count / total) * 100)
        const style = GRADE_COLOR[g]
        return (
          <div key={g} className="flex items-center gap-3">
            <span className={cn('text-[10px] font-bold w-3 text-right', style.text)}>{g}</span>
            <div className="flex-1 h-2 rounded-full bg-surface-200 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', style.bg.replace('/10', '/60'))}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-mono text-surface-500 w-8 text-right">
              {count} <span className="text-surface-600">({pct}%)</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Side comparison card ─────────────────────────────────────────────────────

function SideComparisonBar({
  forScore,
  againstScore,
}: {
  forScore: number
  againstScore: number
}) {
  const total = forScore + againstScore
  if (total === 0) return null
  const forPct = Math.round((forScore / total) * 100)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden">
        <motion.div
          className="bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-against-500"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-for-400">FOR {forPct}%</span>
        <span className="text-against-400">AGAINST {againstPct}%</span>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
}

export function ImpactClient({ topicId }: Props) {
  const [data, setData] = useState<TopicImpactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/topics/${topicId}/impact`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json: TopicImpactData) => setData(json))
      .catch(() => setError('Failed to load impact data'))
      .finally(() => setLoading(false))
  }, [topicId])

  useEffect(() => { load() }, [load])

  const allForArgs = data?.top_for_args ?? []
  const allAgainstArgs = data?.top_against_args ?? []
  const maxForScore = allForArgs[0]?.impact_score ?? 1
  const maxAgainstScore = allAgainstArgs[0]?.impact_score ?? 1
  const maxScore = Math.max(maxForScore, maxAgainstScore, 1)

  const gradedCount = data
    ? Object.values(data.grade_distribution).reduce((a, b) => a + b, 0)
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        {/* Back nav */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
          <span className="text-surface-600 text-xs">/</span>
          <span className="text-xs font-mono text-surface-500">Argument Impact</span>
        </div>

        {/* Header */}
        <div className="mb-6 space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-bold text-white">Argument Impact</h1>
          </div>
          {data && (
            <p className="text-sm text-surface-500 leading-snug line-clamp-2">
              {data.topic_statement}
            </p>
          )}
          <p className="text-xs font-mono text-surface-600">
            Ranked by upvotes, AI quality score, and community engagement
          </p>
        </div>

        {loading && <LoadingSkeleton />}

        {error && (
          <div className="text-center py-12 text-surface-500 text-sm">{error}</div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="text-2xl font-bold text-white">
                  {data.total_arguments}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                  Arguments
                </div>
              </div>
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="text-2xl font-bold text-white">
                  {data.total_upvotes.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                  Upvotes
                </div>
              </div>
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                <div className="text-2xl font-bold text-white">
                  {data.total_replies.toLocaleString()}
                </div>
                <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                  Replies
                </div>
              </div>
            </div>

            {/* Winning side banner */}
            {data.total_arguments > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-xl border p-4 flex items-center gap-3',
                  data.winning_side === 'for'
                    ? 'border-for-500/40 bg-for-500/5'
                    : data.winning_side === 'against'
                      ? 'border-against-500/40 bg-against-500/5'
                      : 'border-surface-300 bg-surface-100',
                )}
              >
                <Trophy
                  className={cn(
                    'h-5 w-5 flex-shrink-0',
                    data.winning_side === 'for'
                      ? 'text-for-400'
                      : data.winning_side === 'against'
                        ? 'text-against-400'
                        : 'text-gold',
                  )}
                />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {data.winning_side === 'tie'
                      ? 'Evenly matched debate'
                      : data.winning_side === 'for'
                        ? 'FOR arguments dominate'
                        : 'AGAINST arguments dominate'}
                  </div>
                  <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                    {data.winning_side === 'tie'
                      ? 'Both sides have comparable argument impact'
                      : `Average impact margin: +${data.winning_margin} pts`}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Side comparison */}
            {data.total_arguments > 0 && (
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-semibold text-white">Side Comparison</h2>
                </div>

                <SideComparisonBar
                  forScore={data.for_stats.total_impact}
                  againstScore={data.against_stats.total_impact}
                />

                <div className="grid grid-cols-2 gap-4 text-[11px] font-mono">
                  <div className="space-y-1">
                    <div className="text-for-400 font-semibold mb-2">FOR</div>
                    <div className="flex justify-between">
                      <span className="text-surface-500">Arguments</span>
                      <span className="text-white">{data.for_stats.argument_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-500">Avg upvotes</span>
                      <span className="text-white">{data.for_stats.avg_upvotes}</span>
                    </div>
                    {data.for_stats.avg_ai_score != null && (
                      <div className="flex justify-between">
                        <span className="text-surface-500">Avg quality</span>
                        <span className="text-white">{data.for_stats.avg_ai_score}/10</span>
                      </div>
                    )}
                    {data.for_stats.top_grade && (
                      <div className="flex justify-between">
                        <span className="text-surface-500">Top grade</span>
                        <span className={GRADE_COLOR[data.for_stats.top_grade]?.text ?? 'text-white'}>
                          {data.for_stats.top_grade}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-surface-300 pt-1 mt-1">
                      <span className="text-surface-500">Avg impact</span>
                      <span className="text-for-400 font-bold">{data.for_stats.avg_impact}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-against-400 font-semibold mb-2">AGAINST</div>
                    <div className="flex justify-between">
                      <span className="text-surface-500">Arguments</span>
                      <span className="text-white">{data.against_stats.argument_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-500">Avg upvotes</span>
                      <span className="text-white">{data.against_stats.avg_upvotes}</span>
                    </div>
                    {data.against_stats.avg_ai_score != null && (
                      <div className="flex justify-between">
                        <span className="text-surface-500">Avg quality</span>
                        <span className="text-white">{data.against_stats.avg_ai_score}/10</span>
                      </div>
                    )}
                    {data.against_stats.top_grade && (
                      <div className="flex justify-between">
                        <span className="text-surface-500">Top grade</span>
                        <span className={GRADE_COLOR[data.against_stats.top_grade]?.text ?? 'text-white'}>
                          {data.against_stats.top_grade}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-surface-300 pt-1 mt-1">
                      <span className="text-surface-500">Avg impact</span>
                      <span className="text-against-400 font-bold">{data.against_stats.avg_impact}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Grade distribution */}
            {gradedCount > 0 && (
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Quality Distribution</h2>
                  <span className="text-[10px] font-mono text-surface-500 ml-auto">
                    {gradedCount} graded
                  </span>
                </div>
                <GradeDistribution dist={data.grade_distribution} total={gradedCount} />
              </div>
            )}

            {/* Arguments columns */}
            {data.total_arguments === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No arguments yet"
                description="Once the community posts arguments, their impact scores will appear here."
                action={
                  <Link
                    href={`/topic/${topicId}/argue`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-semibold hover:bg-for-500 transition-colors"
                  >
                    Write the first argument
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* FOR column */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-for-400" />
                    <h2 className="text-sm font-semibold text-for-300">
                      Top FOR Arguments
                    </h2>
                    <span className="text-[10px] font-mono text-surface-600 ml-auto">
                      {data.for_stats.argument_count} total
                    </span>
                  </div>
                  <AnimatePresence>
                    {allForArgs.length > 0 ? (
                      allForArgs.map((arg) => (
                        <ArgumentImpactCard
                          key={arg.id}
                          arg={arg}
                          maxScore={maxScore}
                          rank={arg.impact_rank}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-surface-300 bg-surface-100 p-6 text-center text-sm text-surface-500">
                        No FOR arguments yet
                      </div>
                    )}
                  </AnimatePresence>
                  {data.for_stats.argument_count > 5 && (
                    <Link
                      href={`/topic/${topicId}/arguments?side=for&sort=quality`}
                      className="flex items-center justify-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors py-2"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      View all {data.for_stats.argument_count} FOR arguments
                    </Link>
                  )}
                </div>

                {/* AGAINST column */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-against-400" />
                    <h2 className="text-sm font-semibold text-against-300">
                      Top AGAINST Arguments
                    </h2>
                    <span className="text-[10px] font-mono text-surface-600 ml-auto">
                      {data.against_stats.argument_count} total
                    </span>
                  </div>
                  <AnimatePresence>
                    {allAgainstArgs.length > 0 ? (
                      allAgainstArgs.map((arg) => (
                        <ArgumentImpactCard
                          key={arg.id}
                          arg={arg}
                          maxScore={maxScore}
                          rank={arg.impact_rank}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-surface-300 bg-surface-100 p-6 text-center text-sm text-surface-500">
                        No AGAINST arguments yet
                      </div>
                    )}
                  </AnimatePresence>
                  {data.against_stats.argument_count > 5 && (
                    <Link
                      href={`/topic/${topicId}/arguments?side=against&sort=quality`}
                      className="flex items-center justify-center gap-1.5 text-xs font-mono text-against-400 hover:text-against-300 transition-colors py-2"
                    >
                      <BarChart2 className="h-3.5 w-3.5" />
                      View all {data.against_stats.argument_count} AGAINST arguments
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Footer links */}
            <div className="flex flex-wrap gap-3 pt-2 border-t border-surface-300">
              <Link
                href={`/topic/${topicId}/quality`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Award className="h-3.5 w-3.5" />
                Quality report
              </Link>
              <Link
                href={`/topic/${topicId}/arguments`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                All arguments
              </Link>
              <Link
                href={`/topic/${topicId}/argument-graph`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                Argument graph
              </Link>
              <button
                onClick={load}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors ml-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
