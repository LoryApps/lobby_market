'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Cpu,
  Flame,
  Gavel,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FlowResponse, CategoryFlow, FlowTick, FlowStats } from '@/app/api/exchange/flow/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Economics:   { icon: Landmark,      color: 'text-gold',        bg: 'bg-gold/10' },
  Politics:    { icon: Scale,         color: 'text-for-400',     bg: 'bg-for-500/10' },
  Technology:  { icon: Cpu,           color: 'text-purple',      bg: 'bg-purple/10' },
  Science:     { icon: Sparkles,      color: 'text-emerald',     bg: 'bg-emerald/10' },
  Ethics:      { icon: Gavel,         color: 'text-against-400', bg: 'bg-against-500/10' },
  Philosophy:  { icon: Globe,         color: 'text-for-300',     bg: 'bg-for-400/10' },
  Culture:     { icon: BarChart2,     color: 'text-gold',        bg: 'bg-gold/10' },
  Health:      { icon: Heart,         color: 'text-against-300', bg: 'bg-against-400/10' },
  Environment: { icon: Leaf,          color: 'text-emerald',     bg: 'bg-emerald/10' },
  Education:   { icon: GraduationCap, color: 'text-purple',      bg: 'bg-purple/10' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function truncate(s: string, max = 56): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function DeltaChip({ delta, className }: { delta: number; className?: string }) {
  const abs = Math.abs(delta)
  if (abs < 0.1) {
    return (
      <span className={cn('flex items-center gap-0.5 text-surface-500 text-xs font-mono', className)}>
        <Minus className="h-3 w-3" />
        0.0
      </span>
    )
  }
  const up = delta > 0
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 text-xs font-mono font-medium',
        up ? 'text-emerald' : 'text-against-400',
        className,
      )}
    >
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {abs.toFixed(1)}
    </span>
  )
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: FlowStats }) {
  const breadthPct = Math.round(stats.breadth * 100)
  const breadthColor =
    breadthPct >= 60 ? 'text-emerald' : breadthPct <= 40 ? 'text-against-400' : 'text-gold'

  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {/* Market breadth */}
      <div className="bg-surface-100 border border-surface-200 rounded-xl p-3 flex flex-col gap-1">
        <span className="text-surface-500 text-[10px] uppercase tracking-widest font-mono">Breadth</span>
        <span className={cn('text-xl font-bold tabular-nums', breadthColor)}>{breadthPct}%</span>
        <span className="text-surface-500 text-[10px] font-mono">
          {stats.advancing}↑ {stats.declining}↓
        </span>
      </div>

      {/* Avg consensus */}
      <div className="bg-surface-100 border border-surface-200 rounded-xl p-3 flex flex-col gap-1">
        <span className="text-surface-500 text-[10px] uppercase tracking-widest font-mono">Avg Price</span>
        <span
          className={cn(
            'text-xl font-bold tabular-nums',
            stats.avg_price >= 55 ? 'text-for-400' : stats.avg_price <= 45 ? 'text-against-400' : 'text-surface-700',
          )}
        >
          {stats.avg_price}¢
        </span>
        <span className="text-surface-500 text-[10px] font-mono">consensus</span>
      </div>

      {/* Volume */}
      <div className="bg-surface-100 border border-surface-200 rounded-xl p-3 flex flex-col gap-1">
        <span className="text-surface-500 text-[10px] uppercase tracking-widest font-mono">Volume</span>
        <span className="text-xl font-bold tabular-nums text-white">{formatVolume(stats.total_volume)}</span>
        <span className="text-surface-500 text-[10px] font-mono">{stats.total_markets} markets</span>
      </div>
    </div>
  )
}

// ─── Category Flow Row ────────────────────────────────────────────────────────

function CategoryFlowRow({ flow, rank }: { flow: CategoryFlow; rank: number }) {
  const cfg = CAT_CONFIG[flow.category] ?? { icon: Globe, color: 'text-surface-500', bg: 'bg-surface-200' }
  const Icon = cfg.icon

  const forWidth = Math.max(0, Math.min(100, flow.avg_price))
  const againstWidth = 100 - forWidth

  const dirIcon =
    flow.direction === 'rising' ? TrendingUp :
    flow.direction === 'falling' ? TrendingDown :
    Minus

  const DirIcon = dirIcon

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.25 }}
      className="flex items-center gap-3 py-2.5 border-b border-surface-200/50 last:border-0"
    >
      {/* Icon */}
      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg)}>
        <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
      </div>

      {/* Name + markets */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white">{flow.category}</span>
          <div className="flex items-center gap-2">
            <DirIcon
              className={cn(
                'h-3.5 w-3.5',
                flow.direction === 'rising' ? 'text-emerald' :
                flow.direction === 'falling' ? 'text-against-400' : 'text-surface-500',
              )}
            />
            <DeltaChip delta={flow.delta_1h} />
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden flex bg-surface-300">
          <div
            className="h-full bg-for-500 transition-all duration-700"
            style={{ width: `${forWidth}%` }}
          />
          <div
            className="h-full bg-against-500 transition-all duration-700"
            style={{ width: `${againstWidth}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-for-500 font-mono">{Math.round(forWidth)}¢ FOR</span>
          <span className="text-[10px] text-surface-600 font-mono">{flow.active_markets}m · {formatVolume(flow.volume)}v</span>
          <span className="text-[10px] text-against-400 font-mono">{Math.round(againstWidth)}¢ AGAINST</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Tick Row ─────────────────────────────────────────────────────────────────

function TickRow({ tick, rank }: { tick: FlowTick; rank: number }) {
  const cfg = tick.category ? (CAT_CONFIG[tick.category] ?? null) : null
  const hasMove = Math.abs(tick.delta_1h) >= 0.5

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03, duration: 0.2 }}
    >
      <Link
        href={`/exchange/${tick.id}`}
        className="flex items-center gap-3 py-2.5 border-b border-surface-200/50 last:border-0 hover:bg-surface-100/50 rounded-lg px-2 -mx-2 transition-colors group"
      >
        {/* Price pill */}
        <div
          className={cn(
            'w-10 text-center py-0.5 rounded-md text-xs font-bold font-mono flex-shrink-0',
            tick.price >= 65 ? 'bg-for-600/30 text-for-300' :
            tick.price >= 52 ? 'bg-for-600/20 text-for-400' :
            tick.price <= 35 ? 'bg-against-600/30 text-against-300' :
            tick.price <= 48 ? 'bg-against-600/20 text-against-400' :
            'bg-surface-200 text-surface-600',
          )}
        >
          {tick.price}¢
        </div>

        {/* Statement */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-700 group-hover:text-white transition-colors truncate leading-snug">
            {truncate(tick.statement)}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {cfg && (
              <span className={cn('text-[10px] font-mono', cfg.color)}>{tick.category}</span>
            )}
            <span className="text-[10px] text-surface-600 font-mono">{formatVolume(tick.volume)}v</span>
          </div>
        </div>

        {/* Delta + arrow */}
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          {hasMove ? (
            <DeltaChip delta={tick.delta_1h} />
          ) : (
            <span className="text-[10px] text-surface-600 font-mono">–</span>
          )}
          <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

const REFRESH_MS = 30_000

export function FlowClient() {
  const [data, setData] = useState<FlowResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'category' | 'tape'>('category')
  const [lastRefresh, setLastRefresh] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/exchange/flow', { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as FlowResponse
        setData(json)
        setLastRefresh(Date.now())
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [load])

  // Auto-refresh
  useEffect(() => {
    timerRef.current = setTimeout(() => load(true), REFRESH_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [lastRefresh, load])

  const secondsAgo = Math.round((Date.now() - lastRefresh) / 1000)

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Link href="/exchange" className="text-surface-500 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald" />
                Market Flow
              </h1>
              <p className="text-xs text-surface-500 font-mono">
                Live consensus direction · auto-refresh 30s
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {lastRefresh > 0 && !refreshing && (
              <span className="font-mono">{secondsAgo}s ago</span>
            )}
          </button>
        </div>

        {/* Exchange nav shortcuts */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {[
            { href: '/exchange', label: 'Markets' },
            { href: '/exchange/movers', label: 'Movers' },
            { href: '/exchange/screener', label: 'Screener' },
            { href: '/exchange/portfolio', label: 'Portfolio' },
            { href: '/exchange/watchlist', label: 'Watchlist' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-surface-100 border border-surface-200 text-surface-500 hover:text-white hover:border-surface-400 transition-colors font-mono"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
            <Skeleton className="h-8 rounded-lg" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : !data || data.stats.total_markets === 0 ? (
          <EmptyState
            icon={Activity}
            title="No market data"
            description="Markets will appear here once topics are active and voting."
          />
        ) : (
          <>
            <StatsBar stats={data.stats} />

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-surface-100 rounded-xl p-1 border border-surface-200">
              {([
                { id: 'category', label: 'Category Flow', icon: BarChart2 },
                { id: 'tape',     label: 'Market Tape',   icon: Zap },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors',
                    tab === id
                      ? 'bg-surface-50 text-white border border-surface-300 shadow-sm'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === 'category' ? (
                <motion.div
                  key="cat"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="bg-surface-100 border border-surface-200 rounded-xl px-3 py-1"
                >
                  {/* Legend */}
                  <div className="flex items-center justify-between py-2 border-b border-surface-200/50 mb-1">
                    <span className="text-[10px] text-surface-500 font-mono uppercase tracking-widest">Category</span>
                    <div className="flex gap-4">
                      <span className="text-[10px] text-surface-500 font-mono uppercase tracking-widest">1h Δ</span>
                    </div>
                  </div>
                  {data.category_flows.map((flow, i) => (
                    <CategoryFlowRow key={flow.category} flow={flow} rank={i} />
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="tape"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="bg-surface-100 border border-surface-200 rounded-xl px-3 py-1"
                >
                  {/* Legend */}
                  <div className="flex items-center justify-between py-2 border-b border-surface-200/50 mb-1">
                    <span className="text-[10px] text-surface-500 font-mono uppercase tracking-widest">Market</span>
                    <span className="text-[10px] text-surface-500 font-mono uppercase tracking-widest">1h Δ</span>
                  </div>
                  {data.ticks.length === 0 ? (
                    <EmptyState
                      icon={Flame}
                      title="No active markets"
                      description="Markets with recent activity will appear here."
                      className="py-8"
                    />
                  ) : (
                    data.ticks.map((tick, i) => (
                      <TickRow key={tick.id} tick={tick} rank={i} />
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer note */}
            <p className="text-center text-[10px] text-surface-600 font-mono mt-4">
              Prices reflect consensus as ¢ (0–100) · Δ vs ~1h ago
            </p>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
