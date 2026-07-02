'use client'

/**
 * /topic/[id]/mandate — The Mandate Meter
 *
 * Visualises the current consensus strength of a civic debate — how close
 * (or far) it is from the 75% law threshold, recent momentum, and a
 * side-by-side comparison of similar topics in the same category.
 *
 * Distinct from:
 *   /topic/[id]/vote-trend  — full daily timeline of FOR% shifts
 *   /topic/[id]/forecast    — prediction-market confidence
 *   /topic/[id]/pressure    — active lobbying / clout pressure
 *   /topic/[id]/stats       — raw vote statistics
 *
 * Mandate answers: "How strong is the current consensus and what would it
 * take to cross the law threshold?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MandateResponse, MandateClass, ComparableTopic } from '@/app/api/topics/[id]/mandate/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return '1 day ago'
  if (d < 30) return `${d} days ago`
  if (d < 365) return `${Math.floor(d / 30)} months ago`
  return `${Math.floor(d / 365)} years ago`
}

// ─── Mandate-class config ─────────────────────────────────────────────────────

const CLASS_CONFIG: Record<
  MandateClass,
  {
    color: string
    bg: string
    border: string
    barColor: string
    glow: string
    icon: typeof Gavel
  }
> = {
  decisive: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    barColor: 'bg-emerald',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.25)]',
    icon: Gavel,
  },
  strong: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    barColor: 'bg-for-500',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.20)]',
    icon: ThumbsUp,
  },
  building: {
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/25',
    barColor: 'bg-for-400',
    glow: '',
    icon: TrendingUp,
  },
  contested: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    barColor: 'bg-gold',
    glow: '',
    icon: Scale,
  },
  opposition: {
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/25',
    barColor: 'bg-against-400',
    glow: '',
    icon: TrendingDown,
  },
  rejection: {
    color: 'text-against-500',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    barColor: 'bg-against-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.20)]',
    icon: ThumbsDown,
  },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active: { label: 'Active', color: 'text-for-400' },
  voting: { label: 'In Vote', color: 'text-gold' },
  law: { label: 'Law', color: 'text-emerald' },
  failed: { label: 'Failed', color: 'text-against-400' },
}

// ─── Mini trend chart (SVG sparkline) ────────────────────────────────────────

function MandateSparkline({
  points,
  width = 200,
  height = 48,
}: {
  points: { running_for_pct: number }[]
  width?: number
  height?: number
}) {
  if (points.length < 2) return null

  const min = Math.min(...points.map((p) => p.running_for_pct))
  const max = Math.max(...points.map((p) => p.running_for_pct))
  const range = Math.max(max - min, 5) // avoid flat line

  const toX = (i: number) => (i / (points.length - 1)) * width
  const toY = (v: number) => height - ((v - min) / range) * (height - 4) - 2

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.running_for_pct).toFixed(1)}`)
    .join(' ')

  const last = points[points.length - 1].running_for_pct
  const first = points[0].running_for_pct
  const gaining = last >= first

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-12"
      preserveAspectRatio="none"
    >
      {/* Law threshold line at 75% */}
      {(() => {
        const thresholdY = toY(75)
        if (thresholdY >= 0 && thresholdY <= height) {
          return (
            <line
              x1={0}
              y1={thresholdY}
              x2={width}
              y2={thresholdY}
              stroke="rgba(59,130,246,0.3)"
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )
        }
        return null
      })()}
      <path
        d={d}
        fill="none"
        stroke={gaining ? 'rgb(59,130,246)' : 'rgb(239,68,68)'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={toX(points.length - 1)}
        cy={toY(last)}
        r={3}
        fill={gaining ? 'rgb(59,130,246)' : 'rgb(239,68,68)'}
      />
    </svg>
  )
}

// ─── Mandate gauge ────────────────────────────────────────────────────────────

function MandateGauge({ forPct }: { forPct: number }) {
  const clamped = Math.max(0, Math.min(100, forPct))

  return (
    <div className="relative">
      {/* Label row */}
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500 mb-1.5">
        <span>Rejection</span>
        <span className="text-surface-400">Contested</span>
        <span className="text-for-400">Law Threshold</span>
        <span className="text-emerald">Decisive</span>
      </div>

      {/* Track */}
      <div className="relative h-4 rounded-full overflow-hidden bg-surface-200/50 border border-surface-300/30">
        {/* Zone colors */}
        <div className="absolute inset-0 flex">
          <div className="w-[25%] bg-against-600/20" />
          <div className="w-[15%] bg-against-500/15" />
          <div className="w-[20%] bg-gold/10" />
          <div className="w-[15%] bg-for-400/15" />
          <div className="w-[10%] bg-for-500/20" />
          <div className="w-[15%] bg-emerald/20" />
        </div>
        {/* Fill bar */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            clamped >= 85 ? 'bg-emerald/70' :
            clamped >= 75 ? 'bg-for-500/70' :
            clamped >= 60 ? 'bg-for-400/60' :
            clamped >= 40 ? 'bg-gold/60' :
            clamped >= 25 ? 'bg-against-400/60' :
            'bg-against-600/70'
          )}
        />
        {/* Threshold markers */}
        <div className="absolute inset-0 flex items-center pointer-events-none">
          {/* 25% — rejection threshold */}
          <div className="absolute left-[25%] top-0 bottom-0 w-px bg-against-500/50" />
          {/* 75% — law threshold */}
          <div className="absolute left-[75%] top-0 bottom-0 w-px bg-for-500" />
        </div>
      </div>

      {/* Percentage labels below */}
      <div className="flex items-center justify-between text-[10px] font-mono mt-1">
        <span className="text-surface-600">0%</span>
        <span className="text-against-500">25%</span>
        <span className="text-surface-600">50%</span>
        <span className="text-for-400 font-semibold">75%</span>
        <span className="text-surface-600">100%</span>
      </div>

      {/* Needle */}
      <div
        className="absolute top-6 -translate-y-1/2 -translate-x-1/2 transition-all duration-1000"
        style={{ left: `${clamped}%` }}
      >
        <div className="relative flex flex-col items-center">
          <div className="w-0.5 h-3 bg-white rounded-full" />
          <div className="text-xs font-mono font-bold text-white mt-1 whitespace-nowrap bg-surface-100/90 px-1.5 py-0.5 rounded border border-surface-300/40">
            {Math.round(clamped)}% FOR
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Comparable topic row ─────────────────────────────────────────────────────

function ComparableRow({ topic }: { topic: ComparableTopic }) {
  const cfg = CLASS_CONFIG[topic.mandate_class]
  const status = STATUS_LABELS[topic.status] ?? { label: topic.status, color: 'text-surface-500' }

  return (
    <Link
      href={`/topic/${topic.id}/mandate`}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-200/30 transition-colors group"
    >
      {/* Mini gauge */}
      <div className="flex-shrink-0 w-20">
        <div className="h-2 rounded-full bg-surface-200/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full', cfg.barColor)}
            style={{ width: `${Math.max(2, topic.blue_pct)}%`, opacity: 0.7 }}
          />
        </div>
        <p className={cn('text-[10px] font-mono mt-0.5', cfg.color)}>
          {Math.round(topic.blue_pct)}%
        </p>
      </div>

      {/* Statement */}
      <p className="flex-1 text-sm text-surface-400 group-hover:text-white transition-colors line-clamp-1 font-mono">
        {topic.statement}
      </p>

      {/* Status */}
      <span className={cn('text-[10px] font-mono flex-shrink-0', status.color)}>
        {status.label}
      </span>

      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MandateSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-4 w-full mb-6" />
        <Skeleton className="h-8 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MandateClient({
  topicId,
  topicStatement,
}: {
  topicId: string
  topicStatement: string
}) {
  const router = useRouter()
  const [data, setData] = useState<MandateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topicId}/mandate`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const cfg = data ? CLASS_CONFIG[data.mandate.class] : null
  const MandateIcon = cfg?.icon ?? Scale

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back nav */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-surface-600">/</span>
          <Link
            href={`/topic/${topicId}`}
            className="text-sm font-mono text-surface-500 hover:text-white transition-colors line-clamp-1"
          >
            {topicStatement.length > 50 ? topicStatement.slice(0, 50) + '…' : topicStatement}
          </Link>
        </div>

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
            <Gavel className="h-5 w-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">The Mandate Meter</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Consensus strength & law threshold analysis
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Content */}
        {loading && <MandateSkeleton />}
        {error && (
          <EmptyState
            icon={Scale}
            title="Couldn't load mandate data"
            description="Something went wrong fetching the mandate analysis."
            action={{ label: 'Try again', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-5">

            {/* ── Mandate class card ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-6',
                cfg!.bg,
                cfg!.border,
                cfg!.glow
              )}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className={cn('flex items-center gap-2 mb-1', cfg!.color)}>
                    <MandateIcon className="h-5 w-5" />
                    <span className="font-mono text-lg font-bold">{data.mandate.label}</span>
                  </div>
                  <p className="text-sm text-surface-400 leading-relaxed">
                    {data.mandate.description}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn('font-mono text-4xl font-black', cfg!.color)}>
                    {Math.round(data.topic.blue_pct)}%
                  </p>
                  <p className="text-[11px] font-mono text-surface-500">FOR</p>
                </div>
              </div>

              {/* Visual gauge */}
              <div className="pt-2 pb-6">
                <MandateGauge forPct={data.topic.blue_pct} />
              </div>

              {/* Zone labels */}
              <div className="flex gap-2 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-mono text-against-500 bg-against-600/10 border border-against-600/20 px-2 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-against-600/50 inline-block" />
                  &lt;25% Rejection
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-gold/50 inline-block" />
                  40–59% Contested
                </span>
                <span className="flex items-center gap-1 text-[10px] font-mono text-for-400 bg-for-500/10 border border-for-500/20 px-2 py-0.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-for-500/50 inline-block" />
                  ≥75% Law Threshold
                </span>
              </div>
            </motion.div>

            {/* ── Stats row ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="grid grid-cols-3 gap-3"
            >
              {/* Total votes */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="h-3.5 w-3.5 text-surface-500" />
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">Total Votes</p>
                </div>
                <p className="font-mono text-xl font-bold text-white">
                  {data.topic.total_votes.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                  over {data.topic.age_days} days
                </p>
              </div>

              {/* Votes needed */}
              <div className={cn(
                'rounded-xl border p-4',
                data.mandate.for_votes_needed === 0
                  ? 'bg-emerald/5 border-emerald/20'
                  : 'bg-surface-100 border-surface-300'
              )}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Gavel className="h-3.5 w-3.5 text-surface-500" />
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">To Law</p>
                </div>
                {data.mandate.for_votes_needed === 0 ? (
                  <>
                    <p className="font-mono text-lg font-bold text-emerald">Threshold</p>
                    <p className="text-[10px] font-mono text-emerald/60 mt-0.5">Crossed ✓</p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-xl font-bold text-white">
                      +{data.mandate.for_votes_needed.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                      FOR votes needed
                    </p>
                  </>
                )}
              </div>

              {/* Distance from law threshold */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <ArrowRight className="h-3.5 w-3.5 text-surface-500" />
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">Gap</p>
                </div>
                <p className={cn(
                  'font-mono text-xl font-bold',
                  data.mandate.distance_to_law === 0 ? 'text-emerald' : 'text-white'
                )}>
                  {data.mandate.distance_to_law === 0
                    ? '0%'
                    : `${data.mandate.distance_to_law.toFixed(1)}%`}
                </p>
                <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                  {data.mandate.distance_to_law === 0
                    ? 'past law threshold'
                    : 'below law threshold'}
                </p>
              </div>
            </motion.div>

            {/* ── Momentum panel ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <h3 className="font-mono text-sm font-semibold text-white mb-4 flex items-center gap-2">
                {data.momentum.direction === 'gaining' && <TrendingUp className="h-4 w-4 text-for-400" />}
                {data.momentum.direction === 'losing' && <TrendingDown className="h-4 w-4 text-against-400" />}
                {data.momentum.direction === 'stable' && <Zap className="h-4 w-4 text-gold" />}
                {data.momentum.direction === 'insufficient_data' && <Clock className="h-4 w-4 text-surface-500" />}
                Vote Momentum
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                {/* Direction */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-1">Direction</p>
                  <p className={cn(
                    'text-sm font-mono font-semibold capitalize',
                    data.momentum.direction === 'gaining' ? 'text-for-400' :
                    data.momentum.direction === 'losing' ? 'text-against-400' :
                    data.momentum.direction === 'stable' ? 'text-gold' :
                    'text-surface-500'
                  )}>
                    {data.momentum.direction === 'insufficient_data'
                      ? 'Insufficient data'
                      : data.momentum.direction}
                  </p>
                </div>

                {/* 7-day FOR% */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-1">7-day FOR%</p>
                  <p className="text-sm font-mono font-semibold text-white">
                    {data.momentum.for_pct_last_7d !== null
                      ? `${data.momentum.for_pct_last_7d}%`
                      : '—'}
                  </p>
                </div>

                {/* Recent vote rate */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-1">Rate (30d)</p>
                  <p className="text-sm font-mono font-semibold text-white">
                    {data.momentum.recent_daily_rate > 0
                      ? `${data.momentum.recent_daily_rate}/day`
                      : '—'}
                  </p>
                </div>

                {/* Days to threshold */}
                <div>
                  <p className="text-[11px] font-mono text-surface-500 mb-1">Est. to Law</p>
                  <p className={cn(
                    'text-sm font-mono font-semibold',
                    data.momentum.days_to_threshold !== null ? 'text-for-300' : 'text-surface-600'
                  )}>
                    {data.mandate.for_votes_needed === 0
                      ? 'Reached'
                      : data.momentum.days_to_threshold !== null
                      ? `~${data.momentum.days_to_threshold}d`
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Recent vote counts */}
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 bg-surface-200/30 rounded-lg px-3 py-2">
                  <Flame className="h-3.5 w-3.5 text-gold" />
                  <span className="text-xs font-mono text-surface-400">
                    <span className="text-white font-semibold">{data.momentum.votes_last_7d}</span> votes last 7d
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-surface-200/30 rounded-lg px-3 py-2">
                  <Users className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-xs font-mono text-surface-400">
                    <span className="text-white font-semibold">{data.momentum.votes_last_30d}</span> votes last 30d
                  </span>
                </div>
              </div>

              {/* Sparkline */}
              {data.trend.length >= 2 && (
                <div className="border border-surface-300/30 rounded-lg p-3 bg-surface-200/20">
                  <p className="text-[10px] font-mono text-surface-600 mb-2">30-day FOR% trend</p>
                  <MandateSparkline points={data.trend} />
                  <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-surface-600">
                    <span>30 days ago</span>
                    <span>Today</span>
                  </div>
                </div>
              )}
            </motion.div>

            {/* ── Comparable topics ── */}
            {data.comparable_topics.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <h3 className="font-mono text-sm font-semibold text-white mb-1">
                  {data.topic.category ?? 'Similar'} Debates
                </h3>
                <p className="text-[11px] font-mono text-surface-500 mb-4">
                  Other topics in this category and their mandate strength
                </p>

                <div className="divide-y divide-surface-300/30">
                  {data.comparable_topics.map((t) => (
                    <ComparableRow key={t.id} topic={t} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Context footer ── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl bg-surface-200/20 border border-surface-300/30 p-4 text-center"
            >
              <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
                The law threshold is <span className="text-for-400 font-semibold">75% FOR</span>.
                Topics crossing this threshold with sufficient volume become established laws in The Codex.
                Rejection occurs below <span className="text-against-400 font-semibold">25% FOR</span>.
                Proposed{' '}
                <span className="text-surface-500">{relativeTime(data.topic.created_at)}</span>
                {data.topic.voting_ends_at && (
                  <> · Voting closes <span className="text-gold">{relativeTime(data.topic.voting_ends_at)}</span></>
                )}
              </p>
            </motion.div>

            {/* ── Related analysis links ── */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Vote Trend', href: `/topic/${topicId}/vote-trend`, desc: 'Full timeline' },
                { label: 'Forecast', href: `/topic/${topicId}/forecast`, desc: 'Prediction market' },
                { label: 'Pressure', href: `/topic/${topicId}/pressure`, desc: 'Active lobbying' },
                { label: 'Blueprint', href: `/topic/${topicId}/blueprint`, desc: 'If it became law' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/30 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-[11px] font-mono text-surface-500">{link.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 transition-colors" />
                </Link>
              ))}
            </div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
