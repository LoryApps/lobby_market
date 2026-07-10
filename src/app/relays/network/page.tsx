'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
import {
  ArrowLeft,
  GitMerge,
  RefreshCw,
  Search,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { RelayNetworkResponse, NetworkNode, NetworkEdge } from '@/app/api/relays/network/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  elder:         '#f59e0b', // gold
  debator:       '#8b5cf6', // purple
  troll_catcher: '#ef4444', // against
  person:        '#3b82f6', // for-500
}

function roleColor(role: string): string {
  return ROLE_COLOR[role] ?? ROLE_COLOR.person
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function radiusFromCount(count: number): number {
  return Math.max(6, Math.min(22, 6 + Math.log2(count + 1) * 3))
}

// ─── D3 graph types ───────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string
  username: string
  display_name: string | null
  role: string
  relay_count: number
  leg_count: number
  radius: number
  color: string
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  weight: number
}

// ─── Network canvas ───────────────────────────────────────────────────────────

interface NetworkCanvasProps {
  nodes: NetworkNode[]
  edges: NetworkEdge[]
  searchQuery: string
  onHoverNode: (node: GraphNode | null, pos: { x: number; y: number }) => void
  onClickNode: (username: string) => void
}

function NetworkCanvas({ nodes, edges, searchQuery, onHoverNode, onClickNode }: NetworkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const gNodesRef = useRef<GraphNode[]>([])
  const gLinksRef = useRef<GraphLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const searchRef = useRef(searchQuery)
  const animFrameRef = useRef<number>(0)

  searchRef.current = searchQuery

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

    const q = searchRef.current.toLowerCase().trim()

    // Draw edges
    for (const link of gLinksRef.current) {
      const s = link.source as GraphNode
      const t = link.target as GraphNode
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue
      const sMatch = !q || s.username.toLowerCase().includes(q) || (s.display_name ?? '').toLowerCase().includes(q)
      const tMatch = !q || t.username.toLowerCase().includes(q) || (t.display_name ?? '').toLowerCase().includes(q)
      const edgeAlpha = q && !sMatch && !tMatch ? 0.02 : Math.min(0.5, 0.12 + (link.weight - 1) * 0.08)
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = `rgba(100,116,139,${edgeAlpha})`
      ctx.lineWidth = Math.min(3, 0.5 + link.weight * 0.5)
      ctx.stroke()
    }

    // Draw nodes
    for (const node of gNodesRef.current) {
      if (node.x == null || node.y == null) continue
      const isMatch = !q || node.username.toLowerCase().includes(q) || (node.display_name ?? '').toLowerCase().includes(q)
      const isDimmed = q.length > 0 && !isMatch
      const alpha = isDimmed ? 0.1 : 1.0

      // Glow for search match
      if (isMatch && q.length > 0) {
        const glow = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius + 12)
        glow.addColorStop(0, hexToRgba(node.color, 0.4))
        glow.addColorStop(1, hexToRgba(node.color, 0))
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 12, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      }

      // Node
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(node.color, alpha * 0.85)
      ctx.fill()
      ctx.strokeStyle = hexToRgba(node.color, alpha)
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Username label for larger nodes
      if ((node.radius > 10 || (isMatch && q.length > 0)) && !isDimmed) {
        const name = node.display_name ?? node.username
        const label = name.length > 14 ? name.slice(0, 13) + '…' : name
        ctx.fillStyle = `rgba(212,212,216,${alpha})`
        ctx.font = '9px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(label, node.x, node.y + node.radius + 3)
      }
    }

    ctx.restore()
  }, [])

  // Init simulation
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const W = rect.width || 600
    const H = rect.height || 500

    const gNodes: GraphNode[] = nodes.map((n) => ({
      ...n,
      radius: radiusFromCount(n.relay_count),
      color: roleColor(n.role),
    }))
    gNodesRef.current = gNodes

    const nodeIds = new Set(gNodes.map((n) => n.id))
    const gLinks: GraphLink[] = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, weight: e.weight }))
    gLinksRef.current = gLinks

    const sim = forceSimulation<GraphNode>(gNodes)
      .force('link', forceLink<GraphNode, GraphLink>(gLinks).id((d) => d.id).distance(60).strength(0.4))
      .force('charge', forceManyBody<GraphNode>().strength(-120))
      .force('center', forceCenter<GraphNode>(W / 2, H / 2).strength(0.08))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 4))
      .alphaDecay(0.025)
      .on('tick', () => {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = requestAnimationFrame(draw)
      })

    simRef.current = sim

    return () => {
      sim.stop()
      cancelAnimationFrame(animFrameRef.current)
      simRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges])

  // Resize handling
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const r = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = r.width * dpr
      canvas.height = r.height * dpr
      canvas.style.width = `${r.width}px`
      canvas.style.height = `${r.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (simRef.current) {
        simRef.current.force('center', forceCenter<GraphNode>(r.width / 2, r.height / 2).strength(0.08))
        simRef.current.alpha(0.3).restart()
      }
      draw()
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mouse helpers
  function getCanvasPos(e: React.MouseEvent) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const r = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - r.left - transformRef.current.x) / transformRef.current.k,
      y: (e.clientY - r.top - transformRef.current.y) / transformRef.current.k,
    }
  }

  function getNodeAt(cx: number, cy: number): GraphNode | null {
    for (const n of gNodesRef.current) {
      if (n.x == null || n.y == null) continue
      const dx = cx - n.x, dy = cy - n.y
      if (dx * dx + dy * dy <= (n.radius + 4) ** 2) return n
    }
    return null
  }

  function onMouseMove(e: React.MouseEvent) {
    const { x, y } = getCanvasPos(e)
    const node = getNodeAt(x, y)
    onHoverNode(node, { x: e.clientX, y: e.clientY })
    if (canvasRef.current) canvasRef.current.style.cursor = node ? 'pointer' : isPanningRef.current ? 'grabbing' : 'grab'
    if (isPanningRef.current) {
      transformRef.current.x += e.clientX - panStartRef.current.x
      transformRef.current.y += e.clientY - panStartRef.current.y
      panStartRef.current = { x: e.clientX, y: e.clientY }
      draw()
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    const { x, y } = getCanvasPos(e)
    if (!getNodeAt(x, y)) {
      isPanningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }

  function onMouseUp() { isPanningRef.current = false }

  function onClick(e: React.MouseEvent) {
    const { x, y } = getCanvasPos(e)
    const node = getNodeAt(x, y)
    if (node) onClickNode(node.username)
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const newK = Math.max(0.25, Math.min(4, transformRef.current.k * factor))
    const ratio = newK / transformRef.current.k
    transformRef.current = {
      x: cx - ratio * (cx - transformRef.current.x),
      y: cy - ratio * (cy - transformRef.current.y),
      k: newK,
    }
    draw()
  }

  return (
    <div ref={containerRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onClick}
        onWheel={onWheel}
        className="block w-full h-full"
        style={{ cursor: 'grab' }}
        role="img"
        aria-label="Relay participant network graph"
      />
    </div>
  )
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  node: GraphNode
  pos: { x: number; y: number }
}

function Tooltip({ node, pos }: TooltipProps) {
  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.12 }}
      className="fixed z-50 pointer-events-none"
      style={{ left: pos.x + 14, top: pos.y - 12 }}
    >
      <div className="rounded-xl bg-surface-100 border border-surface-300 shadow-xl p-3 max-w-[200px]">
        <div className="flex items-center gap-2 mb-1.5">
          <Avatar
            src={null}
            username={node.username}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-tight truncate">
              {node.display_name ?? node.username}
            </p>
            <p className="text-[10px] font-mono text-surface-500">@{node.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="text-for-400">{node.relay_count} relays</span>
          <span className="text-surface-500">{node.leg_count} legs</span>
        </div>
        <div
          className="mt-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded inline-block capitalize"
          style={{ color: node.color, background: hexToRgba(node.color, 0.15) }}
        >
          {node.role.replace('_', ' ')}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const roles = [
    { role: 'elder', label: 'Elder' },
    { role: 'debator', label: 'Debator' },
    { role: 'troll_catcher', label: 'Troll Catcher' },
    { role: 'person', label: 'Citizen' },
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {roles.map(({ role, label }) => (
        <div key={role} className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: roleColor(role) }}
          />
          <span className="text-[10px] font-mono text-surface-500">{label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2 border-l border-surface-300 pl-3">
        <span className="text-[10px] font-mono text-surface-600">Node size = relay count</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-surface-600">Edge weight = shared relays</span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RelayNetworkPage() {
  const router = useRouter()
  const [data, setData] = useState<RelayNetworkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relays/network', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (err) {
      setError((err as Error).message ?? 'Failed to load network')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleHoverNode = useCallback((node: GraphNode | null, pos: { x: number; y: number }) => {
    setHoverNode(node)
    setHoverPos(pos)
  }, [])

  const handleClickNode = useCallback((username: string) => {
    router.push(`/profile/${username}`)
  }, [router])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex flex-col flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Link
            href="/relays"
            className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mt-0.5"
          >
            <ArrowLeft className="h-4 w-4" />
            Relays
          </Link>
          <span className="text-surface-600 mt-0.5">/</span>
          <span className="text-sm font-mono text-surface-500 mt-0.5">Network</span>
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center">
                <GitMerge className="h-5 w-5 text-for-400" />
              </div>
              <h1 className="font-mono text-xl font-bold text-white">Relay Network</h1>
            </div>
            <p className="text-sm text-surface-500 ml-11">
              Who argues with whom — civic relay collaboration graph
            </p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh network"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40 flex-shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Stats strip */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-4"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="font-mono text-lg font-bold text-for-400">{data.nodes.length}</p>
              <p className="text-[10px] font-mono text-surface-500">Participants shown</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="font-mono text-lg font-bold text-purple">{data.edges.length}</p>
              <p className="text-[10px] font-mono text-surface-500">Collaborations</p>
            </div>
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
              <p className="font-mono text-lg font-bold text-gold">{data.total_relays}</p>
              <p className="text-[10px] font-mono text-surface-500">Total relays</p>
            </div>
          </motion.div>
        )}

        {/* Search */}
        {data && data.nodes.length > 0 && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search participants…"
              className="w-full pl-8 pr-8 py-2 rounded-lg bg-surface-100 border border-surface-300 text-sm font-mono text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Canvas */}
        <div className="relative flex-1 min-h-[420px] rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-100">
              <Zap className="h-8 w-8 text-for-400 animate-pulse" />
              <p className="text-sm font-mono text-surface-500">Building relay network…</p>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
              <GitMerge className="h-10 w-10 text-surface-600" />
              <div>
                <p className="text-sm font-mono font-semibold text-surface-400 mb-1">Could not load network</p>
                <p className="text-xs font-mono text-surface-600 mb-4">{error}</p>
                <button
                  onClick={load}
                  className="flex items-center gap-1.5 mx-auto px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && data && data.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
              <Users className="h-10 w-10 text-surface-600" />
              <div>
                <p className="text-sm font-mono font-semibold text-surface-400 mb-1">No relay network yet</p>
                <p className="text-xs font-mono text-surface-600 mb-4">Start or join relay chains to build the network.</p>
                <Link
                  href="/relays/create"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-500/20 border border-for-500/30 text-sm font-mono text-for-400 hover:bg-for-500/30 transition-colors"
                >
                  <GitMerge className="h-3.5 w-3.5" />
                  Start a Relay
                </Link>
              </div>
            </div>
          )}

          {!loading && !error && data && data.nodes.length > 0 && (
            <NetworkCanvas
              nodes={data.nodes}
              edges={data.edges}
              searchQuery={search}
              onHoverNode={handleHoverNode}
              onClickNode={handleClickNode}
            />
          )}

          {/* Zoom hint */}
          {!loading && data && data.nodes.length > 0 && (
            <div className="absolute bottom-3 right-3 text-[10px] font-mono text-surface-600 pointer-events-none">
              Scroll to zoom · Drag to pan · Click node to visit profile
            </div>
          )}
        </div>

        {/* Legend */}
        {!loading && data && data.nodes.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 px-1"
          >
            <Legend />
          </motion.div>
        )}

        {/* Footer links */}
        <div className="mt-6 pt-4 border-t border-surface-300/30 flex flex-wrap gap-4">
          <Link href="/relays" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <GitMerge className="h-3.5 w-3.5" />Browse Relays
          </Link>
          <Link href="/relays/stats" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <Zap className="h-3.5 w-3.5" />Relay Stats
          </Link>
          <Link href="/relays/champions" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <Users className="h-3.5 w-3.5" />Champions
          </Link>
          <Link href="/leaderboard/relay" className="flex items-center gap-1.5 text-[12px] font-mono text-surface-500 hover:text-white transition-colors">
            <Users className="h-3.5 w-3.5" />Leaderboard
          </Link>
        </div>
      </main>

      <BottomNav />

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoverNode && (
          <Tooltip node={hoverNode} pos={hoverPos} />
        )}
      </AnimatePresence>
    </div>
  )
}
