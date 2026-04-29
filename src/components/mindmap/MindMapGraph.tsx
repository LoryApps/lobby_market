'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import type { MindMapNode, MindMapEdge, MindMapNodeType } from '@/app/api/me/mindmap/route'

// ─── Visual config ─────────────────────────────────────────────────────────────

const NODE_COLORS: Record<MindMapNodeType, { fill: string; ring: string }> = {
  topic:    { fill: '#1d2535', ring: '#3b82f6' },   // blue ring (for)
  law:      { fill: '#1d2535', ring: '#f59e0b' },   // gold ring
  argument: { fill: '#1d2535', ring: '#8b5cf6' },   // purple
  journal:  { fill: '#1d2535', ring: '#f59e0b' },   // gold
}

const VOTE_RING: Record<string, string> = {
  blue: '#60a5fa',    // for-400
  red:  '#f87171',    // against-400
}

const EDGE_COLORS: Record<string, string> = {
  argued:   '#8b5cf6',   // purple
  journaled: '#f59e0b',  // gold
}

const CATEGORY_COLORS: Record<string, string> = {
  economics:   '#f59e0b',
  politics:    '#60a5fa',
  technology:  '#8b5cf6',
  science:     '#10b981',
  ethics:      '#f87171',
  philosophy:  '#818cf8',
  culture:     '#fb923c',
  health:      '#f472b6',
  environment: '#4ade80',
  education:   '#22d3ee',
}

function catColor(category: string | null): string {
  if (!category) return '#71717a'
  return CATEGORY_COLORS[category.toLowerCase()] ?? '#71717a'
}

function nodeRadius(node: MindMapNode): number {
  if (node.type === 'argument') return 7
  if (node.type === 'journal') return 7
  if (node.type === 'law') return 14
  // topic: scale by votes
  const base = Math.log10(Math.max(node.totalVotes ?? 1, 1) + 1)
  return Math.max(8, Math.min(20, 8 + base * 2.5))
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── D3 node ──────────────────────────────────────────────────────────────────

interface GNode extends SimulationNodeDatum {
  id: string
  label: string
  type: MindMapNodeType
  category: string | null
  voteSide: 'blue' | 'red' | null
  argSide?: 'blue' | 'red'
  url: string
  totalVotes?: number
  upvotes?: number
  mood?: string | null
  radius: number
  fillColor: string
  ringColor: string
}

interface GLink extends SimulationLinkDatum<GNode> {
  source: string | GNode
  target: string | GNode
  type: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

export interface MindMapGraphProps {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  searchQuery?: string
  hiddenTypes?: Set<MindMapNodeType>
  className?: string
}

export function MindMapGraph({
  nodes,
  edges,
  searchQuery = '',
  hiddenTypes = new Set<MindMapNodeType>(),
  className,
}: MindMapGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GNode, GLink> | null>(null)
  const gNodesRef = useRef<GNode[]>([])
  const gLinksRef = useRef<GLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const draggingRef = useRef<GNode | null>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const searchRef = useRef(searchQuery)
  const hiddenRef = useRef(hiddenTypes)
  const [hoverNode, setHoverNode] = useState<GNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const router = useRouter()

  // Sync filter refs without restarting simulation
  useEffect(() => {
    searchRef.current = searchQuery
    hiddenRef.current = hiddenTypes
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hiddenTypes])

  // ── Build + run simulation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const W = rect.width || 800
    const H = rect.height || 600

    const gNodes: GNode[] = nodes.map((n) => {
      const r = nodeRadius(n)
      let ring: string
      if (n.type === 'topic' || n.type === 'law') {
        ring = n.voteSide ? VOTE_RING[n.voteSide] : (n.type === 'law' ? '#f59e0b' : catColor(n.category))
      } else if (n.type === 'argument') {
        ring = n.argSide === 'red' ? '#f87171' : '#8b5cf6'
      } else {
        ring = NODE_COLORS[n.type].ring
      }
      return {
        ...n,
        radius: r,
        fillColor: NODE_COLORS[n.type].fill,
        ringColor: ring,
      }
    })
    gNodesRef.current = gNodes

    const nodeIdSet = new Set(gNodes.map((n) => n.id))
    const gLinks: GLink[] = edges
      .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type }))
    gLinksRef.current = gLinks

    // Category cluster positions
    const catKeys = Array.from(
      new Set(gNodes.filter((n) => n.category).map((n) => n.category!.toLowerCase()))
    )
    const clusterR = Math.min(W, H) * 0.25

    function clusterXY(category: string | null): { x: number; y: number } {
      if (!category) return { x: W / 2, y: H / 2 }
      const idx = catKeys.indexOf(category.toLowerCase())
      if (idx === -1 || catKeys.length <= 1) return { x: W / 2, y: H / 2 }
      const angle = (idx / catKeys.length) * 2 * Math.PI - Math.PI / 2
      return {
        x: W / 2 + clusterR * Math.cos(angle),
        y: H / 2 + clusterR * Math.sin(angle),
      }
    }

    const sim = forceSimulation<GNode>(gNodes)
      .force(
        'link',
        forceLink<GNode, GLink>(gLinks)
          .id((d) => d.id)
          .distance((l) => {
            const t = (l as GLink).type
            return t === 'argued' ? 70 : t === 'journaled' ? 80 : 60
          })
          .strength(0.5),
      )
      .force('charge', forceManyBody<GNode>().strength(-120))
      .force('center', forceCenter<GNode>(W / 2, H / 2).strength(0.04))
      .force('collide', forceCollide<GNode>().radius((d) => d.radius + 8))
      .force(
        'cluster-x',
        forceX<GNode>((d) => (d.type === 'topic' || d.type === 'law' ? clusterXY(d.category).x : W / 2)).strength(0.1),
      )
      .force(
        'cluster-y',
        forceY<GNode>((d) => (d.type === 'topic' || d.type === 'law' ? clusterXY(d.category).y : H / 2)).strength(0.1),
      )
      .alphaDecay(0.025)

    simRef.current = sim
    sim.on('tick', () => draw())

    // Initial draw
    draw()

    return () => {
      sim.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  // ── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(() => {
      const c = canvasRef.current
      const cont = containerRef.current
      if (!c || !cont) return
      c.width = cont.clientWidth
      c.height = cont.clientHeight
      draw()
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Draw ──────────────────────────────────────────────────────────────────
  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    const { x: tx, y: ty, k } = transformRef.current
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(k, k)

    const q = searchRef.current.toLowerCase()
    const hidden = hiddenRef.current
    const visibleNodes = gNodesRef.current.filter((n) => !hidden.has(n.type))
    const visibleIds = new Set(visibleNodes.map((n) => n.id))

    // Draw edges
    for (const link of gLinksRef.current) {
      const s = link.source as GNode
      const t = link.target as GNode
      if (!s.x || !t.x || !visibleIds.has(s.id) || !visibleIds.has(t.id)) continue

      const color = EDGE_COLORS[link.type] ?? '#52525b'
      ctx.save()
      ctx.strokeStyle = hexToRgba(color, 0.35)
      ctx.lineWidth = 1.2
      if (link.type === 'journaled') {
        ctx.setLineDash([4, 4])
      }
      ctx.beginPath()
      ctx.moveTo(s.x!, s.y!)
      ctx.lineTo(t.x!, t.y!)
      ctx.stroke()
      ctx.restore()
    }

    // Draw nodes
    for (const n of visibleNodes) {
      if (n.x == null || n.y == null) continue

      const isMatch = q && n.label.toLowerCase().includes(q)
      const isDimmed = q && !isMatch
      const isHover = hoverNode?.id === n.id
      const alpha = isDimmed ? 0.2 : 1

      ctx.save()
      ctx.globalAlpha = alpha

      // Glow for hover / match / law
      if (isHover || isMatch || n.type === 'law') {
        const glowColor = n.type === 'law' ? '#f59e0b' : n.ringColor
        const glowRadius = n.radius + (isHover ? 12 : 8)
        const grd = ctx.createRadialGradient(n.x!, n.y!, n.radius * 0.5, n.x!, n.y!, glowRadius)
        grd.addColorStop(0, hexToRgba(glowColor, isHover ? 0.4 : 0.2))
        grd.addColorStop(1, hexToRgba(glowColor, 0))
        ctx.beginPath()
        ctx.arc(n.x!, n.y!, glowRadius, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()
      }

      // Node fill
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, n.radius, 0, Math.PI * 2)
      ctx.fillStyle = '#1a2235'
      ctx.fill()

      // Ring
      ctx.strokeStyle = n.ringColor
      ctx.lineWidth = n.type === 'law' ? 2.5 : 1.8
      ctx.stroke()

      // Inner fill tint
      const tintGrad = ctx.createRadialGradient(n.x!, n.y! - n.radius * 0.3, 0, n.x!, n.y!, n.radius)
      tintGrad.addColorStop(0, hexToRgba(n.ringColor, 0.18))
      tintGrad.addColorStop(1, hexToRgba(n.ringColor, 0.04))
      ctx.beginPath()
      ctx.arc(n.x!, n.y!, n.radius, 0, Math.PI * 2)
      ctx.fillStyle = tintGrad
      ctx.fill()

      // Category dot for topic/law nodes
      if ((n.type === 'topic' || n.type === 'law') && n.category) {
        ctx.beginPath()
        ctx.arc(n.x! + n.radius * 0.65, n.y! - n.radius * 0.65, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = catColor(n.category)
        ctx.fill()
      }

      // Labels for larger nodes or highlighted ones
      const showLabel = n.radius >= 12 || isHover || isMatch
      if (showLabel) {
        const maxLen = 28
        const labelText = n.label.length > maxLen ? n.label.slice(0, maxLen) + '…' : n.label
        ctx.font = `500 ${Math.max(9, n.radius * 0.55)}px 'JetBrains Mono', monospace`
        ctx.fillStyle = isMatch ? n.ringColor : 'rgba(255,255,255,0.8)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(labelText, n.x!, n.y! + n.radius + 10)
      }

      ctx.restore()
    }

    ctx.restore()
  }

  // ── Hit test ───────────────────────────────────────────────────────────────
  function hitTest(clientX: number, clientY: number): GNode | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { x: tx, y: ty, k } = transformRef.current
    const wx = (clientX - rect.left - tx) / k
    const wy = (clientY - rect.top - ty) / k

    const hidden = hiddenRef.current
    for (const n of [...gNodesRef.current].reverse()) {
      if (hidden.has(n.type) || n.x == null || n.y == null) continue
      const dx = wx - n.x!
      const dy = wy - n.y!
      if (dx * dx + dy * dy <= (n.radius + 4) ** 2) return n
    }
    return null
  }

  // ── Pointer events ─────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const node = hitTest(e.clientX, e.clientY)
    if (node) {
      draggingRef.current = node
      simRef.current?.alphaTarget(0.3).restart()
      node.fx = node.x
      node.fy = node.y
    } else {
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y }
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const node = hitTest(e.clientX, e.clientY)
    setHoverNode(node)
    if (node) {
      setMousePos({ x: e.clientX, y: e.clientY })
      ;(e.currentTarget as HTMLCanvasElement).style.cursor = 'pointer'
    } else {
      ;(e.currentTarget as HTMLCanvasElement).style.cursor = draggingRef.current ? 'grabbing' : isPanningRef.current ? 'grabbing' : 'default'
    }

    if (draggingRef.current) {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      const { x: tx, y: ty, k } = transformRef.current
      draggingRef.current.fx = (e.clientX - rect.left - tx) / k
      draggingRef.current.fy = (e.clientY - rect.top - ty) / k
    } else if (isPanningRef.current) {
      transformRef.current.x = e.clientX - panStartRef.current.x
      transformRef.current.y = e.clientY - panStartRef.current.y
      draw()
    }
  }

  function onPointerUp(_e: React.PointerEvent<HTMLCanvasElement>) {
    if (draggingRef.current) {
      draggingRef.current.fx = null
      draggingRef.current.fy = null
      simRef.current?.alphaTarget(0)
      draggingRef.current = null
    }
    isPanningRef.current = false
  }

  function onClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const node = hitTest(e.clientX, e.clientY)
    if (node) {
      router.push(node.url)
    }
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = e.deltaY < 0 ? 1.1 : 0.91
    const { x, y, k } = transformRef.current
    const newK = Math.max(0.3, Math.min(3, k * delta))
    transformRef.current = {
      x: mx - (mx - x) * (newK / k),
      y: my - (my - y) * (newK / k),
      k: newK,
    }
    draw()
  }

  // Render hovered node tooltip position (screen-space)
  const tooltipStyle = hoverNode
    ? { left: mousePos.x + 12, top: mousePos.y + 12 }
    : undefined

  return (
    <div ref={containerRef} className={cn('relative w-full h-full', className)}>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full block"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        onWheel={onWheel}
      />

      {/* Hover tooltip */}
      {hoverNode && tooltipStyle && (
        <div
          className="fixed z-50 pointer-events-none max-w-[220px] rounded-xl bg-surface-100 border border-surface-300/60 shadow-2xl p-3 text-xs font-mono"
          style={tooltipStyle}
        >
          <p className="text-white font-semibold leading-snug line-clamp-3">{hoverNode.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {hoverNode.category && (
              <span className="px-1.5 py-0.5 rounded bg-surface-200 text-surface-400">{hoverNode.category}</span>
            )}
            {hoverNode.type === 'topic' && hoverNode.status && (
              <span className="px-1.5 py-0.5 rounded bg-surface-200 text-surface-400 capitalize">{hoverNode.status}</span>
            )}
            {hoverNode.voteSide && (
              <span className={cn('px-1.5 py-0.5 rounded font-semibold', hoverNode.voteSide === 'blue' ? 'bg-for-500/20 text-for-300' : 'bg-against-500/20 text-against-300')}>
                {hoverNode.voteSide === 'blue' ? 'Voted For' : 'Voted Against'}
              </span>
            )}
            {hoverNode.type === 'argument' && hoverNode.upvotes !== undefined && (
              <span className="px-1.5 py-0.5 rounded bg-purple/20 text-purple">+{hoverNode.upvotes} upvotes</span>
            )}
            {hoverNode.type === 'journal' && hoverNode.mood && (
              <span className="px-1.5 py-0.5 rounded bg-gold/20 text-gold capitalize">{hoverNode.mood}</span>
            )}
          </div>
          <p className="mt-1 text-surface-500 text-[10px]">Click to open</p>
        </div>
      )}
    </div>
  )
}
