'use client'

/**
 * /topic/[id]/radar — Debate Radar
 *
 * Six-axis radar chart showing debate health across:
 *   Participation, Consensus, Polarization, Velocity, Argument Quality, Engagement
 *
 * Distinct from:
 *   /scorecard   — letter-grade report card (A-F per dimension)
 *   /stats       — raw vote count charts
 *   /heat        — when voting happens (time heatmap)
 *   /intelligence — full AI narrative analysis
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  BookOpen,
  ChevronRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { RadarDimension, RadarResponse } from '@/app/api/topics/[id]/radar/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const DIM_ICONS: Record<string, typeof Activity> = {
  participation: Users,
  consensus: Scale,
  polarization: BarChart2,
  velocity: Zap,
  quality: Sparkles,
  engagement: Flame,
}

function dimColor(key: string): string {
  switch (key) {
    case 'participation': return '#60a5fa'   // for-400
    case 'consensus':     return '#34d399'   // emerald
    case 'polarization':  return '#f87171'   // against-400
    case 'velocity':      return '#a78bfa'   // purple
    case 'quality':       return '#c9a84c'   // gold
    case 'engagement':    return '#93c5fd'   // for-300
    default:              return '#94a3b8'
  }
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Moderate'
  if (score >= 20) return 'Low'
  return 'Minimal'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald/10 border-emerald/30 text-emerald'
  if (score >= 60) return 'bg-for-500/10 border-for-500/30 text-for-400'
  if (score >= 40) return 'bg-gold/10 border-gold/30 text-gold'
  return 'bg-surface-300 border-surface-400 text-surface-500'
}

// ─── Radar Chart ──────────────────────────────────────────────────────────────

interface RadarChartProps {
  dimensions: RadarDimension[]
  size?: number
  animate?: boolean
}

function RadarChart({ dimensions, size = 280, animate = true }: RadarChartProps) {
  const [drawn, setDrawn] = useState(!animate)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!animate) return
    timerRef.current = setTimeout(() => setDrawn(true), 120)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [animate])

  const n = dimensions.length
  const cx = size / 2
  const cy = size / 2
  const R  = size * 0.38        // outer ring radius
  const labelR = size * 0.49    // label orbit radius

  // Compute axis endpoints (starting from top, going clockwise)
  const axes = dimensions.map((_, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    return {
      x: cx + R * Math.cos(angle),
      y: cy + R * Math.sin(angle),
      lx: cx + labelR * Math.cos(angle),
      ly: cy + labelR * Math.sin(angle),
      angle,
    }
  })

  // Rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0]

  function ringPolygon(pct: number): string {
    return axes
      .map(({ angle }) => {
        const x = cx + R * pct * Math.cos(angle)
        const y = cy + R * pct * Math.sin(angle)
        return `${x},${y}`
      })
      .join(' ')
  }

  function dataPolygon(scale: number): string {
    return dimensions
      .map((dim, i) => {
        const pct = (dim.score / 100) * scale
        const x = cx + R * pct * Math.cos(axes[i].angle)
        const y = cy + R * pct * Math.sin(axes[i].angle)
        return `${x},${y}`
      })
      .join(' ')
  }

  const labelAnchor = (lx: number): 'middle' | 'start' | 'end' => {
    const dx = lx - cx
    if (Math.abs(dx) < 12) return 'middle'
    return dx > 0 ? 'start' : 'end'
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full h-full"
      aria-label="Debate radar chart"
      role="img"
    >
      {/* Grid rings */}
      {rings.map((pct) => (
        <polygon
          key={pct}
          points={ringPolygon(pct)}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth="1"
        />
      ))}

      {/* Grid axes */}
      {axes.map((ax, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={ax.x}
          y2={ax.y}
          stroke="rgba(148,163,184,0.2)"
          strokeWidth="1"
        />
      ))}

      {/* Data polygon — filled */}
      <motion.polygon
        points={dataPolygon(drawn ? 1 : 0)}
        fill="rgba(96,165,250,0.12)"
        stroke="rgba(96,165,250,0.5)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />

      {/* Data points on each axis */}
      {dimensions.map((dim, i) => {
        const pct = dim.score / 100
        const px = cx + R * pct * Math.cos(axes[i].angle)
        const py = cy + R * pct * Math.sin(axes[i].angle)
        return (
          <motion.circle
            key={dim.key}
            cx={px}
            cy={py}
            r={4}
            fill={dimColor(dim.key)}
            stroke="rgba(15,23,42,0.8)"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: drawn ? 1 : 0 }}
            transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 300, damping: 20 }}
          />
        )
      })}

      {/* Axis labels */}
      {dimensions.map((dim, i) => {
        const { lx, ly } = axes[i]
        const anchor = labelAnchor(lx)
        return (
          <text
            key={dim.key}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-surface-500 font-mono"
            fontSize="9"
            fontFamily="monospace"
          >
            {dim.label}
          </text>
        )
      })}

      {/* Center overall score */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-white font-mono font-bold"
        fontSize="18"
        fontFamily="monospace"
      >
        {drawn ? dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length > 0 ?
          Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length) : '—' : '—'}
      </text>
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-surface-500 font-mono"
        fontSize="7.5"
        fontFamily="monospace"
      >
        OVERALL
      </text>
    </svg>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RadarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-3.5 w-40" />
        </div>
      </div>
      <Skeleton className="h-[280px] w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-2.5 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Dimension Card ───────────────────────────────────────────────────────────

function DimCard({ dim, index }: { dim: RadarDimension; index: number }) {
  const Icon = DIM_ICONS[dim.key] ?? Activity
  const badge = scoreBg(dim.score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon
            className="h-3.5 w-3.5 flex-shrink-0"
            style={{ color: dimColor(dim.key) }}
            aria-hidden
          />
          <span className="text-xs font-mono font-semibold text-white">{dim.label}</span>
        </div>
        <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border', badge)}>
          {scoreLabel(dim.score)}
        </span>
      </div>

      {/* Score + bar */}
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span
            className="text-2xl font-mono font-bold tabular-nums leading-none"
            style={{ color: dimColor(dim.key) }}
          >
            {dim.score}
          </span>
          <span className="text-[10px] font-mono text-surface-500">/ 100</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: dimColor(dim.key) }}
            initial={{ width: 0 }}
            animate={{ width: `${dim.score}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 + index * 0.05 }}
          />
        </div>
      </div>

      {/* Raw value */}
      <p className="text-[11px] font-mono text-surface-500 leading-snug">{dim.raw}</p>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicRadarPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<RadarResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}/radar`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load radar data')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const topic = data?.topic
  const badge = topic ? STATUS_BADGE[topic.status] ?? 'proposed' : 'proposed'
  const forPct  = topic ? Math.round(topic.blue_pct) : 50
  const agtPct  = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-24 md:pb-12">

        {/* ── Back navigation ── */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/topic/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" aria-hidden />
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 min-w-0">
            <Link href={`/topic/${id}`} className="hover:text-white transition-colors truncate">
              {topic ? topic.statement.slice(0, 40) + (topic.statement.length > 40 ? '…' : '') : 'Topic'}
            </Link>
            <ChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden />
            <span className="text-white flex-shrink-0">Debate Radar</span>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 disabled:opacity-40 transition-colors"
            aria-label="Refresh radar"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', loading && 'animate-spin')} aria-hidden />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <RadarSkeleton />
            </motion.div>
          )}

          {error && !loading && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center"
            >
              <Scale className="h-8 w-8 text-against-400 mx-auto mb-3" aria-hidden />
              <p className="text-sm font-mono text-against-400 mb-4">{error}</p>
              <button
                onClick={load}
                className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
              >
                Try again
              </button>
            </motion.div>
          )}

          {data && !loading && (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* ── Header ── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                    <Activity className="h-5 w-5 text-for-400" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-mono text-lg font-bold text-white leading-snug">
                      Debate Radar
                    </h1>
                    <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed line-clamp-2">
                      {topic?.statement}
                    </p>
                  </div>
                  <Badge variant={badge} className="flex-shrink-0">
                    {STATUS_LABEL[topic?.status ?? 'active'] ?? topic?.status}
                  </Badge>
                </div>

                {/* Vote split bar */}
                <div className="flex items-center gap-2 text-xs font-mono mb-1.5">
                  <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden />
                  <span className="text-for-400 font-bold">{forPct}%</span>
                  <span className="text-surface-500">For</span>
                  <span className="flex-1" />
                  <span className="text-surface-500">Against</span>
                  <span className="text-against-400 font-bold">{agtPct}%</span>
                  <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden />
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full bg-for-500 rounded-full transition-all duration-500"
                    style={{ width: `${forPct}%` }}
                  />
                </div>

                {/* Insight */}
                <div className="flex items-start gap-2 mt-4 rounded-xl bg-surface-200/60 border border-surface-300/60 px-3 py-2.5">
                  <Sparkles className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" aria-hidden />
                  <p className="text-xs font-mono text-surface-500 leading-relaxed">{data.insight}</p>
                </div>
              </div>

              {/* ── Radar chart ── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h2 className="font-mono text-xs font-semibold text-surface-400 uppercase tracking-wider mb-4">
                  Debate Health Radar
                </h2>
                <div className="mx-auto" style={{ maxWidth: 320, height: 320 }}>
                  <RadarChart dimensions={data.dimensions} size={320} animate />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-3 gap-x-4 gap-y-2 mt-4 pt-4 border-t border-surface-300">
                  {data.dimensions.map((dim) => (
                    <div key={dim.key} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dimColor(dim.key) }}
                        aria-hidden
                      />
                      <span className="text-[10px] font-mono text-surface-500">{dim.label}</span>
                      <span
                        className="text-[10px] font-mono font-bold ml-auto"
                        style={{ color: dimColor(dim.key) }}
                      >
                        {dim.score}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Dimension breakdown ── */}
              <div>
                <h2 className="font-mono text-xs font-semibold text-surface-400 uppercase tracking-wider mb-3">
                  Dimension Breakdown
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {data.dimensions.map((dim, i) => (
                    <DimCard key={dim.key} dim={dim} index={i} />
                  ))}
                </div>
              </div>

              {/* ── Related links ── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h3 className="font-mono text-xs text-surface-400 uppercase tracking-wider mb-3">
                  Dive Deeper
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { href: `/topic/${id}/scorecard`, label: 'Scorecard', icon: BookOpen, desc: 'Letter grades per dimension' },
                    { href: `/topic/${id}/intelligence`, label: 'Intel Report', icon: Sparkles, desc: 'AI narrative analysis' },
                    { href: `/topic/${id}/heat`, label: 'Vote Heatmap', icon: MessageSquare, desc: 'When voting happens' },
                  ].map(({ href, label, icon: Icon, desc }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 px-3 py-3 transition-colors group"
                    >
                      <Icon className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-semibold text-white">{label}</div>
                        <div className="text-[10px] font-mono text-surface-500 truncate">{desc}</div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-surface-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
