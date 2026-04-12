'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
import type { Law, LawLink } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface LawGraphProps {
  laws: Law[]
  links: LawLink[]
  currentLawId?: string
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

const categoryColors: Record<string, string> = {
  default: '#10b981',
  law: '#10b981',
  economy: '#f59e0b',
  society: '#8b5cf6',
  technology: '#3b82f6',
  ethics: '#ef4444',
}

function colorForCategory(category: string | null): string {
  if (!category) return categoryColors.default
  const key = category.toLowerCase()
  return categoryColors[key] ?? categoryColors.default
}

function radiusFromVotes(votes: number): number {
  // log scale so outliers don't dominate
  const base = Math.log10(Math.max(votes, 1) + 1)
  return Math.max(4, Math.min(24, 4 + base * 4))
}

export function LawGraph({
  laws,
  links,
  currentLawId,
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
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const router = useRouter()

  // Initialize simulation
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    // Map laws -> nodes
    const nodes: GraphNode[] = laws.map((law) => ({
      id: law.id,
      statement: law.statement,
      category: law.category,
      total_votes: law.total_votes ?? 0,
      is_current: law.id === currentLawId,
      radius: radiusFromVotes(law.total_votes ?? 0),
      color:
        law.id === currentLawId
          ? '#f59e0b'
          : colorForCategory(law.category),
    }))
    nodesRef.current = nodes

    // Map links (keep only those whose endpoints exist)
    const nodeIds = new Set(nodes.map((n) => n.id))
    const graphLinks: GraphLink[] = links
      .filter(
        (l) => nodeIds.has(l.source_law_id) && nodeIds.has(l.target_law_id)
      )
      .map((l) => ({
        source: l.source_law_id,
        target: l.target_law_id,
      }))
    linksRef.current = graphLinks

    const simulation = forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(80)
          .strength(0.6)
      )
      .force('charge', forceManyBody<GraphNode>().strength(-150))
      .force('center', forceCenter<GraphNode>(width / 2, height / 2))
      .force(
        'collide',
        forceCollide<GraphNode>().radius((d) => d.radius + 4)
      )
      .alphaDecay(0.02)

    simRef.current = simulation

    // Redraw each tick
    simulation.on('tick', () => {
      draw()
    })

    return () => {
      simulation.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laws, links, currentLawId])

  // Resize + draw helpers
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Re-center simulation
      if (simRef.current) {
        simRef.current.force(
          'center',
          forceCenter<GraphNode>(rect.width / 2, rect.height / 2)
        )
        simRef.current.alpha(0.5).restart()
      }
      draw()
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    // Draw links
    ctx.strokeStyle = 'rgba(63, 63, 74, 0.5)'
    ctx.lineWidth = 1
    for (const link of linksRef.current) {
      const s = link.source as GraphNode
      const t = link.target as GraphNode
      if (
        s.x === undefined ||
        s.y === undefined ||
        t.x === undefined ||
        t.y === undefined
      ) {
        continue
      }
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.stroke()
    }

    // Draw nodes
    for (const node of nodesRef.current) {
      if (node.x === undefined || node.y === undefined) continue
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = node.color
      ctx.fill()

      // Halo for the current node
      if (node.is_current) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)'
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Label for bigger nodes
      if (node.radius > 10 || node.is_current) {
        ctx.fillStyle = '#d4d4d8'
        ctx.font = '11px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const label =
          node.statement.length > 28
            ? node.statement.slice(0, 26) + '…'
            : node.statement
        ctx.fillText(label, node.x, node.y + node.radius + 4)
      }
    }

    ctx.restore()
  }

  // Hit testing helper (returns node under screen coords, accounting for transform)
  function findNode(screenX: number, screenY: number): GraphNode | null {
    const { x, y, k } = transformRef.current
    const worldX = (screenX - x) / k
    const worldY = (screenY - y) / k
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]
      if (n.x === undefined || n.y === undefined) continue
      const dx = n.x - worldX
      const dy = n.y - worldY
      if (dx * dx + dy * dy <= (n.radius + 2) * (n.radius + 2)) {
        return n
      }
    }
    return null
  }

  // Pointer handlers
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const getLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handlePointerDown = (e: PointerEvent) => {
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
        panStartRef.current = {
          x: x - transformRef.current.x,
          y: y - transformRef.current.y,
        }
      }
      canvas.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: PointerEvent) => {
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

    const handlePointerUp = (e: PointerEvent) => {
      if (draggingNodeRef.current) {
        const node = draggingNodeRef.current
        // Check if this was a click (barely moved)
        const { x, y } = getLocal(e)
        const { k } = transformRef.current
        const worldX = (x - transformRef.current.x) / k
        const worldY = (y - transformRef.current.y) / k
        const dx = (node.x ?? 0) - worldX
        const dy = (node.y ?? 0) - worldY
        const isClick = dx * dx + dy * dy < 25
        node.fx = null
        node.fy = null
        draggingNodeRef.current = null
        if (simRef.current) simRef.current.alphaTarget(0)
        if (isClick) {
          router.push(`/law/${node.id}`)
        }
      }
      isPanningRef.current = false
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        // ignore — pointer might already be released
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const { x, y, k } = transformRef.current
      const newK = Math.max(0.2, Math.min(4, k * factor))
      transformRef.current.x = mx - ((mx - x) / k) * newK
      transformRef.current.y = my - ((my - y) / k) * newK
      transformRef.current.k = newK
      draw()
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full bg-surface-100 border border-surface-300 rounded-xl overflow-hidden',
        'aspect-[4/3]',
        className
      )}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab touch-none"
      />

      {/* Legend */}
      <div className="absolute top-3 left-3 bg-surface-200/80 backdrop-blur border border-surface-300 rounded-lg p-3 pointer-events-none">
        <div className="text-[10px] uppercase tracking-widest text-surface-500 font-mono mb-2">
          {laws.length} Laws · {linksRef.current.length} links
        </div>
        <div className="space-y-1 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" />
            <span className="text-surface-600">Current</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald" />
            <span className="text-surface-600">Law</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverNode && (
        <div
          className={cn(
            'absolute pointer-events-none z-10 px-3 py-2 rounded-lg',
            'bg-surface-200 border border-surface-300 text-xs font-mono text-white',
            'max-w-[240px] shadow-xl shadow-black/30'
          )}
          style={{
            left: mousePos.x + 12,
            top: mousePos.y + 12,
          }}
        >
          <div className="font-semibold">{hoverNode.statement}</div>
          {hoverNode.category && (
            <div className="text-[10px] text-surface-500 mt-0.5">
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
