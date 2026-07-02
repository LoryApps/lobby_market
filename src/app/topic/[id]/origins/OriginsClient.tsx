'use client'

/**
 * /topic/[id]/origins — The Debate Genesis
 *
 * Traces the birth story of a civic debate: who proposed it, who argued
 * first, which voters showed up earliest, and how the vote evolved in its
 * opening days.
 *
 * Distinct from:
 *   /topic/[id]/timeline   — full history of status changes and milestones
 *   /topic/[id]/activity   — recent activity stream
 *   /topic/[id]/contributors — all contributors ranked by overall impact
 *   /topic/[id]/arguments   — current argument browser (top/new sorting)
 *
 * Origins answers: "How was this debate born? Who started it and who shaped
 * its earliest days?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  Crown,
  ExternalLink,
  Flame,
  Gavel,
  GitBranch,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { OriginsResponse, FoundingArgument, EarlyVoter } from '@/app/api/topics/[id]/origins/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function hoursAfterTopic(topicCreated: string, eventDate: string): string {
  const start = new Date(topicCreated)
  const event = new Date(eventDate)
  const diffMs = event.getTime() - start.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  if (diffHours === 0) return `${diffMins}m after proposal`
  if (diffHours < 24) return `${diffHours}h ${diffMins}m after proposal`
  const days = Math.floor(diffHours / 24)
  return `Day ${days + 1}`
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  person: { label: 'Citizen', color: 'text-surface-500' },
  debator: { label: 'Debator', color: 'text-for-400' },
  troll_catcher: { label: 'Troll Catcher', color: 'text-emerald' },
  elder: { label: 'Elder', color: 'text-gold' },
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500', bg: 'bg-surface-300/30' },
  active: { label: 'Active', color: 'text-for-400', bg: 'bg-for-500/10' },
  voting: { label: 'In Vote', color: 'text-gold', bg: 'bg-gold/10' },
  law: { label: 'Became Law', color: 'text-emerald', bg: 'bg-emerald/10' },
  failed: { label: 'Failed', color: 'text-against-400', bg: 'bg-against-500/10' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FoundingArgumentCard({
  arg,
  topicCreated,
  index,
}: {
  arg: FoundingArgument
  topicCreated: string
  index: number
}) {
  const isFor = arg.side === 'for'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'relative rounded-xl border p-4 transition-colors',
        isFor
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/40'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/40'
      )}
    >
      {/* Pioneer badges */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Ordinal badge */}
          <span
            className={cn(
              'flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-bold',
              index === 0
                ? 'bg-gold/20 text-gold'
                : index === 1
                ? 'bg-surface-400/30 text-surface-500'
                : index === 2
                ? 'bg-for-600/20 text-for-400'
                : 'bg-surface-300/20 text-surface-500'
            )}
          >
            #{index + 1}
          </span>

          {/* First FOR / first AGAINST badges */}
          {arg.is_first_for && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-for-500/15 border border-for-500/25 text-for-400 text-[10px] font-semibold tracking-wide uppercase">
              <Sparkles className="h-2.5 w-2.5" />
              First FOR
            </span>
          )}
          {arg.is_first_against && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-against-500/15 border border-against-500/25 text-against-400 text-[10px] font-semibold tracking-wide uppercase">
              <Sparkles className="h-2.5 w-2.5" />
              First AGAINST
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide',
              isFor
                ? 'bg-for-500/15 text-for-400 border border-for-500/25'
                : 'bg-against-500/15 text-against-400 border border-against-500/25'
            )}
          >
            {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {isFor ? 'For' : 'Against'}
          </span>
        </div>
      </div>

      {/* Argument content */}
      <p className="text-sm text-surface-700 leading-relaxed line-clamp-4 mb-3">
        {arg.content}
      </p>

      {/* Footer: author + timing + stats */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {arg.author_avatar_url !== undefined ? (
            <Avatar
              src={arg.author_avatar_url}
              fallback={arg.author_display_name || arg.author_username || '?'}
              size="xs"
            />
          ) : null}
          <div className="min-w-0">
            {arg.author_username ? (
              <Link
                href={`/profile/${arg.author_username}`}
                className="text-xs font-semibold text-white hover:text-for-400 transition-colors truncate block"
              >
                {arg.author_display_name || `@${arg.author_username}`}
              </Link>
            ) : (
              <span className="text-xs text-surface-500">Anonymous</span>
            )}
            <p className="text-[10px] text-surface-600 font-mono">
              {hoursAfterTopic(topicCreated, arg.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1 text-[11px] text-surface-500 font-mono">
            <ThumbsUp className="h-3 w-3" />
            {arg.upvotes}
          </span>
          {arg.reply_count > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-surface-500 font-mono">
              <MessageSquare className="h-3 w-3" />
              {arg.reply_count}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function PioneerVoterRow({
  voter,
  topicCreated,
}: {
  voter: EarlyVoter
  topicCreated: string
}) {
  const isFor = voter.side === 'for'
  const rankEmoji = voter.rank === 1 ? '🥇' : voter.rank === 2 ? '🥈' : voter.rank === 3 ? '🥉' : null

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300/30 last:border-0">
      <div className="flex items-center gap-2 w-7 shrink-0">
        {rankEmoji ? (
          <span className="text-sm">{rankEmoji}</span>
        ) : (
          <span className="text-xs font-mono text-surface-500 w-5 text-right">#{voter.rank}</span>
        )}
      </div>

      <Avatar
        src={voter.avatar_url}
        fallback={voter.display_name || voter.username || '?'}
        size="xs"
      />

      <div className="flex-1 min-w-0">
        {voter.username ? (
          <Link
            href={`/profile/${voter.username}`}
            className="text-xs font-semibold text-white hover:text-for-400 transition-colors truncate block"
          >
            {voter.display_name || `@${voter.username}`}
          </Link>
        ) : (
          <span className="text-xs text-surface-500">Anonymous</span>
        )}
        <p className="text-[10px] text-surface-600 font-mono">
          {hoursAfterTopic(topicCreated, voter.voted_at)}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-surface-500 font-mono">{voter.clout} clout</span>
        <span
          className={cn(
            'flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold',
            isFor
              ? 'bg-for-500/15 text-for-400 border border-for-500/25'
              : 'bg-against-500/15 text-against-400 border border-against-500/25'
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
      </div>
    </div>
  )
}

function VoteChart({ snapshots }: { snapshots: OriginsResponse['vote_snapshots'] }) {
  if (snapshots.length === 0) return null
  const maxTotal = Math.max(...snapshots.map(s => s.total), 1)

  return (
    <div className="space-y-1">
      {snapshots.map((snap, i) => {
        const forPct = snap.total > 0 ? (snap.for_count / snap.total) * 100 : 50
        const barWidth = (snap.total / maxTotal) * 100
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-surface-500 w-8 text-right shrink-0">
              D{snap.day + 1}
            </span>
            <div className="flex-1 h-3 bg-surface-300/30 rounded-full overflow-hidden" style={{ width: `${barWidth}%` }}>
              <div
                className="h-full bg-for-500/60 rounded-full transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-surface-500 w-10 shrink-0">
              {snap.total}v
            </span>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1 text-[10px] text-surface-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-for-500/60 inline-block" />FOR</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-against-500/60 inline-block" />AGAINST (bar remainder)</span>
        <span className="ml-auto">Bar width = relative vote volume</span>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-3/4 rounded-xl" />
      <Skeleton className="h-4 w-1/2 rounded-lg" />
      <div className="h-px bg-surface-300/30 my-4" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
}

export function OriginsClient({ topicId, topicStatement }: Props) {
  const router = useRouter()
  const [data, setData] = useState<OriginsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/origins`)
      if (!res.ok) throw new Error('Failed to load origins')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load debate origins. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <TopBar />

      <main className="flex-1 pb-24">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-surface-100/95 backdrop-blur-sm border-b border-surface-300/50 px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                aria-label="Go back"
                className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-gold shrink-0" />
                  <h1 className="text-sm font-semibold text-white truncate">Debate Origins</h1>
                </div>
                <p className="text-[11px] text-surface-500 truncate mt-0.5">{topicStatement}</p>
              </div>
              <button
                onClick={load}
                disabled={loading}
                aria-label="Refresh"
                className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 hover:text-white disabled:opacity-40"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={<BarChart2 className="h-8 w-8 text-surface-500" />}
                title="Couldn't load origins"
                description={error}
                action={<button onClick={load} className="text-for-400 text-sm hover:underline">Try again</button>}
              />
            </div>
          ) : data ? (
            <AnimatePresence mode="wait">
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-4 space-y-6"
              >
                {/* ── Topic summary ── */}
                <section>
                  <div className="rounded-2xl border border-surface-300/50 bg-surface-200/40 p-4 space-y-3">
                    {/* Status + age */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const st = STATUS_LABELS[data.topic.status] ?? STATUS_LABELS.proposed
                        return (
                          <span className={cn('flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border', st.bg, st.color, 'border-current/20')}>
                            {data.topic.status === 'law' ? <Gavel className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
                            {st.label}
                          </span>
                        )
                      })()}
                      {data.topic.category && (
                        <Badge variant="outline" size="sm">{data.topic.category}</Badge>
                      )}
                      {data.topic.scope && data.topic.scope !== 'Global' && (
                        <Badge variant="outline" size="sm">
                          <Globe className="h-2.5 w-2.5 mr-0.5" />{data.topic.scope}
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-white font-medium leading-snug">{data.topic.statement}</p>

                    {data.topic.description && (
                      <p className="text-xs text-surface-500 leading-relaxed line-clamp-2">{data.topic.description}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4 pt-1 text-xs text-surface-500 font-mono flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Proposed {formatDate(data.topic.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {data.topic.age_days === 0 ? 'Created today' : `${data.topic.age_days} days old`}
                      </span>
                    </div>
                  </div>
                </section>

                {/* ── Key stats bar ── */}
                <section>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 p-3 text-center">
                      <p className="text-lg font-mono font-bold text-for-400">
                        {Math.round(data.topic.blue_pct)}%
                      </p>
                      <p className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">Current FOR</p>
                    </div>
                    <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 p-3 text-center">
                      <p className="text-lg font-mono font-bold text-white">
                        {data.topic.total_votes.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">Total Votes</p>
                    </div>
                    <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 p-3 text-center">
                      <p className="text-lg font-mono font-bold text-purple">
                        {data.founding_arguments.length}
                      </p>
                      <p className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">Founding Args</p>
                    </div>
                  </div>
                </section>

                {/* ── Founder ── */}
                {data.founder && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Crown className="h-4 w-4 text-gold" />
                      <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Debate Founder</h2>
                    </div>
                    <Link
                      href={data.founder.username ? `/profile/${data.founder.username}` : '#'}
                      className="flex items-center gap-3 rounded-xl border border-surface-300/50 bg-surface-200/40 p-4 hover:border-surface-400/60 transition-colors group"
                    >
                      <Avatar
                        src={data.founder.avatar_url}
                        fallback={data.founder.display_name || data.founder.username || '?'}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
                          {data.founder.display_name || `@${data.founder.username}`}
                        </p>
                        <p className="text-xs text-surface-500 truncate">
                          @{data.founder.username} · {ROLE_LABELS[data.founder.role]?.label ?? 'Citizen'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-gold font-mono">{data.founder.clout.toLocaleString()} clout</span>
                          <span className="text-[11px] text-surface-500 font-mono">
                            {data.founder.total_topics_proposed} topic{data.founder.total_topics_proposed !== 1 ? 's' : ''} proposed
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors shrink-0" />
                    </Link>

                    <p className="text-xs text-surface-500 mt-2 px-1">
                      Proposed {timeAgo(data.topic.created_at)} — {formatDate(data.topic.created_at)}
                    </p>
                  </section>
                )}

                {/* ── First-week stats ── */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-gold" />
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Opening Week</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 p-3">
                      <p className="text-lg font-mono font-bold text-white">
                        {data.first_week_stats.arguments_in_week}
                      </p>
                      <p className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">Arguments</p>
                      <p className="text-[10px] text-surface-600 mt-0.5">posted in first 7 days</p>
                    </div>
                    <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 p-3">
                      <p className="text-lg font-mono font-bold text-white">
                        {data.first_week_stats.votes_in_week.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">Votes</p>
                      <p className="text-xs text-surface-600 mt-0.5 font-mono">
                        <span className="text-for-400">{data.first_week_stats.for_in_week} FOR</span>
                        {' · '}
                        <span className="text-against-400">{data.first_week_stats.against_in_week} AGAINST</span>
                      </p>
                    </div>
                  </div>

                  {data.first_week_stats.top_early_argument && (
                    <div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Trophy className="h-3.5 w-3.5 text-gold" />
                        <span className="text-[10px] font-semibold text-gold uppercase tracking-wide">Top Early Argument</span>
                      </div>
                      <p className="text-xs text-surface-600 leading-relaxed italic">
                        &ldquo;{data.first_week_stats.top_early_argument}{data.first_week_stats.top_early_argument.length >= 200 ? '…' : ''}&rdquo;
                      </p>
                    </div>
                  )}
                </section>

                {/* ── Vote evolution chart ── */}
                {data.vote_snapshots.length > 1 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="h-4 w-4 text-purple" />
                      <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
                        Vote Build-Up
                        <span className="text-surface-500 font-normal normal-case ml-2 text-xs">
                          (first {data.vote_snapshots.length} day{data.vote_snapshots.length !== 1 ? 's' : ''})
                        </span>
                      </h2>
                    </div>
                    <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 p-4">
                      <VoteChart snapshots={data.vote_snapshots} />
                    </div>
                  </section>
                )}

                {/* ── Founding arguments ── */}
                {data.founding_arguments.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-emerald" />
                        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">Founding Arguments</h2>
                      </div>
                      <Link
                        href={`/topic/${topicId}/arguments`}
                        className="text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                      >
                        All arguments <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <p className="text-xs text-surface-500 mb-3">
                      The first {data.founding_arguments.length} argument{data.founding_arguments.length !== 1 ? 's' : ''} that shaped this debate.
                    </p>
                    <div className="space-y-3">
                      {data.founding_arguments.map((arg, i) => (
                        <FoundingArgumentCard
                          key={arg.id}
                          arg={arg}
                          topicCreated={data.topic.created_at}
                          index={i}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* ── Pioneer voters ── */}
                {data.pioneer_voters.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-for-400" />
                      <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
                        Pioneer Voters
                        <span className="text-surface-500 font-normal normal-case ml-2 text-xs">
                          First {data.pioneer_voters.length} to cast a vote
                        </span>
                      </h2>
                    </div>
                    <div className="rounded-xl border border-surface-300/50 bg-surface-200/40 px-4 py-2">
                      {data.pioneer_voters.map(voter => (
                        <PioneerVoterRow
                          key={voter.user_id}
                          voter={voter}
                          topicCreated={data.topic.created_at}
                        />
                      ))}
                    </div>
                    {data.total_pioneers >= 20 && (
                      <p className="text-xs text-surface-500 text-center mt-2">
                        Showing first 20 pioneer voters · {data.topic.total_votes.toLocaleString()} total votes cast
                      </p>
                    )}
                  </section>
                )}

                {/* ── Empty state for no early activity ── */}
                {data.founding_arguments.length === 0 && data.pioneer_voters.length === 0 && (
                  <EmptyState
                    icon={<GitBranch className="h-8 w-8 text-surface-500" />}
                    title="This debate is just starting"
                    description="No arguments or votes recorded yet. Be the first to shape this debate's origin story."
                    action={
                      <Link
                        href={`/topic/${topicId}`}
                        className="flex items-center gap-1.5 text-sm font-semibold text-for-400 hover:text-for-300 transition-colors"
                      >
                        <Flame className="h-4 w-4" />
                        Jump into the debate
                      </Link>
                    }
                  />
                )}

                {/* ── Explore more ── */}
                <section className="border-t border-surface-300/30 pt-4">
                  <p className="text-xs text-surface-500 uppercase tracking-wide font-semibold mb-3">Continue exploring</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { href: `/topic/${topicId}/timeline`, label: 'Full Timeline', icon: Clock },
                      { href: `/topic/${topicId}/contributors`, label: 'Contributors', icon: Users },
                      { href: `/topic/${topicId}/arguments`, label: 'All Arguments', icon: BookOpen },
                      { href: `/topic/${topicId}/activity`, label: 'Recent Activity', icon: Flame },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2 rounded-lg border border-surface-300/50 bg-surface-200/30 p-3 hover:border-surface-400/60 hover:bg-surface-200/50 transition-colors text-xs font-medium text-surface-700 hover:text-white"
                      >
                        <Icon className="h-3.5 w-3.5 text-surface-500" />
                        {label}
                      </Link>
                    ))}
                  </div>
                </section>
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
