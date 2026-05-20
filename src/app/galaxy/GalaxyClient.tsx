'use client'

/**
 * /galaxy — The Civic Galaxy
 *
 * A canvas-based star-map of every civic topic on the platform.
 * Each star is one topic:
 *   • Size    — proportional to total votes (log scale)
 *   • Color   — vote split (blue=For, purple=split, red=Against)
 *   • Glow    — active/voting topics pulse; laws have a gold ring
 *   • Cluster — stars grouped by category via D3 force
 *
 * Distinct from:
 *   /nexus     — knowledge graph with explicit wiki/tag edges
 *   /mindmap   — personal engagement graph
 *   /topic/graph — single-topic keyword similarity graph
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Gavel,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
  Star,
  Filter,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import {
  forceCenter,
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force'
import type { GalaxyResponse } from '@/app/api/galaxy/route'

// ─── Category layout ───────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   '#f59e0b',
  Politics:    '#60a5fa',
  Technology:  '#8b5cf6',
  Science:     '#10b981',
  Ethics:      '#f87171',
  Philosophy:  '#818cf8',
  Culture:     '#fb923c',
  Health:      '#f472b6',
  Environment: '#4ade80',
  Education:   '#22d3ee',
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'law', label: 'Laws' },
  { id: 'proposed', label: 'Proposed' },
  { id: 'failed', label: 'Failed' },
] as const

// ─── Helpers ───────────────────────────────────────────────────────────────────

function voteColor(bluePct: number): string {
  if (bluePct >= 72) return '#60a5fa'  // for-400 — strong For
  if (bluePct >= 58) return '#818cf8'  // indigo — lean For
  if (bluePct >= 42) return '#8b5cf6'  // purple — contested
  if (bluePct >= 28) return '#c084fc'  // pink/purple — lean Against
  return '#f87171'                     // against-400 — strong Against
}

function starRadius(votes: number, maxVotes: number): number {
  if (votes === 0) return 3
  const logV = Math.log1p(votes)
  const logM = Math.log1p(maxVotes)
  return 3 + (logV / logM) * 9
}

function categoryClusterPosition(
  category: string | null,
  cxCanvas: number,
  cyCanvas: number,
  clusterRadius: number
): { cx: number; cy: number } {
  const idx = CATEGORIES.indexOf((category ?? 'Politics') as typeof CATEGORIES[number])
  const i = idx < 0 ? 0 : idx
  const angle = ((2 * Math.PI) / CATEGORIES.length) * i - Math.PI / 2
  return {
    cx: cxCanvas + clusterRadius * Math.cos(angle),
    cy: cyCanvas + clusterRadius * Math.sin(angle),
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StarNode extends SimulationNodeDatum {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  radius: number
  color: string
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function GalaxyClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<StarNode[]>([])
  const animFrameRef = useRef<number>(0)
  const simRef = useRef<ReturnType<typeof forceSimulation> | null>(null)
  const tickRef = useRef(0)

  const [data, setData] = useState<GalaxyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hovered, setHovered] = useState<StarNode | null>(null)
  const [selected, setSelected] = useState<StarNode | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(new Set())
  const [showLegend, setShowLegend] = useState(false)

  // ── Load data ────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/galaxy', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: GalaxyResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load the galaxy.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Toggle category ─────────────────────────────────────────────────────────

  const toggleCat = useCallback((cat: string) => {
    setHiddenCats((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }, [])

  // ── Build simulation when data arrives / filters change ─────────────────────

  useEffect(() => {
    if (!data || !canvasRef.current) return

    const canvas = canvasRef.current
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const clusterR = Math.min(W, H) * 0.32

    const maxVotes = Math.max(...data.topics.map((t) => t.total_votes), 1)

    const visibleTopics = data.topics.filter((t) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && t.status !== 'active' && t.status !== 'voting') return false
        if (statusFilter === 'law' && t.status !== 'law') return false
        if (statusFilter === 'proposed' && t.status !== 'proposed') return false
        if (statusFilter === 'failed' && t.status !== 'failed') return false
      }
      if (t.category && hiddenCats.has(t.category)) return false
      return true
    })

    const nodes: StarNode[] = visibleTopics.map((t) => ({
      ...t,
      radius: starRadius(t.total_votes, maxVotes),
      color: voteColor(t.blue_pct),
    }))

    // Position nodes near their category cluster
    nodes.forEach((n) => {
      if (n.x === undefined || n.y === undefined) {
        const { cx: ccx, cy: ccy } = categoryClusterPosition(n.category, cx, cy, clusterR)
        n.x = ccx + (Math.random() - 0.5) * 60
        n.y = ccy + (Math.random() - 0.5) * 60
      }
    })

    nodesRef.current = nodes

    // Stop any existing simulation
    simRef.current?.stop()

    const sim = forceSimulation(nodes as SimulationNodeDatum[])
      .alphaDecay(0.01)
      .velocityDecay(0.4)
      .force(
        'x',
        forceX<StarNode>((n) => categoryClusterPosition(n.category, cx, cy, clusterR).cx).strength(0.08)
      )
      .force(
        'y',
        forceY<StarNode>((n) => categoryClusterPosition(n.category, cx, cy, clusterR).cy).strength(0.08)
      )
      .force('charge', forceManyBody().strength(-8))
      .force('collide', forceCollide<StarNode>((n) => n.radius + 2))
      .force('center', forceCenter(cx, cy).strength(0.02))
      .on('tick', () => { tickRef.current++ })

    simRef.current = sim

    return () => { sim.stop() }
  }, [data, statusFilter, hiddenCats])

  // ── Canvas draw loop ─────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let prevTick = -1

    function drawFrame() {
      animFrameRef.current = requestAnimationFrame(drawFrame)
      if (!ctx || !canvas) return

      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2
      const clusterR = Math.min(W, H) * 0.32
      const now = Date.now()

      // Only redraw when simulation ticked or hovered changed
      const currentTick = tickRef.current
      if (currentTick === prevTick) return
      prevTick = currentTick

      // Background — deep space gradient
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7)
      bg.addColorStop(0, '#0e1117')
      bg.addColorStop(1, '#060810')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Draw faint category cluster zones (nebulae)
      CATEGORIES.forEach((cat) => {
        if (hiddenCats.has(cat)) return
        const { cx: ccx, cy: ccy } = categoryClusterPosition(cat, cx, cy, clusterR)
        const color = CATEGORY_COLORS[cat] ?? '#8b5cf6'
        const gradient = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, clusterR * 0.45)
        gradient.addColorStop(0, color + '18')
        gradient.addColorStop(1, color + '00')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(ccx, ccy, clusterR * 0.45, 0, Math.PI * 2)
        ctx.fill()
      })

      // Draw category labels
      CATEGORIES.forEach((cat) => {
        if (hiddenCats.has(cat)) return
        const { cx: ccx, cy: ccy } = categoryClusterPosition(cat, cx, cy, clusterR)
        const color = CATEGORY_COLORS[cat] ?? '#8b5cf6'
        ctx.save()
        ctx.font = '700 10px "Courier New", monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = color + 'aa'
        ctx.fillText(cat.toUpperCase(), ccx, ccy - clusterR * 0.35)
        ctx.restore()
      })

      const nodes = nodesRef.current
      const q = searchQuery.toLowerCase().trim()
      const hoveredId = hovered?.id ?? null
      const selectedId = selected?.id ?? null

      // Draw stars
      nodes.forEach((n) => {
        if (n.x === undefined || n.y === undefined) return
        const x = n.x
        const y = n.y

        const isHovered = n.id === hoveredId
        const isSelected = n.id === selectedId
        const isHighlighted = q.length > 1 && n.statement.toLowerCase().includes(q)
        const isDimmed = (q.length > 1 && !isHighlighted) || (!q && (isHovered || isSelected) ? false : false)

        let opacity = 1
        if (n.status === 'failed') opacity = 0.25
        else if (n.status === 'proposed') opacity = 0.55
        if (isDimmed) opacity *= 0.25

        ctx.save()
        ctx.globalAlpha = opacity

        // Glow layer
        const glowRadius = isHovered || isSelected
          ? n.radius * 4
          : isHighlighted
          ? n.radius * 3
          : n.radius * 2

        const glowStr = isHovered || isSelected ? 28 : isHighlighted ? 16 : 8
        ctx.shadowBlur = glowStr
        ctx.shadowColor = n.color

        // Pulse animation for active/voting
        let r = n.radius
        if (n.status === 'active' || n.status === 'voting') {
          const pulse = 1 + 0.18 * Math.sin(now / 600 + n.total_votes)
          r = r * pulse
        }

        // Draw halo
        ctx.beginPath()
        ctx.arc(x, y, r + glowRadius * 0.3, 0, Math.PI * 2)
        ctx.fillStyle = n.color + '10'
        ctx.fill()

        // Draw star body
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = n.color
        ctx.fill()

        // Gold ring for laws
        if (n.status === 'law') {
          ctx.shadowBlur = 12
          ctx.shadowColor = '#f59e0b'
          ctx.beginPath()
          ctx.arc(x, y, r + 3, 0, Math.PI * 2)
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Selection ring
        if (isSelected || isHovered) {
          ctx.beginPath()
          ctx.arc(x, y, r + 5, 0, Math.PI * 2)
          ctx.strokeStyle = '#ffffff80'
          ctx.lineWidth = 1
          ctx.stroke()
        }

        ctx.restore()
      })
    }

    animFrameRef.current = requestAnimationFrame(drawFrame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [searchQuery, hovered, selected, hiddenCats])

  // ── Resize canvas to container ───────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    function resize() {
      if (!canvas || !container) return
      const { width, height } = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(dpr, dpr)
      // Force redraw
      tickRef.current++
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // ── Mouse interactions ───────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const nodes = nodesRef.current
    let closest: StarNode | null = null
    let closestDist = Infinity

    for (const n of nodes) {
      if (n.x === undefined || n.y === undefined) continue
      const dx = n.x - mx
      const dy = n.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < n.radius + 8 && dist < closestDist) {
        closest = n
        closestDist = dist
      }
    }

    setHovered(closest)
    if (canvas) canvas.style.cursor = closest ? 'pointer' : 'default'
    tickRef.current++ // force redraw
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(null)
    tickRef.current++
  }, [])

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const nodes = nodesRef.current
    for (const n of nodes) {
      if (n.x === undefined || n.y === undefined) continue
      const dx = n.x - mx
      const dy = n.y - my
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < n.radius + 8) {
        setSelected((prev) => prev?.id === n.id ? null : n)
        tickRef.current++
        return
      }
    }
    setSelected(null)
    tickRef.current++
  }, [])

  // ── Search keyboard shortcut ─────────────────────────────────────────────────

  const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSelected(null)
        setSearchQuery('')
        tickRef.current++
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#060810] overflow-hidden">
      <TopBar />

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-surface-300/40 bg-surface-100/60 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 h-12 flex items-center gap-3">
          <Link
            href="/"
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white transition-colors"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>

          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple flex-shrink-0" aria-hidden />
            <span className="font-mono text-sm font-bold text-white">Civic Galaxy</span>
          </div>

          {/* Stats */}
          {data && (
            <div className="hidden md:flex items-center gap-3 ml-2">
              <span className="text-xs font-mono text-surface-500">
                <span className="text-white">{data.stats.total}</span> topics
              </span>
              <span className="text-xs font-mono text-surface-500">
                <span className="text-gold">{data.stats.laws}</span> laws
              </span>
              <span className="text-xs font-mono text-surface-500">
                <span className="text-for-400">{data.stats.active}</span> active
              </span>
            </div>
          )}

          {/* Status filter */}
          <div
            className="hidden md:flex items-center gap-1 ml-2"
            role="tablist"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={statusFilter === f.id}
                onClick={() => { setStatusFilter(f.id); tickRef.current++ }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors',
                  statusFilter === f.id
                    ? 'bg-purple/20 border-purple/40 text-purple'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative ml-auto flex-shrink-0">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); tickRef.current++ }}
              placeholder="Search stars…"
              aria-label="Search topics"
              className="h-8 w-44 pl-8 pr-8 rounded-lg bg-surface-200/70 border border-surface-300/60 text-xs font-mono text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 focus:bg-surface-200 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); tickRef.current++ }}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>

          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend((v) => !v)}
            aria-pressed={showLegend}
            aria-label="Toggle legend"
            className={cn(
              'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
              showLegend
                ? 'bg-purple/20 border-purple/40 text-purple'
                : 'bg-surface-200/60 border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400'
            )}
          >
            <Filter className="h-3.5 w-3.5" aria-hidden />
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh galaxy"
            className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          </button>
        </div>
      </div>

      {/* ── Legend panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showLegend && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex-shrink-0 overflow-hidden border-b border-surface-300/40 bg-surface-100/60 backdrop-blur-sm"
          >
            <div className="max-w-[1800px] mx-auto px-4 py-3">
              <div className="flex items-start gap-8 flex-wrap">
                {/* Categories */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 mb-2 uppercase tracking-wide">
                    Constellations
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => {
                      const hidden = hiddenCats.has(cat)
                      return (
                        <button
                          key={cat}
                          onClick={() => toggleCat(cat)}
                          aria-pressed={!hidden}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono border transition-all',
                            hidden
                              ? 'bg-surface-200/40 border-surface-300/40 text-surface-600 line-through'
                              : 'bg-surface-200/70 border-surface-300/60 text-white hover:border-surface-400'
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: CATEGORY_COLORS[cat] }}
                            aria-hidden
                          />
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Vote color scale */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 mb-2 uppercase tracking-wide">
                    Vote Split
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-for-400">FOR</span>
                    <div className="h-3 w-32 rounded-full" style={{
                      background: 'linear-gradient(to right, #60a5fa, #818cf8, #8b5cf6, #c084fc, #f87171)'
                    }} aria-label="Color scale from blue (For) to red (Against)" />
                    <span className="text-[11px] font-mono text-against-400">AGN</span>
                  </div>
                </div>

                {/* Status */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 mb-2 uppercase tracking-wide">
                    Status
                  </p>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gold ring-1 ring-gold/60" aria-hidden />
                      <span className="text-surface-400">Ring = Law</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-for-500 opacity-60" aria-hidden />
                      <span className="text-surface-400">Dim = Failed</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-for-500 animate-pulse" aria-hidden />
                      <span className="text-surface-400">Pulse = Active</span>
                    </span>
                  </div>
                </div>

                {/* Size */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 mb-2 uppercase tracking-wide">
                    Size
                  </p>
                  <p className="text-[11px] font-mono text-surface-400">∝ Total votes (log scale)</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Canvas area ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 text-purple animate-spin" aria-hidden />
                <p className="font-mono text-sm text-surface-500">Charting the galaxy…</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <Sparkles className="h-10 w-10 text-surface-500 mx-auto" aria-hidden />
                <p className="font-mono text-sm text-surface-500">{error}</p>
                <button
                  onClick={load}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/20 border border-purple/40 text-sm font-mono text-purple hover:bg-purple/30 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onClick={handleClick}
              aria-label="Civic topic galaxy — interactive star map"
              role="img"
            />
          )}

          {/* Hover tooltip */}
          <AnimatePresence>
            {hovered && !selected && (
              <motion.div
                key={hovered.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10"
              >
                <div className="bg-surface-100/90 border border-surface-300 backdrop-blur-sm rounded-xl px-3 py-2 max-w-xs text-center shadow-xl">
                  <p className="text-xs font-mono text-white font-medium line-clamp-2">
                    {hovered.statement}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1.5">
                    {hovered.category && (
                      <span
                        className="text-[10px] font-mono"
                        style={{ color: CATEGORY_COLORS[hovered.category] ?? '#71717a' }}
                      >
                        {hovered.category}
                      </span>
                    )}
                    <Badge
                      variant={
                        hovered.status === 'law'
                          ? 'law'
                          : hovered.status === 'voting' || hovered.status === 'active'
                          ? 'active'
                          : hovered.status === 'failed'
                          ? 'failed'
                          : 'proposed'
                      }
                      className="text-[9px] px-1.5 py-0"
                    >
                      {hovered.status === 'law' ? 'LAW' : hovered.status.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] font-mono text-surface-500">
                      {hovered.total_votes.toLocaleString()} votes
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-surface-600 mt-1">Click to select</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile status filter */}
          <div className="absolute top-3 left-3 md:hidden flex items-center gap-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => { setStatusFilter(f.id); tickRef.current++ }}
                className={cn(
                  'px-2 py-1 rounded-lg text-[10px] font-mono border transition-colors',
                  statusFilter === f.id
                    ? 'bg-purple/30 border-purple/50 text-purple'
                    : 'bg-surface-100/80 border-surface-300/60 text-surface-500'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Instructions overlay (first load) */}
          {!loading && !error && data && (
            <div className="absolute bottom-4 right-4 text-[10px] font-mono text-surface-600 text-right pointer-events-none hidden md:block">
              <p>Hover to preview · Click to select · ⌘K to search</p>
            </div>
          )}
        </div>

        {/* ── Selected topic panel ────────────────────────────────────── */}
        <AnimatePresence>
          {selected && (
            <motion.aside
              initial={{ x: 320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 320, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
              className="flex-shrink-0 w-80 bg-surface-100/90 border-l border-surface-300/60 backdrop-blur-sm overflow-y-auto flex flex-col"
              aria-label="Selected topic details"
            >
              {/* Header */}
              <div className="p-4 border-b border-surface-300/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-surface-100"
                      style={{
                        background: selected.color,
                        ringColor: selected.status === 'law' ? '#f59e0b' : selected.color,
                      }}
                      aria-hidden
                    />
                    <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                      {selected.category ?? 'Uncategorized'}
                    </span>
                  </div>
                  <button
                    onClick={() => { setSelected(null); tickRef.current++ }}
                    aria-label="Close panel"
                    className="text-surface-500 hover:text-white transition-colors flex-shrink-0"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                <h2 className="font-mono text-sm font-bold text-white mt-2 leading-snug">
                  {selected.statement}
                </h2>
              </div>

              {/* Stats */}
              <div className="p-4 space-y-4">
                {/* Vote split */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 mb-1.5 uppercase tracking-wide">
                    Vote Split
                  </p>
                  <div className="h-3 rounded-full overflow-hidden flex mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-for-700 to-for-400 rounded-l-full transition-all"
                      style={{ width: `${selected.blue_pct}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-l from-against-700 to-against-400 rounded-r-full transition-all"
                      style={{ width: `${100 - selected.blue_pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-for-400">{Math.round(selected.blue_pct)}% FOR</span>
                    <span className="text-against-400">{Math.round(100 - selected.blue_pct)}% AGAINST</span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Status</p>
                  <Badge
                    variant={
                      selected.status === 'law'
                        ? 'law'
                        : selected.status === 'voting' || selected.status === 'active'
                        ? 'active'
                        : selected.status === 'failed'
                        ? 'failed'
                        : 'proposed'
                    }
                  >
                    {selected.status === 'law' ? 'Established Law' : selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                  </Badge>
                </div>

                {/* Vote count */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Total Votes</p>
                  <span className="text-sm font-mono font-bold text-white">
                    {selected.total_votes.toLocaleString()}
                  </span>
                </div>

                {/* Star size explanation */}
                <div className="rounded-xl bg-surface-200/50 border border-surface-300/50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-3.5 w-3.5 text-purple" aria-hidden />
                    <span className="text-[11px] font-mono text-surface-400">Star properties</span>
                  </div>
                  <p className="text-[10px] font-mono text-surface-500 leading-relaxed">
                    Color reflects vote split · Size reflects vote count · {selected.status === 'law' ? 'Gold ring marks established law · ' : ''}
                    {(selected.status === 'active' || selected.status === 'voting') ? 'Pulse indicates active debate' : ''}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 mt-auto border-t border-surface-300/60 space-y-2">
                <Link
                  href={`/topic/${selected.id}`}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-for-600/20 border border-for-500/30 text-for-300 text-sm font-mono font-semibold hover:bg-for-600/30 transition-colors"
                >
                  <span>View Topic</span>
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>

                {selected.status === 'law' && (
                  <Link
                    href={`/law`}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm font-mono font-semibold hover:bg-gold/20 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Gavel className="h-4 w-4" aria-hidden />
                      View in Codex
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}

                {(selected.status === 'active' || selected.status === 'voting') && (
                  <Link
                    href={`/topic/${selected.id}#vote`}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-purple/10 border border-purple/30 text-purple text-sm font-mono font-semibold hover:bg-purple/20 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4" aria-hidden />
                      Vote Now
                    </span>
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  )
}
