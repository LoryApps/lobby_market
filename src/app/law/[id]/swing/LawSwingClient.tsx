'use client'

/**
 * /law/[id]/swing — Founding Debate Swing Analyser
 *
 * Asks: "How was this law won?" — momentum of the founding debate,
 * archetype contestedness, and the most persuasive arguments.
 *
 * Distinct from:
 *   /archetypes  — static who-voted-how breakdown
 *   /momentum    — post-passage community engagement
 *   /pressure    — ongoing repeal/amendment pressure
 *   /conviction  — depth of voter belief
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
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
  Trophy,
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
  LawSwingResponse,
  LawSwingSegment,
  LawSwingArgument,
} from '@/app/api/laws/[id]/swing/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  lawStatement: string
  lawCategory: string | null
  lawBluePct: number
  lawEstablishedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function contestColor(score: number): string {
  if (score >= 70) return 'text-against-300 border-against-500/40 bg-against-500/10'
  if (score >= 40) return 'text-gold border-gold/40 bg-gold/10'
  return 'text-surface-500 border-surface-400/40 bg-surface-300/10'
}

function contestLabel(score: number): string {
  if (score >= 70) return 'Contested'
  if (score >= 40) return 'Mixed'
  return 'Unified'
}

function mandateColor(strength: string): string {
  switch (strength) {
    case 'landslide': return 'text-for-300 border-for-500/40 bg-for-500/10'
    case 'strong':    return 'text-emerald border-emerald/40 bg-emerald/10'
    case 'narrow':    return 'text-gold border-gold/40 bg-gold/10'
    default:          return 'text-against-300 border-against-500/40 bg-against-500/10'
  }
}

// ─── Mandate Hero ─────────────────────────────────────────────────────────────

function MandateHero({ data }: { data: LawSwingResponse }) {
  const { law, mandate } = data
  const forPct = law.blue_pct
  const againstPct = 100 - forPct

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-200/60 p-5 space-y-4">
      {/* Vote bar */}
      <div>
        <div className="flex justify-between text-xs font-mono font-bold mb-2">
          <span className="text-for-400">{forPct.toFixed(1)}% FOR</span>
          <span className="text-surface-500">{law.total_votes.toLocaleString()} votes</span>
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
          {/* 60% threshold line */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/40" style={{ left: '60%' }} title="Law threshold" />
        </div>
        <div className="flex mt-1">
          <span className="text-[10px] text-surface-600 font-mono">0%</span>
          <span className="text-[10px] text-surface-500 font-mono ml-auto mr-[40%]">60% law threshold</span>
          <span className="text-[10px] text-surface-600 font-mono ml-auto">100%</span>
        </div>
      </div>

      {/* Mandate badge */}
      <div className={cn('rounded-xl border p-3 space-y-1', mandateColor(mandate.strength))}>
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm font-bold">{mandate.label} mandate</span>
          <span className="ml-auto text-xs font-mono">+{mandate.marginPp}pp margin</span>
        </div>
        <p className="text-xs opacity-80">{mandate.description}</p>
      </div>
    </div>
  )
}

// ─── Founding Momentum Panel ──────────────────────────────────────────────────

function FoundingMomentumPanel({ data }: { data: LawSwingResponse }) {
  const { founding } = data

  const TrendIcon =
    founding.trend === 'built_momentum'        ? TrendingUp   :
    founding.trend === 'lost_momentum'         ? TrendingDown :
    founding.trend === 'decisive_from_start'   ? Trophy       :
    Scale

  const trendColor =
    founding.trend === 'built_momentum'        ? 'text-for-400' :
    founding.trend === 'lost_momentum'         ? 'text-against-400' :
    founding.trend === 'decisive_from_start'   ? 'text-gold' :
    'text-surface-500'

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-200/60 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-surface-500" />
        <h3 className="text-sm font-semibold text-white">Founding Debate Momentum</h3>
        <Badge variant="surface" className="ml-auto text-[10px]">
          <TrendIcon className={cn('h-3 w-3 mr-1', trendColor)} />
          {founding.trendLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Early voters', period: founding.early, highlight: false },
          { label: 'Late voters',  period: founding.late,  highlight: founding.trend === 'built_momentum' },
        ].map(({ label, period, highlight }) => (
          <div
            key={label}
            className={cn(
              'rounded-xl border p-3',
              highlight
                ? 'border-for-500/30 bg-for-500/5'
                : 'border-surface-300/60 bg-surface-300/30'
            )}
          >
            <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wide mb-1">{label}</p>
            <p className={cn(
              'text-xl font-bold font-mono tabular-nums',
              period.forPct >= 50 ? 'text-for-400' : 'text-against-400'
            )}>
              {period.forPct}%
            </p>
            <p className="text-[10px] text-surface-500">FOR · {period.total} sampled</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-surface-500 bg-surface-300/20 rounded-lg px-3 py-2">
        {founding.trendDescription}
      </p>
    </div>
  )
}

// ─── Segment Card ─────────────────────────────────────────────────────────────

function SegmentCard({
  seg,
  rank,
  expanded,
  onToggle,
  winnerForPct,
}: {
  seg: LawSwingSegment
  rank: number
  expanded: boolean
  onToggle: () => void
  winnerForPct: number
}) {
  const style = contestColor(seg.contestScore)
  const label = contestLabel(seg.contestScore)

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
            {!seg.alignedWithOutcome && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-against-500/30 bg-against-500/10 text-against-300">
                dissented
              </span>
            )}
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300/60 gap-px">
            <div className="bg-for-500 rounded-l-full" style={{ width: `${seg.forPct}%` }} />
            <div className="bg-against-500 rounded-r-full flex-1" />
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={cn(
            'text-sm font-mono font-bold tabular-nums',
            seg.forPct >= 50 ? 'text-for-400' : 'text-against-400'
          )}>
            {seg.forPct}%
          </p>
          <p className="text-[10px] text-surface-500">{seg.total.toLocaleString()}</p>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
          : <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" />}
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
                  <p className="text-[10px] text-surface-500">FOR</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-against-400 font-mono">{seg.againstVotes}</p>
                  <p className="text-[10px] text-surface-500">AGAINST</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gold font-mono">{seg.contestScore}</p>
                  <p className="text-[10px] text-surface-500">contest score</p>
                </div>
              </div>
              <p className="text-xs text-surface-500">
                {seg.alignedWithOutcome
                  ? `${seg.label}s voted in line with the final outcome (${winnerForPct >= 50 ? 'FOR' : 'AGAINST'} majority).`
                  : `${seg.label}s dissented — they voted against the eventual winning side.`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: LawSwingArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-3 space-y-2">
      <p className="text-sm text-surface-100 leading-snug line-clamp-3">{arg.content}</p>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cn(
          'text-[10px] font-mono px-1.5 py-0.5 rounded border',
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
          <span className="text-surface-600">influence</span>
        </span>
      </div>
      {arg.authorUsername && (
        <Link
          href={`/profile/${arg.authorUsername}`}
          className="text-[10px] text-surface-600 hover:text-surface-400 transition-colors"
        >
          @{arg.authorUsername}
          {arg.authorArchetype && <span className="ml-1">· {arg.authorArchetype}</span>}
        </Link>
      )}
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function LawSwingClient({
  lawId,
  lawStatement,
  lawCategory,
  lawBluePct,
  lawEstablishedAt,
}: Props) {
  const [data, setData] = useState<LawSwingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSeg, setExpandedSeg] = useState<string | null>(null)
  const [argSide, setArgSide] = useState<'for' | 'against'>('for')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/swing`)
      if (!res.ok) throw new Error('Failed to load swing data')
      const json = (await res.json()) as LawSwingResponse
      setData(json)
      setLastFetched(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const toggleSeg = (arch: string) =>
    setExpandedSeg(prev => (prev === arch ? null : arch))

  const establishedYear = lawEstablishedAt
    ? new Date(lawEstablishedAt).getFullYear()
    : null

  const activeArgs =
    argSide === 'for' ? data?.decisiveFor ?? [] : data?.decisiveAgainst ?? []

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 pb-24 max-w-xl mx-auto w-full px-4 pt-4 space-y-6">

        {/* Back + header */}
        <div className="space-y-3">
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to law
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold uppercase bg-gold/20 text-gold">
                law
              </span>
              {lawCategory && (
                <span className="text-[10px] text-surface-500">{lawCategory}</span>
              )}
              {establishedYear && (
                <span className="text-[10px] text-surface-600 font-mono">est. {establishedYear}</span>
              )}
            </div>
            <h1 className="text-lg font-bold text-white leading-snug">
              How This Law Was Won
            </h1>
            <p className="text-sm text-surface-400 mt-1 line-clamp-2">{lawStatement}</p>
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
            {/* Refresh */}
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs text-surface-500 font-mono uppercase tracking-wide">
                <Shuffle className="h-3.5 w-3.5" />
                Founding Debate Analysis
              </h2>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                {lastFetched
                  ? lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : 'Refresh'}
              </button>
            </div>

            {/* Mandate hero */}
            <MandateHero data={data} />

            {/* Founding momentum */}
            <FoundingMomentumPanel data={data} />

            {/* Archetype segments */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-surface-500" />
                <h2 className="text-sm font-semibold text-white">Archetype Contestedness</h2>
                {data.totalWithArchetype > 0 && (
                  <span className="text-xs text-surface-600 ml-auto">
                    {data.totalWithArchetype.toLocaleString()} with archetype data
                  </span>
                )}
              </div>
              <p className="text-xs text-surface-500">
                Sorted by how evenly split each civic archetype was during the founding debate.
                &ldquo;Contested&rdquo; means the group was closely divided; &ldquo;Unified&rdquo; means they voted overwhelmingly one way.
              </p>

              {data.segments.length > 0 ? (
                <div className="space-y-2">
                  {data.segments.map((seg, i) => (
                    <SegmentCard
                      key={seg.archetype}
                      seg={seg}
                      rank={i}
                      expanded={expandedSeg === seg.archetype}
                      onToggle={() => toggleSeg(seg.archetype)}
                      winnerForPct={data.law.blue_pct}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-4 text-center">
                  <Users className="h-8 w-8 text-surface-600 mx-auto mb-2" />
                  <p className="text-sm text-surface-500">
                    No archetype data from the founding debate. Analysis unlocks as voters set civic profiles.
                  </p>
                </div>
              )}
            </section>

            {/* Decisive arguments */}
            {(data.decisiveFor.length > 0 || data.decisiveAgainst.length > 0) && (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-semibold text-white">Decisive Arguments</h2>
                </div>
                <p className="text-xs text-surface-500">
                  The highest-impact arguments from the founding debate, ranked by community upvotes and AI quality score.
                </p>

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
                    FOR ({data.decisiveFor.length})
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
                    AGAINST ({data.decisiveAgainst.length})
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
                        No arguments recorded for this side.
                      </p>
                    )}
                  </motion.div>
                </AnimatePresence>
              </section>
            )}

            {/* Footer links */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {[
                { href: `/law/${lawId}/archetypes`, label: 'Archetype Breakdown', icon: Users },
                { href: `/law/${lawId}/momentum`, label: 'Post-Passage Momentum', icon: TrendingUp },
                { href: `/law/${lawId}/pressure`, label: 'Stability & Pressure', icon: Scale },
                { href: `/law/${lawId}/conviction`, label: 'Conviction Atlas', icon: Trophy },
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
