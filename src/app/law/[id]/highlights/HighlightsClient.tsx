'use client'

/**
 * /law/[id]/highlights — Founding Moments
 *
 * A retrospective hall-of-fame for each established law, surfacing
 * the most memorable moments from the debate that made it happen:
 *
 *  - The founding argument: top FOR argument by upvotes
 *  - The strongest opposition: top AGAINST argument by upvotes
 *  - The first voter who kicked off the debate
 *  - Standout community takes from each side
 *  - Key stats: total votes, final FOR %, arguments made, days to pass
 *
 * Distinct from:
 *   /law/[id]/quotes      — all high-rated arguments as shareable cards
 *   /law/[id]/reasons     — paginated vote reasons feed
 *   /law/[id]/voters      — full list of founding voters
 *   /law/[id]/scorecard   — law performance statistics
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Calendar,
  Clock,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LawHighlightsResponse,
  HighlightArgument,
  HighlightVote,
  HighlightFirstVoter,
} from '@/app/api/laws/[id]/highlights/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface HighlightsClientProps {
  lawId: string
  statement: string
  category: string | null
  establishedAt: string
  bluePct: number
  totalVotes: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

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

// ─── Grade badge ──────────────────────────────────────────────────────────────

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const color =
    grade === 'A' || grade === 'A+'
      ? 'text-emerald bg-emerald/10 border-emerald/20'
      : grade.startsWith('B')
        ? 'text-for-400 bg-for-400/10 border-for-400/20'
        : grade.startsWith('C')
          ? 'text-gold bg-gold/10 border-gold/20'
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

// ─── Argument highlight card ──────────────────────────────────────────────────

function ArgumentHighlightCard({
  arg,
  side,
  label,
  index,
  lawId,
}: {
  arg: HighlightArgument
  side: 'blue' | 'red'
  label: string
  index: number
  lawId: string
}) {
  const isFor = side === 'blue'
  const Icon = isFor ? ThumbsUp : ThumbsDown

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
          <div className="flex items-center gap-1.5 mt-0.5">
            <Icon className={cn('h-3 w-3', isFor ? 'text-for-500' : 'text-against-500')} aria-hidden="true" />
            <span className={cn('text-[10px] font-mono', isFor ? 'text-for-500' : 'text-against-500')}>
              {isFor ? 'FOR' : 'AGAINST'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {arg.ai_grade && <GradeBadge grade={arg.ai_grade} />}
          <div className="flex items-center gap-1 text-gold text-xs font-mono">
            <Award className="h-3 w-3" aria-hidden="true" />
            <span>{arg.upvotes}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <p
        className={cn(
          'text-sm leading-relaxed',
          isFor ? 'text-for-100' : 'text-against-100',
        )}
      >
        {arg.content}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-3">
        <AuthorLine author={arg.author} timestamp={arg.created_at} />
        {arg.reply_count > 0 && (
          <div className="ml-auto flex items-center gap-1 text-surface-600 text-[11px] font-mono">
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            <span>{arg.reply_count}</span>
          </div>
        )}
      </div>

      {/* Link to source topic */}
      <Link
        href={`/topic/${lawId.replace('/highlights', '')}`}
        className={cn(
          'inline-flex items-center gap-1.5 mt-3 px-2 py-1 rounded-lg text-[11px] font-mono transition-colors',
          isFor
            ? 'text-for-500 hover:text-for-300 hover:bg-for-500/10'
            : 'text-against-500 hover:text-against-300 hover:bg-against-500/10',
        )}
      >
        <Gavel className="h-3 w-3" aria-hidden="true" />
        View in debate record
      </Link>
    </motion.div>
  )
}

// ─── First voter card ─────────────────────────────────────────────────────────

function FirstVoterCard({
  vote,
  index,
}: {
  vote: HighlightFirstVoter
  index: number
}) {
  const isFor = vote.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: 'easeOut' }}
      className="rounded-2xl border border-gold/30 bg-gold/5 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold/15">
          <Award className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gold">First Voter</p>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">
            The first citizen to cast a vote on this debate
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {vote.author ? (
          <Link href={`/profile/${vote.author.username}`} className="flex items-center gap-3 group">
            <Avatar
              src={vote.author.avatar_url}
              fallback={vote.author.display_name || vote.author.username}
              size="sm"
            />
            <div>
              <p className="text-sm font-semibold text-white group-hover:text-gold transition-colors">
                {vote.author.display_name || vote.author.username}
              </p>
              <p className="text-[11px] text-surface-500">@{vote.author.username}</p>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-surface-300 flex items-center justify-center">
              <User className="h-4 w-4 text-surface-500" />
            </div>
            <span className="text-sm text-surface-500">Anonymous voter</span>
          </div>
        )}

        <div className="ml-auto flex flex-col items-end gap-1">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono font-bold border',
              isFor
                ? 'bg-for-500/15 border-for-500/30 text-for-400'
                : 'bg-against-500/15 border-against-500/30 text-against-400',
            )}
          >
            {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          <span className="text-[10px] font-mono text-surface-600">{relativeTime(vote.created_at)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Notable take card ────────────────────────────────────────────────────────

function NotableTakeCard({
  vote,
  side,
  label,
  index,
}: {
  vote: HighlightVote
  side: 'blue' | 'red'
  label: string
  index: number
}) {
  const isFor = side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl border p-4',
        isFor
          ? 'bg-for-900/15 border-for-800/25'
          : 'bg-against-900/15 border-against-800/25',
      )}
    >
      <p
        className={cn(
          'text-[10px] font-bold uppercase tracking-widest mb-3',
          isFor ? 'text-for-400' : 'text-against-400',
        )}
      >
        {label}
      </p>
      <blockquote
        className={cn(
          'text-sm leading-relaxed italic pl-3 border-l-2',
          isFor ? 'text-for-200 border-for-600' : 'text-against-200 border-against-600',
        )}
      >
        &ldquo;{vote.reason}&rdquo;
      </blockquote>
      <AuthorLine author={vote.author} timestamp={vote.created_at} />
    </motion.div>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatStrip({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: typeof Gavel
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-xl bg-surface-100 border border-surface-300">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl font-bold font-mono text-white tabular-nums">{value}</span>
    </div>
  )
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function HighlightsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <Skeleton className="h-3 w-28 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-5/6 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function HighlightsClient({
  lawId,
  statement,
  category,
  establishedAt,
  bluePct,
  totalVotes,
}: HighlightsClientProps) {
  const [data, setData] = useState<LawHighlightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/laws/${lawId}/highlights`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: LawHighlightsResponse) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [lawId])

  const forPct = Math.round(bluePct)

  const hasContent =
    data &&
    (data.founding_argument || data.strongest_opposition || data.first_vote || data.notable_for_take || data.notable_against_take)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-gold/10 border border-gold/30 flex-shrink-0">
                <Trophy className="h-3 w-3 text-gold" aria-hidden="true" />
              </div>
              <h1 className="text-sm font-bold text-white font-mono">Highlights</h1>
              {category && (
                <span className="text-[10px] font-mono text-surface-500">{category}</span>
              )}
            </div>
            <p className="text-xs text-surface-500 truncate" title={statement}>
              {statement.length > 80 ? `${statement.slice(0, 80)}…` : statement}
            </p>
          </div>
        </div>

        {/* Law established banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-gold/8 border border-gold/25 mb-6"
        >
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/15 flex-shrink-0">
            <Gavel className="h-5 w-5 text-gold" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gold">Established Law</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Calendar className="h-3 w-3 text-surface-500" aria-hidden="true" />
              <span className="text-[11px] font-mono text-surface-500">{formatDate(establishedAt)}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-lg font-bold font-mono text-for-400">{forPct}%</div>
            <div className="text-[10px] font-mono text-surface-500">FOR</div>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <HighlightsSkeleton />
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-surface-500 text-sm">Failed to load highlights.</p>
          </div>
        ) : !hasContent ? (
          <EmptyState
            icon="trophy"
            title="No highlights yet"
            description="Not enough debate activity to surface highlights for this law."
          />
        ) : (
          <div className="space-y-6">
            {/* Stats strip */}
            {data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatStrip
                  label="Total votes"
                  value={totalVotes.toLocaleString()}
                  icon={Scale}
                  color="text-for-400"
                />
                <StatStrip
                  label="FOR"
                  value={`${forPct}%`}
                  icon={ThumbsUp}
                  color="text-for-400"
                />
                <StatStrip
                  label="Arguments"
                  value={data.stats.total_arguments}
                  icon={MessageSquare}
                  color="text-purple"
                />
                <StatStrip
                  label="Days to pass"
                  value={data.law.days_to_pass}
                  icon={Clock}
                  color="text-gold"
                />
              </div>
            )}

            {/* Argument section header */}
            {(data?.founding_argument || data?.strongest_opposition) && (
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-surface-300" />
                <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest px-2">
                  Debate Record
                </span>
                <div className="h-px flex-1 bg-surface-300" />
              </div>
            )}

            {/* Founding argument */}
            {data?.founding_argument && (
              <ArgumentHighlightCard
                arg={data.founding_argument}
                side="blue"
                label="Founding Argument"
                index={0}
                lawId={lawId}
              />
            )}

            {/* Strongest opposition */}
            {data?.strongest_opposition && (
              <ArgumentHighlightCard
                arg={data.strongest_opposition}
                side="red"
                label="Strongest Opposition"
                index={1}
                lawId={lawId}
              />
            )}

            {/* First voter */}
            {data?.first_vote && (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-surface-300" />
                  <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest px-2">
                    First Mover
                  </span>
                  <div className="h-px flex-1 bg-surface-300" />
                </div>
                <FirstVoterCard vote={data.first_vote} index={2} />
              </>
            )}

            {/* Notable takes */}
            {(data?.notable_for_take || data?.notable_against_take) && (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-surface-300" />
                  <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest px-2">
                    Community Voice
                  </span>
                  <div className="h-px flex-1 bg-surface-300" />
                </div>

                {data.notable_for_take && (
                  <NotableTakeCard
                    vote={data.notable_for_take}
                    side="blue"
                    label="Notable FOR Take"
                    index={3}
                  />
                )}

                {data.notable_against_take && (
                  <NotableTakeCard
                    vote={data.notable_against_take}
                    side="red"
                    label="Notable AGAINST Take"
                    index={4}
                  />
                )}
              </>
            )}

            {/* Footer nav */}
            <div className="flex items-center justify-between pt-4 border-t border-surface-300">
              <Link
                href={`/law/${lawId}/voters`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
              >
                <Zap className="h-3 w-3" />
                All founding voters
              </Link>
              <Link
                href={`/law/${lawId}/quotes`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-gold transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                All quotes
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
