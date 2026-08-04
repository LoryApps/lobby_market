'use client'

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
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { PublicPositionItem, PublicPositionsResponse } from '@/app/api/users/[username]/positions/route'

// ─── Category zone config ──────────────────────────────────────────────────────

interface CategoryZone {
  label: string
  color: string
  bg: string
  border: string
  ring: string
}

const ZONES: Record<string, CategoryZone> = {
  Politics:    { label: 'Politics',    color: '#60a5fa', bg: 'rgba(59,130,246,0.06)',   border: 'rgba(59,130,246,0.20)',   ring: '#3b82f6' },
  Economics:   { label: 'Economics',   color: '#f59e0b', bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.20)',  ring: '#f59e0b' },
  Technology:  { label: 'Technology',  color: '#a78bfa', bg: 'rgba(139,92,246,0.06)',  border: 'rgba(139,92,246,0.20)',  ring: '#8b5cf6' },
  Science:     { label: 'Science',     color: '#34d399', bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.20)',  ring: '#10b981' },
  Ethics:      { label: 'Ethics',      color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.20)', ring: '#ef4444' },
  Philosophy:  { label: 'Philosophy',  color: '#93c5fd', bg: 'rgba(147,197,253,0.06)', border: 'rgba(147,197,253,0.20)', ring: '#93c5fd' },
  Culture:     { label: 'Culture',     color: '#fcd34d', bg: 'rgba(252,211,77,0.06)',  border: 'rgba(252,211,77,0.20)',  ring: '#fbbf24' },
  Health:      { label: 'Health',      color: '#fca5a5', bg: 'rgba(252,165,165,0.06)', border: 'rgba(252,165,165,0.20)', ring: '#f87171' },
  Environment: { label: 'Environment', color: '#6ee7b7', bg: 'rgba(110,231,183,0.06)', border: 'rgba(110,231,183,0.20)', ring: '#34d399' },
  Education:   { label: 'Education',   color: '#c4b5fd', bg: 'rgba(196,181,253,0.06)', border: 'rgba(196,181,253,0.20)', ring: '#a78bfa' },
  Other:       { label: 'Other',       color: '#94a3b8', bg: 'rgba(148,163,184,0.05)', border: 'rgba(148,163,184,0.15)', ring: '#94a3b8' },
}

// ─── Grid layout ───────────────────────────────────────────────────────────────

const ZONE_GRID: [string, [number, number, number, number]][] = [
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

const COLS = 4
const ROWS = 3
const PADDING = 0.02
const ZONE_GAP = 0.012

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashId(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) + h + id.charCodeAt(i)) >>> 0
  }
  return h
}

function nodePos(id: string, index: number, total: number): { x: number; y: number } {
  const h = hashId(id)
  const goldenAngle = 2.39996
  const t = index / Math.max(total, 1)
  const r = 0.15 + t * 0.35
  const angle = index * goldenAngle + (h % 100) * 0.01
  return { x: 0.5 + r * Math.cos(angle), y: 0.5 + r * Math.sin(angle) }
}

function nodeRadius(totalVotes: number): number {
  if (totalVotes <= 0) return 6
  return Math.max(5, Math.min(16, 4 + Math.sqrt(totalVotes) * 0.5))
}

function shortLabel(statement: string, maxChars = 28): string {
  return statement.length <= maxChars ? statement : statement.slice(0, maxChars - 1) + '…'
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
  x: number
  y: number
  r: number
}

interface TooltipState {
  node: MapNode
  mx: number
  my: number
}

// ─── Layout computation ────────────────────────────────────────────────────────

function computeLayout(positions: PublicPositionItem[]): MapNode[] {
  const byCategory = new Map<string, PublicPositionItem[]>()
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function MapTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { node, mx, my } = tooltip
  const zone = ZONES[node.category] ?? ZONES.Other
  const isFor = node.side === 'blue'
  const forPct = Math.round(node.blue_pct)
  const isLaw = node.status === 'law'
  const isFailed = node.status === 'failed'

  return (
    <AnimatePresence>
      <motion.div
        key="tooltip"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        style={{ left: mx + 14, top: my - 10 }}
        className="pointer-events-none absolute z-50 w-56 rounded-xl border border-surface-300 bg-surface-100/95 backdrop-blur-sm shadow-2xl p-3"
      >
        <p className="text-xs font-semibold text-white leading-snug mb-2">
          {node.statement.length > 80 ? node.statement.slice(0, 79) + '…' : node.statement}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold',
            isFor ? 'bg-for-500/20 text-for-300' : 'bg-against-500/20 text-against-300',
          )}>
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {isLaw && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-gold/20 text-gold">
              LAW
            </span>
          )}
          {isFailed && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-surface-400/20 text-surface-400">
              FAILED
            </span>
          )}
          <span style={{ color: zone.color }} className="text-[10px] font-mono">
            {node.category}
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-surface-500 font-mono">
          <span>{forPct}% FOR · {100 - forPct}% AGAINST</span>
          <span>{node.total_votes.toLocaleString()} votes</span>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ nodes, displayName }: { nodes: MapNode[]; displayName: string }) {
  const forCount = nodes.filter((n) => n.side === 'blue').length
  const againstCount = nodes.filter((n) => n.side === 'red').length
  const lawCount = nodes.filter((n) => n.status === 'law').length
  const majorityCount = nodes.filter((n) => n.in_majority).length
  const majorityPct = nodes.length > 0 ? Math.round((majorityCount / nodes.length) * 100) : 0

  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-surface-500">
      <span>
        <span className="text-for-400 font-bold">{forCount}</span> FOR ·{' '}
        <span className="text-against-400 font-bold">{againstCount}</span> AGAINST
      </span>
      <span className="text-surface-600">·</span>
      <span>
        <span className="text-gold font-bold">{lawCount}</span> became law
      </span>
      <span className="text-surface-600">·</span>
      <span>
        <span className="text-emerald font-bold">{majorityPct}%</span> with majority
      </span>
    </div>
  )
}

// ─── Map canvas ────────────────────────────────────────────────────────────────

function MapCanvas({
  nodes,
  onNodeClick,
  onNodeHover,
  onNodeLeave,
}: {
  nodes: MapNode[]
  onNodeClick: (n: MapNode) => void
  onNodeHover: (n: MapNode, mx: number, my: number) => void
  onNodeLeave: () => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    ;(e.target as SVGElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
  }

  function onPointerUp() {
    dragging.current = false
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault()
    setZoom((z) => Math.max(0.5, Math.min(3, z - e.deltaY * 0.001)))
  }

  const w = 1000
  const h = 600
  const colW = (w * (1 - PADDING * 2)) / COLS
  const rowH = (h * (1 - PADDING * 2)) / ROWS

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
        {/* Zone backgrounds */}
        {ZONE_GRID.map(([cat, [cs, rs, cspan, rspan]]) => {
          const zone = ZONES[cat] ?? ZONES.Other
          const hasNodes = nodes.some((n) => n.category === cat)
          if (!hasNodes) return null
          const x = (PADDING + cs * (1 / COLS) + ZONE_GAP) * w
          const y = (PADDING + rs * (1 / ROWS) + ZONE_GAP) * h
          const zw = ((cspan / COLS) * (1 - PADDING * 2) - ZONE_GAP * 2) * w
          const zh = ((rspan / ROWS) * (1 - PADDING * 2) - ZONE_GAP * 2) * h
          return (
            <g key={cat}>
              <rect x={x} y={y} width={zw} height={zh} rx={8}
                fill={zone.bg} stroke={zone.border} strokeWidth={1} />
              <text x={x + 8} y={y + 16}
                fontSize={10} fill={zone.color} opacity={0.8}
                fontFamily="monospace" fontWeight={700} letterSpacing={1}>
                {cat.toUpperCase()}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const cx = node.x * w
          const cy = node.y * h
          const isFor = node.side === 'blue'
          const isLaw = node.status === 'law'
          const isFailed = node.status === 'failed'

          const fill = isFor ? '#3b82f6' : '#ef4444'
          const stroke = isLaw ? '#c9a84c' : isFailed ? '#374151' : isFor ? '#60a5fa' : '#f87171'
          const opacity = isFailed ? 0.35 : 1

          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={() => onNodeClick(node)}
              onMouseEnter={(e) => {
                const rect = svgRef.current!.getBoundingClientRect()
                onNodeHover(node, e.clientX - rect.left, e.clientY - rect.top)
              }}
              onMouseLeave={onNodeLeave}
              opacity={opacity}
            >
              {/* Gold glow for laws */}
              {isLaw && (
                <circle cx={cx} cy={cy} r={node.r + 5}
                  fill="rgba(201,168,76,0.15)" stroke="rgba(201,168,76,0.35)" strokeWidth={1} />
              )}
              <circle cx={cx} cy={cy} r={node.r}
                fill={fill} stroke={stroke} strokeWidth={isLaw ? 2 : 1.5}
                fillOpacity={0.85}
              />
              {/* Minority dot */}
              {!node.in_majority && (
                <circle cx={cx + node.r * 0.55} cy={cy - node.r * 0.55} r={node.r * 0.28}
                  fill="#f59e0b" />
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ─── Profile header ────────────────────────────────────────────────────────────

interface UserProfile {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total_votes: number
  clout: number
}

// ─── Main component ────────────────────────────────────────────────────────────

interface ProfileMapClientProps {
  username: string
}

export function ProfileMapClient({ username }: ProfileMapClientProps) {
  const router = useRouter()
  const [positions, setPositions] = useState<PublicPositionItem[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [zoom, setZoom] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/positions?limit=200&status=all`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Failed to load positions')
      const data: PublicPositionsResponse = await res.json()
      setPositions(data.positions)
      setProfile(data.profile)
    } catch {
      setError('Could not load civic map. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [username])

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

  const displayName = profile?.display_name || username

  return (
    <div className={cn('min-h-screen bg-surface-50', fullscreen && 'fixed inset-0 z-50 bg-surface-50')}>
      {!fullscreen && <TopBar />}

      <main className={cn('max-w-7xl mx-auto px-4 pt-6 pb-24 md:pb-8', fullscreen && 'h-screen flex flex-col pt-4')}>
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {!fullscreen && (
              <Link
                href={`/profile/${username}`}
                className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0 mt-0.5"
                aria-label={`Back to ${displayName}'s profile`}
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                {profile && (
                  <Avatar
                    src={profile.avatar_url}
                    fallback={displayName}
                    size="xs"
                  />
                )}
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <MapIcon className="h-5 w-5 text-for-400" aria-hidden="true" />
                  {displayName}&apos;s Civic Map
                </h1>
              </div>
              <p className="text-sm text-surface-400 mt-0.5">
                Every topic voted on — clustered by category, coloured by position.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Zoom controls */}
            <div className="hidden sm:flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-xl p-1">
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] font-mono text-surface-500 w-8 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
            </div>

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
            <StatsBar nodes={nodes} displayName={displayName} />
          </div>
        )}

        {/* Map canvas */}
        <div className={cn('rounded-xl overflow-hidden relative', fullscreen ? 'flex-1 min-h-0' : 'h-[560px] sm:h-[640px]')}>
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
                  className="text-xs font-mono text-for-400 hover:text-for-300 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="h-full flex items-center justify-center bg-surface-100 rounded-xl border border-surface-300">
              <EmptyState
                icon={MapIcon}
                title="No civic map yet"
                description={`${displayName} hasn't voted on any topics yet. Check back later.`}
              />
            </div>
          ) : (
            <div className="relative w-full h-full bg-surface-100 border border-surface-300 rounded-xl">
              <MapCanvas
                nodes={nodes}
                onNodeClick={handleNodeClick}
                onNodeHover={handleNodeHover}
                onNodeLeave={handleNodeLeave}
              />
              {tooltip && <MapTooltip tooltip={tooltip} />}
            </div>
          )}
        </div>

        {/* Legend */}
        {!loading && nodes.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono text-surface-500">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-for-500 opacity-85" />
              Voted FOR
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-against-500 opacity-85" />
              Voted AGAINST
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full bg-gold opacity-70 ring-1 ring-gold/50" />
              Became law
            </div>
            <div className="flex items-center gap-1.5">
              <Info className="h-3 w-3" aria-hidden="true" />
              Yellow dot = minority position · Size = vote volume · Drag to pan · Scroll to zoom
            </div>
          </div>
        )}

        {/* Link to positions list */}
        {!loading && nodes.length > 0 && (
          <div className="mt-4">
            <Link
              href={`/profile/${username}/positions`}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors underline underline-offset-2"
            >
              View full positions list →
            </Link>
          </div>
        )}
      </main>

      {!fullscreen && <BottomNav />}
    </div>
  )
}
