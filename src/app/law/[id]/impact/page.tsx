'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  GitFork,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawImpactData, ImpactVotePoint, ImpactArgument } from '@/app/api/laws/[id]/impact/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function VoteSparkline({ points }: { points: ImpactVotePoint[] }) {
  if (points.length < 2) return null

  const W = 600
  const H = 120
  const pad = 8

  const minPct = Math.min(...points.map((p) => p.forPct))
  const maxPct = Math.max(...points.map((p) => p.forPct))
  const lo = Math.min(minPct - 3, 44)
  const hi = Math.max(maxPct + 3, 56)

  function x(i: number) {
    return pad + (i / (points.length - 1)) * (W - pad * 2)
  }
  function y(pct: number) {
    return pad + (H - pad * 2) - ((pct - lo) / (hi - lo)) * (H - pad * 2)
  }

  const linePts = points.map((p, i) => `${x(i).toFixed(1)},${y(p.forPct).toFixed(1)}`)
  const linePath = `M${linePts.join('L')}`
  const areaPath = `${linePath}L${x(points.length - 1).toFixed(1)},${H}L${pad},${H}Z`

  const lastPct = points[points.length - 1].forPct
  const lineColor = lastPct >= 67 ? '#10b981' : lastPct >= 50 ? '#3b82f6' : '#ef4444'
  const fillColor = lastPct >= 67 ? 'rgba(16,185,129,0.1)' : lastPct >= 50 ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)'

  const mid50Y = y(50)
  const mid67Y = y(67)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {/* 67% law threshold line */}
      <line x1={pad} y1={mid67Y} x2={W - pad} y2={mid67Y} stroke="#10b981" strokeWidth="1" strokeDasharray="4,3" opacity="0.4" />
      {/* 50% neutral line */}
      <line x1={pad} y1={mid50Y} x2={W - pad} y2={mid50Y} stroke="#6b7280" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" />
      {/* Area fill */}
      <path d={areaPath} fill={fillColor} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Final point dot */}
      <circle
        cx={x(points.length - 1).toFixed(1)}
        cy={y(lastPct).toFixed(1)}
        r="5"
        fill={lineColor}
        stroke="#0f1117"
        strokeWidth="2"
      />
    </svg>
  )
}

// ─── Daily vote bar chart ─────────────────────────────────────────────────────

function DailyBars({ points }: { points: ImpactVotePoint[] }) {
  if (points.length === 0) return null
  const maxDaily = Math.max(...points.map((p) => p.dailyVotes), 1)
  // Show last 30 days max to keep it readable
  const slice = points.slice(-30)

  return (
    <div className="flex items-end gap-0.5 h-16 w-full">
      {slice.map((p, i) => {
        const h = Math.max(2, (p.dailyVotes / maxDaily) * 60)
        const isPeak = p.dailyVotes === maxDaily
        return (
          <div
            key={i}
            className="flex-1 min-w-0 rounded-sm transition-all"
            style={{
              height: `${h}px`,
              backgroundColor: isPeak ? '#c9a84c' : p.forPct >= 67 ? '#10b981' : p.forPct >= 50 ? '#3b82f6' : '#ef4444',
              opacity: isPeak ? 1 : 0.6,
            }}
            title={`${p.date}: ${p.dailyVotes} votes (${Math.round(p.forPct)}% for)`}
          />
        )
      })}
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({ arg }: { arg: ImpactArgument }) {
  const isFor = arg.side === 'blue'

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        isFor
          ? 'border-for-500/20 bg-for-500/5 hover:border-for-500/35'
          : 'border-against-500/20 bg-against-500/5 hover:border-against-500/35'
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
            isFor
              ? 'bg-for-500/15 text-for-400'
              : 'bg-against-500/15 text-against-400'
          )}
        >
          {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {isFor ? 'FOR' : 'AGAINST'}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <ThumbsUp className="h-2.5 w-2.5" />
          {arg.upvotes.toLocaleString()} upvotes
        </div>
      </div>

      <p className="text-sm text-surface-300 leading-relaxed line-clamp-3 font-mono mb-3">
        {arg.content}
      </p>

      {arg.author && (
        <div className="flex items-center gap-1.5">
          <Avatar
            src={arg.author.avatar_url}
            fallback={arg.author.display_name || arg.author.username}
            size="xs"
          />
          <Link
            href={`/profile/${arg.author.username}`}
            className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          >
            @{arg.author.username}
          </Link>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LawImpactPage() {
  const params = useParams<{ id: string }>()
  const lawId = params?.id ?? ''

  const [data, setData] = useState<LawImpactData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!lawId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/impact`)
      if (!res.ok) throw new Error('Failed to load impact data')
      const json = await res.json()
      setData(json as LawImpactData)
    } catch {
      setError('Could not load impact data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => {
    load()
  }, [load])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Back */}
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
            <Gavel className="h-3.5 w-3.5 text-emerald" />
            <span className="text-surface-600">Codex</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-surface-600">Law</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-emerald">Impact Report</span>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-28 rounded-2xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
            <p className="text-surface-500 font-mono text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-white text-sm font-mono transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="impact-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Law header card */}
              <div className="rounded-2xl border border-emerald/25 bg-emerald/5 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                    <Gavel className="h-5 w-5 text-emerald" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="law">LAW</Badge>
                      {data.law.category && (
                        <span className="text-[10px] font-mono font-semibold text-gold uppercase tracking-widest">
                          {data.law.category}
                        </span>
                      )}
                    </div>
                    <h1 className="font-mono text-lg font-bold text-white leading-snug">
                      {data.law.statement}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Established {formatDate(data.law.established_at)}
                  </span>
                  {data.topic && (
                    <Link
                      href={`/topic/${data.topic.id}`}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <ChevronRight className="h-3 w-3" />
                      Source topic
                    </Link>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    icon: Users,
                    label: 'Total Votes',
                    value: formatNumber(data.stats.uniqueVoters),
                    color: 'text-for-400',
                    bg: 'bg-for-500/10',
                    border: 'border-for-500/20',
                  },
                  {
                    icon: CheckCircle2,
                    label: 'Final Majority',
                    value: `${data.stats.finalMajority}% for`,
                    color: 'text-emerald',
                    bg: 'bg-emerald/10',
                    border: 'border-emerald/20',
                  },
                  {
                    icon: Flame,
                    label: 'Peak Daily',
                    value: formatNumber(data.stats.peakDailyVotes),
                    color: 'text-gold',
                    bg: 'bg-gold/10',
                    border: 'border-gold/20',
                  },
                  {
                    icon: Calendar,
                    label: 'Days to Law',
                    value: data.stats.daysToLaw != null ? `${data.stats.daysToLaw}d` : '—',
                    color: 'text-purple',
                    bg: 'bg-purple/10',
                    border: 'border-purple/20',
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={cn(
                      'rounded-xl border p-3.5 flex flex-col gap-1',
                      s.bg,
                      s.border
                    )}
                  >
                    <s.icon className={cn('h-4 w-4', s.color)} />
                    <p className={cn('text-xl font-mono font-bold', s.color)}>{s.value}</p>
                    <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Vote for/against breakdown */}
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-surface-500" />
                  Vote Breakdown
                </h2>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-mono font-bold text-for-400 w-12">
                    {Math.round(data.law.blue_pct)}%
                  </span>
                  <div className="flex-1 h-3 rounded-full bg-surface-300 overflow-hidden flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(data.law.blue_pct)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full bg-for-500 rounded-l-full"
                    />
                    <div
                      className="h-full bg-against-500 rounded-r-full flex-1"
                      style={{ width: `${100 - Math.round(data.law.blue_pct)}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono font-bold text-against-400 w-12 text-right">
                    {100 - Math.round(data.law.blue_pct)}%
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-mono text-surface-500">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3 text-for-500" />
                    {formatNumber(data.stats.forVotes)} for
                  </span>
                  <span className="text-surface-600">{formatNumber(data.stats.uniqueVoters)} total</span>
                  <span className="flex items-center gap-1">
                    {formatNumber(data.stats.againstVotes)} against
                    <ThumbsDown className="h-3 w-3 text-against-500" />
                  </span>
                </div>
              </div>

              {/* Vote timeline chart */}
              {data.voteTimeline.length >= 2 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-surface-500" />
                    Consensus Trajectory
                  </h2>

                  {/* Cumulative percentage line */}
                  <div className="mb-1">
                    <VoteSparkline points={data.voteTimeline} />
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-surface-600">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-6 h-0.5 bg-surface-500 opacity-40" style={{ borderTop: '1px dashed' }} />
                      50% parity
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-6 h-0.5 bg-emerald opacity-40" style={{ borderTop: '1px dashed' }} />
                      67% law threshold
                    </span>
                  </div>

                  {/* Daily activity bars */}
                  <div className="mt-4 pt-4 border-t border-surface-300">
                    <p className="text-[10px] font-mono text-surface-600 mb-2 uppercase tracking-widest">Daily vote activity</p>
                    <DailyBars points={data.voteTimeline} />
                    <div className="flex justify-between mt-1 text-[9px] font-mono text-surface-600">
                      {data.voteTimeline.length > 0 && (
                        <>
                          <span>{data.voteTimeline[0].date}</span>
                          <span>{data.voteTimeline[data.voteTimeline.length - 1].date}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Top arguments */}
              {data.topArguments.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-surface-500" />
                    Most Influential Arguments
                  </h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.topArguments.map((arg) => (
                      <ArgCard key={arg.id} arg={arg} />
                    ))}
                  </div>
                  {data.topic && (
                    <Link
                      href={`/topic/${data.topic.id}`}
                      className="mt-4 flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      View all arguments
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              )}

              {/* Coalition stances */}
              {data.coalitionStances.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Users className="h-4 w-4 text-surface-500" />
                    Coalition Alignment
                  </h2>
                  <div className="space-y-2">
                    {data.coalitionStances.map((s) => (
                      <div
                        key={s.coalition_id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-300 flex-shrink-0">
                          <Users className="h-4 w-4 text-surface-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/coalitions/${s.coalition_id}`}
                            className="text-sm font-mono text-white hover:text-for-400 transition-colors truncate block"
                          >
                            {s.coalition_name}
                          </Link>
                          <p className="text-[10px] font-mono text-surface-500">
                            {s.member_count.toLocaleString()} members
                          </p>
                        </div>
                        <div
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider',
                            s.stance === 'for'
                              ? 'bg-for-500/15 text-for-400'
                              : s.stance === 'against'
                              ? 'bg-against-500/15 text-against-400'
                              : 'bg-surface-300 text-surface-500'
                          )}
                        >
                          {s.stance}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Continuation topics */}
              {data.continuations.length > 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
                  <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <GitFork className="h-4 w-4 text-surface-500" />
                    Chain Continuations
                    <span className="ml-auto text-[10px] font-mono text-surface-600 normal-case tracking-normal">
                      Topics spawned by this law
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {data.continuations.map((c) => {
                      const statusVariant: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
                        proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
                      }
                      return (
                        <Link
                          key={c.id}
                          href={`/topic/${c.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-for-500/30 hover:bg-for-500/5 transition-colors group"
                        >
                          <Badge variant={statusVariant[c.status] ?? 'proposed'}>
                            {c.status}
                          </Badge>
                          <p className="flex-1 text-sm font-mono text-surface-300 group-hover:text-white transition-colors line-clamp-1">
                            {c.statement}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[11px] font-mono text-for-400">
                              {Math.round(c.blue_pct)}%
                            </span>
                            <span className="text-[10px] font-mono text-surface-600">
                              {formatNumber(c.total_votes)}v
                            </span>
                            <Zap className="h-3.5 w-3.5 text-surface-600 group-hover:text-for-400 transition-colors" />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* No data fallback */}
              {data.voteTimeline.length < 2 &&
                data.topArguments.length === 0 &&
                data.continuations.length === 0 &&
                data.coalitionStances.length === 0 && (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
                  <BarChart2 className="h-8 w-8 text-surface-600 mx-auto mb-3" />
                  <p className="text-sm font-mono text-surface-500">
                    Impact data will appear as votes and arguments accumulate.
                  </p>
                </div>
              )}

              {/* Link back to law + topic */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/law/${lawId}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono transition-colors"
                >
                  <Gavel className="h-4 w-4 text-emerald" />
                  Read the Law
                </Link>
                {data.topic && (
                  <Link
                    href={`/topic/${data.topic.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono transition-colors"
                  >
                    <MessageSquare className="h-4 w-4 text-for-400" />
                    Source Debate
                  </Link>
                )}
                <Link
                  href={`/law/${lawId}/graph`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 text-white text-sm font-mono transition-colors"
                >
                  <TrendingUp className="h-4 w-4 text-gold" />
                  Knowledge Graph
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
