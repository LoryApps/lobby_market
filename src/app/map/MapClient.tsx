'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ExternalLink,
  Filter,
  Gavel,
  Loader2,
  Map,
  RefreshCw,
  Scale,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { MapDataResponse, MapTopic } from '@/app/api/map/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Politics: '#3b82f6',
  Technology: '#06b6d4',
  Ethics: '#8b5cf6',
  Culture: '#f97316',
  Economics: '#10b981',
  Science: '#14b8a6',
  Philosophy: '#a855f7',
  Health: '#ec4899',
  Environment: '#22c55e',
  Education: '#f59e0b',
  Other: '#71717a',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

const STATUS_COLORS: Record<string, string> = {
  proposed: '#71717a',
  active: '#3b82f6',
  voting: '#f59e0b',
  law: '#f59e0b',
  failed: '#6b7280',
}

// ─── Plot helpers ─────────────────────────────────────────────────────────────

// Dimensions (SVG viewBox)
const SVG_W = 800
const SVG_H = 520
const PAD_L = 56
const PAD_R = 24
const PAD_T = 24
const PAD_B = 52

const PLOT_W = SVG_W - PAD_L - PAD_R
const PLOT_H = SVG_H - PAD_T - PAD_B

function toX(blue_pct: number) {
  return PAD_L + (blue_pct / 100) * PLOT_W
}

function toY(normVotes: number) {
  // Higher votes → higher on chart (lower SVG Y)
  return PAD_T + PLOT_H - normVotes * PLOT_H
}

function logNorm(value: number, maxValue: number): number {
  if (maxValue <= 0) return 0
  return Math.log10(value + 1) / Math.log10(maxValue + 1)
}

function dotRadius(normVotes: number): number {
  return 3 + normVotes * 9
}

function dotColor(t: MapTopic, mode: 'lean' | 'category'): string {
  if (mode === 'category') {
    return CATEGORY_COLORS[t.category ?? 'Other'] ?? CATEGORY_COLORS.Other
  }
  // lean mode: blue/red gradient via blue_pct
  const p = t.blue_pct
  if (p >= 70) return '#3b82f6'
  if (p >= 55) return '#60a5fa'
  if (p >= 45) return '#8b5cf6'
  if (p >= 30) return '#f87171'
  return '#ef4444'
}

function dotOpacity(status: string): number {
  if (status === 'law') return 1
  if (status === 'active' || status === 'voting') return 0.85
  if (status === 'proposed') return 0.6
  return 0.35 // failed
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TooltipState {
  topic: MapTopic
  svgX: number
  svgY: number
}

export function MapClient() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)

  const [data, setData] = useState<MapDataResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [colorMode, setColorMode] = useState<'lean' | 'category'>('lean')
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/map')
      if (!res.ok) throw new Error('Failed to load map data')
      const json: MapDataResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filteredTopics = (data?.topics ?? []).filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false
    if (categoryFilter !== 'all' && (t.category ?? 'Other') !== categoryFilter) return false
    return true
  })

  const maxVotes = data?.stats.max_votes ?? 1

  // ── SVG mouse events ────────────────────────────────────────────────────────

  function getSvgCoords(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const scaleX = SVG_W / rect.width
    const scaleY = SVG_H / rect.height
    return {
      svgX: (e.clientX - rect.left) * scaleX,
      svgY: (e.clientY - rect.top) * scaleY,
    }
  }

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const coords = getSvgCoords(e)
    if (!coords) return
    const HOVER_R = 12
    let best: MapTopic | null = null
    let bestDist = Infinity

    for (const t of filteredTopics) {
      const norm = logNorm(t.total_votes, maxVotes)
      const cx = toX(t.blue_pct)
      const cy = toY(norm)
      const dx = coords.svgX - cx
      const dy = coords.svgY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < HOVER_R + dotRadius(norm) && dist < bestDist) {
        bestDist = dist
        best = t
      }
    }

    if (best) {
      const norm = logNorm(best.total_votes, maxVotes)
      setTooltip({ topic: best, svgX: toX(best.blue_pct), svgY: toY(norm) })
    } else {
      setTooltip(null)
    }
  }

  function onMouseLeave() {
    setTooltip(null)
  }

  function onSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    const coords = getSvgCoords(e)
    if (!coords) return
    const CLICK_R = 14
    let best: MapTopic | null = null
    let bestDist = Infinity

    for (const t of filteredTopics) {
      const norm = logNorm(t.total_votes, maxVotes)
      const cx = toX(t.blue_pct)
      const cy = toY(norm)
      const dx = coords.svgX - cx
      const dy = coords.svgY - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < CLICK_R + dotRadius(norm) && dist < bestDist) {
        bestDist = dist
        best = t
      }
    }

    if (best) router.push(`/topic/${best.id}`)
  }

  // ── Tooltip position clamped to SVG bounds ──────────────────────────────────

  function tooltipStyle(svgX: number, svgY: number) {
    const svg = svgRef.current
    if (!svg) return {}
    const rect = svg.getBoundingClientRect()
    const scaleX = rect.width / SVG_W
    const scaleY = rect.height / SVG_H
    const px = svgX * scaleX
    const py = svgY * scaleY
    // Prefer showing above the dot; clamp to container
    const tipW = 224
    const tipH = 120
    let left = px - tipW / 2
    let top = py - tipH - 16
    left = Math.max(4, Math.min(left, rect.width - tipW - 4))
    top = Math.max(4, top < 0 ? py + 16 : top)
    return { left, top }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const STATUS_FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'voting', label: 'Voting' },
    { key: 'law', label: 'Law' },
    { key: 'proposed', label: 'Proposed' },
    { key: 'failed', label: 'Failed' },
  ]

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-20">
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-8 space-y-5">

          {/* Header */}
          <div className="flex items-start gap-3">
            <Link href="/" className="mt-0.5 text-surface-500 hover:text-surface-700 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
                <Map className="h-5 w-5 text-for-400" />
                The Civic Policy Map
              </h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Every topic plotted by consensus strength vs. engagement.
                {data && (
                  <span className="text-surface-400 ml-1">
                    {filteredTopics.length.toLocaleString()} topic{filteredTopics.length !== 1 ? 's' : ''} shown.
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={load}
              className="shrink-0 p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Stats row */}
          {data && (
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Total', value: data.stats.total, icon: Scale, color: 'text-surface-600' },
                { label: 'Active', value: data.stats.active, icon: Zap, color: 'text-for-400' },
                { label: 'Laws', value: data.stats.laws, icon: Gavel, color: 'text-gold' },
                { label: 'Avg. FOR%', value: `${data.stats.avg_blue_pct}%`, icon: TrendingUp, color: 'text-emerald' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-surface-100 border border-surface-200 rounded-xl p-3 text-center">
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                  <div className="text-lg font-bold text-surface-900 tabular-nums">{value}</div>
                  <div className="text-xs text-surface-500">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status chips */}
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold transition-all border',
                      statusFilter === f.key
                        ? 'bg-for-500 text-white border-for-500'
                        : 'bg-surface-100 text-surface-600 border-surface-200 hover:border-surface-400'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Divider */}
              <span className="text-surface-300">|</span>

              {/* Colour mode toggle */}
              <div className="flex gap-1.5">
                {(['lean', 'category'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setColorMode(mode)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-semibold transition-all border',
                      colorMode === mode
                        ? 'bg-purple text-white border-purple'
                        : 'bg-surface-100 text-surface-600 border-surface-200 hover:border-surface-400'
                    )}
                  >
                    {mode === 'lean' ? 'Colour: FOR/AGAINST' : 'Colour: Category'}
                  </button>
                ))}
              </div>

              {/* Category filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  'ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all border',
                  showFilters
                    ? 'bg-surface-300 text-surface-900 border-surface-400'
                    : 'bg-surface-100 text-surface-600 border-surface-200 hover:border-surface-400'
                )}
              >
                <Filter className="h-3 w-3" />
                Category
              </button>
            </div>

            {/* Category chips */}
            <AnimatePresence>
              {showFilters && data && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex gap-1.5 flex-wrap pt-1">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-semibold transition-all border',
                        categoryFilter === 'all'
                          ? 'bg-surface-600 text-white border-surface-600'
                          : 'bg-surface-100 text-surface-600 border-surface-200 hover:border-surface-400'
                      )}
                    >
                      All Categories
                    </button>
                    {data.categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        style={categoryFilter === cat ? {
                          backgroundColor: CATEGORY_COLORS[cat] ?? '#71717a',
                          borderColor: CATEGORY_COLORS[cat] ?? '#71717a',
                          color: '#fff',
                        } : {}}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-semibold transition-all border',
                          categoryFilter !== cat && 'bg-surface-100 text-surface-600 border-surface-200 hover:border-surface-400'
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Main chart */}
          {loading ? (
            <div className="flex items-center justify-center h-96 bg-surface-100 rounded-2xl border border-surface-200">
              <Loader2 className="h-8 w-8 text-surface-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <p className="text-surface-500">{error}</p>
              <button onClick={load} className="text-sm text-for-400 hover:underline">Try again</button>
            </div>
          ) : (
            <div className="relative bg-surface-100 border border-surface-200 rounded-2xl overflow-hidden">
              {/* Axis labels */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-surface-500 uppercase tracking-widest pointer-events-none">
                Consensus ← AGAINST · FOR →
              </div>
              <div
                className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-surface-500 uppercase tracking-widest pointer-events-none"
                style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
              >
                Engagement ↑
              </div>

              {/* SVG plot */}
              <svg
                ref={svgRef}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className="w-full cursor-crosshair select-none"
                style={{ maxHeight: '540px' }}
                onMouseMove={onMouseMove}
                onMouseLeave={onMouseLeave}
                onClick={onSvgClick}
                role="img"
                aria-label="Civic Policy Map scatter plot"
              >
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((pct) => {
                  const x = toX(pct)
                  return (
                    <g key={pct}>
                      <line
                        x1={x} y1={PAD_T} x2={x} y2={PAD_T + PLOT_H}
                        stroke={pct === 50 ? '#3f3f4a' : '#24242e'}
                        strokeWidth={pct === 50 ? 1.5 : 0.8}
                        strokeDasharray={pct === 50 ? '4 3' : '3 5'}
                      />
                      <text
                        x={x} y={PAD_T + PLOT_H + 18}
                        textAnchor="middle"
                        fill="#71717a"
                        fontSize="10"
                        fontFamily="system-ui"
                      >
                        {pct}%
                      </text>
                    </g>
                  )
                })}

                {/* Contested zone shading */}
                <rect
                  x={toX(40)} y={PAD_T}
                  width={toX(60) - toX(40)} height={PLOT_H}
                  fill="#3f3f4a" fillOpacity="0.25"
                />

                {/* AGAINST / FOR labels at bottom */}
                <text x={toX(15)} y={PAD_T + PLOT_H + 36} textAnchor="middle" fill="#ef4444" fontSize="10" fontFamily="system-ui" fontWeight="600">AGAINST</text>
                <text x={toX(85)} y={PAD_T + PLOT_H + 36} textAnchor="middle" fill="#3b82f6" fontSize="10" fontFamily="system-ui" fontWeight="600">FOR</text>
                <text x={toX(50)} y={PAD_T + PLOT_H + 36} textAnchor="middle" fill="#8b5cf6" fontSize="10" fontFamily="system-ui" fontWeight="600">CONTESTED</text>

                {/* Topic dots — failed first (bottom), laws last (top) */}
                {['failed', 'proposed', 'active', 'voting', 'law'].flatMap((status) =>
                  filteredTopics
                    .filter((t) => t.status === status)
                    .map((t) => {
                      const norm = logNorm(t.total_votes, maxVotes)
                      const cx = toX(t.blue_pct)
                      const cy = toY(norm)
                      const r = dotRadius(norm)
                      const fill = dotColor(t, colorMode)
                      const opacity = dotOpacity(t.status)
                      const isHovered = tooltip?.topic.id === t.id

                      return (
                        <circle
                          key={t.id}
                          cx={cx} cy={cy} r={isHovered ? r + 3 : r}
                          fill={fill}
                          fillOpacity={isHovered ? 1 : opacity}
                          stroke={isHovered ? '#ffffff' : t.status === 'law' ? '#f59e0b' : 'none'}
                          strokeWidth={isHovered ? 2 : t.status === 'law' ? 1.5 : 0}
                          style={{ transition: 'r 0.1s, fill-opacity 0.1s', cursor: 'pointer' }}
                        />
                      )
                    })
                )}
              </svg>

              {/* Tooltip overlay */}
              <AnimatePresence>
                {tooltip && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute z-10 w-56 bg-surface-200 border border-surface-300 rounded-xl shadow-xl p-3 pointer-events-none"
                    style={tooltipStyle(tooltip.svgX, tooltip.svgY)}
                  >
                    <p className="text-xs font-medium text-surface-900 leading-snug line-clamp-3 mb-2">
                      {tooltip.topic.statement}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: STATUS_COLORS[tooltip.topic.status] ?? '#71717a' }}
                      >
                        {STATUS_LABEL[tooltip.topic.status] ?? tooltip.topic.status}
                      </span>
                      {tooltip.topic.category && (
                        <span
                          className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-white"
                          style={{ backgroundColor: CATEGORY_COLORS[tooltip.topic.category] ?? '#71717a' }}
                        >
                          {tooltip.topic.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-surface-500">
                      <span>
                        <span className="text-for-400 font-semibold">{Math.round(tooltip.topic.blue_pct)}% FOR</span>
                        {' · '}
                        <span className="text-against-400 font-semibold">{Math.round(100 - tooltip.topic.blue_pct)}% AGN</span>
                      </span>
                      <span>{tooltip.topic.total_votes.toLocaleString()} votes</span>
                    </div>
                    <div className="mt-1 text-[10px] text-surface-400 flex items-center gap-1">
                      <ExternalLink className="h-2.5 w-2.5" />
                      Click to view
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Legend */}
          {!loading && !error && (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-surface-500">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-surface-300/50" />
                <span>Dot size = engagement (votes)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold/80 ring-1 ring-gold" />
                <span>Gold ring = established law</span>
              </div>
              {colorMode === 'lean' ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-for-400" />
                    <span>Blue = FOR majority</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-against-400" />
                    <span>Red = AGAINST majority</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-purple" />
                    <span>Purple = contested</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                    <span key={cat} className="flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span>{cat}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom CTA */}
          {!loading && !error && filteredTopics.length > 0 && (
            <p className="text-center text-xs text-surface-400">
              Click any dot to open the topic · Hover to see details
            </p>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
