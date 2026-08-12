'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { graphColorForCategory } from '@/lib/utils/graph-colors'
import { cn } from '@/lib/utils/cn'
import type { NoteGraphNode, NoteGraphLink, NoteGraphResponse } from '@/app/api/notes/graph/route'

// ─── Node / link types ─────────────────────────────────────────────────────

interface GNode extends SimulationNodeDatum {
  id: string
  type: 'note' | 'topic'
  label: string
  category: string | null
  pinned: boolean
  status: string | undefined
  radius: number
  color: string
}

interface GLink extends SimulationLinkDatum<GNode> {
  source: string | GNode
  target: string | GNode
}

// ─── Color helpers ─────────────────────────────────────────────────────────

const NOTE_COLOR = '#60a5fa'   // for-400 — notes are blue
const PIN_COLOR  = '#f59e0b'   // gold — pinned notes

function nodeColor(n: NoteGraphNode): string {
  if (n.type === 'note') return n.pinned ? PIN_COLOR : NOTE_COLOR
  return graphColorForCategory(n.category)
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ─── Component ─────────────────────────────────────────────────────────────

export function NotesGraphClient() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<ReturnType<typeof forceSimulation<GNode>> | null>(null)
  const nodesRef = useRef<GNode[]>([])
  const linksRef = useRef<GLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const draggingNodeRef = useRef<GNode | null>(null)
  const searchRef = useRef('')

  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [search, setSearch] = useState('')
  const [hoverNode, setHoverNode] = useState<GNode | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [nodeCount, setNodeCount] = useState(0)
  const [linkCount, setLinkCount] = useState(0)

  // ─── Load data ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notes/graph')
      if (!res.ok) return
      const data: NoteGraphResponse = await res.json()

      if (data.nodes.length === 0) {
        setEmpty(true)
        setLoading(false)
        return
      }

      const gNodes: GNode[] = data.nodes.map((n) => ({
        ...n,
        pinned: n.pinned ?? false,
        status: n.status,
        radius: n.type === 'note' ? (n.pinned ? 12 : 9) : 14,
        color: nodeColor(n),
      }))

      const idSet = new Set(gNodes.map((n) => n.id))
      const gLinks: GLink[] = (data.links as NoteGraphLink[])
        .filter((l) => idSet.has(l.source as string) && idSet.has(l.target as string))
        .map((l) => ({ source: l.source, target: l.target }))

      nodesRef.current = gNodes
      linksRef.current = gLinks
      setNodeCount(gNodes.length)
      setLinkCount(gLinks.length)

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

      // Centre transform
      transformRef.current = { x: 0, y: 0, k: 1 }

      if (simRef.current) simRef.current.stop()
      simRef.current = forceSimulation<GNode>(gNodes)
        .force('link', forceLink<GNode, GLink>(gLinks).id((d) => d.id).distance(80).strength(0.6))
        .force('charge', forceManyBody<GNode>().strength(-120))
        .force('center', forceCenter<GNode>(rect.width / 2, rect.height / 2).strength(0.05))
        .force('collide', forceCollide<GNode>((d) => d.radius + 6))
        .on('tick', draw)
        .on('end', () => { setLoading(false) })

    } catch {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // ─── Sync search ref ──────────────────────────────────────────────────

  useEffect(() => { searchRef.current = search }, [search])

  // ─── Resize ──────────────────────────────────────────────────────────

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
        simRef.current.force('center', forceCenter<GNode>(rect.width / 2, rect.height / 2).strength(0.05))
        simRef.current.alpha(0.4).restart()
      }
      draw()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Draw ─────────────────────────────────────────────────────────────

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

    const q = searchRef.current.toLowerCase().trim()

    // ── Links ──────────────────────────────────────────────────────────

    for (const link of linksRef.current) {
      const s = link.source as GNode
      const t = link.target as GNode
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue

      const sMatch = !q || s.label.toLowerCase().includes(q)
      const tMatch = !q || t.label.toLowerCase().includes(q)
      const alpha = q && !sMatch && !tMatch ? 0.04 : 0.3

      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = `rgba(63,63,74,${alpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // ── Nodes ──────────────────────────────────────────────────────────

    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue

      const isMatch = !q || node.label.toLowerCase().includes(q)
      const isDimmed = q.length > 0 && !isMatch
      const alpha = isDimmed ? 0.08 : 1.0

      // Glow for search hits
      if (isMatch && q.length > 0) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 7, 0, Math.PI * 2)
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 10)
        glow.addColorStop(0, hexToRgba(node.color, 0.45))
        glow.addColorStop(1, hexToRgba(node.color, 0))
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Node shape: circle for topics, rounded square for notes
      if (node.type === 'note') {
        const r = 4
        const s = node.radius
        const nx = node.x - s
        const ny = node.y - s
        const w = s * 2
        const h = s * 2
        ctx.beginPath()
        ctx.moveTo(nx + r, ny)
        ctx.lineTo(nx + w - r, ny)
        ctx.quadraticCurveTo(nx + w, ny, nx + w, ny + r)
        ctx.lineTo(nx + w, ny + h - r)
        ctx.quadraticCurveTo(nx + w, ny + h, nx + w - r, ny + h)
        ctx.lineTo(nx + r, ny + h)
        ctx.quadraticCurveTo(nx, ny + h, nx, ny + h - r)
        ctx.lineTo(nx, ny + r)
        ctx.quadraticCurveTo(nx, ny, nx + r, ny)
        ctx.closePath()
        ctx.fillStyle = hexToRgba(node.color, alpha * 0.85)
        ctx.fill()
        if (node.pinned) {
          ctx.strokeStyle = hexToRgba('#f59e0b', alpha * 0.9)
          ctx.lineWidth = 2
          ctx.stroke()
        }
      } else {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
        ctx.fillStyle = hexToRgba(node.color, alpha * 0.75)
        ctx.fill()
        ctx.strokeStyle = hexToRgba(node.color, alpha * 0.5)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Label
      if ((node.radius >= 9 || isMatch) && !isDimmed) {
        ctx.fillStyle = `rgba(212,212,216,${alpha * 0.9})`
        ctx.font = `${node.type === 'note' ? '9px' : '9px'} JetBrains Mono, monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const label = node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label
        ctx.fillText(label, node.x, node.y + node.radius + 3)
      }
    }

    ctx.restore()
  }

  // ─── Hit-test ──────────────────────────────────────────────────────────

  function findNode(sx: number, sy: number): GNode | null {
    const { x, y, k } = transformRef.current
    const wx = (sx - x) / k
    const wy = (sy - y) / k
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i]
      if (n.x == null || n.y == null) continue
      const dx = n.x - wx
      const dy = n.y - wy
      const hit = n.type === 'note'
        ? Math.abs(dx) <= n.radius + 4 && Math.abs(dy) <= n.radius + 4
        : dx * dx + dy * dy <= (n.radius + 4) ** 2
      if (hit) return n
    }
    return null
  }

  // ─── Pointer events ────────────────────────────────────────────────────

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
        simRef.current?.alphaTarget(0.3).restart()
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
        simRef.current?.alphaTarget(0)
        if (isClick) {
          if (node.type === 'note') {
            router.push('/notes')
          } else {
            router.push(`/topic/${node.id}`)
          }
        }
      }
      isPanningRef.current = false
      try { canvas.releasePointerCapture(e.pointerId) } catch { /* noop */ }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const mx = e.clientX - r.left
      const my = e.clientY - r.top
      const factor = e.deltaY < 0 ? 1.12 : 0.9
      const { x, y, k } = transformRef.current
      const newK = Math.max(0.2, Math.min(5, k * factor))
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
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Zoom helpers ─────────────────────────────────────────────────────

  function zoom(factor: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = rect.width / 2
    const my = rect.height / 2
    const { x, y, k } = transformRef.current
    const newK = Math.max(0.2, Math.min(5, k * factor))
    transformRef.current.x = mx - ((mx - x) / k) * newK
    transformRef.current.y = my - ((my - y) / k) * newK
    transformRef.current.k = newK
    draw()
  }

  function resetView() {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    transformRef.current = { x: 0, y: 0, k: 1 }
    simRef.current?.force('center', forceCenter<GNode>(rect.width / 2, rect.height / 2).strength(0.08))
    simRef.current?.alpha(0.5).restart()
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      {/* Header bar */}
      <div className="flex-shrink-0 border-b border-surface-300 bg-surface-100">
        <div className="max-w-7xl mx-auto flex items-center gap-3 h-13 px-4 py-2">
          <Link
            href="/notes"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to notes"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex items-center flex-1 max-w-xs">
              <Search className="absolute left-3 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className={cn(
                  'w-full pl-8 pr-8 py-1.5 text-xs font-mono rounded-lg',
                  'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
                  'focus:outline-none focus:border-for-500/50',
                )}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 text-surface-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4 text-[10px] font-mono text-surface-500 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-for-400/80" />
              Note
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-gold/80" />
              Pinned
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-full bg-purple/80" />
              Topic
            </span>
          </div>

          {/* Stats */}
          <div className="hidden md:flex flex-shrink-0 bg-surface-200/80 border border-surface-300 rounded-lg px-3 py-1.5">
            <span className="text-[10px] font-mono text-surface-500">
              {nodeCount} nodes · {linkCount} links
            </span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => zoom(1.2)}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => zoom(0.85)}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={resetView}
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Reset view"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden" ref={containerRef}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-surface-50">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-for-400 animate-spin" />
              <p className="text-xs font-mono text-surface-500">Building your knowledge graph…</p>
            </div>
          </div>
        )}

        {empty && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState
              icon={FileText}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              iconBorder="border-for-500/30"
              title="No notes yet"
              description="Create notes linked to topics and they'll appear here as a knowledge graph."
              action={{ label: 'Write a note', href: '/notes' }}
            />
          </div>
        )}

        <canvas ref={canvasRef} className="absolute inset-0 touch-none" style={{ cursor: 'grab' }} />

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoverNode && (
            <motion.div
              key={hoverNode.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className={cn(
                'absolute pointer-events-none z-20 px-3 py-2 rounded-xl',
                'bg-surface-200 border border-surface-300 shadow-xl shadow-black/40',
                'max-w-[260px]',
              )}
              style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'text-[9px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded',
                  hoverNode.type === 'note'
                    ? hoverNode.pinned
                      ? 'bg-gold/20 text-gold border border-gold/30'
                      : 'bg-for-500/20 text-for-300 border border-for-500/30'
                    : 'bg-surface-300 text-surface-500 border border-surface-400',
                )}>
                  {hoverNode.type === 'note' ? (hoverNode.pinned ? 'Pinned Note' : 'Note') : 'Topic'}
                </span>
                {hoverNode.category && (
                  <span className="text-[9px] font-mono text-surface-500">{hoverNode.category}</span>
                )}
              </div>
              <div className="text-xs font-semibold text-white leading-snug line-clamp-3">
                {hoverNode.label}
              </div>
              {hoverNode.type === 'topic' && hoverNode.status && (
                <div className="text-[9px] font-mono text-surface-500 mt-1 capitalize">
                  Status: {hoverNode.status}
                </div>
              )}
              <div className="text-[9px] font-mono text-surface-500 mt-1 flex items-center gap-1">
                <ExternalLink className="h-2.5 w-2.5" />
                Click to open
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instruction hint */}
        {!loading && !empty && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-mono text-surface-600 pointer-events-none select-none">
            Drag to pan · Scroll to zoom · Click a node to open
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
