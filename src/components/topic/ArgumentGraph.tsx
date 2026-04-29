'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from 'd3-force'
import type { ArgumentGraphNode } from '@/app/api/topics/[id]/argument-graph/route'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  source_url: string | null
  author_username: string | null
  author_display_name: string | null
  created_at: string
  radius: number
  color: string
  glowColor: string
}

interface ArgumentGraphProps {
  nodes: ArgumentGraphNode[]
  selectedId: string | null
  onSelect: (node: ArgumentGraphNode | null) => void
  className?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FOR_COLOR = '#3b82f6'   // blue-500
const AGN_COLOR = '#ef4444'   // red-500
const FOR_GLOW  = 'rgba(59,130,246,0.5)'
const AGN_GLOW  = 'rgba(239,68,68,0.5)'
const SELECTED_RING = '#ffffff'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function radiusFromUpvotes(upvotes: number): number {
  return Math.max(7, Math.min(34, 7 + Math.sqrt(Math.max(upvotes, 0)) * 2.2))
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArgumentGraph({
  nodes: rawNodes,
  selectedId,
  onSelect,
  className,
}: ArgumentGraphProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef       = useRef<Simulation<GraphNode, never> | null>(null)
  const nodesRef     = useRef<GraphNode[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const draggingRef  = useRef<GraphNode | null>(null)
  const isPanRef     = useRef(false)
  const panStartRef  = useRef({ x: 0, y: 0 })
  const selectedIdRef = useRef(selectedId)

  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos]   = useState({ x: 0, y: 0 })

  // Keep selectedId ref in sync without restarting simulation
  useEffect(() => {
    selectedIdRef.current = selectedId
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ── Canvas draw ──────────────────────────────────────────────────────────
  const draw = useCallback(() => {
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

    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue

      const isSelected = node.id === selectedIdRef.current
      const isHover = hoverNode?.id === node.id

      // Glow for replies
      if (node.reply_count > 0) {
        const glowR = node.radius + 4 + Math.min(node.reply_count * 1.5, 12)
        const gradient = ctx.createRadialGradient(
          node.x, node.y, node.radius,
          node.x, node.y, glowR + 4,
        )
        gradient.addColorStop(0, node.side === 'blue' ? 'rgba(59,130,246,0.35)' : 'rgba(239,68,68,0.35)')
        gradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(node.x, node.y, glowR + 4, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2)
        ctx.strokeStyle = SELECTED_RING
        ctx.lineWidth = 2.5
        ctx.stroke()
      }

      // Hover ring
      if (isHover && !isSelected) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
        ctx.strokeStyle = hexToRgba(node.color, 0.8)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Fill node
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = isSelected
        ? node.color
        : hexToRgba(node.color, 0.75)
      ctx.fill()

      // Upvote label inside large nodes
      if (node.radius >= 14) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.font = `bold ${Math.round(node.radius * 0.55)}px JetBrains Mono, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(node.upvotes), node.x, node.y)
      }

      // Short preview below node
      if (node.radius >= 18 || isSelected || isHover) {
        const preview = truncate(node.content, 28)
        ctx.fillStyle = isSelected
          ? 'rgba(255,255,255,0.9)'
          : 'rgba(161,161,170,0.85)'
        ctx.font = '9px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(preview, node.x, node.y + node.radius + 5)
      }
    }

    ctx.restore()
  }, [hoverNode])

  // ── Simulation ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    const W = rect.width
    const H = rect.height

    const graphNodes: GraphNode[] = rawNodes.map((n) => ({
      id: n.id,
      side: n.side,
      content: n.content,
      upvotes: n.upvotes,
      reply_count: n.reply_count,
      source_url: n.source_url,
      author_username: n.author_username,
      author_display_name: n.author_display_name,
      created_at: n.created_at,
      radius: radiusFromUpvotes(n.upvotes),
      color: n.side === 'blue' ? FOR_COLOR : AGN_COLOR,
      glowColor: n.side === 'blue' ? FOR_GLOW : AGN_GLOW,
    }))
    nodesRef.current = graphNodes

    simRef.current?.stop()

    const sim = forceSimulation<GraphNode>(graphNodes)
      // Pull FOR arguments left, AGAINST right
      .force(
        'x',
        forceX<GraphNode>((d) => d.side === 'blue' ? W * 0.28 : W * 0.72).strength(0.18),
      )
      .force('y', forceY<GraphNode>(H * 0.5).strength(0.06))
      .force('center', forceCenter<GraphNode>(W / 2, H / 2).strength(0.01))
      .force('charge', forceManyBody<GraphNode>().strength(-60))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 6).strength(0.85))
      .alphaDecay(0.022)

    simRef.current = sim
    sim.on('tick', draw)

    return () => {
      sim.stop()
      simRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes])

  // ── Resize ───────────────────────────────────────────────────────────────
  useEffect(() => {
    function handleResize() {
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
        simRef.current
          .force('center', forceCenter<GraphNode>(rect.width / 2, rect.height / 2).strength(0.01))
          .force('x', forceX<GraphNode>((d) => d.side === 'blue' ? rect.width * 0.28 : rect.width * 0.72).strength(0.18))
          .alpha(0.4).restart()
      }
      draw()
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw])

  // ── Hit test ─────────────────────────────────────────────────────────────
  const findNode = useCallback((sx: number, sy: number): GraphNode | null => {
    const { x, y, k } = transformRef.current
    const wx = (sx - x) / k
    const wy = (sy - y) / k
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]
      if (n.x === undefined || n.y === undefined) continue
      const dx = n.x - wx
      const dy = n.y - wy
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) return n
    }
    return null
  }, [])

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
        draggingRef.current = node
        const { k } = transformRef.current
        node.fx = (x - transformRef.current.x) / k
        node.fy = (y - transformRef.current.y) / k
        if (simRef.current) simRef.current.alphaTarget(0.3).restart()
      } else {
        isPanRef.current = true
        panStartRef.current = { x: x - transformRef.current.x, y: y - transformRef.current.y }
      }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const { x, y } = getLocal(e)
      setMousePos({ x, y })
      if (draggingRef.current) {
        const node = draggingRef.current
        const { k } = transformRef.current
        node.fx = (x - transformRef.current.x) / k
        node.fy = (y - transformRef.current.y) / k
      } else if (isPanRef.current) {
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
      if (draggingRef.current) {
        const node = draggingRef.current
        const { x, y } = getLocal(e)
        const { k } = transformRef.current
        const wx = (x - transformRef.current.x) / k
        const wy = (y - transformRef.current.y) / k
        const dx = (node.x ?? 0) - wx
        const dy = (node.y ?? 0) - wy
        const isClick = dx * dx + dy * dy < 36
        node.fx = null
        node.fy = null
        draggingRef.current = null
        if (simRef.current) simRef.current.alphaTarget(0)
        if (isClick) {
          // Toggle selection
          onSelect(node.id === selectedIdRef.current ? null : node)
        }
      }
      isPanRef.current = false
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      const { x, y, k } = transformRef.current
      const newK = Math.max(0.2, Math.min(6, k * factor))
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
  }, [draw, findNode, onSelect])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn('relative w-full overflow-hidden bg-surface-100 rounded-xl border border-surface-300', className)}
    >
      <canvas ref={canvasRef} className="absolute inset-0 touch-none" />

      {/* Side labels */}
      <div
        className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none"
        aria-hidden="true"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-for-500 flex-shrink-0" />
        <span className="text-[10px] font-mono font-bold text-for-400 uppercase tracking-widest">For</span>
      </div>
      <div
        className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none"
        aria-hidden="true"
      >
        <span className="text-[10px] font-mono font-bold text-against-400 uppercase tracking-widest">Against</span>
        <span className="h-2.5 w-2.5 rounded-full bg-against-500 flex-shrink-0" />
      </div>

      {/* Divider hint */}
      <div
        className="absolute inset-y-0 left-1/2 w-px bg-surface-300/40 pointer-events-none"
        aria-hidden="true"
      />

      {/* Hover tooltip */}
      {hoverNode && hoverNode.id !== selectedIdRef.current && (
        <div
          className="absolute z-10 pointer-events-none max-w-[220px] px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 shadow-xl"
          style={{ left: mousePos.x + 14, top: Math.min(mousePos.y + 14, (containerRef.current?.getBoundingClientRect().height ?? 400) - 80) }}
        >
          <p className="text-xs font-mono text-white leading-snug line-clamp-3">
            {truncate(hoverNode.content, 80)}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono">
            <span className={hoverNode.side === 'blue' ? 'text-for-400' : 'text-against-400'}>
              {hoverNode.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-surface-500">
              {hoverNode.upvotes} votes · {hoverNode.reply_count} replies
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {rawNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-surface-500 font-mono text-sm">No arguments posted yet.</p>
        </div>
      )}
    </div>
  )
}
