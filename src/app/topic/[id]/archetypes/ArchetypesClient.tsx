'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicArchetypesResponse, ArchetypeBreakdown } from '@/app/api/topics/[id]/archetypes/route'

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ forPct, total }: { forPct: number; total: number }) {
  const againstPct = 100 - forPct
  const isFor = forPct >= 50

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className={cn('text-xs font-mono font-bold tabular-nums', isFor ? 'text-for-300' : 'text-surface-500')}>
          {forPct}% FOR
        </span>
        <span className={cn('text-xs font-mono text-surface-500 tabular-nums')}>
          {total.toLocaleString()} votes
        </span>
        <span className={cn('text-xs font-mono font-bold tabular-nums', !isFor ? 'text-against-300' : 'text-surface-500')}>
          {againstPct}% AGN
        </span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-surface-200 gap-px">
        <motion.div
          className="bg-for-500 rounded-l-full"
          style={{ width: `${forPct}%` }}
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
        <motion.div
          className="bg-against-500 rounded-r-full flex-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        />
      </div>
    </div>
  )
}

// ─── Archetype card ───────────────────────────────────────────────────────────

function ArchetypeCard({
  arch,
  rank,
  isMostFor,
  isMostAgainst,
  isMostDivided,
  isViewer,
  viewerVoteSide,
  expanded,
  onToggle,
}: {
  arch: ArchetypeBreakdown
  rank: number
  isMostFor: boolean
  isMostAgainst: boolean
  isMostDivided: boolean
  isViewer: boolean
  viewerVoteSide: string | null
  expanded: boolean
  onToggle: () => void
}) {
  const hasVotes = arch.total > 0
  const majorityFor = arch.forPct >= 50
  const isDivided = Math.abs(50 - arch.forPct) < 10

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'rounded-2xl border transition-colors',
        isViewer
          ? 'bg-for-500/5 border-for-500/30'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
        !hasVotes && 'opacity-50'
      )}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        {/* Icon */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl text-lg',
            majorityFor && hasVotes
              ? 'bg-for-500/15 border border-for-500/30'
              : hasVotes
              ? 'bg-against-500/15 border border-against-500/30'
              : 'bg-surface-200 border border-surface-300'
          )}
        >
          {arch.icon}
        </div>

        {/* Name + labels */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-white">{arch.label}</span>
            {isViewer && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-for-500/20 text-for-300 border border-for-500/30">
                You
              </span>
            )}
            {isMostFor && hasVotes && (
              <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-for-600/20 text-for-200 border border-for-600/30">
                Most FOR
              </span>
            )}
            {isMostAgainst && hasVotes && (
              <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-against-600/20 text-against-200 border border-against-600/30">
                Most AGAINST
              </span>
            )}
            {isMostDivided && hasVotes && (
              <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-purple/20 text-purple border border-purple/30">
                Most divided
              </span>
            )}
          </div>
          {hasVotes ? (
            <div className="mt-2 pr-2">
              <VoteBar forPct={arch.forPct} total={arch.total} />
            </div>
          ) : (
            <p className="text-xs font-mono text-surface-500 mt-0.5">No archetype votes yet</p>
          )}
        </div>

        {/* Toggle arrow */}
        <div className="flex-shrink-0 text-surface-500">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-surface-300 pt-3 space-y-3">
              <p className="text-xs font-mono text-surface-400 leading-relaxed">
                {arch.description}
              </p>
              {hasVotes && (
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className={cn(
                      'rounded-xl p-3 border',
                      majorityFor
                        ? 'bg-for-500/10 border-for-500/30'
                        : 'bg-surface-200 border-surface-300'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ThumbsUp className="h-3 w-3 text-for-400" />
                      <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wider">
                        For
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-lg font-mono font-bold tabular-nums',
                        majorityFor ? 'text-for-300' : 'text-surface-400'
                      )}
                    >
                      {arch.forPct}%
                    </p>
                    <p className="text-xs font-mono text-surface-500">
                      {arch.forVotes.toLocaleString()} votes
                    </p>
                  </div>
                  <div
                    className={cn(
                      'rounded-xl p-3 border',
                      !majorityFor
                        ? 'bg-against-500/10 border-against-500/30'
                        : 'bg-surface-200 border-surface-300'
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <ThumbsDown className="h-3 w-3 text-against-400" />
                      <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wider">
                        Against
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-lg font-mono font-bold tabular-nums',
                        !majorityFor ? 'text-against-300' : 'text-surface-400'
                      )}
                    >
                      {arch.againstPct}%
                    </p>
                    <p className="text-xs font-mono text-surface-500">
                      {arch.againstVotes.toLocaleString()} votes
                    </p>
                  </div>
                </div>
              )}
              {isDivided && hasVotes && (
                <p className="text-[11px] font-mono text-purple/80 italic">
                  This archetype is nearly split — {arch.forPct}% FOR vs {arch.againstPct}% AGAINST.
                </p>
              )}
              {isViewer && viewerVoteSide && (
                <p className="text-[11px] font-mono text-for-300/80">
                  You voted {viewerVoteSide === 'for' ? 'FOR' : 'AGAINST'} this debate.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function ArchetypesClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}) {
  const [data, setData] = useState<TopicArchetypesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedArch, setExpandedArch] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/archetypes`)
      if (!res.ok) throw new Error('Failed to load archetype data')
      const json: TopicArchetypesResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load archetype breakdown.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const forPct = Math.round(bluePct)
  const statusLabel: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Law',
    failed: 'Failed',
  }
  const statusColor: Record<string, string> = {
    proposed: 'text-surface-400',
    active: 'text-for-400',
    voting: 'text-purple',
    law: 'text-gold',
    failed: 'text-surface-500',
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-400 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>

        {/* Topic header */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className={cn('text-xs font-mono font-bold uppercase tracking-widest', statusColor[status] ?? 'text-surface-400')}>
              {statusLabel[status] ?? status}
            </span>
            {category && (
              <Badge variant="category" className="text-xs">
                {category}
              </Badge>
            )}
          </div>
          <p className="font-mono text-base font-semibold text-white leading-snug mb-4">
            {statement}
          </p>

          {/* Overall vote bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono tabular-nums">
              <span className="text-for-300 font-bold">{forPct}% FOR</span>
              <span className="text-surface-500">{totalVotes.toLocaleString()} votes</span>
              <span className="text-against-300 font-bold">{100 - forPct}% AGAINST</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-surface-200">
              <div className="bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
              <div className="bg-against-500 rounded-r-full flex-1" />
            </div>
          </div>
        </div>

        {/* Page title */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30">
              <Users className="h-4 w-4 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold text-white">Archetype Breakdown</h1>
              <p className="text-xs font-mono text-surface-500">How each civic personality voted</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Coverage note */}
        {data && data.totalWithArchetype > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-surface-100 border border-surface-300 p-3 mb-4 flex items-start gap-3"
          >
            <Zap className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              <span className="text-white font-semibold">{data.totalWithArchetype.toLocaleString()}</span> of{' '}
              <span className="text-white font-semibold">{totalVotes.toLocaleString()}</span> voters (
              <span className="text-gold font-semibold">{data.pctWithArchetype}%</span>) have a civic
              archetype. Only their votes are shown here.{' '}
              <Link href="/archetype" className="text-for-400 hover:underline">
                Take the quiz
              </Link>{' '}
              to see where you fit.
            </p>
          </motion.div>
        )}

        {/* Viewer alignment */}
        {data?.viewerArchetype && data.viewerVoteSide && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl bg-for-500/5 border border-for-500/20 p-3 mb-4 flex items-start gap-3"
          >
            <Scale className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              You are a{' '}
              <span className="text-for-300 font-semibold capitalize">{data.viewerArchetype}</span> who
              voted{' '}
              <span className={cn('font-semibold', data.viewerVoteSide === 'for' ? 'text-for-300' : 'text-against-300')}>
                {data.viewerVoteSide === 'for' ? 'FOR' : 'AGAINST'}
              </span>{' '}
              this debate.
            </p>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <LoadingState />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="font-mono text-surface-400 text-sm">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-xs font-mono text-for-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : !data || data.archetypes.every((a) => a.total === 0) ? (
          <EmptyState
            icon={Users}
            title="No archetype data yet"
            description="Voters with a civic archetype haven't weighed in here yet. Be the first — vote, then take the archetype quiz."
            action={{ label: 'Take the Archetype Quiz', href: '/archetype' }}
          />
        ) : (
          <div className="space-y-2">
            {data.archetypes.map((arch, i) => (
              <ArchetypeCard
                key={arch.archetype}
                arch={arch}
                rank={i}
                isMostFor={data.mostForArchetype === arch.archetype}
                isMostAgainst={data.mostAgainstArchetype === arch.archetype}
                isMostDivided={data.mostDividedArchetype === arch.archetype}
                isViewer={data.viewerArchetype === arch.archetype}
                viewerVoteSide={data.viewerArchetype === arch.archetype ? data.viewerVoteSide : null}
                expanded={expandedArch === arch.archetype}
                onToggle={() =>
                  setExpandedArch((prev) => (prev === arch.archetype ? null : arch.archetype))
                }
              />
            ))}
          </div>
        )}

        {/* Footer note */}
        {data && data.totalWithArchetype > 0 && (
          <div className="mt-6 pt-4 border-t border-surface-300 text-center">
            <p className="text-xs font-mono text-surface-500">
              Archetypes are set by users who complete the{' '}
              <Link href="/archetype" className="text-for-400 hover:underline">
                Civic Archetype Quiz
              </Link>
              .{' '}
              <Link href={`/topic/${topicId}/voters`} className="text-surface-400 hover:text-white">
                View all voters &rarr;
              </Link>
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
