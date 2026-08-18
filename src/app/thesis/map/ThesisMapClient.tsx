'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  Info,
  Loader2,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { ThesisMapPoint, ThesisMapResponse } from '@/app/api/thesis/map/route'
import type { ThesisCategory } from '@/lib/types/thesis'

// ── Category colour palette ─────────────────────────────────────────────────
const CAT_COLOR: Record<ThesisCategory, { fill: string; stroke: string; text: string; badge: string }> = {
  economics:   { fill: 'rgba(250,204, 21,0.55)', stroke: '#f59e0b', text: '#fbbf24', badge: 'bg-yellow-500/20 text-yellow-300' },
  politics:    { fill: 'rgba(239, 68, 68,0.55)', stroke: '#ef4444', text: '#f87171', badge: 'bg-red-500/20 text-red-300'    },
  technology:  { fill: 'rgba( 99,102,241,0.55)', stroke: '#6366f1', text: '#a5b4fc', badge: 'bg-indigo-500/20 text-indigo-300' },
  science:     { fill: 'rgba( 34,197, 94,0.55)', stroke: '#22c55e', text: '#4ade80', badge: 'bg-green-500/20 text-green-300'  },
  ethics:      { fill: 'rgba(168, 85,247,0.55)', stroke: '#a855f7', text: '#d8b4fe', badge: 'bg-purple-500/20 text-purple-300' },
  philosophy:  { fill: 'rgba(244,114,182,0.55)', stroke: '#f472b6', text: '#f9a8d4', badge: 'bg-pink-500/20 text-pink-300'   },
  culture:     { fill: 'rgba(251,146, 60,0.55)', stroke: '#fb923c', text: '#fdba74', badge: 'bg-orange-500/20 text-orange-300' },
  health:      { fill: 'rgba( 20,184,166,0.55)', stroke: '#14b8a6', text: '#2dd4bf', badge: 'bg-teal-500/20 text-teal-300'   },
  environment: { fill: 'rgba( 52,211,153,0.55)', stroke: '#34d399', text: '#6ee7b7', badge: 'bg-emerald-500/20 text-emerald-300' },
  education:   { fill: 'rgba( 56,189,248,0.55)', stroke: '#38bdf8', text: '#7dd3fc', badge: 'bg-sky-500/20 text-sky-300'     },
}

// ── Layout constants ─────────────────────────────────────────────────────────
const SVG_W = 800
const SVG_H = 500
const PAD = 56
const MIN_BUBBLE = 6
const MAX_BUBBLE = 26
const MAX_DAYS = 365

// ── Helpers ──────────────────────────────────────────────────────────────────
function bubbleRadius(total: number, maxVotes: number) {
  if (maxVotes === 0) return MIN_BUBBLE
  const r = Math.sqrt(total / maxVotes)
  return MIN_BUBBLE + r * (MAX_BUBBLE - MIN_BUBBLE)
}

function pointToSVG(
  p: ThesisMapPoint,
  width: number,
  height: number,
  pad: number,
): { cx: number; cy: number } {
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  const cx = pad + p.agree_ratio * innerW
  const days = p.days_until_resolution ?? MAX_DAYS + 50
  const capped = Math.min(days, MAX_DAYS + 50)
  // Y: 0 days (urgent) at bottom, MAX_DAYS+50 (open-ended) at top
  const cy = pad + (1 - capped / (MAX_DAYS + 50)) * innerH
  return { cx, cy }
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
interface TooltipProps {
  point: ThesisMapPoint
  x: number
  y: number
  containerW: number
  containerH: number
}

function Tooltip({ point, x, y, containerW, containerH }: TooltipProps) {
  const TIP_W = 240
  const TIP_H = 120
  const left = x + TIP_W + 12 > containerW ? x - TIP_W - 12 : x + 12
  const top  = y + TIP_H + 12 > containerH ? y - TIP_H - 12 : y + 12
  const col  = CAT_COLOR[point.category]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.12 }}
      className="absolute pointer-events-none z-30 w-60 rounded-xl bg-surface-900/95 border border-surface-700 shadow-2xl p-3 backdrop-blur-sm"
      style={{ left, top }}
    >
      <p className="text-xs text-white/90 font-medium line-clamp-2 mb-2 leading-snug">
        {point.statement}
      </p>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Avatar src={point.author_avatar} username={point.author_username} size="xs" />
        <span className="text-xs text-surface-400 truncate">
          {point.author_display_name ?? point.author_username}
        </span>
        <span className={cn('ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-mono', col.badge)}>
          {point.category}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1 text-for-400">
          <ThumbsUp className="h-3 w-3" />
          {point.agree_count}
        </span>
        <span className="flex items-center gap-1 text-against-400">
          <ThumbsDown className="h-3 w-3" />
          {point.disagree_count}
        </span>
        {point.days_until_resolution !== null && (
          <span className="flex items-center gap-1 text-surface-400 ml-auto">
            <Calendar className="h-3 w-3" />
            {point.days_until_resolution}d
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Legend ───────────────────────────────────────────────────────────────────
interface LegendProps {
  categories: ThesisCategory[]
  active: Set<ThesisCategory>
  onToggle: (cat: ThesisCategory) => void
}

function Legend({ categories, active, onToggle }: LegendProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((cat) => {
        const col = CAT_COLOR[cat]
        const on  = active.has(cat)
        return (
          <button
            key={cat}
            onClick={() => onToggle(cat)}
            className={cn(
              'text-[10px] px-2 py-1 rounded-full font-mono transition-all border',
              on ? col.badge + ' border-transparent' : 'bg-surface-800 text-surface-500 border-surface-700 opacity-50',
            )}
          >
            {cat}
          </button>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export function ThesisMapClient() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData]         = useState<ThesisMapResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [tooltip, setTooltip]   = useState<{ point: ThesisMapPoint; x: number; y: number } | null>(null)
  const [zoom, setZoom]         = useState(1)
  const [active, setActive]     = useState<Set<ThesisCategory>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/thesis/map')
      if (!res.ok) throw new Error(await res.text())
      const json: ThesisMapResponse = await res.json()
      setData(json)
      setActive(new Set(json.categories))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const maxVotes = data ? Math.max(...data.points.map((p) => p.total_votes), 1) : 1
  const visible  = data ? data.points.filter((p) => active.has(p.category)) : []

  function toggleCat(cat: ThesisCategory) {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function handleBubbleEnter(e: React.MouseEvent<SVGGElement>, p: ThesisMapPoint) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setTooltip({ point: p, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col pb-24">
      <TopBar />

      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-surface-900 border border-surface-800 text-surface-400 hover:text-white transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-white">Thesis Map</h1>
          <p className="text-xs text-surface-400">Consensus vs. urgency — {data?.total ?? '…'} active predictions</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="ml-auto p-2 rounded-xl bg-surface-900 border border-surface-800 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          aria-label="Refresh"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {/* Legend */}
      {data && (
        <div className="px-4 pb-3">
          <Legend categories={data.categories} active={active} onToggle={toggleCat} />
        </div>
      )}

      {/* Axis labels */}
      <div className="px-4 mb-1 flex justify-between text-[10px] text-surface-500 font-mono">
        <span className="flex items-center gap-1"><ThumbsDown className="h-3 w-3 text-against-400" /> Mostly Against</span>
        <span className="flex items-center gap-1">Mostly For <ThumbsUp className="h-3 w-3 text-for-400" /></span>
      </div>

      {/* SVG scatter plot */}
      <div
        ref={containerRef}
        className="relative mx-4 rounded-2xl bg-surface-900 border border-surface-800 overflow-hidden"
        style={{ minHeight: 320 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-surface-500" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-surface-400 text-sm">
            <Info className="h-5 w-5" />
            <span>{error}</span>
            <button onClick={fetchData} className="text-xs underline">Retry</button>
          </div>
        )}

        {data && (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.2s ease' }}
          >
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full"
              style={{ display: 'block' }}
            >
              {/* Grid lines */}
              {[0.25, 0.5, 0.75].map((frac) => (
                <line
                  key={frac}
                  x1={PAD + frac * (SVG_W - PAD * 2)}
                  y1={PAD}
                  x2={PAD + frac * (SVG_W - PAD * 2)}
                  y2={SVG_H - PAD}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              ))}
              {[0.25, 0.5, 0.75].map((frac) => (
                <line
                  key={frac}
                  x1={PAD}
                  y1={PAD + frac * (SVG_H - PAD * 2)}
                  x2={SVG_W - PAD}
                  y2={PAD + frac * (SVG_H - PAD * 2)}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
              ))}

              {/* Centre vertical (50% agree) */}
              <line
                x1={PAD + 0.5 * (SVG_W - PAD * 2)}
                y1={PAD}
                x2={PAD + 0.5 * (SVG_W - PAD * 2)}
                y2={SVG_H - PAD}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />

              {/* X axis labels */}
              <text x={PAD}     y={SVG_H - 14} fill="rgba(255,255,255,0.25)" fontSize={10} fontFamily="monospace">0%</text>
              <text x={PAD + (SVG_W - PAD * 2) * 0.5 - 12} y={SVG_H - 14} fill="rgba(255,255,255,0.25)" fontSize={10} fontFamily="monospace">50%</text>
              <text x={SVG_W - PAD - 20} y={SVG_H - 14} fill="rgba(255,255,255,0.25)" fontSize={10} fontFamily="monospace">100%</text>

              {/* Y axis labels */}
              <text x={4} y={PAD + 4}             fill="rgba(255,255,255,0.25)" fontSize={9} fontFamily="monospace" dominantBaseline="hanging">∞</text>
              <text x={4} y={SVG_H - PAD}         fill="rgba(255,255,255,0.25)" fontSize={9} fontFamily="monospace">0d</text>

              {/* Bubbles */}
              {visible.map((p) => {
                const { cx, cy } = pointToSVG(p, SVG_W, SVG_H, PAD)
                const r = bubbleRadius(p.total_votes, maxVotes)
                const col = CAT_COLOR[p.category]
                return (
                  <g
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => handleBubbleEnter(e, p)}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() => router.push(`/thesis/${p.id}`)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={col.fill}
                      stroke={col.stroke}
                      strokeWidth={1.5}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        {/* Tooltip */}
        <AnimatePresence>
          {tooltip && containerRef.current && (
            <Tooltip
              point={tooltip.point}
              x={tooltip.x}
              y={tooltip.y}
              containerW={containerRef.current.offsetWidth}
              containerH={containerRef.current.offsetHeight}
            />
          )}
        </AnimatePresence>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))}
            className="p-1.5 rounded-lg bg-surface-800/80 border border-surface-700 text-surface-400 hover:text-white transition-colors backdrop-blur-sm"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="p-1.5 rounded-lg bg-surface-800/80 border border-surface-700 text-surface-400 hover:text-white transition-colors backdrop-blur-sm"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Y axis label */}
      <div className="px-4 mt-1 flex items-center justify-between text-[10px] text-surface-500 font-mono">
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Y: urgency (days until resolution)</span>
        <span>{visible.length} shown</span>
      </div>

      <BottomNav />
    </div>
  )
}
