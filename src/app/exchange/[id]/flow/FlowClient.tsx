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
  ChevronRight,
  Gavel,
  Minus,
  RefreshCw,
  Scale,
  Sparkles,
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
import type {
  MarketFlowData,
  FlowBucket,
  FlowCohort,
  FlowLabel,
  ArgumentFlowBucket,
} from '@/app/api/exchange/[id]/flow/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 60_000

const FLOW_CONFIG: Record<FlowLabel, {
  label: string
  color: string
  bg: string
  border: string
  icon: React.ComponentType<{ className?: string }>
  arrow: 'up' | 'down' | 'flat'
}> = {
  strong_bull: { label: 'Strong Bullish',  color: 'text-for-300',     bg: 'bg-for-500/15',     border: 'border-for-500/40',     icon: TrendingUp,   arrow: 'up'   },
  bull:        { label: 'Bullish',         color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: TrendingUp,   arrow: 'up'   },
  lean_bull:   { label: 'Lean Bullish',    color: 'text-for-500',     bg: 'bg-for-500/8',      border: 'border-for-500/20',     icon: ArrowUpRight, arrow: 'up'   },
  neutral:     { label: 'Neutral',         color: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30', icon: Minus,        arrow: 'flat' },
  lean_bear:   { label: 'Lean Bearish',    color: 'text-against-500', bg: 'bg-against-500/8',  border: 'border-against-500/20', icon: ArrowDownRight, arrow: 'down' },
  bear:        { label: 'Bearish',         color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: TrendingDown, arrow: 'down' },
  strong_bear: { label: 'Strong Bearish',  color: 'text-against-300', bg: 'bg-against-500/15', border: 'border-against-500/40', icon: TrendingDown, arrow: 'down' },
}

const COHORT_COLORS = {
  smart_money: { base: 'text-gold',     bg: 'bg-gold/10',     border: 'border-gold/30',     bar: 'bg-gold'     },
  experienced: { base: 'text-purple',   bg: 'bg-purple/10',   border: 'border-purple/30',   bar: 'bg-purple'   },
  retail:      { base: 'text-for-400',  bg: 'bg-for-500/10',  border: 'border-for-500/30',  bar: 'bg-for-500'  },
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

function signalColor(signal: string): string {
  if (signal === 'bullish') return 'text-for-400'
  if (signal === 'bearish') return 'text-against-400'
  return 'text-surface-400'
}

// ─── Flow Score Gauge ─────────────────────────────────────────────────────────

function FlowGauge({ score, label }: { score: number; label: FlowLabel }) {
  const cfg = FLOW_CONFIG[label]
  const r   = 44
  const circ = 2 * Math.PI * r
  const pct  = score / 100
  const dash = circ * pct
  const gradId = `flow-grad-${label}`

  // Determine stroke color by label
  const strokeClass =
    label === 'strong_bull' || label === 'bull'   ? '#3b82f6' :
    label === 'lean_bull'                          ? '#60a5fa' :
    label === 'lean_bear'                          ? '#f87171' :
    label === 'bear' || label === 'strong_bear'    ? '#ef4444' :
    '#6b7280'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg viewBox="0 0 110 110" className="w-36 h-36" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={strokeClass} stopOpacity="0.3" />
              <stop offset="100%" stopColor={strokeClass} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle cx="55" cy="55" r={r} fill="none" stroke="#1e2535" strokeWidth="10" />
          {/* Flow arc */}
          <circle
            cx="55" cy="55" r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ * 0.25}
            transform="rotate(-90 55 55)"
          />
          {/* Center text */}
          <text x="55" y="51" textAnchor="middle" fontSize="20" fontWeight="700" fill="white">
            {score}
          </text>
          <text x="55" y="66" textAnchor="middle" fontSize="9" fill="#6b7280">
            flow score
          </text>
        </svg>
      </div>
      <span className={cn('text-sm font-semibold', cfg.color)}>{cfg.label} Flow</span>
    </div>
  )
}

// ─── Vote Bar Chart ───────────────────────────────────────────────────────────

function VoteBars({ buckets, title }: { buckets: FlowBucket[]; title: string }) {
  const maxTotal = Math.max(...buckets.map((b) => b.total), 1)

  return (
    <div className="space-y-2">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">{title}</p>
      <div className="space-y-1.5">
        {buckets.map((b, i) => {
          const forW  = b.total > 0 ? (b.for_votes / maxTotal) * 100 : 0
          const agtW  = b.total > 0 ? (b.against_votes / maxTotal) * 100 : 0

          return (
            <div key={i} className="grid grid-cols-[56px_1fr_56px] gap-2 items-center">
              <span className="text-[11px] text-surface-500 text-right font-mono">{b.label}</span>
              <div className="relative h-5 bg-surface-300/30 rounded-full overflow-hidden">
                {/* FOR bar (left-to-right, blue) */}
                <motion.div
                  className="absolute left-0 top-0 h-full bg-for-500/70 rounded-l-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${forW}%` }}
                  transition={{ duration: 0.5, delay: i * 0.03 }}
                />
                {/* AGAINST bar (right-to-left, red) */}
                <motion.div
                  className="absolute right-0 top-0 h-full bg-against-500/70 rounded-r-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${agtW}%` }}
                  transition={{ duration: 0.5, delay: i * 0.03 + 0.05 }}
                />
                {/* Net flow indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-white/60">
                    {b.total > 0 ? `${b.for_votes}F · ${b.against_votes}A` : '—'}
                  </span>
                </div>
              </div>
              <span className={cn(
                'text-[11px] font-mono',
                b.net_flow > 0 ? 'text-for-400' : b.net_flow < 0 ? 'text-against-400' : 'text-surface-500',
              )}>
                {b.net_flow > 0 ? '+' : ''}{b.net_flow}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-for-500/70" />
          <span className="text-[11px] text-surface-500">For</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-against-500/70" />
          <span className="text-[11px] text-surface-500">Against</span>
        </div>
      </div>
    </div>
  )
}

// ─── Argument Bar Chart ───────────────────────────────────────────────────────

function ArgBars({ buckets }: { buckets: ArgumentFlowBucket[] }) {
  const maxTotal = Math.max(...buckets.map((b) => b.for_args + b.against_args), 1)

  return (
    <div className="space-y-2">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">Argument Flow (7d)</p>
      <div className="space-y-1.5">
        {buckets.map((b, i) => {
          const total = b.for_args + b.against_args
          const forW  = total > 0 ? (b.for_args / maxTotal) * 100 : 0
          const agtW  = total > 0 ? (b.against_args / maxTotal) * 100 : 0

          return (
            <div key={i} className="grid grid-cols-[56px_1fr_36px] gap-2 items-center">
              <span className="text-[11px] text-surface-500 text-right font-mono">{b.label}</span>
              <div className="relative h-4 bg-surface-300/30 rounded-full overflow-hidden">
                <motion.div
                  className="absolute left-0 top-0 h-full bg-for-500/50 rounded-l-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${forW}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                />
                <motion.div
                  className="absolute right-0 top-0 h-full bg-against-500/50 rounded-r-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${agtW}%` }}
                  transition={{ duration: 0.5, delay: i * 0.05 + 0.05 }}
                />
              </div>
              <span className={cn(
                'text-[10px] font-mono',
                total === 0 ? 'text-surface-600' : 'text-surface-400',
              )}>
                {total > 0 ? total : '—'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Cohort Card ──────────────────────────────────────────────────────────────

function CohortCard({ cohort }: { cohort: FlowCohort }) {
  const colors  = COHORT_COLORS[cohort.tier]
  const total   = cohort.for_votes + cohort.against_votes
  const forPct  = total > 0 ? Math.round((cohort.for_votes / total) * 100) : 50
  const agtPct  = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl p-4 border',
        colors.bg,
        colors.border,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={cn('text-sm font-semibold', colors.base)}>{cohort.label}</p>
          <p className="text-[11px] text-surface-500 mt-0.5">
            {cohort.min_clout > 0 ? `${cohort.min_clout}+ clout` : 'All users'}
          </p>
        </div>
        <span className={cn(
          'text-xs font-mono px-2 py-0.5 rounded-full border',
          cohort.signal === 'bullish' ? 'bg-for-500/10 text-for-400 border-for-500/30' :
          cohort.signal === 'bearish' ? 'bg-against-500/10 text-against-400 border-against-500/30' :
          'bg-surface-300/30 text-surface-400 border-surface-400/20',
        )}>
          {cohort.signal}
        </span>
      </div>

      <div className="h-2 bg-surface-400/20 rounded-full overflow-hidden mb-2">
        <motion.div
          className="h-full bg-for-500 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.6 }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400">{forPct}% For ({cohort.for_votes})</span>
        <span className="text-against-400">{agtPct}% Against ({cohort.against_votes})</span>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FlowClient({ topicId }: { topicId: string }) {
  const [data, setData]       = useState<MarketFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [refreshed, setRefreshed] = useState(false)
  const [view, setView]       = useState<'24h' | '7d'>('24h')

  const load = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshed(false)
      else setLoading(true)
      const res = await fetch(`/api/exchange/${topicId}/flow`)
      if (!res.ok) throw new Error('Failed to load flow data')
      const json: MarketFlowData = await res.json()
      setData(json)
      if (showRefresh) setRefreshed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
    const id = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
          <EmptyState
            icon={Activity}
            title="Flow data unavailable"
            description={error ?? 'Could not load market flow analysis.'}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const cfg = FLOW_CONFIG[data.flow_label]
  const StatusIcon = data.status === 'law' ? Gavel : data.status === 'voting' ? Scale : Zap
  const buckets    = view === '24h' ? data.recent_buckets : data.daily_buckets

  const accelLabel =
    data.accelerating_toward === 'for'
      ? 'Accelerating FOR'
      : data.accelerating_toward === 'against'
      ? 'Accelerating AGAINST'
      : 'Stable momentum'

  const divLabel =
    data.divergence_signal === 'flow_leads_price_up'
      ? 'Flow more bullish than price — may lead price higher'
      : data.divergence_signal === 'flow_leads_price_down'
      ? 'Flow more bearish than price — may pressure price lower'
      : 'Flow aligned with price'

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-5 pb-24">

        {/* ── Back + Header ── */}
        <div className="flex items-center gap-3">
          <Link
            href={`/exchange/${topicId}`}
            className="flex items-center gap-1.5 text-surface-500 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Market
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-surface-600" />
          <span className="text-sm text-surface-400">Flow Analysis</span>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <StatusIcon className={cn('w-4 h-4', data.status === 'law' ? 'text-gold' : 'text-surface-400')} />
            <Badge variant="outline" className="text-[10px]">
              {data.category ?? 'Market'}
            </Badge>
            {data.status === 'law' && (
              <Badge className="bg-gold/20 text-gold border-gold/30 text-[10px]">LAW</Badge>
            )}
          </div>
          <h1 className="text-base font-semibold text-white leading-snug line-clamp-2">
            {data.statement}
          </h1>
          <div className="flex items-center gap-3 mt-1.5">
            <span className={cn('text-lg font-bold font-mono', priceColor(data.price, data.status))}>
              {data.price}¢
            </span>
            <span className="text-xs text-surface-500">
              {data.total_votes.toLocaleString()} votes
            </span>
            <button
              onClick={() => load(true)}
              className="ml-auto flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('w-3 h-3', refreshed && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Flow Score ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('rounded-xl p-5 border', cfg.bg, cfg.border)}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-0.5">
                Market Flow Score
              </p>
              <p className={cn('text-xl font-bold', cfg.color)}>{data.flow_label_text}</p>
            </div>
            <FlowGauge score={data.flow_score} label={data.flow_label} />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-surface-400/20">
            <div className="text-center">
              <p className="text-[11px] text-surface-500 mb-0.5">24h Votes</p>
              <p className="text-sm font-semibold text-white">{data.recent_24h_votes.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-surface-500 mb-0.5">7d Votes</p>
              <p className="text-sm font-semibold text-white">{data.recent_7d_votes.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-[11px] text-surface-500 mb-0.5">Avg Clout</p>
              <p className="text-sm font-semibold text-white">{data.avg_voter_clout.toLocaleString()}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Acceleration + Divergence signals ── */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className={cn(
              'rounded-xl p-4 border',
              data.accelerating_toward === 'for'
                ? 'bg-for-500/8 border-for-500/25'
                : data.accelerating_toward === 'against'
                ? 'bg-against-500/8 border-against-500/25'
                : 'bg-surface-200/60 border-surface-300/60',
            )}
          >
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Momentum</p>
            <p className={cn(
              'text-sm font-semibold',
              data.accelerating_toward === 'for' ? 'text-for-400' :
              data.accelerating_toward === 'against' ? 'text-against-400' :
              'text-surface-400',
            )}>
              {accelLabel}
            </p>
            <p className="text-[11px] text-surface-500 mt-1">
              Net delta: {data.acceleration > 0 ? '+' : ''}{data.acceleration} votes
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={cn(
              'rounded-xl p-4 border',
              data.divergence_signal === 'flow_leads_price_up'
                ? 'bg-for-500/8 border-for-500/25'
                : data.divergence_signal === 'flow_leads_price_down'
                ? 'bg-against-500/8 border-against-500/25'
                : 'bg-surface-200/60 border-surface-300/60',
            )}
          >
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Price Divergence</p>
            <p className={cn(
              'text-sm font-semibold',
              data.divergence_signal === 'flow_leads_price_up' ? 'text-for-400' :
              data.divergence_signal === 'flow_leads_price_down' ? 'text-against-400' :
              'text-surface-400',
            )}>
              {data.price_vs_flow_divergence > 0 ? '+' : ''}{data.price_vs_flow_divergence}¢
            </p>
            <p className="text-[11px] text-surface-500 mt-1 line-clamp-2">{divLabel}</p>
          </motion.div>
        </div>

        {/* ── Vote Velocity Chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl p-5 bg-surface-200/60 border border-surface-300/60"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-surface-400" />
              <p className="text-sm font-semibold text-white">Vote Velocity</p>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-surface-400/30">
              {(['24h', '7d'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-3 py-1 text-[11px] font-mono transition-colors',
                    view === v
                      ? 'bg-surface-400/30 text-white'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <VoteBars
                buckets={buckets}
                title={view === '24h' ? 'Last 24 hours (4h buckets)' : 'Last 7 days (daily)'}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* ── Clout Cohorts ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-surface-400" />
            <p className="text-sm font-semibold text-white">Flow by Cohort</p>
            {data.smart_money_vs_retail !== 0 && (
              <span className={cn(
                'ml-auto text-[11px] font-mono px-2 py-0.5 rounded-full border',
                data.smart_money_vs_retail > 5
                  ? 'bg-gold/10 text-gold border-gold/30'
                  : data.smart_money_vs_retail < -5
                  ? 'bg-against-500/10 text-against-400 border-against-500/30'
                  : 'bg-surface-300/30 text-surface-500 border-surface-400/20',
              )}>
                SM vs Retail: {data.smart_money_vs_retail > 0 ? '+' : ''}{data.smart_money_vs_retail}%
              </span>
            )}
          </div>
          {data.cohorts.map((c) => (
            <CohortCard key={c.tier} cohort={c} />
          ))}
        </motion.div>

        {/* ── Argument Flow ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl p-5 bg-surface-200/60 border border-surface-300/60"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-surface-400" />
              <p className="text-sm font-semibold text-white">Argument Momentum</p>
            </div>
            <span className={cn(
              'text-[11px] font-mono px-2 py-0.5 rounded-full border',
              data.arg_flow_edge === 'for'
                ? 'bg-for-500/10 text-for-400 border-for-500/30'
                : data.arg_flow_edge === 'against'
                ? 'bg-against-500/10 text-against-400 border-against-500/30'
                : 'bg-surface-300/30 text-surface-500 border-surface-400/20',
            )}>
              {data.arg_flow_edge === 'balanced' ? 'balanced' : `${data.arg_flow_edge} edge`}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-lg p-3 bg-for-500/8 border border-for-500/20 text-center">
              <p className="text-[10px] text-surface-500 mb-0.5">FOR Arguments</p>
              <p className="text-lg font-bold text-for-400">{data.total_for_args}</p>
            </div>
            <div className="rounded-lg p-3 bg-against-500/8 border border-against-500/20 text-center">
              <p className="text-[10px] text-surface-500 mb-0.5">AGAINST Arguments</p>
              <p className="text-lg font-bold text-against-400">{data.total_against_args}</p>
            </div>
          </div>

          <ArgBars buckets={data.argument_buckets} />
        </motion.div>

        {/* ── Smart Money Summary ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl p-5 bg-surface-200/60 border border-surface-300/60"
        >
          <p className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-surface-400" />
            Flow Summary
          </p>
          <div className="space-y-2.5">
            {[
              { label: 'Overall Price',       value: `${data.price}¢`,                  color: priceColor(data.price, data.status)       },
              { label: 'Flow Score',          value: `${data.flow_score} / 100`,          color: cfg.color                                  },
              { label: 'Smart Money Signal',  value: data.smart_money_signal,             color: signalColor(data.smart_money_signal)       },
              { label: 'Retail Signal',       value: data.retail_signal,                  color: signalColor(data.retail_signal)            },
              { label: 'SM vs Retail Delta',  value: `${data.smart_money_vs_retail > 0 ? '+' : ''}${data.smart_money_vs_retail}%`, color: data.smart_money_vs_retail > 5 ? 'text-gold' : data.smart_money_vs_retail < -5 ? 'text-against-400' : 'text-surface-400' },
              { label: 'Momentum Direction',  value: accelLabel,                          color: data.accelerating_toward === 'for' ? 'text-for-400' : data.accelerating_toward === 'against' ? 'text-against-400' : 'text-surface-400' },
              { label: 'Argument Edge',       value: data.arg_flow_edge,                  color: data.arg_flow_edge === 'for' ? 'text-for-400' : data.arg_flow_edge === 'against' ? 'text-against-400' : 'text-surface-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-surface-500">{label}</span>
                <span className={cn('text-xs font-semibold capitalize', color)}>{value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Links to related pages ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-xl p-4 bg-surface-200/60 border border-surface-300/60"
        >
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">Related Analysis</p>
          <div className="space-y-2">
            {[
              { href: `/exchange/${topicId}/traders`,  label: 'Top Traders',      desc: 'Who holds FOR / AGAINST positions'      },
              { href: `/exchange/${topicId}/momentum`, label: 'Price Momentum',   desc: 'Velocity, acceleration, phase analysis'  },
              { href: `/exchange/${topicId}/sentiment`,label: 'Sentiment',        desc: 'Role breakdown and commentary direction' },
              { href: `/exchange/${topicId}/volatility`,label: 'Volatility',      desc: 'Std dev, drawdown, trend consistency'    },
            ].map(({ href, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-300/30 transition-colors group"
              >
                <div>
                  <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">{label}</p>
                  <p className="text-[10px] text-surface-500">{desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
              </Link>
            ))}
          </div>
        </motion.div>

        <p className="text-center text-[10px] text-surface-600 font-mono">
          Updated {relTime(data.as_of)}
        </p>
      </main>
      <BottomNav />
    </div>
  )
}
