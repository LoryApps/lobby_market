'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Flame,
  Mic,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MomentumPageData, DebateEvent } from './page'
import type { VoteTrendResponse, VoteTrendPoint } from '@/app/api/topics/[id]/vote-trend/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Full momentum chart (SVG) ────────────────────────────────────────────────

interface TooltipData {
  x: number
  y: number
  date: string
  forPct: number
  totalVotes: number
}

function MomentumChart({
  points,
  debates,
}: {
  points: VoteTrendPoint[]
  debates: DebateEvent[]
}) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const W = 560
  const H = 220
  const padL = 36
  const padR = 12
  const padT = 16
  const padB = 28

  const innerW = W - padL - padR
  const innerH = H - padT - padB

  // Y-axis range: 20–80 if data fits, else expand to fit
  const minPct = Math.min(...points.map((p) => p.forPct))
  const maxPct = Math.max(...points.map((p) => p.forPct))
  const lo = Math.max(0, Math.min(minPct - 5, 35))
  const hi = Math.min(100, Math.max(maxPct + 5, 65))

  const firstDate = new Date(points[0].date).getTime()
  const lastDate = new Date(points[points.length - 1].date).getTime()
  const dateSpan = Math.max(lastDate - firstDate, 1)

  function xOf(dateStr: string) {
    const t = new Date(dateStr).getTime()
    return padL + ((t - firstDate) / dateSpan) * innerW
  }

  function yOf(pct: number) {
    return padT + innerH - ((pct - lo) / (hi - lo)) * innerH
  }

  // Build line path
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(p.date).toFixed(1)},${yOf(p.forPct).toFixed(1)}`)
    .join('')

  // Area path (close back to baseline at 50%)
  const baselineY = yOf(50)
  const areaD =
    pathD +
    `L${xOf(points[points.length - 1].date).toFixed(1)},${baselineY.toFixed(1)}` +
    `L${xOf(points[0].date).toFixed(1)},${baselineY.toFixed(1)}Z`

  const latestPct = points[points.length - 1].forPct
  const isBulish = latestPct >= 50

  // Y-axis tick values
  const yTicks = [lo, 50, hi].filter(
    (v, i, arr) => arr.findIndex((u) => Math.abs(u - v) < 8) === i && v >= lo && v <= hi
  )

  // X-axis tick dates (up to 5)
  const step = Math.max(1, Math.floor(points.length / 5))
  const xTicks: VoteTrendPoint[] = []
  for (let i = 0; i < points.length; i += step) xTicks.push(points[i])
  if (xTicks[xTicks.length - 1] !== points[points.length - 1]) {
    xTicks.push(points[points.length - 1])
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const svgX = ((e.clientX - rect.left) / rect.width) * W
    const relX = svgX - padL
    const dateFraction = Math.max(0, Math.min(1, relX / innerW))
    const hoveredDate = new Date(firstDate + dateFraction * dateSpan)

    // Find nearest point
    let nearest = points[0]
    let minDiff = Infinity
    for (const p of points) {
      const diff = Math.abs(new Date(p.date).getTime() - hoveredDate.getTime())
      if (diff < minDiff) {
        minDiff = diff
        nearest = p
      }
    }

    setTooltip({
      x: xOf(nearest.date),
      y: yOf(nearest.forPct),
      date: nearest.date,
      forPct: nearest.forPct,
      totalVotes: nearest.totalVotes,
    })
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        aria-label="Vote momentum line chart"
        role="img"
      >
        <defs>
          <linearGradient id="mom-for-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="mom-against-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="mom-clip">
            <rect x={padL} y={padT} width={innerW} height={innerH} />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={padL}
              y1={yOf(v)}
              x2={padL + innerW}
              y2={yOf(v)}
              stroke="#27272a"
              strokeWidth="1"
              strokeDasharray={v === 50 ? '4 4' : '2 4'}
            />
            <text
              x={padL - 6}
              y={yOf(v)}
              dy="0.35em"
              textAnchor="end"
              fontSize="9"
              fill="#71717a"
              fontFamily="monospace"
            >
              {Math.round(v)}%
            </text>
          </g>
        ))}

        {/* X-axis ticks */}
        {xTicks.map((p) => (
          <text
            key={p.date}
            x={xOf(p.date)}
            y={padT + innerH + 14}
            textAnchor="middle"
            fontSize="9"
            fill="#52525b"
            fontFamily="monospace"
          >
            {shortDate(p.date)}
          </text>
        ))}

        {/* Debate event markers */}
        {debates.map((debate) => {
          const eventDate = new Date(debate.scheduled_at)
          if (
            eventDate.getTime() < firstDate - 86_400_000 ||
            eventDate.getTime() > lastDate + 86_400_000
          )
            return null
          const evX = xOf(debate.scheduled_at)
          return (
            <g key={debate.id} clipPath="url(#mom-clip)">
              <line
                x1={evX}
                y1={padT}
                x2={evX}
                y2={padT + innerH}
                stroke="#a855f7"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <circle cx={evX} cy={padT + 4} r="4" fill="#a855f7" opacity="0.8" />
            </g>
          )
        })}

        {/* Area fill */}
        <g clipPath="url(#mom-clip)">
          <path d={areaD} fill={isBulish ? 'url(#mom-for-grad)' : 'url(#mom-against-grad)'} />
        </g>

        {/* Main line */}
        <g clipPath="url(#mom-clip)">
          <motion.path
            d={pathD}
            fill="none"
            stroke={isBulish ? '#3b82f6' : '#ef4444'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
          />
        </g>

        {/* Tooltip crosshair */}
        {tooltip && (
          <g>
            <line
              x1={tooltip.x}
              y1={padT}
              x2={tooltip.x}
              y2={padT + innerH}
              stroke="#52525b"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={tooltip.x}
              cy={tooltip.y}
              r="4"
              fill={tooltip.forPct >= 50 ? '#3b82f6' : '#ef4444'}
              stroke="#0a0a0f"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Tooltip box */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute top-2 right-2 bg-surface-50 border border-surface-300 rounded-xl px-3 py-2 text-xs font-mono shadow-lg pointer-events-none"
          >
            <p className="text-surface-500 text-[10px] mb-0.5">{shortTime(tooltip.date)}</p>
            <p className={cn('font-bold text-sm', tooltip.forPct >= 50 ? 'text-for-400' : 'text-against-400')}>
              {tooltip.forPct.toFixed(1)}% FOR
            </p>
            <p className="text-surface-500 text-[10px]">
              {tooltip.totalVotes.toLocaleString()} votes
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debate legend */}
      {debates.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 px-1">
          <div className="h-0.5 w-4 bg-purple/70 border-dashed" style={{ borderTop: '2px dashed #a855f7' }} />
          <span className="text-[10px] font-mono text-surface-500">Debate event</span>
        </div>
      )}
    </div>
  )
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string
  value: string
  subValue?: string
  icon: typeof Activity
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', iconBg)}>
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className="font-mono text-xl font-bold text-white leading-none">{value}</p>
      {subValue && <p className="text-[10px] font-mono text-surface-500 mt-0.5">{subValue}</p>}
    </div>
  )
}

// ─── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({ title, body, icon: Icon, iconColor }: {
  title: string
  body: string
  icon: typeof Sparkles
  iconColor: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex gap-3">
      <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', iconColor)} />
      <div className="min-w-0">
        <p className="text-xs font-mono font-semibold text-white mb-0.5">{title}</p>
        <p className="text-xs font-mono text-surface-500 leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

// ─── Debate event list ─────────────────────────────────────────────────────────

const DEBATE_TYPE_LABELS: Record<string, string> = {
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

const DEBATE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-surface-400' },
  live: { label: 'Live', color: 'text-emerald' },
  ended: { label: 'Ended', color: 'text-surface-500' },
  cancelled: { label: 'Cancelled', color: 'text-against-400' },
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MomentumClient({ data }: { data: MomentumPageData }) {
  const [trendData, setTrendData] = useState<VoteTrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { topic, debates } = data

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/topics/${topic.id}/vote-trend`, { cache: 'no-store' })
      if (res.ok) {
        const json: VoteTrendResponse = await res.json()
        setTrendData(json)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topic.id])

  useEffect(() => { load() }, [load])

  // ── Derived statistics ────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!trendData || !trendData.hasEnoughData) return null
    const points = trendData.points

    const pcts = points.map((p) => p.forPct)
    const peakFor = Math.max(...pcts)
    const peakAgainst = 100 - Math.min(...pcts)

    // Count inflection points: times the majority (>50%) flipped sides
    let inflections = 0
    let prevMajority = pcts[0] >= 50 ? 'for' : 'against'
    for (let i = 1; i < pcts.length; i++) {
      const cur = pcts[i] >= 50 ? 'for' : 'against'
      if (cur !== prevMajority) {
        inflections++
        prevMajority = cur
      }
    }

    // Momentum: compare first 20% to last 20%
    const slice = Math.max(1, Math.floor(points.length * 0.2))
    const earlyAvg = pcts.slice(0, slice).reduce((a, b) => a + b, 0) / slice
    const lateAvg = pcts.slice(-slice).reduce((a, b) => a + b, 0) / slice
    const delta = lateAvg - earlyAvg

    // Contest score: 0-100 based on how close to 50% the average is and how many inflections
    const avgForPct = pcts.reduce((a, b) => a + b, 0) / pcts.length
    const contestScore = Math.round(
      100 - Math.abs(avgForPct - 50) * 1.5 + Math.min(inflections * 5, 20)
    )

    // Votes per day
    const firstDate = new Date(points[0].date)
    const lastDate = new Date(points[points.length - 1].date)
    const daySpan = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / 86_400_000)
    )
    const votesPerDay = Math.round(trendData.totalVotes / daySpan)

    return {
      peakFor: Math.round(peakFor),
      peakAgainst: Math.round(peakAgainst),
      inflections,
      delta,
      earlyAvg,
      lateAvg,
      contestScore: Math.max(0, Math.min(100, contestScore)),
      votesPerDay,
      daySpan,
    }
  }, [trendData])

  const STATUS_CONFIG: Record<string, { label: string; variant: 'proposed' | 'active' | 'law' | 'failed' }> = {
    proposed: { label: 'Proposed', variant: 'proposed' },
    active: { label: 'Active', variant: 'active' },
    voting: { label: 'Voting', variant: 'active' },
    law: { label: 'LAW', variant: 'law' },
    failed: { label: 'Failed', variant: 'failed' },
  }
  const statusCfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, variant: 'proposed' as const }

  // ── Insights ───────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    if (!stats) return []
    const out: { title: string; body: string; icon: typeof Sparkles; iconColor: string }[] = []

    // Momentum direction
    if (Math.abs(stats.delta) >= 2) {
      const gaining = stats.delta > 0
      out.push({
        title: gaining ? 'FOR momentum is building' : 'AGAINST momentum is building',
        body: `The last votes cast shifted ${Math.abs(stats.delta).toFixed(1)} percentage points ${gaining ? 'toward FOR' : 'toward AGAINST'} compared to when the debate first started — a ${Math.abs(stats.delta) > 5 ? 'significant' : 'modest'} late swing.`,
        icon: gaining ? TrendingUp : TrendingDown,
        iconColor: gaining ? 'text-for-400' : 'text-against-400',
      })
    } else {
      out.push({
        title: 'Stable consensus',
        body: `Opinion has barely shifted over the life of this debate — the FOR/AGAINST split has stayed within 2 percentage points from start to finish, indicating a stable and settled position.`,
        icon: Minus,
        iconColor: 'text-surface-400',
      })
    }

    // Contest level
    if (stats.inflections >= 2) {
      out.push({
        title: `Contested ${stats.inflections} time${stats.inflections === 1 ? '' : 's'}`,
        body: `The majority flipped ${stats.inflections} time${stats.inflections === 1 ? '' : 's'} — this was a genuinely competitive debate where community opinion reversed direction multiple times before settling.`,
        icon: Scale,
        iconColor: 'text-purple',
      })
    } else if (stats.contestScore < 40) {
      out.push({
        title: 'One-sided debate',
        body: `The community reached a strong consensus early and maintained it throughout — one side led the vote consistently with little meaningful challenge from the other.`,
        icon: BarChart2,
        iconColor: 'text-surface-500',
      })
    }

    // Peak insight
    if (stats.peakFor > topic.blue_pct + 3) {
      out.push({
        title: 'FOR peaked higher',
        body: `The FOR side reached a peak of ${stats.peakFor}% during this debate but has since settled back to ${Math.round(topic.blue_pct)}% — it lost ${stats.peakFor - Math.round(topic.blue_pct)} percentage points from its high.`,
        icon: Flame,
        iconColor: 'text-against-300',
      })
    }

    return out.slice(0, 3)
  }, [stats, topic.blue_pct])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-5 pb-24 md:pb-12">

        {/* ── Back + header ──────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-5">
          <Link
            href={`/topic/${topic.id}`}
            aria-label="Back to topic"
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {topic.category && (
                <span className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  {topic.category}
                </span>
              )}
              <Badge variant={statusCfg.variant} size="sm">
                {statusCfg.label}
              </Badge>
              <span className="text-[10px] font-mono text-surface-500">
                {topic.total_votes.toLocaleString()} votes
              </span>
            </div>
            <h1 className="font-mono text-base font-bold text-white leading-snug line-clamp-2">
              {topic.statement}
            </h1>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh momentum data"
            className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Page title ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-5">
          <Activity className="h-4 w-4 text-for-400" />
          <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
            Vote Momentum
          </h2>
        </div>

        {/* ── Stats grid ─────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatCard
              label="Current FOR"
              value={`${Math.round(topic.blue_pct)}%`}
              subValue={`${100 - Math.round(topic.blue_pct)}% against`}
              icon={Zap}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
            />
            <StatCard
              label="Peak FOR"
              value={`${stats.peakFor}%`}
              subValue={`${stats.peakAgainst}% against peak`}
              icon={TrendingUp}
              iconColor="text-gold"
              iconBg="bg-gold/10"
            />
            <StatCard
              label="Contested"
              value={`${stats.inflections}×`}
              subValue={stats.inflections === 0 ? 'never flipped' : `majority flipped`}
              icon={Scale}
              iconColor="text-purple"
              iconBg="bg-purple/10"
            />
          </div>
        )}

        {/* ── Chart ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                FOR% over time
              </span>
            </div>
            {stats && (
              <span className="text-[10px] font-mono text-surface-500">
                {stats.daySpan} day{stats.daySpan !== 1 ? 's' : ''} · {stats.votesPerDay}/day avg
              </span>
            )}
          </div>

          {loading && (
            <div className="h-48 flex items-center justify-center">
              <div className="flex items-center gap-2 text-surface-500 text-sm font-mono">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading trend data…
              </div>
            </div>
          )}

          {!loading && (!trendData || !trendData.hasEnoughData) && (
            <EmptyState
              icon={BarChart2}
              title="Not enough data yet"
              description="Vote trend needs at least 2 days of data to draw the momentum chart."
            />
          )}

          {!loading && trendData?.hasEnoughData && (
            <MomentumChart points={trendData.points} debates={debates} />
          )}

          {/* Legend */}
          {!loading && trendData?.hasEnoughData && (
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-surface-300">
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-5 bg-for-500 rounded-full" />
                <span className="text-[10px] font-mono text-surface-500">FOR %</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-5 bg-surface-400 rounded-full" style={{ borderTop: '2px dashed #71717a' }} />
                <span className="text-[10px] font-mono text-surface-500">50% majority</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Insights ───────────────────────────────────────────────── */}
        {insights.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Momentum Insights
              </span>
            </div>
            <div className="space-y-2">
              {insights.map((ins) => (
                <InsightCard key={ins.title} {...ins} />
              ))}
            </div>
          </div>
        )}

        {/* ── Debate events ──────────────────────────────────────────── */}
        {debates.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Mic className="h-3.5 w-3.5 text-purple" />
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Debate Events
              </span>
            </div>
            <div className="space-y-2">
              {debates.map((debate) => {
                const statusCfg = DEBATE_STATUS_CONFIG[debate.status] ?? { label: debate.status, color: 'text-surface-500' }
                return (
                  <Link
                    key={debate.id}
                    href={`/debate/${debate.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-purple/40 hover:bg-surface-200/60 transition-colors"
                  >
                    <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-purple/10 border border-purple/20">
                      <Mic className="h-3.5 w-3.5 text-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-white font-semibold truncate">
                        {debate.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-purple">
                          {DEBATE_TYPE_LABELS[debate.type] ?? debate.type}
                        </span>
                        <span className={cn('text-[10px] font-mono', statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                        <span className="text-[10px] font-mono text-surface-500">
                          {shortTime(debate.scheduled_at)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/topic/${topic.id}`}
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-surface-500" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Back to</p>
              <p className="text-sm font-mono text-white font-semibold">Topic</p>
            </div>
          </Link>
          <Link
            href={`/topic/${topic.id}/timeline`}
            className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">See also</p>
              <p className="text-sm font-mono text-white font-semibold">Full Timeline</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-surface-500" />
          </Link>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
