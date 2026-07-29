'use client'

/**
 * /law/[id]/contributors — Founding Voices
 *
 * The civic record of who helped establish this law: the topic proposer,
 * top FOR arguers, and top AGAINST arguers ranked by upvotes earned.
 *
 * Distinct from:
 *   /law/[id]/debate     — the founding argument threads in full
 *   /law/[id]/community  — ongoing post-establishment activity
 *   /law/[id]/reviews    — citizen ratings after passage
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  ChevronRight,
  ExternalLink,
  Gavel,
  MessageSquare,
  RefreshCw,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ContributorsResponse, Contributor } from '@/app/api/laws/[id]/contributors/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const ROLE_BADGE: Record<string, { text: string; color: string }> = {
  elder:         { text: 'Elder',         color: 'text-gold' },
  senator:       { text: 'Senator',       color: 'text-purple' },
  lawmaker:      { text: 'Lawmaker',      color: 'text-gold' },
  debator:       { text: 'Debater',       color: 'text-for-300' },
  troll_catcher: { text: 'Troll Catcher', color: 'text-emerald' },
  person:        { text: 'Citizen',       color: 'text-surface-400' },
}

const MEDAL_COLORS = [
  'text-gold',          // 1st
  'text-surface-300',   // 2nd
  'text-amber-600',     // 3rd
]

// ─── Contributor Card ─────────────────────────────────────────────────────────

function ContributorCard({
  contributor,
  rank,
  side,
}: {
  contributor: Contributor
  rank: number
  side: 'for' | 'against'
}) {
  const isFor = side === 'for'
  const medalColor = MEDAL_COLORS[rank] ?? 'text-surface-400'
  const role = ROLE_BADGE[contributor.role] ?? ROLE_BADGE.person

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.04 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-4 flex gap-3',
        isFor
          ? 'border-for-500/20 hover:border-for-500/40'
          : 'border-against-500/20 hover:border-against-500/40',
        'transition-colors group'
      )}
    >
      {/* Rank medal */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
        {rank < 3 ? (
          <Trophy className={cn('h-4 w-4', medalColor)} />
        ) : (
          <span className={cn('text-xs font-mono font-bold', 'text-surface-500')}>
            #{rank + 1}
          </span>
        )}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${contributor.username}`} className="shrink-0">
        <Avatar
          src={contributor.avatar_url}
          username={contributor.username}
          size="md"
          className="hover:ring-2 hover:ring-for-500/50 transition-all"
        />
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link
              href={`/profile/${contributor.username}`}
              className="font-mono text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {contributor.display_name ?? contributor.username}
            </Link>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn('text-[11px] font-mono', role.color)}>
                {role.text}
              </span>
              <span className="text-surface-600 text-[11px]">·</span>
              <span className={cn(
                'text-[11px] font-mono font-semibold',
                isFor ? 'text-for-400' : 'text-against-400'
              )}>
                {isFor ? 'FOR' : 'AGAINST'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className={cn(
                'text-xs font-mono font-bold tabular-nums',
                isFor ? 'text-for-400' : 'text-against-400'
              )}>
                {formatNum(contributor.total_upvotes)}
              </div>
              <div className="text-[10px] font-mono text-surface-500">upvotes</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono font-bold tabular-nums text-white">
                {contributor.argument_count}
              </div>
              <div className="text-[10px] font-mono text-surface-500">args</div>
            </div>
          </div>
        </div>

        {/* Top argument snippet */}
        {contributor.top_argument && (
          <p className="text-[11px] font-mono text-surface-400 mt-2 line-clamp-2 leading-relaxed border-l-2 border-surface-300 pl-2">
            &ldquo;{contributor.top_argument.slice(0, 160)}{contributor.top_argument.length > 160 ? '…' : ''}&rdquo;
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ContributorSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-200 p-4 flex gap-3">
      <Skeleton className="h-4 w-4 rounded shrink-0" />
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LawContributorsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<ContributorsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'for' | 'against'>('for')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${id}/contributors`)
      if (!res.ok) throw new Error('Failed to load contributors')
      const json = (await res.json()) as ContributorsResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const law = data?.law
  const forPct = Math.round(law?.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const contributors = tab === 'for' ? data?.for_contributors : data?.against_contributors

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10">

        {/* Back link */}
        <Link
          href={`/law/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to law
        </Link>

        {/* Header */}
        <div className="mb-6">
          {loading ? (
            <>
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-6 w-full" />
            </>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key="header"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gold/10 border border-gold/30">
                    <Users className="h-4 w-4 text-gold" />
                  </div>
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                    Founding Voices
                  </span>
                </div>

                {law && (
                  <p className="font-mono text-sm text-surface-300 leading-relaxed line-clamp-2">
                    {law.statement}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Law stats banner */}
        {law && !loading && (
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="rounded-xl bg-surface-100 border border-surface-200 p-3 text-center">
              <div className="text-base font-mono font-bold text-for-400 tabular-nums">
                {formatNum(law.total_votes)}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">total votes</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-200 p-3 text-center">
              <div className="text-base font-mono font-bold text-white tabular-nums">
                {formatNum(data?.stats.total_arguers ?? 0)}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">arguers</div>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-200 p-3 text-center">
              <div className="text-base font-mono font-bold text-gold tabular-nums">
                {formatNum(data?.stats.total_upvotes ?? 0)}
              </div>
              <div className="text-[10px] font-mono text-surface-500 mt-0.5">upvotes earned</div>
            </div>
          </div>
        )}

        {/* Proposer card */}
        {data?.proposer && !loading && (
          <div className="mb-6">
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-surface-500 mb-3 flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-gold" />
              Topic Proposer
            </h2>
            <Link
              href={`/profile/${data.proposer.username}`}
              className="flex items-center gap-3 rounded-2xl bg-surface-100 border border-gold/20 hover:border-gold/40 p-4 transition-colors group"
            >
              <Avatar
                src={data.proposer.avatar_url}
                username={data.proposer.username}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm font-semibold text-white group-hover:text-gold transition-colors">
                  {data.proposer.display_name ?? data.proposer.username}
                </div>
                <div className={cn(
                  'text-xs font-mono mt-0.5',
                  ROLE_BADGE[data.proposer.role]?.color ?? 'text-surface-400'
                )}>
                  {ROLE_BADGE[data.proposer.role]?.text ?? 'Citizen'}
                </div>
                <div className="text-[11px] font-mono text-surface-500 mt-1">
                  Submitted the original topic proposal
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-gold transition-colors shrink-0" />
            </Link>
          </div>
        )}

        {/* Vote balance */}
        {law && !loading && (
          <div className="mb-6 rounded-2xl bg-surface-100 border border-surface-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                <span className="text-xs font-mono text-for-400 font-semibold">
                  {forPct}% FOR
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-against-400 font-semibold">
                  {againstPct}% AGAINST
                </span>
                <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
              </div>
            </div>
            <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-700"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] font-mono text-surface-500">
                {formatNum(data?.stats.total_for_args ?? 0)} arguments made
              </span>
              <span className="text-[10px] font-mono text-surface-500">
                {formatNum(data?.stats.total_against_args ?? 0)} arguments made
              </span>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('for')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono font-semibold border transition-all',
              tab === 'for'
                ? 'bg-for-600/20 border-for-500/50 text-for-300'
                : 'bg-surface-100 border-surface-200 text-surface-500 hover:text-white hover:border-surface-300'
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Top FOR Arguers
            {data && (
              <span className="ml-1 opacity-60">({data.for_contributors.length})</span>
            )}
          </button>
          <button
            onClick={() => setTab('against')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-mono font-semibold border transition-all',
              tab === 'against'
                ? 'bg-against-600/20 border-against-500/50 text-against-300'
                : 'bg-surface-100 border-surface-200 text-surface-500 hover:text-white hover:border-surface-300'
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            Top AGAINST Arguers
            {data && (
              <span className="ml-1 opacity-60">({data.against_contributors.length})</span>
            )}
          </button>
        </div>

        {/* Contributors list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => <ContributorSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/20 p-6 text-center space-y-3">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: tab === 'for' ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: tab === 'for' ? 10 : -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {!contributors || contributors.length === 0 ? (
                <EmptyState
                  icon={<Users className="h-7 w-7 text-surface-500" />}
                  title="No contributors recorded"
                  description="No arguments were found for this side of the debate."
                />
              ) : (
                contributors.map((c, i) => (
                  <ContributorCard key={c.id} contributor={c} rank={i} side={tab} />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer links */}
        {data && !loading && (
          <div className="mt-8 flex flex-col gap-2">
            {data.topic_id && (
              <Link
                href={`/topic/${data.topic_id}/arguments`}
                className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 px-4 py-3 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                    Browse all founding arguments
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
              </Link>
            )}
            <Link
              href={`/law/${id}/debate`}
              className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 px-4 py-3 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Gavel className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  View the founding debate record
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
            </Link>
            <Link
              href={`/law/${id}/quotes`}
              className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-200 hover:border-surface-300 px-4 py-3 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Award className="h-3.5 w-3.5 text-surface-500" />
                <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">
                  See the best debate quotes
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-500" />
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
