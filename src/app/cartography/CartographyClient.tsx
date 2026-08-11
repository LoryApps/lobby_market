'use client'

/**
 * /cartography — Civic Cartography
 *
 * A 2D scatter plot mapping every debate in the Lobby:
 *   X-axis — Consensus direction: 0 = pure Against, 100 = pure For
 *   Y-axis — Engagement depth: log scale of total votes cast
 *
 * Quadrants:
 *   Top-right   — For Stronghold: popular AND For-dominant
 *   Top-left    — Against Stronghold: popular AND Against-dominant
 *   Bottom-right — For Frontier: low-engagement but leaning For
 *   Bottom-left  — Against Frontier: low-engagement but leaning Against
 *   Center band  — Contested Territory: near 50/50 split (40–60%)
 *
 * Each dot = one debate. Laws get a gold ring. Hover for details.
 * Click to navigate to that topic.
 *
 * Distinct from:
 *   /galaxy     — force-clustered by category (layout not semantically positioned)
 *   /consensus  — bubble chart of consensus progress
 *   /temperature — ranked list by composite heat score
 *   /nexus      — tag/wiki link graph
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronDown,
  Compass,
  Filter,
  Gavel,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { CartographyPoint, CartographyResponse } from '@/app/api/cartography/route'

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

const CATEGORY_LABEL_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
  Other:       'text-surface-400',
}

const CATEGORIES_ALL = [
  'all',
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// Padding around plot area
const PAD = { top: 32, right: 24, bottom: 56, left: 56 }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dotColor(p: CartographyPoint): string {
  return CATEGORY_COLOR[p.category ?? ''] ?? '#6b7280'
}

function logY(votes: number, minVotes: number, maxVotes: number): number {
  const logMin = Math.log10(Math.max(minVotes, 1))
  const logMax = Math.log10(Math.max(maxVotes, 2))
  const logV   = Math.log10(Math.max(votes, 1))
  if (logMax === logMin) return 0.5
  return (logV - logMin) / (logMax - logMin)
}

function dotRadius(votes: number, maxVotes: number): number {
  const norm = Math.sqrt(votes / Math.max(maxVotes, 1))
  return Math.max(3, Math.min(12, 3 + norm * 9))
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipState {
  point: CartographyPoint
  svgX: number
  svgY: number
}

// ─── Plot ─────────────────────────────────────────────────────────────────────

interface PlotProps {
  points: CartographyPoint[]
  width: number
  height: number
  highlightId: string | null
  onHover: (state: TooltipState | null) => void
  onClick: (point: CartographyPoint) => void
}

function Plot({ points, width, height, highlightId, onHover, onClick }: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  const plotW = width  - PAD.left - PAD.right
  const plotH = height - PAD.top  - PAD.bottom

  const minVotes = Math.min(...points.map(p => p.total_votes))
  const maxVotes = Math.max(...points.map(p => p.total_votes), 1)

  function toX(blue_pct: number) {
    return PAD.left + (blue_pct / 100) * plotW
  }
  function toY(votes: number) {
    return PAD.top + (1 - logY(votes, minVotes, maxVotes)) * plotH
  }

  // Quadrant X ticks
  const xTicks = [0, 25, 50, 75, 100]
  // Y tick labels (vote counts on log scale)
  const yTickVotes = [10, 100, 1000, 10000, 100000]

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="touch-none select-none"
      aria-label="Civic opinion cartography scatter plot"
    >
      {/* ── Defs ────────────────────────────────────────────────────────── */}
      <defs>
        <radialGradient id="cg-law" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Background quadrant shading ──────────────────────────────────── */}
      {/* Against zone (0–40%) */}
      <rect
        x={PAD.left}
        y={PAD.top}
        width={plotW * 0.4}
        height={plotH}
        fill="#ef4444"
        opacity={0.03}
      />
      {/* For zone (60–100%) */}
      <rect
        x={PAD.left + plotW * 0.6}
        y={PAD.top}
        width={plotW * 0.4}
        height={plotH}
        fill="#3b82f6"
        opacity={0.03}
      />
      {/* Contested band (40–60%) vertical stripe */}
      <rect
        x={PAD.left + plotW * 0.4}
        y={PAD.top}
        width={plotW * 0.2}
        height={plotH}
        fill="#c9a84c"
        opacity={0.04}
      />

      {/* ── Grid lines ──────────────────────────────────────────────────── */}
      {/* Vertical gridlines at xTicks */}
      {xTicks.map(pct => (
        <line
          key={pct}
          x1={toX(pct)}
          x2={toX(pct)}
          y1={PAD.top}
          y2={PAD.top + plotH}
          stroke="#1e2230"
          strokeWidth={pct === 50 ? 1.5 : 1}
          strokeDasharray={pct === 50 ? undefined : '3,4'}
          opacity={pct === 50 ? 0.8 : 0.5}
        />
      ))}

      {/* Horizontal gridlines */}
      {yTickVotes.filter(v => v >= minVotes * 0.5 && v <= maxVotes * 2).map(v => {
        const y = toY(v)
        if (y < PAD.top || y > PAD.top + plotH) return null
        return (
          <line
            key={v}
            x1={PAD.left}
            x2={PAD.left + plotW}
            y1={y}
            y2={y}
            stroke="#1e2230"
            strokeWidth={1}
            strokeDasharray="3,4"
            opacity={0.5}
          />
        )
      })}

      {/* ── Axis labels ─────────────────────────────────────────────────── */}
      {/* X axis labels */}
      {xTicks.map(pct => (
        <text
          key={pct}
          x={toX(pct)}
          y={PAD.top + plotH + 20}
          textAnchor="middle"
          fontSize={9}
          fontFamily="monospace"
          fill="#4b5563"
        >
          {pct === 0 ? '0%' : pct === 100 ? '100%' : `${pct}%`}
        </text>
      ))}

      {/* X axis direction labels */}
      <text
        x={PAD.left + plotW * 0.12}
        y={PAD.top + plotH + 38}
        textAnchor="middle"
        fontSize={8}
        fontFamily="monospace"
        fill="#ef4444"
        opacity={0.7}
      >
        ← AGAINST
      </text>
      <text
        x={PAD.left + plotW * 0.88}
        y={PAD.top + plotH + 38}
        textAnchor="middle"
        fontSize={8}
        fontFamily="monospace"
        fill="#3b82f6"
        opacity={0.7}
      >
        FOR →
      </text>

      {/* Y axis labels */}
      {yTickVotes.filter(v => v >= minVotes * 0.5 && v <= maxVotes * 2).map(v => {
        const y = toY(v)
        if (y < PAD.top || y > PAD.top + plotH) return null
        return (
          <text
            key={v}
            x={PAD.left - 8}
            y={y + 3}
            textAnchor="end"
            fontSize={8}
            fontFamily="monospace"
            fill="#4b5563"
          >
            {formatVotes(v)}
          </text>
        )
      })}

      {/* Y axis title */}
      <text
        x={14}
        y={PAD.top + plotH / 2}
        textAnchor="middle"
        fontSize={8}
        fontFamily="monospace"
        fill="#4b5563"
        transform={`rotate(-90, 14, ${PAD.top + plotH / 2})`}
      >
        VOTES (log)
      </text>

      {/* ── Contested band label ─────────────────────────────────────────── */}
      <text
        x={toX(50)}
        y={PAD.top - 10}
        textAnchor="middle"
        fontSize={8}
        fontFamily="monospace"
        fill="#c9a84c"
        opacity={0.6}
      >
        ← CONTESTED →
      </text>

      {/* ── Data points ─────────────────────────────────────────────────── */}
      {points.map(p => {
        const cx = toX(p.blue_pct)
        const cy = toY(p.total_votes)
        const r  = dotRadius(p.total_votes, maxVotes)
        const isLaw = p.status === 'law'
        const isHighlit = highlightId === p.id
        const color = dotColor(p)

        return (
          <g
            key={p.id}
            onMouseEnter={() => onHover({ point: p, svgX: cx, svgY: cy })}
            onMouseLeave={() => onHover(null)}
            onClick={() => onClick(p)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={p.statement}
          >
            {/* Law gold glow */}
            {isLaw && (
              <circle
                cx={cx}
                cy={cy}
                r={r + 5}
                fill="url(#cg-law)"
              />
            )}
            {/* Main dot */}
            <circle
              cx={cx}
              cy={cy}
              r={isHighlit ? r + 2 : r}
              fill={color}
              fillOpacity={isHighlit ? 1 : 0.7}
              stroke={isLaw ? '#c9a84c' : isHighlit ? 'white' : 'transparent'}
              strokeWidth={isLaw ? 1.5 : isHighlit ? 1.5 : 0}
            />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CartographyClient() {
  const [data, setData]           = useState<CartographyResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [category, setCategory]   = useState('all')
  const [status, setStatus]       = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims]           = useState({ w: 600, h: 420 })

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const rect = entries[0].contentRect
      setDims({ w: Math.floor(rect.width), h: Math.max(360, Math.min(560, Math.floor(rect.width * 0.65))) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ status, limit: '600' })
      if (category !== 'all') params.set('category', category)
      const res = await fetch(`/api/cartography?${params}`)
      if (!res.ok) throw new Error('Failed to load cartography data')
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [category, status])

  useEffect(() => { load() }, [load])

  const points = useMemo(() => data?.points ?? [], [data])

  const handleHover = useCallback((state: TooltipState | null) => {
    setTooltip(state)
    setHighlightId(state?.point.id ?? null)
  }, [])

  const handleClick = useCallback((point: CartographyPoint) => {
    window.location.href = `/topic/${point.id}`
  }, [])

  const statusOptions = [
    { value: 'all',    label: 'All debates' },
    { value: 'active', label: 'Active only' },
    { value: 'law',    label: 'Laws only' },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Back + Header ────────────────────────────────────────────────── */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <div className="h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center">
                <Compass className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-mono text-white leading-none">
                  Civic Cartography
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Every debate mapped by consensus and engagement
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40 flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Platform stats bar ───────────────────────────────────────────── */}
        {data && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-5"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-lg font-bold font-mono text-for-300">{data.platform.total_topics.toLocaleString()}</p>
              <p className="text-xs font-mono text-surface-500 mt-0.5">Active debates</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-lg font-bold font-mono text-gold">{data.platform.total_laws.toLocaleString()}</p>
              <p className="text-xs font-mono text-surface-500 mt-0.5">Established laws</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="text-lg font-bold font-mono text-white">{formatVotes(data.platform.median_votes)}</p>
              <p className="text-xs font-mono text-surface-500 mt-0.5">Median votes</p>
            </div>
          </motion.div>
        )}

        {/* ── Filter bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <button
            onClick={() => setShowFilters(f => !f)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors',
              showFilters
                ? 'bg-for-500/20 border-for-500/40 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
          </button>

          {/* Status quick filter */}
          <div className="flex gap-1.5 ml-auto flex-wrap">
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors',
                  status === opt.value
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Category filter ───────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-surface-300">
                {CATEGORIES_ALL.map(cat => {
                  const active = category === cat
                  const color = cat === 'all' ? null : CATEGORY_LABEL_COLOR[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border font-mono font-medium transition-colors capitalize',
                        active
                          ? cat === 'all'
                            ? 'bg-surface-300 text-white border-surface-400'
                            : cn('bg-surface-200 border-surface-400', color)
                          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                      )}
                    >
                      {cat === 'all' ? 'All categories' : cat}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Chart area ───────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="relative rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
          style={{ minHeight: 360 }}
        >
          {loading ? (
            <div className="flex items-center justify-center" style={{ height: dims.h }}>
              <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center p-8" style={{ height: dims.h }}>
              <p className="text-against-400 text-sm font-mono">{error}</p>
              <button onClick={load} className="text-xs font-mono text-surface-500 hover:text-white flex items-center gap-1.5 transition-colors">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : points.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: dims.h }}>
              <p className="text-surface-500 text-sm font-mono">No debates to map</p>
            </div>
          ) : (
            <>
              <Plot
                points={points}
                width={dims.w}
                height={dims.h}
                highlightId={highlightId}
                onHover={handleHover}
                onClick={handleClick}
              />

              {/* ── Tooltip ───────────────────────────────────────────────── */}
              <AnimatePresence>
                {tooltip && (
                  <motion.div
                    key={tooltip.point.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.1 }}
                    className="absolute z-10 pointer-events-none max-w-xs"
                    style={{
                      left: Math.min(tooltip.svgX + 12, dims.w - 230),
                      top: Math.max(tooltip.svgY - 80, 8),
                    }}
                  >
                    <div className="rounded-xl bg-surface-50 border border-surface-300 shadow-xl p-3 space-y-1.5">
                      <p className="text-xs font-mono font-semibold text-white leading-snug line-clamp-2">
                        {tooltip.point.statement}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {tooltip.point.category && (
                          <span className={cn(
                            'text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-surface-200 border border-surface-300',
                            CATEGORY_LABEL_COLOR[tooltip.point.category] ?? 'text-surface-400'
                          )}>
                            {tooltip.point.category}
                          </span>
                        )}
                        {tooltip.point.status === 'law' && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-gold flex items-center gap-1">
                            <Gavel className="h-2.5 w-2.5" />
                            LAW
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
                        <span>
                          <span className="text-for-400 font-semibold">{tooltip.point.blue_pct.toFixed(0)}%</span>
                          {' '}For
                        </span>
                        <span>
                          <span className="text-white font-semibold">{formatVotes(tooltip.point.total_votes)}</span>
                          {' '}votes
                        </span>
                      </div>
                      <p className="text-[9px] font-mono text-surface-600">Click to open →</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>

        {/* ── Legend ───────────────────────────────────────────────────────── */}
        {!loading && points.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-xl bg-surface-100 border border-surface-300 p-4"
          >
            <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
              Reading the map
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  zone: 'For Stronghold',
                  desc: 'High support + high engagement',
                  color: 'bg-for-600/20 border-for-600/30 text-for-300',
                },
                {
                  zone: 'Against Stronghold',
                  desc: 'Against-dominant + high engagement',
                  color: 'bg-against-600/20 border-against-600/30 text-against-300',
                },
                {
                  zone: 'Contested Territory',
                  desc: 'Near 50/50 — active front line',
                  color: 'bg-gold/10 border-gold/30 text-gold',
                },
                {
                  zone: 'Gold ring = Law',
                  desc: 'Topic reached consensus and became a law',
                  color: 'bg-surface-200 border-gold/40 text-gold',
                },
              ].map(item => (
                <div
                  key={item.zone}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left',
                    item.color,
                  )}
                >
                  <p className="text-xs font-mono font-semibold">{item.zone}</p>
                  <p className="text-[10px] font-mono opacity-70 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Category colour key */}
            <div className="mt-3 pt-3 border-t border-surface-300 flex flex-wrap gap-2">
              {Object.entries(CATEGORY_COLOR)
                .filter(([cat]) => category === 'all' || cat === category)
                .map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  {cat}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Point count ───────────────────────────────────────────────────── */}
        {!loading && (
          <p className="mt-3 text-xs font-mono text-surface-600 text-center">
            {points.length.toLocaleString()} debates mapped
            {category !== 'all' ? ` · ${category}` : ''}
            {status !== 'all' ? ` · ${status === 'law' ? 'laws only' : 'active only'}` : ''}
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
