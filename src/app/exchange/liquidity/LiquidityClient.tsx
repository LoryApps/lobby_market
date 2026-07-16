'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Droplets,
  RefreshCw,
  Target,
  Waves,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LiquidityMarket,
  CategoryLiquidity,
  LiquidityResponse,
} from '@/app/api/exchange/liquidity/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}


function liquidityLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 70) return { label: 'Liquid', color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30' }
  if (score >= 40) return { label: 'Moderate', color: 'text-gold', bg: 'bg-gold/10 border-gold/30' }
  if (score >= 15) return { label: 'Thin', color: 'text-against-300', bg: 'bg-against-500/10 border-against-500/30' }
  return { label: 'Very Thin', color: 'text-against-400', bg: 'bg-against-500/15 border-against-500/40' }
}

function swingLabel(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Max Swing', color: 'text-against-400' }
  if (score >= 50) return { label: 'High Swing', color: 'text-gold' }
  if (score >= 25) return { label: 'Moderate', color: 'text-surface-400' }
  return { label: 'Stable', color: 'text-for-400' }
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'thin' | 'liquid' | 'swing' | 'sectors'

const TABS = [
  { id: 'thin' as Tab,    label: 'Thin Markets',   icon: Droplets,   desc: 'Fewest votes — most susceptible to consensus shift' },
  { id: 'liquid' as Tab,  label: 'Most Liquid',    icon: Waves,      desc: 'Highest vote count — stable, reliable consensus' },
  { id: 'swing' as Tab,   label: 'Swing Zone',     icon: Target,     desc: 'Near 50/50 + low volume — biggest swing opportunity' },
  { id: 'sectors' as Tab, label: 'By Sector',      icon: BarChart2,  desc: 'Average liquidity depth by civic category' },
]

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Activity
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-mono mb-1', color)}>
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <span className="text-xl font-mono font-bold text-white tabular-nums">{value}</span>
      {sub && <span className="text-xs font-mono text-surface-500">{sub}</span>}
    </div>
  )
}

function MarketRow({ market, rank, showSwing }: { market: LiquidityMarket; rank: number; showSwing?: boolean }) {
  const liq = liquidityLabel(market.liquidity_score)
  const swing = swingLabel(market.swing_score)

  return (
    <Link href={`/exchange/${market.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.025 }}
        className="group flex items-start gap-3 px-4 py-3.5 border-b border-surface-200 hover:bg-surface-100/60 transition-colors"
      >
        <span className="text-xs font-mono text-surface-600 w-5 pt-0.5 shrink-0 text-right">{rank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {market.statement}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {market.category && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                {market.category}
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-mono border',
                liq.bg,
                liq.color
              )}
            >
              {liq.label}
            </span>
            {showSwing && (
              <span className={cn('text-[10px] font-mono', swing.color)}>
                {swing.label}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={cn('text-sm font-mono font-semibold tabular-nums', priceColor(market.price))}>
            {market.price}¢
          </span>
          <span className="text-[10px] font-mono text-surface-500 tabular-nums">
            {formatVolume(market.volume)} votes
          </span>
          {/* Liquidity bar */}
          <div className="w-16 h-1 bg-surface-300 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', {
                'bg-emerald': market.liquidity_score >= 70,
                'bg-gold': market.liquidity_score >= 40 && market.liquidity_score < 70,
                'bg-against-400': market.liquidity_score < 40,
              })}
              style={{ width: `${market.liquidity_score}%` }}
            />
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

function SectorRow({ cat, maxVolume }: { cat: CategoryLiquidity; maxVolume: number }) {
  const barW = maxVolume > 0 ? Math.round((cat.avg_volume / maxVolume) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-200"
    >
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
      <div className="w-24 shrink-0">
        <span className="text-xs font-mono text-white">{cat.category}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${barW}%`, backgroundColor: cat.color }}
            />
          </div>
          <span className="text-xs font-mono text-surface-400 tabular-nums w-16 text-right">
            {formatVolume(cat.avg_volume)} avg
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-mono text-surface-600">
            {cat.market_count} markets
          </span>
          <span className="text-[10px] font-mono text-surface-600">
            {formatVolume(cat.total_volume)} total
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <span
          className={cn('text-xs font-mono font-semibold', {
            'text-emerald': cat.liquidity_score >= 70,
            'text-gold': cat.liquidity_score >= 40 && cat.liquidity_score < 70,
            'text-against-400': cat.liquidity_score < 40,
          })}
        >
          {cat.liquidity_score}
        </span>
        <span className="text-[10px] font-mono text-surface-600">/100</span>
      </div>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LiquidityClient() {
  const [data, setData] = useState<LiquidityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('thin')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/exchange/liquidity', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: LiquidityResponse = await res.json()
      setData(json)
    } catch {
      // silent fail — keep stale data
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const stats = data?.stats
  const maxSectorVolume = data
    ? Math.max(...data.category_breakdown.map((c) => c.avg_volume), 1)
    : 1

  const activeTab = TABS.find((t) => t.id === tab)

  const tabMarkets: LiquidityMarket[] =
    tab === 'thin' ? (data?.thin_markets ?? []) :
    tab === 'liquid' ? (data?.liquid_markets ?? []) :
    tab === 'swing' ? (data?.swing_markets ?? []) :
    []

  return (
    <div className="flex flex-col min-h-screen bg-surface-900">
      <TopBar />

      <main className="flex-1 pb-24">
        {/* Header */}
        <div className="px-4 pt-4 pb-5 border-b border-surface-200">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/exchange" className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-mono font-bold text-white flex items-center gap-2">
                <Droplets className="h-5 w-5 text-for-400" />
                Market Liquidity
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Depth analysis across all active civic markets
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="ml-auto p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Stats row */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard
                icon={Activity}
                label="Active Markets"
                value={stats.total_markets.toLocaleString()}
                sub={`${formatVolume(stats.total_volume)} total votes`}
                color="text-for-400"
              />
              <StatCard
                icon={BarChart2}
                label="Avg Volume"
                value={formatVolume(stats.avg_volume)}
                sub={`${formatVolume(stats.median_volume)} median`}
                color="text-purple"
              />
              <StatCard
                icon={Droplets}
                label="Thin Markets"
                value={stats.thin_market_count.toString()}
                sub="score < 30"
                color="text-against-400"
              />
              <StatCard
                icon={Target}
                label="Swing Zone"
                value={stats.swing_zone_count.toString()}
                sub="50/50 + thin"
                color="text-gold"
              />
            </div>
          ) : null}
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-surface-200 overflow-x-auto scrollbar-none">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-mono whitespace-nowrap border-b-2 transition-colors',
                  isActive
                    ? 'border-for-500 text-for-300'
                    : 'border-transparent text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Tab description */}
        {activeTab && (
          <div className="px-4 py-2 bg-surface-200/40 border-b border-surface-200">
            <p className="text-[11px] font-mono text-surface-500">{activeTab.desc}</p>
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3.5 border-b border-surface-200">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-12 rounded" />
                    <Skeleton className="h-2 w-16 rounded" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : tab === 'sectors' ? (
            <motion.div key="sectors" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {data?.category_breakdown.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  title="No sector data"
                  description="Sector liquidity breakdown will appear once markets are active."
                />
              ) : (
                <>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Sector</span>
                    <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Depth Score</span>
                  </div>
                  {(data?.category_breakdown ?? []).map((cat) => (
                    <SectorRow key={cat.category} cat={cat} maxVolume={maxSectorVolume} />
                  ))}
                  <div className="px-4 py-4">
                    <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
                      Depth score (0–100) uses a log-scale: 100 votes ≈ 67, 1,000 votes ≈ 100.
                      Higher scores indicate more reliable consensus in that sector.
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {tabMarkets.length === 0 ? (
                <EmptyState
                  icon={Waves}
                  title="No markets found"
                  description="No markets match this liquidity filter right now."
                />
              ) : (
                <>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Market</span>
                    <div className="flex items-center gap-8">
                      <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider hidden sm:block">Price</span>
                      <span className="text-[10px] font-mono text-surface-600 uppercase tracking-wider">Depth</span>
                    </div>
                  </div>
                  {tabMarkets.map((market, i) => (
                    <MarketRow
                      key={market.id}
                      market={market}
                      rank={i + 1}
                      showSwing={tab === 'swing'}
                    />
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explainer footer */}
        {!loading && (
          <div className="mx-4 mt-6 p-4 rounded-xl bg-surface-100 border border-surface-300">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-for-400" />
              <span className="text-sm font-mono font-semibold text-white">How liquidity works</span>
            </div>
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              <strong className="text-surface-400">Depth score</strong> (0–100) measures how many votes a market has.
              Low-depth markets are easily swung; high-depth markets represent stable community consensus.{' '}
              <strong className="text-surface-400">Swing zone</strong> = near-50/50 price + low depth.
              These markets need just a few more votes to shift significantly.
            </p>
            <div className="flex flex-wrap gap-3 mt-3">
              {[
                { color: 'bg-emerald', label: 'Liquid (70+)' },
                { color: 'bg-gold', label: 'Moderate (40–69)' },
                { color: 'bg-against-400', label: 'Thin (<40)' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', item.color)} />
                  <span className="text-[11px] font-mono text-surface-500">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
