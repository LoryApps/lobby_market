'use client'

/**
 * FloorGraph
 *
 * Full-screen force-directed graph of the topics currently on The Floor.
 * Nodes are sized by vote volume and coloured by category.  The selected
 * topic gets a gold pulsing halo.  Clicking a node calls onSelect so the
 * parent (TheFloor) can update its selectedTopicId state.
 *
 * Interaction model (matches LawGraph):
 *  - Drag node   → pin and fling
 *  - Drag canvas → pan
 *  - Scroll      → zoom
 *  - Click node  → select topic
 */

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
import type { Topic } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

// ─── Category colours (same palette as LawGraph) ──────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  economics: '#f59e0b',
  politics: '#60a5fa',
  technology: '#8b5cf6',
  science: '#10b981',
  ethics: '#f87171',
  philosophy: '#818cf8',
  culture: '#fb923c',
  health: '#f472b6',
  environment: '#4ade80',
  education: '#22d3ee',
}

const DEFAULT_COLOR = '#52525b' // zinc-600
const SELECTED_COLOR = '#f59e0b' // gold

function colorForCategory(cat: string | null): string {
  if (!cat) return DEFAULT_COLOR
  return CATEGORY_COLORS[cat.toLowerCase()] ?? DEFAULT_COLOR
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function radiusFromVotes(votes: number): number {
  const base = Math.log10(Math.max(votes, 1) + 1)
  return Math.max(6, Math.min(28, 6 + base * 5))
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FloorNode extends SimulationNodeDatum {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  radius: number
  color: string
  isSelected: boolean
}

interface FloorLink extends SimulationLinkDatum<FloorNode> {
  source: string | FloorNode
  target: string | FloorNode
}

interface FloorGraphProps {
  topics: Topic[]
  selectedId: string
  onSelect: (id: string) => void
  className?: string
}

// ─── Build intra-category spanning links ─────────────────────────────────────
//
// Connect each topic to the next one in the same category so the force
// simulation clusters them without creating an O(n²) link explosion.

function buildLinks(nodes: FloorNode[]): FloorLink[] {
  const byCategory: Record<string, FloorNode[]> = {}
  for (const n of nodes) {
    const key = n.category?.toLowerCase() ?? '__none__'
    if (!byCategory[key]) byCategory[key] = []
    byCategory[key].push(n)
  }

  const links: FloorLink[] = []
  for (const group of Object.values(byCategory)) {
    for (let i = 0; i < group.length - 1; i++) {
      links.push({ source: group[i].id, target: group[i + 1].id })
    }
  }
  return links
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FloorGraph({ topics, selectedId, onSelect, className }: FloorGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<FloorNode, FloorLink> | null>(null)
  const nodesRef = useRef<FloorNode[]>([])
  const linksRef = useRef<FloorLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const draggingNodeRef = useRef<FloorNode | null>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const selectedIdRef = useRef(selectedId)
  const pulseRef = useRef(0) // drives the animated halo
  const rafRef = useRef<number | null>(null)
  const [hoverNode, setHoverNode] = useState<FloorNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  // Keep selectedId ref in sync without restarting the simulation
  useEffect(() => {
    selectedIdRef.current = selectedId
    // Update isSelected flag on node objects so draw() can read it
    for (const n of nodesRef.current) {
      n.isSelected = n.id === selectedId
    }
  }, [selectedId])

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    let running = true
    function loop() {
      if (!running) return
      pulseRef.current += 0.05
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Simulation init ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const width = rect.width || window.innerWidth
    const height = rect.height || window.innerHeight

    const nodes: FloorNode[] = topics.map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      total_votes: t.total_votes ?? 0,
      blue_pct: t.blue_pct ?? 50,
      radius: radiusFromVotes(t.total_votes ?? 0),
      color: colorForCategory(t.category ?? null),
      isSelected: t.id === selectedIdRef.current,
    }))
    nodesRef.current = nodes

    const links = buildLinks(nodes)
    linksRef.current = links

    // Cluster centres (same pattern as LawGraph)
    const cats = Array.from(new Set(nodes.map((n) => (n.category ?? '').toLowerCase())))
    const clusterRadius = Math.min(width, height) * 0.3

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

    const simulation = forceSimulation<FloorNode>(nodes)
      .force(
        'link',
        forceLink<FloorNode, FloorLink>(links)
          .id((d) => d.id)
          .distance(80)
          .strength(0.3),
      )
      .force('charge', forceManyBody<FloorNode>().strength(-200))
      .force('center', forceCenter<FloorNode>(width / 2, height / 2).strength(0.05))
      .force('collide', forceCollide<FloorNode>().radius((d) => d.radius + 8))
      .force(
        'cluster-x',
        forceX<FloorNode>((d) => clusterCenter(d.category).x).strength(0.18),
      )
      .force(
        'cluster-y',
        forceY<FloorNode>((d) => clusterCenter(d.category).y).strength(0.18),
      )
      .alphaDecay(0.022)

    simRef.current = simulation

    return () => {
      simulation.stop()
      simRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics])

  // ── Resize handler ─────────────────────────────────────────────────────────
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
        simRef.current.force('center', forceCenter<FloorNode>(rect.width / 2, rect.height / 2).strength(0.05))
        simRef.current.alpha(0.4).restart()
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Draw ───────────────────────────────────────────────────────────────────
  function draw() {
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

    // ── Links ──────────────────────────────────────────────────────────────
    for (const link of linksRef.current) {
      const s = link.source as FloorNode
      const t = link.target as FloorNode
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    const pulse = Math.sin(pulseRef.current)

    // ── Nodes ──────────────────────────────────────────────────────────────
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue

      const isSelected = node.isSelected
      const isHover = hoverNode?.id === node.id

      // Selected: pulsing gold halo
      if (isSelected) {
        const haloR = node.radius + 10 + pulse * 5
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, haloR + 12)
        glow.addColorStop(0, hexToRgba(SELECTED_COLOR, 0.55))
        glow.addColorStop(1, hexToRgba(SELECTED_COLOR, 0))
        ctx.beginPath()
        ctx.arc(node.x, node.y, haloR + 12, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        ctx.beginPath()
        ctx.arc(node.x, node.y, haloR, 0, Math.PI * 2)
        ctx.strokeStyle = hexToRgba(SELECTED_COLOR, 0.8)
        ctx.lineWidth = 2.5
        ctx.stroke()
      }

      // Hover: subtle white ring
      if (isHover && !isSelected) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Node fill: category colour; selected is brighter
      const fillColor = isSelected ? SELECTED_COLOR : node.color
      const fillAlpha = isSelected ? 1.0 : 0.85

      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(fillColor, fillAlpha)
      ctx.fill()

      // Inner highlight ring for visual depth
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius * 0.55, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba('#ffffff', 0.08)
      ctx.fill()

      // Vote bar: thin arc showing for/against split
      const forAngle = (node.blue_pct / 100) * Math.PI * 2
      if (node.radius > 10) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 2.5, -Math.PI / 2, -Math.PI / 2 + forAngle)
        ctx.strokeStyle = 'rgba(96,165,250,0.7)' // for-400
        ctx.lineWidth = 2
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 2.5, -Math.PI / 2 + forAngle, -Math.PI / 2 + Math.PI * 2)
        ctx.strokeStyle = 'rgba(239,68,68,0.7)' // against-500
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Label: always show for selected, show for larger nodes
      if (isSelected || node.radius > 12 || isHover) {
        ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(212,212,216,0.75)'
        ctx.font = `${isSelected ? 'bold ' : ''}10px JetBrains Mono, ui-monospace, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const maxLen = isSelected ? 36 : 22
        const label =
          node.statement.length > maxLen
            ? node.statement.slice(0, maxLen - 1) + '…'
            : node.statement
        ctx.fillText(label, node.x, node.y + node.radius + 5)
      }
    }

    ctx.restore()
  }

  // ── Hit test ───────────────────────────────────────────────────────────────
  function findNode(screenX: number, screenY: number): FloorNode | null {
    const { x, y, k } = transformRef.current
    const wx = (screenX - x) / k
    const wy = (screenY - y) / k
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]
      if (n.x == null || n.y == null) continue
      const dx = n.x - wx
      const dy = n.y - wy
      if (dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6)) return n
    }
    return null
  }

  // ── Pointer events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const getLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    let clickCandidate: FloorNode | null = null
    let pointerDownPos = { x: 0, y: 0 }

    const onPointerDown = (e: PointerEvent) => {
      const { x, y } = getLocal(e)
      pointerDownPos = { x, y }
      const node = findNode(x, y)
      if (node) {
        clickCandidate = node
        draggingNodeRef.current = node
        const { k } = transformRef.current
        node.fx = (x - transformRef.current.x) / k
        node.fy = (y - transformRef.current.y) / k
        if (simRef.current) simRef.current.alphaTarget(0.3).restart()
      } else {
        clickCandidate = null
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
      } else {
        const node = findNode(x, y)
        setHoverNode(node)
        canvas.style.cursor = node ? 'pointer' : 'grab'
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const { x, y } = getLocal(e)

      if (draggingNodeRef.current) {
        const node = draggingNodeRef.current
        const dx = x - pointerDownPos.x
        const dy = y - pointerDownPos.y
        const moved = dx * dx + dy * dy

        node.fx = null
        node.fy = null
        draggingNodeRef.current = null
        if (simRef.current) simRef.current.alphaTarget(0)

        // Treat as click if pointer barely moved
        if (moved < 36 && clickCandidate?.id === node.id) {
          onSelect(node.id)
        }
      }

      isPanningRef.current = false
      clickCandidate = null
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
  }, [onSelect])

  // ── Legend data ────────────────────────────────────────────────────────────
  const presentCategories = Array.from(
    new Set(
      topics
        .map((t) => t.category)
        .filter((c): c is string => !!c),
    ),
  )

  return (
    <div
      ref={containerRef}
      className={cn('relative h-full w-full overflow-hidden', className)}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 touch-none"
        style={{ cursor: 'grab' }}
        aria-label="Topic connection graph"
      />

      {/* Category legend — bottom left */}
      {presentCategories.length > 0 && (
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 pointer-events-none">
          {presentCategories.slice(0, 8).map((cat) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: colorForCategory(cat) }}
              />
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-surface-500">
                {cat}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Hover tooltip */}
      {hoverNode && (
        <div
          className={cn(
            'absolute pointer-events-none z-10 px-3 py-2.5 rounded-xl',
            'bg-surface-100/90 backdrop-blur border border-surface-300/60',
            'text-xs font-mono text-white max-w-[260px] shadow-xl shadow-black/40',
          )}
          style={{
            left: Math.min(mousePos.x + 16, (containerRef.current?.clientWidth ?? 500) - 280),
            top: Math.min(mousePos.y + 16, (containerRef.current?.clientHeight ?? 500) - 80),
          }}
        >
          <div className="font-semibold leading-snug mb-1">{hoverNode.statement}</div>
          <div className="flex items-center gap-2 text-[10px]">
            {hoverNode.category && (
              <span style={{ color: colorForCategory(hoverNode.category) }}>
                {hoverNode.category}
              </span>
            )}
            {hoverNode.category && <span className="text-surface-600">·</span>}
            <span className="text-for-400">{Math.round(hoverNode.blue_pct)}% for</span>
            <span className="text-surface-600">·</span>
            <span className="text-surface-500">{hoverNode.total_votes.toLocaleString()} votes</span>
          </div>
          <div className="mt-1 text-[9px] text-surface-600">Click to focus</div>
        </div>
      )}

      {/* Stat strip — top right */}
      <div
        className={cn(
          'absolute top-4 right-4 px-3 py-2 rounded-xl pointer-events-none',
          'bg-surface-100/60 backdrop-blur border border-surface-300/40',
          'text-[10px] font-mono text-surface-500',
        )}
      >
        {topics.length} topics · {presentCategories.length} categories
        <span className="block mt-0.5 text-surface-600">
          scroll to zoom · drag to pan
        </span>
      </div>

      {/* Empty state */}
      {topics.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-surface-600 font-mono text-sm">No topics on the floor.</p>
        </div>
      )}
    </div>
  )
}
