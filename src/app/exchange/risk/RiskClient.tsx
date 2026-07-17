'use client'

/**
 * /exchange/risk — Portfolio Risk Radar
 *
 * Five-dimension risk analysis of the user's civic market positions:
 *   1. Concentration — category diversification (HHI)
 *   2. Resolution   — positions in active voting (imminent outcome)
 *   3. Momentum     — positions moving against the user
 *   4. Liquidity    — exposure to thin, low-vote markets
 *   5. Drawdown     — worst single-position loss
 *
 * Distinct from /exchange/portfolio (positions list) and
 * /exchange/performance (historical stats).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Circle,
  Droplets,
  Flame,
  Gavel,
  Info,
  Layers,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { RiskDimension, RiskPosition, RiskResponse } from '@/app/api/exchange/risk/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<
  'A' | 'B' | 'C' | 'D' | 'F',
  { label: string; color: string; bg: string; border: string; bar: string }
> = {
  A: {
    label: 'Low Risk',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
  },
  B: {
    label: 'Managed',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
  },
  C: {
    label: 'Moderate',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
  },
  D: {
    label: 'Elevated',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-400',
  },
  F: {
    label: 'High Risk',
    color: 'text-against-400',
    bg: 'bg-against-500/15',
    border: 'border-against-500/40',
    bar: 'bg-against-500',
  },
}

// ─── Dimension icons ──────────────────────────────────────────────────────────

const DIM_ICON: Record<string, typeof Shield> = {
  concentration: Layers,
  time: Gavel,
  momentum: Flame,
  liquidity: Droplets,
  drawdown: TrendingDown,
}

// ─── Radar chart (pure CSS/SVG, no external library) ─────────────────────────

function RadarChart({ dimensions }: { dimensions: RiskDimension[] }) {
  const cx = 120
  const cy = 120
  const r = 90
  const n = dimensions.length
  const levels = 4

  // Compute axis endpoints
  const axes = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  })

  // Grid rings
  const rings = Array.from({ length: levels }, (_, l) => {
    const rr = (r * (l + 1)) / levels
    return dimensions
      .map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`
      })
      .join(' ')
  })

  // Data polygon (score 0-100 → radius 0-r)
  const dataPoints = dimensions.map((d, i) => {
    const rr = (d.score / 100) * r
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`
  })

  // Label positions (slightly further than axis ends)
  const labels = dimensions.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const rr = r + 22
    const x = cx + rr * Math.cos(angle)
    const y = cy + rr * Math.sin(angle)
    const anchor = Math.abs(Math.cos(angle)) < 0.15 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'
    return { x, y, label: d.label, anchor, grade: d.grade }
  })

  return (
    <svg
      viewBox="0 0 240 240"
      className="w-full max-w-[300px] mx-auto"
      aria-label="Risk radar chart"
    >
      {/* Grid rings */}
      {rings.map((pts, l) => (
        <polygon
          key={l}
          points={pts}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
      ))}

      {/* Axis lines */}
      {axes.map((ax, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={ax.x}
          y2={ax.y}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      ))}

      {/* Data fill */}
      <polygon
        points={dataPoints.join(' ')}
        fill="rgba(239,68,68,0.15)"
        stroke="rgba(239,68,68,0.7)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Data point dots */}
      {dimensions.map((d, i) => {
        const rr = (d.score / 100) * r
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2
        const x = cx + rr * Math.cos(angle)
        const y = cy + rr * Math.sin(angle)
        const cfg = GRADE_CONFIG[d.grade]
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4"
            className={cn(cfg.bar)}
            fill="currentColor"
          />
        )
      })}

      {/* Axis labels */}
      {labels.map((l, i) => (
        <text
          key={i}
          x={l.x}
          y={l.y}
          textAnchor={l.anchor}
          dominantBaseline="middle"
          fontSize="9"
          fill={GRADE_CONFIG[l.grade].color.replace('text-', '')}
          className="font-mono font-semibold"
          style={{ fontFamily: 'monospace', fill: 'currentColor' }}
        >
          <tspan className={GRADE_CONFIG[l.grade].color}>{l.label}</tspan>
        </text>
      ))}

      {/* Axis labels rendered as foreignObject for Tailwind colors */}
      {labels.map((l, i) => {
        return (
          <text
            key={`lbl-${i}`}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor as 'middle' | 'start' | 'end'}
            dominantBaseline="middle"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="600"
            fill={
              l.grade === 'A' ? '#10b981'
              : l.grade === 'B' ? '#60a5fa'
              : l.grade === 'C' ? '#f59e0b'
              : l.grade === 'D' ? '#f87171'
              : '#ef4444'
            }
          >
            {l.label}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ dim }: { dim: RiskDimension }) {
  const cfg = GRADE_CONFIG[dim.grade]
  const Icon = DIM_ICON[dim.key] ?? Shield

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl bg-surface-100 border p-4',
        cfg.border,
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('p-2 rounded-lg flex-shrink-0', cfg.bg)}>
          <Icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-white font-mono">{dim.label}</p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn('text-xs font-mono font-bold', cfg.color)}>{dim.grade}</span>
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cfg.bg, cfg.color, cfg.border)}>
                {cfg.label}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-surface-500 mt-0.5 font-mono">{dim.value}</p>
        </div>
      </div>

      {/* Risk bar */}
      <div className="h-1.5 w-full bg-surface-300 rounded-full overflow-hidden mb-3">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${dim.score}%` }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          className={cn('h-full rounded-full', cfg.bar)}
        />
      </div>

      <p className="text-[11px] text-surface-400 leading-relaxed">{dim.insight}</p>
    </motion.div>
  )
}

// ─── Position row ──────────────────────────────────────────────────────────────

function PositionRow({ pos }: { pos: RiskPosition }) {
  const isBull = pos.side === 'blue'
  const pnl = pos.pnl
  const isLosing = pnl < 0

  return (
    <Link
      href={`/topic/${pos.topic_id}`}
      className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-200/60 transition-colors group"
    >
      <div
        className={cn(
          'h-1.5 w-1.5 rounded-full flex-shrink-0',
          isBull ? 'bg-for-500' : 'bg-against-500',
        )}
      />
      <p className="text-xs text-surface-300 truncate flex-1 min-w-0 group-hover:text-white transition-colors">
        {pos.statement}
      </p>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isLosing ? (
          <TrendingDown className="h-3 w-3 text-against-400" />
        ) : (
          <TrendingUp className="h-3 w-3 text-emerald" />
        )}
        <span
          className={cn(
            'text-xs font-mono font-semibold',
            isLosing ? 'text-against-400' : 'text-emerald',
          )}
        >
          {pnl >= 0 ? '+' : ''}{Math.round(pnl)}pt
        </span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
    </Link>
  )
}

// ─── Diversification bar ──────────────────────────────────────────────────────

const CAT_BAR_COLOR: Record<string, string> = {
  Economics: 'bg-gold',
  Politics: 'bg-for-500',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-against-400',
  Philosophy: 'bg-purple',
  Culture: 'bg-gold',
  Health: 'bg-emerald',
  Environment: 'bg-emerald',
  Education: 'bg-for-400',
  Unknown: 'bg-surface-400',
}

function DiversificationBar({
  map,
}: {
  map: RiskResponse['diversification_map']
}) {
  if (map.length === 0) return null

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-2.5 w-full rounded-full overflow-hidden gap-px bg-surface-300">
        {map.map((row) => (
          <motion.div
            key={row.category}
            initial={{ width: 0 }}
            animate={{ width: `${row.pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn('h-full', CAT_BAR_COLOR[row.category] ?? 'bg-surface-400')}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {map.map((row) => (
          <div key={row.category} className="flex items-center gap-2">
            <div
              className={cn(
                'h-2 w-2 rounded-sm flex-shrink-0',
                CAT_BAR_COLOR[row.category] ?? 'bg-surface-400',
              )}
            />
            <span className="text-xs text-surface-400 font-mono truncate">
              {row.category}
            </span>
            <span className="text-xs font-mono text-surface-500 ml-auto">
              {row.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RiskClient() {
  const [data, setData] = useState<RiskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/risk')
      if (res.status === 401) {
        setError('auth')
        return
      }
      if (!res.ok) {
        setError('Failed to load risk data')
        return
      }
      setData(await res.json())
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const composite = data?.composite_grade
  const compositeCfg = composite ? GRADE_CONFIG[composite] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Exchange"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono">Risk Radar</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Five-dimension portfolio risk analysis
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh risk data"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Auth error ──────────────────────────────────────────────────── */}
        {error === 'auth' && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Shield className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white mb-1">Sign in to view your risk radar</p>
            <p className="text-xs text-surface-500 mb-4">
              Risk analysis requires a portfolio. Vote on topics to build your positions.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-medium transition-colors"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── General error ────────────────────────────────────────────────── */}
        {error && error !== 'auth' && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-against-400 text-sm font-mono">
            {error}
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {loading && !error && (
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="space-y-6">

            {/* ── Empty state ─────────────────────────────────────────────── */}
            {data.open_positions === 0 && (
              <EmptyState
                icon={BarChart2}
                title="No open positions"
                description="Vote on active topics to build a portfolio and see your risk profile here."
                action={
                  <Link
                    href="/topics"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-medium transition-colors"
                  >
                    Browse topics <ArrowRight className="h-4 w-4" />
                  </Link>
                }
              />
            )}

            {data.open_positions > 0 && (
              <>
                {/* ── Composite score banner ──────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'rounded-2xl border p-5',
                    compositeCfg?.bg,
                    compositeCfg?.border,
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Radar chart */}
                    <div className="flex-1 min-w-0">
                      <RadarChart dimensions={data.dimensions} />
                    </div>

                    {/* Score block */}
                    <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-4">
                      <div
                        className={cn(
                          'text-5xl font-bold font-mono leading-none',
                          compositeCfg?.color,
                        )}
                      >
                        {data.composite_grade}
                      </div>
                      <p className="text-xs font-mono text-surface-500 text-center">
                        Overall<br />Risk
                      </p>
                      <div className="mt-2 text-center">
                        <p className="text-2xl font-bold font-mono text-white">
                          {data.composite_score}
                        </p>
                        <p className="text-[10px] font-mono text-surface-600">/100</p>
                      </div>
                      <div className={cn('text-[10px] font-mono px-2 py-0.5 rounded border', compositeCfg?.bg, compositeCfg?.color, compositeCfg?.border)}>
                        {compositeCfg?.label}
                      </div>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="mt-4 pt-4 border-t border-surface-300/50 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Circle className="h-2 w-2 fill-for-500 text-for-500" />
                      <span className="text-xs font-mono text-surface-400">
                        {data.open_positions} open
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Circle className="h-2 w-2 fill-surface-500 text-surface-500" />
                      <span className="text-xs font-mono text-surface-400">
                        {data.total_positions - data.open_positions} settled
                      </span>
                    </div>
                    <Link
                      href="/exchange/portfolio"
                      className="ml-auto text-xs font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-1"
                    >
                      Portfolio <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.div>

                {/* ── Dimension cards ──────────────────────────────────────── */}
                <div>
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                    Risk Dimensions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.dimensions.map((dim, i) => (
                      <motion.div
                        key={dim.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <DimensionCard dim={dim} />
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* ── Category diversification ─────────────────────────────── */}
                {data.diversification_map.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                    <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                      <Layers className="h-3.5 w-3.5" />
                      Category Exposure
                    </div>
                    <DiversificationBar map={data.diversification_map} />
                  </div>
                )}

                {/* ── Highest-risk positions ───────────────────────────────── */}
                {data.top_risk_positions.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                        <AlertTriangle className="h-3.5 w-3.5 text-against-400" />
                        Positions at Risk
                      </div>
                      <Link
                        href="/exchange/portfolio"
                        className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors flex items-center gap-0.5"
                      >
                        All <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="divide-y divide-surface-300/50">
                      <AnimatePresence>
                        {data.top_risk_positions.map((pos, i) => (
                          <motion.div
                            key={pos.topic_id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.04 }}
                          >
                            <PositionRow pos={pos} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* ── Actions ──────────────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/exchange/portfolio"
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white font-mono">Portfolio</p>
                      <p className="text-xs text-surface-500 mt-0.5">All positions</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  </Link>
                  <Link
                    href="/exchange/performance"
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white font-mono">Performance</p>
                      <p className="text-xs text-surface-500 mt-0.5">Win rate & P&L</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  </Link>
                </div>

                {/* ── Tip ──────────────────────────────────────────────────── */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-200/50 border border-surface-300/50">
                  <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-surface-500 leading-relaxed">
                    Risk scores are calculated from your open (unresolved) positions only.
                    Higher scores indicate greater risk across that dimension.
                    Lower composite scores mean a healthier, more balanced portfolio.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
