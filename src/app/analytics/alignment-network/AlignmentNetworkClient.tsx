'use client'

/**
 * /analytics/alignment-network — Civic Alignment Network Graph
 *
 * A force-directed visual map of your civic social graph. Each node is a person
 * in your network (people you follow + coalition members), sized by common topics
 * and coloured by agreement level — green = high alignment, red = low alignment.
 * You appear as the central anchor node.
 *
 * Distinct from:
 *   /analytics/alignment  — tabular list of alignment scores for your network
 *   /analytics/kin        — finds allies/rivals across the whole platform
 *   /network              — activity feed of what your network is doing
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  GitMerge,
  Info,
  Network,
  RefreshCw,
  Shield,
  Users,
  Zap,
} from 'lucide-react'
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
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { AlignedUser, AlignmentNetworkResponse } from '@/app/api/analytics/alignment-network/route'

// ─── Colour helpers ───────────────────────────────────────────────────────────

function agreementColor(pct: number): string {
  if (pct >= 80) return '#10b981' // emerald
  if (pct >= 65) return '#34d399' // emerald-400
  if (pct >= 50) return '#60a5fa' // for-400 blue
  if (pct >= 35) return '#f59e0b' // gold
  if (pct >= 20) return '#f87171' // against-400
  return '#ef4444'                // against-500 red
}

function agreementLabel(pct: number): { label: string; color: string; bg: string; border: string } {
  if (pct >= 80) return { label: 'Very High', color: 'text-emerald',     bg: 'bg-emerald/10',      border: 'border-emerald/30' }
  if (pct >= 65) return { label: 'High',      color: 'text-for-300',     bg: 'bg-for-500/10',      border: 'border-for-500/30' }
  if (pct >= 50) return { label: 'Moderate',  color: 'text-for-400',     bg: 'bg-for-500/8',       border: 'border-for-500/20' }
  if (pct >= 35) return { label: 'Mixed',     color: 'text-gold',        bg: 'bg-gold/10',          border: 'border-gold/30' }
  if (pct >= 20) return { label: 'Low',       color: 'text-against-400', bg: 'bg-against-500/10',  border: 'border-against-500/30' }
  return               { label: 'Very Low',  color: 'text-against-300', bg: 'bg-against-600/10',  border: 'border-against-600/30' }
}

function echoChamberLabel(avgPct: number | null): { label: string; desc: string; color: string; bg: string } {
  if (avgPct === null) return {
    label: 'Unknown', desc: 'Not enough shared votes to measure', color: 'text-surface-500', bg: 'bg-surface-200',
  }
  if (avgPct >= 80) return {
    label: 'Echo Chamber', desc: 'Very high ideological uniformity in your network', color: 'text-against-400', bg: 'bg-against-500/10',
  }
  if (avgPct >= 65) return {
    label: 'Somewhat Uniform', desc: 'Your network leans toward agreement', color: 'text-gold', bg: 'bg-gold/10',
  }
  if (avgPct >= 45) return {
    label: 'Balanced', desc: 'A healthy mix of agreement and disagreement', color: 'text-emerald', bg: 'bg-emerald/10',
  }
  return {
    label: 'Diverse', desc: 'Your network challenges your views regularly', color: 'text-for-400', bg: 'bg-for-500/10',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  agreementPct: number
  commonTopics: number
  source: 'self' | 'following' | 'coalition'
  radius: number
  color: string
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode
  target: string | GraphNode
  agreementPct: number
  source_type: 'following' | 'coalition'
}

interface HoverInfo {
  node: GraphNode
  x: number
  y: number
}

// ─── Canvas graph ─────────────────────────────────────────────────────────────

interface NetworkGraphProps {
  users: AlignedUser[]
  myUsername: string
  className?: string
  onNodeClick: (username: string) => void
}

function NetworkGraph({ users, myUsername, className, onNodeClick }: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulation<GraphNode, GraphLink> | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const linksRef = useRef<GraphLink[]>([])
  const [hover, setHover] = useState<HoverInfo | null>(null)
  const animFrameRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas

    ctx.clearRect(0, 0, width, height)

    const nodes = nodesRef.current
    const links = linksRef.current

    // Draw edges
    for (const link of links) {
      const s = link.source as GraphNode
      const t = link.target as GraphNode
      if (s.x == null || s.y == null || t.x == null || t.y == null) continue

      const color = agreementColor(link.agreementPct)
      const alpha = 0.25 + (link.agreementPct / 100) * 0.4

      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(t.x, t.y)
      ctx.strokeStyle = color + Math.round(alpha * 255).toString(16).padStart(2, '0')
      ctx.lineWidth = link.source_type === 'coalition' ? 1.5 : 1
      if (link.source_type === 'coalition') {
        ctx.setLineDash([4, 3])
      } else {
        ctx.setLineDash([])
      }
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Draw nodes
    for (const node of nodes) {
      if (node.x == null || node.y == null) continue

      const r = node.radius
      const isSelf = node.source === 'self'

      // Outer ring (glow)
      if (!isSelf) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2)
        ctx.fillStyle = node.color + '22'
        ctx.fill()
      }

      // Main circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)

      if (isSelf) {
        const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, 0, node.x, node.y, r)
        grad.addColorStop(0, '#60a5fa')
        grad.addColorStop(1, '#1d4ed8')
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = '#1c1c27'
      }
      ctx.fill()

      // Border ring
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = isSelf ? '#93c5fd' : node.color
      ctx.lineWidth = isSelf ? 2.5 : 1.5
      ctx.stroke()

      // Coalition diamond marker
      if (node.source === 'coalition') {
        const dm = 4
        ctx.beginPath()
        ctx.moveTo(node.x, node.y - r - dm - 2)
        ctx.lineTo(node.x + dm, node.y - r - 2)
        ctx.lineTo(node.x, node.y - r + dm - 2)
        ctx.lineTo(node.x - dm, node.y - r - 2)
        ctx.closePath()
        ctx.fillStyle = '#a78bfa'
        ctx.fill()
      }
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const W = rect.width || 640
    const H = rect.height || 480

    canvasRef.current.width = W
    canvasRef.current.height = H

    const selfNode: GraphNode = {
      id: 'self',
      username: myUsername,
      displayName: null,
      avatarUrl: null,
      role: 'person',
      agreementPct: 100,
      commonTopics: 0,
      source: 'self',
      radius: 22,
      color: '#60a5fa',
      x: W / 2,
      y: H / 2,
      fx: W / 2,
      fy: H / 2,
    }

    const userNodes: GraphNode[] = users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      avatarUrl: u.avatar_url,
      role: u.role,
      agreementPct: u.agreement_pct,
      commonTopics: u.common_topics,
      source: u.source,
      radius: Math.max(8, Math.min(18, 8 + Math.log(u.common_topics + 1) * 3)),
      color: agreementColor(u.agreement_pct),
    }))

    const allNodes: GraphNode[] = [selfNode, ...userNodes]
    nodesRef.current = allNodes

    const links: GraphLink[] = userNodes.map((u) => ({
      source: 'self',
      target: u.id,
      agreementPct: u.agreementPct,
      source_type: u.source,
    }))
    linksRef.current = links

    const sim = forceSimulation<GraphNode>(allNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => {
            const link = d as GraphLink
            const agPct = link.agreementPct
            return 60 + (1 - agPct / 100) * 80
          })
          .strength(0.6),
      )
      .force('charge', forceManyBody<GraphNode>().strength(-120))
      .force('center', forceCenter<GraphNode>(W / 2, H / 2).strength(0.05))
      .force('collide', forceCollide<GraphNode>().radius((d) => (d as GraphNode).radius + 8))
      .force('x', forceX<GraphNode>(W / 2).strength(0.04))
      .force('y', forceY<GraphNode>(H / 2).strength(0.04))
      .alphaDecay(0.03)

    simRef.current = sim
    sim.on('tick', () => {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = requestAnimationFrame(draw)
    })

    return () => {
      sim.stop()
      cancelAnimationFrame(animFrameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, myUsername])

  function getNodeAt(cx: number, cy: number): GraphNode | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = cx - rect.left
    const y = cy - rect.top
    return (
      nodesRef.current.find((n) => {
        if (n.x == null || n.y == null) return false
        const dx = n.x - x
        const dy = n.y - y
        return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4
      }) ?? null
    )
  }

  function handleMouseMove(e: React.MouseEvent) {
    const node = getNodeAt(e.clientX, e.clientY)
    if (node && node.source !== 'self') {
      const canvas = canvasRef.current!
      const rect = canvas.getBoundingClientRect()
      setHover({ node, x: (node.x ?? 0) + rect.left, y: (node.y ?? 0) + rect.top })
    } else {
      setHover(null)
    }
  }

  function handleClick(e: React.MouseEvent) {
    const node = getNodeAt(e.clientX, e.clientY)
    if (node && node.source !== 'self') {
      onNodeClick(node.username)
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer rounded-2xl"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
      />
      {/* Hover tooltip */}
      <AnimatePresence>
        {hover && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 pointer-events-none"
            style={{ left: hover.x + 12, top: hover.y - 60 }}
          >
            <div className="bg-surface-100 border border-surface-300 rounded-xl px-3 py-2.5 shadow-xl min-w-[160px]">
              <p className="text-xs font-mono font-semibold text-white truncate">
                {hover.node.displayName || hover.node.username}
              </p>
              <p className="text-[10px] text-surface-500 mb-1.5">@{hover.node.username}</p>
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 rounded-full flex-1"
                  style={{ background: `linear-gradient(to right, ${agreementColor(hover.node.agreementPct)}, ${agreementColor(hover.node.agreementPct)}44)` }}
                />
                <span
                  className="text-[10px] font-mono font-bold"
                  style={{ color: agreementColor(hover.node.agreementPct) }}
                >
                  {hover.node.agreementPct}%
                </span>
              </div>
              <p className="text-[10px] text-surface-500 mt-0.5">
                {hover.node.commonTopics} shared topic{hover.node.commonTopics !== 1 ? 's' : ''}
              </p>
              <div className="mt-1.5 flex items-center gap-1">
                <span className={cn(
                  'text-[9px] font-mono px-1.5 py-0.5 rounded border',
                  hover.node.source === 'coalition' ? 'text-purple bg-purple/10 border-purple/30' : 'text-for-400 bg-for-500/10 border-for-500/30',
                )}>
                  {hover.node.source === 'coalition' ? 'Coalition' : 'Following'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1.5 bg-surface-100/90 backdrop-blur-sm border border-surface-300 rounded-xl p-2.5">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">Agreement</p>
        {[
          { label: '80–100%', color: '#10b981' },
          { label: '50–79%', color: '#60a5fa' },
          { label: '35–49%', color: '#f59e0b' },
          { label: '0–34%', color: '#ef4444' },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-surface-400 font-mono">{label}</span>
          </div>
        ))}
        <div className="mt-1 pt-1 border-t border-surface-300/50 flex items-center gap-1.5">
          <div className="h-1 w-4 rounded-full bg-for-500" />
          <span className="text-[10px] text-surface-400 font-mono">Following</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-px">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1 w-1 rounded-full bg-purple" />
            ))}
          </div>
          <span className="text-[10px] text-surface-400 font-mono">Coalition</span>
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = 'text-white',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={cn('text-2xl font-mono font-bold', accent)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      {sub && <p className="text-[11px] text-surface-500 mt-0.5 leading-tight">{sub}</p>}
    </div>
  )
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({ user }: { user: AlignedUser }) {
  const al = agreementLabel(user.agreement_pct)
  return (
    <Link
      href={`/profile/${user.username}`}
      className="flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
    >
      <Avatar src={user.avatar_url} fallback={user.display_name || user.username} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate group-hover:text-for-300 transition-colors">
          {user.display_name || user.username}
        </p>
        <p className="text-[11px] text-surface-500">
          @{user.username} · {user.common_topics} shared topic{user.common_topics !== 1 ? 's' : ''}
        </p>
      </div>
      <div className={cn('flex-shrink-0 px-2 py-0.5 rounded-lg border text-[10px] font-mono font-bold', al.color, al.bg, al.border)}>
        {user.agreement_pct}%
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
    </Link>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function UserRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-100 border border-surface-300">
      <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2.5 w-32" />
      </div>
      <Skeleton className="h-5 w-10 rounded-lg" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlignmentNetworkClient() {
  const router = useRouter()
  const [data, setData] = useState<AlignmentNetworkResponse | null>(null)
  const [myUsername, setMyUsername] = useState<string>('you')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<'following' | 'coalition'>('following')

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [netRes, meRes] = await Promise.all([
        fetch('/api/analytics/alignment-network', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
      ])

      if (netRes.status === 401) {
        router.push('/login')
        return
      }
      if (!netRes.ok) throw new Error('alignment-network fetch failed')

      const [netData, meData] = await Promise.all([
        netRes.json() as Promise<AlignmentNetworkResponse>,
        meRes.ok ? (meRes.json() as Promise<{ username?: string }>) : Promise.resolve({}),
      ])

      setData(netData)
      if (meData?.username) setMyUsername(meData.username)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const allUsers = data ? [...data.following, ...data.coalition] : []
  const displayList = data ? (activeTab === 'following' ? data.following : data.coalition) : []
  const hasCoalition = (data?.coalition.length ?? 0) > 0

  const stats = data?.stats
  const avgPct = activeTab === 'following' ? stats?.avg_following_pct : stats?.avg_coalition_pct
  const echoLabel = echoChamberLabel(stats?.avg_following_pct ?? null)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          <Link href="/analytics" className="mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors flex-shrink-0">
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Network className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Alignment Network</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">Your civic social graph by ideological alignment</p>
            </div>
          </div>
        </div>

        {/* ── Stats bar ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : data && !error ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Following"
              value={stats?.total_following ?? 0}
              sub={`${stats?.scored_following ?? 0} scored`}
              accent="text-for-300"
            />
            <StatCard
              label="Avg Alignment"
              value={stats?.avg_following_pct != null ? `${stats.avg_following_pct}%` : '—'}
              sub="with people you follow"
              accent={stats?.avg_following_pct != null ? (stats.avg_following_pct >= 65 ? 'text-against-400' : 'text-emerald') : 'text-surface-500'}
            />
            <StatCard
              label="Coalition"
              value={stats?.total_coalition ?? 0}
              sub={`${stats?.scored_coalition ?? 0} scored`}
              accent="text-purple"
            />
            <div className={cn('rounded-2xl border p-4', echoLabel.bg, 'border-surface-300')}>
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">Network Health</p>
              <p className={cn('text-sm font-mono font-bold', echoLabel.color)}>{echoLabel.label}</p>
              <p className="text-[11px] text-surface-500 mt-0.5 leading-tight">{echoLabel.desc}</p>
            </div>
          </div>
        ) : null}

        {/* ── Graph ──────────────────────────────────────────────────────── */}
        {loading ? (
          <Skeleton className="w-full rounded-2xl mb-6" style={{ height: 480 }} />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center mb-6">
            <p className="text-surface-500 font-mono text-sm">Failed to load network data.</p>
            <button onClick={load} className="mt-3 text-xs text-for-400 hover:text-for-300 font-mono flex items-center gap-1 mx-auto">
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : !data?.viewer_has_votes ? (
          <EmptyState
            icon={Zap}
            title="Cast some votes first"
            description="Vote on at least 3 topics to see your alignment network."
            actions={[{ label: 'Browse topics', href: '/' }]}
            className="mb-6"
          />
        ) : allUsers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No network yet"
            description="Follow people or join coalitions to see your alignment network."
            actions={[{ label: 'Find people', href: '/discover' }]}
            className="mb-6"
          />
        ) : (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 mb-6 overflow-hidden">
            {/* How to use hint */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-300/50 bg-surface-200/30">
              <Info className="h-3 w-3 text-surface-500 flex-shrink-0" />
              <p className="text-[11px] text-surface-500 font-mono">
                Hover nodes for details · Click to view profile · Node size = shared topics · Edge color = alignment level
              </p>
            </div>
            <NetworkGraph
              users={allUsers}
              myUsername={myUsername}
              className="h-[480px]"
              onNodeClick={(username) => router.push(`/profile/${username}`)}
            />
          </div>
        )}

        {/* ── User list ──────────────────────────────────────────────────── */}
        {data && !error && allUsers.length > 0 && (
          <>
            {/* Tab selector */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setActiveTab('following')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all',
                  activeTab === 'following'
                    ? 'bg-for-500/20 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-surface-400',
                )}
              >
                <Users className="h-3 w-3" />
                Following
                <span className="ml-0.5 opacity-60">({data.following.length})</span>
              </button>
              {hasCoalition && (
                <button
                  onClick={() => setActiveTab('coalition')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all',
                    activeTab === 'coalition'
                      ? 'bg-purple/20 border-purple/40 text-purple'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-surface-400',
                  )}
                >
                  <Shield className="h-3 w-3" />
                  Coalition
                  <span className="ml-0.5 opacity-60">({data.coalition.length})</span>
                </button>
              )}

              {/* Sort note */}
              {displayList.length > 0 && (
                <span className="ml-auto text-[11px] font-mono text-surface-600">
                  Sorted by highest agreement
                </span>
              )}
            </div>

            {/* Echo chamber warning */}
            {activeTab === 'following' && stats?.avg_following_pct != null && stats.avg_following_pct >= 75 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-start gap-3 px-4 py-3.5 rounded-xl bg-against-500/8 border border-against-500/25"
              >
                <GitMerge className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-mono font-semibold text-against-400">Echo Chamber Alert</p>
                  <p className="text-[11px] text-surface-500 mt-0.5">
                    {Math.round(stats.avg_following_pct)}% average agreement — your network may be reinforcing your existing views.
                    Consider following people from the{' '}
                    <Link href="/discover" className="text-for-400 hover:underline">Discover</Link> or{' '}
                    <Link href="/analytics/kin" className="text-for-400 hover:underline">Civic Kin</Link> pages who challenge your positions.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Average bar */}
            {avgPct != null && displayList.length > 0 && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-mono text-surface-500">
                    Avg alignment: <span className="text-white font-semibold">{avgPct}%</span>
                  </span>
                  <span className={cn('text-[10px] font-mono font-semibold', echoChamberLabel(avgPct).color)}>
                    {echoChamberLabel(avgPct).label}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${avgPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(to right, ${agreementColor(0)}, ${agreementColor(avgPct)})` }}
                  />
                </div>
              </div>
            )}

            {/* User rows */}
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <UserRowSkeleton key={i} />)}
              </div>
            ) : displayList.length === 0 ? (
              <EmptyState
                icon={activeTab === 'coalition' ? Shield : Users}
                title={activeTab === 'coalition' ? 'No coalition members scored' : 'No followed users scored'}
                description="At least 3 shared topic votes are needed to compute alignment."
              />
            ) : (
              <div className="space-y-2">
                {displayList.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Related links ───────────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-surface-300/50 flex flex-wrap gap-3">
          {[
            { href: '/analytics/alignment', label: 'Alignment Report', icon: GitMerge, color: 'text-for-400 border-for-500/30 bg-for-500/8' },
            { href: '/analytics/kin', label: 'Civic Kin', icon: Users, color: 'text-emerald border-emerald/30 bg-emerald/8' },
            { href: '/analytics/network', label: 'Network Activity', icon: Network, color: 'text-purple border-purple/30 bg-purple/8' },
            { href: '/discover', label: 'Discover Users', icon: ExternalLink, color: 'text-gold border-gold/30 bg-gold/8' },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors hover:opacity-80', color)}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Link>
          ))}
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
