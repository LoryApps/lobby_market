'use client'

/**
 * /topic/[id]/swing — Swing Voter Analyzer
 *
 * Identifies which voter segments are most "in play" and what arguments
 * have the highest persuasion potential to flip the outcome.
 *
 * Distinct from:
 *   /archetypes    — static breakdown of who voted how
 *   /forecast      — AI prediction of future outcome
 *   /momentum      — rate-of-change chart
 *   /pressure      — political pressure indicators
 *   /versus        — FOR vs AGAINST argument comparison
 *
 * This page asks: "What would it TAKE to flip this debate?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Flame,
  RefreshCw,
  Scale,
  Shuffle,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  SwingResponse,
  SwingSegment,
  SwingArgument,
} from '@/app/api/topics/[id]/swing/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
  topicCategory: string | null
  topicStatus: string
}

// ─── Status pill ──────────────────────────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  proposed: 'bg-surface-300 text-surface-500',
  active:   'bg-for-500/20 text-for-300',
  voting:   'bg-purple/20 text-purple',
  law:      'bg-gold/20 text-gold',
  failed:   'bg-against-500/20 text-against-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function swingColor(score: number): string {
  if (score >= 70) return 'text-against-300 border-against-500/40 bg-against-500/10'
  if (score >= 40) return 'text-gold border-gold/40 bg-gold/10'
  return 'text-surface-500 border-surface-400/40 bg-surface-300/10'
}

function swingLabel(score: number): string {
  if (score >= 70) return 'Hot'
  if (score >= 40) return 'Warm'
  return 'Cold'
}

// ─── Persuasion Gap Hero ──────────────────────────────────────────────────────

function PersuasionGapHero({ data }: { data: SwingResponse }) {
  const { persuasionGap, topic } = data
  const forPct = topic.blue_pct
  const againstPct = 100 - forPct

  const isFor = forPct >= againstPct

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-200/60 p-5 space-y-4">
      {/* Split bar */}
      <div>
        <div className="flex justify-between text-xs font-mono font-bold mb-2">
          <span className="text-for-400">{forPct.toFixed(1)}% FOR</span>
          <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
          <span className="text-against-400">{againstPct.toFixed(1)}% AGAINST</span>
        </div>
        <div className="relative h-4 rounded-full overflow-hidden bg-surface-300/60 flex">
          <motion.div
            className="bg-for-500 rounded-l-full"
            style={{ width: `${forPct}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
          <div className="bg-against-500 rounded-r-full flex-1" />
          {/* 50% line */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/60" style={{ left: '50%' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-surface-600 font-mono">0%</span>
          <span className="text-[10px] text-surface-500 font-mono">50% flip</span>
          <span className="text-[10px] text-surface-600 font-mono">100%</span>
        </div>
      </div>

      {/* Key stat */}
      {persuasionGap.dominantSide !== 'tied' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-surface-300/60 bg-surface-300/40 p-3 text-center">
            <p className="text-2xl font-bold font-mono tabular-nums text-white">
              {persuasionGap.votesToFlip.toLocaleString()}
            </p>
            <p className="text-xs text-surface-500 mt-0.5">votes needed to flip</p>
          </div>
          <div className="rounded-xl border border-surface-300/60 bg-surface-300/40 p-3 text-center">
            <p
              className={cn(
                'text-2xl font-bold font-mono tabular-nums',
                isFor ? 'text-for-400' : 'text-against-400'
              )}
            >
              {persuasionGap.dominantPct.toFixed(1)}%
            </p>
            <p className="text-xs text-surface-500 mt-0.5">
              {isFor ? 'FOR' : 'AGAINST'} is leading
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-center">
          <p className="text-sm font-semibold text-gold">Dead heat — any argument could tip the balance</p>
        </div>
      )}
    </div>
  )
}

// ─── Momentum Panel ────────────────────────────────────────────────────────────

function MomentumPanel({ data }: { data: SwingResponse }) {
  const { momentum } = data

  const dirIcon =
    momentum.swingDirection === 'toward_for'
      ? TrendingUp
      : momentum.swingDirection === 'toward_against'
        ? TrendingDown
        : Scale

  const DirIcon = dirIcon

  const dirColor =
    momentum.swingDirection === 'toward_for'
      ? 'text-for-400'
      : momentum.swingDirection === 'toward_against'
        ? 'text-against-400'
        : 'text-surface-500'

  const dirLabel =
    momentum.swingDirection === 'toward_for'
      ? 'Shifting FOR'
      : momentum.swingDirection === 'toward_against'
        ? 'Shifting AGAINST'
        : 'Stable'

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-200/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-surface-500" />
        <h3 className="text-sm font-semibold text-white">Vote Momentum</h3>
        <Badge variant="surface" className="ml-auto text-[10px]">
          <DirIcon className={cn('h-3 w-3 mr-1', dirColor)} />
          {dirLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[momentum.early, momentum.recent].map((period, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border p-3',
              i === 1 && momentum.swingDirection !== 'stable'
                ? 'border-for-500/30 bg-for-500/5'
                : 'border-surface-300/60 bg-surface-300/30'
            )}
          >
            <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wide mb-1">
              {i === 0 ? 'Early voters' : 'Recent voters'}
            </p>
            <p className={cn('text-xl font-bold font-mono tabular-nums',
              period.forPct >= 50 ? 'text-for-400' : 'text-against-400'
            )}>
              {period.forPct}%
            </p>
            <p className="text-[10px] text-surface-500">FOR · {period.total} votes sampled</p>
          </div>
        ))}
      </div>

      {momentum.swingDirection !== 'stable' && (
        <p className="text-xs text-surface-500">
          {Math.abs(momentum.shiftPts)}pp {momentum.swingDirection === 'toward_for' ? 'gain' : 'loss'} from early to recent voters
        </p>
      )}
    </div>
  )
}

// ─── Segment Card ─────────────────────────────────────────────────────────────

function SegmentCard({
  seg,
  rank,
  expanded,
  onToggle,
}: {
  seg: SwingSegment
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const style = swingColor(seg.swingScore)
  const label = swingLabel(seg.swingScore)
  const againstVotes = seg.againstVotes
  const isFor = seg.forPct >= 50

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="rounded-xl border border-surface-300/60 bg-surface-200/50 overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-surface-300/30 transition-colors text-left"
      >
        <span className="text-lg leading-none w-7 flex-shrink-0 text-center">{seg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{seg.label}</span>
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold', style)}>
              {label}
            </span>
          </div>
          {/* Mini bar */}
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300/60 gap-px">
            <div className="bg-for-500 rounded-l-full" style={{ width: `${seg.forPct}%` }} />
            <div className="bg-against-500 rounded-r-full flex-1" />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={cn('text-sm font-mono font-bold tabular-nums', isFor ? 'text-for-400' : 'text-against-400')}>
            {seg.forPct}%
          </p>
          <p className="text-[10px] text-surface-500">{seg.total.toLocaleString()}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" />
        )}
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
            <div className="px-4 pb-4 pt-1 space-y-2 border-t border-surface-300/40">
              <p className="text-xs text-surface-500">{seg.description}</p>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="text-center">
                  <p className="text-sm font-bold text-for-400 font-mono">{seg.forVotes}</p>
                  <p className="text-[10px] text-surface-500">FOR votes</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-against-400 font-mono">{againstVotes}</p>
                  <p className="text-[10px] text-surface-500">AGAINST</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gold font-mono">{seg.swingScore}</p>
                  <p className="text-[10px] text-surface-500">swing score</p>
                </div>
              </div>
              {seg.votesNeededToFlip > 0 && (
                <p className="text-xs text-surface-500 bg-surface-300/30 rounded-lg px-3 py-2">
                  <span className="text-white font-semibold">{seg.votesNeededToFlip}</span>{' '}
                  votes from this group would need to flip to change the overall outcome.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: SwingArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-3 space-y-2">
      <p className="text-sm text-surface-100 leading-snug line-clamp-3">{arg.content}</p>
      <div className="flex items-center gap-3">
        <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border',
          isFor
            ? 'text-for-300 border-for-500/30 bg-for-500/10'
            : 'text-against-300 border-against-500/30 bg-against-500/10'
        )}>
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-surface-500 font-mono">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </span>
        {arg.aiScore !== null && (
          <span className="flex items-center gap-1 text-[10px] text-surface-500 font-mono">
            <Zap className="h-3 w-3 text-gold" />
            {arg.aiScore}/10
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] font-mono">
          <Flame className={cn('h-3 w-3', arg.persuasionPotential >= 60 ? 'text-against-400' : 'text-surface-500')} />
          <span className={arg.persuasionPotential >= 60 ? 'text-against-300' : 'text-surface-500'}>
            {arg.persuasionPotential}%
          </span>
          <span className="text-surface-600">potential</span>
        </span>
      </div>
      {arg.authorUsername && (
        <Link
          href={`/profile/${arg.authorUsername}`}
          className="text-[10px] text-surface-600 hover:text-surface-400 transition-colors"
        >
          @{arg.authorUsername}
          {arg.authorArchetype && (
            <span className="ml-1">· {arg.authorArchetype}</span>
          )}
        </Link>
      )}
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function SwingClient({ topicId, topicStatement, topicCategory, topicStatus }: Props) {
  const [data, setData] = useState<SwingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSeg, setExpandedSeg] = useState<string | null>(null)
  const [argSide, setArgSide] = useState<'for' | 'against'>('for')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/swing`)
      if (!res.ok) throw new Error('Failed to load swing data')
      const json = (await res.json()) as SwingResponse
      setData(json)
      setLastFetched(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const toggleSeg = (arch: string) =>
    setExpandedSeg(prev => (prev === arch ? null : arch))

  const statusClass = STATUS_CLASSES[topicStatus] ?? 'bg-surface-300 text-surface-500'
  const activeArgs =
    argSide === 'for' ? data?.topPersuasiveFor ?? [] : data?.topPersuasiveAgainst ?? []

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 pb-24 max-w-xl mx-auto w-full px-4 pt-4 space-y-6">

        {/* Back + header */}
        <div className="space-y-3">
          <Link
            href={`/topic/${topicId}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to topic
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold uppercase', statusClass)}>
                {topicStatus}
              </span>
              {topicCategory && (
                <span className="text-[10px] text-surface-500">{topicCategory}</span>
              )}
            </div>
            <h1 className="text-lg font-bold text-white leading-snug line-clamp-2">
              Swing Analysis
            </h1>
            <p className="text-sm text-surface-400 mt-1 line-clamp-2">{topicStatement}</p>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={Scale}
            title="Could not load swing data"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            {/* Refresh + timestamp */}
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs text-surface-500 font-mono uppercase tracking-wide">
                <Shuffle className="h-3.5 w-3.5" />
                Persuasion Gap
              </h2>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                {lastFetched ? lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Refresh'}
              </button>
            </div>

            {/* Persuasion gap hero */}
            <PersuasionGapHero data={data} />

            {/* Momentum */}
            <MomentumPanel data={data} />

            {/* Swing segments */}
            {data.segments.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-semibold text-white">Swing Segments</h2>
                  <span className="text-xs text-surface-600 ml-auto">
                    {data.totalWithArchetype.toLocaleString()} voters with archetype data
                  </span>
                </div>
                <p className="text-xs text-surface-500">
                  Sorted by contestedness — the &ldquo;hottest&rdquo; segments have votes most evenly split between FOR and AGAINST.
                </p>
                <div className="space-y-2">
                  {data.segments.map((seg, i) => (
                    <SegmentCard
                      key={seg.archetype}
                      seg={seg}
                      rank={i}
                      expanded={expandedSeg === seg.archetype}
                      onToggle={() => toggleSeg(seg.archetype)}
                    />
                  ))}
                </div>
              </section>
            )}

            {data.segments.length === 0 && data.totalWithArchetype === 0 && (
              <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-4 text-center">
                <Users className="h-8 w-8 text-surface-600 mx-auto mb-2" />
                <p className="text-sm text-surface-500">
                  No archetype data yet. Segment analysis unlocks as more voters set their civic profile.
                </p>
              </div>
            )}

            {/* Persuasive arguments */}
            {(data.topPersuasiveFor.length > 0 || data.topPersuasiveAgainst.length > 0) && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-semibold text-white">High-Persuasion Arguments</h2>
                </div>
                <p className="text-xs text-surface-500">
                  Arguments ranked by community upvotes + AI quality score — highest persuasion potential for swing voters.
                </p>

                {/* Side toggle */}
                <div className="flex gap-1 bg-surface-200 rounded-xl p-1 border border-surface-300/60">
                  <button
                    onClick={() => setArgSide('for')}
                    className={cn(
                      'flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
                      argSide === 'for'
                        ? 'bg-for-600/30 text-for-300 border border-for-600/40'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    <ThumbsUp className="h-3 w-3 inline mr-1" />
                    FOR ({data.topPersuasiveFor.length})
                  </button>
                  <button
                    onClick={() => setArgSide('against')}
                    className={cn(
                      'flex-1 py-2 text-xs font-semibold rounded-lg transition-all',
                      argSide === 'against'
                        ? 'bg-against-600/30 text-against-300 border border-against-600/40'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    <ThumbsDown className="h-3 w-3 inline mr-1" />
                    AGAINST ({data.topPersuasiveAgainst.length})
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={argSide}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2"
                  >
                    {activeArgs.length > 0 ? (
                      activeArgs.map(arg => (
                        <ArgumentCard key={arg.id} arg={arg} />
                      ))
                    ) : (
                      <p className="text-xs text-surface-500 text-center py-4">
                        No arguments yet for this side.
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </section>
            )}

            {/* Footer links */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {[
                { href: `/topic/${topicId}/archetypes`, label: 'Archetype Breakdown', icon: Users },
                { href: `/topic/${topicId}/momentum`, label: 'Vote Momentum', icon: TrendingUp },
                { href: `/topic/${topicId}/versus`, label: 'FOR vs AGAINST', icon: Scale },
                { href: `/topic/${topicId}/forecast`, label: 'Law Forecast', icon: ArrowUpRight },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 rounded-xl border border-surface-300/60 bg-surface-200/40 px-3 py-2.5 text-xs text-surface-400 hover:text-white hover:border-surface-400/60 transition-colors group"
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0 group-hover:text-for-400 transition-colors" />
                  <span className="truncate">{label}</span>
                  <ArrowRight className="h-3 w-3 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
