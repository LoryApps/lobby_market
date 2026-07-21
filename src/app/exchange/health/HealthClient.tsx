'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gavel,
  Heart,
  RefreshCw,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Minus,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  HealthResponse,
  CategoryHealth,
  ThinMarket,
  StaleMarket,
} from '@/app/api/exchange/health/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 60_000

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

const TREND_CONFIG = {
  growing:   { Icon: TrendingUp,   color: 'text-emerald',    label: 'Growing' },
  stable:    { Icon: Minus,        color: 'text-surface-500', label: 'Stable' },
  declining: { Icon: TrendingDown, color: 'text-against-400', label: 'Declining' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relDays(n: number): string {
  if (n === 0) return 'today'
  if (n === 1) return '1 day ago'
  return `${n} days ago`
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald'
  if (score >= 50) return 'text-for-400'
  if (score >= 25) return 'text-gold'
  return 'text-against-400'
}

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald'
  if (score >= 50) return 'bg-for-500'
  if (score >= 25) return 'bg-gold'
  return 'bg-against-500'
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  if (score >= 20) return 'Weak'
  return 'Critical'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function HealthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0,1,2,3].map(i => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  valueClass,
  score,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  valueClass?: string
  score?: number
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-surface-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-2xl font-mono font-bold', valueClass ?? 'text-white')}>
        {value}
      </p>
      {score !== undefined && (
        <div className="space-y-1">
          <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="text-[10px] font-mono text-surface-500">{scoreLabel(score)}</p>
        </div>
      )}
      {sub && !score && (
        <p className="text-[11px] text-surface-500">{sub}</p>
      )}
    </div>
  )
}

// ─── Category Health Row ───────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: CategoryHealth }) {
  const { Icon, color, label: trendLabel } = TREND_CONFIG[cat.trend]
  const catColor = CATEGORY_COLORS[cat.category] ?? 'text-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      {/* Category */}
      <div className="w-28 flex-shrink-0">
        <span className={cn('text-xs font-mono font-semibold', catColor)}>
          {cat.category}
        </span>
      </div>

      {/* Score bar */}
      <div className="flex-1 space-y-1">
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreBarColor(cat.health_score))}
            style={{ width: `${cat.health_score}%` }}
          />
        </div>
      </div>

      {/* Score */}
      <span className={cn('text-xs font-mono font-bold w-8 text-right', scoreColor(cat.health_score))}>
        {cat.health_score}
      </span>

      {/* Markets */}
      <span className="text-[11px] font-mono text-surface-500 w-16 text-right">
        {cat.active_count}/{cat.market_count}
      </span>

      {/* Avg votes */}
      <span className="text-[11px] font-mono text-surface-600 w-12 text-right hidden sm:block">
        {formatVol(cat.avg_votes_per_market)} avg
      </span>

      {/* Trend */}
      <div className={cn('flex items-center gap-1 w-20 justify-end', color)}>
        <Icon className="h-3 w-3" />
        <span className="text-[10px] font-mono hidden sm:block">{trendLabel}</span>
      </div>

      <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
    </motion.div>
  )
}

// ─── Thin Market Row ──────────────────────────────────────────────────────────

function ThinMarketRow({ market }: { market: ThinMarket }) {
  const catColor = CATEGORY_COLORS[market.category ?? ''] ?? 'text-surface-400'

  return (
    <Link href={`/exchange/${market.id}`} className="group block">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-against-500/50 hover:bg-against-500/5 transition-colors">
        <AlertTriangle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white truncate leading-snug">{market.statement}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {market.category && (
              <span className={cn('text-[10px] font-mono', catColor)}>{market.category}</span>
            )}
            <span className="text-[10px] text-surface-600 font-mono">
              {market.vote_count} vote{market.vote_count !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-against-400 font-mono">
              needs {market.participants_needed} more
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono text-white">{market.price}¢</span>
          <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-white transition-colors" />
        </div>
      </div>
    </Link>
  )
}

// ─── Stale Market Row ─────────────────────────────────────────────────────────

function StaleMarketRow({ market }: { market: StaleMarket }) {
  const catColor = CATEGORY_COLORS[market.category ?? ''] ?? 'text-surface-400'

  return (
    <Link href={`/exchange/${market.id}`} className="group block">
      <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/50 hover:bg-gold/5 transition-colors">
        <Clock className="h-3.5 w-3.5 text-gold flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white truncate leading-snug">{market.statement}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {market.category && (
              <span className={cn('text-[10px] font-mono', catColor)}>{market.category}</span>
            )}
            <span className="text-[10px] text-surface-600 font-mono">
              last activity {relDays(market.days_stale)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono text-white">{market.price}¢</span>
          <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-white transition-colors" />
        </div>
      </div>
    </Link>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function HealthClient() {
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<'categories' | 'thin' | 'stale'>('categories')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      setError(false)
      const res = await fetch('/api/exchange/health')
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as HealthResponse
      setData(json)
      setLastFetched(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [load])

  const vitals = data?.vitals
  const overallScore = vitals?.market_quality_score ?? 0

  return (
    <div className="min-h-screen bg-surface-50 pb-24 md:pb-8">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-surface-500 hover:text-white font-mono text-xs mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exchange
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Heart className="h-4 w-4 text-against-400" />
                <h1 className="text-xl font-bold text-white font-mono tracking-tight">
                  Market Health Monitor
                </h1>
              </div>
              <p className="text-xs text-surface-500">
                Participation, coverage, and quality signals across the exchange
              </p>
            </div>
            <button
              onClick={() => { setLoading(true); void load() }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors text-xs font-mono disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {loading && !data ? (
          <HealthSkeleton />
        ) : error && !data ? (
          <EmptyState
            icon={XCircle}
            title="Failed to load health data"
            description="Could not fetch market health metrics. Try refreshing."
            action={{ label: 'Retry', onClick: () => { setLoading(true); void load() } }}
          />
        ) : data ? (
          <div className="space-y-8">
            {/* Overall quality gauge */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-1">
                    Overall Market Quality
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className={cn('text-4xl font-mono font-bold', scoreColor(overallScore))}>
                      {overallScore}
                    </span>
                    <span className="text-sm text-surface-500 font-mono">/ 100</span>
                    <span className={cn('text-sm font-mono font-semibold', scoreColor(overallScore))}>
                      — {scoreLabel(overallScore)}
                    </span>
                  </div>
                </div>
                <Shield className={cn('h-10 w-10 flex-shrink-0', scoreColor(overallScore))} />
              </div>
              <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallScore}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', scoreBarColor(overallScore))}
                />
              </div>
              {lastFetched && (
                <p className="text-[10px] text-surface-600 font-mono mt-2">
                  Last updated {lastFetched.toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Total Markets"
                value={formatVol(vitals!.total_markets)}
                icon={BarChart2}
                sub={`${vitals!.active_markets} active`}
              />
              <StatCard
                label="Avg. Votes"
                value={formatVol(vitals!.avg_votes_per_market)}
                icon={Users}
                sub="per market"
              />
              <StatCard
                label="Resolution Rate"
                value={`${vitals!.overall_resolution_rate}%`}
                icon={Gavel}
                valueClass={vitals!.overall_resolution_rate >= 30 ? 'text-gold' : 'text-white'}
                sub="became law"
              />
              <StatCard
                label="Coverage"
                value={`${vitals!.coverage_score}%`}
                icon={Target}
                score={vitals!.coverage_score}
              />
            </div>

            {/* Alert badges */}
            {(vitals!.thin_markets > 0 || vitals!.stale_markets > 0) && (
              <div className="flex flex-wrap gap-2">
                {vitals!.thin_markets > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-against-500/10 border border-against-500/30 text-against-400 text-xs font-mono">
                    <AlertTriangle className="h-3 w-3" />
                    {vitals!.thin_markets} thin market{vitals!.thin_markets !== 1 ? 's' : ''} need participants
                  </div>
                )}
                {vitals!.stale_markets > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-mono">
                    <Clock className="h-3 w-3" />
                    {vitals!.stale_markets} stale market{vitals!.stale_markets !== 1 ? 's' : ''} (7+ days quiet)
                  </div>
                )}
              </div>
            )}

            {/* Tab bar */}
            <div>
              <div className="flex gap-1 p-1 rounded-xl bg-surface-200 mb-4">
                {(
                  [
                    { id: 'categories' as const, label: 'By Category', icon: BarChart2 },
                    { id: 'thin' as const, label: `Thin (${data.thin_markets.length})`, icon: AlertTriangle },
                    { id: 'stale' as const, label: `Stale (${data.stale_markets.length})`, icon: Clock },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-all',
                      tab === id
                        ? 'bg-surface-50 text-white shadow-sm'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:block">{label}</span>
                    <span className="sm:hidden">{label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {tab === 'categories' && (
                  <motion.div
                    key="categories"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2"
                  >
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-3 pb-1">
                      <span className="text-[10px] font-mono text-surface-600 w-28">CATEGORY</span>
                      <span className="text-[10px] font-mono text-surface-600 flex-1">HEALTH SCORE</span>
                      <span className="text-[10px] font-mono text-surface-600 w-8 text-right">SCR</span>
                      <span className="text-[10px] font-mono text-surface-600 w-16 text-right">ACT/TOT</span>
                      <span className="text-[10px] font-mono text-surface-600 w-12 text-right hidden sm:block">AVG VOL</span>
                      <span className="text-[10px] font-mono text-surface-600 w-20 text-right">TREND</span>
                      <span className="w-3.5" />
                    </div>
                    {data.category_health.length === 0 ? (
                      <EmptyState
                        icon={BarChart2}
                        title="No category data"
                        description="Markets haven't been categorised yet."
                      />
                    ) : (
                      data.category_health.map((cat, i) => (
                        <motion.div
                          key={cat.category}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                        >
                          <CategoryRow cat={cat} />
                        </motion.div>
                      ))
                    )}

                    {/* Footer link to categories */}
                    <div className="pt-2 flex justify-end">
                      <Link
                        href="/exchange/categories"
                        className="inline-flex items-center gap-1 text-for-400 hover:text-for-300 text-xs font-mono transition-colors"
                      >
                        Browse by category
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </motion.div>
                )}

                {tab === 'thin' && (
                  <motion.div
                    key="thin"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2"
                  >
                    <p className="text-xs text-surface-500 mb-3">
                      Markets with fewer than 10 votes — they need more participants to form a reliable consensus.
                    </p>
                    {data.thin_markets.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <CheckCircle2 className="h-8 w-8 text-emerald" />
                        <p className="text-sm text-white font-mono">All active markets have healthy participation</p>
                        <p className="text-xs text-surface-500">No thin markets detected</p>
                      </div>
                    ) : (
                      data.thin_markets.map((m, i) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <ThinMarketRow market={m} />
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                )}

                {tab === 'stale' && (
                  <motion.div
                    key="stale"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-2"
                  >
                    <p className="text-xs text-surface-500 mb-3">
                      Markets with no activity in 7 or more days — consider re-engaging them with new arguments or evidence.
                    </p>
                    {data.stale_markets.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10">
                        <Zap className="h-8 w-8 text-for-400" />
                        <p className="text-sm text-white font-mono">All markets are actively engaged</p>
                        <p className="text-xs text-surface-500">No stale markets detected</p>
                      </div>
                    ) : (
                      data.stale_markets.map((m, i) => (
                        <motion.div
                          key={m.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <StaleMarketRow market={m} />
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                Related tools
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { href: '/exchange/pulse', label: 'Pulse', icon: Activity },
                  { href: '/exchange/screener', label: 'Screener', icon: Target },
                  { href: '/exchange/movers', label: 'Movers', icon: Flame },
                  { href: '/exchange/near-law', label: 'Near Law', icon: Gavel },
                  { href: '/exchange/opportunity', label: 'Opportunity', icon: Zap },
                  { href: '/exchange/timeline', label: 'Timeline', icon: Clock },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-400 hover:text-white transition-colors text-xs font-mono"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
