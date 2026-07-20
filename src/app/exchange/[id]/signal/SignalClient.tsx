'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  Info,
  Layers,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketSignal, SignalFactor, SignalDay } from '@/app/api/exchange/[id]/signal/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-surface-500'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function directionColor(dir: 'bullish' | 'bearish' | 'neutral'): string {
  if (dir === 'bullish') return 'text-for-400'
  if (dir === 'bearish') return 'text-against-400'
  return 'text-surface-400'
}

function directionBg(dir: 'bullish' | 'bearish' | 'neutral'): string {
  if (dir === 'bullish') return 'bg-for-500/15 border-for-500/30'
  if (dir === 'bearish') return 'bg-against-500/15 border-against-500/30'
  return 'bg-surface-300/20 border-surface-400/20'
}

function compositeGradient(score: number): string {
  if (score >= 65) return 'from-for-600 to-for-400'
  if (score >= 55) return 'from-for-700 to-for-500'
  if (score <= 35) return 'from-against-700 to-against-500'
  if (score <= 45) return 'from-against-800 to-against-600'
  return 'from-surface-500 to-surface-400'
}

function confidenceBadge(c: 'low' | 'medium' | 'high') {
  if (c === 'high') return <Badge className="text-[10px] bg-emerald/10 border-emerald/30 text-emerald py-0 px-1.5">High Confidence</Badge>
  if (c === 'medium') return <Badge className="text-[10px] bg-gold/10 border-gold/30 text-gold py-0 px-1.5">Medium Confidence</Badge>
  return <Badge className="text-[10px] bg-surface-300/20 border-surface-400/20 text-surface-500 py-0 px-1.5">Low Confidence</Badge>
}

function FactorIcon({ factorKey }: { factorKey: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  switch (factorKey) {
    case 'consensus':   return <Scale className={cls} />
    case 'momentum':    return <TrendingUp className={cls} />
    case 'volume':      return <Activity className={cls} />
    case 'arguments':   return <MessageSquare className={cls} />
    case 'stability':   return <Shield className={cls} />
    case 'coalitions':  return <Users className={cls} />
    case 'debates':     return <Swords className={cls} />
    default:            return <BarChart2 className={cls} />
  }
}

// ─── Mini SVG spark line for signal history ────────────────────────────────

function SparkLine({ data }: { data: SignalDay[] }) {
  const width = 320
  const height = 56

  const prices = useMemo(() => data.map((d) => d.price), [data])
  const minP = useMemo(() => Math.max(0, Math.min(...prices) - 5), [prices])
  const maxP = useMemo(() => Math.min(100, Math.max(...prices) + 5), [prices])
  const range = maxP - minP || 10

  if (prices.length < 2) return null

  const toX = (i: number) => (i / (prices.length - 1)) * width
  const toY = (p: number) => height - ((p - minP) / range) * height

  const pathD = prices
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p).toFixed(1)}`)
    .join(' ')

  const areaD =
    pathD +
    ` L ${toX(prices.length - 1).toFixed(1)} ${height} L 0 ${height} Z`

  const lastPrice = prices[prices.length - 1]
  const color = lastPrice >= 55 ? '#3b82f6' : lastPrice <= 45 ? '#ef4444' : '#6b7280'
  const areaColor = lastPrice >= 55 ? '#3b82f610' : lastPrice <= 45 ? '#ef444410' : '#6b728010'

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {/* 50¢ reference line */}
      <line
        x1="0"
        y1={toY(50).toFixed(1)}
        x2={width}
        y2={toY(50).toFixed(1)}
        stroke="#4b5563"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      {/* Area fill */}
      <path d={areaD} fill={areaColor} />
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Factor row ───────────────────────────────────────────────────────────────

function FactorRow({ factor, index }: { factor: SignalFactor; index: number }) {
  const barWidth = factor.score
  const barColor =
    factor.direction === 'bullish'
      ? 'bg-for-500'
      : factor.direction === 'bearish'
      ? 'bg-against-500'
      : 'bg-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.2 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('flex-shrink-0', directionColor(factor.direction))}>
            <FactorIcon factorKey={factor.key} />
          </span>
          <span className="text-xs font-mono font-semibold text-white truncate">
            {factor.label}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('text-[11px] font-mono font-bold', directionColor(factor.direction))}>
            {factor.direction === 'bullish' ? 'FOR' : factor.direction === 'bearish' ? 'AGAINST' : 'NEUTRAL'}
          </span>
          <span className="text-[11px] font-mono text-surface-500 w-8 text-right">
            {factor.score}
          </span>
        </div>
      </div>

      {/* Bar */}
      <div className="relative h-1.5 rounded-full bg-surface-400/30 overflow-hidden">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ delay: 0.05 * index + 0.1, duration: 0.4, ease: 'easeOut' }}
        />
        {/* 50% neutral marker */}
        <div className="absolute top-0 bottom-0 w-px bg-surface-400/60" style={{ left: '50%' }} />
      </div>

      <p className="text-[11px] font-mono text-surface-500 leading-snug">
        {factor.description}
      </p>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SignalSkeleton() {
  return (
    <div className="space-y-6 pt-2">
      <Skeleton className="h-32 rounded-2xl w-full" />
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <div className="space-y-4">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function SignalClient() {
  const params = useParams()
  const id = params?.id as string

  const [data, setData] = useState<MarketSignal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (!id) return
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/signal`)
      if (!res.ok) {
        if (res.status === 404) { setError('Market not found'); return }
        throw new Error(`HTTP ${res.status}`)
      }
      setData(await res.json() as MarketSignal)
    } catch {
      setError('Failed to load signal data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const statusBadgeVariant = (s: string) => {
    if (s === 'law') return 'law'
    if (s === 'voting') return 'voting'
    if (s === 'active') return 'active'
    return 'default'
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href={id ? `/exchange/${id}` : '/exchange'}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to market
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          <SignalSkeleton />
        ) : error ? (
          <EmptyState
            icon={BarChart2}
            title="Signal unavailable"
            description={error}
            action={
              <button
                onClick={() => load()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white font-mono text-sm transition-colors"
              >
                Retry
              </button>
            }
          />
        ) : !data ? null : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* ── Topic header ─────────────────────────────────────────────── */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusBadgeVariant(data.status) as 'law' | 'voting' | 'active' | 'default'} size="sm">
                  {data.status === 'law' ? (
                    <><Gavel className="h-3 w-3 mr-0.5" />Law</>
                  ) : data.status === 'voting' ? (
                    <><Zap className="h-3 w-3 mr-0.5" />Voting</>
                  ) : data.status === 'active' ? (
                    <><Flame className="h-3 w-3 mr-0.5" />Live</>
                  ) : data.status}
                </Badge>
                {data.category && (
                  <span className="text-[11px] font-mono text-surface-500 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300">
                    {data.category}
                  </span>
                )}
                <span className={cn('text-[11px] font-mono font-bold', priceColor(data.price, data.status))}>
                  {data.price}¢
                </span>
              </div>
              <h1 className="text-base font-mono font-bold text-white leading-snug">
                {data.statement}
              </h1>
            </div>

            {/* ── Composite signal card ────────────────────────────────────── */}
            <div className={cn(
              'relative overflow-hidden rounded-2xl border p-5',
              directionBg(data.composite_direction),
            )}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-1">
                    Composite Signal
                  </p>
                  <div className="flex items-center gap-3">
                    <span className={cn('text-4xl font-mono font-black', directionColor(data.composite_direction))}>
                      {data.composite_score}
                    </span>
                    <div>
                      <p className={cn('text-base font-mono font-bold', directionColor(data.composite_direction))}>
                        {data.composite_label}
                      </p>
                      <div className="mt-0.5">
                        {confidenceBadge(data.confidence)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direction icon */}
                <div className={cn(
                  'flex items-center justify-center h-14 w-14 rounded-xl flex-shrink-0',
                  data.composite_direction === 'bullish'
                    ? 'bg-for-500/20 border border-for-500/30'
                    : data.composite_direction === 'bearish'
                    ? 'bg-against-500/20 border border-against-500/30'
                    : 'bg-surface-300/20 border border-surface-400/20',
                )}>
                  {data.composite_direction === 'bullish' ? (
                    <ThumbsUp className="h-6 w-6 text-for-400" />
                  ) : data.composite_direction === 'bearish' ? (
                    <ThumbsDown className="h-6 w-6 text-against-400" />
                  ) : (
                    <Scale className="h-6 w-6 text-surface-400" />
                  )}
                </div>
              </div>

              {/* Composite bar */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-[10px] font-mono text-surface-600">
                  <span>AGAINST 0</span>
                  <span>NEUTRAL 50</span>
                  <span>100 FOR</span>
                </div>
                <div className="relative h-2.5 rounded-full bg-surface-400/30 overflow-hidden">
                  <motion.div
                    className={cn('absolute inset-y-0 left-0 rounded-full bg-gradient-to-r', compositeGradient(data.composite_score))}
                    initial={{ width: 0 }}
                    animate={{ width: `${data.composite_score}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                  <div className="absolute top-0 bottom-0 w-px bg-surface-400/60" style={{ left: '50%' }} />
                </div>
              </div>

              {/* Summary lines */}
              <ul className="space-y-1">
                {data.summary.map((line, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Info className="h-3 w-3 flex-shrink-0 text-surface-500 mt-0.5" />
                    <span className="text-[11px] font-mono text-surface-300 leading-snug">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* ── Signal stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Price',
                  value: `${data.price}¢`,
                  sub: data.status,
                  color: priceColor(data.price, data.status),
                },
                {
                  label: 'Volume',
                  value: data.volume >= 1000 ? `${(data.volume / 1000).toFixed(1)}K` : data.volume.toString(),
                  sub: 'total votes',
                  color: 'text-white',
                },
                {
                  label: 'Data Points',
                  value: data.snapshot_count.toString(),
                  sub: 'price snapshots',
                  color: 'text-white',
                },
                {
                  label: 'Key Driver',
                  value: data.key_driver ?? 'None',
                  sub: 'top signal',
                  color: 'text-for-400',
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-1"
                >
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <p className={cn('text-sm font-mono font-bold truncate', stat.color)}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] font-mono text-surface-600">{stat.sub}</p>
                </div>
              ))}
            </div>

            {/* ── 30-day price history ─────────────────────────────────────── */}
            {data.signal_history.length >= 2 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-surface-500" />
                    <span className="text-xs font-mono font-semibold text-white">
                      Price History
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-surface-600">
                    {data.signal_history.length} days
                  </span>
                </div>
                <SparkLine data={data.signal_history} />
                <div className="flex justify-between mt-2 text-[10px] font-mono text-surface-600">
                  <span>{data.signal_history[0]?.date.slice(5)}</span>
                  <span className="text-surface-500">50¢ neutral</span>
                  <span>{data.signal_history[data.signal_history.length - 1]?.date.slice(5)}</span>
                </div>
              </div>
            )}

            {/* ── Signal factors ───────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-surface-400" />
                  <span className="text-sm font-mono font-bold text-white">Signal Factors</span>
                </div>
                <span className="text-[11px] font-mono text-surface-600">
                  {data.factors.length} indicators
                </span>
              </div>
              <div className="space-y-5">
                {data.factors.map((factor, i) => (
                  <FactorRow key={factor.key} factor={factor} index={i} />
                ))}
              </div>

              {/* Legend */}
              <div className="mt-5 pt-4 border-t border-surface-300/50 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-8 rounded-full bg-for-500" />
                  <span className="text-[10px] font-mono text-surface-500">FOR (bullish)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-8 rounded-full bg-against-500" />
                  <span className="text-[10px] font-mono text-surface-500">AGAINST (bearish)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-8 rounded-full bg-surface-500" />
                  <span className="text-[10px] font-mono text-surface-500">Neutral</span>
                </div>
                <span className="text-[10px] font-mono text-surface-600">
                  Bar midpoint = 50 (neutral)
                </span>
              </div>
            </div>

            {/* ── Quick links ──────────────────────────────────────────────── */}
            <div className="space-y-1">
              <p className="text-[11px] font-mono text-surface-600 uppercase tracking-widest mb-2">
                Dig deeper
              </p>
              {[
                { href: `/exchange/${id}/analysis`, icon: TrendingUp, label: 'Price Analysis', sub: 'Velocity, momentum & distribution' },
                { href: `/exchange/${id}/arguments`, icon: MessageSquare, label: 'Arguments', sub: 'FOR vs AGAINST argument quality' },
                { href: `/exchange/${id}/coalitions`, icon: Users, label: 'Coalition Positions', sub: 'Organised group stances' },
                { href: `/exchange/${id}/debates`, icon: Swords, label: 'Active Debates', sub: 'Live and scheduled debate rooms' },
                { href: `/exchange/${id}/traders`, icon: Activity, label: 'Top Traders', sub: 'Highest-accuracy voter breakdown' },
                { href: `/exchange/${id}/forecast`, icon: BarChart2, label: 'Price Forecasts', sub: 'Community price targets' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-200 hover:bg-surface-200/50 transition-all group"
                >
                  <link.icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold text-white group-hover:text-for-300 transition-colors">
                      {link.label}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500">{link.sub}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 pt-2 border-t border-surface-300/50 flex-wrap">
              <Link
                href={`/exchange/${id}`}
                className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to market
              </Link>
              <span className="text-surface-700 text-[11px]">·</span>
              <Link
                href="/exchange/signals"
                className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
              >
                <ArrowUpRight className="h-3 w-3" />
                All platform signals
              </Link>
              <span className="text-surface-700 text-[11px]">·</span>
              <Link
                href={`/topic/${id}/signal`}
                className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-purple transition-colors"
              >
                <ArrowUpRight className="h-3 w-3" />
                Civic signal view
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
