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
import { graphColorForCategory } from '@/lib/utils/graph-colors'
import { cn } from '@/lib/utils/cn'
import type { ThesisNetworkNode, ThesisNetworkEdge } from '@/app/api/thesis/network/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string
  statement: string
  category: string
  status: string
  agree_count: number
  disagree_count: number
  total_votes: number
  agree_ratio: number
  author_username: string
  radius: number
  color: string
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  type: 'topic' | 'author' | 'category'
  weight: number
}

interface ThesisGraphProps {
  nodes: ThesisNetworkNode[]
  edges: ThesisNetworkEdge[]
  searchQuery?: string
  hiddenCategories?: Set<string>
  edgeFilter?: 'all' | 'topic' | 'author' | 'category'
  className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function statusColor(status: string): string {
  switch (status) {
    case 'vindicated': return '#f59e0b'
    case 'refuted':    return '#f87171'
    case 'expired':    return '#71717a'
    default:           return ''
  }
}

function radiusFromVotes(total: number): number {
  const base = Math.log10(Math.max(total, 1) + 1)
  return Math.max(5, Math.min(28, 5 + base * 4.5))
}

function edgeColor(type: 'topic' | 'author' | 'category'): string {
  switch (type) {
    case 'topic':    return 'rgba(96,165,250,0.5)'   // blue — same topic
    case 'author':   return 'rgba(52,211,153,0.35)'  // emerald — same author
    case 'category': return 'rgba(113,113,122,0.2)'  // surface — same category
  }
}

function edgeWidth(type: 'topic' | 'author' | 'category'): number {
  switch (type) {
    case 'topic':    return 2
    case 'author':   return 1.5
    case 'category': return 0.75
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ThesisGraph({
  nodes,
  edges,
  searchQuery = '',
  hiddenCategories = new Set<string>(),
  edgeFilter = 'all',
  className,
}: ThesisGraphProps) {
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
  const edgeFilterRef = useRef(edgeFilter)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const router = useRouter()

  // Sync filter refs without restarting the simulation
  useEffect(() => {
    searchQueryRef.current = searchQuery
    hiddenCategoriesRef.current = hiddenCategories
    edgeFilterRef.current = edgeFilter
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hiddenCategories, edgeFilter])

  // ── Simulation init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    const graphNodes: GraphNode[] = nodes.map((n) => {
      const baseColor = graphColorForCategory(n.category)
      const sColor = statusColor(n.status)
      return {
        id: n.id,
        statement: n.statement,
        category: n.category,
        status: n.status,
        agree_count: n.agree_count,
        disagree_count: n.disagree_count,
        total_votes: n.total_votes,
        agree_ratio: n.agree_ratio,
        author_username: n.author_username,
        radius: radiusFromVotes(n.total_votes),
        color: sColor || baseColor,
      }
    })
    nodesRef.current = graphNodes

    const nodeIds = new Set(graphNodes.map((n) => n.id))
    const graphLinks: GraphLink[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type, weight: e.weight }))
    linksRef.current = graphLinks

    // Cluster by category
    const cats = Array.from(new Set(graphNodes.map((n) => n.category.toLowerCase())))
    const clusterRadius = Math.min(width, height) * 0.3

    const clusterCenter = (category: string): { x: number; y: number } => {
      const key = category.toLowerCase()
      const idx = cats.indexOf(key)
      if (idx === -1 || cats.length <= 1) return { x: width / 2, y: height / 2 }
      const angle = (idx / cats.length) * 2 * Math.PI - Math.PI / 2
      return {
        x: width / 2 + clusterRadius * Math.cos(angle),
        y: height / 2 + clusterRadius * Math.sin(angle),
      }
    }

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance((l) => {
            const link = l as GraphLink & { type?: string }
            switch (link.type) {
              case 'topic': return 50
              case 'author': return 80
              default: return 120
            }
          })
          .strength((l) => {
            const link = l as GraphLink & { weight?: number }
            return 0.1 + (link.weight ?? 1) * 0.08
          }),
      )
      .force('charge', forceManyBody<GraphNode>().strength(-200))
      .force('center', forceCenter<GraphNode>(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 6))
      .force(
        'cluster-x',
        forceX<GraphNode>((d) => clusterCenter(d.category).x).strength(0.12),
      )
      .force(
        'cluster-y',
        forceY<GraphNode>((d) => clusterCenter(d.category).y).strength(0.12),
      )
      .alphaDecay(0.022)

    simRef.current = simulation
    simulation.on('tick', () => { draw() })

    return () => {
      simulation.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

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
    const eFilter = edgeFilterRef.current

    // Build a fast node-by-id map
    const nodeMap = new Map<string, GraphNode>()
    for (const n of nodesRef.current) nodeMap.set(n.id, n)

    // ── Links ────────────────────────────────────────────────────────────
    for (const link of linksRef.current) {
      if (eFilter !== 'all' && link.type !== eFilter) continue

      const s = link.source as GraphNode
      const t = link.target as GraphNode
      if (s.x === undefined || s.y === undefined || t.x === undefined || t.y === undefined) continue

      const sCat = s.category.toLowerCase()
      const tCat = t.category.toLowerCase()
      if (hidden.has(sCat) || hidden.has(tCat)) continue

      const sMatch = !query || s.statement.toLowerCase().includes(query)
      const tMatch = !query || t.statement.toLowerCase().includes(query)
      if (query && !sMatch && !tMatch) continue

      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = edgeColor(link.type)
      ctx.lineWidth = edgeWidth(link.type)
      ctx.stroke()
    }

    // ── Nodes ────────────────────────────────────────────────────────────
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue

      const catKey = node.category.toLowerCase()
      const isHidden = hidden.has(catKey)
      const isMatch = !query || node.statement.toLowerCase().includes(query)
      const isDimmed = isHidden || (query.length > 0 && !isMatch)
      const alpha = isDimmed ? 0.1 : 1.0

      // Glow for search matches
      if (isMatch && query.length > 0 && !isHidden) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 7, 0, Math.PI * 2)
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 11)
        glow.addColorStop(0, hexToRgba(node.color, 0.5))
        glow.addColorStop(1, hexToRgba(node.color, 0))
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Vindicated / refuted ring
      if ((node.status === 'vindicated' || node.status === 'refuted') && !isDimmed) {
        const ringColor = node.status === 'vindicated' ? 'rgba(245,158,11,0.6)' : 'rgba(248,113,113,0.4)'
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
        ctx.strokeStyle = ringColor
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Node circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(node.color, 0.85 * alpha)
      ctx.fill()

      // Agree-ratio arc (mini progress ring inside)
      if (node.total_votes > 0 && !isDimmed) {
        const startAngle = -Math.PI / 2
        const endAngle = startAngle + node.agree_ratio * 2 * Math.PI
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius - 2, startAngle, endAngle)
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Label
      if (node.radius > 10 && !isDimmed) {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`
        ctx.font = `bold ${Math.min(11, node.radius * 0.7)}px JetBrains Mono, monospace`
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

    let clickCandidate: GraphNode | null = null

    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = getLocal(e)
      const node = findNode(x, y)
      if (node) {
        draggingNodeRef.current = node
        clickCandidate = node
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
        clickCandidate = null
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
        node.fx = null
        node.fy = null
        draggingNodeRef.current = null
        if (simRef.current) simRef.current.alphaTarget(0)
        if (clickCandidate && clickCandidate.id === node.id) {
          router.push(`/thesis/${node.id}`)
        }
        clickCandidate = null
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
      const newK = Math.max(0.15, Math.min(6, k * factor))
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
        className,
      )}
    >
      <canvas ref={canvasRef} className="absolute inset-0 cursor-grab touch-none" />

      {/* Stats badge */}
      <div className="absolute top-3 left-3 bg-surface-200/80 backdrop-blur border border-surface-300 rounded-lg px-3 py-2 pointer-events-none">
        <div className="text-[10px] uppercase tracking-widest text-surface-500 font-mono">
          {nodes.length} theses · {edges.length} links
        </div>
        {searchQuery.trim() && (
          <div className="text-[10px] font-mono text-for-400 mt-0.5">
            &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-surface-200/80 backdrop-blur border border-surface-300 rounded-lg px-3 py-2 pointer-events-none">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-for-400">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: edgeColor('topic') }} />
            same topic
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: edgeColor('author') }} />
            same author
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: edgeColor('category') }} />
            same category
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverNode && (
        <div
          className={cn(
            'absolute pointer-events-none z-10 px-3 py-2 rounded-lg',
            'bg-surface-200 border border-surface-300 text-xs font-mono text-white',
            'max-w-[260px] shadow-xl shadow-black/40',
          )}
          style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}
        >
          <div className="font-semibold leading-snug mb-1">{hoverNode.statement}</div>
          <div
            className="text-[10px] flex items-center gap-1.5 mb-1"
            style={{ color: graphColorForCategory(hoverNode.category) }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: graphColorForCategory(hoverNode.category) }}
            />
            {hoverNode.category} · {hoverNode.status}
          </div>
          <div className="text-[10px] text-surface-500 flex items-center gap-2">
            <span className="text-emerald">▲ {hoverNode.agree_count}</span>
            <span className="text-against-400">▼ {hoverNode.disagree_count}</span>
            <span>by @{hoverNode.author_username}</span>
          </div>
          <div className="text-[10px] text-surface-600 mt-1">Click to view thesis →</div>
        </div>
      )}
    </div>
  )
}
