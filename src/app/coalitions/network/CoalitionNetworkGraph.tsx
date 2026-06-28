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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoalitionNode {
  id: string
  name: string
  tag: string
  coalition_influence: number
  member_count: number
  wins: number
  losses: number
  banner_color: string | null
  is_public: boolean
}

export interface TreatyEdge {
  id: string
  source: string
  target: string
  treaty_type: 'alliance' | 'non_aggression' | 'research_exchange'
  title: string
  expires_at: string | null
}

interface CoalitionNetworkGraphProps {
  coalitions: CoalitionNode[]
  treaties: TreatyEdge[]
  searchQuery?: string
  hiddenTypes?: Set<string>
  className?: string
}

// ─── Internal graph types ─────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string
  name: string
  tag: string
  coalition_influence: number
  member_count: number
  wins: number
  losses: number
  banner_color: string | null
  radius: number
  fillColor: string
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  treaty_type: 'alliance' | 'non_aggression' | 'research_exchange'
  title: string
}

// ─── Visual constants ─────────────────────────────────────────────────────────

const TREATY_COLORS: Record<string, string> = {
  alliance:          '#60a5fa', // for-400 blue
  non_aggression:    '#f59e0b', // gold
  research_exchange: '#8b5cf6', // purple
}

const TREATY_DASH: Record<string, number[]> = {
  alliance:          [],
  non_aggression:    [6, 3],
  research_exchange: [2, 4],
}

const DEFAULT_NODE_COLOR = '#24242e' // surface-300
const RING_COLOR = '#3f3f4a'         // surface-400

function radiusFromInfluence(influence: number): number {
  const base = Math.log10(Math.max(influence, 1) + 1)
  return Math.max(14, Math.min(40, 10 + base * 6))
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function nodeColor(bannerColor: string | null): string {
  if (bannerColor && /^#[0-9a-fA-F]{6}$/.test(bannerColor)) return bannerColor
  return DEFAULT_NODE_COLOR
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CoalitionNetworkGraph({
  coalitions,
  treaties,
  searchQuery = '',
  hiddenTypes = new Set<string>(),
  className,
}: CoalitionNetworkGraphProps) {
  const router = useRouter()
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

  // Build and run simulation
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const W = container.clientWidth
    const H = container.clientHeight
    canvas.width = W
    canvas.height = H

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Build node map
    const nodes: GraphNode[] = coalitions.map((c) => ({
      ...c,
      radius: radiusFromInfluence(c.coalition_influence),
      fillColor: nodeColor(c.banner_color),
    }))

    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    const links: GraphLink[] = treaties
      .filter((t) => !hiddenTypes.has(t.treaty_type))
      .filter((t) => nodeMap.has(t.source) && nodeMap.has(t.target))
      .map((t) => ({ ...t }))

    nodesRef.current = nodes
    linksRef.current = links

    // Set initial positions
    for (const n of nodes) {
      n.x = W / 2 + (Math.random() - 0.5) * 200
      n.y = H / 2 + (Math.random() - 0.5) * 200
    }

    const maxRadius = Math.max(...nodes.map((n) => n.radius), 14)

    const sim = forceSimulation<GraphNode>(nodes)
      .force('link', forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(120).strength(0.4))
      .force('charge', forceManyBody<GraphNode>().strength(-240))
      .force('center', forceCenter(W / 2, H / 2))
      .force('x', forceX(W / 2).strength(0.04))
      .force('y', forceY(H / 2).strength(0.04))
      .force('collide', forceCollide<GraphNode>((d) => d.radius + maxRadius * 0.3 + 10).strength(0.7))

    simRef.current = sim

    function draw() {
      if (!ctx || !canvas) return
      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.translate(transformRef.current.x, transformRef.current.y)
      ctx.scale(transformRef.current.k, transformRef.current.k)

      const sq = searchQuery.trim().toLowerCase()

      // Draw edges
      for (const link of linksRef.current) {
        if (hiddenTypes.has(link.treaty_type)) continue
        const src = link.source as GraphNode
        const tgt = link.target as GraphNode
        if (!src.x || !src.y || !tgt.x || !tgt.y) continue

        const col = TREATY_COLORS[link.treaty_type] ?? '#71717a'
        const dash = TREATY_DASH[link.treaty_type] ?? []

        ctx.beginPath()
        ctx.setLineDash(dash)
        ctx.moveTo(src.x, src.y)
        ctx.lineTo(tgt.x, tgt.y)
        ctx.strokeStyle = hexToRgba(col, 0.5)
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.setLineDash([])
      }

      // Draw nodes
      for (const node of nodesRef.current) {
        if (!node.x || !node.y) continue
        const r = node.radius
        const isMatch = sq ? node.name.toLowerCase().includes(sq) || node.tag.toLowerCase().includes(sq) : false
        const isDimmed = sq && !isMatch

        // Glow ring for matched / alliance hub nodes
        if (isMatch) {
          ctx.beginPath()
          ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2)
          ctx.fillStyle = hexToRgba('#60a5fa', 0.25)
          ctx.fill()
        }

        // Outer ring
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 2, 0, Math.PI * 2)
        ctx.fillStyle = isDimmed ? hexToRgba(RING_COLOR, 0.3) : RING_COLOR
        ctx.fill()

        // Main circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
        ctx.fillStyle = isDimmed ? hexToRgba(node.fillColor, 0.25) : node.fillColor
        ctx.fill()

        // Win-rate arc overlay
        const totalMatches = node.wins + node.losses
        if (totalMatches > 0) {
          const winFrac = node.wins / totalMatches
          ctx.beginPath()
          ctx.arc(node.x, node.y, r - 2, -Math.PI / 2, -Math.PI / 2 + winFrac * Math.PI * 2)
          ctx.strokeStyle = hexToRgba('#10b981', isDimmed ? 0.2 : 0.7)
          ctx.lineWidth = 3
          ctx.stroke()
        }

        // Tag label
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `bold ${Math.max(9, Math.min(14, r * 0.65))}px monospace`
        ctx.fillStyle = isDimmed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)'
        ctx.fillText(node.tag.slice(0, 4).toUpperCase(), node.x, node.y)
      }

      ctx.restore()
    }

    sim.on('tick', draw)
    draw()

    return () => {
      sim.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coalitions, treaties, hiddenTypes])

  // Redraw on search change (without restarting sim)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const sim = simRef.current
    if (sim) sim.alpha(0.1).restart()
  }, [searchQuery])

  // Interaction
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function getLocal(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    function findNode(x: number, y: number): GraphNode | null {
      const { k, x: tx, y: ty } = transformRef.current
      const wx = (x - tx) / k
      const wy = (y - ty) / k
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i]
        if (!n.x || !n.y) continue
        const dx = n.x - wx
        const dy = n.y - wy
        if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) return n
      }
      return null
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
        if (simRef.current) simRef.current.alpha(0.05).restart()
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
        if (isClick) router.push(`/coalitions/${node.id}`)
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
      if (simRef.current) simRef.current.alpha(0.05).restart()
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

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ro = new ResizeObserver(() => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      if (simRef.current) simRef.current.alpha(0.3).restart()
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  const activeTreaties = linksRef.current.filter((l) => !hiddenTypes.has(l.treaty_type))
  const visibleNodes = nodesRef.current.filter((n) => {
    // visible if they have at least one edge in non-hidden types OR we're showing all
    return activeTreaties.some(
      (l) =>
        (typeof l.source === 'string' ? l.source : l.source.id) === n.id ||
        (typeof l.target === 'string' ? l.target : l.target.id) === n.id,
    )
  })

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full bg-surface-100 border border-surface-300 rounded-xl overflow-hidden',
        className,
      )}
      style={{ minHeight: '480px' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 cursor-grab touch-none w-full h-full" />

      {/* Stats badge */}
      <div className="absolute top-3 left-3 bg-surface-200/80 backdrop-blur border border-surface-300 rounded-lg px-3 py-2 pointer-events-none">
        <div className="text-[10px] uppercase tracking-widest text-surface-500 font-mono">
          {visibleNodes.length} coalitions · {activeTreaties.length} treaties
        </div>
        {searchQuery.trim() && (
          <div className="text-[10px] font-mono text-for-400 mt-0.5">
            Search: &ldquo;{searchQuery}&rdquo;
          </div>
        )}
      </div>

      {/* Treaty type legend */}
      <div className="absolute bottom-3 left-3 bg-surface-200/80 backdrop-blur border border-surface-300 rounded-lg px-3 py-2.5 pointer-events-none">
        <div className="text-[9px] uppercase tracking-widest text-surface-500 font-mono mb-1.5">Treaty type</div>
        <div className="flex flex-col gap-1">
          {[
            { type: 'alliance', label: 'Alliance', dash: false },
            { type: 'non_aggression', label: 'Non-Aggression', dash: true },
            { type: 'research_exchange', label: 'Research', dash: true },
          ].map(({ type, label, dash }) => (
            <span key={type} className="flex items-center gap-2 text-[10px] font-mono" style={{ color: TREATY_COLORS[type] }}>
              <svg width="20" height="6" className="flex-shrink-0">
                <line
                  x1="0" y1="3" x2="20" y2="3"
                  stroke={TREATY_COLORS[type]}
                  strokeWidth="2"
                  strokeDasharray={dash ? '5 3' : undefined}
                />
              </svg>
              {label}
            </span>
          ))}
          <span className="flex items-center gap-2 text-[10px] font-mono text-emerald mt-0.5">
            <svg width="20" height="6" className="flex-shrink-0">
              <line x1="0" y1="3" x2="20" y2="3" stroke="#10b981" strokeWidth="3" />
            </svg>
            Win-rate arc
          </span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoverNode && (
        <div
          className={cn(
            'absolute pointer-events-none z-10 px-3 py-2.5 rounded-lg',
            'bg-surface-200 border border-surface-300 text-xs font-mono text-white',
            'max-w-[240px] shadow-xl shadow-black/30',
          )}
          style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}
        >
          <div className="font-semibold leading-snug mb-1">{hoverNode.name}</div>
          <div className="text-[10px] text-surface-500 mb-1.5">[{hoverNode.tag}]</div>
          <div className="flex flex-col gap-1 text-[10px]">
            <span className="text-for-400">
              {Math.round(hoverNode.coalition_influence).toLocaleString()} influence
            </span>
            <span className="text-surface-600">
              {hoverNode.member_count} member{hoverNode.member_count !== 1 ? 's' : ''}
            </span>
            {(hoverNode.wins + hoverNode.losses) > 0 && (
              <span className="text-emerald">
                {hoverNode.wins}W–{hoverNode.losses}L ·{' '}
                {Math.round((hoverNode.wins / (hoverNode.wins + hoverNode.losses)) * 100)}% wins
              </span>
            )}
          </div>
          <div className="mt-1.5 text-[9px] text-surface-600">Click to open →</div>
        </div>
      )}

      {/* Empty state */}
      {coalitions.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <div className="text-surface-500 font-mono text-sm">No active treaties yet.</div>
          <div className="text-surface-600 font-mono text-xs mt-1">
            Coalitions will appear here once they establish diplomatic agreements.
          </div>
        </div>
      )}
    </div>
  )
}
