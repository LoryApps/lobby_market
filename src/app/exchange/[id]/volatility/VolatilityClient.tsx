'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BarChart2,
  ChevronRight,
  Gavel,
  RefreshCw,
  Scale,
  TrendingUp,
  Wind,
  Zap,
  Minus,
  AlertTriangle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketVolatilityResponse, VolatilityPeriod } from '@/app/api/exchange/[id]/volatility/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const REFRESH_MS = 60_000

const VOL_CONFIG: Record<MarketVolatilityResponse['volatility_level'], {
  label: string; color: string; bg: string; border: string; icon: typeof Wind
}> = {
  very_low: { label: 'Very Low',  color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/25',    icon: Minus       },
  low:      { label: 'Low',       color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/25',    icon: Scale       },
  moderate: { label: 'Moderate',  color: 'text-surface-400',bg: 'bg-surface-300/30',border: 'border-surface-400/30',icon: Activity    },
  high:     { label: 'High',      color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30',       icon: Wind        },
  extreme:  { label: 'Extreme',   color: 'text-against-400',bg: 'bg-against-500/10',border: 'border-against-500/25',icon: AlertTriangle},
}

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  law:    Gavel,
  voting: Zap,
  active: TrendingUp,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function priceColor(p: number, status: string): string {
  if (status === 'law')    return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (p >= 67) return 'text-gold'
  if (p >= 55) return 'text-for-400'
  if (p <= 33) return 'text-against-400'
  if (p <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Score Arc ────────────────────────────────────────────────────────────────

function ScoreArc({ score, level }: { score: number; level: MarketVolatilityResponse['volatility_level'] }) {
  const cfg  = VOL_CONFIG[level]
  const r    = 44
  const circ = 2 * Math.PI * r
  const pct  = score / 100
  const dash = circ * pct

  const gradId = `vol-grad-${level}`

  return (
    <svg viewBox="0 0 110 110" className="w-32 h-32" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* Track */}
      <circle
        cx="55" cy="55" r={r}
        fill="none"
        stroke="#1e2535"
        strokeWidth="10"
      />
      {/* Arc */}
      <circle
        cx="55" cy="55" r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="10"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 55 55)"
        className={cfg.color}
      />
      {/* Score label */}
      <text x="55" y="50" textAnchor="middle" className="font-mono font-bold" fill="white" fontSize="18">
        {score}
      </text>
      <text x="55" y="64" textAnchor="middle" fill="#64748b" fontSize="8">
        VOL SCORE
      </text>
    </svg>
  )
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({ prices }: { prices: number[] }) {
  if (prices.length < 2) return <div className="h-10 flex items-center justify-center text-surface-600 text-[10px] font-mono">Insufficient data</div>

  const min  = Math.min(...prices)
  const max  = Math.max(...prices)
  const range = max - min || 1
  const w    = 200
  const h    = 40
  const pts  = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - min) / range) * (h - 4) - 2
    return `${x},${y}`
  })

  const last  = prices[prices.length - 1]
  const first = prices[0]
  const color = last > first ? '#22c55e' : last < first ? '#ef4444' : '#64748b'

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Current price dot */}
      <circle
        cx={(prices.length - 1) / (prices.length - 1) * w}
        cy={h - ((last - min) / range) * (h - 4) - 2}
        r="2"
        fill={color}
      />
    </svg>
  )
}

// ─── Period Card ─────────────────────────────────────────────────────────────

function PeriodCard({ period }: { period: VolatilityPeriod }) {
  const chopColor = period.choppiness > 60 ? 'text-against-400' : period.choppiness > 35 ? 'text-gold' : 'text-emerald'
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold text-white uppercase tracking-wider">{period.label}</span>
        <span className="text-[10px] font-mono text-surface-500">{period.snapshots} snapshots</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">Std Dev</p>
          <p className="text-sm font-mono font-bold text-white">{period.stddev}¢</p>
        </div>
        <div>
          <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">Range</p>
          <p className="text-sm font-mono font-bold text-white">{period.range}¢</p>
        </div>
        <div>
          <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">High</p>
          <p className="text-sm font-mono font-bold text-for-400">{period.high}¢</p>
        </div>
        <div>
          <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">Low</p>
          <p className="text-sm font-mono font-bold text-against-400">{period.low}¢</p>
        </div>
        <div>
          <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">Avg Move</p>
          <p className="text-sm font-mono font-bold text-white">{period.avg_daily_move}¢</p>
        </div>
        <div>
          <p className="text-[9px] font-mono text-surface-600 uppercase tracking-wider">Choppiness</p>
          <p className={cn('text-sm font-mono font-bold', chopColor)}>{period.choppiness}%</p>
        </div>
      </div>
    </div>
  )
}

// ─── Detailed price chart ─────────────────────────────────────────────────────

function PriceChart({ data }: { data: MarketVolatilityResponse['price_history'] }) {
  if (data.length < 2) {
    return (
      <div className="h-32 flex items-center justify-center text-surface-600 text-xs font-mono">
        Not enough price history for chart
      </div>
    )
  }
  const prices  = data.map(d => d.price)
  const vols    = data.map(d => d.daily_vol)
  const minP    = Math.min(...prices)
  const maxP    = Math.max(...prices)
  const rangeP  = maxP - minP || 1
  const maxV    = Math.max(...vols, 1)
  const w = 400
  const h = 80
  const volH = 24

  const pricePoints = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w
    const y = h - ((p - minP) / rangeP) * (h - 6) - 3
    return `${x},${y}`
  })

  const last  = prices[prices.length - 1]
  const first = prices[0]
  const lineColor = last > first ? '#22c55e' : last < first ? '#ef4444' : '#64748b'

  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none" aria-hidden="true">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1="0" y1={h - t * (h - 6) - 3}
            x2={w} y2={h - t * (h - 6) - 3}
            stroke="#1e2535"
            strokeWidth="0.5"
          />
        ))}
        {/* Price line */}
        <polyline
          points={pricePoints.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={(prices.length - 1) / (prices.length - 1) * w}
          cy={h - ((last - minP) / rangeP) * (h - 6) - 3}
          r="2.5"
          fill={lineColor}
        />
      </svg>
      {/* Volatility bars */}
      <svg viewBox={`0 0 ${w} ${volH}`} className="w-full h-6" preserveAspectRatio="none" aria-hidden="true">
        {vols.map((v, i) => {
          const x = (i / (vols.length - 1)) * w
          const barH = (v / maxV) * (volH - 2)
          const color = v > maxV * 0.6 ? '#ef4444' : v > maxV * 0.3 ? '#f59e0b' : '#22c55e'
          return (
            <rect
              key={i}
              x={x - 1}
              y={volH - barH}
              width="2"
              height={barH}
              fill={color}
              opacity="0.7"
            />
          )
        })}
      </svg>
      <div className="flex justify-between text-[9px] font-mono text-surface-600">
        <span>{data[0] ? relTime(data[0].date) : ''}</span>
        <span className="text-surface-500">Volatility bars</span>
        <span>Now</span>
      </div>
    </div>
  )
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-300 last:border-0">
      <span className="text-xs font-mono text-surface-500">{label}</span>
      <span className={cn('text-xs font-mono font-bold', color ?? 'text-white')}>{value}</span>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VolatilityClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<MarketVolatilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/exchange/${topicId}/volatility`)
      if (!res.ok) throw new Error('Failed to load volatility data')
      const json = await res.json() as MarketVolatilityResponse
      setData(json)
      setLastUpdated(new Date().toISOString())
      setError(null)
    } catch {
      setError('Could not load volatility data. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  const cfg = data ? VOL_CONFIG[data.volatility_level] : null
  const StatusIcon = data ? (STATUS_ICONS[data.status] ?? Scale) : Scale

  const trend = data && data.price_history.length >= 2
    ? data.price_history[data.price_history.length - 1].price - data.price_history[0].price
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={`/exchange/${topicId}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to market
          </Link>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] font-mono text-surface-600">
                Updated {relTime(lastUpdated)}
              </span>
            )}
            <button
              onClick={load}
              className="p-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-against-950/40 border border-against-800/40 text-xs font-mono text-against-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-36 w-full rounded-2xl" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        )}

        {/* Content */}
        {data && cfg && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Topic header */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={data.status === 'law' ? 'law' : data.status === 'voting' ? 'voting' : data.status === 'active' ? 'active' : 'default'}
                    className="inline-flex items-center gap-1 text-[11px]"
                  >
                    <StatusIcon className="h-3 w-3" />
                    {data.status.charAt(0).toUpperCase() + data.status.slice(1)}
                  </Badge>
                  {data.category && (
                    <span className="text-[11px] font-mono text-surface-500 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300">
                      {data.category}
                    </span>
                  )}
                  <span className={cn('text-[11px] font-mono px-2 py-0.5 rounded-full border', cfg.bg, cfg.border, cfg.color)}>
                    {cfg.label} Volatility
                  </span>
                </div>
                <h1 className="text-base font-mono font-bold text-white leading-snug line-clamp-2">
                  {data.statement}
                </h1>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className={priceColor(data.price, data.status)}>
                    {data.price}¢ current
                  </span>
                  <span className="text-surface-600">·</span>
                  <span className="text-surface-500">{data.volume.toLocaleString()} votes</span>
                  {trend !== 0 && (
                    <>
                      <span className="text-surface-600">·</span>
                      <span className={trend > 0 ? 'text-for-400' : 'text-against-400'}>
                        {trend > 0 ? '+' : ''}{Math.round(trend)}¢ all-time
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Volatility score hero */}
              <div className={cn('rounded-2xl border p-5 flex items-center gap-6', cfg.bg, cfg.border)}>
                <ScoreArc score={data.volatility_score} level={data.volatility_level} />
                <div className="flex-1 space-y-2">
                  <p className={cn('text-lg font-mono font-bold', cfg.color)}>{data.volatility_label}</p>
                  <p className="text-xs font-mono text-surface-400 leading-relaxed">
                    Overall standard deviation of <strong className="text-white">{data.overall_stddev}¢</strong> across{' '}
                    <strong className="text-white">{data.snapshot_count}</strong> price snapshots.{' '}
                    Price has ranged from <strong className="text-against-400">{data.overall_low}¢</strong> to{' '}
                    <strong className="text-for-400">{data.overall_high}¢</strong>{' '}
                    (a <strong className="text-white">{data.overall_range}¢</strong> spread).
                  </p>
                  {data.category_percentile !== null && (
                    <p className="text-[11px] font-mono text-surface-500">
                      More volatile than{' '}
                      <span className={cfg.color}>{data.category_percentile}%</span>{' '}
                      of {data.category} markets
                    </p>
                  )}
                </div>
              </div>

              {/* Period cards */}
              <div>
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">By Timeframe</p>
                <div className="grid grid-cols-3 gap-3">
                  {data.periods.map((period) => (
                    <PeriodCard key={period.label} period={period} />
                  ))}
                </div>
              </div>

              {/* Price chart */}
              {data.price_history.length >= 2 && (
                <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="h-4 w-4 text-surface-500" />
                      <span className="text-xs font-mono font-bold text-white">Price + Volatility History</span>
                    </div>
                    <span className="text-[10px] font-mono text-surface-600">{data.price_history.length} points</span>
                  </div>
                  <Sparkline prices={data.price_history.map(d => d.price)} />
                  <div className="mt-2 border-t border-surface-300 pt-2">
                    <PriceChart data={data.price_history} />
                  </div>
                </div>
              )}

              {/* Key metrics */}
              <div className="rounded-xl border border-surface-300 bg-surface-200 p-4">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">Key Metrics</p>
                <StatRow label="Max Drawdown" value={`${data.max_drawdown}¢`} color="text-against-400" />
                <StatRow label="Max Rally"    value={`${data.max_rally}¢`}    color="text-for-400"     />
                <StatRow label="Reversal Count" value={data.reversal_count.toString()} />
                <StatRow
                  label="Choppiness Score"
                  value={`${data.choppiness_score}%`}
                  color={data.choppiness_score > 60 ? 'text-against-400' : data.choppiness_score > 35 ? 'text-gold' : 'text-emerald'}
                />
                <StatRow
                  label="Trend Consistency"
                  value={`${data.trend_consistency}%`}
                  color={data.trend_consistency > 65 ? 'text-for-400' : 'text-surface-400'}
                />
                {data.category_avg_stddev !== null && (
                  <StatRow
                    label={`${data.category ?? 'Category'} Avg Std Dev`}
                    value={`${data.category_avg_stddev}¢`}
                    color={data.overall_stddev > data.category_avg_stddev ? 'text-against-400' : 'text-emerald'}
                  />
                )}
              </div>

              {/* Interpretation guide */}
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">What This Means</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-surface-500">
                  <div className="space-y-1">
                    <p className="text-white font-bold">Std Dev</p>
                    <p>Typical price swing per period. Higher = more unpredictable.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white font-bold">Choppiness</p>
                    <p>How often price reverses. High choppiness = no clear trend.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white font-bold">Max Drawdown</p>
                    <p>Largest peak-to-trough decline. Measures worst-case loss.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white font-bold">Trend Consistency</p>
                    <p>% of price moves in same direction. High = clean trend.</p>
                  </div>
                </div>
              </div>

              {/* Related links */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/exchange/${topicId}/risk`,     label: 'Risk Analysis',  icon: AlertTriangle },
                  { href: `/exchange/${topicId}/signal`,   label: 'Market Signal',  icon: Zap           },
                  { href: `/exchange/${topicId}/momentum`, label: 'Momentum',       icon: TrendingUp    },
                  { href: `/exchange/${topicId}/chart`,    label: 'Price Chart',    icon: BarChart2     },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-surface-500" />
                      <span className="text-xs font-mono text-surface-400">{label}</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
                  </Link>
                ))}
              </div>

              {/* Back to market */}
              <div className="pt-2 flex items-center gap-3">
                <Link
                  href={`/exchange/${topicId}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to market
                </Link>
                <Link
                  href="/exchange/volatility"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Wind className="h-3.5 w-3.5" />
                  Platform volatility
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>

            </motion.div>
          </AnimatePresence>
        )}

        {/* Empty when no data and no error */}
        {!loading && !error && !data && (
          <EmptyState
            icon={Wind}
            title="No volatility data"
            description="This market has insufficient price history to calculate volatility metrics."
            action={{ label: 'Go to market', href: `/exchange/${topicId}` }}
          />
        )}

      </main>
      <BottomNav />
    </div>
  )
}
