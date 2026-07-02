'use client'

/**
 * /topic/[id]/cross-examine — The Cross-Examination Room
 *
 * Puts the top FOR and AGAINST arguments side-by-side, each showing
 * the best rebuttals already posted beneath it.  Helps users:
 *  - Identify the strongest and most-challenged claims on each side
 *  - Understand WHY each position is contested
 *  - Navigate directly to the full argument thread for any exchange
 *
 * Distinct from:
 *   /arguments   — full list of all arguments
 *   /faceoff     — head-to-head voting on two specific arguments
 *   /crossfire   — most heated exchanges by reply count
 *   /versus      — top FOR vs top AGAINST in head-to-head layout
 *   /steelman    — strongest charitable version of each side
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CrossExamineResponse,
  CrossExamineArgument,
  CrossExamineReply,
} from '@/app/api/topics/[id]/cross-examine/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function gradeColor(grade: string | null): string {
  switch (grade) {
    case 'A': return 'text-emerald'
    case 'B': return 'text-for-400'
    case 'C': return 'text-gold'
    case 'D': return 'text-orange-400'
    case 'F': return 'text-against-400'
    default:  return 'text-surface-500'
  }
}

// ─── Reply card ───────────────────────────────────────────────────────────────

function ReplyCard({ reply, argSide }: { reply: CrossExamineReply; argSide: 'blue' | 'red' }) {
  // A reply to a FOR argument is likely AGAINST (and vice versa)
  const replyColor = argSide === 'blue' ? 'border-against-500/20 bg-against-600/5' : 'border-for-500/20 bg-for-600/5'
  const replyTextColor = argSide === 'blue' ? 'text-against-300' : 'text-for-300'

  return (
    <motion.div
      initial={{ opacity: 0, x: argSide === 'blue' ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'rounded-lg border px-3 py-2.5 text-xs space-y-1.5',
        replyColor,
      )}
    >
      <div className="flex items-center gap-1.5">
        {reply.author ? (
          <Link
            href={`/profile/${reply.author.username}`}
            className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={reply.author.avatar_url}
              fallback={reply.author.display_name || reply.author.username}
              size="xs"
            />
            <span className={cn('font-mono font-semibold', replyTextColor)}>
              @{reply.author.username}
            </span>
          </Link>
        ) : (
          <span className="text-surface-500 font-mono">Anonymous</span>
        )}
        <span className="text-surface-600 ml-auto">{relativeTime(reply.created_at)}</span>
      </div>
      <p className="text-surface-400 leading-relaxed">{reply.content}</p>
    </motion.div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  topicId,
  rank,
}: {
  arg: CrossExamineArgument
  topicId: string
  rank: number
}) {
  const isFor = arg.side === 'blue'
  const borderColor = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const headerBg = isFor ? 'bg-for-600/10' : 'bg-against-600/10'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const sideLabelClass = isFor ? 'text-for-300 bg-for-600/20' : 'text-against-300 bg-against-600/20'
  const rankColor = isFor ? 'text-for-400' : 'text-against-400'
  const arrowIcon = isFor ? ThumbsUp : ThumbsDown

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.08 }}
      className={cn(
        'rounded-xl border bg-surface-100 overflow-hidden',
        borderColor,
      )}
    >
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center gap-2.5', headerBg)}>
        <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full', sideLabelClass)}>
          {sideLabel}
        </span>
        <span className={cn('text-[10px] font-mono font-bold ml-auto', rankColor)}>
          #{rank + 1}
        </span>
        <div className="flex items-center gap-1 text-surface-500">
          {(() => { const Icon = arrowIcon; return <Icon className="h-3.5 w-3.5" /> })()}
          <span className="text-[11px] font-mono font-semibold">{arg.upvotes}</span>
        </div>
        {arg.ai_grade && (
          <span className={cn('text-[11px] font-mono font-bold', gradeColor(arg.ai_grade))}>
            {arg.ai_grade}
          </span>
        )}
      </div>

      {/* Argument content */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-sm text-surface-700 leading-relaxed">{arg.content}</p>

        {/* Author */}
        {arg.author && (
          <div className="flex items-center gap-2">
            <Link
              href={`/profile/${arg.author.username}`}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={arg.author.avatar_url}
                fallback={arg.author.display_name || arg.author.username}
                size="xs"
              />
              <span className="text-[11px] font-mono text-surface-500">
                @{arg.author.username}
              </span>
            </Link>
            <span className="text-[11px] font-mono text-surface-600 ml-auto">
              {relativeTime(arg.created_at)}
            </span>
          </div>
        )}

        {/* Rebuttals section */}
        {arg.replies.length > 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider">
              <MessageSquare className="h-3 w-3" />
              {arg.reply_count === 1 ? '1 rebuttal' : `${arg.reply_count} rebuttals`}
              {arg.reply_count > 3 && (
                <span className="text-surface-600">· showing top 3</span>
              )}
            </div>
            <div className="space-y-2">
              {arg.replies.map((reply) => (
                <ReplyCard key={reply.id} reply={reply} argSide={arg.side} />
              ))}
            </div>
          </div>
        )}

        {arg.replies.length === 0 && (
          <p className="text-[11px] font-mono text-surface-600 italic">
            No rebuttals yet — this argument stands unchallenged.
          </p>
        )}

        {/* Link to full thread */}
        <Link
          href={`/topic/${topicId}/arguments`}
          className={cn(
            'inline-flex items-center gap-1 text-[11px] font-mono transition-colors',
            isFor ? 'text-for-500 hover:text-for-400' : 'text-against-500 hover:text-against-400',
          )}
        >
          <ExternalLink className="h-3 w-3" />
          View full thread
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArgumentCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="px-4 py-3 bg-surface-200/40 flex items-center gap-2">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-3 w-8 ml-auto" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="px-4 py-3 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CrossExamineClient({ topicId }: { topicId: string }) {
  const params = useParams()
  const id = (params?.id as string | undefined) ?? topicId

  const [data, setData] = useState<CrossExamineResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'split' | 'for' | 'against'>('split')

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/topics/${encodeURIComponent(id)}/cross-examine`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error('Failed to load')
        const json = (await res.json()) as CrossExamineResponse
        setData(json)
      } catch {
        setError('Could not load cross-examination data.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [id]
  )

  useEffect(() => {
    load()
  }, [load])

  const forPct = data ? Math.round(data.topic.blue_pct) : 50
  const againstPct = 100 - forPct
  const totalArgs = (data?.total_for ?? 0) + (data?.total_against ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Back link */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald/10 border border-emerald/20 flex-shrink-0">
                <Scale className="h-4.5 w-4.5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white">Cross-Examination</h1>
                <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                  Top arguments · each side · with their best rebuttals
                </p>
              </div>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing || loading}
              aria-label="Refresh"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Topic statement */}
          {data && (
            <div className="rounded-xl border border-surface-300 bg-surface-100/60 p-4 space-y-3">
              <p className="text-sm font-medium text-white leading-relaxed">
                {data.topic.statement}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {data.topic.category && (
                  <Badge variant="outline" size="sm" className="text-[10px]">
                    {data.topic.category}
                  </Badge>
                )}
                <div className="flex items-center gap-4 ml-auto">
                  <span className="text-xs font-mono text-for-400">
                    {forPct}% FOR
                  </span>
                  <span className="text-xs font-mono text-against-400">
                    {againstPct}% AGAINST
                  </span>
                  <span className="text-xs font-mono text-surface-500">
                    {totalArgs} argument{totalArgs !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
              {/* Vote bar */}
              <div className="h-1.5 rounded-full bg-against-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-for-500 transition-all duration-700"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Context blurb */}
        <div className="mb-6 rounded-xl border border-surface-300 bg-surface-100/40 p-4">
          <p className="text-xs text-surface-500 leading-relaxed">
            <span className="text-white font-semibold">How this works:</span>{' '}
            The strongest arguments on each side are ranked by community upvotes. Beneath each
            argument you see the best replies already posted — the strongest counterpoints the
            community has surfaced. An argument with no rebuttals stands unchallenged. Click
            &ldquo;View full thread&rdquo; to join the conversation.
          </p>
        </div>

        {/* View tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl bg-surface-200 w-fit">
          {[
            { id: 'split' as const, label: 'Split View', icon: Scale },
            { id: 'for' as const, label: 'FOR', icon: Shield },
            { id: 'against' as const, label: 'AGAINST', icon: Swords },
          ].map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setActiveTab(tabId)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                activeTab === tabId
                  ? tabId === 'for'
                    ? 'bg-for-600/30 text-for-300 border border-for-500/30'
                    : tabId === 'against'
                    ? 'bg-against-600/30 text-against-300 border border-against-500/30'
                    : 'bg-surface-100 text-white border border-surface-300'
                  : 'text-surface-500 hover:text-surface-400',
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div
            className={cn(
              'gap-5',
              activeTab === 'split'
                ? 'grid grid-cols-1 md:grid-cols-2'
                : 'max-w-xl mx-auto space-y-4',
            )}
          >
            {activeTab === 'split' ? (
              <>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                  {[0, 1, 2].map((i) => <ArgumentCardSkeleton key={i} />)}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                  {[0, 1, 2].map((i) => <ArgumentCardSkeleton key={i} />)}
                </div>
              </>
            ) : (
              [0, 1, 2].map((i) => <ArgumentCardSkeleton key={i} />)
            )}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-xl border border-against-500/30 bg-against-600/10 p-5 text-center">
            <p className="text-sm text-against-300 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* No data */}
        {!loading && !error && data && data.for_arguments.length === 0 && data.against_arguments.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No arguments yet"
            description="Be the first to make a case on this topic. Arguments will appear here for cross-examination once posted."
            action={{ label: 'Post an Argument', href: `/topic/${id}/argue` }}
          />
        )}

        {/* Content */}
        {!loading && !error && data && (data.for_arguments.length > 0 || data.against_arguments.length > 0) && (
          <AnimatePresence mode="wait">
            {activeTab === 'split' ? (
              <motion.div
                key="split"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-5"
              >
                {/* FOR column */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-for-400" />
                      <span className="text-xs font-mono font-bold text-for-300">FOR</span>
                    </div>
                    <span className="text-[10px] font-mono text-surface-600">
                      {data.total_for} argument{data.total_for !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <ThumbsUp className="h-3 w-3 text-for-500" />
                      <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
                    </div>
                  </div>
                  {data.for_arguments.length === 0 ? (
                    <p className="text-xs font-mono text-surface-600 italic text-center py-8">
                      No FOR arguments posted yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {data.for_arguments.map((arg, i) => (
                        <ArgumentCard key={arg.id} arg={arg} topicId={id} rank={i} />
                      ))}
                    </div>
                  )}
                </div>

                {/* AGAINST column */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5 text-against-400" />
                      <span className="text-xs font-mono font-bold text-against-300">AGAINST</span>
                    </div>
                    <span className="text-[10px] font-mono text-surface-600">
                      {data.total_against} argument{data.total_against !== 1 ? 's' : ''}
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <ThumbsDown className="h-3 w-3 text-against-500" />
                      <span className="text-[10px] font-mono text-against-400">{againstPct}%</span>
                    </div>
                  </div>
                  {data.against_arguments.length === 0 ? (
                    <p className="text-xs font-mono text-surface-600 italic text-center py-8">
                      No AGAINST arguments posted yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {data.against_arguments.map((arg, i) => (
                        <ArgumentCard key={arg.id} arg={arg} topicId={id} rank={i} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : activeTab === 'for' ? (
              <motion.div
                key="for"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-2xl mx-auto space-y-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-for-400" />
                  <span className="text-sm font-mono font-bold text-for-300">FOR Arguments</span>
                  <span className="text-xs font-mono text-surface-500 ml-auto">
                    {data.total_for} total · showing top {data.for_arguments.length}
                  </span>
                </div>
                {data.for_arguments.length === 0 ? (
                  <EmptyState
                    icon={Shield}
                    title="No FOR arguments"
                    description="No one has argued for this position yet."
                    action={{ label: 'Be the first', href: `/topic/${id}/argue` }}
                  />
                ) : (
                  data.for_arguments.map((arg, i) => (
                    <ArgumentCard key={arg.id} arg={arg} topicId={id} rank={i} />
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div
                key="against"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="max-w-2xl mx-auto space-y-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Swords className="h-4 w-4 text-against-400" />
                  <span className="text-sm font-mono font-bold text-against-300">AGAINST Arguments</span>
                  <span className="text-xs font-mono text-surface-500 ml-auto">
                    {data.total_against} total · showing top {data.against_arguments.length}
                  </span>
                </div>
                {data.against_arguments.length === 0 ? (
                  <EmptyState
                    icon={Swords}
                    title="No AGAINST arguments"
                    description="No one has challenged this position yet."
                    action={{ label: 'Challenge it', href: `/topic/${id}/argue` }}
                  />
                ) : (
                  data.against_arguments.map((arg, i) => (
                    <ArgumentCard key={arg.id} arg={arg} topicId={id} rank={i} />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Insight footer */}
        {!loading && data && totalArgs > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 rounded-xl border border-surface-300 bg-surface-100/40 p-4 space-y-3"
          >
            <h3 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider">
              Debate Health
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-for-300">{data.total_for}</p>
                <p className="text-[10px] font-mono text-surface-600">FOR args</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-against-300">{data.total_against}</p>
                <p className="text-[10px] font-mono text-surface-600">AGAINST args</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-purple">
                  {data.for_arguments.reduce((s, a) => s + a.reply_count, 0) +
                    data.against_arguments.reduce((s, a) => s + a.reply_count, 0)}
                </p>
                <p className="text-[10px] font-mono text-surface-600">total rebuttals</p>
              </div>
              <div className="text-center">
                {(() => {
                  const allArgs = [...data.for_arguments, ...data.against_arguments]
                  const withRebuttals = allArgs.filter((a) => a.reply_count > 0).length
                  const challenged = allArgs.length > 0 ? Math.round((withRebuttals / allArgs.length) * 100) : 0
                  return (
                    <>
                      <p className="text-lg font-mono font-bold text-gold">{challenged}%</p>
                      <p className="text-[10px] font-mono text-surface-600">args challenged</p>
                    </>
                  )
                })()}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/topic/${id}/arguments`}
                className="inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
                All arguments
              </Link>
              <Link
                href={`/topic/${id}/crossfire`}
                className="inline-flex items-center gap-1 text-xs font-mono text-against-400 hover:text-against-300 transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
                Crossfire
              </Link>
              <Link
                href={`/topic/${id}/versus`}
                className="inline-flex items-center gap-1 text-xs font-mono text-purple hover:text-purple/80 transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
                Head-to-head
              </Link>
              <Link
                href={`/topic/${id}/steelman`}
                className="inline-flex items-center gap-1 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
              >
                <ChevronRight className="h-3 w-3" />
                Steelman
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
