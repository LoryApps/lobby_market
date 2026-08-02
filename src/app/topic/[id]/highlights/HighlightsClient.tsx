'use client'

/**
 * /topic/[id]/highlights — Best Moments
 *
 * A curated "Hall of Fame" compilation for each topic:
 * - Top FOR argument (highest upvotes)
 * - Top AGAINST argument (highest upvotes)
 * - First voter who kicked it off
 * - Most insightful community hot takes (one per side)
 * - At-a-glance stat strip
 *
 * Distinct from:
 *   /topic/[id]/quotes      — all high-rated arguments as shareable quote cards
 *   /topic/[id]/hot-takes   — live stream of recent vote reasons
 *   /topic/[id]/reasons     — paginated list of vote reasons
 *   /topic/[id]/stats       — raw numerical statistics
 */

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  HighlightsResponse,
  HighlightArgument,
  HighlightVote,
  HighlightFirstVoter,
} from '@/app/api/topics/[id]/highlights/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface HighlightsClientProps {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Grade badge ──────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const color =
    grade === 'A' || grade === 'A+' ? 'text-emerald bg-emerald/10 border-emerald/20'
    : grade.startsWith('B') ? 'text-for-400 bg-for-400/10 border-for-400/20'
    : grade.startsWith('C') ? 'text-gold bg-gold/10 border-gold/20'
    : 'text-surface-500 bg-surface-200 border-surface-300'
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border', color)}>
      {grade}
    </span>
  )
}

// ─── Author line ──────────────────────────────────────────────────────────────

function AuthorLine({
  author,
  timestamp,
}: {
  author: { username: string; display_name: string | null; avatar_url: string | null } | null
  timestamp: string
}) {
  return (
    <div className="flex items-center gap-2 mt-3">
      {author ? (
        <Link href={`/profile/${author.username}`} className="flex items-center gap-2 group">
          <Avatar
            src={author.avatar_url}
            fallback={author.display_name || author.username}
            size="xs"
          />
          <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors">
            {author.display_name || author.username}
          </span>
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-surface-300 flex items-center justify-center">
            <User className="h-3 w-3 text-surface-500" />
          </div>
          <span className="text-[11px] font-mono text-surface-500">Anonymous</span>
        </div>
      )}
      <span className="text-surface-600 text-[10px]">·</span>
      <span className="text-[11px] font-mono text-surface-600">{relativeTime(timestamp)}</span>
    </div>
  )
}

// ─── Highlight cards ──────────────────────────────────────────────────────────

function ArgumentHighlightCard({
  arg,
  side,
  index,
  topicId,
}: {
  arg: HighlightArgument
  side: 'blue' | 'red'
  index: number
  topicId: string
}) {
  const isFor = side === 'blue'
  const Icon = isFor ? ThumbsUp : ThumbsDown
  const label = isFor ? 'Top FOR Argument' : 'Top AGAINST Argument'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-4',
        isFor
          ? 'bg-for-900/25 border-for-700/30'
          : 'bg-against-900/25 border-against-700/30',
      )}
    >
      {/* Medal header */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            isFor ? 'bg-for-500/15' : 'bg-against-500/15',
          )}
        >
          <Trophy
            className={cn('h-3.5 w-3.5', isFor ? 'text-for-400' : 'text-against-400')}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1">
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            {label}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <GradeBadge grade={arg.ai_grade} />
          <span
            className={cn(
              'flex items-center gap-1 text-[11px] font-mono font-bold',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {arg.upvotes}
          </span>
        </div>
      </div>

      {/* Argument content */}
      <p className="text-sm leading-relaxed text-surface-800 font-mono line-clamp-5">
        {arg.content}
      </p>

      {/* Stats + author */}
      <div className="flex items-center justify-between mt-3">
        <AuthorLine author={arg.author} timestamp={arg.created_at} />
        {arg.reply_count > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-mono text-surface-600 flex-shrink-0">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            {arg.reply_count}
          </span>
        )}
      </div>

      {/* Deep dive link */}
      <div className="mt-3 pt-3 border-t border-surface-300/30">
        <Link
          href={`/topic/${topicId}/arguments`}
          className={cn(
            'text-[11px] font-mono hover:underline transition-colors',
            isFor ? 'text-for-500 hover:text-for-300' : 'text-against-500 hover:text-against-300',
          )}
        >
          See all arguments →
        </Link>
      </div>
    </motion.div>
  )
}

function TakeCard({
  take,
  index,
}: {
  take: HighlightVote
  index: number
}) {
  const isFor = take.side === 'blue'
  const Icon = isFor ? ThumbsUp : ThumbsDown
  const label = isFor ? 'Standout FOR Take' : 'Standout AGAINST Take'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-4',
        isFor
          ? 'bg-for-950/40 border-for-800/20'
          : 'bg-against-950/40 border-against-800/20',
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg',
            isFor ? 'bg-for-500/10' : 'bg-against-500/10',
          )}
        >
          <MessageSquare
            className={cn('h-3.5 w-3.5', isFor ? 'text-for-500' : 'text-against-500')}
            aria-hidden="true"
          />
        </div>
        <div className="flex-1">
          <p
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest',
              isFor ? 'text-for-500' : 'text-against-500',
            )}
          >
            {label}
          </p>
        </div>
        <span
          className={cn(
            'flex items-center gap-1 text-[10px] font-mono font-bold',
            isFor ? 'text-for-500' : 'text-against-500',
          )}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
      </div>

      <blockquote
        className={cn(
          'text-sm leading-relaxed font-mono pl-3 border-l-2',
          isFor ? 'text-for-200 border-for-700/40' : 'text-against-200 border-against-700/40',
        )}
      >
        &ldquo;{take.reason}&rdquo;
      </blockquote>

      <AuthorLine author={take.author} timestamp={take.created_at} />
    </motion.div>
  )
}

function FirstVoterCard({
  firstVote,
  index,
}: {
  firstVote: HighlightFirstVoter
  index: number
}) {
  const isFor = firstVote.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: 'easeOut' }}
      className="rounded-2xl border border-gold/20 bg-gold/5 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15">
          <Zap className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gold">
          First Vote Cast
        </p>
      </div>

      <div className="flex items-center gap-3">
        {firstVote.author ? (
          <Link href={`/profile/${firstVote.author.username}`} className="flex items-center gap-3 group flex-1 min-w-0">
            <Avatar
              src={firstVote.author.avatar_url}
              fallback={firstVote.author.display_name || firstVote.author.username}
              size="md"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white group-hover:text-gold transition-colors truncate">
                {firstVote.author.display_name || firstVote.author.username}
              </p>
              <p className="text-[11px] font-mono text-surface-500 truncate">
                @{firstVote.author.username}
              </p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-full bg-surface-300 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-surface-500" />
            </div>
            <p className="text-sm font-semibold text-surface-500">Anonymous voter</p>
          </div>
        )}

        <div className="flex flex-col items-end flex-shrink-0 gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold',
              isFor
                ? 'bg-for-500/15 text-for-400'
                : 'bg-against-500/15 text-against-400',
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ThumbsDown className="h-3 w-3" aria-hidden="true" />
            )}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          <span className="text-[10px] font-mono text-surface-600">
            {relativeTime(firstVote.created_at)}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Stat strip ───────────────────────────────────────────────────────────────

function StatStrip({
  data,
  topicId,
}: {
  data: HighlightsResponse
  topicId: string
}) {
  const { stats, topic } = data
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const items = [
    { label: 'Total votes', value: topic.total_votes.toLocaleString(), href: `/topic/${topicId}/voters` },
    { label: 'FOR', value: `${forPct}%`, color: 'text-for-400', href: `/topic/${topicId}/vote-trend` },
    { label: 'AGAINST', value: `${againstPct}%`, color: 'text-against-400', href: `/topic/${topicId}/vote-trend` },
    { label: 'Arguments', value: stats.total_arguments.toLocaleString(), href: `/topic/${topicId}/arguments` },
    { label: 'Last 24 h', value: `+${stats.votes_past_24h}`, color: 'text-emerald', href: `/topic/${topicId}/pulse` },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="grid grid-cols-5 gap-px bg-surface-300/30 rounded-2xl overflow-hidden border border-surface-300/30"
    >
      {items.map(({ label, value, color, href }) => (
        <Link
          key={label}
          href={href}
          className="flex flex-col items-center py-3 px-1 bg-surface-100 hover:bg-surface-200 transition-colors group"
        >
          <span className={cn('text-base font-bold tabular-nums font-mono', color ?? 'text-white')}>
            {value}
          </span>
          <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5 text-center">
            {label}
          </span>
        </Link>
      ))}
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-px bg-surface-300/30 rounded-2xl overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface-100 py-3 flex flex-col items-center gap-1.5">
            <Skeleton className="h-4 w-10 rounded" />
            <Skeleton className="h-2 w-8 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300/30 bg-surface-200/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HighlightsClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: HighlightsClientProps) {
  const [data, setData] = useState<HighlightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/topics/${topicId}/highlights`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load'))))
      .then((d: HighlightsResponse) => {
        if (!cancelled) { setData(d); setLoading(false) }
      })
      .catch((err: Error) => {
        if (!cancelled) { setError(err.message); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [topicId])

  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const hasAnyHighlight = data && (
    data.top_for_argument ||
    data.top_against_argument ||
    data.first_vote ||
    data.notable_for_take ||
    data.notable_against_take
  )

  // Build an ordered list of highlight cards to render
  const cards: ReactNode[] = []
  if (data) {
    let cardIndex = 0
    if (data.top_for_argument) {
      cards.push(
        <ArgumentHighlightCard key="for-arg" arg={data.top_for_argument} side="blue" index={cardIndex++} topicId={topicId} />
      )
    }
    if (data.top_against_argument) {
      cards.push(
        <ArgumentHighlightCard key="against-arg" arg={data.top_against_argument} side="red" index={cardIndex++} topicId={topicId} />
      )
    }
    if (data.first_vote) {
      cards.push(
        <FirstVoterCard key="first-vote" firstVote={data.first_vote} index={cardIndex++} />
      )
    }
    if (data.notable_for_take) {
      cards.push(
        <TakeCard key="for-take" take={data.notable_for_take} index={cardIndex++} />
      )
    }
    if (data.notable_against_take) {
      cards.push(
        <TakeCard key="against-take" take={data.notable_against_take} index={cardIndex++} />
      )
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-2xl mx-auto px-4 pt-6">

          {/* Header */}
          <div className="flex items-start gap-3 mb-5">
            <Link
              href={`/topic/${topicId}`}
              aria-label="Back to topic"
              className="flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <Award className="h-4 w-4 text-gold flex-shrink-0" aria-hidden="true" />
                <h1 className="text-lg font-bold text-white tracking-tight">Highlights</h1>
                <Badge variant={STATUS_BADGE[status] ?? 'proposed'} className="flex-shrink-0">
                  {status.toUpperCase()}
                </Badge>
                {category && (
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    {category}
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500 font-mono line-clamp-2 leading-relaxed">
                {statement}
              </p>
            </div>
          </div>

          {/* Vote split bar */}
          {totalVotes > 0 && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0.95 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.3 }}
              className="mb-5 rounded-xl bg-surface-200/60 border border-surface-300/40 px-4 py-3"
            >
              <div className="flex justify-between text-[11px] font-mono mb-1.5">
                <span className="text-for-400 font-bold">FOR {forPct}%</span>
                <span className="text-surface-500">{totalVotes.toLocaleString()} votes</span>
                <span className="text-against-400 font-bold">AGAINST {againstPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-against-900/60 overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full transition-all duration-700"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </motion.div>
          )}

          {/* Content */}
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="text-center py-16 text-surface-500 text-sm font-mono">{error}</div>
          ) : !hasAnyHighlight ? (
            <EmptyState
              icon={Award}
              title="No highlights yet"
              description="Cast your vote and share a reason — be the first to make history on this topic."
              actions={[
                { label: 'Cast a vote', href: `/topic/${topicId}` },
                { label: 'View arguments', href: `/topic/${topicId}/arguments` },
              ]}
            />
          ) : (
            <div className="space-y-4">
              {/* Stats strip */}
              <StatStrip data={data!} topicId={topicId} />

              {/* Highlight cards */}
              {cards}
            </div>
          )}

          {/* Footer links */}
          {!loading && !error && hasAnyHighlight && (
            <div className="mt-8 mb-4 flex items-center justify-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
              <Link href={`/topic/${topicId}`} className="hover:text-white transition-colors">
                ← Back to topic
              </Link>
              <Link href={`/topic/${topicId}/quotes`} className="hover:text-white transition-colors">
                Top arguments
              </Link>
              <Link href={`/topic/${topicId}/hot-takes`} className="hover:text-white transition-colors">
                Hot takes
              </Link>
              <Link href={`/topic/${topicId}/stats`} className="hover:text-white transition-colors">
                Full stats
              </Link>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
