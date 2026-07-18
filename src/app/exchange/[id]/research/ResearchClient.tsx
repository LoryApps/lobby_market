'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart2,
  Brain,
  ChevronRight,
  Clipboard,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Flame,
  Gavel,
  Lightbulb,
  MessageSquare,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
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
import type { MarketResearch, PriceTick, ResearchArgument, ResearchForecast, ResearchThesis, ResearchCommentary } from '@/app/api/exchange/[id]/research/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(p: number): string {
  if (p >= 80) return 'text-gold'
  if (p >= 67) return 'text-for-300'
  if (p >= 55) return 'text-for-400'
  if (p <= 20) return 'text-against-400'
  if (p <= 33) return 'text-against-300'
  return 'text-surface-600'
}

function priceBg(p: number): string {
  if (p >= 67) return 'bg-for-500/10 border-for-500/20'
  if (p <= 33) return 'bg-against-500/10 border-against-500/20'
  return 'bg-surface-200 border-surface-300'
}

function momentumColor(m: number | null): string {
  if (m === null) return 'text-surface-500'
  if (m > 0) return 'text-for-400'
  if (m < 0) return 'text-against-400'
  return 'text-surface-500'
}

function formatMomentum(m: number | null): string {
  if (m === null) return 'N/A'
  const sign = m > 0 ? '+' : ''
  return `${sign}${m}¢`
}

function dirColor(d: string | null) {
  if (d === 'for' || d === 'bullish')    return 'text-for-400'
  if (d === 'against' || d === 'bearish') return 'text-against-400'
  return 'text-surface-500'
}

function dirBg(d: string | null) {
  if (d === 'for' || d === 'bullish')    return 'bg-for-500/10 border-for-500/30'
  if (d === 'against' || d === 'bearish') return 'bg-against-500/10 border-against-500/30'
  return 'bg-surface-200 border-surface-300'
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Mini Sparkline ────────────────────────────────────────────────────────────

function Sparkline({ ticks, width = 200, height = 48 }: { ticks: PriceTick[]; width?: number; height?: number }) {
  const points = useMemo(() => {
    if (ticks.length < 2) return null
    const prices = ticks.map((t) => t.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 1
    const step = width / (prices.length - 1)
    return prices.map((p, i) => {
      const x = i * step
      const y = height - ((p - min) / range) * (height - 4) - 2
      return `${x},${y}`
    }).join(' ')
  }, [ticks, width, height])

  if (!points) return null

  const prices = ticks.map((t) => t.price)
  const first = prices[0]
  const last = prices[prices.length - 1]
  const isUp = last >= first

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={isUp ? '#3b82f6' : '#ef4444'}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.8}
      />
    </svg>
  )
}

// ─── Signal Chip ──────────────────────────────────────────────────────────────

function SignalChip({ label, icon: Icon, color }: { label: string; icon: typeof Flame; color: string }) {
  return (
    <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border', color)}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, href, linkLabel, color = 'text-surface-600' }: {
  icon: typeof BarChart2
  title: string
  href?: string
  linkLabel?: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <h2 className="text-sm font-semibold text-surface-700">{title}</h2>
      </div>
      {href && linkLabel && (
        <Link href={href} className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-0.5">
          {linkLabel}
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Argument Row ─────────────────────────────────────────────────────────────

function ArgumentRow({ arg }: { arg: ResearchArgument }) {
  const isFor = arg.side === 'for'
  return (
    <div className={cn(
      'rounded-xl p-3 border',
      isFor ? 'bg-for-500/5 border-for-500/20' : 'bg-against-500/5 border-against-500/20'
    )}>
      <div className="flex items-start gap-2">
        <div className={cn('mt-0.5 flex-shrink-0', isFor ? 'text-for-400' : 'text-against-400')}>
          {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-surface-700 leading-relaxed line-clamp-2">{arg.body}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-surface-500">@{arg.username}</span>
            <span className={cn('text-[10px] font-mono font-medium', arg.score >= 0 ? 'text-for-400' : 'text-against-400')}>
              {arg.score >= 0 ? '+' : ''}{arg.score}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Forecast Row ─────────────────────────────────────────────────────────────

function ForecastRow({ f }: { f: ResearchForecast }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-surface-200 last:border-0">
      <div className={cn('flex-shrink-0 mt-0.5', dirColor(f.direction))}>
        {f.direction === 'bullish' ? <TrendingUp className="h-3.5 w-3.5" /> :
         f.direction === 'bearish' ? <TrendingDown className="h-3.5 w-3.5" /> :
         <Minus className="h-3.5 w-3.5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-surface-700">
            {f.display_name ?? f.username}
          </span>
          <span className={cn('text-xs font-mono font-bold', dirColor(f.direction))}>
            → {f.target_price}¢
          </span>
          <span className="ml-auto text-[10px] font-mono text-surface-500">
            {f.confidence}% conf
          </span>
        </div>
        {f.reasoning && (
          <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-1">{f.reasoning}</p>
        )}
      </div>
    </div>
  )
}

// ─── Thesis Row ───────────────────────────────────────────────────────────────

function ThesisRow({ t }: { t: ResearchThesis }) {
  return (
    <div className={cn('rounded-xl p-3 border', dirBg(t.direction))}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-surface-700 line-clamp-1">{t.title}</p>
        <span className={cn('text-[10px] font-mono font-medium flex-shrink-0', dirColor(t.direction))}>
          {t.direction === 'for' ? 'Bullish' : t.direction === 'against' ? 'Bearish' : 'Neutral'}
        </span>
      </div>
      <p className="text-[11px] text-surface-500 line-clamp-2">{t.body}</p>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] text-surface-500">@{t.username}</span>
        <span className="text-[10px] font-mono text-for-400">{t.upvotes} votes</span>
        <Link
          href={`/exchange/ideas/${t.id}`}
          className="ml-auto text-[10px] text-surface-500 hover:text-white transition-colors flex items-center gap-0.5"
        >
          Read <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  )
}

// ─── Commentary Row ───────────────────────────────────────────────────────────

function CommentaryRow({ c }: { c: ResearchCommentary }) {
  return (
    <div className="py-2 border-b border-surface-200 last:border-0">
      <div className="flex items-start gap-2">
        <div className={cn('flex-shrink-0 mt-0.5', dirColor(c.direction))}>
          {c.direction === 'for' ? <ThumbsUp className="h-3 w-3" /> :
           c.direction === 'against' ? <ThumbsDown className="h-3 w-3" /> :
           <MessageSquare className="h-3 w-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-surface-700 line-clamp-2">{c.content}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-surface-500">@{c.username}</span>
            {c.likes > 0 && (
              <span className="text-[10px] font-mono text-for-400">♥ {c.likes}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Research Skeleton ────────────────────────────────────────────────────────

function ResearchSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-4 gap-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-2xl" />
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ResearchClientProps {
  id: string
  statement: string
}

export function ResearchClient({ id, statement }: ResearchClientProps) {
  const [data, setData] = useState<MarketResearch | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const lastFetchRef = useRef(0)

  const load = useCallback(async () => {
    const now = Date.now()
    if (now - lastFetchRef.current < 500) return
    lastFetchRef.current = now

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/research`)
      if (!res.ok) throw new Error('Failed to load research')
      const json: MarketResearch = await res.json()
      setData(json)
    } catch {
      setError('Could not load research report.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // best-effort
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 md:pb-12">

        {/* Back + actions */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to market"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 min-w-0">
            <Link href="/exchange" className="hover:text-white transition-colors">Exchange</Link>
            <span>/</span>
            <span className="truncate">{statement.slice(0, 30)}{statement.length > 30 ? '…' : ''}</span>
            <span>/</span>
            <span className="text-gold">Research</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Copy report link"
            >
              {copied ? <ClipboardCheck className="h-3.5 w-3.5 text-for-400" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Share'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
              aria-label="Refresh report"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Page title */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-gold" />
            <span className="text-xs font-mono text-gold uppercase tracking-widest">Research Report</span>
          </div>
          <h1 className="text-lg font-semibold text-white leading-snug">{statement}</h1>
        </div>

        {loading && !data ? (
          <ResearchSkeleton />
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Report unavailable"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >

              {/* ── Market Overview Card ─────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {data.category && (
                        <Badge variant="proposed" className="text-[10px]">{data.category}</Badge>
                      )}
                      {data.scope && data.scope !== 'Global' && (
                        <span className="text-[10px] font-mono text-surface-500">{data.scope}</span>
                      )}
                      <span className="text-[10px] font-mono text-surface-500">
                        since {new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Signals row */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {data.trend === 'bullish' && (
                        <SignalChip label="Bullish" icon={TrendingUp} color="text-for-400 bg-for-500/10 border-for-500/30" />
                      )}
                      {data.trend === 'bearish' && (
                        <SignalChip label="Bearish" icon={TrendingDown} color="text-against-400 bg-against-500/10 border-against-500/30" />
                      )}
                      {data.is_hot && (
                        <SignalChip label="Hot" icon={Flame} color="text-against-300 bg-against-500/10 border-against-500/30" />
                      )}
                      {data.is_near_law && (
                        <SignalChip label="Near Law" icon={Gavel} color="text-gold bg-gold/10 border-gold/30" />
                      )}
                      {data.is_deadlocked && (
                        <SignalChip label="Deadlocked" icon={Scale} color="text-purple bg-purple/10 border-purple/30" />
                      )}
                      {data.is_closing_soon && (
                        <SignalChip label="Closing Soon" icon={Zap} color="text-gold bg-gold/10 border-gold/30" />
                      )}
                      {data.is_overbought && (
                        <SignalChip label="Overbought" icon={AlertTriangle} color="text-against-400 bg-against-500/10 border-against-500/30" />
                      )}
                      {data.is_oversold && (
                        <SignalChip label="Oversold" icon={AlertTriangle} color="text-for-400 bg-for-500/10 border-for-500/30" />
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className={cn('rounded-xl border px-4 py-3 text-right flex-shrink-0', priceBg(data.price))}>
                    <p className={cn('text-2xl font-mono font-bold leading-none', priceColor(data.price))}>
                      {data.price}¢
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">current</p>
                  </div>
                </div>

                {/* 4 key metrics */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    {
                      label: 'Volume',
                      value: data.volume >= 1000 ? `${(data.volume / 1000).toFixed(1)}k` : data.volume.toString(),
                      icon: BarChart2,
                      color: 'text-for-400',
                    },
                    {
                      label: '7d Move',
                      value: formatMomentum(data.momentum_7d),
                      icon: data.momentum_7d && data.momentum_7d > 0 ? ArrowUp : data.momentum_7d && data.momentum_7d < 0 ? ArrowDown : Minus,
                      color: momentumColor(data.momentum_7d),
                    },
                    {
                      label: '52w High',
                      value: `${data.price_all_time_high}¢`,
                      icon: TrendingUp,
                      color: 'text-gold',
                    },
                    {
                      label: 'Volatility',
                      value: `${data.volatility_score}`,
                      icon: Activity,
                      color: data.volatility_score > 60 ? 'text-against-400' : data.volatility_score > 30 ? 'text-gold' : 'text-emerald',
                    },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg bg-surface-200/60 border border-surface-300/60 p-2.5 text-center">
                      <m.icon className={cn('h-3 w-3 mx-auto mb-1', m.color)} aria-hidden="true" />
                      <p className={cn('text-sm font-mono font-bold leading-none', m.color)}>{m.value}</p>
                      <p className="text-[9px] text-surface-500 mt-0.5 leading-tight">{m.label}</p>
                    </div>
                  ))}
                </div>

                {/* Sparkline */}
                {data.price_ticks.length >= 2 && (
                  <div className="rounded-lg bg-surface-200/40 border border-surface-300/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-surface-500">Price history</span>
                      <span className="text-[10px] font-mono text-surface-500">{data.price_ticks.length} ticks</span>
                    </div>
                    <div className="w-full overflow-hidden">
                      <Sparkline ticks={data.price_ticks} width={480} height={40} />
                    </div>
                  </div>
                )}
              </div>

              {/* ── Argument Intelligence ────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <SectionHeader
                  icon={Brain}
                  title="Argument Intelligence"
                  href={`/topic/${id}/arguments`}
                  linkLabel={`${data.for_arg_count + data.against_arg_count} total`}
                  color="text-purple"
                />

                {/* Argument balance bar */}
                {(data.for_arg_count + data.against_arg_count) > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-for-400">{data.for_arg_count} For</span>
                      <span className="text-against-400">{data.against_arg_count} Against</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400"
                        style={{ width: `${Math.round(data.for_arg_count / (data.for_arg_count + data.against_arg_count) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-for-400 mb-1.5 flex items-center gap-1">
                      <ThumbsUp className="h-2.5 w-2.5" /> Top For
                    </div>
                    {data.top_for_args.length > 0
                      ? data.top_for_args.map((a) => <ArgumentRow key={a.id} arg={a} />)
                      : <p className="text-xs text-surface-500 italic">No arguments yet.</p>}
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono text-against-400 mb-1.5 flex items-center gap-1">
                      <ThumbsDown className="h-2.5 w-2.5" /> Top Against
                    </div>
                    {data.top_against_args.length > 0
                      ? data.top_against_args.map((a) => <ArgumentRow key={a.id} arg={a} />)
                      : <p className="text-xs text-surface-500 italic">No arguments yet.</p>}
                  </div>
                </div>
              </div>

              {/* ── Forecast Consensus ───────────────────────────────────── */}
              {data.forecast_count > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <SectionHeader
                    icon={Target}
                    title="Forecast Consensus"
                    href={`/exchange/${id}/forecast`}
                    linkLabel={`${data.forecast_count} forecasts`}
                    color="text-for-400"
                  />

                  {/* Consensus bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className="text-for-400">{data.bullish_pct}% Bullish</span>
                      {data.median_target != null && (
                        <span className="text-surface-500">Median target: <span className="font-bold text-white">{data.median_target}¢</span></span>
                      )}
                      <span className="text-against-400">{data.bearish_pct}% Bearish</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
                      <div
                        className="h-full bg-for-500/70 transition-all"
                        style={{ width: `${data.bullish_pct}%` }}
                      />
                      <div
                        className="h-full bg-surface-400/40 transition-all"
                        style={{ width: `${data.neutral_pct}%` }}
                      />
                      <div
                        className="h-full bg-against-500/70 transition-all"
                        style={{ width: `${data.bearish_pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Top forecasts */}
                  <div className="space-y-0">
                    {data.top_forecasts.map((f, i) => (
                      <ForecastRow key={i} f={f} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Market Theses ────────────────────────────────────────── */}
              {data.top_theses.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <SectionHeader
                    icon={Lightbulb}
                    title="Market Theses"
                    href={`/exchange/${id}/ideas`}
                    linkLabel="All theses"
                    color="text-gold"
                  />
                  <div className="space-y-2">
                    {data.top_theses.map((t) => (
                      <ThesisRow key={t.id} t={t} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Notable Commentary ───────────────────────────────────── */}
              {data.recent_commentary.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <SectionHeader
                    icon={MessageSquare}
                    title="Notable Commentary"
                    color="text-emerald"
                  />
                  <div className="space-y-0">
                    {data.recent_commentary.map((c) => (
                      <CommentaryRow key={c.id} c={c} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Navigate To ──────────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">Go Deeper</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: `/exchange/${id}`,          label: 'Market Overview',  icon: BarChart2,     color: 'hover:border-for-500/40 hover:text-for-300' },
                    { href: `/exchange/${id}/analysis`, label: 'Price Analysis',   icon: Activity,      color: 'hover:border-purple/40 hover:text-purple' },
                    { href: `/exchange/${id}/forecast`, label: 'Forecasts',        icon: Target,        color: 'hover:border-for-500/40 hover:text-for-300' },
                    { href: `/exchange/${id}/ideas`,    label: 'Theses',           icon: Lightbulb,     color: 'hover:border-gold/40 hover:text-gold' },
                    { href: `/exchange/${id}/traders`,  label: 'Traders',          icon: Users,         color: 'hover:border-emerald/40 hover:text-emerald' },
                    { href: `/topic/${id}`,             label: 'Live Debate',      icon: Sparkles,      color: 'hover:border-against-500/40 hover:text-against-300' },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2.5 rounded-xl',
                        'bg-surface-200 border border-surface-300 text-xs text-surface-500',
                        'transition-colors',
                        link.color,
                      )}
                    >
                      <link.icon className="h-3.5 w-3.5 flex-shrink-0" />
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Footer: generated at */}
              <p className="text-center text-[10px] font-mono text-surface-600 pb-2">
                Report generated {relTime(data.generated_at)} · Lobby Exchange
              </p>

            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
