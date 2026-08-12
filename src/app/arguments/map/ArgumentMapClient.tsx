'use client'

/**
 * /arguments/map — Argument Positioning Map
 *
 * An interactive SVG scatter plot showing every argument on the platform
 * mapped by two independent dimensions:
 *   X-axis  →  AI quality score (0-100, from argument_ai_scores)
 *   Y-axis  →  Community upvotes (raw count)
 *
 * Quadrants:
 *   Top-right    — Elite: high quality AND well-received
 *   Top-left     — Popular but low-quality (crowd pleasers)
 *   Bottom-right — Underappreciated gems (high-quality, few upvotes)
 *   Bottom-left  — Drafts / weak arguments
 *
 * Dots are coloured blue (FOR) or red (AGAINST) and clickable to navigate
 * to the full argument. Hover shows a preview tooltip.
 *
 * Arguments without an AI score are omitted from the quality axis but shown
 * in a "No score yet" summary strip below the chart.
 *
 * Distinct from:
 *   /map                  — topic scatter plot (consensus vs engagement)
 *   /arguments/top-scored — ranked list by AI grade (not visual)
 *   /arguments/trending   — upvote-velocity list (not quality axis)
 *   /analytics/argument-quality — aggregate quality stats (not per-argument plot)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ExternalLink,
  Filter,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MapArgument, ArgumentMapResponse } from '@/app/api/arguments/map/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max = 80): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  arg: MapArgument
  x: number
  y: number
  containerW: number
  containerH: number
}

function Tooltip({ arg, x, y, containerW, containerH }: TooltipProps) {
  const isFor = arg.side === 'for'
  const tipW = 280
  const tipH = 130
  const left = x + tipW + 12 > containerW ? x - tipW - 8 : x + 12
  const top = y + tipH + 12 > containerH ? y - tipH : y

  return (
    <motion.div
      key={arg.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1 }}
      className="pointer-events-none absolute z-30 rounded-xl border border-surface-300 bg-surface-100 shadow-xl p-3 space-y-1.5"
      style={{ left, top, width: tipW }}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            'text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md',
            isFor
              ? 'bg-for-500/20 text-for-300'
              : 'bg-against-500/20 text-against-300'
          )}
        >
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        {arg.ai_grade && (
          <span className="text-[10px] font-mono font-bold text-gold">
            Grade {arg.ai_grade}
          </span>
        )}
        <span className="text-[10px] font-mono text-surface-500 ml-auto">
          {arg.upvotes} ↑
        </span>
      </div>
      <p className="text-xs font-mono text-surface-600 leading-relaxed line-clamp-2">
        {truncate(arg.content, 120)}
      </p>
      <p className="text-[10px] font-mono text-surface-500 truncate">
        On: {truncate(arg.topic_statement, 55)}
      </p>
      <div className="flex items-center justify-between pt-0.5">
        <span className="text-[10px] font-mono text-surface-500">
          @{arg.author_username} · {relativeTime(arg.created_at)}
        </span>
        <span className="text-[10px] font-mono text-for-400 flex items-center gap-0.5">
          View <ExternalLink className="h-2.5 w-2.5" />
        </span>
      </div>
    </motion.div>
  )
}

// ─── ScatterPlot ──────────────────────────────────────────────────────────────

interface PlotProps {
  args: MapArgument[]
  maxUpvotes: number
  onHover: (arg: MapArgument | null, x: number, y: number) => void
}

const PAD = { top: 24, right: 24, bottom: 48, left: 52 }

function ScatterPlot({ args, maxUpvotes, onHover }: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 400 })

  useEffect(() => {
    function measure() {
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      setDims({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (svgRef.current) ro.observe(svgRef.current)
    return () => ro.disconnect()
  }, [])

  const plotW = dims.w - PAD.left - PAD.right
  const plotH = dims.h - PAD.top - PAD.bottom

  function xPos(score: number) {
    return PAD.left + (score / 100) * plotW
  }
  function yPos(upvotes: number) {
    const logMax = Math.log1p(maxUpvotes || 1)
    const logVal = Math.log1p(upvotes)
    return PAD.top + plotH - (logVal / logMax) * plotH
  }

  const yTicks = [0, Math.round(maxUpvotes * 0.25), Math.round(maxUpvotes * 0.5), Math.round(maxUpvotes * 0.75), maxUpvotes]
  const xTicks = [0, 25, 50, 75, 100]

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ minHeight: 340 }}
    >
      {/* Grid lines */}
      {yTicks.map((v) => (
        <g key={`ygrid-${v}`}>
          <line
            x1={PAD.left}
            y1={yPos(v)}
            x2={dims.w - PAD.right}
            y2={yPos(v)}
            className="stroke-surface-300/40"
            strokeDasharray="4,4"
          />
          <text
            x={PAD.left - 6}
            y={yPos(v) + 4}
            textAnchor="end"
            className="fill-surface-500 font-mono"
            fontSize={10}
          >
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={`xgrid-${v}`}>
          <line
            x1={xPos(v)}
            y1={PAD.top}
            x2={xPos(v)}
            y2={dims.h - PAD.bottom}
            className="stroke-surface-300/40"
            strokeDasharray="4,4"
          />
          <text
            x={xPos(v)}
            y={dims.h - PAD.bottom + 14}
            textAnchor="middle"
            className="fill-surface-500 font-mono"
            fontSize={10}
          >
            {v}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line
        x1={PAD.left} y1={PAD.top}
        x2={PAD.left} y2={dims.h - PAD.bottom}
        className="stroke-surface-400" strokeWidth={1}
      />
      <line
        x1={PAD.left} y1={dims.h - PAD.bottom}
        x2={dims.w - PAD.right} y2={dims.h - PAD.bottom}
        className="stroke-surface-400" strokeWidth={1}
      />

      {/* Axis labels */}
      <text
        x={PAD.left + plotW / 2}
        y={dims.h - 6}
        textAnchor="middle"
        className="fill-surface-500 font-mono"
        fontSize={11}
      >
        AI Quality Score →
      </text>
      <text
        x={12}
        y={PAD.top + plotH / 2}
        textAnchor="middle"
        className="fill-surface-500 font-mono"
        fontSize={11}
        transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}
      >
        Upvotes ↑
      </text>

      {/* Quadrant labels */}
      <text x={PAD.left + 6} y={PAD.top + 14} className="fill-surface-400/50 font-mono" fontSize={9}>
        POPULAR
      </text>
      <text x={dims.w - PAD.right - 6} y={PAD.top + 14} textAnchor="end" className="fill-gold/40 font-mono" fontSize={9}>
        ELITE
      </text>
      <text x={PAD.left + 6} y={dims.h - PAD.bottom - 6} className="fill-surface-400/40 font-mono" fontSize={9}>
        WEAK
      </text>
      <text x={dims.w - PAD.right - 6} y={dims.h - PAD.bottom - 6} textAnchor="end" className="fill-emerald/30 font-mono" fontSize={9}>
        GEM
      </text>

      {/* Dots */}
      {args.map((a) => {
        if (a.ai_score === null) return null
        const cx = xPos(a.ai_score)
        const cy = yPos(a.upvotes)
        const isFor = a.side === 'for'

        return (
          <g
            key={a.id}
            className="cursor-pointer"
            onClick={() => { window.location.href = `/arguments/${a.id}` }}
            onMouseEnter={(e) => {
              const svgRect = svgRef.current?.getBoundingClientRect()
              if (!svgRect) return
              onHover(a, e.clientX - svgRect.left, e.clientY - svgRect.top)
            }}
            onMouseLeave={() => onHover(null, 0, 0)}
          >
            <circle
              cx={cx}
              cy={cy}
              r={a.upvotes > 0 ? Math.min(8, 3 + Math.log1p(a.upvotes)) : 3}
              fill={isFor ? '#3b82f6' : '#ef4444'}
              fillOpacity={0.7}
              stroke={isFor ? '#60a5fa' : '#f87171'}
              strokeWidth={0.8}
              strokeOpacity={0.9}
            />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function MapSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 w-full rounded-2xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ArgumentMapClient() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<ArgumentMapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [side, setSide] = useState<'all' | 'for' | 'against'>('all')
  const [category, setCategory] = useState<string>('all')
  const [hovered, setHovered] = useState<{ arg: MapArgument; x: number; y: number } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [containerDims, setContainerDims] = useState({ w: 600, h: 400 })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (side !== 'all') params.set('side', side)
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/arguments/map?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const json: ArgumentMapResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [side, category])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!containerRef.current) return
    function measure() {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setContainerDims({ w: rect.width, h: rect.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const plotArgs = (data?.arguments ?? []).filter((a) => a.ai_score !== null)
  const noScoreArgs = (data?.arguments ?? []).filter((a) => a.ai_score === null)

  return (
    <div className="relative flex flex-col h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 pb-28 space-y-6">

          {/* Header */}
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.back()}
              aria-label="Go back"
              className="mt-0.5 flex-shrink-0 p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-mono font-bold text-white">Argument Map</h1>
                <Badge variant="default" className="text-[10px]">
                  <BarChart2 className="h-3 w-3 mr-1" /> Scatter Plot
                </Badge>
              </div>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Quality score vs community upvotes — every argument, positioned.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowFilters((f) => !f)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors',
                  showFilters
                    ? 'bg-for-600 text-white'
                    : 'bg-surface-200 text-surface-400 hover:text-white border border-surface-300'
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Filters
                <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>
          </div>

          {/* Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                  {/* Side filter */}
                  <div>
                    <p className="text-xs font-mono text-surface-500 mb-2">Side</p>
                    <div className="flex gap-2">
                      {(['all', 'for', 'against'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSide(s)}
                          className={cn(
                            'px-3 py-1 rounded-lg text-xs font-mono transition-colors',
                            side === s
                              ? s === 'for'
                                ? 'bg-for-600 text-white'
                                : s === 'against'
                                  ? 'bg-against-600 text-white'
                                  : 'bg-surface-300 text-white'
                              : 'bg-surface-200 text-surface-400 hover:text-white border border-surface-300'
                          )}
                        >
                          {s === 'all' ? 'Both sides' : s === 'for' ? '● FOR' : '● AGAINST'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category filter */}
                  {(data?.categories?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-mono text-surface-500 mb-2">Category</p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setCategory('all')}
                          className={cn(
                            'px-2 py-0.5 rounded-md text-xs font-mono transition-colors',
                            category === 'all'
                              ? 'bg-surface-300 text-white'
                              : 'bg-surface-200 text-surface-400 hover:text-white border border-surface-300'
                          )}
                        >
                          All
                        </button>
                        {data?.categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setCategory(cat)}
                            className={cn(
                              'px-2 py-0.5 rounded-md text-xs font-mono transition-colors',
                              category === cat
                                ? 'bg-surface-300 text-white'
                                : 'bg-surface-200 text-surface-400 hover:text-white border border-surface-300'
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats */}
          {!loading && data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Arguments plotted',
                  value: plotArgs.length.toLocaleString(),
                  sub: `of ${data.stats.total} total`,
                  color: 'text-white',
                },
                {
                  label: 'Avg quality score',
                  value: data.stats.avg_score !== null ? `${data.stats.avg_score}/100` : '—',
                  sub: `${data.stats.with_score} scored`,
                  color: 'text-gold',
                },
                {
                  label: 'FOR arguments',
                  value: data.stats.for_count.toLocaleString(),
                  sub: `${Math.round((data.stats.for_count / Math.max(data.stats.total, 1)) * 100)}%`,
                  color: 'text-for-400',
                },
                {
                  label: 'AGAINST arguments',
                  value: data.stats.against_count.toLocaleString(),
                  sub: `${Math.round((data.stats.against_count / Math.max(data.stats.total, 1)) * 100)}%`,
                  color: 'text-against-400',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-4"
                >
                  <p className={cn('text-xl font-mono font-bold', stat.color)}>{stat.value}</p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">{stat.label}</p>
                  <p className="text-[10px] font-mono text-surface-500/70">{stat.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Chart */}
          {loading ? (
            <MapSkeleton />
          ) : error ? (
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button onClick={load} className="mt-3 text-xs font-mono text-for-400 hover:underline">
                Try again
              </button>
            </div>
          ) : plotArgs.length === 0 ? (
            <EmptyState
              icon={BarChart2}
              title="No scored arguments yet"
              description="Arguments need an AI quality score to appear on the map. Try adjusting filters or check back soon."
              action={{ label: 'View all arguments', href: '/arguments' }}
            />
          ) : (
            <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
              {/* Legend */}
              <div className="flex items-center gap-4 px-4 py-3 border-b border-surface-300">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-for-500 opacity-70" />
                  <span className="text-xs font-mono text-surface-500">FOR</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full bg-against-500 opacity-70" />
                  <span className="text-xs font-mono text-surface-500">AGAINST</span>
                </div>
                <div className="ml-auto text-xs font-mono text-surface-500">
                  {plotArgs.length} arguments · click any dot to read
                </div>
              </div>

              {/* Plot area */}
              <div
                ref={containerRef}
                className="relative"
                style={{ height: 420 }}
              >
                <ScatterPlot
                  args={plotArgs}
                  maxUpvotes={data?.stats.max_upvotes ?? 1}
                  onHover={(arg, x, y) => {
                    if (!arg) { setHovered(null); return }
                    setHovered({ arg, x, y })
                  }}
                />
                <AnimatePresence>
                  {hovered && (
                    <Tooltip
                      arg={hovered.arg}
                      x={hovered.x}
                      y={hovered.y}
                      containerW={containerDims.w}
                      containerH={containerDims.h}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Quadrant guide */}
          {!loading && plotArgs.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  quadrant: 'Elite',
                  desc: 'High quality + highly upvoted',
                  coords: 'Score ≥ 75, Upvotes ≥ median',
                  color: 'text-gold',
                  bg: 'bg-gold/5',
                  border: 'border-gold/20',
                },
                {
                  quadrant: 'Hidden Gems',
                  desc: 'High quality, few upvotes',
                  coords: 'Score ≥ 75, Upvotes < median',
                  color: 'text-emerald',
                  bg: 'bg-emerald/5',
                  border: 'border-emerald/20',
                },
                {
                  quadrant: 'Crowd Pleasers',
                  desc: 'Popular but lower quality',
                  coords: 'Score < 75, Upvotes ≥ median',
                  color: 'text-for-400',
                  bg: 'bg-for-500/5',
                  border: 'border-for-500/20',
                },
                {
                  quadrant: 'Developing',
                  desc: 'Low quality, low reception',
                  coords: 'Score < 75, Upvotes < median',
                  color: 'text-surface-500',
                  bg: 'bg-surface-200',
                  border: 'border-surface-300',
                },
              ].map((q) => (
                <div
                  key={q.quadrant}
                  className={cn('rounded-xl border p-3 space-y-0.5', q.bg, q.border)}
                >
                  <p className={cn('text-sm font-mono font-bold', q.color)}>{q.quadrant}</p>
                  <p className="text-xs font-mono text-surface-500">{q.desc}</p>
                  <p className="text-[10px] font-mono text-surface-500/60">{q.coords}</p>
                </div>
              ))}
            </div>
          )}

          {/* Unscored arguments strip */}
          {!loading && noScoreArgs.length > 0 && (
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-sm font-mono font-semibold text-surface-500 mb-3">
                {noScoreArgs.length} arguments without AI score
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {noScoreArgs.slice(0, 10).map((a) => (
                  <Link
                    key={a.id}
                    href={`/arguments/${a.id}`}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface-200 transition-colors group"
                  >
                    <span
                      className={cn(
                        'flex-shrink-0 mt-0.5 h-4 w-4 rounded flex items-center justify-center',
                        a.side === 'for' ? 'bg-for-500/15' : 'bg-against-500/15'
                      )}
                    >
                      {a.side === 'for'
                        ? <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
                        : <ThumbsDown className="h-2.5 w-2.5 text-against-400" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors truncate">
                        {truncate(a.content, 80)}
                      </p>
                      <p className="text-[10px] font-mono text-surface-500 truncate">
                        {truncate(a.topic_statement, 50)}
                      </p>
                    </div>
                    <ArrowRight className="h-3 w-3 text-surface-500 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
              {noScoreArgs.length > 10 && (
                <Link
                  href="/arguments"
                  className="mt-2 block text-xs font-mono text-for-400 hover:underline text-center"
                >
                  View all {noScoreArgs.length} unscored arguments →
                </Link>
              )}
            </div>
          )}

          {/* Related links */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { href: '/arguments/top-scored', label: 'Top Scored', desc: 'Ranked by AI grade' },
              { href: '/arguments/trending', label: 'Trending', desc: 'Upvote velocity this week' },
              { href: '/arguments/hall-of-fame', label: 'Hall of Fame', desc: 'All-time community legends' },
              { href: '/arguments/clips', label: 'Clips', desc: 'The platform\'s sharpest takes' },
              { href: '/map', label: 'Topic Map', desc: 'Topics by consensus vs engagement' },
              { href: '/analytics/argument-quality', label: 'Quality Stats', desc: 'Aggregate quality metrics' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex flex-col gap-0.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all group"
              >
                <span className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                  {link.label}
                </span>
                <span className="text-[10px] font-mono text-surface-500">{link.desc}</span>
              </Link>
            ))}
          </div>

        </div>
      </main>

      <BottomNav />
    </div>
  )
}
