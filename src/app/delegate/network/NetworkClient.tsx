'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
import { Users, ArrowLeft, Info } from 'lucide-react'
import type { NetworkNode, NetworkEdge } from '@/app/api/delegation/network/route'

// ─── Colours ──────────────────────────────────────────────────────────────────

const CURRENT_USER_COLOR = '#f59e0b' // gold
const HUB_COLOR          = '#818cf8' // indigo for users with many delegations
const DELEGATE_COLOR     = '#60a5fa' // blue for active delegates
const LEAF_COLOR         = '#52525b' // zinc for users who only delegate out
const EDGE_COLOR         = 'rgba(148,163,184,0.25)' // slate/25
const EDGE_ARROW_COLOR   = 'rgba(148,163,184,0.45)'

function nodeColor(n: GraphNode): string {
  if (n.is_current_user) return CURRENT_USER_COLOR
  if (n.received_count >= 5)  return HUB_COLOR
  if (n.received_count >= 1)  return DELEGATE_COLOR
  return LEAF_COLOR
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function nodeRadius(received: number, isCurrent: boolean): number {
  const base = isCurrent ? 14 : Math.max(8, Math.min(26, 8 + Math.log2(received + 1) * 4))
  return base
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends NetworkNode, SimulationNodeDatum {
  radius: number
  color: string
}

interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  id: string
  scope: 'global' | 'category' | 'topic'
}

// ─── Legend item ──────────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs text-surface-400">{label}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  totalDelegations: number
}

export function NetworkClient({ nodes: rawNodes, edges: rawEdges, totalDelegations }: Props) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphEdge> | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const draggingNodeRef = useRef<GraphNode | null>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number | null>(null)
  const pulseRef = useRef(0)
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [_tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null)

  // ── Build graph data ──────────────────────────────────────────────────────
  useEffect(() => {
    const graphNodes: GraphNode[] = rawNodes.map((n) => ({
      ...n,
      radius: nodeRadius(n.received_count, n.is_current_user),
      color: nodeColor({ ...n, radius: 0, color: '' }),
    }))
    nodesRef.current = graphNodes

    const nodeById = new Map(graphNodes.map((n) => [n.id, n]))
    const graphEdges: GraphEdge[] = rawEdges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        scope: e.scope,
      }))
    edgesRef.current = graphEdges

    return () => {
      if (simRef.current) {
        simRef.current.stop()
        simRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Animation loop ────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = canvas.width / dpr
    const cssH = canvas.height / dpr

    ctx.clearRect(0, 0, cssW, cssH)
    ctx.save()
    const { x, y, k } = transformRef.current
    ctx.translate(x, y)
    ctx.scale(k, k)

    const pulse = Math.sin(pulseRef.current)

    // ── Draw edges ──────────────────────────────────────────────────────────
    for (const edge of edgesRef.current) {
      const s = edge.source as GraphNode
      const t = edge.target as GraphNode
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue

      const dx = t.x - s.x
      const dy = t.y - s.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) continue

      const ux = dx / dist
      const uy = dy / dist

      // Draw line from edge of source to edge of target
      const sx = s.x + ux * s.radius
      const sy = s.y + uy * s.radius
      const tx = t.x - ux * (t.radius + 6)
      const ty = t.y - uy * (t.radius + 6)

      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(tx, ty)
      ctx.strokeStyle = EDGE_COLOR
      ctx.lineWidth = edge.scope === 'global' ? 1.5 : 1
      ctx.stroke()

      // Arrowhead
      const arrowSize = 5
      const angle = Math.atan2(dy, dx)
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(
        tx - arrowSize * Math.cos(angle - Math.PI / 6),
        ty - arrowSize * Math.sin(angle - Math.PI / 6),
      )
      ctx.lineTo(
        tx - arrowSize * Math.cos(angle + Math.PI / 6),
        ty - arrowSize * Math.sin(angle + Math.PI / 6),
      )
      ctx.closePath()
      ctx.fillStyle = EDGE_ARROW_COLOR
      ctx.fill()
    }

    // ── Draw nodes ──────────────────────────────────────────────────────────
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue
      const isHover = hoverNode?.id === node.id

      // Current user: pulsing gold ring
      if (node.is_current_user) {
        const haloR = node.radius + 8 + pulse * 4
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, haloR + 10)
        glow.addColorStop(0, hexToRgba(CURRENT_USER_COLOR, 0.5))
        glow.addColorStop(1, hexToRgba(CURRENT_USER_COLOR, 0))
        ctx.beginPath()
        ctx.arc(node.x, node.y, haloR + 10, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
        ctx.beginPath()
        ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2)
        ctx.strokeStyle = hexToRgba(CURRENT_USER_COLOR, 0.85)
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Hub glow for highly-trusted nodes
      if (!node.is_current_user && node.received_count >= 5) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2)
        ctx.strokeStyle = hexToRgba(HUB_COLOR, 0.3)
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Hover ring
      if (isHover) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Node fill
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(node.color, 0.9)
      ctx.fill()

      // Inner highlight
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius - 2, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Username label (only for nodes with ≥1 received delegation or current user)
      if (node.is_current_user || node.received_count >= 1) {
        const label = node.display_name || node.username
        const fontSize = Math.max(9, Math.min(12, node.radius))
        ctx.font = `${fontSize}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const textY = node.y + node.radius + 3

        // Text shadow for readability
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        ctx.fillText(label, node.x + 0.5, textY + 0.5)
        ctx.fillStyle = 'rgba(255,255,255,0.85)'
        ctx.fillText(label, node.x, textY)
      }
    }

    ctx.restore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverNode])

  useEffect(() => {
    let running = true
    function loop() {
      if (!running) return
      pulseRef.current += 0.04
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  // ── Simulation init ───────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const rect = container.getBoundingClientRect()
    const width = rect.width || 800
    const height = rect.height || 600

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const simulation = forceSimulation<GraphNode>(nodesRef.current)
      .force(
        'link',
        forceLink<GraphNode, GraphEdge>(edgesRef.current)
          .id((d) => d.id)
          .distance(80)
          .strength(0.4),
      )
      .force('charge', forceManyBody<GraphNode>().strength(-180))
      .force('center', forceCenter<GraphNode>(width / 2, height / 2).strength(0.08))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 10))
      .alphaDecay(0.018)

    simRef.current = simulation

    return () => {
      simulation.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes, rawEdges])

  // ── Resize ────────────────────────────────────────────────────────────────
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
        simRef.current.force('center', forceCenter<GraphNode>(rect.width / 2, rect.height / 2).strength(0.08))
        simRef.current.alpha(0.3).restart()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ── Pointer helpers ───────────────────────────────────────────────────────
  function canvasToSim(clientX: number, clientY: number) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const { x, y, k } = transformRef.current
    return {
      x: (clientX - rect.left - x) / k,
      y: (clientY - rect.top - y) / k,
    }
  }

  function findNode(sx: number, sy: number): GraphNode | null {
    for (const n of nodesRef.current) {
      if (n.x == null || n.y == null) continue
      const dx = n.x - sx
      const dy = n.y - sy
      if (Math.sqrt(dx * dx + dy * dy) <= n.radius + 4) return n
    }
    return null
  }

  // ── Mouse events ──────────────────────────────────────────────────────────
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    setMousePos({ x: e.clientX, y: e.clientY })
    const { x: sx, y: sy } = canvasToSim(e.clientX, e.clientY)
    const found = findNode(sx, sy)
    setHoverNode(found)

    if (draggingNodeRef.current) {
      draggingNodeRef.current.x = sx
      draggingNodeRef.current.y = sy
      draggingNodeRef.current.fx = sx
      draggingNodeRef.current.fy = sy
      simRef.current?.alpha(0.1).restart()
    } else if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      transformRef.current.x += dx
      transformRef.current.y += dy
      panStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x: sx, y: sy } = canvasToSim(e.clientX, e.clientY)
    const found = findNode(sx, sy)
    if (found) {
      draggingNodeRef.current = found
      found.fx = found.x
      found.fy = found.y
    } else {
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (draggingNodeRef.current) {
      // If no significant drag, treat as click → navigate to profile
      const { x: sx, y: sy } = canvasToSim(e.clientX, e.clientY)
      const dx = (draggingNodeRef.current.fx ?? draggingNodeRef.current.x ?? 0) - sx
      const dy = (draggingNodeRef.current.fy ?? draggingNodeRef.current.y ?? 0) - sy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 5) {
        router.push(`/profile/${draggingNodeRef.current.username}`)
      } else {
        // Unpin after drag
        draggingNodeRef.current.fx = null
        draggingNodeRef.current.fy = null
      }
      draggingNodeRef.current = null
    }
    isPanningRef.current = false
  }

  function handleMouseLeave() {
    draggingNodeRef.current = null
    isPanningRef.current = false
    setHoverNode(null)
    setTooltip(null)
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const { x, y, k } = transformRef.current
    const delta = -e.deltaY * 0.001
    const newK = Math.max(0.2, Math.min(4, k * (1 + delta)))
    const ratio = newK / k
    transformRef.current = {
      x: mouseX - ratio * (mouseX - x),
      y: mouseY - ratio * (mouseY - y),
      k: newK,
    }
  }

  // Touch events
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null)
  const lastPinchRef = useRef<number | null>(null)

  function handleTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    if (e.touches.length === 1) {
      const t = e.touches[0]
      lastTouchRef.current = { x: t.clientX, y: t.clientY }
      const { x: sx, y: sy } = canvasToSim(t.clientX, t.clientY)
      const found = findNode(sx, sy)
      if (found) {
        draggingNodeRef.current = found
        found.fx = found.x
        found.fy = found.y
      } else {
        isPanningRef.current = true
        panStartRef.current = { x: t.clientX, y: t.clientY }
      }
    } else if (e.touches.length === 2) {
      draggingNodeRef.current = null
      isPanningRef.current = false
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastPinchRef.current = Math.sqrt(dx * dx + dy * dy)
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (e.touches.length === 1) {
      const t = e.touches[0]
      const { x: sx, y: sy } = canvasToSim(t.clientX, t.clientY)
      if (draggingNodeRef.current) {
        draggingNodeRef.current.x = sx
        draggingNodeRef.current.y = sy
        draggingNodeRef.current.fx = sx
        draggingNodeRef.current.fy = sy
        simRef.current?.alpha(0.1).restart()
      } else if (isPanningRef.current && lastTouchRef.current) {
        const dx = t.clientX - lastTouchRef.current.x
        const dy = t.clientY - lastTouchRef.current.y
        transformRef.current.x += dx
        transformRef.current.y += dy
        lastTouchRef.current = { x: t.clientX, y: t.clientY }
      }
    } else if (e.touches.length === 2 && lastPinchRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const ratio = dist / lastPinchRef.current
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const mx = cx - rect.left
      const my = cy - rect.top
      const { x, y, k } = transformRef.current
      const newK = Math.max(0.2, Math.min(4, k * ratio))
      const r = newK / k
      transformRef.current = { x: mx - r * (mx - x), y: my - r * (my - y), k: newK }
      lastPinchRef.current = dist
    }
  }

  function handleTouchEnd() {
    draggingNodeRef.current = null
    isPanningRef.current = false
    lastPinchRef.current = null
  }

  const isEmpty = rawNodes.length === 0

  return (
    <div className="flex flex-col h-screen bg-surface-50 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-surface-300 bg-surface-100">
        <button
          onClick={() => router.push('/delegate')}
          className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
          aria-label="Back to delegation hub"
        >
          <ArrowLeft className="h-4 w-4 text-surface-400" />
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex-shrink-0">
            <Users className="h-4 w-4 text-for-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-surface-50 leading-none">Delegation Network</h1>
            <p className="text-xs text-surface-400 mt-0.5">
              {rawNodes.length} citizens · {totalDelegations} active delegations
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <LegendDot color={CURRENT_USER_COLOR} label="You" />
          <LegendDot color={HUB_COLOR} label="Hub (5+)" />
          <LegendDot color={DELEGATE_COLOR} label="Delegate" />
          <LegendDot color={LEAF_COLOR} label="Delegator" />
        </div>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-200 border border-surface-300">
            <Users className="h-7 w-7 text-surface-400" />
          </div>
          <div className="text-center">
            <h2 className="text-base font-semibold text-surface-100">No delegations yet</h2>
            <p className="text-sm text-surface-400 mt-1 max-w-sm">
              The network grows as citizens delegate their voting power. Be the first to trust a fellow citizen.
            </p>
          </div>
          <button
            onClick={() => router.push('/delegate')}
            className="px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-medium transition-colors"
          >
            Set up a delegation
          </button>
        </div>
      ) : (
        /* Graph canvas */
        <div className="relative flex-1 overflow-hidden" ref={containerRef}>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 cursor-grab active:cursor-grabbing touch-none"
            style={{ cursor: hoverNode ? 'pointer' : undefined }}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Tooltip */}
          {hoverNode && (
            <div
              className="pointer-events-none absolute z-10 bg-surface-800/95 border border-surface-600 rounded-lg px-3 py-2 shadow-xl text-xs max-w-[200px]"
              style={{
                left: Math.min(mousePos.x + 14, (containerRef.current?.offsetWidth ?? 300) - 210),
                top: Math.max(mousePos.y - 50, 0),
              }}
            >
              <p className="font-semibold text-surface-50 truncate">
                {hoverNode.display_name || hoverNode.username}
              </p>
              <p className="text-surface-400">@{hoverNode.username}</p>
              <div className="flex gap-3 mt-1.5">
                <span className="text-for-400">{hoverNode.received_count} trusted by</span>
                <span className="text-surface-400">{hoverNode.given_count} delegating</span>
              </div>
              {hoverNode.clout > 0 && (
                <p className="text-gold-400 mt-0.5">{hoverNode.clout.toLocaleString()} clout</p>
              )}
              <p className="text-surface-500 mt-1 italic">Click to view profile</p>
            </div>
          )}

          {/* Usage hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-surface-900/80 backdrop-blur-sm border border-surface-700 rounded-full px-3 py-1.5">
            <Info className="h-3 w-3 text-surface-500 flex-shrink-0" />
            <span className="text-xs text-surface-400">Drag to pan · Scroll to zoom · Click node to view profile</span>
          </div>
        </div>
      )}
    </div>
  )
}
