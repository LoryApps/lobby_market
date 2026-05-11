'use client'

/**
 * /arguments/contested — Most Contested Arguments
 *
 * Surfaces the arguments that sparked the most community pushback:
 * high upvote counts combined with heavy reply threads and "needs evidence"
 * challenge reactions. These are the arguments the Lobby refuses to let slide —
 * contested, scrutinized, and debated beyond the original topic vote.
 *
 * Contest score = upvotes × (1 + reply_count) × (1 + needs_evidence × 0.5)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type {
  ContestedArgument,
  ContestedArgumentsResponse,
} from '@/app/api/arguments/contested/route'

// ─── Constants ────────────────────────────────────────────────────────────────────

const PERIODS: { id: number; label: string }[] = [
  { id: 7, label: 'Last 7 days' },
  { id: 30, label: 'Last 30 days' },
  { id: 90, label: 'All time' },
]

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald border-emerald/40 bg-emerald/10',
  B: 'text-for-400 border-for-500/40 bg-for-500/10',
  C: 'text-gold border-gold/40 bg-gold/10',
  D: 'text-against-400 border-against-500/40 bg-against-500/10',
  F: 'text-against-500 border-against-600/40 bg-against-600/10',
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

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

// ─── Loading Skeleton ───────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-16 ml-auto" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-3 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  )
}

// ─── Argument Card ───────────────────────────────────────────────────────────────────

function ContestedCard({ arg, rank }: { arg: ContestedArgument; rank: number }) {
  const isFor = arg.side === 'blue'

  const sideColor = isFor
    ? 'border-for-500/40 hover:border-for-500/70'
    : 'border-against-500/40 hover:border-against-500/70'

  const sideAccent = isFor ? 'text-for-400' : 'text-against-400'

  const sideBadge = isFor
    ? 'bg-for-500/15 text-for-300 border-for-500/40'
    : 'bg-against-500/15 text-against-300 border-against-500/40'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22, delay: rank * 0.035 }}
    >
      <div
        className={cn(
          'rounded-2xl border bg-surface-100 p-4 transition-colors group',
          sideColor,
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Rank badge */}
            <span className={cn('text-xs font-mono font-bold tabular-nums w-5 shrink-0 text-center', sideAccent)}>
              #{rank + 1}
            </span>

            {arg.author ? (
              <Link
                href={`/profile/${arg.author.username}`}
                className="flex items-center gap-1.5 min-w-0 hover:opacity-80 transition-opacity"
              >
                <Avatar
                  src={arg.author.avatar_url}
                  name={arg.author.display_name ?? arg.author.username}
                  size="xs"
                />
                <span className="text-xs font-mono text-surface-400 truncate">
                  {arg.author.display_name ?? arg.author.username}
                </span>
              </Link>
            ) : (
              <span className="text-xs font-mono text-surface-500">Anonymous</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={cn('text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded border', sideBadge)}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
            {arg.ai_grade && (
              <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border', GRADE_COLORS[arg.ai_grade] ?? GRADE_COLORS.C)}>
                {arg.ai_grade}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <p className="text-sm text-white leading-relaxed mb-3">
          {renderWithMentions(arg.content, 'text-for-400 font-medium')}
        </p>

        {/* Metrics row */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
            {isFor ? (
              <ThumbsUp className="h-3 w-3 text-for-500" />
            ) : (
              <ThumbsDown className="h-3 w-3 text-against-500" />
            )}
            {arg.upvotes.toLocaleString()}
          </span>

          <span className="flex items-center gap-1 text-xs font-mono text-surface-500">
            <MessageSquare className="h-3 w-3 text-purple/70" />
            {arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}
          </span>

          {arg.needs_evidence_count > 0 && (
            <span className="flex items-center gap-1 text-xs font-mono text-amber-400/80">
              <Search className="h-3 w-3" />
              {arg.needs_evidence_count} needs source
            </span>
          )}

          <span className="text-[10px] font-mono text-surface-600 ml-auto">
            {relativeTime(arg.created_at)}
          </span>
        </div>

        {/* Contest score bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] font-mono text-surface-600 mb-1">
            <span>Contest intensity</span>
            <span className={sideAccent}>{Math.round(arg.contest_score)}</span>
          </div>
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (arg.contest_score / 1000) * 100)}%` }}
              transition={{ duration: 0.6, delay: 0.2 + rank * 0.035 }}
              className={cn(
                'h-full rounded-full',
                isFor ? 'bg-for-500' : 'bg-against-500',
              )}
            />
          </div>
        </div>

        {/* Topic link */}
        {arg.topic && (
          <Link
            href={`/topic/${arg.topic_id}`}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-colors group/link',
              'bg-surface-200 hover:bg-surface-300 border border-surface-300 hover:border-surface-400',
            )}
          >
            <span className="truncate text-surface-400 group-hover/link:text-white transition-colors flex-1">
              {arg.topic.statement.length > 80
                ? arg.topic.statement.slice(0, 80) + '…'
                : arg.topic.statement}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Badge
                variant={
                  arg.topic.status === 'law'
                    ? 'law'
                    : arg.topic.status === 'voting'
                    ? 'proposed'
                    : arg.topic.status === 'active'
                    ? 'active'
                    : 'failed'
                }
                size="sm"
              />
              <ExternalLink className="h-3 w-3 text-surface-500" />
            </div>
          </Link>
        )}
      </div>
    </motion.div>
  )
}

// ─── Loading state ────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-24" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-24" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function ContestedArgumentsPage() {
  const [data, setData] = useState<ContestedArgumentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePeriod, setActivePeriod] = useState(30)
  const [activeCategory, setActiveCategory] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ days: String(activePeriod), limit: '10' })
      if (activeCategory) params.set('category', activeCategory)
      const res = await fetch(`/api/arguments/contested?${params}`)
      if (!res.ok) throw new Error('Failed to load contested arguments')
      const json = (await res.json()) as ContestedArgumentsResponse
      setData(json)
    } catch {
      setError('Could not load contested arguments. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [activePeriod, activeCategory, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  const forArgs = data?.for ?? []
  const againstArgs = data?.against ?? []
  const isEmpty = !loading && forArgs.length === 0 && againstArgs.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back link */}
        <div className="mb-5">
          <Link
            href="/arguments"
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Arguments
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
                <Flame className="h-5 w-5 text-purple" />
              </div>
              <h1 className="font-mono text-2xl font-bold text-white">Most Contested</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 max-w-lg">
              Arguments the Lobby refuses to let slide — high upvotes, heavy reply threads,
              and community demands for evidence. The most scrutinized takes on both sides.
            </p>
            {data?.topCategory && (
              <p className="mt-2 text-xs font-mono text-purple/80">
                <Zap className="h-3 w-3 inline mr-1" />
                Hottest category: <span className="text-purple font-semibold">{data.topCategory}</span>
              </p>
            )}
          </div>

          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 bg-surface-100 hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Period tabs */}
          <div className="flex rounded-lg border border-surface-300 overflow-hidden bg-surface-100">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePeriod(p.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-mono transition-colors',
                  activePeriod === p.id
                    ? 'bg-purple/20 text-purple border-r border-purple/30'
                    : 'text-surface-500 hover:text-white border-r border-surface-300',
                  'last:border-r-0'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Category selector */}
          <select
            value={activeCategory}
            onChange={(e) => setActiveCategory(e.target.value)}
            className="rounded-lg border border-surface-300 bg-surface-100 px-3 py-1.5 text-xs font-mono text-surface-400 hover:border-surface-400 focus:outline-none focus:border-purple/60 transition-colors appearance-none cursor-pointer"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-3 mb-6 text-center">
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
              <span className="text-xs font-mono text-surface-500">Upvotes</span>
            </div>
            <p className="text-[11px] font-mono text-surface-600">Community approval</p>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <MessageSquare className="h-3.5 w-3.5 text-purple/70" />
              <span className="text-xs font-mono text-surface-500">Replies</span>
            </div>
            <p className="text-[11px] font-mono text-surface-600">Sparked discussion</p>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Search className="h-3.5 w-3.5 text-amber-400/70" />
              <span className="text-xs font-mono text-surface-500">Needs source</span>
            </div>
            <p className="text-[11px] font-mono text-surface-600">Community skepticism</p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/10 p-6 text-center">
            <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Flame}
            iconColor="text-purple"
            iconBg="bg-purple/10"
            iconBorder="border-purple/30"
            title="No contested arguments yet"
            description="As debates heat up and replies pile in, the most scrutinized arguments will surface here."
            actions={[{ label: 'Browse arguments', href: '/arguments', variant: 'primary' }]}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* FOR side */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-for-500/20">
                <div className="h-5 w-5 rounded bg-for-500/20 flex items-center justify-center">
                  <ThumbsUp className="h-3 w-3 text-for-400" />
                </div>
                <h2 className="text-sm font-mono font-bold text-for-400 uppercase tracking-wide">
                  FOR — Most Contested
                </h2>
                <span className="ml-auto text-xs font-mono text-surface-600">
                  {forArgs.length} argument{forArgs.length !== 1 ? 's' : ''}
                </span>
              </div>

              <AnimatePresence mode="popLayout">
                {forArgs.length > 0 ? (
                  <div className="space-y-3">
                    {forArgs.map((arg, i) => (
                      <ContestedCard key={arg.id} arg={arg} rank={i} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
                    <ThumbsUp className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                    <p className="text-sm font-mono text-surface-500">No contested FOR arguments in this window.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* AGAINST side */}
            <div>
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-against-500/20">
                <div className="h-5 w-5 rounded bg-against-500/20 flex items-center justify-center">
                  <ThumbsDown className="h-3 w-3 text-against-400" />
                </div>
                <h2 className="text-sm font-mono font-bold text-against-400 uppercase tracking-wide">
                  AGAINST — Most Contested
                </h2>
                <span className="ml-auto text-xs font-mono text-surface-600">
                  {againstArgs.length} argument{againstArgs.length !== 1 ? 's' : ''}
                </span>
              </div>

              <AnimatePresence mode="popLayout">
                {againstArgs.length > 0 ? (
                  <div className="space-y-3">
                    {againstArgs.map((arg, i) => (
                      <ContestedCard key={arg.id} arg={arg} rank={i} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
                    <ThumbsDown className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                    <p className="text-sm font-mono text-surface-500">No contested AGAINST arguments in this window.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="mt-10 pt-6 border-t border-surface-300">
          <p className="text-xs font-mono text-surface-600 mb-3 text-center">Explore more argument views</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              { href: '/arguments/trending', label: 'Trending' },
              { href: '/arguments/top-scored', label: 'Top Scored' },
              { href: '/arguments/reactions', label: 'Reactions' },
              { href: '/arguments/foryou', label: 'For You' },
              { href: '/arguments/daily', label: 'Daily' },
              { href: '/arguments/authors', label: 'Authors' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-surface-500 hover:text-white border border-surface-300 hover:border-surface-400 bg-surface-100 hover:bg-surface-200 transition-colors"
              >
                {link.label}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
