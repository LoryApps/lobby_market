'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  Brain,
  Flame,
  Gauge,
  RefreshCw,
  Scale,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  SentimentResponse,
  SectorSentiment,
  SentimentMover,
  SentimentBand,
} from '@/app/api/exchange/sentiment/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function catStyle(cat: string | null) {
  return cat && CATEGORY_COLORS[cat]
    ? CATEGORY_COLORS[cat]
    : { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function formatVol(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// ─── Gauge Arc ────────────────────────────────────────────────────────────────

function SentimentGauge({ score }: { score: number }) {
  // Half-circle gauge: 0 = left (bearish), 100 = right (bullish)
  const radius = 80
  const strokeWidth = 14
  const cx = 110
  const cy = 110

  // Arc path from 180° to 0° (left to right over top)
  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    }
  }

  const bgArcStart = polarToXY(180, radius)
  const bgArcEnd = polarToXY(0, radius)
  const bgArc = `M ${bgArcStart.x} ${bgArcStart.y} A ${radius} ${radius} 0 0 1 ${bgArcEnd.x} ${bgArcEnd.y}`

  // Needle: maps score 0→180° to 0° (left=bearish) to 0° (right=bullish)
  const needleAngleDeg = 180 - (score / 100) * 180
  const needleLen = radius - 10
  const needleTip = polarToXY(needleAngleDeg, needleLen)

  // Color based on score
  const color =
    score >= 65 ? '#22c55e' :
    score >= 55 ? '#4ade80' :
    score <= 35 ? '#f87171' :
    score <= 45 ? '#fca5a5' :
    '#6b7280'

  const label =
    score >= 65 ? 'Very Bullish' :
    score >= 55 ? 'Bullish' :
    score <= 35 ? 'Very Bearish' :
    score <= 45 ? 'Bearish' :
    'Neutral'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={220} height={120} viewBox={`0 0 220 120`} className="overflow-visible">
        {/* Track gradient segments */}
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.8" />
            <stop offset="25%" stopColor="#fca5a5" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#6b7280" stopOpacity="0.5" />
            <stop offset="75%" stopColor="#4ade80" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8" />
          </linearGradient>
        </defs>
        {/* Background arc */}
        <path
          d={bgArc}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          opacity={0.25}
        />
        {/* Filled arc to score */}
        {(() => {
          const fillEnd = polarToXY(needleAngleDeg, radius)
          const largeArc = score > 50 ? 1 : 0
          const filledArc = `M ${bgArcStart.x} ${bgArcStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEnd.x} ${fillEnd.y}`
          return (
            <path
              d={filledArc}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              opacity={0.7}
            />
          )
        })()}
        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={6} fill={color} />
        <circle cx={cx} cy={cy} r={3} fill="white" opacity={0.8} />
        {/* Labels */}
        <text x={30} y={115} fill="#f87171" fontSize={10} textAnchor="middle" opacity={0.7}>BEAR</text>
        <text x={190} y={115} fill="#4ade80" fontSize={10} textAnchor="middle" opacity={0.7}>BULL</text>
      </svg>
      <div className="text-center">
        <div className="text-4xl font-bold tabular-nums" style={{ color }}>{Math.round(score)}</div>
        <div className="text-sm font-medium mt-0.5" style={{ color }}>{label}</div>
        <div className="text-xs text-surface-500 mt-0.5">Civic Sentiment Score</div>
      </div>
    </div>
  )
}

// ─── Sector Bar ───────────────────────────────────────────────────────────────

function SectorRow({ sector }: { sector: SectorSentiment }) {
  const style = catStyle(sector.category)
  const sentColor =
    sector.sentiment === 'bullish' ? 'text-emerald' :
    sector.sentiment === 'bearish' ? 'text-against-400' :
    'text-surface-400'

  const barWidth = sector.avg_price
  const barColor =
    sector.avg_price >= 60 ? 'bg-emerald' :
    sector.avg_price >= 50 ? 'bg-for-400' :
    sector.avg_price >= 40 ? 'bg-against-300' :
    'bg-against-500'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-1.5 py-3 border-b border-surface-200/30 last:border-0"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded border', style.text, style.bg, style.border)}>
            {sector.category}
          </span>
          <span className="text-xs text-surface-500">{sector.market_count} markets</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sector.delta_24h !== null && (
            <span className={cn('text-xs font-mono', sector.delta_24h >= 0 ? 'text-emerald' : 'text-against-400')}>
              {sector.delta_24h >= 0 ? '+' : ''}{sector.delta_24h.toFixed(1)}¢
            </span>
          )}
          <span className={cn('text-sm font-bold tabular-nums', sentColor)}>
            {sector.avg_price.toFixed(1)}¢
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-surface-200/40 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${barWidth}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={cn('h-full rounded-full', barColor)}
          />
        </div>
        <div className="flex gap-2 text-xs text-surface-500 shrink-0">
          <span className="text-emerald">{sector.bullish_count}↑</span>
          <span className="text-surface-500">{sector.neutral_count}=</span>
          <span className="text-against-400">{sector.bearish_count}↓</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Mover Card ───────────────────────────────────────────────────────────────

function MoverCard({ mover }: { mover: SentimentMover }) {
  const isUp = mover.direction === 'up'
  const style = catStyle(mover.category)

  return (
    <Link href={`/exchange/${mover.id}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        className="flex items-start gap-3 p-3 rounded-xl border border-surface-200/30 bg-surface-100/20 hover:bg-surface-100/40 transition-colors"
      >
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          isUp ? 'bg-emerald/15' : 'bg-against-500/15',
        )}>
          {isUp
            ? <ArrowUpRight className="w-4 h-4 text-emerald" />
            : <ArrowDownRight className="w-4 h-4 text-against-400" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-surface-800 line-clamp-2 leading-tight">{mover.statement}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {mover.category && (
              <span className={cn('text-xs font-medium', style.text)}>{mover.category}</span>
            )}
            <span className="text-xs text-surface-500">{formatVol(mover.volume)} votes</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={cn('text-sm font-bold tabular-nums', isUp ? 'text-emerald' : 'text-against-400')}>
            {isUp ? '+' : ''}{mover.delta_24h.toFixed(1)}¢
          </div>
          <div className="text-xs text-surface-500 mt-0.5">{mover.price.toFixed(0)}¢</div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Band Row ─────────────────────────────────────────────────────────────────

function BandRow({ band }: { band: SentimentBand }) {
  const isFor = band.label.includes('FOR')
  const isAgainst = band.label.includes('AGAINST')

  const barColor = isFor
    ? band.label.includes('Extreme') ? 'bg-emerald' : band.label.includes('Strong') ? 'bg-for-400' : 'bg-for-300'
    : isAgainst
    ? band.label.includes('Extreme') ? 'bg-against-500' : band.label.includes('Strong') ? 'bg-against-400' : 'bg-against-300'
    : 'bg-surface-400'

  const textColor = isFor
    ? band.label.includes('Extreme') ? 'text-emerald' : 'text-for-400'
    : isAgainst
    ? band.label.includes('Extreme') ? 'text-against-400' : 'text-against-300'
    : 'text-surface-400'

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-[130px] shrink-0">
        <div className={cn('text-xs font-medium', textColor)}>{band.label}</div>
        <div className="text-[10px] text-surface-500 font-mono">{band.range}</div>
      </div>
      <div className="flex-1 h-2 bg-surface-200/30 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${band.pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', barColor)}
        />
      </div>
      <div className="w-16 text-right shrink-0">
        <span className="text-xs font-mono text-surface-600">{band.count}</span>
        <span className="text-xs text-surface-500 ml-1">({band.pct.toFixed(0)}%)</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SentimentClient() {
  const [data, setData] = useState<SentimentResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'sectors' | 'movers' | 'bands'>('sectors')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      const res = await fetch('/api/exchange/sentiment')
      if (res.ok) {
        const json: SentimentResponse = await res.json()
        setData(json)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), 90_000)
    return () => clearInterval(id)
  }, [load])

  const sentimentMeta = data
    ? {
        very_bullish: { label: 'Very Bullish', color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30', Icon: Flame },
        bullish:      { label: 'Bullish',       color: 'text-for-400', bg: 'bg-for-500/10 border-for-500/30', Icon: TrendingUp },
        neutral:      { label: 'Neutral',        color: 'text-surface-400', bg: 'bg-surface-300/40 border-surface-400/30', Icon: Scale },
        bearish:      { label: 'Bearish',        color: 'text-against-300', bg: 'bg-against-500/10 border-against-500/30', Icon: TrendingDown },
        very_bearish: { label: 'Very Bearish',   color: 'text-against-400', bg: 'bg-against-500/15 border-against-500/30', Icon: TrendingDown },
      }[data.overall_sentiment]
    : null

  return (
    <div className="min-h-screen bg-surface-50 text-surface-900">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/exchange"
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-100/60 hover:bg-surface-200/60 border border-surface-200/40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-surface-500" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-surface-900 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-purple" />
                Sentiment Gauge
              </h1>
              {data && (
                <p className="text-xs text-surface-500">
                  {data.breadth.total_markets.toLocaleString()} markets · updated {relTime(data.as_of)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-100/60 hover:bg-surface-200/60 border border-surface-200/40 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-4 h-4 text-surface-500', refreshing && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-52 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : !data ? (
          <EmptyState
            icon={<Gauge className="w-10 h-10 text-surface-400" />}
            title="Sentiment unavailable"
            description="Could not load market sentiment data. Try again in a moment."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {/* Overall sentiment card */}
              <div className="rounded-2xl border border-surface-200/40 bg-surface-100/30 backdrop-blur-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                        Overall Market Sentiment
                      </div>
                      {sentimentMeta && (
                        <div className={cn(
                          'mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-lg border',
                          sentimentMeta.bg, sentimentMeta.color,
                        )}>
                          <sentimentMeta.Icon className="w-3.5 h-3.5" />
                          {sentimentMeta.label}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-surface-500">A/D Ratio</div>
                      <div className={cn(
                        'text-lg font-bold tabular-nums mt-0.5',
                        data.breadth.advance_decline_ratio >= 1 ? 'text-emerald' : 'text-against-400',
                      )}>
                        {data.breadth.advance_decline_ratio.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Gauge */}
                  <div className="flex justify-center mb-4">
                    <SentimentGauge score={data.overall_score} />
                  </div>

                  {/* Breadth pills */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-emerald/10 border border-emerald/20 p-2.5 text-center">
                      <div className="text-xl font-bold text-emerald">{data.breadth.bullish_pct.toFixed(0)}%</div>
                      <div className="text-xs text-emerald/70 mt-0.5">Bullish</div>
                      <div className="text-[10px] text-surface-500 mt-0.5">
                        {Math.round(data.breadth.total_markets * data.breadth.bullish_pct / 100)} markets
                      </div>
                    </div>
                    <div className="rounded-xl bg-surface-200/40 border border-surface-300/30 p-2.5 text-center">
                      <div className="text-xl font-bold text-surface-500">{data.breadth.neutral_pct.toFixed(0)}%</div>
                      <div className="text-xs text-surface-500/70 mt-0.5">Neutral</div>
                      <div className="text-[10px] text-surface-500 mt-0.5">
                        {Math.round(data.breadth.total_markets * data.breadth.neutral_pct / 100)} markets
                      </div>
                    </div>
                    <div className="rounded-xl bg-against-500/10 border border-against-500/20 p-2.5 text-center">
                      <div className="text-xl font-bold text-against-400">{data.breadth.bearish_pct.toFixed(0)}%</div>
                      <div className="text-xs text-against-400/70 mt-0.5">Bearish</div>
                      <div className="text-[10px] text-surface-500 mt-0.5">
                        {Math.round(data.breadth.total_markets * data.breadth.bearish_pct / 100)} markets
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Extreme readings */}
              {(data.extreme_consensus.length > 0 || data.deeply_contested.length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  {data.extreme_consensus.length > 0 && (
                    <div className="rounded-2xl border border-emerald/25 bg-emerald/5 p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Zap className="w-3.5 h-3.5 text-emerald" />
                        <span className="text-xs font-semibold text-emerald">High Consensus</span>
                      </div>
                      <div className="space-y-2">
                        {data.extreme_consensus.slice(0, 3).map((m) => (
                          <Link key={m.id} href={`/exchange/${m.id}`}>
                            <div className="text-xs text-surface-700 line-clamp-2 hover:text-surface-900 transition-colors leading-relaxed">
                              {m.statement}
                            </div>
                            <div className="text-[10px] text-emerald font-mono mt-0.5">{m.price.toFixed(0)}¢</div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {data.deeply_contested.length > 0 && (
                    <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Scale className="w-3.5 h-3.5 text-gold" />
                        <span className="text-xs font-semibold text-gold">Most Contested</span>
                      </div>
                      <div className="space-y-2">
                        {data.deeply_contested.slice(0, 3).map((m) => (
                          <Link key={m.id} href={`/exchange/${m.id}`}>
                            <div className="text-xs text-surface-700 line-clamp-2 hover:text-surface-900 transition-colors leading-relaxed">
                              {m.statement}
                            </div>
                            <div className="text-[10px] text-gold font-mono mt-0.5">~{m.price.toFixed(0)}¢</div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 p-1 rounded-xl bg-surface-100/50 border border-surface-200/30">
                {(
                  [
                    { id: 'sectors', label: 'Sectors', icon: BarChart2 },
                    { id: 'movers', label: 'Movers', icon: Activity },
                    { id: 'bands', label: 'Distribution', icon: Thermometer },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                      tab === id
                        ? 'bg-surface-50 text-surface-900 shadow-sm border border-surface-200/50'
                        : 'text-surface-500 hover:text-surface-700',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* Sectors tab */}
                {tab === 'sectors' && (
                  <motion.div
                    key="sectors"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-2xl border border-surface-200/40 bg-surface-100/30 p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="w-4 h-4 text-purple" />
                      <span className="text-sm font-semibold text-surface-800">Sector Sentiment</span>
                      <span className="ml-auto text-xs text-surface-500">{data.sectors.length} sectors</span>
                    </div>
                    {data.sectors.length === 0 ? (
                      <p className="text-sm text-surface-500 text-center py-4">
                        No sector data available yet.
                      </p>
                    ) : (
                      <div>
                        {data.sectors.map((s) => (
                          <SectorRow key={s.category} sector={s} />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Movers tab */}
                {tab === 'movers' && (
                  <motion.div
                    key="movers"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="space-y-3"
                  >
                    {data.top_movers_up.length > 0 && (
                      <div className="rounded-2xl border border-surface-200/40 bg-surface-100/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="w-4 h-4 text-emerald" />
                          <span className="text-sm font-semibold text-surface-800">Rising Today</span>
                        </div>
                        <div className="space-y-2">
                          {data.top_movers_up.map((m) => (
                            <MoverCard key={m.id} mover={m} />
                          ))}
                        </div>
                      </div>
                    )}
                    {data.top_movers_down.length > 0 && (
                      <div className="rounded-2xl border border-surface-200/40 bg-surface-100/30 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingDown className="w-4 h-4 text-against-400" />
                          <span className="text-sm font-semibold text-surface-800">Falling Today</span>
                        </div>
                        <div className="space-y-2">
                          {data.top_movers_down.map((m) => (
                            <MoverCard key={m.id} mover={m} />
                          ))}
                        </div>
                      </div>
                    )}
                    {data.top_movers_up.length === 0 && data.top_movers_down.length === 0 && (
                      <div className="rounded-2xl border border-surface-200/40 bg-surface-100/30 p-8 text-center">
                        <Activity className="w-8 h-8 text-surface-400 mx-auto mb-2" />
                        <p className="text-sm text-surface-500">No significant movers in the last 24 hours.</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Distribution tab */}
                {tab === 'bands' && (
                  <motion.div
                    key="bands"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-2xl border border-surface-200/40 bg-surface-100/30 p-4"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Thermometer className="w-4 h-4 text-gold" />
                      <span className="text-sm font-semibold text-surface-800">Sentiment Distribution</span>
                      <span className="ml-auto text-xs text-surface-500">{data.breadth.total_markets} markets</span>
                    </div>
                    <div>
                      {data.bands.map((band) => (
                        <BandRow key={band.label} band={band} />
                      ))}
                    </div>
                    {/* Sample markets from top populated band */}
                    {(() => {
                      const top = [...data.bands].sort((a, b) => b.count - a.count)[0]
                      return top && top.markets.length > 0 ? (
                        <div className="mt-4 pt-4 border-t border-surface-200/30">
                          <p className="text-xs text-surface-500 mb-2">
                            Sample from <span className="font-medium text-surface-700">{top.label}</span>
                          </p>
                          <div className="space-y-1.5">
                            {top.markets.map((m) => (
                              <Link
                                key={m.id}
                                href={`/exchange/${m.id}`}
                                className="flex items-center gap-2 text-xs text-surface-700 hover:text-surface-900 transition-colors"
                              >
                                <span className="font-mono text-[10px] text-surface-500 w-8 text-right shrink-0">
                                  {m.price.toFixed(0)}¢
                                </span>
                                <span className="line-clamp-1">{m.statement}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : null
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer link */}
              <div className="flex gap-2 pt-1">
                <Link
                  href="/exchange"
                  className="flex-1 py-3 rounded-xl border border-surface-200/40 bg-surface-100/30 hover:bg-surface-100/60 transition-colors text-xs font-medium text-surface-600 text-center"
                >
                  ← All Markets
                </Link>
                <Link
                  href="/exchange/signals"
                  className="flex-1 py-3 rounded-xl border border-purple/30 bg-purple/5 hover:bg-purple/10 transition-colors text-xs font-medium text-purple text-center"
                >
                  Market Signals →
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
