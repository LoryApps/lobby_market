'use client'

/**
 * /topic/[id]/legacy — The Civic Legacy of a Resolved Debate
 *
 * Only available for topics with status = 'law' or 'failed'.
 *
 * Shows the LASTING IMPACT and HISTORICAL RECORD of a debate:
 *   - Legacy score and participation rank
 *   - Coalition victory / defeat records
 *   - Preserved memorial arguments (the definitive FOR / AGAINST)
 *   - Topics that cite this one as precedent
 *   - Continuation topics spawned from this debate
 *   - Historic context (platform & category law rates)
 *
 * Distinct from:
 *   /autopsy     — forensic HOW-did-it-happen analysis
 *   /resolution  — formal verdict display
 *   /recap       — contributor-level breakdown
 *   /impact      — argument-level reach and engagement
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Clock,
  Gavel,
  GitBranch,
  Globe,
  Landmark,
  Link2,
  MessageSquare,
  RefreshCw,
  Scale,
  Scroll,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Vote,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type {
  LegacyData,
  LegacyArgument,
  CoalitionRecord,
  CitingTopic,
} from '@/app/api/topics/[id]/legacy/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function abbreviateNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  proposed: { bg: 'bg-surface-300/60', text: 'text-surface-400', label: 'Proposed' },
  active: { bg: 'bg-for-500/15', text: 'text-for-400', label: 'Active' },
  voting: { bg: 'bg-gold/15', text: 'text-gold', label: 'Voting' },
  law: { bg: 'bg-emerald/15', text: 'text-emerald', label: 'LAW' },
  failed: { bg: 'bg-against-500/15', text: 'text-against-400', label: 'Failed' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-white',
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Award
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn('text-2xl font-bold tabular-nums', color)}>
        {typeof value === 'number' ? abbreviateNumber(value) : value}
      </p>
      {sub && <p className="text-[11px] text-surface-500 font-mono">{sub}</p>}
    </div>
  )
}

function MemorialArgCard({
  arg,
  side,
}: {
  arg: LegacyArgument
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-3',
        isFor
          ? 'bg-for-500/6 border-for-500/25'
          : 'bg-against-500/6 border-against-500/25'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
              isFor
                ? 'bg-for-500/15 text-for-400 border-for-500/30'
                : 'bg-against-500/15 text-against-400 border-against-500/30'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-3 w-3" />
            ) : (
              <ThumbsDown className="h-3 w-3" />
            )}
            Memorial FOR Argument
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-mono text-surface-400">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes.toLocaleString()}
        </div>
      </div>

      {/* Content */}
      <blockquote
        className={cn(
          'text-sm leading-relaxed border-l-2 pl-3 italic',
          isFor ? 'text-for-200 border-for-500/50' : 'text-against-200 border-against-500/50'
        )}
      >
        &ldquo;{arg.content.slice(0, 300)}
        {arg.content.length > 300 ? '…' : ''}&rdquo;
      </blockquote>

      {/* Author */}
      {arg.author_username && (
        <Link
          href={`/profile/${arg.author_username}`}
          className="flex items-center gap-2 group w-fit"
        >
          <Avatar
            src={arg.author_avatar_url}
            fallback={arg.author_display_name || arg.author_username}
            size="xs"
          />
          <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
            {arg.author_display_name || arg.author_username}
          </span>
          <span className="text-[10px] text-surface-600">·</span>
          <span className="text-[11px] text-surface-500 font-mono">
            {relativeTime(arg.created_at)}
          </span>
        </Link>
      )}
    </motion.div>
  )
}

function CoalitionRow({ coalition }: { coalition: CoalitionRecord }) {
  const isFor = coalition.stance === 'for'
  const isNeutral = coalition.stance === 'neutral'

  return (
    <Link
      href={`/coalitions/${coalition.id}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <div
        className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold border',
          coalition.aligned_with_outcome
            ? 'bg-emerald/15 border-emerald/30 text-emerald'
            : isNeutral
            ? 'bg-surface-300/60 border-surface-400/30 text-surface-400'
            : 'bg-against-500/15 border-against-500/30 text-against-400'
        )}
      >
        {coalition.aligned_with_outcome ? (
          <Trophy className="h-4 w-4" />
        ) : isNeutral ? (
          <Scale className="h-4 w-4" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
          {coalition.name}
        </p>
        <p className="text-xs font-mono text-surface-500">
          {coalition.member_count.toLocaleString()} members ·{' '}
          <span
            className={cn(
              isFor ? 'text-for-400' : isNeutral ? 'text-surface-400' : 'text-against-400'
            )}
          >
            {isFor ? 'FOR' : isNeutral ? 'NEUTRAL' : 'AGAINST'}
          </span>
        </p>
        {coalition.statement && (
          <p className="text-[11px] text-surface-500 italic mt-0.5 truncate">
            &ldquo;{coalition.statement}&rdquo;
          </p>
        )}
      </div>

      <div className="flex-shrink-0">
        <span
          className={cn(
            'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            coalition.aligned_with_outcome
              ? 'bg-emerald/15 text-emerald border-emerald/30'
              : isNeutral
              ? 'bg-surface-300/40 text-surface-500 border-surface-400/30'
              : 'bg-against-500/10 text-against-400 border-against-500/20'
          )}
        >
          {coalition.aligned_with_outcome
            ? 'Victory'
            : isNeutral
            ? 'Neutral'
            : 'Defeat'}
        </span>
      </div>
    </Link>
  )
}

function CitingTopicRow({ topic }: { topic: CitingTopic }) {
  const st = STATUS_STYLE[topic.status] ?? STATUS_STYLE.proposed
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white group-hover:text-for-300 transition-colors line-clamp-2 leading-snug">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
          )}
          <span
            className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full',
              st.bg,
              st.text
            )}
          >
            {st.label}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 flex items-center gap-1 text-[11px] font-mono tabular-nums mt-0.5">
        <span className="text-for-400">{Math.round(topic.blue_pct)}%</span>
        <span className="text-surface-600">/</span>
        <span className="text-against-400">{100 - Math.round(topic.blue_pct)}%</span>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LegacyClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<LegacyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/legacy`)
      if (res.status === 422) {
        setError('not_resolved')
        return
      }
      if (!res.ok) throw new Error('fetch_failed')
      const json = (await res.json()) as LegacyData
      setData(json)
    } catch {
      setError('server_error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const topic = data?.topic

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24 space-y-6">

        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {/* ── Loading ──────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ))}
          </div>
        )}

        {/* ── Not resolved ─────────────────────────────────────────────────── */}
        {!loading && error === 'not_resolved' && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-surface-200 border border-surface-300 flex items-center justify-center">
              <Clock className="h-6 w-6 text-surface-500" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Debate still active</p>
              <p className="text-sm text-surface-500 mt-1">
                The Legacy page is only available after a debate resolves.
              </p>
            </div>
            <Link
              href={`/topic/${topicId}`}
              className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-sm font-mono text-white transition-colors"
            >
              Go to debate
            </Link>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {!loading && error && error !== 'not_resolved' && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <p className="text-sm text-surface-500">Failed to load legacy data.</p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-sm font-mono text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {!loading && data && topic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* ── Hero card ─────────────────────────────────────────────────── */}
            <div
              className={cn(
                'rounded-3xl border p-6 space-y-5',
                topic.status === 'law'
                  ? 'bg-gradient-to-br from-emerald/8 via-surface-100 to-surface-100 border-emerald/25'
                  : 'bg-gradient-to-br from-against-500/8 via-surface-100 to-surface-100 border-against-500/25'
              )}
            >
              {/* Status badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border',
                    topic.status === 'law'
                      ? 'bg-emerald/15 text-emerald border-emerald/30'
                      : 'bg-against-500/15 text-against-400 border-against-500/30'
                  )}
                >
                  {topic.status === 'law' ? (
                    <Gavel className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                  {topic.status === 'law' ? 'Established Law' : 'Motion Failed'}
                </span>
                {topic.category && (
                  <span className="text-xs font-mono text-surface-500 px-2 py-1 rounded-full bg-surface-200/60 border border-surface-300/60">
                    {topic.category}
                  </span>
                )}
                <span className="text-xs font-mono text-surface-500">
                  {topic.established_at
                    ? `Resolved ${formatDate(topic.established_at)}`
                    : relativeTime(topic.created_at)}
                </span>
              </div>

              {/* Statement */}
              <h1 className="text-lg font-bold text-white leading-snug">
                {topic.statement}
              </h1>

              {/* Vote result bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-for-400 font-semibold">
                    {Math.round(topic.blue_pct)}% FOR
                  </span>
                  <span className="text-surface-500">
                    {abbreviateNumber(topic.total_votes)} total votes
                  </span>
                  <span className="text-against-400 font-semibold">
                    {100 - Math.round(topic.blue_pct)}% AGAINST
                  </span>
                </div>
                <div className="h-3 rounded-full overflow-hidden bg-against-900 flex">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000',
                      topic.status === 'law' ? 'bg-emerald' : 'bg-for-500'
                    )}
                    style={{ width: `${topic.blue_pct}%` }}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <Stat
                  icon={Vote}
                  label="Votes"
                  value={topic.total_votes}
                  sub={`top ${100 - data.participation_rank.percentile}% of debates`}
                  color={topic.status === 'law' ? 'text-emerald' : 'text-against-400'}
                />
                <Stat
                  icon={MessageSquare}
                  label="Arguments"
                  value={topic.total_arguments}
                  color="text-purple"
                />
                <Stat
                  icon={Globe}
                  label="Views"
                  value={topic.view_count}
                  color="text-for-300"
                />
                <Stat
                  icon={Clock}
                  label="Debate"
                  value={`${data.debate_days}d`}
                  sub="from proposal to verdict"
                  color="text-gold"
                />
              </div>
            </div>

            {/* ── Legacy score ───────────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
                    <Star className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Legacy Score</p>
                    <p className="text-[11px] text-surface-500 font-mono">votes + citations + engagement</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums text-gold">
                    {data.legacy_score.toLocaleString()}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500">
                    rank #{data.participation_rank.rank_position} of{' '}
                    {data.participation_rank.total_resolved.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Context pills */}
              <div className="flex flex-wrap gap-2">
                <span className="flex items-center gap-1 text-[11px] font-mono text-surface-400 bg-surface-200/80 border border-surface-300/60 px-2 py-1 rounded-full">
                  <BarChart2 className="h-3 w-3" />
                  Platform avg law rate:{' '}
                  <span className="text-white font-semibold">{data.platform_law_rate}%</span>
                </span>
                {data.category_law_rate !== null && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-surface-400 bg-surface-200/80 border border-surface-300/60 px-2 py-1 rounded-full">
                    <Landmark className="h-3 w-3" />
                    {topic.category} law rate:{' '}
                    <span className="text-white font-semibold">{data.category_law_rate}%</span>
                  </span>
                )}
                <span className="flex items-center gap-1 text-[11px] font-mono text-surface-400 bg-surface-200/80 border border-surface-300/60 px-2 py-1 rounded-full">
                  <Link2 className="h-3 w-3" />
                  Cited by{' '}
                  <span className="text-white font-semibold">{data.total_citations}</span>{' '}
                  {data.total_citations === 1 ? 'debate' : 'debates'}
                </span>
              </div>
            </div>

            {/* ── Memorial arguments ─────────────────────────────────────────── */}
            {(data.memorial_for_arg || data.memorial_against_arg) && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-purple/15 border border-purple/30 flex items-center justify-center">
                    <Scroll className="h-3.5 w-3.5 text-purple" />
                  </div>
                  <h2 className="text-sm font-semibold text-white">Memorial Arguments</h2>
                  <span className="text-[11px] font-mono text-surface-500">
                    Preserved civic artifacts
                  </span>
                </div>

                {data.memorial_for_arg && (
                  <MemorialArgCard arg={data.memorial_for_arg} side="for" />
                )}
                {data.memorial_against_arg && (
                  <MemorialArgCard arg={data.memorial_against_arg} side="against" />
                )}

                <Link
                  href={`/topic/${topicId}/arguments`}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-300 transition-colors"
                >
                  <ArrowRight className="h-3 w-3" />
                  View all{' '}
                  {topic.total_arguments.toLocaleString()} arguments
                </Link>
              </section>
            )}

            {/* ── Coalition records ─────────────────────────────────────────── */}
            {data.coalitions.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-for-500/15 border border-for-500/30 flex items-center justify-center">
                    <Users className="h-3.5 w-3.5 text-for-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-white">Coalition Records</h2>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono mb-1">
                  <span className="flex items-center gap-1 text-emerald">
                    <Trophy className="h-3 w-3" />
                    {data.winning_side_coalitions} victories
                  </span>
                  <span className="text-surface-600">·</span>
                  <span className="flex items-center gap-1 text-against-400">
                    <XCircle className="h-3 w-3" />
                    {data.losing_side_coalitions} defeats
                  </span>
                </div>

                <div className="space-y-2">
                  {data.coalitions.map((c) => (
                    <CoalitionRow key={c.id} coalition={c} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Citing topics ─────────────────────────────────────────────── */}
            {data.citing_topics.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center">
                      <Link2 className="h-3.5 w-3.5 text-gold" />
                    </div>
                    <h2 className="text-sm font-semibold text-white">Cited as Precedent</h2>
                  </div>
                  <span className="text-[11px] font-mono text-surface-500">
                    {data.total_citations} {data.total_citations === 1 ? 'debate' : 'debates'}
                  </span>
                </div>

                <div className="space-y-2">
                  {data.citing_topics.map((t) => (
                    <CitingTopicRow key={t.id} topic={t} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Continuation topics ────────────────────────────────────────── */}
            {data.continuation_topics.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-xl bg-emerald/15 border border-emerald/30 flex items-center justify-center">
                      <GitBranch className="h-3.5 w-3.5 text-emerald" />
                    </div>
                    <h2 className="text-sm font-semibold text-white">Debates Spawned</h2>
                  </div>
                  <span className="text-[11px] font-mono text-surface-500">
                    {data.total_continuations} continuation{data.total_continuations !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {data.continuation_topics.map((t) => (
                    <CitingTopicRow key={t.id} topic={t} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Footer links ───────────────────────────────────────────────── */}
            <div className="pt-4 border-t border-surface-300 flex flex-wrap gap-3">
              <Link
                href={`/topic/${topicId}/autopsy`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3 w-3" />
                Autopsy
              </Link>
              <Link
                href={`/topic/${topicId}/resolution`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Gavel className="h-3 w-3" />
                Resolution
              </Link>
              <Link
                href={`/topic/${topicId}/recap`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Users className="h-3 w-3" />
                Recap
              </Link>
              <Link
                href={`/topic/${topicId}/contributors`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Award className="h-3 w-3" />
                Top Voices
              </Link>
              <Link
                href={`/topic/${topicId}`}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to debate
              </Link>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
