'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { graphColorForCategory } from '@/lib/utils/graph-colors'
import type { InfluenceNode, InfluenceEdge } from '@/app/api/influence/graph/route'

// ─── Internal node/link types (D3 simulation) ─────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string
  type: InfluenceNode['type']
  label: string
  category?: string | null
  status?: string
  totalVotes?: number
  forPct?: number
  userSide?: 'blue' | 'red'
  isCurrentUser?: boolean
  radius: number
  color: string
  borderColor: string
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  type: InfluenceEdge['type']
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function nodeColor(node: InfluenceNode): { fill: string; border: string } {
  if (node.isCurrentUser) return { fill: '#f59e0b', border: '#fcd34d' }
  if (node.type === 'category') {
    const c = graphColorForCategory(node.category ?? null)
    return { fill: c + '33', border: c }
  }
  // topic node — law wins over vote direction
  if (node.status === 'law') return { fill: '#f59e0b33', border: '#f59e0b' }
  if (node.userSide === 'blue') return { fill: '#3b82f633', border: '#3b82f6' }
  return { fill: '#ef444433', border: '#ef4444' }
}

function radiusForNode(node: InfluenceNode): number {
  if (node.isCurrentUser) return 28
  if (node.type === 'category') return 18
  const votes = node.totalVotes ?? 1
  const base = Math.log10(Math.max(votes, 1) + 1)
  return Math.max(5, Math.min(18, 4 + base * 3.5))
}

// ─── Component ────────────────────────────────────────────────────────────────

interface InfluenceGraphProps {
  nodes: InfluenceNode[]
  edges: InfluenceEdge[]
  className?: string
}

export function InfluenceGraph({ nodes: rawNodes, edges: rawEdges, className }: InfluenceGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const draggingNodeRef = useRef<GraphNode | null>(null)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const router = useRouter()

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const W = container.clientWidth
    const H = container.clientHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)

    // Build simulation nodes
    const gNodes: GraphNode[] = rawNodes.map((n) => {
      const { fill, border } = nodeColor(n)
      return {
        ...n,
        radius: radiusForNode(n),
        color: fill,
        borderColor: border,
      }
    })

    const nodeById = new Map(gNodes.map((n) => [n.id, n]))

    const gLinks: GraphLink[] = rawEdges
      .map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
      }))
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))

    nodesRef.current = gNodes
    linksRef.current = gLinks

    // Simulation
    const sim = forceSimulation<GraphNode, GraphLink>(gNodes)
      .force('link', forceLink<GraphNode, GraphLink>(gLinks)
        .id((d) => d.id)
        .distance((l) => {
          const t = l.type
          if (t === 'category_link') return 90
          return 55
        })
        .strength(0.5))
      .force('charge', forceManyBody<GraphNode>().strength(-180))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide<GraphNode>((d) => d.radius + 4))
      .alphaDecay(0.02)

    simRef.current = sim

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, W, H)

      const { x: tx, y: ty, k } = transformRef.current

      ctx.save()
      ctx.translate(tx, ty)
      ctx.scale(k, k)

      // Draw edges
      for (const link of linksRef.current) {
        const s = link.source as GraphNode
        const t = link.target as GraphNode
        if (!s.x || !t.x) continue

        ctx.beginPath()
        ctx.moveTo(s.x!, s.y!)
        ctx.lineTo(t.x!, t.y!)

        if (link.type === 'voted_for') {
          ctx.strokeStyle = 'rgba(59,130,246,0.25)'
        } else if (link.type === 'voted_against') {
          ctx.strokeStyle = 'rgba(239,68,68,0.25)'
        } else {
          ctx.strokeStyle = 'rgba(100,100,120,0.15)'
        }
        ctx.lineWidth = link.type === 'category_link' ? 0.8 : 1.2
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodesRef.current) {
        if (node.x === undefined || node.y === undefined) continue

        const isHovered = hoverNode?.id === node.id

        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * (isHovered ? 1.15 : 1), 0, Math.PI * 2)
        ctx.fillStyle = node.color
        ctx.fill()

        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius * (isHovered ? 1.15 : 1), 0, Math.PI * 2)
        ctx.strokeStyle = node.borderColor
        ctx.lineWidth = node.isCurrentUser ? 2.5 : isHovered ? 1.8 : 1.2
        ctx.stroke()

        // Label for user + category nodes (or hovered topic)
        if (node.isCurrentUser || node.type === 'category' || isHovered) {
          ctx.font = node.isCurrentUser
            ? 'bold 9px monospace'
            : '8px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'

          const labelY = node.y + node.radius + 10
          ctx.fillStyle = node.isCurrentUser
            ? '#fcd34d'
            : node.type === 'category'
            ? node.borderColor
            : '#e5e7eb'

          // Truncate long labels
          const maxLen = node.isCurrentUser ? 14 : node.type === 'category' ? 12 : 20
          const text = node.label.length > maxLen
            ? node.label.slice(0, maxLen - 1) + '…'
            : node.label

          ctx.fillText(text, node.x, labelY)
        }

        // Law star marker
        if (node.status === 'law') {
          ctx.font = '9px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = '#f59e0b'
          ctx.fillText('★', node.x, node.y)
        }
      }

      ctx.restore()
    }

    sim.on('tick', draw)
    // Run a few hundred ticks silently then draw
    sim.alpha(1).restart()

    // ── Interaction ────────────────────────────────────────────────────────────

    function canvasPoint(e: MouseEvent): { cx: number; cy: number } {
      const rect = canvas!.getBoundingClientRect()
      const { x, y, k } = transformRef.current
      const cx = (e.clientX - rect.left - x) / k
      const cy = (e.clientY - rect.top - y) / k
      return { cx, cy }
    }

    function findNode(cx: number, cy: number): GraphNode | null {
      for (const node of [...nodesRef.current].reverse()) {
        if (node.x === undefined || node.y === undefined) continue
        const dx = cx - node.x
        const dy = cy - node.y
        if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 4) return node
      }
      return null
    }

    function onMouseMove(e: MouseEvent) {
      const { cx, cy } = canvasPoint(e)
      const found = findNode(cx, cy)
      setHoverNode(found)
      setMousePos({ x: e.clientX, y: e.clientY })
      canvas!.style.cursor = found ? 'pointer' : isPanningRef.current ? 'grabbing' : 'grab'

      if (draggingNodeRef.current) {
        draggingNodeRef.current.x = cx
        draggingNodeRef.current.y = cy
        draggingNodeRef.current.fx = cx
        draggingNodeRef.current.fy = cy
        sim.alpha(0.3).restart()
        return
      }
      if (isPanningRef.current) {
        transformRef.current.x += e.clientX - panStartRef.current.x
        transformRef.current.y += e.clientY - panStartRef.current.y
        panStartRef.current = { x: e.clientX, y: e.clientY }
        draw()
      }
    }

    function onMouseDown(e: MouseEvent) {
      const { cx, cy } = canvasPoint(e)
      const node = findNode(cx, cy)
      if (node) {
        draggingNodeRef.current = node
        node.fx = node.x
        node.fy = node.y
      } else {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX, y: e.clientY }
        canvas!.style.cursor = 'grabbing'
      }
    }

    function onMouseUp() {
      if (draggingNodeRef.current) {
        draggingNodeRef.current.fx = null
        draggingNodeRef.current.fy = null
        draggingNodeRef.current = null
        sim.alpha(0.1).restart()
      }
      isPanningRef.current = false
      canvas!.style.cursor = 'grab'
    }

    function onClick(e: MouseEvent) {
      const { cx, cy } = canvasPoint(e)
      const node = findNode(cx, cy)
      if (!node) return
      if (node.type === 'topic') router.push(`/topic/${node.id}`)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = canvas!.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const { x, y, k } = transformRef.current
      const newK = Math.max(0.3, Math.min(3, k * delta))
      const scale = newK / k
      transformRef.current = {
        x: mouseX - scale * (mouseX - x),
        y: mouseY - scale * (mouseY - y),
        k: newK,
      }
      draw()
    }

    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('click', onClick)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      sim.stop()
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [rawNodes, rawEdges, router])

  // Redraw when hover changes
  useEffect(() => {
    const sim = simRef.current
    if (sim) sim.alpha(0.01).restart()
  }, [hoverNode])

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'grab', display: 'block' }}
        aria-label="Civic influence graph — your voting history as an interactive network"
      />

      {/* Hover tooltip */}
      {hoverNode && hoverNode.type === 'topic' && (
        <div
          className="fixed z-50 pointer-events-none max-w-[240px] rounded-xl bg-surface-100 border border-surface-300 shadow-xl px-3 py-2"
          style={{ left: mousePos.x + 14, top: mousePos.y - 10 }}
        >
          <p className="text-[11px] text-white font-medium leading-snug mb-1">
            {hoverNode.label}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {hoverNode.status === 'law' && (
              <span className="text-[10px] font-mono text-gold">★ LAW</span>
            )}
            {hoverNode.category && (
              <span className="text-[10px] font-mono text-surface-500">{hoverNode.category}</span>
            )}
            {hoverNode.userSide && (
              <span className={`text-[10px] font-mono ${hoverNode.userSide === 'blue' ? 'text-for-400' : 'text-against-400'}`}>
                {hoverNode.userSide === 'blue' ? 'You voted FOR' : 'You voted AGAINST'}
              </span>
            )}
          </div>
          {typeof hoverNode.forPct === 'number' && (
            <div className="mt-1.5 h-1 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full"
                style={{ width: `${hoverNode.forPct}%` }}
              />
            </div>
          )}
          {hoverNode.type === 'topic' && (
            <p className="text-[10px] text-surface-500 mt-1">Click to open topic</p>
          )}
        </div>
      )}

      {hoverNode && hoverNode.type === 'category' && (
        <div
          className="fixed z-50 pointer-events-none rounded-xl bg-surface-100 border border-surface-300 shadow-xl px-3 py-2"
          style={{ left: mousePos.x + 14, top: mousePos.y - 10 }}
        >
          <p className="text-[11px] font-mono font-semibold" style={{ color: hoverNode.borderColor }}>
            {hoverNode.label}
          </p>
          <p className="text-[10px] text-surface-500 mt-0.5">Category cluster</p>
        </div>
      )}
    </div>
  )
}
