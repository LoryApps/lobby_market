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
import type { Law, LawLink } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LawGraphProps {
  laws: Law[]
  links: LawLink[]
  currentLawId?: string
  /** Highlight nodes whose statement contains this string (case-insensitive) */
  searchQuery?: string
  /** Category names (normalized lowercase) to hide from the graph */
  hiddenCategories?: Set<string>
  className?: string
}

interface GraphNode extends SimulationNodeDatum {
  id: string
  statement: string
  category: string | null
  total_votes: number
  is_current: boolean
  radius: number
  color: string
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
}

// ─── Category colors (all 10 + fallback) ─────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  economics:   '#f59e0b', // gold
  politics:    '#60a5fa', // for-400
  technology:  '#8b5cf6', // purple
  science:     '#10b981', // emerald
  ethics:      '#f87171', // against-400
  philosophy:  '#818cf8', // indigo-400
  culture:     '#fb923c', // orange-400
  health:      '#f472b6', // pink-400
  environment: '#4ade80', // green-400
  education:   '#22d3ee', // cyan-400
}

const DEFAULT_COLOR = '#71717a' // surface-500

export function colorForCategory(category: string | null): string {
  if (!category) return DEFAULT_COLOR
  return CATEGORY_COLORS[category.toLowerCase()] ?? DEFAULT_COLOR
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
  return Math.max(5, Math.min(26, 5 + base * 4.5))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LawGraph({
  laws,
  links,
  currentLawId,
  searchQuery = '',
  hiddenCategories = new Set<string>(),
  className,
}: LawGraphProps) {
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
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const router = useRouter()

  // Sync search/filter refs without restarting the simulation
  useEffect(() => {
    searchQueryRef.current = searchQuery
    hiddenCategoriesRef.current = hiddenCategories
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hiddenCategories])

  // ── Simulation init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    // Build nodes
    const nodes: GraphNode[] = laws.map((law) => ({
      id: law.id,
      statement: law.statement,
      category: law.category,
      total_votes: law.total_votes ?? 0,
      is_current: law.id === currentLawId,
      radius: radiusFromVotes(law.total_votes ?? 0),
      color: law.id === currentLawId ? '#f59e0b' : colorForCategory(law.category),
    }))
    nodesRef.current = nodes

    // Build links
    const nodeIds = new Set(nodes.map((n) => n.id))
    const graphLinks: GraphLink[] = links
      .filter((l) => nodeIds.has(l.source_law_id) && nodeIds.has(l.target_law_id))
      .map((l) => ({ source: l.source_law_id, target: l.target_law_id }))
    linksRef.current = graphLinks

    // Compute category cluster centers (arranged in a circle)
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
          .distance(70)
          .strength(0.5),
      )
      .force('charge', forceManyBody<GraphNode>().strength(-180))
      .force('center', forceCenter<GraphNode>(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 5))
      .force(
        'cluster-x',
        forceX<GraphNode>((d) => clusterCenter(d.category).x).strength(0.15),
      )
      .force(
        'cluster-y',
        forceY<GraphNode>((d) => clusterCenter(d.category).y).strength(0.15),
      )
      .alphaDecay(0.025)

    simRef.current = simulation
    simulation.on('tick', () => { draw() })

    return () => {
      simulation.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laws, links, currentLawId])

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
    const hidden = hiddenCategoriesRef.current

    // ── Links ────────────────────────────────────────────────────────────
    for (const link of linksRef.current) {
      const s = link.source as GraphNode
      const t = link.target as GraphNode
      if (s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) continue

      const sCat = (s.category ?? '').toLowerCase()
      const tCat = (t.category ?? '').toLowerCase()
      const sHidden = hidden.has(sCat)
      const tHidden = hidden.has(tCat)
      if (sHidden || tHidden) continue

      const sMatch = !query || s.statement.toLowerCase().includes(query)
      const tMatch = !query || t.statement.toLowerCase().includes(query)
      const linkAlpha = query && !sMatch && !tMatch ? 0.05 : 0.35

      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = `rgba(63,63,74,${linkAlpha})`
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // ── Nodes ────────────────────────────────────────────────────────────
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue

      const catKey = (node.category ?? '').toLowerCase()
      const isHidden = hidden.has(catKey)
      const isMatch = !query || node.statement.toLowerCase().includes(query)
      const isDimmed = isHidden || (query.length > 0 && !isMatch)
      const alpha = isDimmed ? 0.1 : 1.0

      // Glow for search matches
      if (isMatch && query.length > 0 && !isHidden) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2)
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 10)
        glow.addColorStop(0, hexToRgba(node.color, 0.5))
        glow.addColorStop(1, hexToRgba(node.color, 0))
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Node circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(node.color, alpha)
      ctx.fill()

      // Current-node halo
      if (node.is_current) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(245,158,11,0.7)'
        ctx.lineWidth = 2.5
        ctx.stroke()
      }

      // Bright ring for exact search matches
      if (isMatch && query.length > 0 && !isHidden) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Label for notable nodes
      if ((node.radius > 10 || node.is_current) && !isDimmed) {
        ctx.fillStyle = `rgba(212,212,216,${alpha})`
        ctx.font = '10px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const label =
          node.statement.length > 26
            ? node.statement.slice(0, 24) + '…'
            : node.statement
        ctx.fillText(label, node.x, node.y + node.radius + 4)
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
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n
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
        if (isClick) router.push(`/law/${node.id}`)
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
      const newK = Math.max(0.15, Math.min(5, k * factor))
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
          {laws.length} Laws · {linksRef.current.length} links
        </div>
        {searchQuery.trim() && (
          <div className="text-[10px] font-mono text-for-400 mt-0.5">
            Searching: &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Hover tooltip */}
      {hoverNode && (
        <div
          className={cn(
            'absolute pointer-events-none z-10 px-3 py-2 rounded-lg',
            'bg-surface-200 border border-surface-300 text-xs font-mono text-white',
            'max-w-[240px] shadow-xl shadow-black/30',
          )}
          style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}
        >
          <div className="font-semibold leading-snug">{hoverNode.statement}</div>
          {hoverNode.category && (
            <div
              className="text-[10px] mt-1 flex items-center gap-1.5"
              style={{ color: colorForCategory(hoverNode.category) }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: colorForCategory(hoverNode.category) }}
              />
              {hoverNode.category} · {hoverNode.total_votes.toLocaleString()} votes
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {laws.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-surface-500 font-mono text-sm">
          No Laws to graph yet.
        </div>
      )}
    </div>
  )
}
