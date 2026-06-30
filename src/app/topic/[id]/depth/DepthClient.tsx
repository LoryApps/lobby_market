'use client'

/**
 * /topic/[id]/depth — Conversation Depth Analysis
 *
 * Explores the REPLY ecosystem of a topic debate:
 *   • Which arguments sparked the most discussion?
 *   • How replies are distributed across FOR / AGAINST arguments
 *   • "Silent hits" — high-upvote arguments nobody replied to
 *   • Reply bucket distribution (0 / 1 / 2-4 / 5+ replies)
 *
 * Distinct from:
 *   /crossfire   — cross-aisle contested exchanges
 *   /threads     — active reply thread streams
 *   /argument-graph — visual network of reply chains
 *   /contributors   — who argued (not who replied)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  MessageSquare,
  Mic2,
  RefreshCw,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DepthResponse, DepthArgument } from '@/app/api/topics/[id]/depth/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(s: string, n = 180): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DepthSkeleton() {
  return (
    <div className="space-y-4">
      {/* stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* bar chart */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-16 flex-shrink-0" />
            <Skeleton className="h-5 rounded-full" style={{ width: `${40 + i * 15}%` }} />
            <Skeleton className="h-3 w-8 flex-shrink-0" />
          </div>
        ))}
      </div>
      {/* argument cards */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-14 rounded-full ml-auto" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  color,
}: {
  value: string | number
  label: string
  color?: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
      <p className={cn('text-2xl font-mono font-bold', color ?? 'text-white')}>
        {typeof value === 'number' && !Number.isInteger(value)
          ? value.toFixed(1)
          : value}
      </p>
      <p className="text-xs font-mono text-surface-500 mt-0.5">{label}</p>
    </div>
  )
}

// ─── Reply bucket bar ─────────────────────────────────────────────────────────

function BucketBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-surface-500 w-16 flex-shrink-0 text-right">
        {label}
      </span>
      <div className="flex-1 bg-surface-300/40 rounded-full h-5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <span className="text-xs font-mono text-surface-400 w-8 flex-shrink-0">
        {count}
      </span>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  rank,
  showReplies,
}: {
  arg: DepthArgument
  rank?: number
  showReplies?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-3',
        isFor
          ? 'bg-for-900/20 border-for-800/50'
          : 'bg-against-900/20 border-against-800/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {rank !== undefined && (
            <span className="text-xs font-mono font-bold text-surface-500 w-5 flex-shrink-0">
              #{rank}
            </span>
          )}
          <Avatar
            src={arg.author?.avatar_url ?? null}
            fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
            size="xs"
          />
          <span className="text-xs font-mono text-surface-400 truncate">
            {arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'}
          </span>
          <span className="text-xs text-surface-600">{relativeTime(arg.created_at)}</span>
        </div>
        <Badge variant={isFor ? 'active' : 'failed'} className="flex-shrink-0 text-[10px]">
          {isFor ? 'FOR' : 'AGAINST'}
        </Badge>
      </div>

      {/* Content */}
      <p className="text-sm font-mono text-surface-700 leading-relaxed">
        {truncate(arg.content)}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3.5 w-3.5" />
          {arg.upvotes}
        </span>
        <span
          className={cn(
            'flex items-center gap-1',
            arg.reply_count > 0 ? 'text-purple' : 'text-surface-600'
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}
        </span>
        {arg.reply_count > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="ml-auto text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'Preview'} replies
            <ArrowRight
              className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
            />
          </button>
        )}
      </div>

      {/* Preview replies */}
      <AnimatePresence>
        {expanded && showReplies && arg.preview_replies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 pt-1 border-t border-surface-300/50"
          >
            {arg.preview_replies.map((r) => (
              <div key={r.id} className="flex gap-2">
                <div className="w-px bg-surface-300/50 flex-shrink-0 ml-1" />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Avatar
                      src={r.author?.avatar_url ?? null}
                      fallback={r.author?.username ?? '?'}
                      size="xs"
                    />
                    <span className="text-[11px] font-mono text-surface-500">
                      {r.author?.username ?? 'anon'}
                    </span>
                    <span className="text-[11px] text-surface-600">
                      {relativeTime(r.created_at)}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-surface-600 pl-5 leading-relaxed">
                    {truncate(r.content, 140)}
                  </p>
                </div>
              </div>
            ))}
            {arg.reply_count > arg.preview_replies.length && (
              <p className="text-[11px] font-mono text-surface-600 pl-2">
                + {arg.reply_count - arg.preview_replies.length} more
                {' '}
                <Link
                  href={`/topic/${arg.id}`}
                  className="text-purple hover:text-white transition-colors"
                >
                  view thread
                </Link>
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Side comparison ──────────────────────────────────────────────────────────

function SideBar({
  label,
  args,
  replies,
  total_replies,
  color,
  bgColor,
}: {
  label: string
  args: number
  replies: number
  total_replies: number
  color: string
  bgColor: string
}) {
  const avgReplies = args > 0 ? replies / args : 0
  const pct = total_replies > 0 ? (replies / total_replies) * 100 : 0

  return (
    <div className={cn('rounded-xl border p-4 space-y-2', bgColor)}>
      <div className={cn('text-xs font-mono font-bold uppercase tracking-wider', color)}>
        {label}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className={cn('text-2xl font-mono font-bold', color)}>{replies}</p>
          <p className="text-xs font-mono text-surface-500">total replies</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-mono font-bold text-white">{avgReplies.toFixed(1)}</p>
          <p className="text-xs font-mono text-surface-500">avg per arg</p>
        </div>
      </div>
      <div className="w-full bg-surface-300/40 rounded-full h-1.5 overflow-hidden">
        <div
          className={cn('h-full rounded-full', color.replace('text-', 'bg-'))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] font-mono text-surface-600">{pct.toFixed(0)}% of all replies</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DepthClient() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<DepthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/depth`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load depth data')
      setData(await res.json())
    } catch {
      setError('Could not load conversation depth data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const topic = data?.topic
  const stats = data?.stats
  const topDiscussed = data?.top_discussed ?? []
  const lonelyArgs = data?.lonely_arguments ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back + header */}
        <div className="mb-6 flex items-start gap-3">
          <Link
            href={topic ? `/topic/${topic.id}` : '#'}
            className="mt-1 flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
          <div className="flex-1 min-w-0">
            {topic ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
                    {topic.status.toUpperCase()}
                  </Badge>
                  {topic.category && (
                    <span className="text-xs font-mono text-surface-500">{topic.category}</span>
                  )}
                </div>
                <h1 className="font-mono text-lg font-bold text-white leading-tight">
                  {topic.statement}
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-1">
                  {Math.round(topic.blue_pct ?? 50)}% FOR · {(topic.total_votes ?? 0).toLocaleString()} votes
                </p>
              </>
            ) : (
              <Skeleton className="h-6 w-2/3" />
            )}
          </div>
        </div>

        {/* Page title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <MessageSquare className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h2 className="font-mono text-xl font-bold text-white">Conversation Depth</h2>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Which arguments sparked the most discussion?
            </p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="ml-auto text-surface-500 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <DepthSkeleton />
        ) : error ? (
          <EmptyState
            icon={MessageSquare}
            title="Could not load data"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        ) : !stats || stats.total_arguments === 0 ? (
          <EmptyState
            icon={Mic2}
            title="No arguments yet"
            description="Once people start arguing, you'll see the conversation depth here."
          />
        ) : (
          <div className="space-y-6">

            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                value={stats.total_arguments}
                label="Arguments"
                color="text-white"
              />
              <StatCard
                value={stats.total_replies}
                label="Replies"
                color="text-purple"
              />
              <StatCard
                value={stats.avg_replies_per_argument}
                label="Avg per argument"
                color="text-gold"
              />
              <StatCard
                value={`${stats.arguments_with_replies}/${stats.total_arguments}`}
                label="Have replies"
                color="text-emerald"
              />
            </div>

            {/* FOR vs AGAINST reply distribution */}
            <div className="grid grid-cols-2 gap-3">
              <SideBar
                label="FOR"
                args={stats.blue_arguments}
                replies={stats.blue_total_replies}
                total_replies={stats.total_replies}
                color="text-for-400"
                bgColor="bg-for-900/10 border-for-800/30"
              />
              <SideBar
                label="AGAINST"
                args={stats.red_arguments}
                replies={stats.red_total_replies}
                total_replies={stats.total_replies}
                color="text-against-400"
                bgColor="bg-against-900/10 border-against-800/30"
              />
            </div>

            {/* Reply distribution */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple" />
                Reply Distribution
              </h3>
              <div className="space-y-2">
                <BucketBar
                  label="No replies"
                  count={stats.reply_buckets.zero}
                  total={stats.total_arguments}
                  color="bg-surface-400"
                />
                <BucketBar
                  label="1 reply"
                  count={stats.reply_buckets.one}
                  total={stats.total_arguments}
                  color="bg-purple/60"
                />
                <BucketBar
                  label="2–4 replies"
                  count={stats.reply_buckets.two_to_four}
                  total={stats.total_arguments}
                  color="bg-purple/80"
                />
                <BucketBar
                  label="5+ replies"
                  count={stats.reply_buckets.five_plus}
                  total={stats.total_arguments}
                  color="bg-purple"
                />
              </div>
              {stats.highly_discussed > 0 && (
                <p className="text-xs font-mono text-surface-500">
                  <span className="text-purple font-semibold">{stats.highly_discussed}</span>
                  {' '}argument{stats.highly_discussed !== 1 ? 's' : ''} attracted 5 or more replies
                </p>
              )}
            </div>

            {/* Most discussed arguments */}
            {topDiscussed.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-purple" />
                  Most Debated Arguments
                  <span className="ml-auto text-xs text-surface-600 font-normal">
                    by reply count
                  </span>
                </h3>
                {topDiscussed.map((arg, i) => (
                  <ArgumentCard
                    key={arg.id}
                    arg={arg}
                    rank={i + 1}
                    showReplies
                  />
                ))}
              </section>
            )}

            {/* Silent hits */}
            {lonelyArgs.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                  <VolumeX className="h-4 w-4 text-gold" />
                  Silent Hits
                  <span className="ml-auto text-xs text-surface-600 font-normal">
                    upvoted, unchallenged
                  </span>
                </h3>
                <p className="text-xs font-mono text-surface-500">
                  High-upvote arguments nobody replied to &mdash; the &ldquo;silent consensus&rdquo; moments.
                </p>
                {lonelyArgs.map((arg) => (
                  <ArgumentCard key={arg.id} arg={arg} />
                ))}
              </section>
            )}

            {/* No discussions at all */}
            {topDiscussed.length === 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center">
                <TrendingDown className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                <p className="font-mono text-sm text-white mb-1">No replies yet</p>
                <p className="text-xs font-mono text-surface-500">
                  Be the first to start a debate thread — reply to an argument on the{' '}
                  <Link
                    href={topic ? `/topic/${topic.id}` : '#'}
                    className="text-for-400 hover:text-for-300 transition-colors"
                  >
                    topic page
                  </Link>
                </p>
              </div>
            )}

            {/* Cross-links */}
            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { href: 'crossfire', label: 'Crossfire', color: 'text-against-400' },
                { href: 'threads', label: 'Active Threads', color: 'text-purple' },
                { href: 'argument-graph', label: 'Argument Graph', color: 'text-emerald' },
                { href: 'fault-lines', label: 'Fault Lines', color: 'text-gold' },
              ].map(({ href, label, color }) => (
                <Link
                  key={href}
                  href={topic ? `/topic/${topic.id}/${href}` : '#'}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-mono px-3 py-1.5',
                    'rounded-lg bg-surface-100 border border-surface-300',
                    'hover:border-surface-400 hover:text-white transition-colors',
                    color
                  )}
                >
                  {label}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
