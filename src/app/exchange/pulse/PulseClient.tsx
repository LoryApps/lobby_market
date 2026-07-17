'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart2,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  PulseResponse,
  CategoryVital,
  ThresholdMarket,
  HotMarket,
} from '@/app/api/exchange/pulse/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30_000 // 30s

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  very_bullish: { label: 'Very Bullish', color: 'text-gold', bg: 'bg-gold/10 border-gold/30' },
  bullish:      { label: 'Bullish',      color: 'text-for-400', bg: 'bg-for-500/10 border-for-500/30' },
  neutral:      { label: 'Neutral',      color: 'text-surface-600', bg: 'bg-surface-300/60 border-surface-400' },
  bearish:      { label: 'Bearish',      color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' },
  very_bearish: { label: 'Very Bearish', color: 'text-against-400', bg: 'bg-against-600/20 border-against-600/40' },
}

const HEALTH_CONFIG: Record<CategoryVital['health'], { label: string; bar: string; text: string }> = {
  strong:    { label: 'Strong',    bar: 'bg-gold',           text: 'text-gold' },
  moderate:  { label: 'Moderate',  bar: 'bg-for-500',        text: 'text-for-400' },
  contested: { label: 'Contested', bar: 'bg-purple',         text: 'text-purple' },
  resistant: { label: 'Resistant', bar: 'bg-against-500',    text: 'text-against-400' },
}

const DIRECTION_ICONS = {
  rising:  { Icon: TrendingUp,   color: 'text-emerald' },
  falling: { Icon: TrendingDown, color: 'text-against-400' },
  stable:  { Icon: Minus,        color: 'text-surface-500' },
}

const THRESHOLD_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  75: { label: 'Law',      color: 'text-gold',        bg: 'bg-gold/10 border-gold/30' },
  50: { label: 'Majority', color: 'text-for-400',     bg: 'bg-for-500/10 border-for-500/30' },
  25: { label: 'Dissent',  color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function PulseRing({ value, size = 120 }: { value: number; size?: number }) {
  // Circular gauge showing 0-100 value
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDash = (value / 100) * circumference

  const color =
    value >= 67 ? '#f59e0b'   // gold
    : value >= 55 ? '#60a5fa' // for-400
    : value <= 33 ? '#ef4444' // against-500
    : '#71717a'               // surface-500

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-surface-300"
      />
      {/* Fill */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - strokeDash }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  )
}

function VitalStat({
  label,
  value,
  sub,
  icon: Icon,
  highlight,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  highlight?: string
}) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-surface-200 border border-surface-300">
      <div className="flex items-center gap-1.5 text-surface-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn('text-xl font-mono font-bold', highlight ?? 'text-surface-900')}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-surface-500">{sub}</div>}
    </div>
  )
}

function CategoryBar({ vital }: { vital: CategoryVital }) {
  const { bar, text, label } = HEALTH_CONFIG[vital.health]
  const { Icon, color } = DIRECTION_ICONS[vital.direction]

  return (
    <Link
      href={`/exchange?category=${encodeURIComponent(vital.category)}`}
      className="group flex flex-col gap-1.5 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-700 group-hover:text-surface-900 transition-colors truncate">
          {vital.category}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Icon className={cn('h-3 w-3', color)} />
          <span className={cn('text-[10px] font-medium', text)}>{label}</span>
        </div>
      </div>

      {/* Bar */}
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', bar)}
          initial={{ width: 0 }}
          animate={{ width: `${vital.avg_price}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-surface-500">
          {vital.market_count} market{vital.market_count !== 1 ? 's' : ''}
        </span>
        <span className="text-[10px] font-mono text-surface-600">{vital.avg_price}¢</span>
      </div>
    </Link>
  )
}

function ThresholdCard({ market }: { market: ThresholdMarket }) {
  const cfg = THRESHOLD_CONFIG[market.threshold]
  const isApproaching = market.direction === 'approaching'

  return (
    <Link
      href={`/exchange/${market.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors group"
    >
      {/* Threshold badge */}
      <div className={cn('shrink-0 mt-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-bold font-mono', cfg.bg, cfg.color)}>
        {market.threshold}¢
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-700 group-hover:text-surface-900 transition-colors line-clamp-2 leading-relaxed">
          {market.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-surface-500">{market.label}</span>
          {market.category && (
            <span className="text-[10px] text-surface-400 bg-surface-300 px-1 rounded">
              {market.category}
            </span>
          )}
        </div>
      </div>

      {/* Direction indicator */}
      <div className="shrink-0 flex flex-col items-end gap-1">
        <div className={cn(
          'flex items-center gap-0.5 text-[10px] font-mono font-semibold',
          isApproaching ? cfg.color : 'text-surface-500',
        )}>
          {isApproaching
            ? <ArrowUp className="h-3 w-3" />
            : <ArrowDown className="h-3 w-3" />}
          {market.price}¢
        </div>
        <span className="text-[10px] text-surface-500">
          {formatVolume(market.volume)} vol
        </span>
      </div>
    </Link>
  )
}

function HotMarketRow({ market, rank }: { market: HotMarket; rank: number }) {
  const priceColor =
    market.price >= 67 ? 'text-gold'
    : market.price >= 55 ? 'text-for-400'
    : market.price <= 33 ? 'text-against-400'
    : 'text-surface-600'

  const hasDelta = market.delta_24h != null && Math.abs(market.delta_24h) >= 0.5

  return (
    <Link
      href={`/exchange/${market.id}`}
      className="flex items-center gap-3 py-2.5 border-b border-surface-300 last:border-0 hover:bg-surface-200/50 transition-colors group px-1 rounded-lg"
    >
      {/* Rank */}
      <span className="w-5 text-center text-[10px] font-mono text-surface-500 shrink-0">
        {rank}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-700 group-hover:text-surface-900 transition-colors line-clamp-1">
          {market.statement}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {market.category && (
            <span className="text-[10px] text-surface-400">{market.category}</span>
          )}
          {market.is_near_law && (
            <span className="text-[10px] text-gold flex items-center gap-0.5">
              <Gavel className="h-2.5 w-2.5" /> Near Law
            </span>
          )}
          {market.is_deadlocked && (
            <span className="text-[10px] text-purple flex items-center gap-0.5">
              <Scale className="h-2.5 w-2.5" /> Dead heat
            </span>
          )}
        </div>
      </div>

      {/* Price + Delta */}
      <div className="shrink-0 text-right">
        <div className={cn('text-sm font-mono font-bold', priceColor)}>
          {market.price}¢
        </div>
        {hasDelta && (
          <div className={cn(
            'text-[10px] font-mono flex items-center justify-end gap-0.5',
            (market.delta_24h ?? 0) >= 0 ? 'text-emerald' : 'text-against-400',
          )}>
            {(market.delta_24h ?? 0) >= 0
              ? <ArrowUp className="h-2.5 w-2.5" />
              : <ArrowDown className="h-2.5 w-2.5" />}
            {Math.abs(market.delta_24h ?? 0)}¢
          </div>
        )}
        {!hasDelta && (
          <div className="text-[10px] text-surface-400 font-mono">
            {formatVolume(market.volume)}
          </div>
        )}
      </div>

      <ChevronRight className="h-3 w-3 text-surface-400 shrink-0" />
    </Link>
  )
}

// ─── Pulse Heartbeat Animation ────────────────────────────────────────────────

function HeartbeatLine({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-px h-6">
      {Array.from({ length: 24 }).map((_, i) => {
        const isBeat = i === 8 || i === 10 || i === 12
        const height = isBeat
          ? i === 10 ? 24 : 14
          : 4 + Math.sin(i * 0.8) * 2
        return (
          <motion.div
            key={i}
            className={cn(
              'w-1 rounded-full shrink-0',
              isBeat ? 'bg-against-500' : 'bg-surface-400',
            )}
            style={{ height }}
            animate={active && isBeat ? {
              scaleY: [1, 1.4, 0.8, 1],
              opacity: [0.7, 1, 0.7, 0.7],
            } : {}}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.06,
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PulseClient() {
  const [data, setData] = useState<PulseResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPulse = useCallback(async () => {
    try {
      const res = await fetch('/api/exchange/pulse', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: PulseResponse = await res.json()
      setData(json)
      setLastRefresh(json.as_of)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPulse()
    intervalRef.current = setInterval(fetchPulse, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchPulse])

  const sentimentCfg = data
    ? SENTIMENT_CONFIG[data.vitals.sentiment] ?? SENTIMENT_CONFIG.neutral
    : SENTIMENT_CONFIG.neutral

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24 space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/exchange"
              className="text-surface-500 hover:text-surface-700 transition-colors"
              aria-label="Back to Exchange"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-surface-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-against-500" />
                Market Pulse
              </h1>
              <p className="text-[10px] text-surface-500">
                Live vital signs · auto-refreshes every 30s
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] text-surface-500 hidden sm:block">
                Updated {relTime(lastRefresh)}
              </span>
            )}
            <button
              onClick={fetchPulse}
              disabled={loading}
              className="p-1.5 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Skeleton ── */}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-2xl" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="text-center py-12 text-surface-500">
            <Activity className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Could not load pulse data.</p>
            <button
              onClick={fetchPulse}
              className="mt-3 text-xs text-for-400 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {data && !loading && (
            <motion.div
              key="pulse-content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* ── Overall Consensus Card ── */}
              <div className={cn(
                'relative overflow-hidden rounded-2xl border p-5',
                'bg-surface-100',
                sentimentCfg.bg,
              )}>
                <div className="flex items-center gap-5">
                  {/* Ring gauge */}
                  <div className="relative shrink-0">
                    <PulseRing value={data.vitals.overall_consensus} size={100} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center rotate-90">
                      <span className="text-lg font-mono font-bold text-surface-900 -rotate-90">
                        {data.vitals.overall_consensus}¢
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-xs font-semibold mb-1', sentimentCfg.color)}>
                      {sentimentCfg.label}
                    </div>
                    <h2 className="text-sm font-bold text-surface-900 mb-2">
                      Overall Civic Consensus
                    </h2>
                    <HeartbeatLine active />
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-surface-500">
                      <span>{data.vitals.breadth_pct}% advancing</span>
                      <span>·</span>
                      <span>{data.vitals.contested_markets} contested</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Vital Stats Grid ── */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <VitalStat
                  label="Active Markets"
                  value={data.vitals.active_markets.toLocaleString()}
                  icon={BarChart2}
                />
                <VitalStat
                  label="Total Volume"
                  value={formatVolume(data.vitals.total_volume)}
                  sub="votes cast"
                  icon={Zap}
                />
                <VitalStat
                  label="Laws Today"
                  value={data.vitals.laws_today}
                  icon={Gavel}
                  highlight={data.vitals.laws_today > 0 ? 'text-gold' : undefined}
                />
                <VitalStat
                  label="Near Law"
                  value={data.vitals.near_law_markets}
                  sub="≥67¢ consensus"
                  icon={Target}
                  highlight={data.vitals.near_law_markets > 0 ? 'text-for-400' : undefined}
                />
              </div>

              {/* ── Category Vitals ── */}
              {data.category_vitals.length > 0 && (
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-2.5">
                    Category Vitals
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {data.category_vitals.map(vital => (
                      <CategoryBar key={vital.category} vital={vital} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Threshold Watch ── */}
              {data.threshold_watch.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                      Threshold Watch
                    </h3>
                    <span className="text-[10px] text-surface-400">
                      Markets within 6¢ of a key level
                    </span>
                  </div>
                  <div className="space-y-2">
                    {data.threshold_watch.map(market => (
                      <ThresholdCard key={`${market.id}-${market.threshold}`} market={market} />
                    ))}
                  </div>
                  <Link
                    href="/exchange/crossings"
                    className="inline-flex items-center gap-1 mt-3 text-[11px] text-for-400 hover:text-for-300 transition-colors"
                  >
                    View all threshold crossings
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </section>
              )}

              {/* ── Hot Markets ── */}
              {data.hot_markets.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-against-400" />
                      Hot Markets
                    </h3>
                    <Link
                      href="/exchange?sort=momentum"
                      className="text-[10px] text-for-400 hover:text-for-300 transition-colors"
                    >
                      See all
                    </Link>
                  </div>
                  <div className="rounded-xl bg-surface-200 border border-surface-300 px-3 py-1">
                    {data.hot_markets.map((market, i) => (
                      <HotMarketRow key={market.id} market={market} rank={i + 1} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Quick Links ── */}
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-surface-500 mb-2.5">
                  Related Views
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: '/exchange/flow', label: 'Market Flow', icon: Activity, desc: 'Live direction' },
                    { href: '/exchange/movers', label: 'Top Movers', icon: TrendingUp, desc: '24h gainers & losers' },
                    { href: '/exchange/crossings', label: 'Crossings', icon: Target, desc: 'Threshold breaks' },
                    { href: '/exchange/sentiment', label: 'Sentiment', icon: Sparkles, desc: 'Market mood' },
                    { href: '/exchange/momentum', label: 'Momentum', icon: Zap, desc: 'Rising markets' },
                    { href: '/exchange/risk', label: 'Risk Radar', icon: Scale, desc: 'Portfolio risk' },
                    { href: '/exchange/volatility', label: 'Volatility', icon: BarChart2, desc: 'Price swings' },
                    { href: '/exchange/near-law', label: 'Near Law', icon: Gavel, desc: 'Approaching 75¢' },
                  ].map(({ href, label, icon: Icon, desc }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors group"
                    >
                      <Icon className="h-4 w-4 text-surface-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-surface-700 group-hover:text-surface-900 transition-colors">
                          {label}
                        </div>
                        <div className="text-[10px] text-surface-400">{desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* ── Arguments Today ── */}
              {data.vitals.total_arguments_today > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200 border border-surface-300">
                  <MessageSquare className="h-4 w-4 text-for-400 shrink-0" />
                  <div className="flex-1 text-xs text-surface-600">
                    <span className="font-semibold text-surface-800">
                      {data.vitals.total_arguments_today.toLocaleString()}
                    </span>{' '}
                    argument{data.vitals.total_arguments_today !== 1 ? 's' : ''} posted today
                  </div>
                  <Link
                    href="/top-arguments"
                    className="text-[10px] text-for-400 hover:text-for-300 shrink-0 transition-colors"
                  >
                    View top →
                  </Link>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
