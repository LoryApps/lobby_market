'use client'

/**
 * /positions/map — Personal Civic Map
 *
 * An Obsidian-style graph view of everything the current user has voted on.
 * Topics are clustered by category in named zones. Each node is coloured
 * by the user's vote (blue = FOR, red = AGAINST) and sized by vote volume.
 * Law topics glow gold; failed topics are dimmed.
 *
 * Distinct from:
 *   /positions        — flat list of all voted positions
 *   /analytics/compass — category radar / deviation chart
 *   /topic/[id]/mindmap — per-topic argument graph
 *   /mindmap           — platform-wide topic mindmap (no personal overlay)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Info,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PositionItem, PositionsResponse } from '@/app/api/positions/route'

// ─── Category layout config ────────────────────────────────────────────────────

interface CategoryZone {
  label: string
  color: string        // text color
  bg: string           // fill
  border: string       // border
  ring: string         // glow ring
  gridArea: string     // CSS grid area name
}

const ZONES: Record<string, CategoryZone> = {
  Politics:    { label: 'Politics',    color: '#60a5fa', bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.20)',  ring: '#3b82f6', gridArea: 'pol'  },
  Economics:   { label: 'Economics',   color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.20)', ring: '#f59e0b', gridArea: 'eco'  },
  Technology:  { label: 'Technology',  color: '#a78bfa', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.20)', ring: '#8b5cf6', gridArea: 'tech' },
  Science:     { label: 'Science',     color: '#34d399', bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.20)', ring: '#10b981', gridArea: 'sci'  },
  Ethics:      { label: 'Ethics',      color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.20)', ring: '#ef4444', gridArea: 'eth' },
  Philosophy:  { label: 'Philosophy',  color: '#93c5fd', bg: 'rgba(147,197,253,0.06)', border: 'rgba(147,197,253,0.20)', ring: '#93c5fd', gridArea: 'phi' },
  Culture:     { label: 'Culture',     color: '#fcd34d', bg: 'rgba(252,211,77,0.06)',  border: 'rgba(252,211,77,0.20)',  ring: '#fbbf24', gridArea: 'cul' },
  Health:      { label: 'Health',      color: '#fca5a5', bg: 'rgba(252,165,165,0.06)', border: 'rgba(252,165,165,0.20)', ring: '#f87171', gridArea: 'hea' },
  Environment: { label: 'Environment', color: '#6ee7b7', bg: 'rgba(110,231,183,0.06)', border: 'rgba(110,231,183,0.20)', ring: '#34d399', gridArea: 'env' },
  Education:   { label: 'Education',   color: '#c4b5fd', bg: 'rgba(196,181,253,0.06)', border: 'rgba(196,181,253,0.20)', ring: '#a78bfa', gridArea: 'edu' },
  Other:       { label: 'Other',       color: '#94a3b8', bg: 'rgba(148,163,184,0.05)', border: 'rgba(148,163,184,0.15)', ring: '#94a3b8', gridArea: 'oth' },
}

// ─── Node position within a zone (deterministic from topic id) ────────────────

function hashId(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0
  }
  return h
}

interface NodePos { x: number; y: number } // 0–1 relative within zone

function nodePos(id: string, index: number, total: number): NodePos {
  const h = hashId(id)
  // Use golden angle spiral for nice distribution
  const goldenAngle = 2.39996 // radians
  const t = index / Math.max(total, 1)
  const r = 0.15 + t * 0.35      // 15–50% radius from zone centre
  const angle = index * goldenAngle + (h % 100) * 0.01
  return {
    x: 0.5 + r * Math.cos(angle),
    y: 0.5 + r * Math.sin(angle),
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MapNode {
  id: string
  statement: string
  category: string
  status: string
  blue_pct: number
  total_votes: number
  side: 'blue' | 'red'
  in_majority: boolean
  voted_at: string
  // layout
  x: number       // 0–1 relative to SVG canvas
  y: number
  r: number       // radius
}

interface TooltipState {
  node: MapNode
  mx: number
  my: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(statement: string, maxChars = 28): string {
  return statement.length <= maxChars ? statement : statement.slice(0, maxChars - 1) + '…'
}

function nodeRadius(totalVotes: number): number {
  if (totalVotes <= 0) return 6
  return Math.max(5, Math.min(16, 4 + Math.sqrt(totalVotes) * 0.5))
}

const ZONE_GRID: [string, [number, number, number, number]][] = [
  // [category, [col-start, row-start, col-span, row-span]] — 4-column grid
  ['Politics',    [0, 0, 1, 1]],
  ['Economics',   [1, 0, 1, 1]],
  ['Technology',  [2, 0, 1, 1]],
  ['Science',     [3, 0, 1, 1]],
  ['Ethics',      [0, 1, 1, 1]],
  ['Philosophy',  [1, 1, 1, 1]],
  ['Culture',     [2, 1, 1, 1]],
  ['Health',      [3, 1, 1, 1]],
  ['Environment', [0, 2, 1, 1]],
  ['Education',   [1, 2, 1, 1]],
  ['Other',       [2, 2, 2, 1]],
]

// ─── Layout computation ────────────────────────────────────────────────────────

const COLS = 4
const ROWS = 3
const PADDING = 0.02          // fraction of canvas
const ZONE_GAP = 0.012        // fraction gap between zones

function computeLayout(positions: PositionItem[]): MapNode[] {
  // Group by category
  const byCategory = new Map<string, PositionItem[]>()
  for (const p of positions) {
    const cat = p.topic.category ?? 'Other'
    const key = Object.keys(ZONES).includes(cat) ? cat : 'Other'
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(p)
  }

  const nodes: MapNode[] = []
  const canvasW = 1 - PADDING * 2
  const canvasH = 1 - PADDING * 2
  const colW = canvasW / COLS
  const rowH = canvasH / ROWS

  for (const [cat, [cs, rs]] of ZONE_GRID) {
    const items = byCategory.get(cat) ?? []
    if (items.length === 0) continue

    const zoneX0 = PADDING + cs * colW + ZONE_GAP
    const zoneY0 = PADDING + rs * rowH + ZONE_GAP
    const zoneW = colW - ZONE_GAP * 2
    const zoneH = rowH - ZONE_GAP * 2

    items.forEach((p, idx) => {
      const pos = nodePos(p.topic.id, idx, items.length)
      const r = nodeRadius(p.topic.total_votes)
      nodes.push({
        id: p.topic.id,
        statement: p.topic.statement,
        category: cat,
        status: p.topic.status,
        blue_pct: p.topic.blue_pct,
        total_votes: p.topic.total_votes,
        side: p.side,
        in_majority: p.in_majority,
        voted_at: p.voted_at,
        x: zoneX0 + pos.x * zoneW,
        y: zoneY0 + pos.y * zoneH,
        r,
      })
    })
  }

  return nodes
}

// ─── MapCanvas ─────────────────────────────────────────────────────────────────

function MapCanvas({
  nodes,
  onNodeClick,
  onNodeHover,
  onNodeLeave,
  tooltip,
}: {
  nodes: MapNode[]
  onNodeClick: (node: MapNode) => void
  onNodeHover: (node: MapNode, mx: number, my: number) => void
  onNodeLeave: () => void
  tooltip: TooltipState | null
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [vb, setVb] = useState({ x: 0, y: 0, w: 1200, h: 900 })
  const [panning, setPanning] = useState(false)
  const panStart = useRef<{ mx: number; my: number; vbx: number; vby: number } | null>(null)

  function zoom(factor: number) {
    setVb((prev) => {
      const newW = Math.max(300, Math.min(2400, prev.w * factor))
      const newH = Math.max(225, Math.min(1800, prev.h * factor))
      const cx = prev.x + prev.w / 2
      const cy = prev.y + prev.h / 2
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH }
    })
  }

  function resetView() {
    setVb({ x: 0, y: 0, w: 1200, h: 900 })
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    setPanning(true)
    panStart.current = { mx: e.clientX, my: e.clientY, vbx: vb.x, vby: vb.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!panning || !panStart.current || !svgRef.current) return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const scaleX = vb.w / rect.width
    const scaleY = vb.h / rect.height
    const dx = (e.clientX - panStart.current.mx) * scaleX
    const dy = (e.clientY - panStart.current.my) * scaleY
    setVb((prev) => ({ ...prev, x: panStart.current!.vbx - dx, y: panStart.current!.vby - dy }))
  }

  function onPointerUp() {
    setPanning(false)
    panStart.current = null
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    zoom(e.deltaY > 0 ? 1.12 : 0.89)
  }

  // SVG coordinates: 0–1200 x 0–900 (matching viewBox default)
  const W = 1200
  const H = 900

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className={cn(
          'w-full h-full bg-surface-50 rounded-xl border border-surface-300',
          panning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        aria-label="Civic positions map"
      >
        {/* Zone backgrounds */}
        {ZONE_GRID.map(([cat, [cs, rs, cspan, rspan]]) => {
          const zone = ZONES[cat] ?? ZONES.Other
          const x = (PADDING + cs * (1 / COLS) + ZONE_GAP) * W
          const y = (PADDING + rs * (1 / ROWS) + ZONE_GAP) * H
          const w = ((cspan / COLS) - ZONE_GAP * 2) * W
          const h = ((rspan / ROWS) - ZONE_GAP * 2) * H
          const hasNodes = nodes.some((n) => n.category === cat)
          if (!hasNodes) return null
          return (
            <g key={cat}>
              <rect
                x={x} y={y} width={w} height={h}
                rx={8}
                fill={zone.bg}
                stroke={zone.border}
                strokeWidth={1.5}
              />
              <text
                x={x + 10} y={y + 16}
                fontSize={11}
                fontFamily="ui-monospace,monospace"
                fill={zone.color}
                opacity={0.85}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {zone.label}
              </text>
            </g>
          )
        })}

        {/* Connection lines between same-category nodes (subtle) */}
        {/* Skipped for performance and cleanliness */}

        {/* Nodes */}
        {nodes.map((node) => {
          const cx = node.x * W
          const cy = node.y * H
          const isFor = node.side === 'blue'
          const isLaw = node.status === 'law'
          const isFailed = node.status === 'failed'
          const isActive = tooltip?.node.id === node.id
          const fillColor = isLaw
            ? 'rgba(245,158,11,0.20)'
            : isFailed
            ? 'rgba(148,163,184,0.10)'
            : isFor
            ? 'rgba(59,130,246,0.15)'
            : 'rgba(239,68,68,0.15)'

          const strokeColor = isLaw
            ? '#f59e0b'
            : isFailed
            ? '#475569'
            : isFor
            ? '#3b82f6'
            : '#ef4444'

          const r = isActive ? node.r + 3 : node.r

          return (
            <g
              key={node.id}
              onClick={(e) => { e.stopPropagation(); onNodeClick(node) }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect()
                if (rect) onNodeHover(node, e.clientX - rect.left, e.clientY - rect.top)
              }}
              onMouseLeave={onNodeLeave}
              style={{ cursor: 'pointer' }}
              aria-label={node.statement}
            >
              {/* Glow for law topics */}
              {isLaw && (
                <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.35} />
              )}
              {/* Hover ring */}
              {isActive && (
                <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={strokeColor} strokeWidth={1.5} opacity={0.5} />
              )}
              {/* Main node */}
              <circle
                cx={cx} cy={cy} r={r}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={isLaw ? 2 : 1.5}
                opacity={isFailed ? 0.45 : 1}
              />
              {/* Status dot center */}
              <circle
                cx={cx} cy={cy} r={Math.max(2, r * 0.3)}
                fill={strokeColor}
                opacity={isFailed ? 0.3 : 0.7}
              />
            </g>
          )
        })}

        {/* Labels for large nodes */}
        {nodes.filter((n) => n.r >= 10).map((node) => {
          const cx = node.x * W
          const cy = node.y * H
          const isFor = node.side === 'blue'
          const isLaw = node.status === 'law'
          const isFailed = node.status === 'failed'
          return (
            <text
              key={`label-${node.id}`}
              x={cx}
              y={cy + node.r + 9}
              textAnchor="middle"
              fontSize={8}
              fontFamily="ui-monospace,monospace"
              fill={isLaw ? '#f59e0b' : isFailed ? '#475569' : isFor ? '#93c5fd' : '#fca5a5'}
              opacity={0.85}
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {shortLabel(node.statement, 22)}
            </text>
          )
        })}
      </svg>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button
          onClick={() => zoom(0.8)}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200/90 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => zoom(1.25)}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200/90 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={resetView}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200/90 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
          aria-label="Reset view"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute z-20 max-w-[260px]"
            style={{
              left: Math.min(tooltip.mx + 12, window.innerWidth ? window.innerWidth - 280 : tooltip.mx + 12),
              top: tooltip.my - 60,
            }}
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 shadow-2xl shadow-black/60">
              <p className="text-xs font-medium text-white leading-snug mb-2">
                {tooltip.node.statement}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    tooltip.node.status === 'law'
                      ? 'law'
                      : tooltip.node.status === 'failed'
                      ? 'failed'
                      : tooltip.node.status === 'voting'
                      ? 'active'
                      : (tooltip.node.status as 'proposed' | 'active')
                  }
                  size="sm"
                >
                  {tooltip.node.status === 'law'
                    ? 'LAW'
                    : tooltip.node.status.charAt(0).toUpperCase() + tooltip.node.status.slice(1)}
                </Badge>
                <span
                  className={cn(
                    'text-[11px] font-mono font-semibold',
                    tooltip.node.side === 'blue' ? 'text-for-400' : 'text-against-400',
                  )}
                >
                  {tooltip.node.side === 'blue' ? 'FOR' : 'AGAINST'}
                </span>
                <span className="text-[10px] font-mono text-surface-500">
                  {Math.round(tooltip.node.blue_pct)}% consensus
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap text-[11px] font-mono">
      <span className="flex items-center gap-1.5 text-for-400">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-for-500 bg-for-500/15" />
        You voted FOR
      </span>
      <span className="flex items-center gap-1.5 text-against-400">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-against-500 bg-against-500/15" />
        You voted AGAINST
      </span>
      <span className="flex items-center gap-1.5 text-gold">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-gold bg-gold/15" />
        Became Law
      </span>
      <span className="flex items-center gap-1.5 text-surface-500">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-surface-500 bg-surface-500/15" />
        Failed
      </span>
      <span className="flex items-center gap-1.5 text-surface-500">
        <span className="inline-block h-3 w-3 rounded-full border-2 border-surface-400 bg-surface-400/10" style={{ minWidth: '16px', minHeight: '16px' }} />
        Larger = more votes
      </span>
    </div>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ nodes }: { nodes: MapNode[] }) {
  const total = nodes.length
  const forCount = nodes.filter((n) => n.side === 'blue').length
  const againstCount = nodes.filter((n) => n.side === 'red').length
  const lawCount = nodes.filter((n) => n.status === 'law').length
  const forLaws = nodes.filter((n) => n.status === 'law' && n.side === 'blue').length
  const forPct = total > 0 ? Math.round((forCount / total) * 100) : 50

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Positions', value: total.toLocaleString(), color: 'text-white' },
        { label: `FOR (${forPct}%)`, value: forCount.toLocaleString(), color: 'text-for-400' },
        { label: `AGAINST`, value: againstCount.toLocaleString(), color: 'text-against-400' },
        { label: `Laws Voted`, value: `${lawCount} (${forLaws} backed)`, color: 'text-gold' },
      ].map(({ label, value, color }) => (
        <div
          key={label}
          className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3"
        >
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">{label}</p>
          <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function MapClient() {
  const router = useRouter()
  const [positions, setPositions] = useState<PositionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/positions?limit=100&status=all', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load positions')
      const data: PositionsResponse = await res.json()
      setPositions(data.positions)
    } catch {
      setError('Could not load your positions. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const nodes = useMemo(() => computeLayout(positions), [positions])

  function handleNodeClick(node: MapNode) {
    router.push(`/topic/${node.id}`)
  }

  function handleNodeHover(node: MapNode, mx: number, my: number) {
    setTooltip({ node, mx, my })
  }

  function handleNodeLeave() {
    setTooltip(null)
  }

  return (
    <div className={cn('min-h-screen bg-surface-50', fullscreen && 'fixed inset-0 z-50 bg-surface-50')}>
      {!fullscreen && <TopBar />}

      <main className={cn('max-w-7xl mx-auto px-4 pt-6 pb-24 md:pb-8', fullscreen && 'h-screen flex flex-col pt-4')}>
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {!fullscreen && (
              <Link
                href="/positions"
                className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0 mt-0.5"
                aria-label="Back to positions"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-for-400" />
                My Civic Map
              </h1>
              <p className="text-sm text-surface-400 mt-0.5">
                Every topic you&apos;ve voted on — clustered by category, coloured by your position.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={() => setFullscreen((f) => !f)}
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && nodes.length > 0 && (
          <div className="mb-4">
            <StatsBar nodes={nodes} />
          </div>
        )}

        {/* Map canvas */}
        <div className={cn('rounded-xl overflow-hidden', fullscreen ? 'flex-1 min-h-0' : 'h-[560px] sm:h-[640px]')}>
          {loading ? (
            <div className="h-full flex items-center justify-center bg-surface-100 rounded-xl border border-surface-300">
              <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center bg-surface-100 rounded-xl border border-surface-300">
              <div className="text-center">
                <p className="text-sm text-surface-400 mb-3">{error}</p>
                <button
                  onClick={load}
                  className="px-4 py-2 rounded-xl bg-for-500/15 border border-for-500/30 text-for-400 text-xs font-mono hover:bg-for-500/25 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <EmptyState
              icon={MapIcon}
              title="No positions yet"
              description="Cast your first vote to see your civic map take shape."
              action={{ label: 'Browse topics', href: '/topics' }}
            />
          ) : (
            <MapCanvas
              nodes={nodes}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              onNodeLeave={handleNodeLeave}
              tooltip={tooltip}
            />
          )}
        </div>

        {/* Legend */}
        {!loading && nodes.length > 0 && (
          <div className="mt-4 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
            <Legend />
          </div>
        )}

        {/* Category breakdown */}
        {!loading && nodes.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {Object.entries(
              nodes.reduce<Record<string, { for: number; against: number }>>((acc, n) => {
                if (!acc[n.category]) acc[n.category] = { for: 0, against: 0 }
                if (n.side === 'blue') acc[n.category].for++
                else acc[n.category].against++
                return acc
              }, {}),
            )
              .sort(([, a], [, b]) => b.for + b.against - (a.for + a.against))
              .map(([cat, counts]) => {
                const zone = ZONES[cat] ?? ZONES.Other
                const total = counts.for + counts.against
                const forPct = Math.round((counts.for / total) * 100)
                return (
                  <div
                    key={cat}
                    className="rounded-xl p-3"
                    style={{
                      background: zone.bg,
                      border: `1px solid ${zone.border}`,
                    }}
                  >
                    <p className="text-[10px] font-mono uppercase tracking-wide mb-1.5" style={{ color: zone.color }}>
                      {cat}
                    </p>
                    <p className="text-lg font-bold font-mono text-white mb-1">{total}</p>
                    <div className="h-1 rounded-full bg-surface-300/40 overflow-hidden">
                      <div
                        className="h-full bg-for-500/70 rounded-l-full"
                        style={{ width: `${forPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] font-mono text-for-400">{counts.for} for</span>
                      <span className="text-[9px] font-mono text-against-400">{counts.against} against</span>
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* Tips */}
        {!loading && nodes.length > 0 && (
          <div className="mt-4 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-mono text-surface-500 space-y-0.5">
                <p><span className="text-surface-400">Hover</span> a node to see the topic. <span className="text-surface-400">Click</span> to open it. <span className="text-surface-400">Scroll</span> or use the +/− buttons to zoom. <span className="text-surface-400">Drag</span> to pan.</p>
                <p>Topics are grouped by policy category. Larger circles = more community votes on that topic.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {!fullscreen && <BottomNav />}
    </div>
  )
}
