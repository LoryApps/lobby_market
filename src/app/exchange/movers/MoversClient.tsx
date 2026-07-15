'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  Bell,
  Flame,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Trophy,
  Volume2,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MoversResponse, MoverTopic } from '@/app/api/exchange/movers/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}¢`
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

function priceBar(price: number, status: string): string {
  if (status === 'law') return 'bg-gold'
  if (status === 'failed') return 'bg-against-500'
  if (price >= 67) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 33) return 'bg-against-500'
  if (price <= 45) return 'bg-against-400'
  return 'bg-surface-400'
}

function priceText(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'gainers', label: 'Gainers', icon: TrendingUp, color: 'text-emerald' },
  { id: 'losers', label: 'Losers', icon: TrendingDown, color: 'text-against-400' },
  { id: 'volatile', label: 'Volatile', icon: Zap, color: 'text-gold' },
  { id: 'high_volume', label: 'Volume', icon: Volume2, color: 'text-for-400' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Market Row ───────────────────────────────────────────────────────────────

function MoverRow({ mover, rank, tab }: { mover: MoverTopic; rank: number; tab: TabId }) {
  const isGain = mover.delta > 0
  const isLoss = mover.delta < 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, delay: rank * 0.03 }}
    >
      <Link
        href={`/exchange/${mover.id}`}
        className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-100/80 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-100 transition-all"
      >
        {/* Rank */}
        <span className="flex-shrink-0 w-6 text-center text-xs font-mono text-surface-500 mt-0.5">
          {rank}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
            {mover.statement}
          </p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {mover.category && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                {mover.category}
              </span>
            )}
            {mover.is_hot && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-orange-400">
                <Flame className="h-2.5 w-2.5" /> HOT
              </span>
            )}
            {mover.is_near_law && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-gold">
                <Scale className="h-2.5 w-2.5" /> NEAR LAW
              </span>
            )}
          </div>

          {/* Price bar */}
          <div className="mt-2 h-1 w-full bg-surface-300 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', priceBar(mover.current_price, mover.status))}
              style={{ width: `${mover.current_price}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-1.5">
            <span className={cn('text-[11px] font-mono font-bold', priceText(mover.current_price, mover.status))}>
              {mover.current_price}¢
            </span>
            <span className="text-[10px] text-surface-500">
              {mover.open_price}¢ open
            </span>
            {tab === 'volatile' && (
              <span className="text-[10px] text-surface-500">
                H: {mover.high_price}¢ / L: {mover.low_price}¢
              </span>
            )}
            {tab === 'high_volume' && (
              <span className="text-[10px] text-surface-500 flex items-center gap-1">
                <BarChart2 className="h-2.5 w-2.5" />
                +{formatVolume(mover.vol_delta)} votes
              </span>
            )}
            <span className="ml-auto text-[10px] text-surface-500 font-mono">
              {formatVolume(mover.volume)} vol
            </span>
          </div>
        </div>

        {/* Delta badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1 ml-1">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-mono font-bold px-2 py-1 rounded-lg',
              tab === 'volatile'
                ? 'text-gold bg-gold/10 border border-gold/20'
                : tab === 'high_volume'
                ? 'text-for-400 bg-for-500/10 border border-for-500/20'
                : isGain
                ? 'text-emerald bg-emerald/10 border border-emerald/20'
                : isLoss
                ? 'text-against-400 bg-against-500/10 border border-against-500/20'
                : 'text-surface-500 bg-surface-200 border border-surface-300',
            )}
          >
            {tab === 'volatile' ? (
              <>
                <Zap className="h-2.5 w-2.5" />
                {mover.range.toFixed(1)}¢
              </>
            ) : tab === 'high_volume' ? (
              <>
                <Volume2 className="h-2.5 w-2.5" />
                +{formatVolume(mover.vol_delta)}
              </>
            ) : isGain ? (
              <>
                <ArrowUpRight className="h-2.5 w-2.5" />
                {formatDelta(mover.delta)}
              </>
            ) : isLoss ? (
              <>
                <ArrowDownRight className="h-2.5 w-2.5" />
                {formatDelta(mover.delta)}
              </>
            ) : (
              '0.0¢'
            )}
          </span>
          {(tab === 'gainers' || tab === 'losers') && mover.open_price > 0 && (
            <span
              className={cn(
                'text-[10px] font-mono',
                isGain ? 'text-emerald/70' : isLoss ? 'text-against-400/70' : 'text-surface-500',
              )}
            >
              {mover.delta_pct > 0 ? '+' : ''}{mover.delta_pct.toFixed(1)}%
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MoverSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100/80 border border-surface-300/60">
      <Skeleton className="w-6 h-4 mt-0.5" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-1 w-full rounded-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-16 h-7 rounded-lg" />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MoversClient() {
  const [data, setData] = useState<MoversResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('gainers')
  const [refreshKey, setRefreshKey] = useState(0)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/movers', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: MoversResponse = await res.json()
      setData(json)
    } catch {
      // keep stale data
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch_()
  }, [fetch_, refreshKey])

  const rows = data ? data[tab] : []
  const activeTab = TABS.find((t) => t.id === tab)!

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/exchange"
                className="text-surface-500 hover:text-white transition-colors"
                aria-label="Back to Exchange"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <Activity className="h-5 w-5 text-for-400" aria-hidden="true" />
              <h1 className="text-xl font-bold text-white">Movers</h1>
            </div>
            <p className="text-sm text-surface-500">
              24-hour price changes across all civic markets
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/exchange/leaderboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-xs font-medium text-surface-500 hover:text-white transition-colors"
            >
              <Trophy className="h-3.5 w-3.5" />
              Leaders
            </Link>
            <Link
              href="/exchange/alerts"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 text-xs font-medium text-surface-500 hover:text-for-300 transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              Alerts
            </Link>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              aria-label="Refresh movers"
              className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Last updated */}
        {data?.as_of && (
          <p className="text-[11px] text-surface-600 mb-4 font-mono">
            Updated {relTime(data.as_of)} · 24h window
          </p>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold transition-all border',
                tab === id
                  ? 'bg-surface-200 text-white border-surface-400'
                  : 'text-surface-500 border-transparent hover:text-white hover:border-surface-300',
              )}
            >
              <Icon className={cn('h-3.5 w-3.5', tab === id ? color : '')} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab header */}
        <div className="flex items-center gap-2 mb-3">
          <activeTab.icon className={cn('h-4 w-4', activeTab.color)} aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">
            {tab === 'gainers' && 'Top Gainers'}
            {tab === 'losers' && 'Top Losers'}
            {tab === 'volatile' && 'Most Volatile'}
            {tab === 'high_volume' && 'Highest Volume'}
          </h2>
          <span className="text-[11px] text-surface-500 ml-1">
            {tab === 'gainers' && '— biggest price increases in 24h'}
            {tab === 'losers' && '— biggest price drops in 24h'}
            {tab === 'volatile' && '— widest intraday price range'}
            {tab === 'high_volume' && '— most new votes in 24h'}
          </span>
        </div>

        {/* List */}
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <MoverSkeleton key={i} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={activeTab.icon}
            title="No movers yet"
            description="Not enough price history to compute 24h changes. Check back after more votes are cast."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {rows.map((mover, i) => (
                <MoverRow key={mover.id} mover={mover} rank={i + 1} tab={tab} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 p-4 rounded-xl bg-surface-100/60 border border-surface-300/40">
          <p className="text-[11px] text-surface-500 leading-relaxed">
            <span className="text-surface-400 font-semibold">How it works:</span> Price = % FOR consensus (0–100¢).
            Gainers/Losers show 24h price change. Volatile shows the largest intraday swing (high − low).
            Volume shows new votes cast in the last 24h.
          </p>
          <p className="text-[11px] text-surface-600 mt-1">
            Data snapshotted every 20 votes · Markets from all civic categories
          </p>
        </div>

        {/* Back to exchange */}
        <div className="mt-6 text-center">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to all markets
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
