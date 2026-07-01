'use client'

/**
 * /topic/[id]/autopsy — Debate Autopsy
 *
 * A forensic post-mortem of a resolved debate: how it unfolded,
 * what drove the outcome, and how it compares to similar debates.
 *
 * Only available for topics with status = 'law' or 'failed'.
 *
 * Distinct from:
 *   /recap         — contributor-level breakdown (who voted which way)
 *   /resolution    — the formal verdict and outcome display
 *   /momentum      — live momentum during the active debate
 *   /timeline      — raw event log
 *   /impact        — argument-level reach and engagement
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Brain,
  Calendar,
  ChevronRight,
  Clock,
  Eye,
  Flame,
  Gavel,
  Info,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Vote,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  AutopsyData,
  AutopsyArgument,
  VoteDay,
  AutopsyPhase,
} from '@/app/api/topics/[id]/autopsy/route'

// ─── Vote Arc Chart ───────────────────────────────────────────────────────────

function VoteArcChart({ arc, status }: { arc: VoteDay[]; status: 'law' | 'failed' }) {
  if (arc.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-xs font-mono text-surface-500">
        Not enough vote data to chart arc
      </div>
    )
  }

  const W = 600
  const H = 120
  const PAD = { t: 12, b: 24, l: 32, r: 8 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b

  // Build line points for FOR % (blue_pct)
  const points = arc.map((d, i) => ({
    x: PAD.l + (i / (arc.length - 1)) * chartW,
    y: PAD.t + ((100 - d.running_pct) / 100) * chartH,
    pct: d.running_pct,
    date: d.date,
  }))

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  // Area under line (fill to bottom)
  const areaPath =
    `${linePath} L ${points[points.length - 1].x} ${H - PAD.b} L ${points[0].x} ${H - PAD.b} Z`

  const finalPct = arc[arc.length - 1].running_pct
  const lineColor = status === 'law' ? '#3b82f6' : '#ef4444'
  const fillColor = status === 'law' ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.10)'

  // Y-axis labels
  const yLabels = [25, 50, 75]

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: 120 }}
        aria-label="Vote percentage over time"
      >
        {/* Grid lines */}
        {yLabels.map((pct) => {
          const y = PAD.t + ((100 - pct) / 100) * chartH
          return (
            <g key={pct}>
              <line
                x1={PAD.l}
                y1={y}
                x2={W - PAD.r}
                y2={y}
                stroke={pct === 50 ? '#4b5563' : '#1f2937'}
                strokeWidth={pct === 50 ? 1.5 : 0.75}
                strokeDasharray={pct === 50 ? '4 3' : undefined}
              />
              <text
                x={PAD.l - 4}
                y={y + 4}
                textAnchor="end"
                fontSize={8}
                fill="#6b7280"
                fontFamily="monospace"
              >
                {pct}%
              </text>
            </g>
          )
        })}

        {/* FOR label at left, AGAINST at left bottom */}
        <text x={PAD.l - 4} y={PAD.t + 4} textAnchor="end" fontSize={7} fill="#3b82f6" fontFamily="monospace">FOR</text>
        <text x={PAD.l - 4} y={H - PAD.b + 3} textAnchor="end" fontSize={7} fill="#ef4444" fontFamily="monospace">AGN</text>

        {/* Area fill */}
        <path d={areaPath} fill={fillColor} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Final point */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3.5}
          fill={lineColor}
        />

        {/* Final % label */}
        <text
          x={points[points.length - 1].x + 5}
          y={points[points.length - 1].y + 4}
          fontSize={9}
          fill={lineColor}
          fontFamily="monospace"
          fontWeight="bold"
        >
          {finalPct}%
        </text>

        {/* X-axis date labels */}
        {arc.length > 0 && (
          <>
            <text x={PAD.l} y={H} fontSize={7} fill="#6b7280" fontFamily="monospace">
              {arc[0].date.slice(5)}
            </text>
            {arc.length > 2 && (
              <text
                x={PAD.l + chartW / 2}
                y={H}
                textAnchor="middle"
                fontSize={7}
                fill="#4b5563"
                fontFamily="monospace"
              >
                {arc[Math.floor(arc.length / 2)].date.slice(5)}
              </text>
            )}
            <text
              x={W - PAD.r}
              y={H}
              textAnchor="end"
              fontSize={7}
              fill="#6b7280"
              fontFamily="monospace"
            >
              {arc[arc.length - 1].date.slice(5)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, rank }: { arg: AutopsyArgument; rank: number }) {
  const isFor = arg.side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.07 }}
      className={cn(
        'rounded-xl border p-3.5 space-y-2',
        isFor
          ? 'border-for-500/20 bg-for-500/5'
          : 'border-against-500/20 bg-against-500/5'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Rank */}
        <span className={cn(
          'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold',
          rank === 0
            ? isFor ? 'bg-for-500 text-white' : 'bg-against-500 text-white'
            : 'bg-surface-300 text-surface-600'
        )}>
          {rank + 1}
        </span>
        <p className="text-xs text-surface-600 leading-relaxed flex-1">{arg.content}</p>
      </div>

      <div className="flex items-center justify-between">
        {/* Author */}
        <div className="flex items-center gap-1.5">
          <Avatar
            src={arg.author_avatar_url}
            username={arg.author_username ?? 'anon'}
            size={16}
          />
          <span className="text-[10px] font-mono text-surface-500">
            {arg.author_display_name ?? arg.author_username ?? 'Anonymous'}
          </span>
        </div>

        {/* Upvotes */}
        <div className={cn(
          'flex items-center gap-1 text-[10px] font-mono font-semibold',
          isFor ? 'text-for-400' : 'text-against-300'
        )}>
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes.toLocaleString()}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Phase Timeline ───────────────────────────────────────────────────────────

function PhaseTimeline({ phases, status }: { phases: AutopsyPhase[]; status: 'law' | 'failed' }) {
  if (!phases.length) return null

  return (
    <div className="space-y-2">
      {phases.map((phase, i) => {
        const isLast = i === phases.length - 1
        const pct = phase.pct_at_end
        const barColor =
          pct > 55 ? 'bg-for-500' : pct < 45 ? 'bg-against-500' : 'bg-surface-400'

        return (
          <div key={phase.label} className="flex items-start gap-3">
            {/* Connector */}
            <div className="flex flex-col items-center flex-shrink-0 mt-1">
              <div className={cn(
                'w-2 h-2 rounded-full',
                i === 0 ? 'bg-surface-400' :
                isLast ? (status === 'law' ? 'bg-gold' : 'bg-surface-500') :
                'bg-surface-400'
              )} />
              {!isLast && <div className="w-px h-8 bg-surface-300/60 mt-0.5" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-white">{phase.label}</span>
                <span className="text-[10px] font-mono text-surface-500">{phase.date_range}</span>
                <span className="text-[10px] font-mono text-surface-600">
                  {phase.votes_in_phase.toLocaleString()} votes
                </span>
              </div>
              <p className="text-[11px] text-surface-500 mb-1.5">{phase.description}</p>

              {/* Mini bar */}
              <div className="h-1.5 w-full bg-surface-300 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-surface-600 mt-0.5">
                <span className="text-for-400">{pct}% FOR</span>
                <span className="text-against-400">{100 - pct}% AGN</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AutopsyClient() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AutopsyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/autopsy`)
      if (res.status === 422) {
        setError('not_resolved')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: AutopsyData = await res.json()
      setData(json)
    } catch {
      setError('Failed to load autopsy data.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const topic = data?.topic
  const status = topic?.status
  const isLaw = status === 'law'
  const forPct = topic ? Math.round(topic.blue_pct) : 50
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-24">
        <div className="pt-4">
          <Link
            href={`/topic/${id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3 w-3" /> Back to debate
          </Link>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Scale className="h-4 w-4 text-surface-500" />
                <h1 className="text-2xl font-bold text-white">Debate Autopsy</h1>
              </div>
              <p className="text-sm text-surface-500">
                A forensic breakdown of how this debate unfolded and what determined the verdict.
              </p>
            </div>
            <button
              onClick={() => setShowInfo((s) => !s)}
              className="flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-label="About this page"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>

          {/* Info panel */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="p-4 rounded-xl bg-surface-100 border border-surface-300 text-xs text-surface-400 space-y-2">
                  <p>
                    <span className="text-white font-semibold">Debate Autopsy</span> performs a
                    post-mortem on a resolved debate — reconstructing the vote arc day by day,
                    identifying the most influential arguments, and benchmarking the outcome
                    against similar debates in the same category.
                  </p>
                  <p>
                    The <span className="text-white">vote arc</span> shows the FOR% over time.
                    The <span className="text-white">verdict strength</span> classifies how decisive the outcome was.
                    The <span className="text-white">phases</span> divide the debate into Opening, Development, and Resolution.
                  </p>
                  <p>Only available for resolved debates (law passed or motion failed).</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Loading ─────────────────────────────────────────────────────── */}
          {loading && (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-56 w-full rounded-2xl" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            </div>
          )}

          {/* ── Error: not resolved ──────────────────────────────────────────── */}
          {!loading && error === 'not_resolved' && (
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-gold mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">Debate still in progress</p>
              <p className="text-sm text-surface-500 mb-4">
                The autopsy is only available after a debate reaches its verdict — once it passes into law or is voted down.
              </p>
              <Link
                href={`/topic/${id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm text-white hover:bg-surface-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to live debate
              </Link>
            </div>
          )}

          {/* ── Error: other ─────────────────────────────────────────────────── */}
          {!loading && error && error !== 'not_resolved' && (
            <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
              <XCircle className="h-8 w-8 text-against-400 mx-auto mb-2" />
              <p className="text-sm text-against-300 mb-3">{error}</p>
              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 mx-auto text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          )}

          {/* ── Content ──────────────────────────────────────────────────────── */}
          {!loading && data && topic && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* ── Verdict Banner ────────────────────────────────────────────── */}
              <div className={cn(
                'rounded-2xl border p-5',
                isLaw
                  ? 'bg-gradient-to-br from-gold/10 to-emerald/5 border-gold/30'
                  : 'bg-gradient-to-br from-surface-200/80 to-against-500/5 border-surface-300'
              )}>
                {/* Verdict icon */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    'p-2.5 rounded-xl',
                    isLaw ? 'bg-gold/20 text-gold' : 'bg-surface-300 text-surface-400'
                  )}>
                    <Gavel className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Verdict</p>
                    <h2 className={cn(
                      'text-lg font-bold',
                      isLaw ? 'text-gold' : 'text-surface-400'
                    )}>
                      {isLaw ? 'Established as Law' : 'Motion Failed'}
                    </h2>
                  </div>
                </div>

                {/* Statement */}
                <p className="text-sm text-white leading-snug mb-4 line-clamp-3">
                  &ldquo;{topic.statement}&rdquo;
                </p>

                {/* Final vote split */}
                <div className="space-y-2">
                  <div className="flex overflow-hidden rounded-full h-3 bg-surface-300">
                    <div
                      className="bg-gradient-to-r from-for-600 to-for-400 transition-all duration-700"
                      style={{ width: `${forPct}%` }}
                    />
                    <div className="flex-1 bg-against-500/80" />
                  </div>
                  <div className="flex justify-between text-xs font-mono font-semibold">
                    <span className="text-for-400">{forPct}% FOR</span>
                    <span className="text-against-300">{againstPct}% AGAINST</span>
                  </div>
                </div>

                {/* Verdict strength badge */}
                <div className={cn(
                  'mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-mono font-semibold',
                  data.verdict.label === 'Unanimous' || data.verdict.label === 'Landslide'
                    ? 'border-emerald/40 bg-emerald/10 text-emerald'
                    : data.verdict.label === 'Decisive'
                      ? 'border-for-400/40 bg-for-500/10 text-for-300'
                      : data.verdict.label === 'Majority'
                        ? 'border-gold/40 bg-gold/10 text-gold'
                        : 'border-against-400/40 bg-against-500/10 text-against-300'
                )}>
                  {data.verdict.label} Verdict
                </div>
                <p className="text-[11px] text-surface-500 mt-1.5">{data.verdict.description}</p>
              </div>

              {/* ── Stats Row ─────────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    label: 'Total Votes',
                    value: topic.total_votes.toLocaleString(),
                    icon: Vote,
                    color: 'text-white',
                  },
                  {
                    label: 'Debate Duration',
                    value: `${topic.debate_days}d`,
                    icon: Calendar,
                    color: 'text-purple',
                  },
                  {
                    label: 'Arguments',
                    value: topic.total_arguments.toLocaleString(),
                    icon: MessageSquare,
                    color: 'text-for-400',
                  },
                  {
                    label: 'Views',
                    value: topic.view_count.toLocaleString(),
                    icon: Eye,
                    color: 'text-surface-400',
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-surface-100 border border-surface-300 p-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={cn('h-3 w-3', color)} />
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
                    </div>
                    <p className={cn('text-lg font-bold', color)}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Vote Arc ─────────────────────────────────────────────────── */}
              {data.vote_arc.length >= 2 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-white">Vote Arc</h2>
                    <span className="text-[10px] font-mono text-surface-500">
                      FOR% across {data.vote_arc.length} days
                    </span>
                  </div>
                  <VoteArcChart arc={data.vote_arc} status={topic.status} />

                  {/* Peak days */}
                  {(data.peak_for_day || data.peak_against_day) && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {data.peak_for_day && (
                        <div className="rounded-lg bg-for-500/10 border border-for-500/20 p-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <TrendingUp className="h-3 w-3 text-for-400" />
                            <span className="text-[10px] font-mono text-for-400">Peak FOR day</span>
                          </div>
                          <p className="text-xs font-semibold text-white">{data.peak_for_day.date}</p>
                          <p className="text-[10px] font-mono text-surface-500">
                            +{data.peak_for_day.for_votes} FOR votes
                          </p>
                        </div>
                      )}
                      {data.peak_against_day && (
                        <div className="rounded-lg bg-against-500/10 border border-against-500/20 p-2.5">
                          <div className="flex items-center gap-1 mb-1">
                            <TrendingDown className="h-3 w-3 text-against-300" />
                            <span className="text-[10px] font-mono text-against-300">Peak AGAINST day</span>
                          </div>
                          <p className="text-xs font-semibold text-white">{data.peak_against_day.date}</p>
                          <p className="text-[10px] font-mono text-surface-500">
                            +{data.peak_against_day.against_votes} AGAINST votes
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Debate Phases ─────────────────────────────────────────────── */}
              {data.phases.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-white">Debate Phases</h2>
                  </div>
                  <PhaseTimeline phases={data.phases} status={topic.status} />
                </div>
              )}

              {/* ── Top Arguments ─────────────────────────────────────────────── */}
              {(data.top_for_args.length > 0 || data.top_against_args.length > 0) && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-white">Top Arguments</h2>
                    <span className="text-[10px] font-mono text-surface-500">by community upvotes</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* FOR column */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ThumbsUp className="h-3 w-3 text-for-400" />
                        <span className="text-[11px] font-mono text-for-400 font-semibold uppercase tracking-wider">
                          FOR ({forPct}%)
                        </span>
                      </div>
                      {data.top_for_args.length === 0 ? (
                        <p className="text-xs text-surface-500 italic">No FOR arguments recorded.</p>
                      ) : (
                        data.top_for_args.map((arg, i) => (
                          <ArgumentCard key={arg.id} arg={arg} rank={i} />
                        ))
                      )}
                    </div>

                    {/* AGAINST column */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 mb-2">
                        <ThumbsDown className="h-3 w-3 text-against-300" />
                        <span className="text-[11px] font-mono text-against-300 font-semibold uppercase tracking-wider">
                          AGAINST ({againstPct}%)
                        </span>
                      </div>
                      {data.top_against_args.length === 0 ? (
                        <p className="text-xs text-surface-500 italic">No AGAINST arguments recorded.</p>
                      ) : (
                        data.top_against_args.map((arg, i) => (
                          <ArgumentCard key={arg.id} arg={arg} rank={i} />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Debate Metrics ────────────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-surface-500" />
                  <h2 className="text-sm font-semibold text-white">Debate Metrics</h2>
                </div>

                <div className="space-y-3">
                  {/* Debate density */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-surface-500">Argument Density</span>
                      <span className="text-xs font-mono text-white">
                        {Math.round(data.debate_density * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple rounded-full transition-all duration-700"
                        style={{ width: `${Math.round(data.debate_density * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-surface-600 mt-0.5">
                      Arguments per voter — how actively the debate was contested
                    </p>
                  </div>

                  {/* Engagement rate */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-surface-500">Vote Conversion</span>
                      <span className="text-xs font-mono text-white">
                        {Math.round(data.engagement_rate * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.round(data.engagement_rate * 100))}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-surface-600 mt-0.5">
                      Percentage of viewers who voted
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Category Benchmark ────────────────────────────────────────── */}
              {data.category_benchmark && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Scale className="h-4 w-4 text-surface-500" />
                    <h2 className="text-sm font-semibold text-white">
                      {topic.category ?? 'Category'} Benchmark
                    </h2>
                    <span className="text-[10px] font-mono text-surface-500">
                      vs {data.category_benchmark.total_resolved} resolved debates
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className={cn(
                        'text-xl font-bold',
                        forPct > data.category_benchmark.avg_blue_pct
                          ? isLaw ? 'text-emerald' : 'text-against-300'
                          : 'text-surface-400'
                      )}>
                        <AnimatedNumber value={Math.round(data.category_benchmark.avg_blue_pct)} />%
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">Avg FOR%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-white">
                        <AnimatedNumber value={data.category_benchmark.avg_votes} />
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">Avg Votes</p>
                    </div>
                    <div className="text-center">
                      <p className={cn(
                        'text-xl font-bold',
                        data.category_benchmark.law_rate >= 50 ? 'text-gold' : 'text-surface-400'
                      )}>
                        <AnimatedNumber value={data.category_benchmark.law_rate} />%
                      </p>
                      <p className="text-[10px] font-mono text-surface-500">Law Rate</p>
                    </div>
                  </div>

                  {/* This vs average */}
                  <div className="mt-3 pt-3 border-t border-surface-300/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-surface-500">This debate&apos;s FOR%</span>
                      <span className={cn(
                        'font-semibold',
                        forPct > data.category_benchmark.avg_blue_pct ? 'text-for-400' : 'text-against-300'
                      )}>
                        {forPct}%
                        {' '}
                        <span className="text-surface-600">
                          ({forPct > data.category_benchmark.avg_blue_pct ? '+' : ''}
                          {forPct - Math.round(data.category_benchmark.avg_blue_pct)} vs avg)
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-surface-500">This debate&apos;s votes</span>
                      <span className={cn(
                        'font-semibold',
                        topic.total_votes > data.category_benchmark.avg_votes ? 'text-emerald' : 'text-surface-400'
                      )}>
                        {topic.total_votes.toLocaleString()}
                        {' '}
                        <span className="text-surface-600">
                          ({topic.total_votes > data.category_benchmark.avg_votes ? '+' : ''}
                          {(topic.total_votes - data.category_benchmark.avg_votes).toLocaleString()} vs avg)
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Navigation ────────────────────────────────────────────────── */}
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  Related Analysis
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: `../momentum`, label: 'Momentum', icon: Flame },
                    { href: `../influence`, label: 'Influence Map', icon: Zap },
                    { href: `../recap`, label: 'Voter Recap', icon: Vote },
                    { href: `../timeline`, label: 'Timeline', icon: Clock },
                    { href: `../arguments`, label: 'All Arguments', icon: MessageSquare },
                    { href: `../resolution`, label: 'Resolution', icon: Gavel },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/50 hover:bg-surface-200 border border-surface-300/50 hover:border-surface-400/50 transition-all group text-sm"
                    >
                      <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                      <span className="text-surface-600 group-hover:text-white transition-colors text-xs">{label}</span>
                      <ChevronRight className="h-3 w-3 text-surface-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
