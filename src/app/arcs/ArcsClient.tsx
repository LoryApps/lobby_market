'use client'

/**
 * /arcs — Civic Arcs
 *
 * Every resolved debate has a story. This page traces the full opinion arc
 * of topics that became law or failed — the journey from first vote to final
 * verdict, day by day.
 *
 * Each arc card shows a mini SVG line chart of the FOR% over the topic's
 * lifetime, revealing whether opinion was stable, gradually shifting, or
 * subject to sudden swings before resolution.
 *
 * Patterns to look for:
 *   Steady → topics that maintained conviction from the start
 *   Convergent → topics that drifted toward consensus over time
 *   Contested → topics that swung near 50/50 before resolving
 *   Decisive → topics that resolved quickly with a clear majority
 *
 * Distinct from:
 *   /drift       — shows opinion change over rolling windows (not full arc)
 *   /shifts      — tracks recent FOR% swings, not resolved history
 *   /momentum    — vote-split direction on active topics
 *   /forecast    — probability of passing (not the actual arc)
 *   /graveyard   — failed topics list (no arc visualization)
 *   /laws        — established laws list (no arc visualization)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  BookOpen,
  Cpu,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'

import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { TopicArc, ArcsResponse, ArcPoint } from '@/app/api/topics/arcs/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CAT_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/30' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Culture:     { text: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Education:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
}

const FALLBACK_CAT = { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }

function catStyle(cat: string | null) {
  return cat ? (CAT_COLORS[cat] ?? FALLBACK_CAT) : FALLBACK_CAT
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Arc pattern detection ────────────────────────────────────────────────────

type ArcPattern = 'steady' | 'convergent' | 'contested' | 'decisive' | 'reversed'

function detectPattern(arc: ArcPoint[], finalPct: number): ArcPattern {
  if (arc.length < 3) return 'decisive'
  const start = arc[0].pct
  const end = finalPct
  const values = arc.map((p) => p.pct)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  // Check if it reversed direction at some point
  const forSide = end >= 50
  const startedOpposite = forSide ? start < 45 : start > 55
  if (startedOpposite && range > 20) return 'reversed'

  // Contested: spent significant time near 50/50
  const contested = values.filter((v) => v >= 40 && v <= 60).length
  if (contested / values.length > 0.4 && range > 15) return 'contested'

  // Decisive: resolved quickly (few data points) or large margin
  if (arc.length <= 3 || Math.abs(end - 50) > 30) return 'decisive'

  // Convergent: gradually moving toward current position
  const firstHalf = values.slice(0, Math.floor(values.length / 2))
  const secondHalf = values.slice(Math.floor(values.length / 2))
  const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length
  const convergingToEnd = forSide
    ? secondAvg > firstAvg
    : secondAvg < firstAvg
  if (convergingToEnd && range > 8) return 'convergent'

  return 'steady'
}

const PATTERN_CONFIG: Record<ArcPattern, { label: string; color: string }> = {
  steady:     { label: 'Steady',     color: 'text-for-400' },
  convergent: { label: 'Convergent', color: 'text-emerald' },
  contested:  { label: 'Contested',  color: 'text-gold' },
  decisive:   { label: 'Decisive',   color: 'text-purple' },
  reversed:   { label: 'Reversed',   color: 'text-against-400' },
}

// ─── Duration formatting ──────────────────────────────────────────────────────

function formatDuration(created: string, resolved: string | null): string {
  const end = resolved ? new Date(resolved) : new Date()
  const diff = end.getTime() - new Date(created).getTime()
  const days = Math.round(diff / 86_400_000)
  if (days < 1) return '< 1 day'
  if (days === 1) return '1 day'
  if (days < 30) return `${days} days`
  const months = Math.round(days / 30)
  return `${months} mo`
}

// ─── Arc SVG chart ────────────────────────────────────────────────────────────

const W = 200
const H = 70
const PAD = 8

function ArcChart({
  arc,
  status,
  finalPct,
}: {
  arc: ArcPoint[]
  status: string
  finalPct: number
}) {
  const isLaw = status === 'law'
  const lineColor = isLaw ? '#3b82f6' : '#ef4444' // for-500 / against-500
  const areaColor = isLaw ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)'
  const endDotColor = isLaw ? '#3b82f6' : '#ef4444'

  if (!arc || arc.length < 2) {
    // No arc data — just show a final pct indicator
    const y = PAD + ((100 - finalPct) / 100) * (H - PAD * 2)
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
        <line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3,3" />
        <circle cx={W / 2} cy={y} r="4" fill={endDotColor} />
      </svg>
    )
  }

  const values = arc.map((p) => p.pct)
  const allValues = [...values, finalPct]
  const dataMin = Math.max(0, Math.min(...allValues) - 8)
  const dataMax = Math.min(100, Math.max(...allValues) + 8)
  const range = dataMax - dataMin || 1

  function toX(i: number) {
    return PAD + (i / (arc.length - 1)) * (W - PAD * 2)
  }
  function toY(v: number) {
    return PAD + ((dataMax - v) / range) * (H - PAD * 2)
  }

  const midlineY = toY(50)
  const coords = values.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
  const pathD = `M ${coords.join(' L ')}`
  const areaD = `M ${coords[0]} L ${coords.join(' L ')} L ${(W - PAD).toFixed(1)},${(H - PAD).toFixed(1)} L ${PAD.toFixed(1)},${(H - PAD).toFixed(1)} Z`

  const startX = PAD
  const startY = toY(values[0])
  const endX = W - PAD
  const endY = toY(values[values.length - 1])

  const startFill = values[0] >= 50 ? '#3b82f6' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
      {/* 50% midline */}
      {midlineY > PAD && midlineY < H - PAD && (
        <line
          x1={PAD} y1={midlineY}
          x2={W - PAD} y2={midlineY}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
          strokeDasharray="4,3"
        />
      )}

      {/* Area fill */}
      <path d={areaD} fill={areaColor} />

      {/* Line */}
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Start dot */}
      <circle cx={startX} cy={startY} r="2.5" fill={startFill} opacity="0.6" />

      {/* End dot */}
      <circle cx={endX} cy={endY} r="3.5" fill={endDotColor} />
    </svg>
  )
}

// ─── Topic arc card ───────────────────────────────────────────────────────────

function TopicArcCard({ topic, index }: { topic: TopicArc; index: number }) {
  const isLaw = topic.status === 'law'
  const cs = catStyle(topic.category)
  const Cat = topic.category ? (CATEGORY_ICON[topic.category] ?? Activity) : Activity
  const pattern = detectPattern(topic.arc, topic.final_blue_pct)
  const patternCfg = PATTERN_CONFIG[pattern]
  const duration = formatDuration(topic.created_at, topic.resolved_at)
  const startPct = topic.arc.length > 0 ? topic.arc[0].pct : topic.final_blue_pct
  const swing = Math.abs(topic.final_blue_pct - startPct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border bg-surface-100 hover:bg-surface-150 transition-all duration-200',
          'group overflow-hidden',
          isLaw
            ? 'border-for-500/20 hover:border-for-500/40'
            : 'border-against-500/20 hover:border-against-500/40',
        )}
      >
        {/* Status band */}
        <div className={cn(
          'h-0.5 w-full',
          isLaw ? 'bg-gradient-to-r from-for-600/60 via-for-400/80 to-for-600/60'
                : 'bg-gradient-to-r from-against-600/60 via-against-400/80 to-against-600/60',
        )} />

        <div className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Status badge */}
              {isLaw ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gold/10 border border-gold/30 text-gold text-[10px] font-mono font-bold tracking-widest">
                  <Gavel className="h-2.5 w-2.5" />
                  LAW
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-against-500/10 border border-against-500/30 text-against-400 text-[10px] font-mono font-bold tracking-widest">
                  <XCircle className="h-2.5 w-2.5" />
                  FAILED
                </span>
              )}

              {/* Category badge */}
              {topic.category && (
                <span className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
                  cs.bg, cs.border, cs.text,
                )}>
                  <Cat className="h-2.5 w-2.5" />
                  {topic.category}
                </span>
              )}

              {/* Pattern badge */}
              <span className={cn('text-[10px] font-mono', patternCfg.color)}>
                {patternCfg.label}
              </span>
            </div>

            {/* Duration */}
            <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">{duration}</span>
          </div>

          {/* Statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-surface-700 transition-colors">
            {topic.statement}
          </p>

          {/* Arc chart */}
          <div className="relative -mx-1">
            <ArcChart arc={topic.arc} status={topic.status} finalPct={topic.final_blue_pct} />
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
            <span>
              Start: <span className={startPct >= 50 ? 'text-for-400' : 'text-against-400'}>
                {startPct.toFixed(0)}%
              </span>
            </span>
            {swing > 2 && (
              <span className="flex items-center gap-0.5">
                {topic.final_blue_pct > startPct ? (
                  <TrendingUp className="h-2.5 w-2.5 text-for-400" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5 text-against-400" />
                )}
                {swing.toFixed(0)}pp swing
              </span>
            )}
            <span>
              End: <span className={topic.final_blue_pct >= 50 ? 'text-for-400' : 'text-against-400'}>
                {topic.final_blue_pct.toFixed(0)}%
              </span>
            </span>
          </div>

          {/* Votes */}
          <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Users className="h-2.5 w-2.5" />
            {topic.total_votes.toLocaleString()} votes
            <ArrowRight className="h-2.5 w-2.5 ml-auto text-surface-600 group-hover:text-surface-500 transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ArcCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      <div className="h-0.5 bg-surface-300" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ topics }: { topics: TopicArc[] }) {
  if (topics.length === 0) return null
  const laws = topics.filter((t) => t.status === 'law').length
  const failed = topics.length - laws
  const lawPct = Math.round((laws / topics.length) * 100)
  const avgSwing = topics.reduce((s, t) => {
    const start = t.arc.length > 0 ? t.arc[0].pct : t.final_blue_pct
    return s + Math.abs(t.final_blue_pct - start)
  }, 0) / topics.length

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Resolved', value: topics.length.toString(), color: 'text-surface-700' },
        { label: 'Became Law', value: `${laws} (${lawPct}%)`, color: 'text-for-400' },
        { label: 'Failed', value: failed.toString(), color: 'text-against-400' },
        { label: 'Avg Swing', value: `${avgSwing.toFixed(1)}pp`, color: 'text-gold' },
      ].map((stat) => (
        <div key={stat.label} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
          <div className={cn('text-lg font-mono font-bold', stat.color)}>{stat.value}</div>
          <div className="text-[10px] font-mono text-surface-500 mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArcsClient() {
  const [data, setData] = useState<ArcsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'law' | 'failed'>('all')
  const [patternFilter, setPatternFilter] = useState<ArcPattern | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (cat: string | null) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(false)
    try {
      const url = `/api/topics/arcs${cat ? `?category=${encodeURIComponent(cat)}` : ''}`
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error('fetch')
      const json = (await res.json()) as ArcsResponse
      setData(json)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(category)
    return () => { abortRef.current?.abort() }
  }, [load, category])

  // Filtered topics
  const filtered = (data?.topics ?? []).filter((t) => {
    if (statusFilter === 'law' && t.status !== 'law') return false
    if (statusFilter === 'failed' && t.status !== 'failed') return false
    if (patternFilter) {
      const p = detectPattern(t.arc, t.final_blue_pct)
      if (p !== patternFilter) return false
    }
    return true
  })

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pb-24 pt-6">
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-for-400" />
            <h1 className="text-xl font-mono font-bold text-white tracking-tight">
              Civic Arcs
            </h1>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-200 text-surface-500 border border-surface-300">
              Ch. 258
            </span>
          </div>
          <p className="text-sm text-surface-500 max-w-xl">
            Every resolved debate has a story. See how public opinion journeyed from first vote to
            final verdict — steady convictions, last-minute reversals, and everything in between.
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
              category === null
                ? 'bg-surface-300 text-white border-surface-400'
                : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400',
            )}
          >
            All categories
          </button>
          {CATEGORIES.map((cat) => {
            const cs = catStyle(cat)
            const Icon = CATEGORY_ICON[cat] ?? Activity
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat === category ? null : cat)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono border transition-all',
                  category === cat
                    ? cn(cs.bg, cs.border, cs.text)
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400',
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                {cat}
              </button>
            )
          })}
        </div>

        {/* Status + Pattern filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Status */}
          <div className="flex gap-1">
            {([
              { id: 'all' as const,    label: 'All' },
              { id: 'law' as const,    label: 'Laws' },
              { id: 'failed' as const, label: 'Failed' },
            ]).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                  statusFilter === id
                    ? id === 'law'
                      ? 'bg-gold/15 border-gold/40 text-gold'
                      : id === 'failed'
                        ? 'bg-against-500/15 border-against-500/40 text-against-400'
                        : 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Pattern filter */}
          <div className="flex gap-1 flex-wrap">
            {(Object.entries(PATTERN_CONFIG) as [ArcPattern, typeof PATTERN_CONFIG[ArcPattern]][]).map(([id, cfg]) => (
              <button
                key={id}
                onClick={() => setPatternFilter(patternFilter === id ? null : id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                  patternFilter === id
                    ? 'bg-surface-200 border-surface-400 ' + cfg.color
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400',
                )}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => load(category)}
            disabled={loading}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono bg-surface-100 text-surface-500 border border-surface-300 hover:border-surface-400 disabled:opacity-50 transition-all"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={Zap}
            title="Couldn't load arcs"
            description="There was a problem fetching the arc data. Try refreshing."
            actions={[{ label: 'Retry', onClick: () => load(category) }]}
          />
        )}

        {/* Loading */}
        {loading && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <ArcCardSkeleton key={i} />
              ))}
            </div>
          </>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <>
            <SummaryBar topics={data.topics} />

            <AnimatePresence mode="wait">
              {filtered.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <EmptyState
                    icon={BarChart2}
                    title={
                      category
                        ? `No resolved ${category} topics yet`
                        : 'No resolved topics match these filters'
                    }
                    description="Resolved debates appear here once topics reach law or failed status."
                    actions={[{ label: 'Clear filters', onClick: () => { setCategory(null); setStatusFilter('all'); setPatternFilter(null) } }]}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={`${category}-${statusFilter}-${patternFilter}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {filtered.map((topic, i) => (
                    <TopicArcCard key={topic.id} topic={topic} index={i} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
