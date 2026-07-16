'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronRight,
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
import type { ArbitrageResponse, ArbMarket, ArbDirection } from '@/app/api/exchange/arbitrage/route'

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: 'all',           label: 'All Gaps',       icon: BarChart2   },
  { id: 'expert_higher', label: 'Experts Bullish', icon: TrendingUp  },
  { id: 'expert_lower',  label: 'Experts Bearish', icon: TrendingDown },
] as const
type FilterId = (typeof FILTER_TABS)[number]['id']

// ─── Category pills ───────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function spreadBadge(spread: number): { label: string; cls: string } {
  if (spread >= 30) return { label: 'Extreme', cls: 'bg-against-500/20 text-against-300 border-against-500/30' }
  if (spread >= 20) return { label: 'Large',   cls: 'bg-gold/15 text-gold border-gold/30' }
  if (spread >= 12) return { label: 'Notable', cls: 'bg-for-500/15 text-for-300 border-for-500/30' }
  return { label: 'Mild', cls: 'bg-surface-700 text-surface-500 border-surface-600' }
}

function directionMeta(direction: ArbDirection): {
  label: string
  hint: string
  icon: typeof TrendingUp
  color: string
  barColor: string
} {
  if (direction === 'expert_higher') {
    return {
      label: 'Experts MORE bullish',
      hint: 'Experts think crowd is underpricing FOR support.',
      icon: TrendingUp,
      color: 'text-emerald-400',
      barColor: 'bg-emerald-500',
    }
  }
  return {
    label: 'Experts MORE bearish',
    hint: 'Experts think crowd is overpricing FOR support.',
    icon: TrendingDown,
    color: 'text-against-400',
    barColor: 'bg-against-500',
  }
}

function priceColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Arb Market Card ─────────────────────────────────────────────────────────

function ArbCard({ market, index }: { market: ArbMarket; index: number }) {
  const badge     = spreadBadge(market.spread)
  const dirMeta   = directionMeta(market.direction)
  const DirIcon   = dirMeta.icon

  const crowdPct   = Math.round(market.crowd_price)
  const expertPct  = Math.round(market.expert_price)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Link href={`/exchange/${market.id}`} className="block group">
        <div className="relative overflow-hidden rounded-xl border border-surface-700/60 bg-surface-800/50 hover:bg-surface-800 hover:border-surface-600 transition-all duration-200">
          {/* Spread indicator strip */}
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 w-1 rounded-l-xl',
              market.spread >= 30 ? 'bg-against-500' :
              market.spread >= 20 ? 'bg-gold' :
              market.spread >= 12 ? 'bg-for-500' :
              'bg-surface-600'
            )}
          />

          <div className="pl-5 pr-4 py-4">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-200 line-clamp-2 leading-snug group-hover:text-white transition-colors">
                  {market.statement}
                </p>
                {market.category && (
                  <span className="mt-1 inline-block text-xs text-surface-500">
                    {market.category}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', badge.cls)}>
                  {badge.label}
                </span>
                <span className="text-xs text-surface-500">
                  {market.expert_votes} experts
                </span>
              </div>
            </div>

            {/* Consensus bars */}
            <div className="space-y-2 mb-3">
              {/* Crowd bar */}
              <div className="flex items-center gap-2">
                <span className="w-14 text-xs text-surface-500 shrink-0">Crowd</span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-for-600 transition-all duration-700"
                    style={{ width: `${crowdPct}%` }}
                  />
                </div>
                <span className={cn('text-xs font-semibold tabular-nums w-10 text-right', priceColor(market.crowd_price))}>
                  {crowdPct}¢
                </span>
              </div>

              {/* Expert bar */}
              <div className="flex items-center gap-2">
                <span className="w-14 text-xs text-surface-400 shrink-0 flex items-center gap-1">
                  <Brain className="w-3 h-3" /> Expert
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', dirMeta.barColor)}
                    style={{ width: `${expertPct}%` }}
                  />
                </div>
                <span className={cn('text-xs font-semibold tabular-nums w-10 text-right', priceColor(market.expert_price))}>
                  {expertPct}¢
                </span>
              </div>
            </div>

            {/* Gap row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <DirIcon className={cn('w-3.5 h-3.5', dirMeta.color)} />
                <span className={cn('text-xs font-medium', dirMeta.color)}>
                  {dirMeta.label}
                </span>
                <span className="text-xs text-surface-600">·</span>
                <span className="text-xs text-surface-500">
                  Gap: <span className="font-semibold text-surface-300">{market.spread.toFixed(1)}pt</span>
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-surface-600 group-hover:text-surface-400 transition-colors">
                Trade <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Loading skeletons ────────────────────────────────────────────────────────

function ArbSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface-700/60 bg-surface-800/50 p-4 pl-5">
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2 mb-3" />
          <Skeleton className="h-1.5 w-full mb-1.5" />
          <Skeleton className="h-1.5 w-full mb-3" />
          <Skeleton className="h-3 w-2/5" />
        </div>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function ArbitrageClient() {
  const [data, setData]       = useState<ArbitrageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [filter, setFilter]   = useState<FilterId>('all')
  const [category, setCategory] = useState('All')
  const [refreshed, setRefreshed] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/arbitrage')
      if (!res.ok) throw new Error('Failed to load arbitrage data')
      const json: ArbitrageResponse = await res.json()
      setData(json)
      if (silent) {
        setRefreshed(true)
        setTimeout(() => setRefreshed(false), 2000)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Filtered markets
  const filtered = (data?.markets ?? []).filter((m) => {
    if (filter !== 'all' && m.direction !== filter) return false
    if (category !== 'All' && m.category !== category) return false
    return true
  })

  const expertHigher = (data?.markets ?? []).filter((m) => m.direction === 'expert_higher').length
  const expertLower  = (data?.markets ?? []).filter((m) => m.direction === 'expert_lower').length

  return (
    <div className="min-h-screen bg-surface-950 text-white">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-28">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Exchange
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-gold" />
              <h1 className="text-xl font-bold text-white">Arbitrage Scanner</h1>
            </div>
            <button
              onClick={() => load(true)}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshed && 'text-emerald-400')} />
              {refreshed ? 'Updated' : 'Refresh'}
            </button>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            Markets where expert traders (high-reputation users) disagree with the crowd consensus.
            A large gap may signal mispriced markets worth a closer look.
          </p>
        </div>

        {/* Stats bar */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-3 gap-2 mb-5"
          >
            {[
              {
                label: 'Gaps Found',
                value: data.markets.length,
                icon: Scale,
                color: 'text-gold',
              },
              {
                label: 'Experts Bullish',
                value: expertHigher,
                icon: TrendingUp,
                color: 'text-emerald-400',
              },
              {
                label: 'Experts Bearish',
                value: expertLower,
                icon: TrendingDown,
                color: 'text-against-400',
              },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="rounded-lg border border-surface-700/60 bg-surface-800/50 px-3 py-2.5 text-center"
                >
                  <Icon className={cn('w-4 h-4 mx-auto mb-1', stat.color)} />
                  <div className="text-lg font-bold text-white tabular-nums">{stat.value}</div>
                  <div className="text-xs text-surface-500">{stat.label}</div>
                </div>
              )
            })}
          </motion.div>
        )}

        {/* How it works */}
        {!loading && !error && (
          <details className="mb-5 group">
            <summary className="flex items-center gap-2 text-xs text-surface-500 hover:text-surface-400 cursor-pointer select-none">
              <Sparkles className="w-3.5 h-3.5" />
              How this works
              <ChevronRight className="w-3 h-3 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="mt-2 rounded-lg border border-surface-700/50 bg-surface-800/30 px-3 py-3 text-xs text-surface-500 space-y-1.5">
              <p>
                <span className="text-surface-300 font-medium">Expert consensus</span> is calculated
                from votes by users with reputation ≥ 80, high clout (≥ 200), or moderator/admin roles.
              </p>
              <p>
                <span className="text-surface-300 font-medium">Crowd consensus</span> is the overall
                market price (blue_pct) including all voters.
              </p>
              <p>
                A <span className="text-surface-300 font-medium">large gap</span> means experts and
                the crowd disagree significantly — historically a signal of mispriced markets.
              </p>
            </div>
          </details>
        )}

        {/* Direction filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shrink-0',
                  filter === tab.id
                    ? 'bg-surface-700 text-white border-surface-600'
                    : 'bg-surface-800/50 text-surface-500 border-surface-700/60 hover:text-surface-300'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs border transition-all shrink-0',
                category === cat
                  ? 'bg-surface-700 text-white border-surface-600'
                  : 'bg-transparent text-surface-500 border-surface-700/50 hover:text-surface-300'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <ArbSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-against-400 opacity-60" />
            <p className="text-surface-400 text-sm">{error}</p>
            <button
              onClick={() => load()}
              className="text-xs text-for-400 hover:text-for-300"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No gaps found"
            description={
              filter !== 'all' || category !== 'All'
                ? 'No arbitrage gaps match the current filters. Try broadening your selection.'
                : 'Experts and the crowd are in close agreement across all active markets right now.'
            }
          />
        ) : (
          <div className="space-y-3">
            {/* Section header for active direction */}
            {filter === 'expert_higher' && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Experts think crowd is underpricing FOR support
              </div>
            )}
            {filter === 'expert_lower' && (
              <div className="flex items-center gap-2 text-xs text-against-400 mb-1">
                <TrendingDown className="w-3.5 h-3.5" />
                Experts think crowd is overpricing FOR support
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {filtered.map((market, i) => (
                <ArbCard key={market.id} market={market} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer meta */}
        {data && !loading && (
          <div className="mt-6 flex items-center justify-between text-xs text-surface-600">
            <span>{data.meta.expert_count} experts tracked · {data.meta.topics_scanned} topics scanned</span>
            <span>as of {new Date(data.as_of).toLocaleTimeString()}</span>
          </div>
        )}

        {/* CTA links */}
        {!loading && !error && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { href: '/exchange/smart-money', label: 'Smart Money', icon: Brain },
              { href: '/exchange/signals',     label: 'Signals',     icon: Zap   },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-surface-700/60 bg-surface-800/50 hover:bg-surface-800 hover:border-surface-600 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                  <span className="text-sm text-surface-400 group-hover:text-surface-200 transition-colors">
                    {label}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
