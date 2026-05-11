'use client'

/**
 * /arguments/dna — Argument DNA
 *
 * Analyses your rhetorical fingerprint: how you argue, not just what you argue.
 * Six style dimensions (Empirical, Moral, Economic, Social, Visionary, Pragmatic)
 * are scored from your argument texts, an archetype is assigned, and your style
 * is compared to the platform average.
 *
 * Distinct from:
 *   /arguments/mine   — history + grades of your arguments
 *   /fingerprint      — how your VOTES deviate from the platform consensus
 *   /analytics        — overall civic performance stats
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  Brain,
  ChevronRight,
  ExternalLink,
  Flame,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DnaResponse, DnaArgument } from '@/app/api/arguments/dna/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ─── Style dimension config ────────────────────────────────────────────────

const DIMENSION_CONFIG: Record<string, {
  label: string
  description: string
  bar: string
  text: string
  bg: string
}> = {
  empirical: {
    label: 'Empirical',
    description: 'Backs claims with data, stats & research',
    bar: 'bg-for-500',
    text: 'text-for-400',
    bg: 'bg-for-500/10',
  },
  moral: {
    label: 'Moral',
    description: 'Appeals to values, rights & ethics',
    bar: 'bg-purple',
    text: 'text-purple',
    bg: 'bg-purple/10',
  },
  economic: {
    label: 'Economic',
    description: 'Reasons from costs, markets & incentives',
    bar: 'bg-gold',
    text: 'text-gold',
    bg: 'bg-gold/10',
  },
  social: {
    label: 'Social',
    description: 'Centers community, people & shared impact',
    bar: 'bg-emerald',
    text: 'text-emerald',
    bg: 'bg-emerald/10',
  },
  visionary: {
    label: 'Visionary',
    description: 'Argues from future consequences & progress',
    bar: 'bg-against-400',
    text: 'text-against-300',
    bg: 'bg-against-500/10',
  },
  pragmatic: {
    label: 'Pragmatic',
    description: 'Grounds debate in practical solutions',
    bar: 'bg-surface-400',
    text: 'text-surface-300',
    bg: 'bg-surface-300/10',
  },
}

const DIMENSION_ORDER = ['empirical', 'moral', 'economic', 'social', 'visionary', 'pragmatic']

// ─── Grade badge ──────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  A: { color: 'text-emerald',    bg: 'bg-emerald/15',    border: 'border-emerald/30' },
  B: { color: 'text-for-400',    bg: 'bg-for-500/15',    border: 'border-for-500/30' },
  C: { color: 'text-gold',       bg: 'bg-gold/15',       border: 'border-gold/30' },
  D: { color: 'text-against-400', bg: 'bg-against-500/15', border: 'border-against-500/30' },
  F: { color: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/30' },
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null
  const cfg = GRADE_CONFIG[grade]
  if (!cfg) return null
  return (
    <span className={cn('inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-mono font-bold border', cfg.color, cfg.bg, cfg.border)}>
      {grade}
    </span>
  )
}

// ─── SVG Radar Chart ──────────────────────────────────────────────────────────

const RADAR_SIZE = 240
const CENTER = RADAR_SIZE / 2
const MAX_RADIUS = CENTER - 28
const DIMENSIONS_FOR_RADAR = DIMENSION_ORDER

function polarXY(angle: number, radius: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) }
}

function buildPath(points: { x: number; y: number }[]) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z'
}

function RadarChart({ scores, platformAvg }: { scores: Record<string, number>; platformAvg: Record<string, number> }) {
  const n = DIMENSIONS_FOR_RADAR.length
  const angleStep = 360 / n

  const userPoints = DIMENSIONS_FOR_RADAR.map((dim, i) => {
    const val = (scores[dim] ?? 0) / 100
    const radius = val * MAX_RADIUS
    return polarXY(i * angleStep, radius)
  })

  const avgPoints = DIMENSIONS_FOR_RADAR.map((dim, i) => {
    const val = (platformAvg[dim] ?? 0) / 100
    const radius = val * MAX_RADIUS
    return polarXY(i * angleStep, radius)
  })

  const rings = [0.25, 0.5, 0.75, 1]
  const axes = DIMENSIONS_FOR_RADAR.map((dim, i) => {
    const angle = i * angleStep
    const outer = polarXY(angle, MAX_RADIUS)
    const labelPt = polarXY(angle, MAX_RADIUS + 18)
    return { dim, outer, labelPt }
  })

  return (
    <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="w-full h-full" aria-hidden="true">
      {/* Grid rings */}
      {rings.map((r) => {
        const ringPts = DIMENSIONS_FOR_RADAR.map((_, i) => polarXY(i * angleStep, r * MAX_RADIUS))
        return (
          <path
            key={r}
            d={buildPath(ringPts)}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={1}
          />
        )
      })}

      {/* Axes */}
      {axes.map(({ outer }, i) => (
        <line
          key={i}
          x1={CENTER} y1={CENTER}
          x2={outer.x} y2={outer.y}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Platform average polygon */}
      {avgPoints.length > 0 && (
        <path
          d={buildPath(avgPoints)}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {/* User polygon */}
      {userPoints.length > 0 && (
        <path
          d={buildPath(userPoints)}
          fill="rgba(59,130,246,0.15)"
          stroke="rgba(96,165,250,0.8)"
          strokeWidth={2}
        />
      )}

      {/* User dots */}
      {userPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#60a5fa" />
      ))}

      {/* Axis labels */}
      {axes.map(({ dim, labelPt }) => {
        const cfg = DIMENSION_CONFIG[dim]
        return (
          <text
            key={dim}
            x={labelPt.x}
            y={labelPt.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fontFamily="monospace"
            fontWeight="600"
            fill="rgba(255,255,255,0.5)"
          >
            {cfg?.label ?? dim}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: DnaArgument }) {
  const isFor = arg.side === 'blue'
  const cfg = DIMENSION_CONFIG[arg.dominantStyle]

  return (
    <Link
      href={`/topic/${arg.topic_id}`}
      className={cn(
        'block p-4 rounded-xl border transition-colors hover:border-surface-400/60',
        'bg-surface-100 border-surface-300/60'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span
          className={cn(
            'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0',
            isFor
              ? 'text-for-400 bg-for-500/15 border-for-500/30'
              : 'text-against-400 bg-against-500/15 border-against-500/30'
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {cfg && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cfg.text, cfg.bg, 'border-current/20')}>
              {cfg.label}
            </span>
          )}
          <GradeBadge grade={arg.ai_grade} />
          <div className="flex items-center gap-1 text-surface-500">
            <ThumbsUp className="h-3 w-3" />
            <span className="text-[11px] font-mono">{arg.upvotes}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-white leading-relaxed mb-2">
        {truncate(arg.content, 160)}
      </p>
      <div className="flex items-center gap-2 text-surface-500 text-[11px] font-mono">
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{truncate(arg.topic_statement, 60)}</span>
        <span className="flex-shrink-0">· {relativeTime(arg.created_at)}</span>
      </div>
    </Link>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ArgumentDnaPage() {
  const router = useRouter()
  const [data, setData] = useState<DnaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'top' | 'recent'>('top')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/arguments/dna')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) return
      const json = (await res.json()) as DnaResponse
      setData(json)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const displayArgs = data
    ? tab === 'top' ? data.topArguments : data.recentArguments
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/arguments/mine"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
            aria-label="Back to my arguments"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-300">
              <Brain className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">Argument DNA</h1>
              <p className="text-xs font-mono text-surface-500">Your rhetorical fingerprint</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="ml-auto flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading state ──────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          </div>
        )}

        {/* ── No arguments ──────────────────────────────────────────────── */}
        {!loading && data && data.totalArguments === 0 && (
          <EmptyState
            icon={Brain}
            title="No arguments yet"
            description="Write your first argument on any topic to reveal your rhetorical DNA."
            action={{ label: 'Browse topics', href: '/' }}
          />
        )}

        {/* ── Main content ───────────────────────────────────────────────── */}
        {!loading && data && data.totalArguments > 0 && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >

              {/* ── Archetype card ──────────────────────────────────────── */}
              <div
                className={cn(
                  'rounded-2xl border p-5',
                  data.archetype.border,
                  data.archetype.bg
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-2xl border text-2xl font-bold',
                    data.archetype.border,
                    data.archetype.bg
                  )}>
                    <Sparkles className={cn('h-6 w-6', data.archetype.color)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[11px] font-mono font-bold uppercase tracking-widest', data.archetype.color)}>
                        Your Archetype
                      </span>
                    </div>
                    <h2 className={cn('font-mono text-2xl font-bold text-white leading-tight mb-0.5')}>
                      {data.archetype.name}
                    </h2>
                    <p className={cn('text-sm font-mono italic mb-3', data.archetype.color)}>
                      &ldquo;{data.archetype.tagline}&rdquo;
                    </p>
                    <p className="text-sm text-surface-400 leading-relaxed">
                      {data.archetype.description}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-4 pt-4 border-t border-surface-300/40 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="font-mono text-xl font-bold text-white">{data.totalArguments}</p>
                    <p className="text-[11px] text-surface-500 font-mono">arguments</p>
                  </div>
                  <div>
                    <p className={cn('font-mono text-xl font-bold', data.forCount >= data.againstCount ? 'text-for-400' : 'text-against-400')}>
                      {data.forCount > 0 || data.againstCount > 0
                        ? `${Math.round((data.forCount / data.totalArguments) * 100)}% FOR`
                        : '—'}
                    </p>
                    <p className="text-[11px] text-surface-500 font-mono">side balance</p>
                  </div>
                  <div>
                    <p className="font-mono text-xl font-bold text-white">{data.avgUpvotes}</p>
                    <p className="text-[11px] text-surface-500 font-mono">avg upvotes</p>
                  </div>
                </div>
              </div>

              {/* ── Style radar + breakdown ─────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h3 className="font-mono text-sm font-bold text-white mb-4">Rhetorical Profile</h3>
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  {/* Radar chart */}
                  <div className="flex-shrink-0 w-full sm:w-48 h-48">
                    <RadarChart
                      scores={data.styleScores}
                      platformAvg={data.platformAvg}
                    />
                    <p className="text-center text-[10px] font-mono text-surface-500 mt-1">
                      <span className="text-white">—</span> you   
                      <span style={{ borderBottom: '1px dashed rgba(255,255,255,0.3)' }}>- - -</span> avg
                    </p>
                  </div>

                  {/* Dimension bars */}
                  <div className="flex-1 space-y-3 min-w-0">
                    {DIMENSION_ORDER.map((dim) => {
                      const cfg = DIMENSION_CONFIG[dim]
                      const score = data.styleScores[dim] ?? 0
                      const avg = data.platformAvg[dim] ?? 0
                      const delta = score - avg
                      return (
                        <div key={dim}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-xs font-mono font-semibold', cfg.text)}>{cfg.label}</span>
                              <span className="text-[10px] text-surface-500 font-mono hidden sm:inline">
                                {cfg.description}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[11px] font-mono text-white">{score}</span>
                              <span className={cn(
                                'text-[10px] font-mono',
                                delta > 0 ? 'text-emerald' : delta < 0 ? 'text-against-400' : 'text-surface-500'
                              )}>
                                {delta > 0 ? `+${delta}` : delta === 0 ? '~' : `${delta}`}
                              </span>
                            </div>
                          </div>
                          <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
                            {/* Average marker */}
                            <div
                              className="absolute top-0 h-full w-0.5 bg-surface-500/60"
                              style={{ left: `${avg}%` }}
                            />
                            {/* User bar */}
                            <motion.div
                              className={cn('h-full rounded-full', cfg.bar)}
                              initial={{ width: 0 }}
                              animate={{ width: `${score}%` }}
                              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── Writing stats ───────────────────────────────────────── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Avg length',
                    value: `${data.avgLength} chars`,
                    sub: `${data.avgWordCount} words`,
                    icon: BarChart2,
                    color: 'text-for-400',
                    bg: 'bg-for-500/10',
                    border: 'border-for-500/20',
                  },
                  {
                    label: 'Argument streak',
                    value: `${data.longestStreak}d`,
                    sub: 'longest run',
                    icon: Flame,
                    color: 'text-gold',
                    bg: 'bg-gold/10',
                    border: 'border-gold/20',
                  },
                  {
                    label: 'Reactions earned',
                    value: String(Object.values(data.reactionTotals).reduce((s, n) => s + n, 0)),
                    sub: data.reactionTotals.insightful > 0 ? `${data.reactionTotals.insightful} insightful` : 'across all types',
                    icon: Sparkles,
                    color: 'text-purple',
                    bg: 'bg-purple/10',
                    border: 'border-purple/20',
                  },
                  {
                    label: 'Graded args',
                    value: String(data.gradeDistribution.reduce((s, g) => s + g.count, 0)),
                    sub: data.gradeDistribution.find((g) => g.grade === 'A')
                      ? `${data.gradeDistribution.find((g) => g.grade === 'A')!.count} A-grade`
                      : 'by AI rubric',
                    icon: Zap,
                    color: 'text-emerald',
                    bg: 'bg-emerald/10',
                    border: 'border-emerald/20',
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className={cn('rounded-xl border p-3', stat.bg, stat.border)}
                  >
                    <stat.icon className={cn('h-4 w-4 mb-2', stat.color)} />
                    <p className="font-mono text-lg font-bold text-white leading-tight">{stat.value}</p>
                    <p className="text-[11px] text-surface-500 font-mono mt-0.5">{stat.label}</p>
                    <p className={cn('text-[10px] font-mono mt-0.5', stat.color)}>{stat.sub}</p>
                  </div>
                ))}
              </div>

              {/* ── AI grade distribution ───────────────────────────────── */}
              {data.gradeDistribution.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h3 className="font-mono text-sm font-bold text-white mb-4">AI Grade Distribution</h3>
                  <div className="space-y-2">
                    {data.gradeDistribution.map((g) => {
                      const cfg = {
                        A: { bar: 'bg-emerald', text: 'text-emerald' },
                        B: { bar: 'bg-for-500', text: 'text-for-400' },
                        C: { bar: 'bg-gold', text: 'text-gold' },
                        D: { bar: 'bg-against-500', text: 'text-against-400' },
                        F: { bar: 'bg-surface-400', text: 'text-surface-500' },
                      }[g.grade] ?? { bar: 'bg-surface-400', text: 'text-surface-500' }
                      return (
                        <div key={g.grade} className="flex items-center gap-3">
                          <span className={cn('font-mono text-sm font-bold w-5', cfg.text)}>{g.grade}</span>
                          <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                            <motion.div
                              className={cn('h-full rounded-full', cfg.bar)}
                              initial={{ width: 0 }}
                              animate={{ width: `${g.pct}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                          </div>
                          <span className="text-[11px] font-mono text-surface-400 w-12 text-right">
                            {g.count} ({g.pct}%)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Category breakdown ─────────────────────────────────── */}
              {data.categoryBreakdown.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h3 className="font-mono text-sm font-bold text-white mb-4">Category Breakdown</h3>
                  <div className="space-y-2">
                    {data.categoryBreakdown.slice(0, 5).map((cat) => {
                      const forPct = cat.count > 0 ? Math.round((cat.forCount / cat.count) * 100) : 50
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <span className="text-xs font-mono text-surface-400 w-24 truncate flex-shrink-0">
                            {cat.category}
                          </span>
                          <div className="flex-1 h-4 rounded-full bg-surface-300 overflow-hidden">
                            <div
                              className="h-full bg-for-500 transition-all"
                              style={{ width: `${forPct}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 text-[11px] font-mono">
                            <span className="text-surface-400">{cat.count}</span>
                            <span className="text-for-400">{forPct}%F</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Arguments ──────────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                {/* Tab bar */}
                <div className="flex border-b border-surface-300">
                  {(['top', 'recent'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className={cn(
                        'flex-1 py-3 text-sm font-mono font-semibold transition-colors',
                        tab === t
                          ? 'text-white border-b-2 border-for-500 bg-for-500/5'
                          : 'text-surface-500 hover:text-white'
                      )}
                    >
                      {t === 'top' ? 'Top arguments' : 'Recent'}
                    </button>
                  ))}
                </div>

                <div className="divide-y divide-surface-300/60">
                  {displayArgs.length === 0 ? (
                    <div className="p-8 text-center text-surface-500 font-mono text-sm">
                      No arguments to show
                    </div>
                  ) : (
                    displayArgs.map((arg) => (
                      <div key={arg.id} className="px-4 py-3">
                        <ArgumentCard arg={arg} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Links ──────────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: '/arguments/mine', label: 'All my arguments', icon: BookOpen },
                  { href: '/arguments/top-scored', label: 'Top AI-scored', icon: Zap },
                  { href: '/fingerprint', label: 'Vote fingerprint', icon: TrendingUp },
                  { href: '/analytics', label: 'Full analytics', icon: BarChart2 },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 text-sm font-mono text-surface-400 hover:text-white transition-all group"
                  >
                    <link.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{link.label}</span>
                    <ChevronRight className="h-3.5 w-3.5 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
