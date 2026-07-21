'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  WeeklyDigest,
  DigestArgument,
  DigestCommentary,
  DigestForecast,
  DigestPriceTick,
} from '@/app/api/exchange/[id]/digest/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function priceColor(p: number): string {
  if (p >= 75) return 'text-gold'
  if (p >= 55) return 'text-for-300'
  if (p <= 25) return 'text-against-400'
  if (p <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function changeColor(delta: number | null): string {
  if (delta === null) return 'text-surface-500'
  if (delta > 0) return 'text-emerald'
  if (delta < 0) return 'text-against-400'
  return 'text-surface-500'
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500 bg-surface-300/40 border-surface-500/30',
  active:   'text-for-300 bg-for-500/10 border-for-500/30',
  voting:   'text-gold bg-gold/10 border-gold/30',
  law:      'text-gold bg-gold/15 border-gold/40',
  failed:   'text-against-400 bg-against-500/10 border-against-500/30',
}

const DIRECTION_COLOR: Record<string, string> = {
  bullish: 'text-emerald',
  bearish: 'text-against-400',
  neutral: 'text-surface-500',
}

const COMMENTARY_DIR_COLOR: Record<string, string> = {
  for:     'text-for-400',
  against: 'text-against-400',
  neutral: 'text-surface-500',
}

// ─── Mini spark chart ─────────────────────────────────────────────────────────

function SparkChart({ ticks, price }: { ticks: DigestPriceTick[]; price: number }) {
  if (ticks.length < 2) {
    return (
      <div className="h-14 flex items-center justify-center text-xs text-surface-600">
        Not enough price data
      </div>
    )
  }
  const prices = ticks.map((t) => t.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1
  const W = 300
  const H = 56
  const pts = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * W
    const y = H - ((p - minP) / range) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const polyline = pts.join(' ')
  const last  = prices[prices.length - 1]
  const first = prices[0]
  const isUp  = last >= first
  const strokeColor = isUp ? '#4ade80' : '#f87171'

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-14"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dg-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`0,${H} ${pts[0]} ${polyline} ${W},${H}`}
          fill="url(#dg-fill)"
        />
        <polyline
          points={polyline}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={W}
          cy={(H - ((last - minP) / range) * H).toFixed(1)}
          r="3"
          fill={strokeColor}
        />
      </svg>
      <div
        className="absolute right-0 top-0 text-[10px] font-mono font-bold"
        style={{ color: strokeColor }}
      >
        {price}¢
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgCard({ arg }: { arg: DigestArgument }) {
  const isFor = arg.side === 'for'
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5 space-y-2',
        isFor
          ? 'border-for-500/20 bg-for-500/5'
          : 'border-against-500/20 bg-against-500/5',
      )}
    >
      <div className="flex items-center gap-1.5">
        {isFor
          ? <ThumbsUp className="h-3 w-3 text-for-400 flex-shrink-0" />
          : <ThumbsDown className="h-3 w-3 text-against-400 flex-shrink-0" />}
        <span className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          isFor ? 'text-for-400' : 'text-against-400',
        )}>
          {isFor ? 'For' : 'Against'} · {arg.upvote_count} upvotes
        </span>
        <span className="text-[10px] text-surface-600 ml-auto">{relTime(arg.created_at)}</span>
      </div>
      <p className="text-sm text-surface-800 leading-relaxed line-clamp-3">{arg.body}</p>
      <div className="flex items-center gap-1.5 pt-0.5">
        <Avatar
          src={arg.author_avatar_url}
          fallback={arg.author_display_name || arg.author_username}
          size="xs"
        />
        <span className="text-[11px] text-surface-500">
          {arg.author_display_name ?? `@${arg.author_username}`}
        </span>
      </div>
    </div>
  )
}

// ─── Commentary card ──────────────────────────────────────────────────────────

function CommentaryCard({ c }: { c: DigestCommentary }) {
  const dirColor = c.direction ? (COMMENTARY_DIR_COLOR[c.direction] ?? 'text-surface-500') : 'text-surface-500'
  return (
    <div className="flex gap-2.5 py-2.5 border-b border-surface-300 last:border-0">
      <Avatar
        src={c.avatar_url}
        fallback={c.display_name || c.username}
        size="sm"
      />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-surface-700">
            {c.display_name ?? `@${c.username}`}
          </span>
          {c.direction && (
            <span className={cn('text-[10px] font-mono font-semibold uppercase', dirColor)}>
              {c.direction}
            </span>
          )}
          <span className="text-[10px] text-surface-600 ml-auto">{relTime(c.created_at)}</span>
        </div>
        <p className="text-sm text-surface-800 leading-snug">{c.content}</p>
        {c.likes > 0 && (
          <span className="text-[10px] text-surface-600">{c.likes} likes</span>
        )}
      </div>
    </div>
  )
}

// ─── Forecast row ─────────────────────────────────────────────────────────────

function ForecastRow({ f }: { f: DigestForecast }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-300 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-surface-700">
            {f.display_name ?? `@${f.username}`}
          </span>
          <span className={cn(
            'text-[10px] font-mono font-semibold uppercase',
            DIRECTION_COLOR[f.direction] ?? 'text-surface-500',
          )}>
            {f.direction}
          </span>
        </div>
        {f.reasoning && (
          <p className="text-[11px] text-surface-600 line-clamp-1 mt-0.5">{f.reasoning}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <div className={cn(
          'text-sm font-mono font-bold',
          DIRECTION_COLOR[f.direction] ?? 'text-surface-500',
        )}>
          {f.target_price}¢
        </div>
        <div className="text-[10px] text-surface-600">target</div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DigestSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DigestClient({ id }: { id: string }) {
  const [digest, setDigest] = useState<WeeklyDigest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/exchange/${id}/digest`)
      if (!res.ok) throw new Error('Failed to load')
      setDigest(await res.json())
    } catch {
      setError('Unable to load weekly digest')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <DigestSkeleton />

  if (error || !digest) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-16 pb-24 flex flex-col items-center gap-4">
          <BookOpen className="h-10 w-10 text-surface-500" />
          <p className="text-surface-500 text-sm">{error ?? 'Market not found'}</p>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-for-400 text-sm hover:text-for-300 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const change      = digest.price_change_7d
  const changeIsUp  = change !== null && change > 0
  const changeIsDown = change !== null && change < 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">

        {/* Nav row */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-surface-500 hover:text-surface-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Market</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              title="Refresh digest"
              className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors text-surface-600"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <span className="text-xs text-surface-500 font-mono">WEEKLY DIGEST</span>
          </div>
        </div>

        {/* ── Header card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
              STATUS_COLOR[digest.status] ?? STATUS_COLOR.proposed,
            )}>
              {digest.status}
            </span>
            {digest.category && (
              <span className="text-[10px] text-surface-500 uppercase tracking-wider">
                {digest.category}
              </span>
            )}
            <span className="ml-auto text-[10px] text-surface-600">7-Day Recap</span>
          </div>

          <h1 className="text-base md:text-lg font-semibold text-white leading-snug">
            {digest.statement}
          </h1>

          <div className="flex flex-wrap gap-1.5">
            {digest.is_hot && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                <Flame className="h-3 w-3" /> Hot
              </span>
            )}
            {digest.is_near_law && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-gold bg-gold/10 border border-gold/20 rounded-full px-2 py-0.5">
                <Gavel className="h-3 w-3" /> Near Law
              </span>
            )}
            {digest.is_deadlocked && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-surface-500 bg-surface-300/50 border border-surface-500/20 rounded-full px-2 py-0.5">
                <Scale className="h-3 w-3" /> Deadlocked
              </span>
            )}
          </div>

          <SparkChart ticks={digest.price_ticks} price={digest.price} />
        </motion.div>

        {/* ── 7-day stats row ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-3 gap-2"
        >
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] text-surface-500 uppercase tracking-wider">
              {changeIsUp
                ? <TrendingUp className="h-3 w-3 text-emerald" />
                : changeIsDown
                ? <TrendingDown className="h-3 w-3 text-against-400" />
                : <BarChart2 className="h-3 w-3" />}
              7d Change
            </div>
            <span className={cn('text-xl font-mono font-bold', changeColor(change))}>
              {change !== null
                ? `${change > 0 ? '+' : ''}${change.toFixed(1)}¢`
                : '—'}
            </span>
            {digest.price_7d_ago !== null && (
              <span className="text-[10px] text-surface-600">from {digest.price_7d_ago}¢</span>
            )}
          </div>

          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] text-surface-500 uppercase tracking-wider">
              <Users className="h-3 w-3" />
              Week Votes
            </div>
            <span className="text-xl font-mono font-bold text-surface-700">
              {fmt(digest.volume_7d)}
            </span>
            {digest.volume_7d_change_pct !== null && (
              <span className={cn(
                'text-[10px]',
                digest.volume_7d_change_pct > 0 ? 'text-emerald' : 'text-against-400',
              )}>
                {digest.volume_7d_change_pct > 0 ? '+' : ''}{digest.volume_7d_change_pct}% vs prev
              </span>
            )}
          </div>

          <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] text-surface-500 uppercase tracking-wider">
              <Zap className="h-3 w-3" />
              Price Now
            </div>
            <span className={cn('text-xl font-mono font-bold', priceColor(digest.price))}>
              {digest.price}¢
            </span>
            <span className="text-[10px] text-surface-600">{fmt(digest.volume)} total</span>
          </div>
        </motion.div>

        {/* ── New arguments this week ── */}
        {(digest.new_for_args.length > 0 || digest.new_against_args.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-semibold text-surface-700">New Arguments This Week</h2>
              <Link
                href={`/topic/${id}/arguments`}
                className="ml-auto flex items-center gap-0.5 text-xs text-for-400 hover:text-for-300 transition-colors"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {digest.new_for_args.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-for-400 uppercase tracking-wider flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" /> Top FOR
                </p>
                {digest.new_for_args.map((a) => <ArgCard key={a.id} arg={a} />)}
              </div>
            )}

            {digest.new_against_args.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-against-400 uppercase tracking-wider flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" /> Top AGAINST
                </p>
                {digest.new_against_args.map((a) => <ArgCard key={a.id} arg={a} />)}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Commentary this week ── */}
        {digest.top_commentary.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-1"
          >
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-700">Top Commentary</h2>
              <Link
                href={`/exchange/${id}/commentary`}
                className="ml-auto flex items-center gap-0.5 text-xs text-for-400 hover:text-for-300 transition-colors"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            {digest.top_commentary.map((c) => <CommentaryCard key={c.id} c={c} />)}
          </motion.div>
        )}

        {/* ── Forecaster consensus ── */}
        {digest.forecast_count > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3"
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-purple" />
              <h2 className="text-sm font-semibold text-surface-700">Forecaster Consensus</h2>
              <Link
                href={`/exchange/${id}/forecast`}
                className="ml-auto flex items-center gap-0.5 text-xs text-purple hover:text-purple/80 transition-colors"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span className="text-emerald">{digest.bullish_pct}% Bullish</span>
                <span className="text-surface-500">{digest.neutral_pct}% Neutral</span>
                <span className="text-against-400">{digest.bearish_pct}% Bearish</span>
              </div>
              <div className="h-2 rounded-full bg-surface-300 overflow-hidden flex">
                <div
                  className="h-full bg-emerald transition-all"
                  style={{ width: `${digest.bullish_pct}%` }}
                />
                <div
                  className="h-full bg-surface-400 transition-all"
                  style={{ width: `${digest.neutral_pct}%` }}
                />
                <div
                  className="h-full bg-against-500 transition-all"
                  style={{ width: `${digest.bearish_pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-surface-600">
                <span>{digest.forecast_count} forecasters</span>
                {digest.median_target !== null && (
                  <span className="font-mono font-semibold text-surface-700">
                    Median target: {digest.median_target}¢
                  </span>
                )}
              </div>
            </div>

            {digest.top_forecasts.length > 0 && (
              <div className="border-t border-surface-300 pt-3">
                {digest.top_forecasts.map((f, i) => <ForecastRow key={i} f={f} />)}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Footer nav ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-surface-100 border border-surface-300 p-4"
        >
          <p className="text-[10px] text-surface-600 uppercase tracking-wider mb-3">
            Explore This Market
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: `/exchange/${id}`,            label: 'Price Chart',  icon: BarChart2      },
              { href: `/exchange/${id}/research`,   label: 'Research',     icon: BookOpen       },
              { href: `/exchange/${id}/forecast`,   label: 'Forecasts',    icon: Zap            },
              { href: `/exchange/${id}/commentary`, label: 'Commentary',   icon: MessageSquare  },
              { href: `/exchange/${id}/momentum`,   label: 'Momentum',     icon: TrendingUp     },
              { href: `/topic/${id}/arguments`,     label: 'Arguments',    icon: Users          },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-surface-600 hover:text-white"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs font-medium truncate">{label}</span>
                <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0 opacity-50" />
              </Link>
            ))}
          </div>
        </motion.div>

        <p className="text-center text-[10px] text-surface-600 pb-2">
          Digest generated {relTime(digest.generated_at)}
        </p>
      </main>
      <BottomNav />
    </div>
  )
}
