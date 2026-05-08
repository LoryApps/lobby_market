'use client'

/**
 * /activity/replies — Replies to Your Arguments
 *
 * A dedicated inbox showing every reply other users have posted on your
 * arguments, newest first.  Each card shows:
 *   - Who replied (avatar + username + role badge)
 *   - The reply text
 *   - The argument they replied to (truncated) and which side you took
 *   - The parent topic statement + category
 *
 * Links through to the argument page (/arguments/[id]) so the user can
 * jump right into the thread.
 *
 * Distinct from /notifications (which surfaces system events) and
 * /activity (which shows platform-wide topic/law events).  This is a
 * personal conversation inbox for debate engagement.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
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
import type { ReplyActivity, RepliesActivityResponse } from '@/app/api/activity/replies/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Role badge config ────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person:       'Citizen',
  debator:      'Debator',
  troll_catcher:'Troll Catcher',
  elder:        'Elder',
  senator:      'Senator',
  lawmaker:     'Lawmaker',
}

const ROLE_COLOR: Record<string, string> = {
  person:       'text-surface-500',
  debator:      'text-for-400',
  troll_catcher:'text-emerald',
  elder:        'text-gold',
  senator:      'text-purple',
  lawmaker:     'text-gold',
}

// ─── Status badge variant ─────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RepliesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-16 rounded ml-auto" />
          </div>
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-8 w-3/4 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── Reply card ───────────────────────────────────────────────────────────────

function ReplyCard({ item }: { item: ReplyActivity }) {
  const isFor = item.argument_side === 'blue'

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'hover:border-surface-400 transition-colors group',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40',
      )}
    >
      {/* Argument-side accent stripe */}
      <div
        className={cn(
          'h-0.5 w-full',
          isFor ? 'bg-gradient-to-r from-for-600 to-for-400' : 'bg-gradient-to-r from-against-700 to-against-500',
        )}
      />

      <div className="p-4 space-y-3">
        {/* Replier row */}
        <div className="flex items-center gap-2.5">
          {item.replier ? (
            <Link
              href={`/profile/${item.replier.username}`}
              className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={item.replier.avatar_url}
                fallback={item.replier.display_name ?? item.replier.username}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-xs font-mono font-semibold text-white truncate">
                  {item.replier.display_name ?? item.replier.username}
                </p>
                <p
                  className={cn(
                    'text-[11px] font-mono',
                    ROLE_COLOR[item.replier.role] ?? 'text-surface-500',
                  )}
                >
                  {ROLE_LABEL[item.replier.role] ?? item.replier.role}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <Avatar src={null} fallback="?" size="sm" />
              <span className="text-xs font-mono text-surface-500">Unknown citizen</span>
            </div>
          )}

          <time
            dateTime={item.reply_created_at}
            className="text-[11px] font-mono text-surface-500 flex-shrink-0"
            title={new Date(item.reply_created_at).toLocaleString()}
          >
            {relativeTime(item.reply_created_at)}
          </time>
        </div>

        {/* Reply content */}
        <blockquote
          className={cn(
            'rounded-xl border px-3.5 py-3 text-sm font-mono text-surface-200 leading-relaxed',
            'bg-surface-200/40',
            isFor ? 'border-for-500/20' : 'border-against-500/20',
          )}
        >
          <MessageSquare
            className={cn(
              'h-3 w-3 mb-1 opacity-60',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
            aria-hidden
          />
          {item.reply_content}
        </blockquote>

        {/* Your argument context */}
        <div
          className={cn(
            'rounded-xl border px-3 py-2.5 space-y-1',
            'bg-surface-50/50',
            isFor
              ? 'border-for-500/15 bg-for-500/5'
              : 'border-against-500/15 bg-against-500/5',
          )}
        >
          <div className="flex items-center gap-1.5 mb-1">
            {isFor ? (
              <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" aria-hidden />
            ) : (
              <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" aria-hidden />
            )}
            <span
              className={cn(
                'text-[10px] font-mono font-bold uppercase tracking-wider',
                isFor ? 'text-for-400' : 'text-against-400',
              )}
            >
              Your {isFor ? 'FOR' : 'AGAINST'} argument
            </span>
            <span className="text-[10px] font-mono text-surface-500 ml-auto">
              ↑ {item.argument_upvotes}
            </span>
          </div>
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            &ldquo;{truncate(item.argument_content, 140)}&rdquo;
          </p>
        </div>

        {/* Topic + action */}
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-mono text-surface-500 mb-0.5 uppercase tracking-wider">
              Topic
            </p>
            <p className="text-xs font-mono text-surface-300 leading-snug line-clamp-2">
              {item.topic_statement}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {item.topic_category && (
              <Badge variant="proposed" className="text-[10px]">
                {item.topic_category}
              </Badge>
            )}
            <Badge
              variant={STATUS_VARIANT[item.topic_status] ?? 'proposed'}
              className="text-[10px]"
            >
              {item.topic_status === 'law' ? 'LAW' : item.topic_status}
            </Badge>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/arguments/${item.argument_id}`}
          aria-label="View full argument thread"
          className={cn(
            'flex items-center justify-between w-full',
            'rounded-xl border px-3 py-2 text-xs font-mono font-semibold',
            'transition-all',
            isFor
              ? 'border-for-500/30 bg-for-500/10 text-for-400 hover:bg-for-500/20 hover:border-for-500/50'
              : 'border-against-500/30 bg-against-500/10 text-against-400 hover:bg-against-500/20 hover:border-against-500/50',
          )}
        >
          <span className="flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View full thread
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </Link>
      </div>
    </motion.article>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function ActivityRepliesPage() {
  const router = useRouter()
  const [replies, setReplies]   = useState<ReplyActivity[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [authed, setAuthed]     = useState<boolean | null>(null)
  const offsetRef = useRef(0)

  const load = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    setError(null)

    try {
      const res = await fetch(
        `/api/activity/replies?limit=${PAGE_SIZE}&offset=${offsetRef.current}`,
        { cache: 'no-store' },
      )

      if (res.status === 401) {
        setAuthed(false)
        return
      }

      if (!res.ok) {
        setError('Could not load replies. Please try again.')
        return
      }

      setAuthed(true)
      const data = (await res.json()) as RepliesActivityResponse

      if (reset) {
        setReplies(data.replies)
      } else {
        setReplies((prev) => [...prev, ...data.replies])
      }
      setTotal(data.totalCount)
      offsetRef.current += data.replies.length
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    load(true)
  }, [load])

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (authed === false) {
      router.push('/login')
    }
  }, [authed, router])

  const hasMore = replies.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3">
          <Link
            href="/activity"
            aria-label="Back to activity"
            className="mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-mono text-2xl font-bold text-white">
                Replies to You
              </h1>
              {total > 0 && !loading && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-for-500/20 border border-for-500/30 text-for-400 text-[10px] font-mono font-bold">
                  {total}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Citizens who engaged with your arguments
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={loading}
            aria-label="Refresh replies"
            className={cn(
              'mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg',
              'bg-surface-200 border border-surface-300',
              'text-surface-400 hover:text-white hover:border-surface-400',
              'transition-colors disabled:opacity-50',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          </button>
        </div>

        {/* ── Quick nav ───────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="Activity navigation">
          {[
            { href: '/activity',           label: 'Feed' },
            { href: '/activity/following', label: 'Following' },
            { href: '/activity/replies',   label: 'Replies', active: true },
            { href: '/arguments/mine',     label: 'My Arguments' },
            { href: '/notifications',      label: 'Notifications' },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-colors whitespace-nowrap',
                active
                  ? 'bg-for-500/20 border-for-500/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RepliesSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
              <button
                onClick={() => load(true)}
                className="text-xs font-mono text-surface-400 hover:text-white underline transition-colors"
              >
                Try again
              </button>
            </motion.div>
          ) : replies.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={MessageSquare}
                title="No replies yet"
                description="When other citizens reply to your arguments, they'll appear here. Post an argument on a topic to start the conversation."
                action={{ label: 'Explore topics', href: '/' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {replies.map((item) => (
                <ReplyCard key={item.reply_id} item={item} />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => load(false)}
                    disabled={loadingMore}
                    className={cn(
                      'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-mono font-semibold',
                      'bg-surface-200 border-surface-300 text-surface-400',
                      'hover:bg-surface-300 hover:text-white hover:border-surface-400',
                      'transition-all disabled:opacity-50',
                    )}
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…</>
                    ) : (
                      `Load more (${total - replies.length} remaining)`
                    )}
                  </button>
                </div>
              )}

              {/* Footer summary */}
              {!hasMore && replies.length > 0 && (
                <p className="text-center text-[11px] font-mono text-surface-500 pt-2">
                  {total} {total === 1 ? 'reply' : 'replies'} total
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Related links ────────────────────────────────────────────────── */}
        {!loading && !error && (
          <nav
            aria-label="Related pages"
            className="grid grid-cols-2 gap-3 pt-2"
          >
            {[
              { href: '/arguments/mine',  label: 'My Arguments',  sub: 'All your debate posts' },
              { href: '/notifications',   label: 'Notifications', sub: 'System alerts & upvotes' },
              { href: '/live',            label: 'Live Stream',   sub: 'Real-time argument feed' },
              { href: '/pulse',           label: 'Pulse',         sub: 'Hottest arguments now' },
            ].map(({ href, label, sub }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-xl border border-surface-300 bg-surface-100 p-3.5',
                  'hover:border-surface-400 hover:bg-surface-200 transition-colors',
                  'flex flex-col gap-0.5',
                )}
              >
                <span className="text-sm font-mono font-semibold text-white">{label}</span>
                <span className="text-[11px] font-mono text-surface-500">{sub}</span>
              </Link>
            ))}
          </nav>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
