'use client'

/**
 * /exchange/[id]/sentiment — Market Sentiment Analysis
 *
 * Analyses community sentiment for a specific civic prediction market across
 * four dimensions:
 *   1. Price-implied sentiment (the market price itself)
 *   2. Role-based voting breakdown (Elders vs. Citizens vs. Debators)
 *   3. Argument momentum (which side generates more engagement)
 *   4. Commentary direction (explicit FOR/AGAINST/NEUTRAL declarations)
 *
 * Distinct from:
 *   /signal      — multi-factor technical signals
 *   /momentum    — pure price momentum analysis
 *   /analysis    — statistical deep-dive
 *   /consensus   — aggregated forecaster consensus
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  ChevronRight,
  Flame,
  Gauge,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  Crown,
  Star,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  MarketSentimentData,
  SentimentLabel,
  RoleSentiment,
  ArgumentMomentum,
} from '@/app/api/exchange/[id]/sentiment/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 90_000

const SENTIMENT_CONFIG: Record<
  SentimentLabel,
  { label: string; color: string; bg: string; border: string; barColor: string }
> = {
  very_bullish:  { label: 'Very Bullish',  color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     barColor: 'bg-emerald' },
  bullish:       { label: 'Bullish',       color: 'text-for-300',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     barColor: 'bg-for-500' },
  lean_bullish:  { label: 'Lean Bullish',  color: 'text-for-400',     bg: 'bg-for-600/10',     border: 'border-for-600/30',     barColor: 'bg-for-600' },
  neutral:       { label: 'Neutral',       color: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30', barColor: 'bg-surface-500' },
  lean_bearish:  { label: 'Lean Bearish',  color: 'text-against-300', bg: 'bg-against-600/10', border: 'border-against-600/30', barColor: 'bg-against-600' },
  bearish:       { label: 'Bearish',       color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', barColor: 'bg-against-500' },
  very_bearish:  { label: 'Very Bearish',  color: 'text-against-400', bg: 'bg-against-600/15', border: 'border-against-600/40', barColor: 'bg-against-600' },
}

const ROLE_ICONS: Record<string, typeof Crown> = {
  elder:         Crown,
  debator:       Zap,
  troll_catcher: Shield,
  person:        Users,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sentiment Gauge (SVG half-circle) ───────────────────────────────────────

function SentimentGauge({ score }: { score: number }) {
  const radius = 72
  const strokeWidth = 12
  const cx = 100
  const cy = 100

  function polarToXY(angleDeg: number, r: number) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const bgArcStart = polarToXY(180, radius)
  const bgArcEnd = polarToXY(0, radius)
  const bgArc = `M ${bgArcStart.x} ${bgArcStart.y} A ${radius} ${radius} 0 0 1 ${bgArcEnd.x} ${bgArcEnd.y}`

  const needleAngle = 180 - (score / 100) * 180
  const needleLen = radius - 8
  const needleTip = polarToXY(needleAngle, needleLen)
  const needleBase1 = polarToXY(needleAngle + 90, 6)
  const needleBase2 = polarToXY(needleAngle - 90, 6)

  const gradColor =
    score >= 65 ? '#22c55e' :
    score >= 54 ? '#3b82f6' :
    score <= 35 ? '#ef4444' :
    score <= 46 ? '#f97316' :
    '#6b7280'

  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-[200px]" aria-hidden="true">
      {/* Track */}
      <path d={bgArc} fill="none" stroke="#1e293b" strokeWidth={strokeWidth} strokeLinecap="round" />
      {/* Colored arc */}
      <path
        d={bgArc}
        fill="none"
        stroke={gradColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * Math.PI * radius} ${Math.PI * radius}`}
        strokeDashoffset={0}
        style={{ transformOrigin: `${cx}px ${cy}px`, transform: 'rotate(180deg)' }}
      />
      {/* Needle */}
      <polygon
        points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
        fill={gradColor}
        opacity={0.9}
      />
      <circle cx={cx} cy={cy} r={5} fill={gradColor} />
      {/* Labels */}
      <text x="28" y="105" fontSize="9" fill="#64748b" textAnchor="middle">Against</text>
      <text x="172" y="105" fontSize="9" fill="#64748b" textAnchor="middle">For</text>
    </svg>
  )
}

// ─── Mini history spark-line ──────────────────────────────────────────────────

function SparkLine({ ticks }: { ticks: { date: string; price: number }[] }) {
  if (ticks.length < 2) return null

  const W = 300
  const H = 60
  const pad = 4

  const prices = ticks.map((t) => t.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  function px(i: number) {
    return pad + (i / (ticks.length - 1)) * (W - pad * 2)
  }
  function py(p: number) {
    return H - pad - ((p - minP) / range) * (H - pad * 2)
  }

  const pathD = ticks
    .map((t, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${py(t.price).toFixed(1)}`)
    .join(' ')

  const lastPrice = prices[prices.length - 1]
  const firstPrice = prices[0]
  const isUp = lastPrice >= firstPrice
  const lineColor = isUp ? '#22c55e' : '#ef4444'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none" aria-hidden="true">
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Current price dot */}
      <circle
        cx={px(ticks.length - 1)}
        cy={py(lastPrice)}
        r={3}
        fill={lineColor}
      />
    </svg>
  )
}

// ─── Role sentiment row ───────────────────────────────────────────────────────

function RoleRow({ item }: { item: RoleSentiment }) {
  const Icon = ROLE_ICONS[item.role] ?? Users
  const cfg = SENTIMENT_CONFIG[item.sentiment]

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300/30 last:border-0">
      <div className={cn('p-1.5 rounded-lg', cfg.bg, cfg.border, 'border')}>
        <Icon className={cn('h-3.5 w-3.5', cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-surface-200">{item.label}</span>
          <span className={cn('text-xs font-mono font-semibold', cfg.color)}>
            {item.for_pct}% FOR
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', item.for_pct >= 50 ? 'bg-for-500' : 'bg-against-500')}
            initial={{ width: 0 }}
            animate={{ width: `${item.for_pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
        <div className="flex items-center gap-3 mt-1 text-[10px] text-surface-500 font-mono">
          <span>{item.for_count} FOR</span>
          <span>{item.against_count} AGAINST</span>
          <span className="ml-auto">{item.total} total</span>
        </div>
      </div>
    </div>
  )
}

// ─── Argument momentum card ───────────────────────────────────────────────────

function ArgMomentumCard({ m, isEdge }: { m: ArgumentMomentum; isEdge: boolean }) {
  const isFor = m.side === 'for'

  return (
    <div
      className={cn(
        'rounded-xl border p-4 space-y-3 transition-all',
        isEdge
          ? isFor
            ? 'bg-for-500/10 border-for-500/30'
            : 'bg-against-500/10 border-against-500/30'
          : 'bg-surface-200/40 border-surface-300/40',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFor ? (
            <ThumbsUp className={cn('h-4 w-4', isEdge ? 'text-for-400' : 'text-surface-400')} />
          ) : (
            <ThumbsDown className={cn('h-4 w-4', isEdge ? 'text-against-400' : 'text-surface-400')} />
          )}
          <span className={cn('text-sm font-semibold', isFor ? 'text-for-300' : 'text-against-300')}>
            {isFor ? 'FOR Arguments' : 'AGAINST Arguments'}
          </span>
          {isEdge && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-surface-400 text-surface-300">
              Leading
            </Badge>
          )}
        </div>
        <span className="text-sm font-mono font-bold text-surface-200">
          {m.share_of_engagement}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Arguments', value: m.count },
          { label: 'Upvotes', value: m.total_upvotes },
          { label: 'Avg ↑', value: m.avg_upvotes.toFixed(1) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-surface-300/30 p-2">
            <p className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</p>
            <p className="text-sm font-mono font-bold text-surface-100">{value}</p>
          </div>
        ))}
      </div>

      {m.top_argument && (
        <blockquote className="text-xs text-surface-400 italic border-l-2 border-surface-400/40 pl-3 leading-relaxed">
          &ldquo;{m.top_argument}{m.top_argument.length >= 120 ? '…' : ''}&rdquo;
          <span className="not-italic text-surface-500 ml-1">· {m.top_upvotes} upvotes</span>
        </blockquote>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SentimentClient() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<MarketSentimentData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/exchange/${id}/sentiment`, { cache: 'no-store' })
        if (!res.ok) throw new Error('fetch failed')
        const json = (await res.json()) as MarketSentimentData
        setData(json)
        setLastRefresh(json.as_of)
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    load()
    const timer = setInterval(() => load(true), REFRESH_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  const sentCfg = data ? SENTIMENT_CONFIG[data.sentiment_label] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-5 pb-28 space-y-5">
        {/* Back navigation */}
        <div className="flex items-center gap-3">
          <Link
            href={data ? `/exchange/${id}` : '/exchange'}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {data ? 'Market' : 'Exchange'}
          </Link>
          {data && (
            <ChevronRight className="h-3 w-3 text-surface-600" />
          )}
          {data && (
            <span className="text-sm text-surface-400 truncate max-w-[200px]">
              {data.statement.slice(0, 50)}{data.statement.length > 50 ? '…' : ''}
            </span>
          )}
        </div>

        {loading && !data ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Gauge className="h-10 w-10 text-surface-600 mb-3" />
            <p className="text-surface-400 text-sm">Unable to load sentiment data</p>
            <button
              onClick={() => load()}
              className="mt-4 flex items-center gap-2 text-sm text-for-400 hover:text-for-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div className={cn('rounded-2xl border p-5 space-y-4', sentCfg?.bg, sentCfg?.border)}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Gauge className={cn('h-4 w-4', sentCfg?.color)} />
                    <span className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                      Market Sentiment
                    </span>
                  </div>
                  <p className="text-sm text-surface-300 leading-snug line-clamp-2">
                    {data.statement}
                  </p>
                </div>
                <button
                  onClick={() => load(true)}
                  className="p-1.5 rounded-lg hover:bg-surface-300/30 text-surface-500 hover:text-surface-300 transition-colors flex-shrink-0"
                  aria-label="Refresh sentiment"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-end gap-5">
                <div className="flex-1">
                  <SentimentGauge score={data.sentiment_score} />
                </div>
                <div className="space-y-1 text-right pb-2">
                  <p className={cn('text-2xl font-mono font-bold', sentCfg?.color)}>
                    {data.sentiment_score.toFixed(0)}¢
                  </p>
                  <p className={cn('text-sm font-semibold', sentCfg?.color)}>
                    {sentCfg?.label}
                  </p>
                  <p className="text-xs text-surface-500 capitalize">
                    {data.sentiment_strength} signal
                  </p>
                  {data.delta_24h !== null && (
                    <div
                      className={cn(
                        'flex items-center gap-1 text-xs font-mono justify-end',
                        data.delta_24h > 0 ? 'text-emerald' : data.delta_24h < 0 ? 'text-against-400' : 'text-surface-500',
                      )}
                    >
                      {data.delta_24h > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : data.delta_24h < 0 ? (
                        <TrendingDown className="h-3 w-3" />
                      ) : null}
                      {data.delta_24h > 0 ? '+' : ''}{data.delta_24h}¢ 24h
                    </div>
                  )}
                </div>
              </div>

              {/* Stat pills */}
              <div className="flex flex-wrap gap-2">
                {data.is_shifting && data.shift_direction && (
                  <span
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border',
                      data.shift_direction === 'bullish'
                        ? 'bg-emerald/10 border-emerald/30 text-emerald'
                        : 'bg-against-500/10 border-against-500/30 text-against-300',
                    )}
                  >
                    {data.shift_direction === 'bullish' ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    Shifting {data.shift_direction === 'bullish' ? 'bullish' : 'bearish'}
                  </span>
                )}
                {data.vs_category && (
                  <span
                    className={cn(
                      'text-[11px] font-medium px-2.5 py-1 rounded-full border',
                      data.vs_category === 'above'
                        ? 'bg-for-500/10 border-for-500/30 text-for-400'
                        : data.vs_category === 'below'
                        ? 'bg-against-500/10 border-against-500/30 text-against-400'
                        : 'bg-surface-300/30 border-surface-400/30 text-surface-400',
                    )}
                  >
                    {data.vs_category === 'above'
                      ? `↑ Above ${data.category} avg (${data.category_avg_price}¢)`
                      : data.vs_category === 'below'
                      ? `↓ Below ${data.category} avg (${data.category_avg_price}¢)`
                      : `Aligned with ${data.category} avg (${data.category_avg_price}¢)`}
                  </span>
                )}
                {data.contrarian_indicator && (
                  <span className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-gold/10 border-gold/30 text-gold">
                    <Star className="h-3 w-3" />
                    Contrarian signal
                  </span>
                )}
              </div>
            </div>

            {/* Consensus strength bar */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                  Consensus Strength
                </span>
                <span className={cn('text-sm font-mono font-bold', sentCfg?.color)}>
                  {data.consensus_strength}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-300/60 overflow-hidden">
                <motion.div
                  className={cn('h-full rounded-full', sentCfg?.barColor ?? 'bg-surface-500')}
                  initial={{ width: 0 }}
                  animate={{ width: `${data.consensus_strength}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs text-surface-500">
                {data.consensus_strength >= 70
                  ? 'Strong community agreement — price reflects broad consensus.'
                  : data.consensus_strength >= 45
                  ? 'Moderate consensus — some disagreement across voter groups.'
                  : 'Low consensus — this market remains genuinely contested.'}
              </p>
            </div>

            {/* 30-day history */}
            {data.history.length >= 3 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                    Sentiment History · 30d
                  </span>
                </div>
                <SparkLine ticks={data.history} />
                <div className="flex items-center justify-between text-[10px] text-surface-600 font-mono">
                  <span>{data.history[0]?.date}</span>
                  <span>{data.history[data.history.length - 1]?.date}</span>
                </div>
              </div>
            )}

            {/* Voter breakdown */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                    Sentiment by Role
                  </span>
                </div>
                <span className="text-xs text-surface-500 font-mono">
                  {data.total_voters.toLocaleString()} voters
                </span>
              </div>

              {data.role_sentiment.length > 0 ? (
                <>
                  {data.role_sentiment.map((r) => (
                    <RoleRow key={r.role} item={r} />
                  ))}
                  {/* Overall bar */}
                  <div className="pt-3 border-t border-surface-300/30 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-for-400 font-semibold">
                        FOR · {data.for_voters.toLocaleString()}
                      </span>
                      <span className="text-surface-500 font-mono">
                        {data.total_voters.toLocaleString()} total
                      </span>
                      <span className="text-against-400 font-semibold">
                        AGAINST · {data.against_voters.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-300/60 overflow-hidden flex">
                      <motion.div
                        className="h-full bg-for-500 rounded-l-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${data.total_voters > 0 ? (data.for_voters / data.total_voters) * 100 : 50}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                      <motion.div
                        className="h-full bg-against-500 rounded-r-full"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${data.total_voters > 0 ? (data.against_voters / data.total_voters) * 100 : 50}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No vote data yet"
                  description="Vote breakdown by role will appear as the community engages."
                />
              )}
            </div>

            {/* Argument momentum */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-surface-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                  Argument Momentum
                </span>
                {data.argument_edge !== 'balanced' && (
                  <span
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full border ml-auto',
                      data.argument_edge === 'for'
                        ? 'bg-for-500/10 border-for-500/30 text-for-400'
                        : 'bg-against-500/10 border-against-500/30 text-against-400',
                    )}
                  >
                    {data.argument_edge === 'for' ? 'FOR' : 'AGAINST'} side leads engagement
                  </span>
                )}
              </div>

              {data.argument_momentum[0].count + data.argument_momentum[1].count > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.argument_momentum.map((m) => (
                    <ArgMomentumCard
                      key={m.side}
                      m={m}
                      isEdge={data.argument_edge === m.side}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={MessageSquare}
                  title="No arguments yet"
                  description="Argument momentum will appear once citizens start making their case."
                />
              )}

              {data.contrarian_indicator && (
                <div className="flex items-start gap-2 rounded-xl bg-gold/10 border border-gold/30 p-3">
                  <Star className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-surface-300 leading-relaxed">
                    <span className="font-semibold text-gold">Contrarian signal: </span>
                    The argument side with more engagement disagrees with the market price. This
                    can indicate the market may be under- or over-pricing community conviction.
                  </p>
                </div>
              )}
            </div>

            {/* Commentary sentiment */}
            {data.commentary && data.commentary.total > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                    Commentary Sentiment
                  </span>
                  <span className="text-xs text-surface-500 font-mono ml-auto">
                    {data.commentary.total} comments
                  </span>
                </div>

                {/* Tri-bar */}
                <div className="space-y-2">
                  {[
                    { label: 'Bullish (FOR)', pct: data.commentary.for_pct, color: 'bg-for-500' },
                    { label: 'Neutral', pct: data.commentary.neutral_pct, color: 'bg-surface-500' },
                    { label: 'Bearish (AGAINST)', pct: data.commentary.against_pct, color: 'bg-against-500' },
                  ].map(({ label, pct, color }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-surface-400">{label}</span>
                        <span className="font-mono text-surface-300">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
                        <motion.div
                          className={cn('h-full rounded-full', color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent direction */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-surface-500">Recent comment trend</span>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full border',
                      SENTIMENT_CONFIG[data.commentary.recent_direction].bg,
                      SENTIMENT_CONFIG[data.commentary.recent_direction].border,
                      SENTIMENT_CONFIG[data.commentary.recent_direction].color,
                    )}
                  >
                    {SENTIMENT_CONFIG[data.commentary.recent_direction].label}
                  </span>
                </div>
              </div>
            )}

            {/* Related links */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300/60 divide-y divide-surface-300/30">
              {[
                { href: `/exchange/${id}/signal`, label: 'Technical Signals', icon: Zap },
                { href: `/exchange/${id}/momentum`, label: 'Price Momentum', icon: TrendingUp },
                { href: `/exchange/${id}/commentary`, label: 'All Commentary', icon: MessageSquare },
                { href: `/exchange/${id}/arguments`, label: 'All Arguments', icon: Scale },
                { href: `/exchange/${id}/verdict`, label: 'Community Verdict', icon: Flame },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-300/20 transition-colors group"
                >
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
                  <span className="text-sm text-surface-300 group-hover:text-white transition-colors flex-1">
                    {label}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400" />
                </Link>
              ))}
            </div>

            {/* Footer */}
            {lastRefresh && (
              <p className="text-center text-[10px] text-surface-600 font-mono pb-2">
                Updated {relTime(lastRefresh)}
              </p>
            )}
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300/40 p-5 space-y-4">
        <Skeleton className="h-5 w-40 rounded-full" />
        <Skeleton className="h-5 w-3/4" />
        <div className="flex gap-5">
          <Skeleton className="h-24 w-32 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4 space-y-3">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4 space-y-3">
        <Skeleton className="h-5 w-36 rounded-full" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4 space-y-3">
        <Skeleton className="h-5 w-44 rounded-full" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="py-2.5 border-b border-surface-300/30 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-14" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
