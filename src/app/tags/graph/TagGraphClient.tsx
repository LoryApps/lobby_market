'use client'

/**
 * TagGraphClient — force-directed network of civic tags.
 *
 * Nodes  = tags (sized by topic count, coloured by activity level)
 * Edges  = tags that co-occur on the same topic
 *
 * Interactions:
 *  • Hover   → tooltip with tag stats
 *  • Click   → navigate to /tags/[tag]
 *  • Drag    → reposition node
 *  • Scroll  → zoom in/out
 *  • Pan     → click-and-drag on blank canvas
 *  • Search  → highlights matching nodes
 */

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { Check, Copy, Hash, Loader2, RotateCcw, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TagGraphNode, TagGraphEdge } from '@/app/api/tags/graph/route'

// ─── Color scheme ─────────────────────────────────────────────────────────────
// Gold = has established laws, Blue = active debates, Grey = mostly proposed

function nodeColor(n: TagGraphNode): string {
  if (n.law_count >= 2) return '#f59e0b'        // gold — multiple laws
  if (n.law_count === 1) return '#eab308'        // amber — one law
  if (n.active_count >= 3) return '#3b82f6'      // for-500 blue — very active
  if (n.active_count >= 1) return '#60a5fa'      // for-400 — some active debates
  return '#52525b'                               // surface-600 — mostly proposed
}

function nodeRingColor(n: TagGraphNode): string {
  if (n.law_count > 0) return '#fbbf24'          // gold ring for law tags
  if (n.active_count > 0) return '#93c5fd'       // blue ring for active tags
  return '#3f3f46'                               // surface-700
}

function radiusFromCount(count: number): number {
  const base = Math.log2(Math.max(count, 1) + 1)
  return Math.max(6, Math.min(28, 6 + base * 5))
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── Internal graph types ──────────────────────────────────────────────────────

interface GNode extends SimulationNodeDatum {
  tag: string
  topic_count: number
  law_count: number
  active_count: number
  total_votes: number
  radius: number
  fill: string
  ring: string
}

interface GLink extends SimulationLinkDatum<GNode> {
  source: string | GNode
  target: string | GNode
  weight: number
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  nodes: TagGraphNode[]
  edges: TagGraphEdge[]
  topicCount?: number
  className?: string
}

export function TagGraphClient({ nodes: rawNodes, edges: rawEdges, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GNode, GLink> | null>(null)
  const nodesRef = useRef<GNode[]>([])
  const linksRef = useRef<GLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const draggingNodeRef = useRef<GNode | null>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const searchRef = useRef('')

  const [hoverNode, setHoverNode] = useState<GNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  // ── Draw loop ────────────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    const { x: ox, y: oy, k } = transformRef.current
    const q = searchRef.current.toLowerCase()

    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.translate(ox, oy)
    ctx.scale(k, k)

    const nodes = nodesRef.current
    const links = linksRef.current

    // Draw edges
    for (const link of links) {
      const s = link.source as GNode
      const t = link.target as GNode
      if (!s.x || !t.x) continue

      const matchS = q && s.tag.includes(q)
      const matchT = q && t.tag.includes(q)
      const highlighted = !q || matchS || matchT

      ctx.beginPath()
      ctx.moveTo(s.x!, s.y!)
      ctx.lineTo(t.x!, t.y!)
      ctx.strokeStyle = highlighted
        ? hexToRgba(s.fill, link.weight >= 3 ? 0.35 : 0.2)
        : 'rgba(63,63,70,0.15)'
      ctx.lineWidth = Math.min(link.weight * 0.8, 3) / k
      ctx.stroke()
    }

    // Draw nodes
    for (const node of nodes) {
      if (!node.x) continue
      const match = !q || node.tag.includes(q)
      const alpha = q ? (match ? 1 : 0.15) : 1

      // Ring
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, node.radius + 2.5, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(node.ring, alpha * 0.6)
      ctx.fill()

      // Fill
      ctx.beginPath()
      ctx.arc(node.x!, node.y!, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(node.fill, alpha * 0.85)
      ctx.fill()

      // Label (only when zoomed in or large nodes)
      const scaledRadius = node.radius * k
      if (scaledRadius >= 10) {
        ctx.font = `${Math.max(8, Math.min(12, node.radius * 0.6))}px "JetBrains Mono", monospace`
        ctx.fillStyle = `rgba(255,255,255,${alpha * (match ? 0.9 : 0.5)})`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label = node.tag.length > 10 ? node.tag.slice(0, 9) + '…' : node.tag
        ctx.fillText(label, node.x!, node.y!)
      }
    }

    ctx.restore()
  }, [])

  // ── Init simulation ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width || 800
    const height = rect.height || 600

    const gNodes: GNode[] = rawNodes.map((n) => ({
      ...n,
      radius: radiusFromCount(n.topic_count),
      fill: nodeColor(n),
      ring: nodeRingColor(n),
    }))
    nodesRef.current = gNodes

    const nodeSet = new Set(gNodes.map((n) => n.tag))
    const gLinks: GLink[] = rawEdges
      .filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target))
      .map((e) => ({ ...e }))
    linksRef.current = gLinks

    const sim = forceSimulation<GNode>(gNodes)
      .force(
        'link',
        forceLink<GNode, GLink>(gLinks)
          .id((d) => d.tag)
          .distance((l) => 80 - Math.min((l as GLink).weight * 4, 30))
          .strength(0.3),
      )
      .force('charge', forceManyBody<GNode>().strength(-120))
      .force('center', forceCenter<GNode>(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<GNode>().radius((d) => d.radius + 8))
      .alphaDecay(0.025)

    sim.on('tick', draw)
    simRef.current = sim
    setReady(true)

    return () => { sim.stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawNodes, rawEdges])

  // ── Canvas resize ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    function resize() {
      const r = container!.getBoundingClientRect()
      canvas!.width = r.width
      canvas!.height = r.height
      draw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [draw])

  // ── Sync search ref ──────────────────────────────────────────────────────

  useEffect(() => {
    searchRef.current = search
    draw()
  }, [search, draw])

  // ── Pointer helpers ──────────────────────────────────────────────────────

  function clientToWorld(cx: number, cy: number): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const { x: ox, y: oy, k } = transformRef.current
    return {
      x: (cx - rect.left - ox) / k,
      y: (cy - rect.top - oy) / k,
    }
  }

  function hitTest(wx: number, wy: number): GNode | null {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]
      if (!n.x) continue
      const dx = wx - n.x!
      const dy = wy - n.y!
      if (dx * dx + dy * dy <= (n.radius + 4) ** 2) return n
    }
    return null
  }

  // ── Pointer events ───────────────────────────────────────────────────────

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const { x, y } = clientToWorld(e.clientX, e.clientY)
    const hit = hitTest(x, y)
    if (hit) {
      draggingNodeRef.current = hit
      hit.fx = hit.x
      hit.fy = hit.y
      simRef.current?.alphaTarget(0.3).restart()
    } else {
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y }
    }
    canvasRef.current?.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const { x, y } = clientToWorld(e.clientX, e.clientY)
    setMousePos({ x: e.clientX, y: e.clientY })

    const hit = hitTest(x, y)
    setHoverNode(hit)
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? 'pointer' : isPanningRef.current ? 'grabbing' : 'grab'
    }

    if (draggingNodeRef.current) {
      draggingNodeRef.current.fx = x
      draggingNodeRef.current.fy = y
    } else if (isPanningRef.current) {
      transformRef.current.x = e.clientX - panStartRef.current.x
      transformRef.current.y = e.clientY - panStartRef.current.y
      draw()
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const node = draggingNodeRef.current
    if (node) {
      node.fx = null
      node.fy = null
      simRef.current?.alphaTarget(0)
      draggingNodeRef.current = null
    }
    isPanningRef.current = false
    canvasRef.current?.releasePointerCapture(e.pointerId)
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = clientToWorld(e.clientX, e.clientY)
    const hit = hitTest(x, y)
    if (hit) {
      router.push(`/tags/${encodeURIComponent(hit.tag)}`)
    }
  }

  function handleWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const { x: ox, y: oy, k } = transformRef.current
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    const newK = Math.max(0.3, Math.min(5, k * factor))
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    transformRef.current = {
      x: cx - (cx - ox) * (newK / k),
      y: cy - (cy - oy) * (newK / k),
      k: newK,
    }
    draw()
  }

  // ── Reset view ───────────────────────────────────────────────────────────

  function resetView() {
    transformRef.current = { x: 0, y: 0, k: 1 }
    draw()
    simRef.current?.alpha(0.3).restart()
  }

  // ── Copy link ────────────────────────────────────────────────────────────

  function copyLink() {
    const url = window.location.origin + '/tags/graph' + (search ? `?q=${encodeURIComponent(search)}` : '')
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={cn('relative flex flex-col', className)}>
      {/* Controls bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-surface-100/90 backdrop-blur-sm border-b border-surface-300 flex-shrink-0">
        {/* Search */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs bg-surface-200 border border-surface-300 rounded-lg px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="flex-1 bg-transparent text-xs font-mono text-white placeholder-surface-500 focus:outline-none min-w-0"
            aria-label="Search tags in graph"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search">
              <X className="h-3 w-3 text-surface-500 hover:text-white transition-colors" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={resetView}
            title="Reset view"
            aria-label="Reset graph view"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white text-xs font-mono transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={copyLink}
            title="Copy link"
            aria-label="Copy graph link"
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-mono transition-colors',
              copied
                ? 'bg-emerald/10 border-emerald/40 text-emerald'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
            )}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>

        {/* Legend */}
        <div className="hidden lg:flex items-center gap-3 ml-auto text-[10px] font-mono text-surface-500 flex-shrink-0">
          {[
            { color: '#f59e0b', label: 'Has laws' },
            { color: '#3b82f6', label: 'Active debates' },
            { color: '#52525b', label: 'Proposed' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative min-h-0">
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
          onWheel={handleWheel}
          aria-label="Tag network graph — click a node to explore that tag"
        />

        {/* Hover tooltip */}
        {hoverNode && (
          <div
            className={cn(
              'pointer-events-none fixed z-50 px-3 py-2 rounded-lg',
              'bg-surface-100 border border-surface-300 shadow-xl',
              'text-xs font-mono',
            )}
            style={{
              left: mousePos.x + 14,
              top: mousePos.y - 10,
              transform: mousePos.x > window.innerWidth - 200 ? 'translateX(-110%)' : undefined,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Hash className="h-3 w-3 text-for-400" />
              <span className="font-semibold text-white">{hoverNode.tag}</span>
            </div>
            <div className="space-y-0.5 text-surface-400">
              <div>{hoverNode.topic_count} topic{hoverNode.topic_count !== 1 ? 's' : ''}</div>
              {hoverNode.law_count > 0 && (
                <div className="text-gold">{hoverNode.law_count} law{hoverNode.law_count !== 1 ? 's' : ''}</div>
              )}
              {hoverNode.active_count > 0 && (
                <div className="text-for-400">{hoverNode.active_count} active</div>
              )}
              <div className="text-surface-500">{hoverNode.total_votes.toLocaleString()} votes</div>
            </div>
            <p className="mt-1 text-[10px] text-surface-600">Click to explore →</p>
          </div>
        )}
      </div>
    </div>
  )
}
