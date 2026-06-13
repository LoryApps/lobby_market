'use client'

/**
 * /law/[id]/debate — The Founding Debate Record
 *
 * Every established law began as a contested debate. This page presents
 * the civic record of how this law came to be: the top FOR and AGAINST
 * arguments that shaped the community vote, the debate duration, and the
 * final margin that turned opinion into policy.
 *
 * Distinct from:
 *   /law/[id]/impact    — vote trajectory and quantitative stats
 *   /law/[id]/community — ongoing amendments + blueprint notes
 *   /law/[id]/reviews   — post-establishment citizen ratings
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawDebateRecord, DebateArgument } from '@/app/api/laws/[id]/debate/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  index,
  topicId,
}: {
  arg: DebateArgument
  index: number
  topicId: string | null
}) {
  const isFor = arg.side === 'blue'
  const [expanded, setExpanded] = useState(false)
  const isLong = arg.content.length > 280

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'relative rounded-2xl border p-5 transition-colors group',
        isFor
          ? 'bg-for-600/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-600/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Rank badge */}
      {index < 3 && (
        <div
          className={cn(
            'absolute -top-2 -right-2 flex items-center justify-center h-6 w-6 rounded-full border text-[10px] font-mono font-bold',
            index === 0
              ? 'bg-gold/20 border-gold/50 text-gold'
              : index === 1
              ? 'bg-surface-400/20 border-surface-400/50 text-surface-400'
              : 'bg-against-700/20 border-against-700/50 text-against-400'
          )}
        >
          {index + 1}
        </div>
      )}

      {/* Author row */}
      <div className="flex items-center gap-3 mb-3">
        {arg.author ? (
          <Link href={`/profile/${arg.author.username}`} className="flex items-center gap-2 min-w-0 group/author">
            <Avatar
              src={arg.author.avatar_url}
              fallback={arg.author.display_name ?? arg.author.username}
              size="sm"
              className="flex-shrink-0"
            />
            <div className="min-w-0">
              <span className="text-xs font-mono font-semibold text-white group-hover/author:text-for-300 transition-colors truncate block">
                {arg.author.display_name ?? arg.author.username}
              </span>
              <span className="text-[10px] font-mono text-surface-500 truncate block">
                @{arg.author.username} · {relTime(arg.created_at)}
              </span>
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-surface-300 flex-shrink-0" />
            <span className="text-xs font-mono text-surface-500">Anonymous · {relTime(arg.created_at)}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {arg.ai_score !== null && (
            <span
              className={cn(
                'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                arg.ai_score >= 80
                  ? 'bg-emerald/10 border-emerald/30 text-emerald'
                  : arg.ai_score >= 60
                  ? 'bg-for-600/10 border-for-500/30 text-for-400'
                  : 'bg-surface-300/30 border-surface-400/30 text-surface-500'
              )}
            >
              AI {arg.ai_score}
            </span>
          )}
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-mono font-semibold',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            {isFor ? <ThumbsUp className="h-3.5 w-3.5" /> : <ThumbsDown className="h-3.5 w-3.5" />}
            {arg.upvotes}
          </span>
        </div>
      </div>

      {/* Content */}
      <p
        className={cn(
          'text-sm text-surface-100 leading-relaxed',
          !expanded && isLong && 'line-clamp-4'
        )}
      >
        {arg.content}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'mt-2 text-[11px] font-mono transition-colors',
            isFor ? 'text-for-400 hover:text-for-300' : 'text-against-400 hover:text-against-300'
          )}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* View in context link */}
      {topicId && (
        <Link
          href={`/topic/${topicId}#arg-${arg.id}`}
          className={cn(
            'mt-3 flex items-center gap-1 text-[10px] font-mono transition-colors opacity-0 group-hover:opacity-100',
            isFor ? 'text-for-500 hover:text-for-400' : 'text-against-500 hover:text-against-400'
          )}
        >
          <ExternalLink className="h-3 w-3" />
          View in topic debate
        </Link>
      )}
    </motion.div>
  )
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function FinalVoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-mono mb-1">
        <span className="text-for-400 font-bold">{forPct}% FOR</span>
        <span className="text-against-400 font-bold">{againstPct}% AGAINST</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="absolute inset-y-0 right-0 bg-gradient-to-l from-against-600 to-against-400 rounded-r-full"
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <p className="text-[10px] font-mono text-surface-500 text-center">
        Final vote distribution when established as law
      </p>
    </div>
  )
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function DebateRecordSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-8 w-full rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawDebatePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<LawDebateRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'for' | 'against' | 'all'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/debate`)
      if (!res.ok) throw new Error('Failed to load debate record')
      const json = await res.json() as LawDebateRecord
      setData(json)
    } catch {
      setError('Could not load the founding debate record.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const forArgs = data?.arguments.for ?? []
  const againstArgs = data?.arguments.against ?? []

  const displayedFor = activeTab === 'against' ? [] : forArgs
  const displayedAgainst = activeTab === 'for' ? [] : againstArgs

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/law/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 text-sm font-mono text-surface-500 min-w-0">
            <Link href="/law" className="hover:text-white transition-colors">Codex</Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            {data?.law ? (
              <Link href={`/law/${id}`} className="hover:text-white transition-colors truncate">
                {data.law.statement.slice(0, 50)}{data.law.statement.length > 50 ? '…' : ''}
              </Link>
            ) : (
              <span className="text-surface-600">Law</span>
            )}
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-white font-semibold">Founding Debate</span>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Page header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-for-600/10 border border-for-500/20 flex-shrink-0 mt-0.5">
            <Scale className="h-6 w-6 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white leading-tight">
              Founding Debate
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              The arguments that shaped this law — ranked by community approval
            </p>
          </div>
        </div>

        {loading && <DebateRecordSkeleton />}

        {error && (
          <EmptyState
            icon={Scale}
            iconColor="text-against-400/60"
            iconBg="bg-against-600/10"
            iconBorder="border-against-500/20"
            title="Failed to load debate record"
            description={error}
            actions={[{ label: 'Try again', onClick: load }]}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {/* Law summary card */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald/10 border border-emerald/30 flex-shrink-0">
                  <Gavel className="h-5 w-5 text-emerald" />
                </div>
                <div className="flex-1 min-w-0">
                  <Badge variant="law" className="mb-2">Established Law</Badge>
                  <h2 className="text-base font-semibold text-white leading-snug">
                    {data.law.statement}
                  </h2>
                  <div className="mt-2 flex items-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
                    {data.law.category && (
                      <span className="uppercase tracking-wider">{data.law.category}</span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Established {formatDate(data.law.established_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {data.law.total_votes.toLocaleString()} votes
                    </span>
                    {data.stats.debate_duration_days !== null && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {data.stats.debate_duration_days}d debate
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/law/${id}`}
                  className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
                >
                  Read law <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {/* Final vote bar */}
              <FinalVoteBar bluePct={data.law.blue_pct} />
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'Total Arguments',
                  value: data.stats.total_arguments.toLocaleString(),
                  icon: MessageSquare,
                  color: 'text-surface-300',
                  bg: 'bg-surface-200',
                  border: 'border-surface-300',
                },
                {
                  label: 'FOR Arguments',
                  value: data.arguments.for.length.toLocaleString(),
                  icon: ThumbsUp,
                  color: 'text-for-400',
                  bg: 'bg-for-600/10',
                  border: 'border-for-500/20',
                },
                {
                  label: 'AGAINST Arguments',
                  value: data.arguments.against.length.toLocaleString(),
                  icon: ThumbsDown,
                  color: 'text-against-400',
                  bg: 'bg-against-600/10',
                  border: 'border-against-500/20',
                },
                {
                  label: 'Top Upvotes',
                  value: Math.max(data.stats.top_for_upvotes, data.stats.top_against_upvotes).toLocaleString(),
                  icon: TrendingUp,
                  color: 'text-gold',
                  bg: 'bg-gold/10',
                  border: 'border-gold/20',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={cn('rounded-xl border p-4', stat.bg, stat.border)}
                >
                  <stat.icon className={cn('h-4 w-4 mb-2', stat.color)} />
                  <p className={cn('text-xl font-mono font-bold', stat.color)}>{stat.value}</p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Link to original topic */}
            {data.topic && (
              <Link
                href={`/topic/${data.topic.id}`}
                className="flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 hover:border-surface-400 transition-colors group"
              >
                <BookOpen className="h-4 w-4 text-surface-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-surface-500">Original debate topic</p>
                  <p className="text-sm text-white truncate group-hover:text-for-300 transition-colors">
                    {data.topic.statement}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
              </Link>
            )}

            {/* Filter tabs */}
            {data.stats.total_arguments > 0 && (
              <div className="flex items-center gap-2">
                {(
                  [
                    { key: 'all', label: 'All Arguments' },
                    { key: 'for', label: 'FOR' },
                    { key: 'against', label: 'AGAINST' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-xs font-mono font-medium transition-colors',
                      activeTab === tab.key
                        ? tab.key === 'for'
                          ? 'bg-for-600/20 border border-for-500/40 text-for-300'
                          : tab.key === 'against'
                          ? 'bg-against-600/20 border border-against-500/40 text-against-300'
                          : 'bg-surface-200 border border-surface-400 text-white'
                        : 'bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                <span className="ml-auto text-xs font-mono text-surface-500">
                  Ranked by community upvotes
                </span>
              </div>
            )}

            {/* Arguments grid */}
            {data.stats.total_arguments === 0 ? (
              <EmptyState
                icon={MessageSquare}
                iconColor="text-surface-500"
                iconBg="bg-surface-200"
                iconBorder="border-surface-300"
                title="No debate arguments on record"
                description="This law may have been established before argument tracking was enabled, or the original topic had no arguments."
                actions={data.topic ? [{ label: 'View original topic', href: `/topic/${data.topic.id}` }] : []}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* FOR column */}
                {activeTab !== 'against' && displayedFor.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ThumbsUp className="h-4 w-4 text-for-400" />
                      <h3 className="text-xs font-mono font-semibold text-for-400 uppercase tracking-wider">
                        Top FOR Arguments
                      </h3>
                      <span className="text-[10px] font-mono text-surface-600">({forArgs.length})</span>
                    </div>
                    <AnimatePresence mode="popLayout">
                      {displayedFor.map((arg, i) => (
                        <ArgumentCard key={arg.id} arg={arg} index={i} topicId={data.topic?.id ?? null} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* AGAINST column */}
                {activeTab !== 'for' && displayedAgainst.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ThumbsDown className="h-4 w-4 text-against-400" />
                      <h3 className="text-xs font-mono font-semibold text-against-400 uppercase tracking-wider">
                        Top AGAINST Arguments
                      </h3>
                      <span className="text-[10px] font-mono text-surface-600">({againstArgs.length})</span>
                    </div>
                    <AnimatePresence mode="popLayout">
                      {displayedAgainst.map((arg, i) => (
                        <ArgumentCard key={arg.id} arg={arg} index={i} topicId={data.topic?.id ?? null} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {/* Full-width when single side */}
                {activeTab === 'all' && displayedFor.length === 0 && displayedAgainst.length === 0 && (
                  <div className="col-span-2">
                    <EmptyState
                      icon={MessageSquare}
                      title="No arguments found"
                      description="No arguments have been recorded for this debate."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Award: top contributors */}
            {(forArgs.length > 0 || againstArgs.length > 0) && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-mono font-semibold text-white">Top Debate Contributors</h3>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[...forArgs.slice(0, 3), ...againstArgs.slice(0, 3)]
                    .filter((a) => a.author)
                    .sort((a, b) => b.upvotes - a.upvotes)
                    .slice(0, 6)
                    .map((arg) => (
                      <Link
                        key={arg.id}
                        href={`/profile/${arg.author!.username}`}
                        className="flex items-center gap-2 rounded-lg bg-surface-200 border border-surface-300 px-3 py-2 hover:border-surface-400 transition-colors group/contrib"
                      >
                        <Avatar
                          src={arg.author!.avatar_url}
                          fallback={arg.author!.display_name ?? arg.author!.username}
                          size="sm"
                        />
                        <div>
                          <p className="text-xs font-mono font-semibold text-white group-hover/contrib:text-for-300 transition-colors">
                            {arg.author!.display_name ?? arg.author!.username}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500">
                            {arg.upvotes} upvotes · {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
                          </p>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
