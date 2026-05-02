'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Flame,
  Gavel,
  Loader2,
  Network,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { graphColorForCategory } from '@/lib/utils/graph-colors'
import { cn } from '@/lib/utils/cn'
import type { InfluenceGraphData } from '@/app/api/influence/graph/route'

// Lazy-load the heavy D3 canvas
const InfluenceGraph = dynamic(
  () => import('./InfluenceGraph').then((m) => m.InfluenceGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 text-for-400 animate-spin" />
          <p className="text-sm font-mono text-surface-500">Building your civic web…</p>
        </div>
      </div>
    ),
  }
)

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string
  value: number | string
  icon: typeof TrendingUp
  color: string
  subtitle?: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <div className={cn('flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg', color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider truncate">{label}</p>
        <p className="text-xl font-mono font-bold text-white leading-tight">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        {subtitle && <p className="text-[11px] text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: 'bg-gold border-gold/60', label: 'Became Law', dot: true },
    { color: 'bg-for-500/20 border-for-500/60', label: 'You voted FOR', dot: true },
    { color: 'bg-against-500/20 border-against-500/60', label: 'You voted AGAINST', dot: true },
    { color: 'bg-surface-300/40 border-surface-400/40', label: 'Category cluster', dot: true },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={cn('h-3 w-3 rounded-full border', item.color)} />
          <span className="text-[11px] font-mono text-surface-500">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Category breakdown bar ───────────────────────────────────────────────────

function CategoryBar({ category, count, forPct, totalVotes }: {
  category: string
  count: number
  forPct: number
  totalVotes: number
}) {
  const color = graphColorForCategory(category)
  const widthPct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="text-xs font-mono text-surface-400">{category}</span>
        </div>
        <span className="text-[11px] font-mono text-surface-500">{count} votes</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${widthPct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-surface-600">
        <span className="text-for-500">{forPct}% FOR</span>
        <span className="text-against-500">{100 - forPct}% AGAINST</span>
      </div>
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function InfluenceClient() {
  const router = useRouter()
  const [data, setData] = useState<InfluenceGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/influence/graph')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as InfluenceGraphData
      setData(json)
    } catch {
      setError('Could not load your influence graph.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const stats = data?.stats

  return (
    <div className="flex flex-col h-screen bg-surface-50 overflow-hidden">
      <TopBar />

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-300/60 bg-surface-100/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2.5">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4 text-surface-500" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/30">
              <Network className="h-4 w-4 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-sm font-bold text-white leading-none">Civic Influence</h1>
              <p className="text-[11px] font-mono text-surface-500 leading-none mt-0.5">Your vote network</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen((s) => !s)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors',
              sidebarOpen
                ? 'bg-for-500/15 border-for-500/40 text-for-400'
                : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
            )}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Stats
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors disabled:opacity-50"
            aria-label="Refresh graph"
          >
            <RefreshCw className={cn('h-3.5 w-3.5 text-surface-500', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Graph canvas */}
        <div className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-surface-50/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full border-2 border-for-500/30 flex items-center justify-center">
                    <Network className="h-6 w-6 text-for-400" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-for-400 animate-spin" />
                </div>
                <p className="text-sm font-mono text-surface-500">Mapping your civic influence…</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <EmptyState
                icon={Activity}
                title="Couldn't load graph"
                description={error}
                actions={[{ label: 'Retry', onClick: load }]}
              />
            </div>
          )}

          {!loading && !error && data && data.nodes.length <= 1 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <EmptyState
                icon={Network}
                title="No votes yet"
                description="Cast your first votes on civic topics — your influence graph will appear here."
                actions={[{ label: 'Browse topics', href: '/' }]}
              />
            </div>
          )}

          {!loading && !error && data && data.nodes.length > 1 && (
            <InfluenceGraph
              nodes={data.nodes}
              edges={data.edges}
              className="absolute inset-0"
            />
          )}

          {/* Legend overlay */}
          {!loading && !error && data && data.nodes.length > 1 && (
            <div className="absolute bottom-4 left-4 z-10">
              <div className="bg-surface-100/90 backdrop-blur border border-surface-300/60 rounded-xl p-3">
                <Legend />
                <p className="text-[10px] font-mono text-surface-600 mt-2">
                  Drag nodes · Scroll to zoom · Click topics to open
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {sidebarOpen && stats && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex-shrink-0 overflow-y-auto overflow-x-hidden border-l border-surface-300/60 bg-surface-100/80 backdrop-blur-sm"
            >
              <div className="p-4 space-y-5" style={{ minWidth: 280 }}>

                {/* Core stats */}
                <div>
                  <h2 className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Your Civic Footprint
                  </h2>
                  <div className="space-y-2">
                    <StatCard
                      label="Total Votes"
                      value={stats.totalVotes}
                      icon={Zap}
                      color="bg-for-500/10 border border-for-500/30 text-for-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        label="FOR"
                        value={stats.forVotes}
                        icon={ThumbsUp}
                        color="bg-for-500/10 text-for-400"
                      />
                      <StatCard
                        label="AGAINST"
                        value={stats.againstVotes}
                        icon={ThumbsDown}
                        color="bg-against-500/10 text-against-400"
                      />
                    </div>
                    <StatCard
                      label="Laws Helped Pass"
                      value={stats.lawsContributed}
                      icon={Gavel}
                      color="bg-gold/10 text-gold"
                      subtitle="Topics you voted FOR that became law"
                    />
                    <StatCard
                      label="Consensus Rate"
                      value={`${stats.winRate}%`}
                      icon={Trophy}
                      color="bg-emerald/10 text-emerald"
                      subtitle="Times you voted with the majority"
                    />
                    <StatCard
                      label="Last 30 Days"
                      value={stats.activitiesLastMonth}
                      icon={Flame}
                      color="bg-against-500/10 text-against-400"
                      subtitle="Votes in the past month"
                    />
                  </div>
                </div>

                {/* Category breakdown */}
                {stats.categoryBreakdown.length > 0 && (
                  <div>
                    <h2 className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                      Category Breakdown
                    </h2>
                    <div className="space-y-3">
                      {stats.categoryBreakdown.slice(0, 6).map((cat) => (
                        <CategoryBar
                          key={cat.category}
                          category={cat.category}
                          count={cat.count}
                          forPct={cat.forPct}
                          totalVotes={stats.totalVotes}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick links */}
                <div>
                  <h2 className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                    Dive Deeper
                  </h2>
                  <div className="space-y-1.5">
                    {[
                      { href: '/analytics', label: 'Full Analytics', icon: BarChart2 },
                      { href: '/compass', label: 'Civic Compass', icon: Activity },
                      { href: '/impact', label: 'Civic Impact', icon: Scale },
                      { href: '/twins', label: 'Civic Twins', icon: TrendingUp },
                    ].map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-colors group"
                      >
                        <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 transition-colors" />
                        <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors">{label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Loading skeleton for sidebar */}
        {loading && sidebarOpen && (
          <aside className="w-[280px] flex-shrink-0 border-l border-surface-300/60 bg-surface-100/80 p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </aside>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
