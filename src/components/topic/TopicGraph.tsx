'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { cn } from '@/lib/utils/cn'
import {
  GRAPH_CATEGORY_COLORS,
  graphColorForCategory,
} from '@/lib/utils/graph-colors'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopicNode {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
}

export interface TopicEdge {
  source: string
  target: string
  weight: number
}

interface TopicGraphProps {
  topics: TopicNode[]
  edges: TopicEdge[]
  /** Highlight nodes whose statement contains this string (case-insensitive) */
  searchQuery?: string
  /** Category names (normalized lowercase) to hide */
  hiddenCategories?: Set<string>
  /** Status values to hide (e.g. 'proposed') */
  hiddenStatuses?: Set<string>
  className?: string
}

interface GraphNode extends SimulationNodeDatum {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  radius: number
  fillColor: string
  ringColor: string
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
}

// ─── Category colours ─────────────────────────────────────────────────────────

export const CATEGORY_COLORS = GRAPH_CATEGORY_COLORS
export const colorForCategory = graphColorForCategory

const DEFAULT_COLOR = '#71717a' // surface-500

// Status badge colours
const STATUS_COLORS: Record<string, string> = {
  proposed: '#52525b', // surface-600
  active:   '#3b82f6', // for-500
  voting:   '#8b5cf6', // purple
  law:      '#f59e0b', // gold
  failed:   '#ef4444', // against-500
}

// Vote ring colour: deep blue → contested (purple/grey) → deep red
function voteRingColor(bluePct: number): string {
  if (bluePct >= 65) return '#60a5fa'   // for-400 blue
  if (bluePct <= 35) return '#f87171'   // against-400 red
  return '#a78bfa'                       // contested purple
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function radiusFromVotes(votes: number): number {
  const base = Math.log10(Math.max(votes, 1) + 1)
  return Math.max(5, Math.min(24, 5 + base * 4.2))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TopicGraph({
  topics,
  edges,
  searchQuery = '',
  hiddenCategories = new Set<string>(),
  hiddenStatuses = new Set<string>(),
  className,
}: TopicGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const draggingNodeRef = useRef<GraphNode | null>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const searchQueryRef = useRef(searchQuery)
  const hiddenCategoriesRef = useRef(hiddenCategories)
  const hiddenStatusesRef = useRef(hiddenStatuses)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const router = useRouter()

  // Sync filter refs without restarting simulation
  useEffect(() => {
    searchQueryRef.current = searchQuery
    hiddenCategoriesRef.current = hiddenCategories
    hiddenStatusesRef.current = hiddenStatuses
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hiddenCategories, hiddenStatuses])

  // ── Simulation init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width || 800
    const height = rect.height || 600

    const nodes: GraphNode[] = topics.map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes,
      blue_pct: t.blue_pct,
      radius: radiusFromVotes(t.total_votes),
      fillColor: colorForCategory(t.category),
      ringColor: voteRingColor(t.blue_pct),
    }))
    nodesRef.current = nodes

    const nodeIds = new Set(nodes.map((n) => n.id))
    const graphLinks: GraphLink[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, weight: e.weight }))
    linksRef.current = graphLinks

    // Category cluster centres arranged in a circle
    const cats = Array.from(new Set(nodes.map((n) => (n.category ?? '').toLowerCase())))
    const clusterRadius = Math.min(width, height) * 0.28

    const clusterCenter = (category: string | null): { x: number; y: number } => {
      const key = (category ?? '').toLowerCase()
      const idx = cats.indexOf(key)
      if (idx === -1 || cats.length <= 1) return { x: width / 2, y: height / 2 }
      const angle = (idx / cats.length) * 2 * Math.PI - Math.PI / 2
      return {
        x: width / 2 + clusterRadius * Math.cos(angle),
        y: height / 2 + clusterRadius * Math.sin(angle),
      }
    }

    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(60)
          .strength(0.4),
      )
      .force('charge', forceManyBody<GraphNode>().strength(-150))
      .force('center', forceCenter<GraphNode>(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 6))
      .force('cluster-x', forceX<GraphNode>((d) => clusterCenter(d.category).x).strength(0.12))
      .force('cluster-y', forceY<GraphNode>((d) => clusterCenter(d.category).y).strength(0.12))
      .alphaDecay(0.025)

    simRef.current = simulation
    simulation.on('tick', () => { draw() })

    return () => {
      simulation.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, edges])

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (simRef.current) {
        simRef.current.force('center', forceCenter<GraphNode>(rect.width / 2, rect.height / 2).strength(0.05))
        simRef.current.alpha(0.4).restart()
      }
      draw()
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Draw ─────────────────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, rect.width, rect.height)

    ctx.save()
    const { x, y, k } = transformRef.current
    ctx.translate(x, y)
    ctx.scale(k, k)

    const query = searchQueryRef.current.toLowerCase().trim()
    const hiddenCats = hiddenCategoriesRef.current
    const hiddenStat = hiddenStatusesRef.current

    function isNodeVisible(n: GraphNode): boolean {
      const catKey = (n.category ?? '').toLowerCase()
      return !hiddenCats.has(catKey) && !hiddenStat.has(n.status)
    }

    // ── Links ────────────────────────────────────────────────────────────
    for (const link of linksRef.current) {
      const s = link.source as GraphNode
      const t = link.target as GraphNode
      if (s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) continue
      if (!isNodeVisible(s) || !isNodeVisible(t)) continue

      const sMatch = !query || s.statement.toLowerCase().includes(query)
      const tMatch = !query || t.statement.toLowerCase().includes(query)
      const linkAlpha = query && !sMatch && !tMatch ? 0.04 : 0.22

      // Gradient link coloured by source category
      const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y)
      grad.addColorStop(0, hexToRgba(s.fillColor, linkAlpha))
      grad.addColorStop(1, hexToRgba(t.fillColor, linkAlpha))

      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = grad
      ctx.lineWidth = Math.max(0.5, link.weight * 0.8)
      ctx.stroke()
    }

    // ── Nodes ────────────────────────────────────────────────────────────
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue
      if (!isNodeVisible(node)) continue

      const isMatch = !query || node.statement.toLowerCase().includes(query)
      const isDimmed = query.length > 0 && !isMatch
      const alpha = isDimmed ? 0.08 : 1.0

      // Search match glow
      if (isMatch && query.length > 0) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2)
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 12)
        glow.addColorStop(0, hexToRgba(node.fillColor, 0.45))
        glow.addColorStop(1, hexToRgba(node.fillColor, 0))
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Node fill (category colour, semi-transparent)
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(node.fillColor, isDimmed ? 0.08 : 0.25)
      ctx.fill()

      // Node border ring (vote-split colour)
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.strokeStyle = hexToRgba(node.ringColor, alpha * 0.85)
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Gold star for law topics
      if (node.status === 'law' && !isDimmed) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(245,158,11,0.55)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Status dot (small) at top-right of node
      const statusColor = STATUS_COLORS[node.status] ?? DEFAULT_COLOR
      if (!isDimmed) {
        ctx.beginPath()
        ctx.arc(node.x + node.radius * 0.7, node.y - node.radius * 0.7, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = statusColor
        ctx.fill()
      }

      // Label for larger nodes
      if ((node.radius > 10) && !isDimmed) {
        ctx.fillStyle = `rgba(212,212,216,${alpha})`
        ctx.font = '9px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const label = node.statement.length > 28 ? node.statement.slice(0, 26) + '…' : node.statement
        ctx.fillText(label, node.x, node.y + node.radius + 3)
      }
    }

    ctx.restore()
  }

  // ── Hit-test ─────────────────────────────────────────────────────────────
  function findNode(screenX: number, screenY: number): GraphNode | null {
    const { x, y, k } = transformRef.current
    const wx = (screenX - x) / k
    const wy = (screenY - y) / k
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]
      if (n.x === undefined || n.y === undefined) continue
      const dx = n.x - wx
      const dy = n.y - wy
      if (dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5)) return n
    }
    return null
  }

  // ── Pointer events ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const getLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = getLocal(e)
      const node = findNode(x, y)
      if (node) {
        draggingNodeRef.current = node
        const { k } = transformRef.current
        node.fx = (x - transformRef.current.x) / k
        node.fy = (y - transformRef.current.y) / k
        if (simRef.current) simRef.current.alphaTarget(0.3).restart()
      } else {
        isPanningRef.current = true
        panStartRef.current = { x: x - transformRef.current.x, y: y - transformRef.current.y }
      }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const { x, y } = getLocal(e)
      setMousePos({ x, y })
      if (draggingNodeRef.current) {
        const node = draggingNodeRef.current
        const { k } = transformRef.current
        node.fx = (x - transformRef.current.x) / k
        node.fy = (y - transformRef.current.y) / k
      } else if (isPanningRef.current) {
        transformRef.current.x = x - panStartRef.current.x
        transformRef.current.y = y - panStartRef.current.y
        draw()
      } else {
        const node = findNode(x, y)
        setHoverNode(node)
        canvas.style.cursor = node ? 'pointer' : 'grab'
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (draggingNodeRef.current) {
        const node = draggingNodeRef.current
        const { x, y } = getLocal(e)
        const { k } = transformRef.current
        const wx = (x - transformRef.current.x) / k
        const wy = (y - transformRef.current.y) / k
        const dx = (node.x ?? 0) - wx
        const dy = (node.y ?? 0) - wy
        const isClick = dx * dx + dy * dy < 25
        node.fx = null
        node.fy = null
        draggingNodeRef.current = null
        if (simRef.current) simRef.current.alphaTarget(0)
        if (isClick) router.push(`/topic/${node.id}`)
      }
      isPanningRef.current = false
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      const { x, y, k } = transformRef.current
      const newK = Math.max(0.12, Math.min(6, k * factor))
      transformRef.current.x = mx - ((mx - x) / k) * newK
      transformRef.current.y = my - ((my - y) / k) * newK
      transformRef.current.k = newK
      draw()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // ── Status label ─────────────────────────────────────────────────────────
  const statusLabel: Record<string, string> = {
    proposed: 'Proposed',
    active:   'Active',
    voting:   'Voting',
    law:      'LAW',
    failed:   'Failed',
  }

  const visibleCount = nodesRef.current.filter((n) => {
    const catKey = (n.category ?? '').toLowerCase()
    return !hiddenCategories.has(catKey) && !hiddenStatuses.has(n.status)
  }).length

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full bg-surface-100 border border-surface-300 rounded-xl overflow-hidden',
        'aspect-[4/3]',
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 cursor-grab touch-none" />

      {/* Stats badge */}
      <div className="absolute top-3 left-3 bg-surface-200/80 backdrop-blur border border-surface-300 rounded-lg px-3 py-2 pointer-events-none">
        <div className="text-[10px] uppercase tracking-widest text-surface-500 font-mono">
          {visibleCount} topics · {linksRef.current.length} connections
        </div>
        {searchQuery.trim() && (
          <div className="text-[10px] font-mono text-for-400 mt-0.5">
            Search: &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Vote split legend */}
      <div className="absolute bottom-3 left-3 bg-surface-200/80 backdrop-blur border border-surface-300 rounded-lg px-3 py-2 pointer-events-none">
        <div className="text-[9px] uppercase tracking-widest text-surface-500 font-mono mb-1">Ring = vote split</div>
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-1 text-[10px] font-mono text-for-400">
            <span className="inline-block h-2 w-2 rounded-full bg-[#60a5fa]" /> For
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-purple">
            <span className="inline-block h-2 w-2 rounded-full bg-[#a78bfa]" /> Contested
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-against-400">
            <span className="inline-block h-2 w-2 rounded-full bg-[#f87171]" /> Against
          </span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverNode && (
        <div
          className={cn(
            'absolute pointer-events-none z-10 px-3 py-2.5 rounded-lg',
            'bg-surface-200 border border-surface-300 text-xs font-mono text-white',
            'max-w-[260px] shadow-xl shadow-black/30',
          )}
          style={{
            left: mousePos.x + 14,
            top: mousePos.y + 14,
          }}
        >
          <div className="font-semibold leading-snug mb-1.5">{hoverNode.statement}</div>
          <div className="flex flex-col gap-1">
            {hoverNode.category && (
              <div
                className="text-[10px] flex items-center gap-1.5"
                style={{ color: colorForCategory(hoverNode.category) }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorForCategory(hoverNode.category) }}
                />
                {hoverNode.category}
              </div>
            )}
            <div className="flex items-center gap-3 text-[10px]">
              <span style={{ color: STATUS_COLORS[hoverNode.status] ?? '#71717a' }}>
                {statusLabel[hoverNode.status] ?? hoverNode.status}
              </span>
              <span className="text-surface-500">
                {hoverNode.total_votes.toLocaleString()} votes
              </span>
            </div>
            {hoverNode.total_votes > 0 && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 h-1 rounded-full bg-surface-400 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-for-500"
                    style={{ width: `${Math.round(hoverNode.blue_pct)}%` }}
                  />
                </div>
                <span className="text-for-400 text-[10px] tabular-nums">
                  {Math.round(hoverNode.blue_pct)}%
                </span>
                <span className="text-against-400 text-[10px] tabular-nums">
                  {Math.round(100 - hoverNode.blue_pct)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {topics.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <div className="text-surface-500 font-mono text-sm">No topics to graph yet.</div>
          <div className="text-surface-600 font-mono text-xs mt-1">
            Topics will appear once the community starts debating.
          </div>
        </div>
      )}
    </div>
  )
}
