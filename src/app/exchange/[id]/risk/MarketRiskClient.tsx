'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  Droplets,
  Flame,
  Info,
  Layers,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MarketRiskResponse, MarketRiskDimension, RiskSignal, RiskGrade } from '@/app/api/exchange/[id]/risk/route'

// ─── Grade config ─────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<RiskGrade, {
  label: string
  color: string
  bg: string
  border: string
  bar: string
}> = {
  A: { label: 'Low',      color: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30',    bar: 'bg-emerald'    },
  B: { label: 'Managed',  color: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30',    bar: 'bg-for-400'    },
  C: { label: 'Elevated', color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30',       bar: 'bg-gold'       },
  D: { label: 'High',     color: 'text-against-300',bg: 'bg-against-500/10',border: 'border-against-500/30',bar: 'bg-against-400' },
  F: { label: 'Critical', color: 'text-against-400',bg: 'bg-against-600/15',border: 'border-against-600/40',bar: 'bg-against-500' },
}

const SEVERITY_CONFIG = {
  critical: { color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/40', dot: 'bg-against-500' },
  high:     { color: 'text-against-300', bg: 'bg-against-500/8',  border: 'border-against-500/30', dot: 'bg-against-400' },
  medium:   { color: 'text-gold',        bg: 'bg-gold/8',         border: 'border-gold/30',        dot: 'bg-gold'        },
  low:      { color: 'text-surface-400', bg: 'bg-surface-300/10', border: 'border-surface-300/30', dot: 'bg-surface-500' },
}

const DIMENSION_ICONS: Record<string, typeof Shield> = {
  extremity: Flame,
  volatility: Zap,
  liquidity:  Droplets,
  coalition:  Users,
  deadline:   Clock,
  sentiment:  Scale,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law')    return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

function RiskGauge({ score, grade }: { score: number; grade: RiskGrade }) {
  const cfg = GRADE_CONFIG[grade]
  // Arc spans from -140deg to +140deg (280deg total)
  const angleDeg = -140 + (score / 100) * 280
  const angleRad = (angleDeg * Math.PI) / 180
  const cx = 60
  const cy = 60
  const r  = 48

  // Track arc (gray)
  const startAngle = (-140 * Math.PI) / 180
  const endAngle   = (140  * Math.PI) / 180
  const largeArc   = 1

  function arc(from: number, to: number): string {
    const x1 = cx + r * Math.cos(from)
    const y1 = cy + r * Math.sin(from)
    const x2 = cx + r * Math.cos(to)
    const y2 = cy + r * Math.sin(to)
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  const needleX = cx + (r - 8) * Math.cos(angleRad)
  const needleY = cy + (r - 8) * Math.sin(angleRad)

  return (
    <svg viewBox="0 0 120 80" className="w-32 h-24">
      {/* Track */}
      <path
        d={arc(startAngle, endAngle)}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        className="text-surface-300/40"
      />
      {/* Fill */}
      <path
        d={arc(startAngle, angleRad)}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        stroke="currentColor"
        className={cfg.color}
      />
      {/* Needle dot */}
      <circle cx={needleX} cy={needleY} r="4" className={cn('fill-current', cfg.color)} />
      {/* Score */}
      <text x={cx} y={cy + 12} textAnchor="middle" className="text-sm font-mono font-bold fill-current text-white">
        <tspan className="text-base font-bold">{score}</tspan>
      </text>
    </svg>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ dim }: { dim: MarketRiskDimension }) {
  const cfg  = GRADE_CONFIG[dim.grade]
  const Icon = DIMENSION_ICONS[dim.key] ?? Shield
  const [open, setOpen] = useState(false)

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4 flex-shrink-0', cfg.color)} />
          <span className="text-sm font-semibold text-white">{dim.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-surface-500">{dim.metric}</span>
          <span className={cn('text-xs font-mono font-bold px-1.5 py-0.5 rounded border', cfg.color, cfg.bg, cfg.border)}>
            {dim.grade}
          </span>
        </div>
      </div>

      {/* Risk bar */}
      <div className="h-1.5 rounded-full bg-surface-300/30 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', cfg.bar)}
          style={{ width: `${dim.score}%` }}
        />
      </div>

      {/* Insight toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-300 transition-colors"
      >
        <Info className="h-3 w-3" />
        {open ? 'Hide' : 'Details'}
      </button>
      {open && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="text-xs text-surface-400 leading-relaxed"
        >
          {dim.insight}
        </motion.p>
      )}
    </div>
  )
}

// ─── Signal card ──────────────────────────────────────────────────────────────

function SignalCard({ signal }: { signal: RiskSignal }) {
  const cfg = SEVERITY_CONFIG[signal.severity]
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3', cfg.bg, cfg.border)}>
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', cfg.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-semibold font-mono', cfg.color)}>{signal.label}</span>
          <span className="text-[10px] font-mono text-surface-600 uppercase">{signal.severity}</span>
          {signal.direction !== 'neutral' && (
            signal.direction === 'bullish'
              ? <TrendingUp className="h-3 w-3 text-for-400 ml-auto" />
              : <TrendingDown className="h-3 w-3 text-against-400 ml-auto" />
          )}
        </div>
        <p className="text-xs text-surface-400 leading-snug">{signal.description}</p>
      </div>
    </div>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function RiskSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 space-y-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-2xl" />
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MarketRiskClient({ id }: { id: string }) {
  const [data, setData]   = useState<MarketRiskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/exchange/${id}/risk`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Unable to load risk analysis')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <RiskSkeleton />

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 flex flex-col items-center justify-center gap-4">
          <ShieldAlert className="h-10 w-10 text-surface-500" />
          <p className="text-surface-500 text-sm">{error ?? 'Market not found'}</p>
          <button onClick={load} className="flex items-center gap-1.5 text-for-400 text-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </main>
        <BottomNav />
      </div>
    )
  }

  const gradeCfg = GRADE_CONFIG[data.composite_grade]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-4">

        {/* Back + refresh */}
        <div className="flex items-center justify-between">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Market</span>
          </Link>
          <button
            onClick={load}
            className="text-surface-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {/* ── Composite risk card ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('rounded-2xl border p-5', gradeCfg.bg, gradeCfg.border)}
        >
          <div className="flex items-start gap-4">
            {/* Gauge */}
            <div className="flex-shrink-0">
              <RiskGauge score={data.composite_score} grade={data.composite_grade} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex items-center gap-2 mb-1">
                <Shield className={cn('h-4 w-4', gradeCfg.color)} />
                <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Market Risk</span>
              </div>
              <p className={cn('text-2xl font-mono font-bold', gradeCfg.color)}>
                Grade {data.composite_grade}
              </p>
              <p className="text-sm font-semibold text-white mb-1">{data.composite_label}</p>
              <p className={cn('text-xs font-mono', priceColor(data.price, data.status))}>
                {data.price}¢ · {data.volume.toLocaleString()} votes
              </p>
            </div>
          </div>

          {/* Market statement */}
          <p className="mt-4 text-sm text-surface-300 leading-snug line-clamp-2 border-t border-surface-300/20 pt-3">
            {data.statement}
          </p>

          {/* Quick stats */}
          <div className="mt-3 flex flex-wrap gap-2">
            {data.price_at_risk > 0 && (
              <span className="text-xs font-mono text-surface-500 bg-surface-200/60 rounded-full px-2 py-0.5">
                ±{data.price_at_risk}¢ price-at-risk
              </span>
            )}
            {data.vol_7d !== null && (
              <span className={cn(
                'text-xs font-mono rounded-full px-2 py-0.5',
                data.vol_7d > 10 ? 'text-against-300 bg-against-500/10' : 'text-surface-500 bg-surface-200/60'
              )}>
                {data.vol_7d}¢ 7d move
              </span>
            )}
            {data.days_to_close !== null && (
              <span className={cn(
                'text-xs font-mono rounded-full px-2 py-0.5',
                data.days_to_close <= 3 ? 'text-against-300 bg-against-500/10' : 'text-surface-500 bg-surface-200/60'
              )}>
                {data.days_to_close}d to close
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Six risk dimensions ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 px-1">
            <Layers className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Risk Dimensions</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <AnimatePresence>
              {data.dimensions.map((dim, i) => (
                <motion.div
                  key={dim.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <DimensionCard dim={dim} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Active risk signals ── */}
        {data.risk_signals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2 px-1">
              <AlertTriangle className="h-4 w-4 text-against-400" />
              <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
                Active Risk Signals
              </h2>
              <span className="ml-auto text-xs font-mono text-surface-600">{data.risk_signals.length} flagged</span>
            </div>
            <div className="space-y-2">
              {data.risk_signals.map(s => (
                <SignalCard key={s.id} signal={s} />
              ))}
            </div>
          </motion.div>
        )}

        {/* No signals state */}
        {data.risk_signals.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-emerald/5 border border-emerald/20"
          >
            <ShieldCheck className="h-5 w-5 text-emerald flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald">No Active Risk Signals</p>
              <p className="text-xs text-surface-500 mt-0.5">This market is currently showing healthy indicators across all dimensions.</p>
            </div>
          </motion.div>
        )}

        {/* ── Coalition positions ── */}
        {(data.coalition_sides.for.length > 0 || data.coalition_sides.against.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-semibold text-surface-400">Coalition Positions</h2>
              <Link
                href={`/exchange/${id}/coalitions`}
                className="ml-auto flex items-center gap-1 text-xs text-for-400 hover:text-for-300 transition-colors"
              >
                All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* FOR column */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-for-400 uppercase tracking-wider mb-2">
                  For ({data.coalition_sides.for.length})
                </div>
                {data.coalition_sides.for.slice(0, 4).map(c => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-for-400 flex-shrink-0" />
                    <span className="text-surface-300 truncate">{c.name}</span>
                    <span className="text-surface-600 font-mono ml-auto flex-shrink-0">{c.member_count}</span>
                  </div>
                ))}
                {data.coalition_sides.for.length > 4 && (
                  <p className="text-[10px] text-surface-600 font-mono">+{data.coalition_sides.for.length - 4} more</p>
                )}
                {data.coalition_sides.for.length === 0 && (
                  <p className="text-[10px] text-surface-600 italic">None declared</p>
                )}
              </div>

              {/* AGAINST column */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-against-400 uppercase tracking-wider mb-2">
                  Against ({data.coalition_sides.against.length})
                </div>
                {data.coalition_sides.against.slice(0, 4).map(c => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-against-400 flex-shrink-0" />
                    <span className="text-surface-300 truncate">{c.name}</span>
                    <span className="text-surface-600 font-mono ml-auto flex-shrink-0">{c.member_count}</span>
                  </div>
                ))}
                {data.coalition_sides.against.length > 4 && (
                  <p className="text-[10px] text-surface-600 font-mono">+{data.coalition_sides.against.length - 4} more</p>
                )}
                {data.coalition_sides.against.length === 0 && (
                  <p className="text-[10px] text-surface-600 italic">None declared</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Argument balance ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-semibold text-surface-400">Argument Balance vs Price</h2>
          </div>

          <div className="space-y-2">
            {/* Price bar */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-surface-500 mb-1">
                <span>Market Price</span>
                <span className={priceColor(data.price, data.status)}>{data.price}¢</span>
              </div>
              <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', data.price >= 55 ? 'bg-for-400' : data.price <= 45 ? 'bg-against-400' : 'bg-surface-500')}
                  style={{ width: `${data.price}%` }}
                />
              </div>
            </div>

            {/* Argument balance bar */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-surface-500 mb-1">
                <span>Argument Quality</span>
                <span className={data.argument_balance >= 55 ? 'text-for-400' : data.argument_balance <= 45 ? 'text-against-400' : 'text-surface-400'}>
                  {data.argument_balance}% FOR
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
                <div
                  className={cn('h-full rounded-full', data.argument_balance >= 55 ? 'bg-for-500/60' : data.argument_balance <= 45 ? 'bg-against-500/60' : 'bg-surface-400/60')}
                  style={{ width: `${data.argument_balance}%` }}
                />
              </div>
            </div>

            {Math.abs(data.price - data.argument_balance) >= 15 && (
              <p className="text-xs text-gold mt-2">
                {Math.abs(data.price - data.argument_balance)}¢ gap between price and argument quality — potential mean reversion signal
              </p>
            )}
          </div>
        </motion.div>

        {/* ── Nav to related pages ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: `/exchange/${id}`,           icon: BarChart2, label: 'Price Chart'  },
              { href: `/exchange/${id}/signal`,     icon: Zap,       label: 'Signal'       },
              { href: `/exchange/${id}/catalysts`,  icon: Flame,     label: 'Catalysts'    },
              { href: `/exchange/${id}/coalitions`, icon: Users,     label: 'Coalitions'   },
              { href: `/exchange/${id}/depth`,      icon: Layers,    label: 'Depth'        },
              { href: `/exchange/${id}/analysis`,   icon: BarChart2, label: 'Analysis'     },
            ].map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-surface-500 hover:text-white"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs font-medium truncate">{label}</span>
                <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0 opacity-50" />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Timestamp */}
        <p className="text-center text-[10px] text-surface-700 font-mono pb-2">
          Analysis as of {relTime(data.as_of)}
        </p>

      </main>
      <BottomNav />
    </div>
  )
}
