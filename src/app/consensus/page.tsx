'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  Loader2,
  RefreshCw,
  Scale,
  Tag,
  Zap,
} from 'lucide-react'
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
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { ConsensusNode, ConsensusResponse } from '@/app/api/consensus/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_RADIUS = 14
const MAX_RADIUS = 80
const TICK_MAX = 200
const PADDING = 8
const FONT_THRESHOLD = 36

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   '#c9a84c',
  Politics:    '#60a5fa',
  Technology:  '#a78bfa',
  Science:     '#34d399',
  Ethics:      '#f87171',
  Philosophy:  '#93c5fd',
  Culture:     '#fbbf24',
  Health:      '#fb7185',
  Environment: '#6ee7b7',
  Education:   '#c4b5fd',
}

// ─── Colour helpers ────────────────────────────────────────────────────────

function bubbleColor(bluePct: number): string {
  // 0-40  → red (against dominant)
  // 40-60 → gold (contested)
  // 60-100 → blue (for dominant)
  if (bluePct >= 60) {
    // interpolate blue-400 → blue-600
    const t = Math.min((bluePct - 60) / 40, 1)
    const r = Math.round(96 - t * 40)
    const g = Math.round(165 - t * 60)
    const b = Math.round(250 - t * 10)
    return `rgba(${r},${g},${b},0.85)`
  }
  if (bluePct <= 40) {
    // interpolate red-400 → red-600
    const t = Math.min((40 - bluePct) / 40, 1)
    const r = Math.round(248 - t * 30)
    const g = Math.round(113 - t * 40)
    const b = Math.round(113 - t * 40)
    return `rgba(${r},${g},${b},0.85)`
  }
  // contested — near 50/50 → gold
  const contestedness = 1 - Math.abs(bluePct - 50) / 10
  return `rgba(201,168,76,${0.5 + contestedness * 0.35})`
}

function bubbleStroke(bluePct: number): string {
  if (bluePct >= 60) return 'rgba(96,165,250,0.6)'
  if (bluePct <= 40) return 'rgba(248,113,113,0.6)'
  return 'rgba(201,168,76,0.6)'
}

// ─── Node type ─────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  data: ConsensusNode
  radius: number
  vx?: number
  vy?: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s
}

// ─── Tooltip ───────────────────────────────────────────────────────────────

interface TooltipData {
  node: ConsensusNode
  x: number
  y: number
}

function Tooltip({ data, containerRect }: { data: TooltipData; containerRect: DOMRect | null }) {
  const forPct = Math.round(data.node.blue_pct)
  const againstPct = 100 - forPct

  // Keep tooltip inside viewport
  const tipW = 240
  const tipH = 110
  const margin = 12

  let tx = data.x + margin
  let ty = data.y - tipH / 2

  if (containerRect) {
    if (tx + tipW > containerRect.width) tx = data.x - tipW - margin
    if (ty < 0) ty = margin
    if (ty + tipH > containerRect.height) ty = containerRect.height - tipH - margin
  }

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{ left: tx, top: ty, width: tipW }}
    >
      <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 shadow-xl shadow-black/50">
        <p className="text-xs font-mono text-white leading-tight mb-2 line-clamp-3">
          {data.node.statement}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-for-400 font-semibold">
            FOR {forPct}%
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-against-400 font-semibold">
            {againstPct}%
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-surface-500">
            {data.node.total_votes.toLocaleString()} votes
          </span>
          {data.node.category && (
            <span className="text-[10px] font-mono" style={{ color: CATEGORY_COLOR[data.node.category] ?? '#9ca3af' }}>
              {data.node.category}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function ConsensusPage() {
  const router = useRouter()
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simRef = useRef<Simulation<GraphNode, any> | null>(null)
  const animRef = useRef<number>(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes] = useState<ConsensusNode[]>([])
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [totalVotes, setTotalVotes] = useState(0)

  const [category, setCategory] = useState<string>('All')
  const [status, setStatus] = useState<'live' | 'all' | 'proposed'>('live')
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null)

  // SVG dimensions
  const [dims, setDims] = useState({ w: 800, h: 600 })

  // Track rendered graph nodes for interaction
  const graphNodesRef = useRef<GraphNode[]>([])

  // ── Measure container ───────────────────────────────────────────────────
  useEffect(() => {
    function measure() {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setDims({ w: rect.width, h: rect.height })
      setContainerRect(rect)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Fetch data ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setTooltip(null)
    try {
      const params = new URLSearchParams({
        category: category === 'All' ? 'all' : category,
        status,
        limit: '250',
      })
      const res = await fetch(`/api/consensus?${params}`)
      if (!res.ok) throw new Error('Failed to load')
      const json: ConsensusResponse = await res.json()
      setNodes(json.nodes)
      setGeneratedAt(json.generated_at)
      setTotalVotes(json.total_votes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [category, status])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Run force simulation + draw SVG ────────────────────────────────────
  useEffect(() => {
    if (loading || error || !nodes.length || !svgRef.current) return
    if (dims.w < 10 || dims.h < 10) return

    // Stop any previous sim
    if (simRef.current) simRef.current.stop()
    if (animRef.current) cancelAnimationFrame(animRef.current)

    // Scale radius by sqrt(votes), clamped
    const maxVotes = Math.max(...nodes.map((n) => n.total_votes), 1)
    const scale = (v: number) =>
      MIN_RADIUS + (Math.sqrt(v / maxVotes) * (MAX_RADIUS - MIN_RADIUS))

    const gnodes: GraphNode[] = nodes.map((n, i) => ({
      data: n,
      radius: scale(n.total_votes),
      // Random initial positions spread across canvas
      x: dims.w * 0.2 + Math.random() * dims.w * 0.6,
      y: dims.h * 0.2 + Math.random() * dims.h * 0.6,
      index: i,
    }))

    graphNodesRef.current = gnodes

    const sim = forceSimulation<GraphNode>(gnodes)
      .force('center', forceCenter(dims.w / 2, dims.h / 2))
      .force('charge', forceManyBody().strength(-4))
      .force('collide', forceCollide<GraphNode>((d) => d.radius + PADDING).iterations(3))
      .force('x', forceX(dims.w / 2).strength(0.04))
      .force('y', forceY(dims.h / 2).strength(0.04))
      .alphaDecay(0.02)
      .velocityDecay(0.4)
    simRef.current = sim

    const svg = svgRef.current
    let tickCount = 0

    function draw() {
      // Clear
      while (svg.firstChild) svg.removeChild(svg.firstChild)

      for (const gn of gnodes) {
        const x = gn.x ?? dims.w / 2
        const y = gn.y ?? dims.h / 2
        const r = gn.radius

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        g.setAttribute('transform', `translate(${x},${y})`)
        g.style.cursor = 'pointer'

        // Shadow circle for depth
        const shadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        shadow.setAttribute('r', String(r + 2))
        shadow.setAttribute('fill', 'rgba(0,0,0,0.3)')
        shadow.setAttribute('transform', 'translate(2,3)')
        g.appendChild(shadow)

        // Main circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('r', String(r))
        circle.setAttribute('fill', bubbleColor(gn.data.blue_pct))
        circle.setAttribute('stroke', bubbleStroke(gn.data.blue_pct))
        circle.setAttribute('stroke-width', '1.5')
        g.appendChild(circle)

        // Category dot (top-right)
        if (gn.data.category && r >= 22) {
          const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          dot.setAttribute('cx', String(r * 0.6))
          dot.setAttribute('cy', String(-r * 0.6))
          dot.setAttribute('r', '4')
          dot.setAttribute('fill', CATEGORY_COLOR[gn.data.category] ?? '#9ca3af')
          g.appendChild(dot)
        }

        // Label text inside big enough bubbles
        if (r >= FONT_THRESHOLD) {
          const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          txt.setAttribute('text-anchor', 'middle')
          txt.setAttribute('dominant-baseline', 'middle')
          txt.setAttribute('fill', 'rgba(255,255,255,0.9)')
          txt.setAttribute('font-size', String(Math.max(9, Math.min(12, r / 4))))
          txt.setAttribute('font-family', 'monospace')
          txt.style.pointerEvents = 'none'
          const label = truncate(gn.data.statement, Math.floor(r / 4))
          const words = label.split(' ')
          const mid = Math.ceil(words.length / 2)
          const line1 = words.slice(0, mid).join(' ')
          const line2 = words.slice(mid).join(' ')
          const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
          tspan1.setAttribute('x', '0')
          tspan1.setAttribute('dy', '-0.6em')
          tspan1.textContent = truncate(line1, Math.floor(r / 2.5))
          txt.appendChild(tspan1)
          if (line2) {
            const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
            tspan2.setAttribute('x', '0')
            tspan2.setAttribute('dy', '1.2em')
            tspan2.textContent = truncate(line2, Math.floor(r / 2.5))
            txt.appendChild(tspan2)
          }
          g.appendChild(txt)
        }

        // FOR/AGAINST mini arc indicator at bottom of bubble
        if (r >= 28) {
          const pct = gn.data.blue_pct / 100
          const barW = r * 1.2
          const barH = 3
          const barX = -barW / 2
          const barY = r - 6

          const barBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          barBg.setAttribute('x', String(barX))
          barBg.setAttribute('y', String(barY))
          barBg.setAttribute('width', String(barW))
          barBg.setAttribute('height', String(barH))
          barBg.setAttribute('rx', '1.5')
          barBg.setAttribute('fill', 'rgba(248,113,113,0.5)')
          g.appendChild(barBg)

          const barFill = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          barFill.setAttribute('x', String(barX))
          barFill.setAttribute('y', String(barY))
          barFill.setAttribute('width', String(barW * pct))
          barFill.setAttribute('height', String(barH))
          barFill.setAttribute('rx', '1.5')
          barFill.setAttribute('fill', 'rgba(96,165,250,0.8)')
          g.appendChild(barFill)
        }

        // Interaction layer
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        hitArea.setAttribute('r', String(r))
        hitArea.setAttribute('fill', 'transparent')
        g.appendChild(hitArea)

        g.addEventListener('mouseenter', () => {
          setTooltip({
            node: gn.data,
            x: x,
            y: y,
          })
          circle.setAttribute('stroke-width', '2.5')
          circle.setAttribute('filter', 'brightness(1.2)')
        })
        g.addEventListener('mouseleave', () => {
          setTooltip(null)
          circle.setAttribute('stroke-width', '1.5')
          circle.removeAttribute('filter')
        })
        g.addEventListener('click', () => {
          router.push(`/topic/${gn.data.id}`)
        })

        svg.appendChild(g)
      }
    }

    function tick() {
      tickCount++
      draw()
      if (tickCount < TICK_MAX && sim.alpha() > sim.alphaMin()) {
        sim.tick()
        animRef.current = requestAnimationFrame(tick)
      }
    }

    // Prime simulation without drawing for a few ticks first for better initial layout
    for (let i = 0; i < 30; i++) sim.tick()
    tick()

    return () => {
      sim.stop()
      cancelAnimationFrame(animRef.current)
    }
  }, [nodes, loading, error, dims, router])

  // ── Legend items ────────────────────────────────────────────────────────
  const forCount = nodes.filter((n) => n.blue_pct >= 55).length
  const againstCount = nodes.filter((n) => n.blue_pct <= 45).length
  const contestedCount = nodes.length - forCount - againstCount

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ── Header strip ──────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300">
                <Activity className="h-4 w-4 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-lg font-bold text-white leading-tight">
                  Consensus Engine
                </h1>
                <p className="text-xs font-mono text-surface-500">
                  {nodes.length} topics · {totalVotes.toLocaleString()} votes cast
                  {generatedAt && ` · refreshed ${relativeTime(generatedAt)}`}
                </p>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh"
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:text-white hover:border-surface-400 transition-all',
                'disabled:opacity-40'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-0.5 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5">
              {([
                { id: 'live', label: 'Live', icon: Zap },
                { id: 'all', label: 'All', icon: Scale },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setStatus(id)}
                  aria-pressed={status === id}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all',
                    status === id
                      ? 'bg-for-600 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 ml-2">
              <span className="flex items-center gap-1 text-[10px] font-mono text-for-400">
                <span className="inline-block h-2 w-2 rounded-full bg-for-500" />
                FOR ({forCount})
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-gold">
                <span className="inline-block h-2 w-2 rounded-full bg-gold/60" />
                Contested ({contestedCount})
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-against-400">
                <span className="inline-block h-2 w-2 rounded-full bg-against-500" />
                AGAINST ({againstCount})
              </span>
            </div>
          </div>

          {/* Category chips */}
          <div
            className={cn(
              'flex items-center gap-1.5',
              'overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          >
            <Tag className="h-3 w-3 text-surface-500 flex-shrink-0" />
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={cn(
                  'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
                  'border transition-all',
                  category === cat
                    ? 'bg-for-600/80 text-white border-for-600'
                    : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Visualization ─────────────────────────────────────────── */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
        >
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-for-400" />
                <p className="text-xs font-mono text-surface-500">
                  Mapping consensus…
                </p>
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-center space-y-3">
                <p className="text-sm font-mono text-against-400">{error}</p>
                <button
                  onClick={fetchData}
                  className="text-xs font-mono text-surface-500 hover:text-white transition-colors underline"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!loading && !error && nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-center space-y-2">
                <Scale className="h-8 w-8 text-surface-500 mx-auto" />
                <p className="text-sm font-mono text-surface-500">
                  No live topics in this category
                </p>
                <button
                  onClick={() => { setCategory('All'); setStatus('all') }}
                  className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Show all topics
                </button>
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            width={dims.w}
            height={dims.h}
            className={cn(
              'absolute inset-0 transition-opacity duration-300',
              loading ? 'opacity-0' : 'opacity-100'
            )}
            aria-label="Consensus bubble chart"
            role="img"
          />

          {/* Tooltip */}
          {tooltip && (
            <Tooltip data={tooltip} containerRect={containerRect} />
          )}

          {/* Instruction hint — shown briefly on first render */}
          {!loading && nodes.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <p className="text-[10px] font-mono text-surface-600 bg-surface-100/80 backdrop-blur-sm px-3 py-1 rounded-full border border-surface-300/50">
                Hover to explore · Click to open topic · Size = votes
              </p>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
