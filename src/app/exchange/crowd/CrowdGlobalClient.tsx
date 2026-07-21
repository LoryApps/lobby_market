'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  ChevronRight,
  Crown,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CrowdGlobalData, DivergentMarket } from '@/app/api/exchange/crowd/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function divColor(div: number): string {
  if (div >= 10) return 'text-for-400'
  if (div <= -10) return 'text-against-400'
  return 'text-surface-400'
}

const STATUS_MAP: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed', active: 'active', voting: 'active', law: 'law', failed: 'failed',
}

// ─── Market Row ───────────────────────────────────────────────────────────────

function MarketRow({
  market,
  showDivergence = true,
}: {
  market: DivergentMarket
  showDivergence?: boolean
}) {
  const bullish = market.divergence > 0

  return (
    <Link
      href={`/exchange/${market.id}/crowd`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-surface-800/60 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate group-hover:text-for-300 transition-colors leading-snug">
          {market.statement}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant={STATUS_MAP[market.status] ?? 'surface'} className="text-[10px] py-0">
            {market.status.toUpperCase()}
          </Badge>
          {market.category && (
            <span className="text-[11px] text-surface-500">{market.category}</span>
          )}
          <span className="text-[11px] text-surface-600">{market.predictor_count} predictors</span>
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <div className="flex items-center justify-end gap-1.5">
          <span className={cn('text-sm font-bold font-mono', priceColor(market.price))}>
            {market.price}¢
          </span>
          <span className="text-[11px] text-surface-600">price</span>
        </div>
        {showDivergence ? (
          <div className={cn(
            'text-xs font-mono font-semibold flex items-center justify-end gap-0.5',
            divColor(market.divergence),
          )}>
            {bullish ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {bullish ? '+' : ''}{market.divergence}¢
          </div>
        ) : (
          <div className="text-xs text-surface-500 font-mono">
            {market.crowd_signal}¢ signal
          </div>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors shrink-0" />
    </Link>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconClass,
  markets,
  emptyMsg,
  showDivergence = true,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  markets: DivergentMarket[]
  emptyMsg: string
  showDivergence?: boolean
}) {
  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-700/60">
        <Icon className={cn('h-4 w-4', iconClass)} />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      {markets.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-surface-500">{emptyMsg}</div>
      ) : (
        <div className="divide-y divide-surface-800/60">
          {markets.map((m) => (
            <MarketRow key={m.id} market={m} showDivergence={showDivergence} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string
  value: string
  sub?: string
  valueClass?: string
}) {
  return (
    <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-4 text-center">
      <p className="text-[11px] uppercase tracking-wide text-surface-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold font-mono', valueClass ?? 'text-white')}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CrowdGlobalSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8 space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CrowdGlobalClient() {
  const [data, setData] = useState<CrowdGlobalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/exchange/crowd', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <CrowdGlobalSkeleton />

  if (!data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
          <EmptyState icon={Brain} title="Couldn't load crowd data" description="Please try again." />
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <Link
            href="/exchange"
            aria-label="Back to exchange"
            className="mt-0.5 text-surface-500 hover:text-white transition-colors shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-purple" />
              <span className="text-xs font-mono text-purple uppercase tracking-widest">Exchange Intelligence</span>
            </div>
            <h1 className="text-xl font-bold text-white">Crowd vs Market</h1>
            <p className="text-sm text-surface-400 mt-0.5">
              Where collective predictions diverge from live consensus — and who&apos;s right.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh crowd data"
            className="mt-0.5 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-800 transition-colors disabled:opacity-40 shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Platform stats ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <StatTile
            label="Total Predictors"
            value={data.platform.total_predictors.toLocaleString()}
            sub="unique users"
            valueClass="text-for-400"
          />
          <StatTile
            label="Predictions Made"
            value={data.platform.total_predictions.toLocaleString()}
            sub="across all markets"
          />
          {data.platform.pct_correct !== null ? (
            <StatTile
              label="Crowd Accuracy"
              value={`${data.platform.pct_correct}%`}
              sub="resolved markets"
              valueClass={data.platform.pct_correct >= 55 ? 'text-emerald' : 'text-against-400'}
            />
          ) : (
            <StatTile label="Crowd Accuracy" value="—" sub="pending resolution" valueClass="text-surface-500" />
          )}
          {data.platform.avg_brier_score !== null ? (
            <StatTile
              label="Avg Brier Score"
              value={data.platform.avg_brier_score.toFixed(3)}
              sub="lower = better"
              valueClass="text-gold"
            />
          ) : (
            <StatTile label="Avg Brier Score" value="—" sub="pending resolution" valueClass="text-surface-500" />
          )}
        </motion.div>

        {/* ── Smart money vs retail ── */}
        {(data.platform.smart_money_accuracy !== null || data.platform.retail_accuracy !== null) && (
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-white">Smart Money vs Retail (Resolved)</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-[11px] text-surface-500 mb-1">Smart Money Accuracy</p>
                <p className={cn(
                  'text-3xl font-bold font-mono',
                  data.platform.smart_money_accuracy !== null && data.platform.smart_money_accuracy >= 55
                    ? 'text-emerald' : 'text-against-400',
                )}>
                  {data.platform.smart_money_accuracy !== null ? `${data.platform.smart_money_accuracy}%` : '—'}
                </p>
                <p className="text-[11px] text-surface-600 mt-0.5">1000+ Clout</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-surface-500 mb-1">Retail Accuracy</p>
                <p className={cn(
                  'text-3xl font-bold font-mono',
                  data.platform.retail_accuracy !== null && data.platform.retail_accuracy >= 55
                    ? 'text-emerald' : 'text-against-400',
                )}>
                  {data.platform.retail_accuracy !== null ? `${data.platform.retail_accuracy}%` : '—'}
                </p>
                <p className="text-[11px] text-surface-600 mt-0.5">{'<'}100 Clout</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Active markets stat ── */}
        <div className="flex items-center gap-2 text-sm text-surface-500">
          <BarChart2 className="h-4 w-4 text-for-400" />
          <span>
            Showing divergence across{' '}
            <span className="text-white font-semibold">{data.total_active_markets}</span>
            {' '}active markets with formal predictions
          </span>
        </div>

        {/* ── Most bullish divergence (crowd more bullish) ── */}
        <Section
          title="Crowd More Bullish Than Market"
          icon={TrendingUp}
          iconClass="text-for-400"
          markets={data.most_divergent}
          emptyMsg="No markets where crowd is more bullish than price"
        />

        {/* ── Most bearish divergence (crowd more bearish) ── */}
        <Section
          title="Crowd More Bearish Than Market"
          icon={TrendingDown}
          iconClass="text-against-400"
          markets={data.most_bearish_vs_price}
          emptyMsg="No markets where crowd is more bearish than price"
        />

        {/* ── Most predicted ── */}
        <Section
          title="Most Actively Predicted"
          icon={Users}
          iconClass="text-purple"
          markets={data.most_predicted}
          emptyMsg="No prediction data yet"
          showDivergence={false}
        />

        {/* ── Footer links ── */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/exchange/leaderboard', label: 'Leaderboard', icon: Crown },
            { href: '/exchange/forecasters', label: 'Forecasters', icon: Brain },
            { href: '/exchange/performance', label: 'My Performance', icon: BarChart2 },
            { href: '/exchange', label: 'All Markets', icon: Scale },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-xl border border-surface-700/60 bg-surface-900/40 px-4 py-3 hover:border-surface-600/60 hover:bg-surface-800/60 transition-colors group"
            >
              <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
              <span className="text-sm text-surface-300 group-hover:text-white transition-colors">{label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors ml-auto" />
            </Link>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
