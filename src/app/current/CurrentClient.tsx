'use client'

/**
 * /current — Civic Current
 *
 * A vector-field visualization of all active debates.
 * Position = (consensus direction, engagement depth) — same axes as /cartography.
 * Each debate is an ARROW showing where opinion is MOVING and how fast.
 *
 * Arrow direction:
 *   Right  = opinion drifting more FOR in the last 7 days
 *   Left   = opinion drifting more AGAINST
 *   Up     = engagement accelerating (more votes per day)
 *   Down   = engagement decelerating
 *
 * Arrow length = speed (magnitude of change)
 * Arrow color  = category
 *
 * Distinct from:
 *   /cartography  — static scatter plot (no direction/speed)
 *   /momentum     — ranked list of fastest-moving topics
 *   /volatility   — ranked list of most volatile topics (stddev-based)
 *   /velocity     — category sparklines (no per-topic position plot)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Filter,
  Info,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { CurrentResponse, CurrentVector } from '@/app/api/current/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   '#c9a84c',
  Politics:    '#60a5fa',
  Technology:  '#a78bfa',
  Science:     '#34d399',
  Ethics:      '#f87171',
  Philosophy:  '#93c5fd',
  Culture:     '#fbbf24',
  Health:      '#fb7185',
  Environment: '#6ee7b7',
  Education:   '#c4b5fd',
  Other:       '#6b7280',
}

const CATEGORIES_ALL = [
  'all',
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const PAD = { top: 36, right: 24, bottom: 56, left: 56 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function arrowColor(v: CurrentVector): string {
  return CATEGORY_COLOR[v.category ?? ''] ?? '#6b7280'
}

function logEngagement(total: number, minV: number, maxV: number): number {
  const lo = Math.log10(Math.max(minV, 1))
  const hi = Math.log10(Math.max(maxV, 2))
  const lv = Math.log10(Math.max(total, 1))
  if (hi === lo) return 0.5
  return (lv - lo) / (hi - lo)
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

// ─── Arrow SVG ───────────────────────────────────────────────────────────────

interface ArrowProps {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  opacity: number
  arrowSize: number
}

function Arrow({ x1, y1, x2, y2, color, opacity, arrowSize }: ArrowProps) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1) return null

  const ux = dx / len
  const uy = dy / len

  // Arrowhead: two wings
  const hs = arrowSize * 0.6
  const ax1 = x2 - ux * hs + uy * hs * 0.45
  const ay1 = y2 - uy * hs - ux * hs * 0.45
  const ax2 = x2 - ux * hs - uy * hs * 0.45
  const ay2 = y2 - uy * hs + ux * hs * 0.45

  return (
    <g opacity={opacity} style={{ pointerEvents: 'none' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.2} />
      <line x1={x2} y1={y2} x2={ax1} y2={ay1} stroke={color} strokeWidth={1.2} />
      <line x1={x2} y1={y2} x2={ax2} y2={ay2} stroke={color} strokeWidth={1.2} />
    </g>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  v: CurrentVector
  px: number
  py: number
  width: number
  height: number
}

function Tooltip({ v, px, py, width, height }: TooltipProps) {
  const tw = 230
  const th = 150
  let left = px + 12
  let top  = py - 8
  if (left + tw > width - 8)  left = px - tw - 12
  if (top + th > height - 8)  top  = height - th - 8
  if (top < 8)                 top  = 8

  const color = arrowColor(v)
  const dxLabel = v.dx > 2 ? `+${v.dx.toFixed(1)}% FOR` : v.dx < -2 ? `${v.dx.toFixed(1)}% AGAINST` : 'Stable opinion'
  const dyLabel = `${v.dy.toFixed(1)} votes/day`

  return (
    <foreignObject x={left} y={top} width={tw} height={th} style={{ overflow: 'visible' }}>
      <div className="bg-surface-900/95 border border-surface-700 rounded-lg p-3 shadow-xl text-xs">
        <p className="text-surface-100 font-medium leading-tight mb-2" style={{ fontSize: '11px' }}>
          {truncate(v.statement, 70)}
        </p>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-surface-400">{v.category ?? 'Other'}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
          <span className="text-surface-400">Consensus</span>
          <span className={cn('font-mono', v.blue_pct >= 50 ? 'text-for-400' : 'text-against-400')}>
            {v.blue_pct.toFixed(1)}% FOR
          </span>
          <span className="text-surface-400">Opinion drift</span>
          <span className={cn('font-mono', v.dx > 2 ? 'text-for-400' : v.dx < -2 ? 'text-against-400' : 'text-surface-300')}>
            {dxLabel}
          </span>
          <span className="text-surface-400">Momentum</span>
          <span className="font-mono text-surface-300">{dyLabel}</span>
          <span className="text-surface-400">Recent votes</span>
          <span className="font-mono text-surface-300">{v.recent_votes.toLocaleString()}</span>
        </div>
      </div>
    </foreignObject>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CurrentClient() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<CurrentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [showInfo, setShowInfo] = useState(false)
  const [showCatMenu, setShowCatMenu] = useState(false)
  const [hovered, setHovered] = useState<CurrentVector | null>(null)
  const [hoverPos, setHoverPos] = useState({ px: 0, py: 0 })
  const [svgSize, setSvgSize] = useState({ w: 640, h: 400 })

  // Track container size
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setSvgSize({ w: Math.max(300, width), h: Math.max(240, height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ category })
      const res = await fetch(`/api/current?${params}`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => { load() }, [load])

  // ─── Derived plot geometry ────────────────────────────────────────────────

  const { w, h } = svgSize
  const plotW = w - PAD.left - PAD.right
  const plotH = h - PAD.top  - PAD.bottom

  const { minV, maxV } = useMemo(() => {
    if (!data?.vectors.length) return { minV: 1, maxV: 100 }
    const votes = data.vectors.map((v) => v.total_votes)
    return { minV: Math.min(...votes), maxV: Math.max(...votes) }
  }, [data])

  // Arrow scale: map dx (–50..+50) → px, dy → px
  const maxDx = useMemo(() => {
    if (!data?.vectors.length) return 10
    return Math.max(...data.vectors.map((v) => Math.abs(v.dx)), 1)
  }, [data])

  const maxDy = useMemo(() => {
    if (!data?.vectors.length) return 1
    return Math.max(...data.vectors.map((v) => v.dy), 1)
  }, [data])

  const MAX_ARROW_PX = Math.min(plotW * 0.1, plotH * 0.08, 48)

  function toSvgX(blue_pct: number) {
    return PAD.left + (blue_pct / 100) * plotW
  }

  function toSvgY(total_votes: number) {
    return PAD.top + (1 - logEngagement(total_votes, minV, maxV)) * plotH
  }

  function arrowTip(v: CurrentVector, bx: number, by: number) {
    const nx = v.dx / maxDx
    const ny = v.dy / maxDy
    const tipX = bx + nx * MAX_ARROW_PX
    const tipY = by - ny * MAX_ARROW_PX  // invert: more votes = upward in SVG
    return { tipX, tipY }
  }

  // ─── Hit detection ────────────────────────────────────────────────────────

  const handleSvgMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!data || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      let closest: CurrentVector | null = null
      let bestD = 20

      for (const v of data.vectors) {
        const bx = toSvgX(v.blue_pct)
        const by = toSvgY(v.total_votes)
        const d  = Math.sqrt((mx - bx) ** 2 + (my - by) ** 2)
        if (d < bestD) { bestD = d; closest = v }
      }

      setHovered(closest)
      setHoverPos({ px: mx, py: my })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, svgSize]
  )

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!data || !svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      for (const v of data.vectors) {
        const bx = toSvgX(v.blue_pct)
        const by = toSvgY(v.total_votes)
        const d  = Math.sqrt((mx - bx) ** 2 + (my - by) ** 2)
        if (d < 20) { router.push(`/topic/${v.id}`); return }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, router, svgSize]
  )

  // ─── Axis tick helpers ────────────────────────────────────────────────────

  const xTicks = [0, 25, 50, 75, 100]
  const yTickValues = useMemo(() => {
    if (!data?.vectors.length) return []
    const levels = [10, 50, 100, 500, 1000, 5000, 10000, 50000]
    return levels.filter((n) => n >= minV && n <= maxV)
  }, [data, minV, maxV])

  // ─── Spotlight cards ──────────────────────────────────────────────────────

  const fastest_for    = data?.vectors.find((v) => v.id === data.platform.fastest_for_id)
  const fastest_against = data?.vectors.find((v) => v.id === data.platform.fastest_against_id)
  const most_active    = data?.vectors.find((v) => v.id === data.platform.most_active_id)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 overflow-y-auto">
        {/* ── Header ── */}
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-2">
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => router.back()}
              className="p-1.5 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-200 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Waves className="h-5 w-5 text-for-400" />
                <h1 className="text-lg font-semibold text-surface-100">Civic Current</h1>
                <button
                  onClick={() => setShowInfo(!showInfo)}
                  className="p-1 rounded text-surface-500 hover:text-surface-300 transition-colors"
                  aria-label="About this visualization"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-surface-400 mt-0.5">
                A vector field of all debates — where they stand and where they&apos;re moving
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-200 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Info panel */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-surface-200/60 border border-surface-600/50 rounded-lg p-3 mt-2 text-xs text-surface-400 space-y-1.5">
                  <p>
                    <span className="text-surface-200 font-medium">Position</span> — X axis is the current FOR/AGAINST split.
                    Y axis is engagement depth (log scale). Same layout as{' '}
                    <Link href="/cartography" className="text-for-400 hover:underline">Cartography</Link>.
                  </p>
                  <p>
                    <span className="text-surface-200 font-medium">Arrows</span> — Each debate is an arrow.
                    Horizontal = opinion drift over the last 7 days (right = more FOR recently).
                    Vertical = vote momentum (up = accelerating engagement).
                    Length = speed of change.
                  </p>
                  <p>
                    <span className="text-surface-200 font-medium">Colour</span> — Category.
                    Hover to see details, click to navigate to the topic.
                  </p>
                  <p>
                    Distinct from{' '}
                    <Link href="/momentum" className="text-for-400 hover:underline">Momentum</Link> (ranked list) and{' '}
                    <Link href="/volatility" className="text-for-400 hover:underline">Volatility</Link> (stddev ranking).
                    Only Current shows all debates simultaneously as a positioned flow field.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Controls ── */}
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2 flex-wrap">
          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => setShowCatMenu(!showCatMenu)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                'bg-surface-200 border border-surface-600 text-surface-300',
                'hover:border-surface-500 hover:text-surface-100 transition-colors',
              )}
            >
              <Filter className="h-3 w-3" />
              {category === 'all' ? 'All categories' : category}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
            <AnimatePresence>
              {showCatMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1 z-30 bg-surface-900 border border-surface-600 rounded-lg shadow-xl min-w-[160px] py-1 overflow-hidden"
                >
                  {CATEGORIES_ALL.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCatMenu(false) }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs transition-colors',
                        category === cat
                          ? 'text-for-400 bg-surface-700'
                          : 'text-surface-300 hover:bg-surface-700 hover:text-surface-100',
                      )}
                    >
                      {cat === 'all' ? 'All categories' : cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Stats strip */}
          {data && (
            <div className="flex items-center gap-3 ml-auto text-[10px] text-surface-500">
              <span>{data.vectors.length} debates</span>
              <span className="text-surface-700">·</span>
              <span>{data.platform.total_moving} in motion</span>
              <span className="text-surface-700">·</span>
              <span>7-day window</span>
            </div>
          )}
        </div>

        {/* ── Plot ── */}
        <div
          ref={containerRef}
          className="max-w-5xl mx-auto px-4"
          style={{ height: 'min(60vh, 520px)' }}
        >
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 text-for-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full text-against-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <svg
              ref={svgRef}
              width={w}
              height={h}
              viewBox={`0 0 ${w} ${h}`}
              className="w-full h-full cursor-crosshair"
              onMouseMove={handleSvgMove}
              onMouseLeave={() => setHovered(null)}
              onClick={handleSvgClick}
              aria-label="Civic current vector field — hover for debate details"
            >
              {/* Background */}
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
                fill="rgba(15,17,25,0.6)" rx={4} />

              {/* Quadrant dividers */}
              {/* Vertical center at 50% */}
              <line
                x1={toSvgX(50)} y1={PAD.top}
                x2={toSvgX(50)} y2={PAD.top + plotH}
                stroke="#334155" strokeWidth={1} strokeDasharray="4 4"
              />

              {/* Horizontal median */}
              {(() => {
                const midY = PAD.top + plotH * 0.5
                return (
                  <line
                    x1={PAD.left} y1={midY}
                    x2={PAD.left + plotW} y2={midY}
                    stroke="#334155" strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5}
                  />
                )
              })()}

              {/* Quadrant labels */}
              <text x={PAD.left + 6} y={PAD.top + 14} fill="#334155" fontSize={9} fontFamily="monospace">
                AGAINST ·HIGH
              </text>
              <text x={PAD.left + plotW - 6} y={PAD.top + 14} fill="#334155" fontSize={9} fontFamily="monospace" textAnchor="end">
                FOR · HIGH
              </text>
              <text x={PAD.left + 6} y={PAD.top + plotH - 6} fill="#334155" fontSize={9} fontFamily="monospace">
                AGAINST · LOW
              </text>
              <text x={PAD.left + plotW - 6} y={PAD.top + plotH - 6} fill="#334155" fontSize={9} fontFamily="monospace" textAnchor="end">
                FOR · LOW
              </text>

              {/* X axis ticks */}
              {xTicks.map((tick) => {
                const sx = toSvgX(tick)
                const label = tick === 0 ? '0%' : tick === 100 ? '100%' : `${tick}%`
                return (
                  <g key={tick}>
                    <line x1={sx} y1={PAD.top + plotH} x2={sx} y2={PAD.top + plotH + 4}
                      stroke="#475569" strokeWidth={0.5} />
                    <text x={sx} y={PAD.top + plotH + 16} fill="#64748b" fontSize={9}
                      fontFamily="monospace" textAnchor="middle">{label}</text>
                  </g>
                )
              })}

              {/* Y axis ticks */}
              {yTickValues.map((n) => {
                const sy = toSvgY(n)
                const label = n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
                return (
                  <g key={n}>
                    <line x1={PAD.left - 4} y1={sy} x2={PAD.left} y2={sy}
                      stroke="#475569" strokeWidth={0.5} />
                    <text x={PAD.left - 6} y={sy + 3} fill="#64748b" fontSize={9}
                      fontFamily="monospace" textAnchor="end">{label}</text>
                  </g>
                )
              })}

              {/* Axis labels */}
              <text
                x={PAD.left + plotW / 2}
                y={h - 4}
                fill="#64748b" fontSize={9} fontFamily="monospace" textAnchor="middle"
              >
                ← AGAINST · CONSENSUS DIRECTION · FOR →
              </text>
              <text
                x={12}
                y={PAD.top + plotH / 2}
                fill="#64748b" fontSize={9} fontFamily="monospace" textAnchor="middle"
                transform={`rotate(-90, 12, ${PAD.top + plotH / 2})`}
              >
                ENGAGEMENT ↑
              </text>

              {/* Arrows */}
              {data.vectors.map((v) => {
                const bx = toSvgX(v.blue_pct)
                const by = toSvgY(v.total_votes)
                const { tipX, tipY } = arrowTip(v, bx, by)
                const color = arrowColor(v)
                const opacity = 0.3 + v.speed * 0.7
                const isHovered = hovered?.id === v.id

                return (
                  <g key={v.id}>
                    <Arrow
                      x1={bx} y1={by}
                      x2={tipX} y2={tipY}
                      color={isHovered ? '#ffffff' : color}
                      opacity={isHovered ? 1 : opacity}
                      arrowSize={isHovered ? 8 : 5}
                    />
                    {/* Hit target */}
                    <circle
                      cx={bx} cy={by} r={8}
                      fill="transparent"
                      className="cursor-pointer"
                    />
                    {/* Base dot */}
                    <circle
                      cx={bx} cy={by} r={isHovered ? 3 : 2}
                      fill={color}
                      opacity={isHovered ? 1 : Math.max(0.4, opacity)}
                    />
                  </g>
                )
              })}

              {/* Tooltip */}
              {hovered && (
                <Tooltip
                  v={hovered}
                  px={hoverPos.px}
                  py={hoverPos.py}
                  width={w}
                  height={h}
                />
              )}
            </svg>
          )}
        </div>

        {/* ── Legend ── */}
        {!loading && !error && data && (
          <div className="max-w-5xl mx-auto px-4 mt-2 mb-3">
            <div className="flex items-center gap-4 flex-wrap text-[10px] text-surface-500">
              <span className="font-medium text-surface-400 uppercase tracking-wide text-[9px]">Categories</span>
              {Object.entries(CATEGORY_COLOR).filter(([k]) => k !== 'Other').map(([cat, col]) => (
                <span key={cat} className="flex items-center gap-1">
                  <span className="w-2.5 h-px inline-block" style={{ background: col }} />
                  <span>{cat}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-6 mt-2 text-[10px] text-surface-500">
              <span className="font-medium text-surface-400 uppercase tracking-wide text-[9px]">Arrow guide</span>
              <span>→ more FOR recently</span>
              <span>← more AGAINST recently</span>
              <span>↑ engagement rising</span>
              <span>longer = faster</span>
            </div>
          </div>
        )}

        {/* ── Spotlight cards ── */}
        {!loading && !error && data && (fastest_for || fastest_against || most_active) && (
          <div className="max-w-5xl mx-auto px-4 pb-4">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-surface-500 mb-3">
              Strongest currents
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {fastest_for && (
                <SpotlightCard
                  label="Drifting FOR"
                  sublabel={`+${fastest_for.dx.toFixed(1)}% shift`}
                  icon={<TrendingUp className="h-3.5 w-3.5 text-for-400" />}
                  v={fastest_for}
                  accent="for"
                />
              )}
              {fastest_against && (
                <SpotlightCard
                  label="Drifting AGAINST"
                  sublabel={`${fastest_against.dx.toFixed(1)}% shift`}
                  icon={<TrendingDown className="h-3.5 w-3.5 text-against-400" />}
                  v={fastest_against}
                  accent="against"
                />
              )}
              {most_active && (
                <SpotlightCard
                  label="Most active"
                  sublabel={`${most_active.recent_votes} recent votes`}
                  icon={<Zap className="h-3.5 w-3.5 text-gold" />}
                  v={most_active}
                  accent="gold"
                />
              )}
            </div>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && data?.vectors.length === 0 && (
          <div className="max-w-5xl mx-auto px-4 py-16 text-center text-surface-500 text-sm">
            No active debates with enough vote data to plot currents.
            Try a different category filter.
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Spotlight card ───────────────────────────────────────────────────────────

function SpotlightCard({
  label,
  sublabel,
  icon,
  v,
  accent,
}: {
  label: string
  sublabel: string
  icon: React.ReactNode
  v: CurrentVector
  accent: 'for' | 'against' | 'gold'
}) {
  const accentBorder = {
    for:     'border-for-500/30',
    against: 'border-against-500/30',
    gold:    'border-gold/30',
  }[accent]

  const accentText = {
    for:     'text-for-400',
    against: 'text-against-400',
    gold:    'text-gold',
  }[accent]

  return (
    <Link
      href={`/topic/${v.id}`}
      className={cn(
        'block bg-surface-200/60 border rounded-lg p-3',
        'hover:bg-surface-200 transition-colors',
        accentBorder,
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', accentText)}>
          {label}
        </span>
        <span className="ml-auto text-[10px] text-surface-500">{sublabel}</span>
      </div>
      <p className="text-xs text-surface-200 leading-snug line-clamp-2">{v.statement}</p>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-surface-500">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: arrowColor(v) }}
        />
        <span>{v.category ?? 'Other'}</span>
        <span className="ml-auto">
          {v.blue_pct.toFixed(1)}% FOR
        </span>
        <ExternalLink className="h-2.5 w-2.5 opacity-50" />
      </div>
    </Link>
  )
}
