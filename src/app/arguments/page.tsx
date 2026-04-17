'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopArgument, TopArgumentsResponse } from '@/app/api/arguments/top/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const PERIODS = [
  { id: 'all', label: 'All Time' },
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
] as const

const SIDES = [
  { id: 'all', label: 'Both Sides' },
  { id: 'for', label: 'FOR only' },
  { id: 'against', label: 'AGAINST only' },
] as const

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const STATUS_OPTIONS = [
  { id: '', label: 'Any Status' },
  { id: 'active', label: 'Active' },
  { id: 'voting', label: 'Voting' },
  { id: 'law', label: 'LAW' },
  { id: 'proposed', label: 'Proposed' },
]

type Period = (typeof PERIODS)[number]['id']
type SideFilter = (typeof SIDES)[number]['id']

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArgumentSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/40 bg-surface-100/60 p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex items-center gap-3 pt-1">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-10 ml-auto" />
      </div>
    </div>
  )
}

function ArgumentSkeletons() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <ArgumentSkeleton key={i} />
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function ArgumentsEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <EmptyState
      icon={MessageSquare}
      title="No arguments found"
      description="Try widening your filters — there may not be any arguments that match yet."
      actions={[{ label: 'Reset filters', onClick: onReset, variant: 'secondary', icon: RefreshCw }]}
    />
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, rank }: { arg: TopArgument; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const isFor = arg.side === 'blue'
  const authorName = arg.author?.display_name || arg.author?.username || 'Unknown'
  const topicStatus = arg.topic?.status ?? 'proposed'
  const badgeVariant = STATUS_BADGE[topicStatus] ?? 'proposed'
  const content = arg.content
  const isLong = content.length > 220
  const displayContent = isLong && !expanded ? truncate(content, 220) : content

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.3) }}
      className={cn(
        'relative rounded-xl border bg-surface-100/60 p-4 space-y-3',
        'hover:bg-surface-100 transition-colors group',
        isFor
          ? 'border-for-500/25 hover:border-for-500/40'
          : 'border-against-500/25 hover:border-against-500/40'
      )}
    >
      {/* Side stripe */}
      <div
        className={cn(
          'absolute left-0 top-4 bottom-4 w-0.5 rounded-full',
          isFor ? 'bg-for-500' : 'bg-against-500'
        )}
      />

      {/* Header row */}
      <div className="flex items-center gap-2 pl-3">
        {arg.author ? (
          <Link
            href={`/profile/${arg.author.username}`}
            className="flex items-center gap-2 min-w-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar
              src={arg.author.avatar_url}
              fallback={authorName}
              size="xs"
            />
            <span className="text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors truncate">
              @{arg.author.username}
            </span>
          </Link>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 rounded-full bg-surface-300 flex-shrink-0" />
            <span className="text-xs font-mono text-surface-500">Anonymous</span>
          </div>
        )}

        {/* Upvotes */}
        <div
          className={cn(
            'flex items-center gap-1 flex-shrink-0 text-xs font-mono font-semibold',
            isFor ? 'text-for-400' : 'text-against-400'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3 w-3" />
          ) : (
            <ThumbsDown className="h-3 w-3" />
          )}
          {arg.upvotes.toLocaleString()}
        </div>

        {/* Time */}
        <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
          {relativeTime(arg.created_at)}
        </span>
      </div>

      {/* Content */}
      <div className="pl-3">
        <p className="text-sm text-surface-700 leading-relaxed">
          {displayContent}
          {isLong && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="ml-1 text-surface-500 hover:text-white text-[11px] font-mono"
            >
              more
            </button>
          )}
        </p>
        {isLong && expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="mt-1 text-[11px] font-mono text-surface-500 hover:text-white flex items-center gap-0.5"
          >
            <ChevronUp className="h-3 w-3" /> collapse
          </button>
        )}
      </div>

      {/* Topic footer */}
      {arg.topic && (
        <div className="pl-3 flex items-start gap-2">
          <div
            className={cn(
              'flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
              isFor
                ? 'bg-for-500/10 text-for-400 border-for-500/20'
                : 'bg-against-500/10 text-against-400 border-against-500/20'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-2.5 w-2.5" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" />
            )}
            {isFor ? 'FOR' : 'AGAINST'}
          </div>

          <Link
            href={`/topic/${arg.topic.id}`}
            className="flex-1 min-w-0 group/topic"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-mono text-surface-500 leading-tight hover:text-surface-300 transition-colors line-clamp-2">
              {arg.topic.statement}
            </p>
          </Link>

          <div className="flex-shrink-0 flex items-center gap-1.5">
            {arg.topic.category && (
              <span className="text-[10px] font-mono text-surface-500">
                {arg.topic.category}
              </span>
            )}
            <Badge variant={badgeVariant} className="text-[9px] px-1.5 py-0.5">
              {STATUS_LABEL[topicStatus] ?? topicStatus}
            </Badge>
            <Link
              href={`/topic/${arg.topic.id}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="View topic"
            >
              <ArrowRight className="h-3.5 w-3.5 text-surface-500" />
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Category pill ────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold border-gold/30 bg-gold/10 data-[active=true]:bg-gold/20 data-[active=true]:border-gold/50',
  Politics: 'text-for-400 border-for-500/30 bg-for-500/10 data-[active=true]:bg-for-500/20 data-[active=true]:border-for-500/50',
  Technology: 'text-purple border-purple/30 bg-purple/10 data-[active=true]:bg-purple/20 data-[active=true]:border-purple/50',
  Science: 'text-emerald border-emerald/30 bg-emerald/10 data-[active=true]:bg-emerald/20 data-[active=true]:border-emerald/50',
  Ethics: 'text-against-400 border-against-500/30 bg-against-500/10 data-[active=true]:bg-against-500/20 data-[active=true]:border-against-500/50',
  Philosophy: 'text-for-300 border-for-400/30 bg-for-400/10 data-[active=true]:bg-for-400/20 data-[active=true]:border-for-400/50',
  Culture: 'text-gold border-gold/30 bg-gold/10 data-[active=true]:bg-gold/20 data-[active=true]:border-gold/50',
  Health: 'text-emerald border-emerald/30 bg-emerald/10 data-[active=true]:bg-emerald/20 data-[active=true]:border-emerald/50',
  Environment: 'text-emerald border-emerald/30 bg-emerald/10 data-[active=true]:bg-emerald/20 data-[active=true]:border-emerald/50',
  Education: 'text-for-300 border-for-400/30 bg-for-400/10 data-[active=true]:bg-for-400/20 data-[active=true]:border-for-400/50',
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArgumentsPage() {
  const [period, setPeriod] = useState<Period>('all')
  const [side, setSide] = useState<SideFilter>('all')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')

  const [args, setArgs] = useState<TopArgument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const fetchArgs = useCallback(
    async (newOffset: number, replace: boolean) => {
      if (replace) setLoading(true)
      else setLoadingMore(true)

      try {
        const params = new URLSearchParams({
          period,
          side,
          limit: String(LIMIT),
          offset: String(newOffset),
        })
        if (category) params.set('category', category)
        if (status) params.set('status', status)

        const res = await fetch(`/api/arguments/top?${params.toString()}`)
        if (!res.ok) throw new Error('Failed')
        const data: TopArgumentsResponse = await res.json()

        if (replace) {
          setArgs(data.arguments)
        } else {
          setArgs((prev) => [...prev, ...data.arguments])
        }
        setTotal(data.total)
        setOffset(newOffset + data.arguments.length)
      } catch {
        // silently keep existing data
      } finally {
        if (replace) setLoading(false)
        else setLoadingMore(false)
      }
    },
    [period, side, category, status]
  )

  // Re-fetch from scratch when filters change
  useEffect(() => {
    setOffset(0)
    fetchArgs(0, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, side, category, status])

  function resetFilters() {
    setPeriod('all')
    setSide('all')
    setCategory('')
    setStatus('')
  }

  const hasMore = args.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-20 pb-24 md:pb-8">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-8 w-8 rounded-lg bg-purple/20 border border-purple/30 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-purple" />
            </div>
            <h1 className="font-mono text-xl font-bold text-white">Top Arguments</h1>
          </div>
          <p className="text-sm font-mono text-surface-500 ml-11">
            The most-upvoted arguments ever made across the Lobby
          </p>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-6">
          {/* Period + Side row */}
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-mono border transition-all',
                  period === p.id
                    ? 'bg-purple/20 border-purple/50 text-purple'
                    : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {p.label}
              </button>
            ))}

            <div className="h-4 w-px bg-surface-300 self-center mx-1" />

            {SIDES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSide(s.id)}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-mono border transition-all',
                  side === s.id
                    ? s.id === 'for'
                      ? 'bg-for-500/20 border-for-500/50 text-for-400'
                      : s.id === 'against'
                      ? 'bg-against-500/20 border-against-500/50 text-against-400'
                      : 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCategory('')}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                !category
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              All Topics
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                data-active={category === cat}
                onClick={() => setCategory(category === cat ? '' : cat)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                  'bg-surface-200/60 border-surface-300 text-surface-500',
                  CATEGORY_COLORS[cat]
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setStatus(status === opt.id ? '' : opt.id)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-mono border transition-all',
                  status === opt.id
                    ? opt.id === 'law'
                      ? 'bg-emerald/20 border-emerald/40 text-emerald'
                      : opt.id === 'active' || opt.id === 'voting'
                      ? 'bg-for-500/20 border-for-500/40 text-for-400'
                      : 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-200/60 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Result count */}
        {!loading && (
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-mono text-surface-500">
              {total.toLocaleString()} argument{total !== 1 ? 's' : ''}
              {category ? ` in ${category}` : ''}
              {period !== 'all'
                ? ` from ${period === 'week' ? 'the past week' : 'the past month'}`
                : ''}
            </p>
            {(period !== 'all' || side !== 'all' || category || status) && (
              <button
                onClick={resetFilters}
                className="text-[11px] font-mono text-surface-500 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ArgumentSkeletons />
            </motion.div>
          ) : args.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ArgumentsEmptyState onReset={resetFilters} />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {args.map((arg, i) => (
                <ArgumentCard key={arg.id} arg={arg} rank={i} />
              ))}

              {/* Load more */}
              {hasMore && (
                <div className="pt-2 flex justify-center">
                  <button
                    onClick={() => fetchArgs(offset, false)}
                    disabled={loadingMore}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-mono',
                      'bg-surface-200 border border-surface-300 text-surface-400',
                      'hover:bg-surface-300 hover:text-white transition-colors',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}

              {/* Stat footer */}
              {!hasMore && args.length > 0 && (
                <div className="pt-6 pb-2 text-center">
                  <div className="inline-flex items-center gap-2 text-[11px] font-mono text-surface-500">
                    <Scale className="h-3.5 w-3.5" />
                    {args.length.toLocaleString()} argument{args.length !== 1 ? 's' : ''} shown
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
