'use client'

/**
 * /common-threads — Common Threads
 *
 * Surfaces the recurring civic themes that run through multiple debates at once.
 * Each "thread" is a cross-cutting value cluster (Individual Freedom, Economic
 * Impact, Moral & Ethics, etc.) rendered as a curated list of the strongest
 * arguments that share that theme — across completely different topics.
 *
 * Unlike the topic-level argument list, this view reveals the underlying
 * value tensions that shape all civic discourse: the same argument about
 * "economic cost" might appear in debates about climate policy, healthcare,
 * and housing simultaneously. Seeing them side-by-side is illuminating.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CommonThread, ThreadArgument, CommonThreadsResponse } from '@/app/api/arguments/common-threads/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  proposed: Scale,
  active: Zap,
  voting: Scale,
  law: Gavel,
  failed: Flame,
}

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
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ThreadSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden animate-pulse">
      <div className="p-5 border-b border-surface-300">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="p-4 border-b border-surface-200 last:border-0">
          <div className="flex items-start gap-3">
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <div className="flex items-center gap-3 mt-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Single argument card within a thread ─────────────────────────────────────

function ArgumentCard({
  arg,
}: {
  arg: ThreadArgument
}) {
  const StatusIcon = STATUS_ICON[arg.topic_status] ?? Scale
  const forPct = Math.round(arg.topic_blue_pct ?? 50)
  const sideColor = arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
  const sideDot = arg.side === 'blue' ? 'bg-for-500' : 'bg-against-500'
  const catColor = CATEGORY_COLOR[arg.topic_category ?? ''] ?? 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 border-b border-surface-200 last:border-0 group hover:bg-surface-200/30 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Side indicator */}
        <div
          className={cn(
            'flex-shrink-0 mt-1 h-2 w-2 rounded-full ring-2 ring-surface-200',
            sideDot
          )}
          title={arg.side === 'blue' ? 'FOR argument' : 'AGAINST argument'}
        />

        <div className="flex-1 min-w-0">
          {/* Argument content */}
          <p className="text-sm text-surface-800 leading-relaxed font-mono">
            {truncate(arg.content, 200)}
          </p>

          {/* Topic context */}
          <Link
            href={`/topic/${arg.topic_id}`}
            className="mt-2 flex items-start gap-2 group/topic"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {arg.topic_category && (
                  <span className={cn('text-[10px] font-mono font-medium', catColor)}>
                    {arg.topic_category}
                  </span>
                )}
                <span className="text-surface-600 text-[10px]">·</span>
                <Badge variant={STATUS_BADGE[arg.topic_status] ?? 'proposed'} className="text-[10px] py-0 px-1.5">
                  <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                  {STATUS_LABEL[arg.topic_status] ?? arg.topic_status}
                </Badge>
                <span className="text-surface-600 text-[10px]">·</span>
                <span className="text-surface-500 text-[10px] font-mono">
                  {forPct}% FOR
                </span>
              </div>
              <p className="text-[11px] font-mono text-surface-500 group-hover/topic:text-surface-700 transition-colors mt-0.5 leading-tight">
                {truncate(arg.topic_statement, 80)}
              </p>
            </div>
            <ExternalLink className="h-3 w-3 text-surface-400 group-hover/topic:text-surface-600 flex-shrink-0 mt-0.5 transition-colors" />
          </Link>

          {/* Author + stats row */}
          <div className="flex items-center gap-3 mt-2.5">
            {arg.author_username ? (
              <Link
                href={`/profile/${arg.author_username}`}
                className="flex items-center gap-1.5 group/author"
              >
                <Avatar
                  src={arg.author_avatar_url}
                  username={arg.author_username}
                  size="xs"
                />
                <span className="text-[10px] font-mono text-surface-500 group-hover/author:text-surface-700 transition-colors">
                  {arg.author_display_name ?? arg.author_username}
                </span>
              </Link>
            ) : (
              <span className="text-[10px] font-mono text-surface-600">Anonymous</span>
            )}
            <span className="text-surface-600 text-[10px]">·</span>
            <span className={cn('text-[10px] font-mono font-medium', sideColor)}>
              {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-surface-600 text-[10px]">·</span>
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-surface-500">
              <ThumbsUp className="h-2.5 w-2.5" />
              {arg.upvotes}
            </span>
            <span className="text-surface-600 text-[10px]">·</span>
            <span className="text-[10px] font-mono text-surface-500">{relativeTime(arg.created_at)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({ thread }: { thread: CommonThread }) {
  const [expanded, setExpanded] = useState(false)

  const hasArgs = thread.arguments.length > 0
  const visibleArgs = expanded ? thread.arguments : thread.arguments.slice(0, 3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border overflow-hidden',
        thread.border,
        !hasArgs && 'opacity-50'
      )}
    >
      {/* Header */}
      <button
        onClick={() => hasArgs && setExpanded((v) => !v)}
        className={cn(
          'w-full p-5 flex items-start gap-3 text-left transition-colors',
          hasArgs ? 'hover:bg-surface-200/40 cursor-pointer' : 'cursor-default'
        )}
        aria-expanded={expanded}
        disabled={!hasArgs}
      >
        {/* Icon blob */}
        <div className={cn('flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center border', thread.bg, thread.border)}>
          <MessageSquare className={cn('h-4 w-4', thread.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className={cn('font-mono font-bold text-base', thread.color)}>
              {thread.label}
            </h2>
            {hasArgs && (
              <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full border', thread.bg, thread.border, thread.color)}>
                {thread.topic_count} topic{thread.topic_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-surface-500 mt-0.5">{thread.description}</p>
        </div>

        {hasArgs && (
          <div className="flex-shrink-0">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-surface-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-surface-500" />
            )}
          </div>
        )}
      </button>

      {/* Arguments list */}
      <AnimatePresence>
        {expanded && hasArgs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-200">
              {visibleArgs.map((arg) => (
                <ArgumentCard key={arg.id} arg={arg} />
              ))}
              {thread.arguments.length > 3 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full py-3 text-center text-xs font-mono text-surface-500 hover:text-surface-700 hover:bg-surface-200/30 transition-colors border-t border-surface-200"
                >
                  {thread.arguments.length - 3} more argument{thread.arguments.length - 3 !== 1 ? 's' : ''} in this thread
                </button>
              )}
            </div>
          </motion.div>
        )}
        {!expanded && hasArgs && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            className="overflow-hidden border-t border-surface-200"
          >
            {/* Preview: first arg */}
            <div
              className="p-4 cursor-pointer hover:bg-surface-200/30 transition-colors"
              onClick={() => setExpanded(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setExpanded(true)}
              aria-label={`Expand ${thread.label} thread`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex-shrink-0 mt-1 h-2 w-2 rounded-full ring-2 ring-surface-200',
                    thread.arguments[0].side === 'blue' ? 'bg-for-500' : 'bg-against-500'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-surface-600 leading-relaxed">
                    {truncate(thread.arguments[0].content, 140)}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-1.5">
                    {truncate(thread.arguments[0].topic_statement, 60)} · +{thread.arguments.length - 1} more
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!hasArgs && (
        <div className="px-5 pb-4 text-xs font-mono text-surface-600 border-t border-surface-200 pt-3">
          No arguments found for this theme yet. Post the first one.
        </div>
      )}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommonThreadsPage() {
  const [data, setData] = useState<CommonThreadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sideFilter, setSideFilter] = useState<'all' | 'for' | 'against'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = '/api/arguments/common-threads?limit=5'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as CommonThreadsResponse
      setData(json)
    } catch {
      setError('Could not load common threads.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Filtered threads based on side filter
  const displayedThreads =
    data?.threads.map((thread) => ({
      ...thread,
      arguments:
        sideFilter === 'all'
          ? thread.arguments
          : thread.arguments.filter((a) =>
              sideFilter === 'for' ? a.side === 'blue' : a.side === 'red'
            ),
    })) ?? []

  const populatedCount = displayedThreads.filter((t) => t.arguments.length > 0).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-gold" />
                <h1 className="font-mono text-2xl font-bold text-white">Common Threads</h1>
              </div>
              <p className="text-sm font-mono text-surface-500 leading-relaxed">
                The same values surface in debates across every category. Here are the recurring
                civic themes — and the arguments that embody them.
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh threads"
              className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Stats */}
          {data && !loading && (
            <div className="flex items-center gap-4 mt-4 text-xs font-mono text-surface-500">
              <span>
                <span className="text-white font-medium">{populatedCount}</span>
                {' '}active threads
              </span>
              <span>·</span>
              <span>
                <span className="text-white font-medium">
                  {displayedThreads.reduce((n, t) => n + t.arguments.length, 0)}
                </span>
                {' '}arguments surfaced
              </span>
              {data.cached_at && (
                <>
                  <span>·</span>
                  <span>updated {relativeTime(data.cached_at)}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Side filter */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {([
            { id: 'all' as const, label: 'Both Sides' },
            { id: 'for' as const, label: 'FOR only', color: 'text-for-400 border-for-500/40 bg-for-500/10' },
            { id: 'against' as const, label: 'AGAINST only', color: 'text-against-400 border-against-500/40 bg-against-500/10' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSideFilter(opt.id)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors',
                sideFilter === opt.id
                  ? opt.id === 'for'
                    ? 'text-for-400 border-for-500/40 bg-for-500/10'
                    : opt.id === 'against'
                    ? 'text-against-400 border-against-500/40 bg-against-500/10'
                    : 'text-white border-surface-400 bg-surface-300'
                  : 'text-surface-500 border-surface-300 bg-surface-200 hover:bg-surface-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <ThreadSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={MessageSquare}
            title="Could not load threads"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        ) : displayedThreads.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No threads yet"
            description="Common threads emerge as the community posts more arguments. Check back after more debates are active."
          />
        ) : (
          <div className="space-y-4">
            {displayedThreads.map((thread) => (
              <ThreadCard key={thread.id} thread={thread} />
            ))}
          </div>
        )}

        {/* Footer nudge */}
        {!loading && !error && populatedCount > 0 && (
          <div className="mt-8 p-4 rounded-2xl bg-surface-100 border border-surface-300 text-center">
            <p className="text-xs font-mono text-surface-500 mb-3">
              The more arguments the community posts, the richer these threads become.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Find a debate to argue
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
