'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawArchetypesResponse, ArchetypeBreakdown } from '@/app/api/laws/[id]/archetypes/route'

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
        <span className="text-xs font-mono text-surface-500 tabular-nums">
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
  const isSupporter = arch.forPct >= 60
  const isOpponent = arch.againstPct >= 60

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.25 }}
      className={cn(
        'rounded-2xl border transition-colors overflow-hidden',
        isViewer
          ? 'border-purple/50 bg-purple/5'
          : 'border-surface-300 bg-surface-100',
        !hasVotes && 'opacity-50',
      )}
    >
      <button
        onClick={onToggle}
        className="w-full p-4 text-left flex items-start gap-3"
        aria-expanded={expanded}
      >
        {/* Icon */}
        <span className="text-2xl leading-none flex-shrink-0 mt-0.5" role="img" aria-label={arch.label}>
          {arch.icon}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-mono font-bold text-white text-sm">{arch.label}</span>
            {isViewer && (
              <Badge variant="custom" className="bg-purple/20 text-purple border-purple/30 text-[10px]">
                Your archetype
              </Badge>
            )}
            {isMostFor && (
              <Badge variant="custom" className="bg-for-500/15 text-for-300 border-for-500/25 text-[10px]">
                Top supporter
              </Badge>
            )}
            {isMostAgainst && (
              <Badge variant="custom" className="bg-against-500/15 text-against-300 border-against-500/25 text-[10px]">
                Top opponent
              </Badge>
            )}
            {isMostDivided && (
              <Badge variant="custom" className="bg-surface-300/50 text-surface-400 border-surface-400/30 text-[10px]">
                Most divided
              </Badge>
            )}
          </div>

          {hasVotes ? (
            <VoteBar forPct={arch.forPct} total={arch.total} />
          ) : (
            <p className="text-xs font-mono text-surface-500">No votes recorded</p>
          )}
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0 text-surface-500 mt-0.5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs font-mono text-surface-400 leading-relaxed">
                {arch.description}
              </p>

              {hasVotes && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 bg-for-500/8 border border-for-500/20 rounded-xl p-3">
                    <ThumbsUp className="h-4 w-4 text-for-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-mono font-bold text-for-300">{arch.forVotes.toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-surface-500">voted FOR</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-against-500/8 border border-against-500/20 rounded-xl p-3">
                    <ThumbsDown className="h-4 w-4 text-against-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-mono font-bold text-against-300">{arch.againstVotes.toLocaleString()}</p>
                      <p className="text-[10px] font-mono text-surface-500">voted AGAINST</p>
                    </div>
                  </div>
                </div>
              )}

              {isViewer && viewerVoteSide && (
                <div className={cn(
                  'text-xs font-mono px-3 py-2 rounded-lg border',
                  viewerVoteSide === 'for'
                    ? 'bg-for-500/10 border-for-500/30 text-for-300'
                    : 'bg-against-500/10 border-against-500/30 text-against-300'
                )}>
                  You voted {viewerVoteSide === 'for' ? 'FOR' : 'AGAINST'} this law
                  {isSupporter && viewerVoteSide === 'for' && ' — aligned with your archetype'}
                  {isOpponent && viewerVoteSide === 'against' && ' — aligned with your archetype'}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
  initialStatement: string
  initialCategory: string | null
}

export function LawArchetypesClient({ lawId, initialStatement, initialCategory }: Props) {
  const [data, setData] = useState<LawArchetypesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [expandedArch, setExpandedArch] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/laws/${lawId}/archetypes`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as LawArchetypesResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const toggleArch = useCallback((arch: string) => {
    setExpandedArch((prev) => (prev === arch ? null : arch))
  }, [])

  const law = data?.law

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <div className="mb-5">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to law
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Gavel className="h-5 w-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white leading-snug">
              Archetype Breakdown
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Who championed and opposed this law
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh archetype data"
            className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Law statement */}
        <div className="mb-6 p-4 rounded-2xl bg-surface-100 border border-surface-300">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="law">LAW</Badge>
            {initialCategory && (
              <Badge variant="category">{initialCategory}</Badge>
            )}
          </div>
          <p className="font-mono text-white text-sm leading-relaxed">
            {law?.statement ?? initialStatement}
          </p>
          {law && (
            <div className="mt-3 pt-3 border-t border-surface-300 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                <span className="text-xs font-mono text-for-300">{Math.round(law.blue_pct)}% FOR</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-surface-400" />
                <span className="text-xs font-mono text-surface-400">{law.total_votes.toLocaleString()} votes</span>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={Scale}
            title="Could not load archetypes"
            description="We couldn't retrieve the civic archetype breakdown. Try refreshing."
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {/* Data */}
        {!loading && !error && data && (
          <>
            {/* Coverage stat */}
            {data.pctWithArchetype > 0 && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-surface-200/60 border border-surface-300 flex items-center gap-3">
                <Users className="h-4 w-4 text-surface-400 flex-shrink-0" />
                <p className="text-xs font-mono text-surface-400">
                  <span className="text-white font-bold">{data.pctWithArchetype}%</span> of voters
                  ({data.totalWithArchetype.toLocaleString()}) have a civic archetype on record
                </p>
              </div>
            )}

            {/* Summary badges */}
            {(data.mostForArchetype || data.mostAgainstArchetype) && (
              <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {data.mostForArchetype && (
                  <div className="px-3 py-2.5 rounded-xl bg-for-500/8 border border-for-500/20 flex items-center gap-2">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Top champion</p>
                      <p className="text-xs font-mono font-semibold text-for-300">
                        {data.archetypes.find(a => a.archetype === data.mostForArchetype)?.icon}{' '}
                        {data.archetypes.find(a => a.archetype === data.mostForArchetype)?.label}
                      </p>
                    </div>
                  </div>
                )}
                {data.mostAgainstArchetype && data.mostAgainstArchetype !== data.mostForArchetype && (
                  <div className="px-3 py-2.5 rounded-xl bg-against-500/8 border border-against-500/20 flex items-center gap-2">
                    <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Top opponent</p>
                      <p className="text-xs font-mono font-semibold text-against-300">
                        {data.archetypes.find(a => a.archetype === data.mostAgainstArchetype)?.icon}{' '}
                        {data.archetypes.find(a => a.archetype === data.mostAgainstArchetype)?.label}
                      </p>
                    </div>
                  </div>
                )}
                {data.mostDividedArchetype && (
                  <div className="px-3 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300 flex items-center gap-2">
                    <Scale className="h-3.5 w-3.5 text-surface-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Most divided</p>
                      <p className="text-xs font-mono font-semibold text-surface-300">
                        {data.archetypes.find(a => a.archetype === data.mostDividedArchetype)?.icon}{' '}
                        {data.archetypes.find(a => a.archetype === data.mostDividedArchetype)?.label}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Archetype cards */}
            <div className="space-y-2.5">
              {data.archetypes.map((arch, i) => (
                <ArchetypeCard
                  key={arch.archetype}
                  arch={arch}
                  rank={i}
                  isMostFor={data.mostForArchetype === arch.archetype}
                  isMostAgainst={data.mostAgainstArchetype === arch.archetype}
                  isMostDivided={data.mostDividedArchetype === arch.archetype}
                  isViewer={data.viewerArchetype === arch.archetype}
                  viewerVoteSide={data.viewerVoteSide}
                  expanded={expandedArch === arch.archetype}
                  onToggle={() => toggleArch(arch.archetype)}
                />
              ))}
            </div>

            {/* No archetype data */}
            {data.totalWithArchetype === 0 && (
              <div className="mt-4 p-4 rounded-xl bg-surface-200/40 border border-surface-300 text-center">
                <p className="text-xs font-mono text-surface-500">
                  No voters have completed their civic archetype profile yet.
                  Archetypes are set via{' '}
                  <Link href="/archetype" className="text-for-400 hover:underline">
                    /archetype
                  </Link>
                  .
                </p>
              </div>
            )}

            {/* Link to take the quiz */}
            {!data.viewerArchetype && (
              <div className="mt-5 p-4 rounded-xl bg-purple/8 border border-purple/25">
                <p className="text-sm font-mono text-white font-semibold mb-1">Discover your archetype</p>
                <p className="text-xs font-mono text-surface-400 mb-3">
                  Take the civic archetype quiz to see how your political personality compares to the builders of this law.
                </p>
                <Link
                  href="/archetype"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple/20 border border-purple/30 text-purple text-xs font-mono font-semibold hover:bg-purple/30 transition-colors"
                >
                  Take the quiz
                </Link>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
