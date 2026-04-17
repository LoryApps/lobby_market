'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronUp,
  Flame,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Scale,
  ThumbsDown,
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
import type { PulseArgument, ActiveDebateTopic, PulseResponse } from '@/app/api/pulse/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

// ─── Pulse skeleton ───────────────────────────────────────────────────────────

function PulseSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-3">
            <Skeleton className="h-5 w-24 rounded" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-10 ml-auto" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-32 mt-1" />
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
  arg: PulseArgument
  index: number
}) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.5) }}
      className={cn(
        'rounded-xl border p-4 space-y-2.5 transition-colors',
        isFor
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Author row */}
      <div className="flex items-center gap-2 flex-wrap">
        <Avatar
          src={arg.author?.avatar_url ?? null}
          fallback={arg.author?.display_name || arg.author?.username || '?'}
          size="xs"
        />
        <span className="text-xs font-medium text-white truncate max-w-[110px]">
          {arg.author?.display_name || arg.author?.username || 'Anonymous'}
        </span>
        {arg.upvotes > 0 && (
          <span className={cn(
            'ml-auto flex-shrink-0 flex items-center gap-1 text-xs font-mono font-semibold',
            isFor ? 'text-for-400' : 'text-against-400'
          )}>
            <ChevronUp className="h-3.5 w-3.5" />
            {arg.upvotes}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-surface-200 leading-relaxed">
        &ldquo;{arg.content}&rdquo;
      </p>

      {/* Topic link */}
      <Link
        href={`/topic/${arg.topic_id}`}
        className={cn(
          'flex items-center gap-1.5 group',
          'text-[11px] font-mono transition-colors',
          isFor
            ? 'text-for-600 hover:text-for-400'
            : 'text-against-600 hover:text-against-400'
        )}
      >
        <span className={cn(
          'inline-flex items-center justify-center h-4 w-4 rounded-sm flex-shrink-0',
          isFor ? 'bg-for-500/20' : 'bg-against-500/20'
        )}>
          <Scale className="h-2.5 w-2.5" />
        </span>
        <span className="line-clamp-1 group-hover:underline underline-offset-2">
          {truncate(arg.topic.statement, 60)}
        </span>
      </Link>

      {/* Timestamp */}
      <p className="text-[10px] font-mono text-surface-600">
        {relativeTime(arg.created_at)}
      </p>
    </motion.div>
  )
}

// ─── Most-debated topic row ───────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  voting: 'Voting',
  proposed: 'Proposed',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  active: 'active',
  voting: 'active',
  proposed: 'proposed',
  law: 'law',
  failed: 'failed',
}

function DebatedTopicRow({
  topic,
  rank,
  index,
}: {
  topic: ActiveDebateTopic
  rank: number
  index: number
}) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.05, 0.5) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex gap-4 rounded-xl p-4',
          'bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/60',
          'transition-all group'
        )}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-surface-200 flex items-center justify-center text-xs font-mono font-bold text-surface-500">
          {rank}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Statement + status */}
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors flex-1">
              {topic.statement}
            </p>
          </div>

          {/* Vote bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-for-400 flex-shrink-0">
              {forPct}%F
            </span>
            <span className="text-[10px] font-mono text-against-400 flex-shrink-0">
              {againstPct}%A
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[9px]">
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500">
                {topic.category}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500 ml-auto">
              <MessageSquarePlus className="h-3 w-3" />
              {topic.argument_count} argument{topic.argument_count !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Top snippets */}
          {(topic.top_for_snippet || topic.top_against_snippet) && (
            <div className="space-y-1 pt-1 border-t border-surface-300/60">
              {topic.top_for_snippet && (
                <p className="text-[11px] text-for-600 line-clamp-1 flex items-start gap-1">
                  <ThumbsUp className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  {truncate(topic.top_for_snippet, 80)}
                </p>
              )}
              {topic.top_against_snippet && (
                <p className="text-[11px] text-against-600 line-clamp-1 flex items-start gap-1">
                  <ThumbsDown className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  {truncate(topic.top_against_snippet, 80)}
                </p>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function PulseEmptyState() {
  return (
    <EmptyState
      icon={MessageSquarePlus}
      title="No arguments yet"
      description="Vote on active topics, then share your reasoning to fuel the pulse."
      actions={[{ label: 'Go to Feed', href: '/', icon: Flame }]}
    />
  )
}

// ─── Column header ────────────────────────────────────────────────────────────

function ColumnHeader({
  side,
  count,
}: {
  side: 'for' | 'against'
  count: number
}) {
  const isFor = side === 'for'
  return (
    <div className={cn(
      'flex items-center gap-2 px-1 mb-3',
    )}>
      <div className={cn(
        'flex items-center justify-center h-7 w-7 rounded-lg',
        isFor ? 'bg-for-500/15 border border-for-500/30' : 'bg-against-500/15 border border-against-500/30'
      )}>
        {isFor
          ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
        }
      </div>
      <span className={cn(
        'text-xs font-mono font-semibold uppercase tracking-wider',
        isFor ? 'text-for-400' : 'text-against-400'
      )}>
        {isFor ? 'Top For' : 'Top Against'}
      </span>
      <span className="ml-auto text-[10px] font-mono text-surface-500">
        {count} argument{count !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PulsePage() {
  const router = useRouter()
  const [data, setData] = useState<PulseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchPulse = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/pulse')
      if (!res.ok) throw new Error('Failed to load pulse')
      const json = await res.json() as PulseResponse
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchPulse()
    pollRef.current = setInterval(() => fetchPulse(), 90_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchPulse])

  const isEmpty =
    !loading &&
    data &&
    data.topFor.length === 0 &&
    data.topAgainst.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white font-mono">
                Community Pulse
              </h1>
              {!loading && data && (data.topFor.length + data.topAgainst.length) > 0 && (
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-for-500" />
                </span>
              )}
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              The community&apos;s strongest FOR and AGAINST voices — across all active debates
            </p>
          </div>

          <button
            onClick={() => fetchPulse(true)}
            disabled={refreshing}
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0',
              refreshing && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Refresh pulse"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Last updated */}
        {lastUpdated && !loading && (
          <p className="text-[10px] font-mono text-surface-600 mb-5 -mt-2">
            Updated {relativeTime(lastUpdated.toISOString())} · refreshes every 90s
            {data && data.totalArguments > 0 && (
              <> · {data.totalArguments.toLocaleString()} active argument{data.totalArguments !== 1 ? 's' : ''}</>
            )}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && <PulseSkeleton />}

        {/* Empty */}
        {isEmpty && <PulseEmptyState />}

        {/* Content */}
        {!loading && data && !isEmpty && (
          <div className="space-y-8">

            {/* ── FOR vs AGAINST columns ──────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* FOR column */}
              <div>
                <ColumnHeader side="for" count={data.topFor.length} />
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {data.topFor.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* AGAINST column */}
              <div>
                <ColumnHeader side="against" count={data.topAgainst.length} />
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {data.topAgainst.map((arg, i) => (
                      <ArgumentCard key={arg.id} arg={arg} index={i} />
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* ── Most-debated topics ─────────────────────────────────── */}
            {data.mostDebated.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                    <Zap className="h-3.5 w-3.5 text-gold" />
                  </div>
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                    Most Debated Topics
                  </h2>
                  <div className="flex-1 h-px bg-surface-300" />
                </div>
                <div className="space-y-3">
                  {data.mostDebated.map((topic, i) => (
                    <DebatedTopicRow
                      key={topic.id}
                      topic={topic}
                      rank={i + 1}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── CTA ─────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center"
            >
              <p className="text-sm text-surface-500 mb-3">
                Vote on a topic to unlock your own argument slot.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
                >
                  <Flame className="h-4 w-4" />
                  Browse Topics
                </Link>
                <Link
                  href="/topic/create"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono font-medium transition-colors border border-surface-400"
                >
                  Propose a Topic
                </Link>
              </div>
            </motion.div>

          </div>
        )}

        {/* Spinner during refresh */}
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
