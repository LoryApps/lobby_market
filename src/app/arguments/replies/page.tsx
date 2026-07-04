'use client'

/**
 * /arguments/replies — Replies to My Arguments
 *
 * Personal inbox: every reply someone posted to one of your arguments,
 * newest first. Shows the replier, the reply text, which argument they
 * responded to, and the topic it lives on.
 *
 * Distinct from:
 *   /arguments/discussions  — platform-wide most-discussed arguments
 *   /arguments/mine         — your full argument portfolio
 *   /notifications          — all notification types combined
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MyRepliesResponse, ReplyToMyArgument } from '@/app/api/arguments/my-replies/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReplySkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-12 flex-shrink-0" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="rounded-lg bg-surface-200/60 px-3 py-2 space-y-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// ─── Reply card ───────────────────────────────────────────────────────────────

function ReplyCard({ reply, index }: { reply: ReplyToMyArgument; index: number }) {
  const isFor = reply.argument_side === 'blue'
  const SideIcon = isFor ? ThumbsUp : ThumbsDown
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/8 border-for-500/20' : 'bg-against-500/8 border-against-500/20'
  const replierName = reply.replier_display_name ?? reply.replier_username

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3 hover:border-surface-400 transition-colors"
    >
      {/* Replier row */}
      <div className="flex items-center gap-2.5">
        <Link href={`/profile/${reply.replier_username}`} className="flex-shrink-0">
          <Avatar
            src={reply.replier_avatar_url}
            fallback={replierName}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${reply.replier_username}`}
            className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors truncate block"
          >
            {replierName}
          </Link>
          <p className="text-[10px] font-mono text-surface-600">
            @{reply.replier_username}
          </p>
        </div>
        <span className="text-[10px] font-mono text-surface-600 flex-shrink-0 tabular-nums">
          {relativeTime(reply.reply_created_at)}
        </span>
      </div>

      {/* Reply content */}
      <p className="text-sm font-mono text-surface-300 leading-relaxed">
        {reply.reply_content}
      </p>

      {/* Argument being replied to */}
      <div className={cn('rounded-xl border px-3 py-2.5 space-y-1.5', sideBg)}>
        <div className="flex items-center gap-1.5">
          <SideIcon className={cn('h-3 w-3 flex-shrink-0', sideColor)} aria-hidden />
          <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', sideColor)}>
            Your {isFor ? 'FOR' : 'AGAINST'} argument
          </span>
        </div>
        <p className={cn('text-[11px] font-mono line-clamp-2 leading-relaxed', sideColor)}>
          {reply.argument_content}
        </p>
      </div>

      {/* Topic link */}
      <Link
        href={`/topic/${reply.topic_id}`}
        className="flex items-center gap-1.5 group"
      >
        <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0" aria-hidden />
        <span className="text-[11px] font-mono text-surface-500 group-hover:text-for-400 transition-colors truncate leading-relaxed">
          {reply.topic_statement}
        </span>
      </Link>
    </motion.div>
  )
}

// ─── Group header ─────────────────────────────────────────────────────────────

function GroupHeader({
  argumentContent,
  side,
  topicId,
  topicStatement,
  count,
}: {
  argumentContent: string
  side: 'blue' | 'red'
  topicId: string
  topicStatement: string
  count: number
}) {
  const isFor = side === 'blue'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'
  const SideIcon = isFor ? ThumbsUp : ThumbsDown

  return (
    <div className={cn('rounded-xl border px-4 py-3 space-y-1.5 mb-2', sideBg)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <SideIcon className={cn('h-3.5 w-3.5 flex-shrink-0', sideColor)} aria-hidden />
          <span className={cn('text-[10px] font-mono uppercase tracking-wider font-semibold', sideColor)}>
            {isFor ? 'FOR' : 'AGAINST'} argument
          </span>
        </div>
        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
          {count} {count === 1 ? 'reply' : 'replies'}
        </span>
      </div>
      <p className={cn('text-xs font-mono line-clamp-2 leading-relaxed', sideColor)}>
        {argumentContent}
      </p>
      <Link
        href={`/topic/${topicId}`}
        className="flex items-center gap-1 group"
      >
        <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" aria-hidden />
        <span className="text-[10px] font-mono text-surface-600 group-hover:text-surface-400 transition-colors truncate">
          {topicStatement}
        </span>
      </Link>
    </div>
  )
}

// ─── View toggle ──────────────────────────────────────────────────────────────

type ViewMode = 'flat' | 'grouped'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArgumentRepliesPage() {
  const router = useRouter()
  const [data, setData] = useState<MyRepliesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('flat')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/arguments/my-replies', { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as MyRepliesResponse
      setData(json)
    } catch {
      setError('Could not load replies. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  // Group replies by argument_id
  const grouped = data
    ? Array.from(
        data.replies.reduce((map, r) => {
          if (!map.has(r.argument_id)) {
            map.set(r.argument_id, {
              argument_id: r.argument_id,
              argument_content: r.argument_content,
              argument_side: r.argument_side,
              topic_id: r.topic_id,
              topic_statement: r.topic_statement,
              replies: [],
            })
          }
          map.get(r.argument_id)!.replies.push(r)
          return map
        }, new Map<string, {
          argument_id: string
          argument_content: string
          argument_side: 'blue' | 'red'
          topic_id: string
          topic_statement: string
          replies: ReplyToMyArgument[]
        }>())
        .values()
      )
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/arguments/mine"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to my arguments"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Replies to My Arguments</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {data && data.total > 0
                ? `${data.total} ${data.total === 1 ? 'reply' : 'replies'} from the community`
                : 'Responses from the community on your arguments'}
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* View toggle — only when there's data */}
        {data && data.total > 0 && !loading && (
          <div className="flex items-center gap-1 bg-surface-200 rounded-lg p-0.5 w-fit">
            {(['flat', 'grouped'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors',
                  view === v
                    ? 'bg-surface-50 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {v === 'flat' ? 'Recent' : 'By Argument'}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[...Array(4)].map((_, i) => (
                <ReplySkeleton key={i} />
              ))}
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button
                onClick={load}
                className="mt-3 text-xs font-mono text-surface-500 hover:text-white underline"
              >
                Try again
              </button>
            </motion.div>
          )}

          {!loading && !error && data && data.total === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={MessageSquare}
                title="No replies yet"
                description="When someone replies to one of your arguments, it will show up here. Post arguments on active topics to spark discussion."
                action={{ label: 'Go to Feed', href: '/' }}
              />
            </motion.div>
          )}

          {!loading && !error && data && data.total > 0 && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {view === 'flat' ? (
                /* ── Flat: all replies chronologically ── */
                <div className="space-y-3">
                  {data.replies.map((reply, i) => (
                    <ReplyCard key={reply.reply_id} reply={reply} index={i} />
                  ))}
                </div>
              ) : (
                /* ── Grouped: by argument ── */
                <div className="space-y-6">
                  {grouped.map((group, gi) => (
                    <motion.div
                      key={group.argument_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: gi * 0.06 }}
                    >
                      <GroupHeader
                        argumentContent={group.argument_content}
                        side={group.argument_side}
                        topicId={group.topic_id}
                        topicStatement={group.topic_statement}
                        count={group.replies.length}
                      />
                      <div className="space-y-2 ml-4">
                        {group.replies.map((reply, ri) => (
                          <ReplyCard key={reply.reply_id} reply={reply} index={ri} />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* CTA: go argue more */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.3 }}
                className="mt-6"
              >
                <Link
                  href="/arguments/mine"
                  className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 hover:bg-surface-100/80 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/20 flex-shrink-0">
                      <MessageSquare className="h-4 w-4 text-for-400" />
                    </div>
                    <div>
                      <div className="text-sm font-mono font-semibold text-white">My Argument Portfolio</div>
                      <div className="text-xs font-mono text-surface-500 mt-0.5">All your arguments with grades and stats</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-surface-400 transition-colors flex-shrink-0" />
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
