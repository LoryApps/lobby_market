'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronRight,
  Cpu,
  ExternalLink,
  FlaskConical,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CategoriesResponse, CategorySector } from '@/app/api/exchange/categories/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_CONFIG: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
    darkBorder: string
    label: string
  }
> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         darkBorder: 'border-gold/50',         label: 'Economics' },
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      darkBorder: 'border-for-500/50',      label: 'Politics' },
  Technology:  { icon: Cpu,           color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       darkBorder: 'border-purple/50',       label: 'Technology' },
  Science:     { icon: FlaskConical,  color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      darkBorder: 'border-emerald/50',      label: 'Science' },
  Ethics:      { icon: Scale,         color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  darkBorder: 'border-against-500/50',  label: 'Ethics' },
  Philosophy:  { icon: BookOpen,      color: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/20',      darkBorder: 'border-for-400/40',      label: 'Philosophy' },
  Culture:     { icon: Music2,        color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20',         darkBorder: 'border-gold/40',         label: 'Culture' },
  Health:      { icon: Heart,         color: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  darkBorder: 'border-against-500/50',  label: 'Health' },
  Environment: { icon: Leaf,          color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      darkBorder: 'border-emerald/50',      label: 'Environment' },
  Education:   { icon: GraduationCap, color: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30',       darkBorder: 'border-purple/50',       label: 'Education' },
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'volume' | 'markets' | 'consensus' | 'change'

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'volume', label: 'Volume' },
  { id: 'markets', label: 'Markets' },
  { id: 'consensus', label: 'Consensus' },
  { id: 'change', label: '24h Change' },
]

// ─── Sentiment helpers ────────────────────────────────────────────────────────

function sentimentLabel(s: CategorySector['sentiment']): string {
  switch (s) {
    case 'strong_for':      return 'Strong FOR'
    case 'leaning_for':     return 'Leaning FOR'
    case 'contested':       return 'Contested'
    case 'leaning_against': return 'Leaning AGAINST'
    case 'strong_against':  return 'Strong AGAINST'
    default:                return 'No Data'
  }
}

function sentimentColor(s: CategorySector['sentiment']): string {
  switch (s) {
    case 'strong_for':      return 'text-for-400'
    case 'leaning_for':     return 'text-for-300'
    case 'contested':       return 'text-gold'
    case 'leaning_against': return 'text-against-300'
    case 'strong_against':  return 'text-against-400'
    default:                return 'text-surface-500'
  }
}

function priceBarColor(price: number): string {
  if (price >= 67) return 'bg-for-500'
  if (price >= 55) return 'bg-for-700'
  if (price >= 45) return 'bg-gold'
  if (price >= 33) return 'bg-against-700'
  return 'bg-against-500'
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`
  return v.toString()
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SectorSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
      <Skeleton className="h-9 rounded-lg" />
    </div>
  )
}

// ─── Sector card ──────────────────────────────────────────────────────────────

function SectorCard({ sector, maxVolume }: { sector: CategorySector; maxVolume: number }) {
  const cfg = CAT_CONFIG[sector.category]
  if (!cfg) return null
  const Icon = cfg.icon
  const price = sector.avg_price ?? 50
  const volumeBarPct = maxVolume > 0 ? (sector.total_volume / maxVolume) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 flex flex-col gap-4',
        'hover:border-surface-400 transition-colors group',
        cfg.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0', cfg.bg, 'border', cfg.border)}>
            <Icon className={cn('h-5 w-5', cfg.color)} />
          </div>
          <div className="min-w-0">
            <div className="font-mono font-semibold text-white text-sm">{sector.category}</div>
            <div className={cn('text-xs font-mono', sentimentColor(sector.sentiment))}>
              {sentimentLabel(sector.sentiment)}
            </div>
          </div>
        </div>
        {/* 24h change badge */}
        {sector.price_change_24h !== null && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-mono font-medium px-2 py-1 rounded-full border flex-shrink-0',
            sector.price_change_24h > 0
              ? 'text-for-400 bg-for-500/10 border-for-500/30'
              : sector.price_change_24h < 0
              ? 'text-against-400 bg-against-500/10 border-against-500/30'
              : 'text-surface-500 bg-surface-300/30 border-surface-400',
          )}>
            {sector.price_change_24h > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : sector.price_change_24h < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {sector.price_change_24h > 0 ? '+' : ''}{sector.price_change_24h.toFixed(1)}¢
          </div>
        )}
      </div>

      {/* Consensus price bar */}
      {sector.avg_price !== null ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-surface-500">FOR</span>
            <span className={cn('font-medium', price >= 50 ? 'text-for-400' : 'text-against-400')}>
              {Math.round(price)}¢
            </span>
            <span className="text-surface-500">AGAINST</span>
          </div>
          <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${price}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className={cn('absolute inset-y-0 left-0 rounded-full', priceBarColor(price))}
            />
          </div>
        </div>
      ) : (
        <div className="h-2 rounded-full bg-surface-300/50" />
      )}

      {/* Volume bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs font-mono text-surface-500">
          <span>Volume</span>
          <span className="text-surface-400">{formatVolume(sector.total_volume)}</span>
        </div>
        <div className="relative h-1 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${volumeBarPct}%` }}
            transition={{ duration: 0.7, delay: 0.1, ease: 'easeOut' }}
            className={cn('absolute inset-y-0 left-0 rounded-full', cfg.color.replace('text-', 'bg-'))}
          />
        </div>
      </div>

      {/* Market counts */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Active', value: sector.active_count,   color: 'text-for-400' },
          { label: 'Voting', value: sector.voting_count,   color: 'text-purple' },
          { label: 'Laws',   value: sector.law_count,      color: 'text-gold' },
          { label: 'Failed', value: sector.failed_count,   color: 'text-surface-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg bg-surface-200/50 border border-surface-300/50 p-2 text-center">
            <div className={cn('text-sm font-mono font-bold', color)}>{value}</div>
            <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Top topic */}
      {sector.top_topic && (
        <Link
          href={`/exchange/${sector.top_topic.id}`}
          className="flex items-center gap-2 rounded-xl bg-surface-200/40 border border-surface-300/50 px-3 py-2.5 hover:bg-surface-200 hover:border-surface-400 transition-colors group/link"
        >
          <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0" />
          <span className="text-xs font-mono text-surface-400 flex-1 min-w-0 truncate">
            {truncate(sector.top_topic.statement, 54)}
          </span>
          <span className={cn(
            'text-xs font-mono font-medium flex-shrink-0',
            sector.top_topic.price >= 50 ? 'text-for-400' : 'text-against-400',
          )}>
            {Math.round(sector.top_topic.price)}¢
          </span>
          <ExternalLink className="h-3 w-3 text-surface-600 group-hover/link:text-surface-400 flex-shrink-0 transition-colors" />
        </Link>
      )}

      {/* View all link */}
      <Link
        href={`/exchange?category=${sector.category}`}
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-mono font-medium transition-colors',
          'text-surface-400 border-surface-300 hover:text-white hover:border-surface-400 bg-surface-200/30 hover:bg-surface-200',
        )}
      >
        <span>View {sector.active_count + sector.voting_count} open markets</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CategoriesClient() {
  const [data, setData] = useState<CategoriesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('volume')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/exchange/categories', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load sectors')
      const json = await res.json() as CategoriesResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const sorted = data
    ? [...data.sectors].sort((a, b) => {
        switch (sort) {
          case 'volume':
            return b.total_volume - a.total_volume
          case 'markets':
            return (b.active_count + b.voting_count) - (a.active_count + a.voting_count)
          case 'consensus':
            return (b.avg_price ?? -1) - (a.avg_price ?? -1)
          case 'change':
            return (b.price_change_24h ?? -Infinity) - (a.price_change_24h ?? -Infinity)
          default:
            return 0
        }
      })
    : []

  const maxVolume = sorted.reduce((m, s) => Math.max(m, s.total_volume), 0)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 md:pb-8">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/exchange"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Exchange
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
                <BarChart2 className="h-5 w-5 text-purple" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Sectors</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {loading ? '—' : `${data?.total_markets ?? 0} markets · ${formatVolume(data?.total_volume ?? 0)} votes`}
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* ── Sort bar ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <span className="text-xs font-mono text-surface-500 flex-shrink-0">Sort:</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSort(opt.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors flex-shrink-0',
                sort === opt.id
                  ? 'bg-purple/20 text-purple border-purple/50'
                  : 'bg-surface-200/50 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Exchange sub-nav ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {[
            { href: '/exchange', label: 'Markets' },
            { href: '/exchange/categories', label: 'Sectors', active: true },
            { href: '/exchange/movers', label: 'Movers' },
            { href: '/exchange/resolved', label: 'Resolved' },
            { href: '/exchange/portfolio', label: 'Portfolio' },
            { href: '/exchange/leaderboard', label: 'Leaderboard' },
            { href: '/exchange/alerts', label: 'Alerts' },
          ].map(({ href, label, active }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors flex-shrink-0',
                active
                  ? 'bg-purple/20 text-purple border-purple/50'
                  : 'bg-surface-200/30 text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SectorSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={BarChart2}
            iconColor="text-against-400"
            title="Failed to load sectors"
            description={error}
            action={{ label: 'Try again', onClick: () => load() }}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((sector) => (
                <SectorCard key={sector.category} sector={sector} maxVolume={maxVolume} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Platform summary strip ────────────────────────────────────── */}
        {!loading && !error && data && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Markets',
                value: data.total_markets.toLocaleString(),
                icon: BarChart2,
                color: 'text-purple',
              },
              {
                label: 'Total Volume',
                value: formatVolume(data.total_volume),
                icon: Users,
                color: 'text-for-400',
              },
              {
                label: 'Active Sectors',
                value: data.sectors.filter((s) => s.active_count + s.voting_count > 0).length.toString(),
                icon: Zap,
                color: 'text-gold',
              },
              {
                label: 'Laws Established',
                value: data.sectors.reduce((s, c) => s + c.law_count, 0).toLocaleString(),
                icon: Gavel,
                color: 'text-emerald',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-4 text-center"
              >
                <Icon className={cn('h-4 w-4 mx-auto mb-2', color)} />
                <div className="font-mono text-lg font-bold text-white">{value}</div>
                <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── CTA: full exchange ────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-6 flex items-center justify-center">
            <Link
              href="/exchange"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple/10 border border-purple/30 text-sm font-mono font-medium text-purple hover:bg-purple/20 hover:border-purple/50 transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              View all markets
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
