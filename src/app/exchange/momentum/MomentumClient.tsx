'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Zap,
  AlertCircle,
  ChevronRight,
  Target,
  Pause,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MomentumMarket, MomentumResponse, MomentumTab } from '@/app/api/exchange/momentum/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 30_000

const TABS: { id: MomentumTab; label: string; icon: typeof TrendingUp; color: string; description: string }[] = [
  {
    id: 'surging',
    label: 'Surging',
    icon: TrendingUp,
    color: 'text-emerald',
    description: 'Markets with accelerating FOR consensus — the crowd is piling in.',
  },
  {
    id: 'falling',
    label: 'Falling',
    icon: TrendingDown,
    color: 'text-against-400',
    description: 'Markets losing momentum fast — AGAINST votes are taking over.',
  },
  {
    id: 'breakouts',
    label: 'Breakouts',
    icon: Zap,
    color: 'text-gold',
    description: 'Markets that just crossed a key consensus threshold (33%, 50%, 67%, 75%).',
  },
  {
    id: 'stalling',
    label: 'Stalling',
    icon: Pause,
    color: 'text-surface-400',
    description: 'Markets that were moving but have lost momentum — watch for reversal.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDelta(d: number, showSign = true): string {
  const sign = showSign && d > 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}¢`
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${h}h ago`
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function momentumBg(score: number): string {
  if (score >= 75) return 'bg-emerald/20 text-emerald border-emerald/30'
  if (score >= 60) return 'bg-for-500/15 text-for-400 border-for-500/30'
  if (score <= 25) return 'bg-against-500/20 text-against-400 border-against-500/30'
  if (score <= 40) return 'bg-against-500/10 text-against-300 border-against-500/20'
  return 'bg-surface-300/50 text-surface-500 border-surface-400/30'
}

function MomentumBar({ score }: { score: number }) {
  const isUp = score > 50
  const width = `${Math.abs(score - 50) * 2}%`
  return (
    <div className="relative h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
      <div className="absolute inset-y-0 w-px bg-surface-400 left-1/2" />
      {isUp ? (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-y-0 left-1/2 rounded-full bg-gradient-to-r from-for-500 to-emerald"
        />
      ) : (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-y-0 right-1/2 rounded-full bg-gradient-to-l from-against-500 to-against-400"
        />
      )}
    </div>
  )
}

function MiniSparkline({ data, delta }: { data: number[]; delta: number }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 48
  const h = 20
  const pts = data.map(
    (v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`,
  )
  const stroke = delta > 0 ? '#22c55e' : delta < 0 ? '#f87171' : '#6b7280'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(' ')}
      />
    </svg>
  )
}

function BreakoutBadge({ level, direction }: { level: number; direction: 'up' | 'down' }) {
  const isUp = direction === 'up'
  const levelLabel =
    level === 75 ? 'Near-Law' :
    level === 67 ? 'Strong FOR' :
    level === 50 ? 'Majority' :
    level === 33 ? 'Minority' :
    `${level}%`
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border',
        isUp
          ? 'bg-gold/10 text-gold border-gold/30'
          : 'bg-against-500/10 text-against-400 border-against-500/30',
      )}
    >
      {isUp ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
      {levelLabel}
    </span>
  )
}

function MarketCard({ market, tab }: { market: MomentumMarket; tab: MomentumTab }) {
  const _delta = tab === 'falling' ? market.delta_24h : market.delta_6h

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className="block p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all group"
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
              {market.statement}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {market.category && (
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                  {market.category}
                </span>
              )}
              <span className="text-[10px] text-surface-600">·</span>
              <span className="text-[10px] font-mono text-surface-500">
                {formatVolume(market.volume)} votes
              </span>
              {market.breakout_level !== null && market.breakout_direction !== null && (
                <>
                  <span className="text-[10px] text-surface-600">·</span>
                  <BreakoutBadge
                    level={market.breakout_level}
                    direction={market.breakout_direction}
                  />
                </>
              )}
            </div>
          </div>

          {/* Sparkline + price */}
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <MiniSparkline data={market.sparkline} delta={market.delta_24h} />
            <span className={cn('text-lg font-mono font-bold', priceColor(market.price, market.status))}>
              {market.price}¢
            </span>
          </div>
        </div>

        {/* Momentum bar */}
        <MomentumBar score={market.momentum_score} />

        {/* Stats row */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            {/* 6h delta */}
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">6h</span>
              <span
                className={cn(
                  'text-xs font-mono font-semibold',
                  market.delta_6h > 0 ? 'text-emerald' : market.delta_6h < 0 ? 'text-against-400' : 'text-surface-500',
                )}
              >
                {formatDelta(market.delta_6h)}
              </span>
            </div>

            <div className="w-px h-6 bg-surface-300" />

            {/* 24h delta */}
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">24h</span>
              <span
                className={cn(
                  'text-xs font-mono font-semibold',
                  market.delta_24h > 0 ? 'text-for-400' : market.delta_24h < 0 ? 'text-against-300' : 'text-surface-500',
                )}
              >
                {formatDelta(market.delta_24h)}
              </span>
            </div>

            <div className="w-px h-6 bg-surface-300" />

            {/* Acceleration */}
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">Accel</span>
              <span
                className={cn(
                  'text-xs font-mono font-semibold',
                  market.acceleration > 1.5 ? 'text-emerald' :
                  market.acceleration > 1 ? 'text-for-400' :
                  market.acceleration < 0.5 ? 'text-against-400' : 'text-surface-500',
                )}
              >
                {market.acceleration.toFixed(1)}×
              </span>
            </div>
          </div>

          {/* Momentum score badge */}
          <span
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-bold border',
              momentumBg(market.momentum_score),
            )}
          >
            <Activity className="h-3 w-3" />
            {market.momentum_score}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

function TabSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full mb-3" />
          <div className="flex justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MomentumClient() {
  const [data, setData] = useState<MomentumResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<MomentumTab>('surging')
  const [asOf, setAsOf] = useState<string | null>(null)

  const fetch_ = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/exchange/momentum')
      if (!res.ok) throw new Error('fetch failed')
      const json: MomentumResponse = await res.json()
      setData(json)
      setAsOf(json.as_of)
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
    const t = setInterval(() => fetch_(true), REFRESH_MS)
    return () => clearInterval(t)
  }, [fetch_])

  const activeTab_ = TABS.find((t) => t.id === activeTab)!
  const markets: MomentumMarket[] = data ? (data[activeTab] ?? []) : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors text-surface-500 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-for-500/10 border border-for-500/30">
                <Activity className="h-4.5 w-4.5 text-for-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Momentum Scanner</h1>
                <p className="text-[11px] font-mono text-surface-500">
                  Consensus acceleration · real-time · 30s refresh
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => fetch_(true)}
            disabled={refreshing}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/50 transition-colors text-surface-500 hover:text-for-400"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* How-to strip */}
        <div className="rounded-xl bg-for-500/5 border border-for-500/20 px-4 py-3 mb-5 flex gap-3">
          <BarChart2 className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-surface-400 leading-relaxed">
            Momentum measures the <span className="text-white">acceleration</span> of consensus shifts — not just
            direction but whether the rate of change is speeding up or slowing down. A momentum score above 75 means
            strong, accelerating FOR consensus. Below 25 means strong AGAINST.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const count = data?.[tab.id]?.length ?? 0
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold whitespace-nowrap border transition-all',
                  isActive
                    ? 'bg-for-500/15 text-for-300 border-for-500/40'
                    : 'bg-surface-100 text-surface-400 border-surface-300 hover:border-surface-400 hover:text-white',
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', isActive ? tab.color : '')} />
                {tab.label}
                {!loading && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-[9px] font-bold',
                      isActive ? 'bg-for-500/20 text-for-300' : 'bg-surface-300 text-surface-500',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab description */}
        <p className="text-[11px] font-mono text-surface-500 mb-4">{activeTab_.description}</p>

        {/* Content */}
        {loading ? (
          <TabSkeleton />
        ) : markets.length === 0 ? (
          <EmptyState
            icon={activeTab === 'breakouts' ? Target : activeTab === 'stalling' ? Pause : activeTab === 'falling' ? TrendingDown : TrendingUp}
            title="No markets found"
            description={
              activeTab === 'breakouts'
                ? 'No markets have crossed a key consensus threshold recently. Check back as voting continues.'
                : activeTab === 'stalling'
                ? 'No stalling markets right now — everything is either moving or flat.'
                : `No ${activeTab} markets at this time. Consensus shifts take time to develop.`
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              {markets.map((market, i) => (
                <motion.div
                  key={market.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.04 }}
                >
                  <MarketCard market={market} tab={activeTab} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer */}
        {asOf && !loading && (
          <p className="text-center text-[10px] font-mono text-surface-600 mt-8">
            Updated {relTime(asOf)} · auto-refreshes every 30s
          </p>
        )}

        {/* Exchange nav links */}
        <div className="grid grid-cols-2 gap-3 mt-8">
          {[
            { href: '/exchange/movers', icon: TrendingUp, label: 'Movers', sub: '24h gainers & losers' },
            { href: '/exchange/volatility', icon: Zap, label: 'Volatility', sub: 'Price range & swings' },
            { href: '/exchange/signals', icon: AlertCircle, label: 'Signals', sub: 'Pattern-based alerts' },
            { href: '/exchange/opportunity', icon: Target, label: 'Opportunity', sub: 'Mispriced markets' },
          ].map(({ href, icon: Icon, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
            >
              <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{label}</p>
                <p className="text-[10px] text-surface-500 truncate">{sub}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 ml-auto flex-shrink-0 transition-colors" />
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
