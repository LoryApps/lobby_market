'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Cpu,
  Gavel,
  Heart,
  Landmark,
  Leaf,
  RefreshCw,
  Scale,
  Swords,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CivicIndex, IndicesResponse } from '@/app/api/exchange/indices/route'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp: TrendingUp,
  Landmark: Landmark,
  Cpu: Cpu,
  Leaf: Leaf,
  Heart: Heart,
  Scale: Scale,
  BookOpen: BookOpen,
  Gavel: Gavel,
  Swords: Swords,
}

function IndexIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? BarChart2
  return <Icon className={className} />
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function colorToClass(color: string, variant: 'text' | 'bg' | 'border', shade?: string) {
  if (color === 'gold') {
    if (variant === 'text') return 'text-gold'
    if (variant === 'bg') return shade === 'dim' ? 'bg-gold/15' : 'bg-gold'
    return 'border-gold/30'
  }
  if (color === 'for') {
    if (variant === 'text') return 'text-for-400'
    if (variant === 'bg') return shade === 'dim' ? 'bg-for-500/15' : 'bg-for-500'
    return 'border-for-500/30'
  }
  if (color === 'against') {
    if (variant === 'text') return 'text-against-400'
    if (variant === 'bg') return shade === 'dim' ? 'bg-against-500/15' : 'bg-against-500'
    return 'border-against-500/30'
  }
  if (color === 'purple') {
    if (variant === 'text') return 'text-purple'
    if (variant === 'bg') return shade === 'dim' ? 'bg-purple/15' : 'bg-purple'
    return 'border-purple/30'
  }
  if (color === 'emerald') {
    if (variant === 'text') return 'text-emerald'
    if (variant === 'bg') return shade === 'dim' ? 'bg-emerald/15' : 'bg-emerald'
    return 'border-emerald/30'
  }
  return 'text-surface-400'
}

function priceBarColor(price: number): string {
  if (price >= 67) return 'bg-gold'
  if (price >= 55) return 'bg-for-500'
  if (price <= 33) return 'bg-against-600'
  if (price <= 45) return 'bg-against-500'
  return 'bg-surface-500'
}

function priceTextColor(price: number): string {
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function directionBadge(dir: CivicIndex['direction']) {
  if (dir === 'bull') return { label: 'BULLISH', cls: 'bg-for-500/15 text-for-400 border-for-500/30' }
  if (dir === 'bear') return { label: 'BEARISH', cls: 'bg-against-500/15 text-against-400 border-against-500/30' }
  return { label: 'NEUTRAL', cls: 'bg-surface-200 text-surface-500 border-surface-300' }
}

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Index card ───────────────────────────────────────────────────────────────

function IndexCard({ idx }: { idx: CivicIndex }) {
  const [expanded, setExpanded] = useState(false)
  const dir = directionBadge(idx.direction)

  return (
    <motion.div
      layout
      className="bg-surface-100 border border-surface-200 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-surface-150 transition-colors"
      >
        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            colorToClass(idx.color, 'bg', 'dim'),
          )}
        >
          <IndexIcon name={idx.icon} className={cn('w-5 h-5', colorToClass(idx.color, 'text'))} />
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-surface-900 text-sm">{idx.name}</span>
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border tracking-wide',
                dir.cls,
              )}
            >
              {dir.label}
            </span>
          </div>
          <p className="text-surface-500 text-xs mt-0.5 leading-relaxed line-clamp-2">
            {idx.description}
          </p>
        </div>

        {/* Composite price */}
        <div className="flex-shrink-0 text-right ml-2">
          <span className={cn('text-2xl font-bold tabular-nums', priceTextColor(idx.composite_price))}>
            {idx.composite_price}¢
          </span>
          <div className="text-surface-500 text-[10px] font-medium mt-0.5">COMPOSITE</div>
        </div>
      </button>

      {/* Price bar */}
      <div className="px-4 pb-3">
        <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', priceBarColor(idx.composite_price))}
            style={{ width: `${idx.composite_price}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-2 text-[11px] text-surface-500">
          <span>
            <span className="text-surface-700 font-medium">{idx.market_count}</span> markets
          </span>
          <span>
            <span className="text-for-400 font-medium">{idx.active_count}</span> live
          </span>
          {idx.settled_yes_count > 0 && (
            <span>
              <span className="text-gold font-medium">{idx.settled_yes_count}</span> law
            </span>
          )}
          <span className="ml-auto">
            Vol <span className="text-surface-700 font-medium">{formatVolume(idx.total_volume)}</span>
          </span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </div>
      </div>

      {/* Expanded: constituent markets */}
      <AnimatePresence>
        {expanded && idx.constituents.length > 0 && (
          <motion.div
            key="constituents"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-surface-200"
          >
            <div className="px-4 py-3 space-y-2">
              <div className="text-[10px] text-surface-500 font-semibold tracking-widest uppercase mb-2">
                Top Constituents
              </div>
              {idx.constituents.map((c) => (
                <Link
                  key={c.id}
                  href={`/exchange/${c.id}`}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-200 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-surface-800 font-medium line-clamp-1 group-hover:text-surface-900">
                      {c.statement}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {c.category && (
                        <span className="text-[10px] text-surface-500">{c.category}</span>
                      )}
                      {c.status === 'law' && (
                        <span className="text-[10px] text-gold font-semibold">LAW</span>
                      )}
                      {c.status === 'failed' && (
                        <span className="text-[10px] text-against-400 font-semibold">FAILED</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-1 bg-surface-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', priceBarColor(c.price))}
                        style={{ width: `${c.price}%` }}
                      />
                    </div>
                    <span className={cn('text-xs font-bold w-8 text-right tabular-nums', priceTextColor(c.price))}>
                      {c.price}¢
                    </span>
                    <ChevronRight className="w-3 h-3 text-surface-400 group-hover:text-surface-600" />
                  </div>
                </Link>
              ))}
              {idx.market_count > idx.constituents.length && (
                <div className="text-[10px] text-surface-500 text-center pt-1">
                  +{idx.market_count - idx.constituents.length} more markets in this index
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function IndicesClient() {
  const [data, setData] = useState<IndicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/exchange/indices')
      if (!res.ok) throw new Error('Failed to load')
      const json: IndicesResponse = await res.json()
      setData(json)
    } catch {
      // keep existing data on refresh failure
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const asOf = data
    ? new Date(data.as_of).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24">
        {/* Header */}
        <div className="sticky top-14 z-10 bg-surface-50/90 backdrop-blur border-b border-surface-200">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link
              href="/exchange"
              className="flex items-center gap-1.5 text-surface-500 hover:text-surface-800 transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Exchange
            </Link>

            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-surface-900 text-base leading-none">
                Civic Indices
              </h1>
              {asOf && (
                <div className="text-[10px] text-surface-500 mt-0.5">Updated {asOf}</div>
              )}
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 disabled:opacity-40"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Exchange sub-nav */}
          <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none text-xs">
            {(
              [
                { href: '/exchange', label: 'Markets' },
                { href: '/exchange/movers', label: 'Movers' },
                { href: '/exchange/categories', label: 'Sectors' },
                { href: '/exchange/indices', label: 'Indices', active: true },
                { href: '/exchange/correlations', label: 'Correlations' },
                { href: '/exchange/portfolio', label: 'Portfolio' },
                { href: '/exchange/leaderboard', label: 'Leaderboard' },
              ] as { href: string; label: string; active?: boolean }[]
            ).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex-shrink-0 px-3 py-1 rounded-full font-medium transition-colors',
                  item.active
                    ? 'bg-for-500 text-white'
                    : 'text-surface-500 hover:text-surface-800 hover:bg-surface-200',
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Intro */}
          <div className="bg-surface-100 border border-surface-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-gold" />
              <span className="text-xs font-semibold text-surface-700 uppercase tracking-wider">About Civic Indices</span>
            </div>
            <p className="text-sm text-surface-600 leading-relaxed">
              Curated baskets of civic markets that move together. Each index aggregates the
              volume-weighted consensus of related debates — giving you a pulse on thematic
              policy direction without watching every market individually.
            </p>
          </div>

          {/* Category indices + special indices */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : !data || data.indices.length === 0 ? (
            <EmptyState
              icon={TrendingDown}
              title="No index data yet"
              description="Markets will populate these indices as voting activity grows."
            />
          ) : (
            <>
              {/* Category indices */}
              <div>
                <h2 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest mb-3">
                  Sector Indices
                </h2>
                <div className="space-y-3">
                  {data.indices
                    .filter((i) => !['law-momentum', 'contested-ground'].includes(i.id))
                    .map((idx) => (
                      <IndexCard key={idx.id} idx={idx} />
                    ))}
                </div>
              </div>

              {/* Special indices */}
              {data.indices.some((i) => ['law-momentum', 'contested-ground'].includes(i.id)) && (
                <div>
                  <h2 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest mb-3">
                    Special Indices
                  </h2>
                  <div className="space-y-3">
                    {data.indices
                      .filter((i) => ['law-momentum', 'contested-ground'].includes(i.id))
                      .map((idx) => (
                        <IndexCard key={idx.id} idx={idx} />
                      ))}
                  </div>
                </div>
              )}

              {/* Market link */}
              <Link
                href="/exchange"
                className="flex items-center justify-center gap-2 py-3 text-sm text-surface-500 hover:text-surface-800 transition-colors"
              >
                View all markets on the Exchange
                <ChevronRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  )
}
