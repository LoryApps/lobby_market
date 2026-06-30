'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  Reply,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ThreadsData, ArgumentThread, ThreadReply } from '@/app/api/topics/[id]/threads/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function activityLabel(score: number): { label: string; color: string } {
  if (score >= 15) return { label: 'Raging', color: 'text-against-400' }
  if (score >= 7) return { label: 'Hot', color: 'text-gold' }
  if (score >= 2) return { label: 'Active', color: 'text-emerald' }
  return { label: 'Quiet', color: 'text-surface-500' }
}

// ─── Reply row ────────────────────────────────────────────────────────────────

function ReplyRow({ reply }: { reply: ThreadReply }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-2.5 pl-4 border-l-2 border-surface-400/40"
    >
      <Avatar
        src={reply.author?.avatar_url ?? null}
        fallback={reply.author?.display_name || reply.author?.username || '?'}
        size="xs"
        className="flex-shrink-0 mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          {reply.author ? (
            <Link
              href={`/profile/${reply.author.username}`}
              className="text-[11px] font-semibold text-surface-700 hover:text-white transition-colors"
            >
              {reply.author.display_name || reply.author.username}
            </Link>
          ) : (
            <span className="text-[11px] text-surface-500">Anonymous</span>
          )}
          <span className="text-[10px] font-mono text-surface-600">{reltime(reply.created_at)}</span>
        </div>
        <p className="text-[12px] text-surface-700 leading-relaxed">{reply.content}</p>
      </div>
    </motion.div>
  )
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({
  thread,
  topicId,
}: {
  thread: ArgumentThread
  topicId: string
}) {
  const [expanded, setExpanded] = useState(false)
  const { label: actLabel, color: actColor } = activityLabel(thread.activity_score)

  const visibleReplies = expanded ? thread.top_replies : thread.top_replies.slice(0, 2)
  const hasMore = thread.top_replies.length > 2 && !expanded

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-4 space-y-3 transition-colors',
        thread.side === 'blue'
          ? 'border-for-500/25 hover:border-for-500/40'
          : 'border-against-500/25 hover:border-against-500/40'
      )}
    >
      {/* Argument header */}
      <div className="flex items-start gap-2.5">
        <Avatar
          src={thread.author?.avatar_url ?? null}
          fallback={thread.author?.display_name || thread.author?.username || '?'}
          size="sm"
          className="flex-shrink-0 mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {thread.author ? (
              <Link
                href={`/profile/${thread.author.username}`}
                className="text-[12px] font-semibold text-surface-700 hover:text-white transition-colors"
              >
                {thread.author.display_name || thread.author.username}
              </Link>
            ) : (
              <span className="text-[12px] text-surface-500">Anonymous</span>
            )}
            <Badge
              variant={thread.side === 'blue' ? 'for' : 'against'}
              size="sm"
            >
              {thread.side === 'blue' ? 'FOR' : 'AGAINST'}
            </Badge>
            <span className={cn('text-[10px] font-mono font-semibold', actColor)}>
              {actLabel}
            </span>
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {reltime(thread.created_at)}
            </span>
          </div>
          <p className="text-sm text-surface-800 leading-relaxed">{thread.content}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-[11px] font-mono text-surface-600 pt-0.5">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          {thread.upvotes.toLocaleString()} upvote{thread.upvotes !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" aria-hidden="true" />
          {thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}
        </span>
        {thread.latest_reply_at && (
          <span className="text-surface-500">
            last reply {reltime(thread.latest_reply_at)}
          </span>
        )}
      </div>

      {/* Reply previews */}
      {visibleReplies.length > 0 && (
        <div className="space-y-2.5 mt-1">
          <AnimatePresence mode="popLayout">
            {visibleReplies.map((reply) => (
              <ReplyRow key={reply.id} reply={reply} />
            ))}
          </AnimatePresence>

          {thread.reply_count > thread.top_replies.length && (
            <p className="pl-4 text-[11px] font-mono text-surface-500">
              +{thread.reply_count - thread.top_replies.length} more
              {' '}— <Link
                href={`/topic/${topicId}/argue`}
                className="text-for-400 hover:text-for-300 transition-colors"
              >
                join thread
              </Link>
            </p>
          )}

          {hasMore && (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 pl-4 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              aria-label="Show more replies"
            >
              <ChevronDown className="h-3 w-3" />
              Show {thread.top_replies.length - 2} more preview{thread.top_replies.length - 2 !== 1 ? 's' : ''}
            </button>
          )}

          {expanded && thread.top_replies.length > 2 && (
            <button
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 pl-4 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              aria-label="Collapse replies"
            >
              <ChevronUp className="h-3 w-3" />
              Collapse
            </button>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="pt-1 flex">
        <Link
          href={`/topic/${topicId}/argue`}
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-mono font-semibold px-3 py-1.5 rounded-lg transition-colors',
            thread.side === 'blue'
              ? 'text-for-400 bg-for-500/10 hover:bg-for-500/20 border border-for-500/20'
              : 'text-against-400 bg-against-500/10 hover:bg-against-500/20 border border-against-500/20'
          )}
        >
          <Reply className="h-3 w-3" aria-hidden="true" />
          Join thread
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Sort / side filter bar ───────────────────────────────────────────────────

type Sort = 'most_active' | 'most_replies' | 'newest'
type Side = '' | 'for' | 'against'

const SORTS: { value: Sort; label: string; icon: typeof TrendingUp }[] = [
  { value: 'most_active', label: 'Most Active', icon: Zap },
  { value: 'most_replies', label: 'Most Replies', icon: MessageSquare },
  { value: 'newest', label: 'Newest', icon: TrendingUp },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function ThreadsClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<ThreadsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<Sort>('most_active')
  const [side, setSide] = useState<Side>('')
  const [refreshing, setRefreshing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (isRefresh = false) => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({ sort, limit: '25' })
        if (side) params.set('side', side)

        const res = await fetch(`/api/topics/${topicId}/threads?${params}`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ThreadsData
        setData(json)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError('Failed to load threads.')
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [topicId, sort, side]
  )

  useEffect(() => {
    load()
  }, [load])

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = data?.stats
  const topic = data?.topic
  const threads = data?.threads ?? []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-400 transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4 text-surface-700" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-for-400" aria-hidden="true" />
              Active Threads
            </h1>
            {topic && (
              <p className="text-sm font-mono text-surface-500 mt-0.5 line-clamp-1">
                {topic.statement}
              </p>
            )}
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="ml-auto flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-400 transition-colors disabled:opacity-40"
            aria-label="Refresh threads"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-700', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* Stats row */}
        {!loading && stats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Active Threads</p>
              <p className="font-mono text-xl font-bold text-white">{stats.active_threads}</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Total Replies</p>
              <p className="font-mono text-xl font-bold text-white">{stats.total_replies.toLocaleString()}</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Arguments</p>
              <p className="font-mono text-xl font-bold text-white">{stats.total_arguments.toLocaleString()}</p>
            </div>
          </motion.div>
        )}

        {/* Sort + side controls */}
        <div className="flex flex-wrap gap-2 mb-5">
          {SORTS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors border',
                sort === value
                  ? 'bg-for-500/15 text-for-300 border-for-500/30'
                  : 'bg-surface-100 text-surface-500 border-surface-400 hover:text-white hover:border-surface-300'
              )}
              aria-pressed={sort === value}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {label}
            </button>
          ))}

          <div className="ml-auto flex gap-1.5">
            {([['', 'All'], ['for', 'FOR'], ['against', 'AGAINST']] as [Side, string][]).map(
              ([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setSide(val)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors border',
                    side === val
                      ? val === 'for'
                        ? 'bg-for-500/15 text-for-300 border-for-500/30'
                        : val === 'against'
                        ? 'bg-against-500/15 text-against-300 border-against-500/30'
                        : 'bg-surface-200 text-white border-surface-400'
                      : 'bg-surface-100 text-surface-500 border-surface-400 hover:text-white hover:border-surface-300'
                  )}
                  aria-pressed={side === val}
                >
                  {lbl}
                </button>
              )
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="space-y-2 pl-4 border-l-2 border-surface-400/40">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-6 text-center">
            <p className="font-mono text-sm text-surface-500 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="text-[12px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-8 w-8 text-surface-600" />}
            title="No active threads yet"
            description={
              side
                ? `No ${side === 'for' ? 'FOR' : 'AGAINST'} arguments have replies yet. Start the conversation.`
                : 'No arguments have replies yet. Post the first argument and start a thread.'
            }
            action={
              <Link
                href={`/topic/${topicId}/argue`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-500/10 text-for-300 border border-for-500/20 text-sm font-mono font-semibold hover:bg-for-500/20 transition-colors"
              >
                <Reply className="h-3.5 w-3.5" />
                Post an argument
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} topicId={topicId} />
            ))}

            {/* Footer info */}
            <div className="pt-2 text-center">
              <p className="text-[11px] font-mono text-surface-600">
                Showing {threads.length} of {stats?.active_threads ?? threads.length} active thread{(stats?.active_threads ?? 1) !== 1 ? 's' : ''}
              </p>
              <Link
                href={`/topic/${topicId}/argue`}
                className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg bg-surface-100 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Post your argument
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
