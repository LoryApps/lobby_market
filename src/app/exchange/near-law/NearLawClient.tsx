'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Clock,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { NearLawMarket, NearLawResponse } from '@/app/api/exchange/near-law/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-for-300',
  Philosophy:  'text-purple',
  Culture:     'text-against-300',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h`
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

// ─── Tier config ───────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  imminent: {
    label: 'IMMINENT',
    desc: 'Within 2¢ of law',
    icon: Flame,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    pill: 'bg-gold/15 text-gold border-gold/30',
    bar: 'bg-gold',
  },
  close: {
    label: 'CLOSE',
    desc: '2–7¢ from law',
    icon: TrendingUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    pill: 'bg-for-500/15 text-for-300 border-for-500/30',
    bar: 'bg-for-500',
  },
  approaching: {
    label: 'APPROACHING',
    desc: '7–12¢ from law',
    icon: Target,
    color: 'text-surface-400',
    bg: 'bg-surface-200/60',
    border: 'border-surface-300/60',
    pill: 'bg-surface-300/30 text-surface-400 border-surface-400/30',
    bar: 'bg-for-600',
  },
} as const

// ─── Market card ───────────────────────────────────────────────────────────────

function MarketCard({ market, rank }: { market: NearLawMarket; rank: number }) {
  const tier = TIER_CONFIG[market.tier]
  const TierIcon = tier.icon
  const catColor = CATEGORY_COLOR[market.category ?? ''] ?? 'text-surface-500'
  const pct = Math.round(market.blue_pct)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, delay: Math.min(rank * 0.03, 0.3) }}
    >
      <Link
        href={`/exchange/${market.id}`}
        className={cn(
          'flex items-start gap-3 p-3.5 rounded-xl border transition-all group',
          'hover:border-opacity-80',
          tier.bg, tier.border,
        )}
      >
        {/* Rank */}
        <span className={cn('text-xs font-mono font-bold mt-0.5 w-5 flex-shrink-0', tier.color)}>
          {rank}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-2 group-hover:text-for-200 transition-colors">
            {market.statement}
          </p>

          {/* Consensus bar */}
          <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={cn('absolute inset-y-0 left-0 rounded-l-full', tier.bar)}
            />
            {/* Law threshold marker at 67% */}
            <div
              className="absolute top-0 bottom-0 w-px bg-gold/60"
              style={{ left: '67%' }}
              title="Law threshold (67%)"
            />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-[11px] font-mono flex-wrap">
            <span className={cn('font-bold', tier.color)}>
              {pct}¢
            </span>
            <span className="text-surface-500">
              {market.gap_to_law > 0 ? `${market.gap_to_law.toFixed(1)}¢ to law` : 'Law threshold reached'}
            </span>
            <span className="text-surface-600">
              <Vote className="h-2.5 w-2.5 inline mr-0.5" />
              {formatVolume(market.total_votes)}
            </span>
            {market.category && (
              <span className={cn('font-semibold', catColor)}>
                {market.category}
              </span>
            )}
            {market.ends_at && (
              <span className="text-surface-600 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {timeUntil(market.ends_at)}
              </span>
            )}
          </div>
        </div>

        {/* Tier badge + arrow */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border',
            tier.pill,
          )}>
            <TierIcon className="h-2.5 w-2.5" aria-hidden="true" />
            {tier.label}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" aria-hidden="true" />
        </div>
      </Link>
    </motion.div>
  )
}

function MarketSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300">
      <Skeleton className="w-4 h-3.5 mt-1" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-20 h-6 rounded-md" />
    </div>
  )
}

// ─── Summary stat ──────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, label, count, color, bg, border }: {
  icon: typeof Flame
  label: string
  count: number
  color: string
  bg: string
  border: string
}) {
  return (
    <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border', bg, border)}>
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} aria-hidden="true" />
      <div>
        <p className={cn('text-sm font-bold font-mono', color)}>{count}</p>
        <p className="text-[10px] text-surface-500">{label}</p>
      </div>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function NearLawClient() {
  const [data, setData] = useState<NearLawResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [refreshKey, setRefreshKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '60' })
      if (category !== 'All') params.set('category', category)
      const res = await fetch(`/api/exchange/near-law?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: NearLawResponse = await res.json()
      setData(json)
    } catch {
      // keep stale data
    } finally {
      setLoading(false)
    }
  }, [category, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
    // Auto-refresh every 2 minutes
    const timer = setInterval(load, 120_000)
    return () => clearInterval(timer)
  }, [load])

  const markets = data?.markets ?? []

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
              <Gavel className="h-5 w-5 text-gold" aria-hidden="true" />
              <h1 className="text-xl font-bold text-white">Near-Law Radar</h1>
            </div>
            <p className="text-sm text-surface-500">
              Active markets within 12¢ of the 67¢ supermajority threshold
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/exchange/alerts"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 text-xs font-medium text-surface-500 hover:text-for-300 transition-colors"
            >
              <Bell className="h-3.5 w-3.5" />
              Set alert
            </Link>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              aria-label="Refresh markets"
              className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Summary stats */}
        {data && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatPill
              icon={Flame}
              label="Imminent (≥65¢)"
              count={data.imminent_count}
              color="text-gold"
              bg="bg-gold/8"
              border="border-gold/25"
            />
            <StatPill
              icon={TrendingUp}
              label="Close (60–65¢)"
              count={data.close_count}
              color="text-for-400"
              bg="bg-for-500/8"
              border="border-for-500/25"
            />
            <StatPill
              icon={Target}
              label="Approaching (55¢+)"
              count={data.approaching_count}
              color="text-surface-400"
              bg="bg-surface-200/60"
              border="border-surface-300/40"
            />
          </div>
        )}

        {/* Category filter */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold border transition-all',
                category === cat
                  ? 'bg-surface-200 text-white border-surface-400'
                  : 'text-surface-500 border-transparent hover:text-white hover:border-surface-300',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* How to read */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-100/60 border border-surface-300/40 mb-4">
          <Sparkles className="h-4 w-4 text-gold mt-0.5 flex-shrink-0" aria-hidden="true" />
          <p className="text-[11px] text-surface-500 leading-relaxed">
            <span className="text-surface-400 font-semibold">Reading the bar:</span> The gold marker at 67¢ is the supermajority threshold.
            When a market crosses it, the topic advances to a final vote before becoming law.
            Your vote on these markets has the highest leverage.
          </p>
        </div>

        {/* Market list */}
        {loading && !data ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <MarketSkeleton key={i} />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No markets near law"
            description={
              category !== 'All'
                ? `No ${category} markets are currently above 55¢. Try a different category.`
                : 'No active markets are currently close to the supermajority threshold. Check back as votes come in.'
            }
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {markets.map((market, i) => (
                <MarketCard key={market.id} market={market} rank={i + 1} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer explanation */}
        <div className="mt-8 p-4 rounded-xl bg-surface-100/60 border border-surface-300/40 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-3.5 w-3.5 text-gold" aria-hidden="true" />
            <span className="text-xs font-semibold text-white">How laws are made</span>
          </div>
          <p className="text-[11px] text-surface-500 leading-relaxed">
            A topic becomes law when it reaches 67% FOR consensus (a supermajority) and then passes
            a final ratification vote. Markets shown here are in the critical zone — your vote now
            can be the difference between passage and defeat.
          </p>
          <p className="text-[11px] text-surface-600">
            Auto-refreshes every 2 minutes · Only active markets shown · Thresholds: 55¢ approaching, 60¢ close, 65¢ imminent
          </p>
        </div>

        {/* Back link */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to all markets
          </Link>
          <Link
            href="/exchange/movers"
            className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Market movers
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
