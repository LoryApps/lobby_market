'use client'

/**
 * /arguments/reactions — Argument Reactions Leaderboard
 *
 * Showcases the community's most-reacted arguments, grouped by reaction type:
 *   💡 Insightful  — arguments that shifted thinking
 *   🔥 Compelling  — strongest, best-made points
 *   ⚖️  Balanced    — most fair and nuanced takes
 *   🔍 Needs source — arguments the community wants citations for
 *
 * Filter by reaction type and time period.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
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
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { renderWithMentions } from '@/lib/utils/mentions'
import type { ReactedArgument, ReactionsLeaderboardResponse, ReactionType, ReactionPeriod } from '@/app/api/arguments/reactions/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REACTIONS: {
  id: ReactionType
  emoji: string
  label: string
  description: string
  activeClass: string
  countClass: string
  borderClass: string
  dotClass: string
}[] = [
  {
    id: 'insightful',
    emoji: '💡',
    label: 'Insightful',
    description: 'Arguments that shifted community thinking',
    activeClass: 'bg-gold/15 border-gold/50 text-gold',
    countClass: 'text-gold',
    borderClass: 'border-gold/30',
    dotClass: 'bg-gold',
  },
  {
    id: 'compelling',
    emoji: '🔥',
    label: 'Compelling',
    description: 'Strongest, most persuasive points',
    activeClass: 'bg-against-500/15 border-against-500/50 text-against-400',
    countClass: 'text-against-400',
    borderClass: 'border-against-500/30',
    dotClass: 'bg-against-500',
  },
  {
    id: 'balanced',
    emoji: '⚖️',
    label: 'Balanced',
    description: 'Most nuanced, fair-minded arguments',
    activeClass: 'bg-for-500/15 border-for-500/50 text-for-400',
    countClass: 'text-for-400',
    borderClass: 'border-for-500/30',
    dotClass: 'bg-for-500',
  },
  {
    id: 'needs_evidence',
    emoji: '🔍',
    label: 'Needs Source',
    description: 'Arguments the community wants citations for',
    activeClass: 'bg-purple/15 border-purple/50 text-purple',
    countClass: 'text-purple',
    borderClass: 'border-purple/30',
    dotClass: 'bg-purple',
  },
]

const PERIODS: { id: ReactionPeriod; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
]

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

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald border-emerald/40 bg-emerald/10',
  B: 'text-for-400 border-for-500/40 bg-for-500/10',
  C: 'text-gold border-gold/40 bg-gold/10',
  D: 'text-against-400 border-against-500/40 bg-against-500/10',
  F: 'text-against-500 border-against-600/40 bg-against-600/10',
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  rank,
  reaction,
}: {
  arg: ReactedArgument
  rank: number
  reaction: (typeof REACTIONS)[number]
}) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, delay: rank * 0.04 }}
    >
      <div
        className={cn(
          'rounded-2xl border bg-surface-100 p-4 group',
          'hover:border-surface-400 transition-colors',
          reaction.borderClass,
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            {/* Rank */}
            <span className={cn('text-xs font-mono font-bold tabular-nums w-5 text-center', reaction.countClass)}>
              {rank}
            </span>

            {/* Avatar + author */}
            {arg.author ? (
              <Link href={`/profile/${arg.author.username}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity min-w-0">
                <Avatar
                  username={arg.author.username}
                  displayName={arg.author.display_name}
                  avatarUrl={arg.author.avatar_url}
                  size="xs"
                />
                <span className="text-xs font-mono text-surface-600 truncate">
                  {arg.author.display_name ?? arg.author.username}
                </span>
              </Link>
            ) : (
              <span className="text-xs font-mono text-surface-600">Anonymous</span>
            )}

            {/* Side badge */}
            <span
              className={cn(
                'flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-full border flex-shrink-0',
                isFor
                  ? 'text-for-400 border-for-500/30 bg-for-500/10'
                  : 'text-against-400 border-against-500/30 bg-against-500/10',
              )}
            >
              {isFor ? <ThumbsUp className="h-2.5 w-2.5" aria-hidden /> : <ThumbsDown className="h-2.5 w-2.5" aria-hidden />}
              {isFor ? 'For' : 'Against'}
            </span>
          </div>

          {/* Reaction count + AI grade */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {arg.ai_grade && (
              <span
                className={cn(
                  'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
                  GRADE_COLORS[arg.ai_grade] ?? 'text-surface-500 border-surface-400',
                )}
                title={`AI Grade: ${arg.ai_grade}`}
              >
                {arg.ai_grade}
              </span>
            )}
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-full border',
                reaction.activeClass,
              )}
              aria-label={`${arg.reaction_count} ${reaction.label} reactions`}
            >
              <span aria-hidden="true">{reaction.emoji}</span>
              {arg.reaction_count}
            </span>
          </div>
        </div>

        {/* Argument content */}
        <p className="text-sm font-mono text-surface-700 leading-relaxed line-clamp-4 mb-3 group-hover:text-white transition-colors">
          {renderWithMentions(arg.content)}
        </p>

        {/* Topic link + meta */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {arg.topic && (
            <Link
              href={`/topic/${arg.topic.id}`}
              className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors min-w-0 group/topic"
            >
              <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60 group-hover/topic:opacity-100" aria-hidden />
              <span className="truncate max-w-[260px]">{arg.topic.statement}</span>
            </Link>
          )}

          <div className="flex items-center gap-3 flex-shrink-0 ml-auto">
            <span className="text-[10px] font-mono text-surface-600">
              {arg.upvotes} upvote{arg.upvotes !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {relativeTime(arg.created_at)}
            </span>
            {arg.topic?.category && (
              <Badge variant="proposed" className="text-[9px]">
                {arg.topic.category}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArgumentReactionsPage() {
  const [activeReaction, setActiveReaction] = useState<ReactionType>('insightful')
  const [period, setPeriod] = useState<ReactionPeriod>('week')
  const [data, setData] = useState<ReactedArgument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (r: ReactionType, p: ReactionPeriod, isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/arguments/reactions?reaction=${r}&period=${p}&limit=20`,
          { cache: 'no-store' },
        )
        if (!res.ok) throw new Error('Failed to load')
        const json: ReactionsLeaderboardResponse = await res.json()
        setData(json.arguments)
        setTotal(json.total)
      } catch {
        setError('Could not load reactions. Please try again.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(activeReaction, period)
  }, [activeReaction, period, load])

  const reactionConfig = REACTIONS.find((r) => r.id === activeReaction) ?? REACTIONS[0]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/arguments"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Arguments
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0 text-xl" aria-hidden="true">
                <span>{reactionConfig.emoji}</span>
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Reaction Leaderboard
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {reactionConfig.description}
                </p>
              </div>
            </div>

            {/* Refresh */}
            <button
              onClick={() => load(activeReaction, period, true)}
              disabled={refreshing}
              aria-label="Refresh leaderboard"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                refreshing && 'opacity-50 cursor-wait',
              )}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
            </button>
          </div>
        </div>

        {/* ── Reaction tabs ──────────────────────────────────────────────── */}
        <div
          className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide"
          role="tablist"
          aria-label="Reaction type filter"
        >
          {REACTIONS.map((r) => (
            <button
              key={r.id}
              role="tab"
              aria-selected={activeReaction === r.id}
              onClick={() => setActiveReaction(r.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono font-medium flex-shrink-0',
                'border transition-all',
                activeReaction === r.id
                  ? r.activeClass
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              )}
            >
              <span aria-hidden="true">{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>

        {/* ── Period selector ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6" role="group" aria-label="Time period filter">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-mono border transition-colors',
                period === p.id
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              )}
            >
              {p.label}
            </button>
          ))}

          {!loading && total > 0 && (
            <span className="ml-auto text-xs font-mono text-surface-600">
              {total.toLocaleString()} argument{total !== 1 ? 's' : ''} reacted
            </span>
          )}
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        {!loading && data.length > 0 && (
          <div className={cn(
            'rounded-xl border p-3 mb-5 flex items-center gap-3',
            reactionConfig.borderClass,
          )}>
            <span className="text-2xl" aria-hidden="true">{reactionConfig.emoji}</span>
            <div>
              <div className={cn('text-sm font-mono font-semibold', reactionConfig.countClass)}>
                Top {reactionConfig.label} Arguments
              </div>
              <div className="text-xs font-mono text-surface-500">
                {PERIODS.find((p) => p.id === period)?.label} · {data.length} results
              </div>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500">
              <span>Ranked by</span>
              <span className={cn('font-semibold', reactionConfig.countClass)}>
                {reactionConfig.emoji} count
              </span>
            </div>
          </div>
        )}

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Skeleton className="h-3 w-4" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="ml-auto h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full mb-1.5" />
                <Skeleton className="h-3 w-full mb-1.5" />
                <Skeleton className="h-3 w-2/3 mb-3" />
                <Skeleton className="h-3 w-48" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load(activeReaction, period)}
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            iconColor="text-surface-500"
            title={`No ${reactionConfig.label.toLowerCase()} reactions yet`}
            description={`Be the first to mark an argument as ${reactionConfig.label.toLowerCase()} — open any debate and react to arguments.`}
            actions={[{ label: 'Browse debates', href: '/' }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeReaction}-${period}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {data.map((arg, i) => (
                <ArgumentCard
                  key={arg.id}
                  arg={arg}
                  rank={i + 1}
                  reaction={reactionConfig}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Footer nav ──────────────────────────────────────────────────── */}
        {data.length > 0 && !loading && (
          <div className="mt-8 flex items-center justify-center gap-4 text-xs font-mono text-surface-500">
            <Link
              href="/arguments/top-scored"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              Top AI-scored
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <span className="text-surface-600">·</span>
            <Link
              href="/arguments/trending"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              Trending arguments
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
