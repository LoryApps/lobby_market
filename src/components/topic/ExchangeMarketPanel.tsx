'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowUpRight,
  Bell,
  BarChart2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { PriceTick } from '@/app/api/exchange/trends/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExchangeMarketPanelProps {
  topicId: string
  currentPrice: number // blue_pct (0–100)
  volume: number       // total_votes
  topicStatus: string
  className?: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function priceColorClass(price: number, status: string): string {
  if (status === 'law')    return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-300'
}

function priceHexColor(price: number, status: string): string {
  if (status === 'law')    return '#d97706' // gold
  if (status === 'failed') return '#ef4444' // red
  if (price >= 55) return '#3b82f6'         // for-500 blue
  if (price <= 45) return '#ef4444'         // against red
  return '#6b7280'                           // neutral
}

// ─── Mini sparkline SVG ───────────────────────────────────────────────────────

function MiniSparkline({
  ticks,
  topicId,
  status,
  currentPrice,
}: {
  ticks: PriceTick[]
  topicId: string
  status: string
  currentPrice: number
}) {
  const W = 120
  const H = 36

  const points = useMemo(() => {
    if (ticks.length < 2) return []
    const prices = ticks.map((t) => t.price)
    const min = Math.max(0, Math.min(...prices) - 3)
    const max = Math.min(100, Math.max(...prices) + 3)
    const range = max - min || 1
    return ticks.map((t, i) => ({
      x: (i / (ticks.length - 1)) * W,
      y: H - ((t.price - min) / range) * H,
    }))
  }, [ticks])

  if (points.length < 2) return null

  const polyline = points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  const first = points[0]
  const last = points[points.length - 1]
  const areaPath = `M${first.x},${H} ${points.map((p) => `L${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')} L${last.x},${H} Z`
  const color = priceHexColor(currentPrice, status)
  const gradId = `esp-${topicId}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-[90px] h-[28px] overflow-visible flex-shrink-0"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Market status badge ──────────────────────────────────────────────────────

function MarketStatusBadge({ status }: { status: string }) {
  if (status === 'law') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-gold/10 border-gold/40 text-gold">
        SETTLED · YES
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-against-500/10 border-against-500/40 text-against-400">
        SETTLED · NO
      </span>
    )
  }
  if (status === 'voting') {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-purple/10 border-purple/40 text-purple">
        <span className="h-1.5 w-1.5 rounded-full bg-purple animate-pulse" aria-hidden="true" />
        VOTING
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border bg-emerald/10 border-emerald/40 text-emerald">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" aria-hidden="true" />
      LIVE
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExchangeMarketPanel({
  topicId,
  currentPrice,
  volume,
  topicStatus,
  className,
}: ExchangeMarketPanelProps) {
  const [ticks, setTicks] = useState<PriceTick[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/exchange/trends?ids=${topicId}&limit=24`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, PriceTick[]>) => {
        if (!cancelled) setTicks(data[topicId] ?? [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [topicId])

  const priceChange = useMemo((): number | null => {
    if (ticks.length < 2) return null
    return +(ticks[ticks.length - 1].price - ticks[0].price).toFixed(1)
  }, [ticks])

  const priceChangeSign = priceChange !== null && priceChange > 0 ? '+' : ''

  return (
    <div
      className={cn(
        'rounded-xl bg-surface-100 border border-surface-300 overflow-hidden',
        className,
      )}
      aria-label="Exchange market panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
            Civic Exchange
          </span>
        </div>
        <Link
          href={`/exchange/${topicId}`}
          className="flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          aria-label="Open full market page"
        >
          Full market
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {/* Market body */}
      <div className="px-4 py-3">
        <div className="flex items-end justify-between gap-4">
          {/* Price block */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              {/* Current price */}
              <span
                className={cn(
                  'text-2xl font-bold font-mono tabular-nums leading-none',
                  priceColorClass(currentPrice, topicStatus),
                )}
              >
                {Math.round(currentPrice)}¢
              </span>

              {/* 24h change chip */}
              {priceChange !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-mono',
                    priceChange > 0
                      ? 'text-emerald'
                      : priceChange < 0
                        ? 'text-against-400'
                        : 'text-surface-500',
                  )}
                  title="24h price change"
                >
                  {priceChange > 0 ? (
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                  ) : priceChange < 0 ? (
                    <TrendingDown className="h-3 w-3" aria-hidden="true" />
                  ) : null}
                  {priceChangeSign}{priceChange}
                </span>
              )}
            </div>

            {/* Volume + status */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-surface-500">
                <BarChart2 className="h-3 w-3 text-surface-600" aria-hidden="true" />
                <span>
                  Vol: <span className="text-surface-400 font-mono">{formatVolume(volume)}</span>
                </span>
              </div>
              <MarketStatusBadge status={topicStatus} />
            </div>
          </div>

          {/* Sparkline or skeleton */}
          {loading ? (
            <div className="w-[90px] h-[28px] rounded bg-surface-300 animate-pulse flex-shrink-0" aria-hidden="true" />
          ) : (
            <MiniSparkline
              ticks={ticks}
              topicId={topicId}
              status={topicStatus}
              currentPrice={currentPrice}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-surface-200 flex items-center justify-between gap-3">
        <Link
          href={`/exchange/alerts`}
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors"
          aria-label="Set a price alert for this market"
        >
          <Bell className="h-3 w-3" aria-hidden="true" />
          Price alert
        </Link>
        <Link
          href="/exchange"
          className="text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
        >
          All markets →
        </Link>
      </div>
    </div>
  )
}
