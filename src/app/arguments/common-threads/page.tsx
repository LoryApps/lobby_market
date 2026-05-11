'use client'

/**
 * /arguments/common-threads — Civic Themes Browser
 *
 * A thematic map of every argument on the platform, organised into eight
 * recurring civic threads: Individual Freedom, Collective Good, Economic
 * Impact, Evidence & Data, Moral & Ethics, Role of Government,
 * Future Generations, and Inequality & Power.
 *
 * Each thread card shows the theme description, argument count, unique
 * topic count, and a preview of the top arguments. Clicking a thread
 * expands it to a full argument list with topic context.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitBranch,
  Layers,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  CommonThread,
  CommonThreadsResponse,
  ThreadArgument,
} from '@/app/api/arguments/common-threads/route'

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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Thread icon map ──────────────────────────────────────────────────────────

const THREAD_ICONS: Record<string, string> = {
  individual_freedom: '⚖️',
  collective_good: '🤝',
  economic_impact: '💰',
  evidence_data: '🔬',
  moral_ethics: '🧭',
  government_role: '🏛️',
  future_generations: '🌱',
  inequality: '⚡',
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

function ThreadCardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Single argument card (compact) ──────────────────────────────────────────

function ArgumentPreviewCard({ arg }: { arg: ThreadArgument }) {
  const isFor = arg.side === 'blue'

  return (
    <Link
      href={`/topic/${arg.topic_id}#arguments`}
      className={cn(
        'block rounded-xl border p-3 transition-all duration-150 group',
        'bg-surface-200/60 hover:bg-surface-200',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40',
      )}
    >
      <div className="flex items-start gap-2 mb-2">
        <span
          className={cn(
            'flex-shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full',
            isFor ? 'bg-for-400' : 'bg-against-400',
          )}
          aria-label={isFor ? 'FOR' : 'AGAINST'}
        />
        <p className="text-sm text-surface-700 leading-snug group-hover:text-white transition-colors">
          {truncate(arg.content, 180)}
        </p>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Avatar
            src={arg.author_avatar_url}
            fallback={arg.author_display_name ?? arg.author_username ?? '?'}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-500 truncate">
            {arg.author_display_name ?? arg.author_username ?? 'Anonymous'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={cn(
              'flex items-center gap-0.5 text-[11px] font-mono',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-3 w-3" />
            ) : (
              <ThumbsDown className="h-3 w-3" />
            )}
            {arg.upvotes}
          </span>
          <span className="text-[11px] font-mono text-surface-600">
            {relativeTime(arg.created_at)}
          </span>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-surface-300/40 flex items-center gap-1.5">
        <ExternalLink className="h-3 w-3 text-surface-600 flex-shrink-0" />
        <span className="text-[11px] font-mono text-surface-500 truncate">
          {truncate(arg.topic_statement, 80)}
        </span>
      </div>
    </Link>
  )
}

// ─── Full expanded argument card ──────────────────────────────────────────────

function ArgumentFullCard({ arg }: { arg: ThreadArgument }) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        'bg-surface-100',
        isFor
          ? 'border-for-500/25'
          : 'border-against-500/25',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name ?? arg.author_username ?? '?'}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">
              {arg.author_display_name ?? arg.author_username ?? 'Anonymous'}
            </span>
            <span
              className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
                isFor
                  ? 'bg-for-500/15 border-for-500/30 text-for-400'
                  : 'bg-against-500/15 border-against-500/30 text-against-400',
              )}
            >
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-[11px] font-mono text-surface-500 ml-auto">
              {relativeTime(arg.created_at)}
            </span>
          </div>
          <p className="text-sm text-surface-700 leading-relaxed">{arg.content}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-surface-300/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
          <Link
            href={`/topic/${arg.topic_id}`}
            className="text-[11px] font-mono text-surface-500 hover:text-white truncate transition-colors"
          >
            {truncate(arg.topic_statement, 90)}
          </Link>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-full border',
              isFor
                ? 'bg-for-500/10 border-for-500/25 text-for-400'
                : 'bg-against-500/10 border-against-500/25 text-against-400',
            )}
          >
            {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            {arg.upvotes}
          </span>
          {arg.topic_category && (
            <Badge variant="ghost" size="sm">{arg.topic_category}</Badge>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({
  thread,
  isSelected,
  onSelect,
  onDeselect,
}: {
  thread: CommonThread
  isSelected: boolean
  onSelect: () => void
  onDeselect: () => void
}) {
  const icon = THREAD_ICONS[thread.id] ?? '🔹'
  const hasArgs = thread.arguments.length > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border transition-all duration-200',
        isSelected
          ? `${thread.border} bg-surface-100`
          : 'border-surface-300 bg-surface-100 hover:border-surface-400',
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={isSelected ? onDeselect : onSelect}
        className="w-full text-left p-5"
        aria-expanded={isSelected}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg border',
              thread.bg,
              thread.border,
            )}
            aria-hidden="true"
          >
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h2 className={cn('font-semibold text-base', thread.color)}>
                {thread.label}
              </h2>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isSelected ? (
                  <ChevronUp className="h-4 w-4 text-surface-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-surface-500" />
                )}
              </div>
            </div>
            <p className="text-sm text-surface-500 leading-snug">
              {thread.description}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-2 mt-3 ml-13">
          {hasArgs ? (
            <>
              <span
                className={cn(
                  'flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border',
                  thread.bg,
                  thread.border,
                  thread.color,
                )}
              >
                <Scale className="h-3 w-3" />
                {thread.arguments.length} argument{thread.arguments.length !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border border-surface-300 bg-surface-200/60 text-surface-500">
                <Layers className="h-3 w-3" />
                {thread.topic_count} topic{thread.topic_count !== 1 ? 's' : ''}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-mono text-surface-600">
              No arguments yet
            </span>
          )}
        </div>
      </button>

      {/* Preview (collapsed) — top 2 args */}
      <AnimatePresence initial={false}>
        {!isSelected && hasArgs && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-2 pt-0">
              {thread.arguments.slice(0, 2).map((arg) => (
                <ArgumentPreviewCard key={arg.id} arg={arg} />
              ))}
              {thread.arguments.length > 2 && (
                <button
                  type="button"
                  onClick={onSelect}
                  className={cn(
                    'w-full text-[11px] font-mono py-2 rounded-xl border transition-all',
                    'text-surface-500 hover:text-white',
                    thread.bg,
                    thread.border,
                    'hover:opacity-80',
                  )}
                >
                  View all {thread.arguments.length} arguments →
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded — all args */}
      <AnimatePresence initial={false}>
        {isSelected && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">
              {thread.arguments.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No arguments yet"
                  description="Be the first to make an argument in this civic thread."
                />
              ) : (
                thread.arguments.map((arg) => (
                  <ArgumentFullCard key={arg.id} arg={arg} />
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommonThreadsPage() {
  const [data, setData] = useState<CommonThreadsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const loaded = useRef(false)

  const fetchThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/arguments/common-threads?limit=6', { cache: 'no-store' })
      if (res.ok) {
        const json: CommonThreadsResponse = await res.json()
        setData(json)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    fetchThreads()
  }, [fetchThreads])

  const threads = data?.threads ?? []
  const totalArgs = threads.reduce((sum, t) => sum + t.arguments.length, 0)
  const populatedThreads = threads.filter((t) => t.arguments.length > 0)

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24">
        {/* Back nav */}
        <div className="mb-4">
          <Link
            href="/arguments"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Arguments
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="h-5 w-5 text-purple" aria-hidden="true" />
                <h1 className="text-xl font-bold text-white">Common Threads</h1>
              </div>
              <p className="text-sm text-surface-500">
                Arguments on Lobby Market cluster around eight recurring civic themes.
                Explore the recurring patterns behind every debate.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchThreads(true)}
              disabled={refreshing}
              aria-label="Refresh threads"
              className="flex-shrink-0 p-2 rounded-lg border border-surface-300 bg-surface-200/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Summary pills */}
          {!loading && data && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full border border-purple/30 bg-purple/10 text-purple">
                <GitBranch className="h-3 w-3" />
                {populatedThreads.length} of {threads.length} threads active
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-full border border-surface-300 bg-surface-200/60 text-surface-500">
                <Scale className="h-3 w-3" />
                {totalArgs} arguments mapped
              </span>
            </div>
          )}
        </div>

        {/* Dismiss selected thread shortcut */}
        <AnimatePresence>
          {selectedThread && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-4 sticky top-14 z-10"
            >
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-100/95 backdrop-blur-sm shadow-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Sparkles className="h-4 w-4 text-gold" />
                  {threads.find((t) => t.id === selectedThread)?.label ?? 'Thread'}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedThread(null)}
                  className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ThreadCardSkeleton key={i} />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No threads found"
            description="Arguments will appear here as the community starts debating."
            action={
              <Link
                href="/feeds"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-medium hover:bg-for-500 transition-colors"
              >
                Browse Topics
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                isSelected={selectedThread === thread.id}
                onSelect={() => setSelectedThread(thread.id)}
                onDeselect={() => setSelectedThread(null)}
              />
            ))}
          </div>
        )}

        {/* Footer note */}
        {!loading && threads.length > 0 && (
          <div className="mt-8 pt-6 border-t border-surface-300/50 text-center">
            <p className="text-[11px] font-mono text-surface-600">
              Arguments are matched to threads by keyword. Each argument can appear in multiple threads.
            </p>
            {data?.cached_at && (
              <p className="text-[10px] font-mono text-surface-700 mt-1">
                Updated {relativeTime(data.cached_at)}
              </p>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
