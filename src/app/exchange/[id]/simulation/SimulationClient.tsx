'use client'

/**
 * /exchange/[id]/simulation
 *
 * Interactive what-if simulator for civic prediction markets.
 *
 * Users adjust sliders to inject hypothetical FOR/AGAINST votes, alter vote
 * velocity, and dial in debate quality. The page instantly recalculates:
 *   - Simulated consensus price (blue_pct after hypothetical changes)
 *   - Probability of each outcome (law / voting / contested / failed)
 *   - Votes still needed to cross the law threshold (80% FOR)
 *   - Law or fail distance in percentage points
 *
 * No API call is needed — all math runs client-side from the seed data
 * passed in from the server component.
 */

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Gavel,
  GitMerge,
  Info,
  Minus,
  Plus,
  RefreshCw,
  Scale,
  Sliders,
  Sparkles,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  id: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

interface SimState {
  forInjection: number   // additional FOR votes (0–100 000)
  againstInjection: number
  velocityMultiplier: number  // 0.5 – 3.0 (current daily-vote-rate factor)
  debateBoost: number         // –2 to +2 (quality bias on the FOR side)
}

interface Outcome {
  label: string
  probability: number
  color: string
  bg: string
  border: string
  icon: typeof Gavel
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAW_THRESHOLD     = 80   // ≥ 80% FOR → likely law
const VOTING_THRESHOLD  = 60   // ≥ 60% FOR → heading to voting
const FAIL_THRESHOLD    = 35   // ≤ 35% FOR → likely to fail

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active:   'Active',
  voting:   'Voting',
  law:      'LAW',
  failed:   'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function priceColor(pct: number): string {
  if (pct >= LAW_THRESHOLD)  return 'text-gold'
  if (pct >= VOTING_THRESHOLD) return 'text-for-400'
  if (pct <= FAIL_THRESHOLD) return 'text-against-400'
  return 'text-surface-300'
}

function priceBg(pct: number): string {
  if (pct >= LAW_THRESHOLD)  return 'from-gold/20 to-gold/5'
  if (pct >= VOTING_THRESHOLD) return 'from-for-500/20 to-for-500/5'
  if (pct <= FAIL_THRESHOLD) return 'from-against-500/20 to-against-500/5'
  return 'from-surface-300/20 to-surface-300/5'
}

function priceBorder(pct: number): string {
  if (pct >= LAW_THRESHOLD)  return 'border-gold/40'
  if (pct >= VOTING_THRESHOLD) return 'border-for-500/40'
  if (pct <= FAIL_THRESHOLD) return 'border-against-500/40'
  return 'border-surface-400/40'
}

/**
 * Core simulation math.
 *
 * The "debate boost" is treated as an additive bias on the FOR ratio.
 * Each +1 boost point represents roughly 2% shift in the FOR direction
 * from increased argument quality attracting undecided voters.
 *
 * The "velocity multiplier" affects the simulated additional organic
 * votes that would accumulate over the next 30 days.
 */
function computeSimulatedPrice(
  totalVotes: number,
  bluePct: number,
  sim: SimState,
): { simPct: number; simForVotes: number; simAgainstVotes: number; simTotal: number } {
  const baseFor = Math.round((bluePct / 100) * totalVotes)
  const baseAgainst = totalVotes - baseFor

  // Debate-quality bias: each point shifts ~2% of the base votes
  const biasShift = Math.round(sim.debateBoost * 0.02 * totalVotes)

  // Projected organic votes from velocity (30-day window)
  const avgDailyVotes = Math.max(1, totalVotes / 30)
  const organicVotes = Math.round(avgDailyVotes * 30 * (sim.velocityMultiplier - 1))
  const organicFor   = Math.round(organicVotes * (bluePct / 100))
  const organicAgainst = organicVotes - organicFor

  const simFor      = Math.max(0, baseFor + biasShift + sim.forInjection + organicFor)
  const simAgainst  = Math.max(0, baseAgainst - biasShift + sim.againstInjection + organicAgainst)
  const simTotal    = simFor + simAgainst

  const simPct = simTotal === 0 ? 50 : Math.min(100, Math.max(0, Math.round((simFor / simTotal) * 100)))

  return { simPct, simForVotes: simFor, simAgainstVotes: simAgainst, simTotal }
}

/**
 * Calculates outcome probabilities based on the simulated price.
 * Uses a fuzzy probability model centred on threshold boundaries.
 */
function computeOutcomes(simPct: number, status: string): Outcome[] {
  if (status === 'law') {
    return [
      { label: 'Established Law', probability: 100, color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30', icon: Gavel },
    ]
  }
  if (status === 'failed') {
    return [
      { label: 'Failed', probability: 100, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: XCircle },
    ]
  }

  // Fuzzy sigmoid-based probabilities
  const sigmoid = (x: number, mid: number, steep: number) =>
    Math.round(100 / (1 + Math.exp(-steep * (x - mid))))

  const lawProb      = sigmoid(simPct, LAW_THRESHOLD, 0.25)
  const failProb     = sigmoid(100 - simPct, 100 - FAIL_THRESHOLD, 0.25)
  const votingProb   = Math.max(0, sigmoid(simPct, VOTING_THRESHOLD, 0.2) - lawProb)
  const contestedProb = Math.max(0, 100 - lawProb - failProb - votingProb)

  return [
    { label: 'Becomes Law',  probability: lawProb,       color: 'text-gold',       bg: 'bg-gold/10',        border: 'border-gold/30',        icon: Gavel },
    { label: 'Goes to Vote', probability: votingProb,    color: 'text-for-400',    bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: ThumbsUp },
    { label: 'Contested',    probability: contestedProb, color: 'text-purple',     bg: 'bg-purple/10',      border: 'border-purple/30',      icon: GitMerge },
    { label: 'Fails',        probability: failProb,      color: 'text-against-400',bg: 'bg-against-500/10', border: 'border-against-500/30', icon: XCircle },
  ].sort((a, b) => b.probability - a.probability)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  format,
  onChange,
  colorClass,
}: {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  colorClass?: string
}) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="py-3 border-b border-surface-300/60 last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <span className="text-sm font-medium text-white">{label}</span>
          <p className="text-xs text-surface-500 mt-0.5">{description}</p>
        </div>
        <span className={cn('text-sm font-mono font-bold tabular-nums', colorClass ?? 'text-surface-300')}>
          {format(value)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          aria-label="Decrease"
          className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-md bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40"
        >
          <Minus className="h-3 w-3" />
        </button>
        <div className="relative flex-1 h-1.5 rounded-full bg-surface-300">
          <div
            className={cn('absolute left-0 h-1.5 rounded-full transition-all', colorClass ? colorClass.replace('text-', 'bg-') : 'bg-for-500')}
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label={label}
          />
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          aria-label="Increase"
          className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-md bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

function PriceMeter({ current, simulated }: { current: number; simulated: number }) {
  const delta = simulated - current
  const positive = delta > 0

  return (
    <div className="relative h-3 rounded-full bg-surface-300/60 overflow-hidden">
      {/* Baseline bar */}
      <div
        className="absolute left-0 h-full bg-for-700/60 rounded-full transition-all duration-500"
        style={{ width: `${current}%` }}
      />
      {/* Simulated extension / retraction */}
      {positive ? (
        <div
          className="absolute h-full bg-for-500 rounded-full transition-all duration-500"
          style={{ left: `${current}%`, width: `${Math.min(100 - current, delta)}%` }}
        />
      ) : (
        <div
          className="absolute h-full bg-against-600 rounded-full transition-all duration-500"
          style={{ left: `${simulated}%`, width: `${Math.abs(delta)}%` }}
        />
      )}
      {/* Law threshold marker */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-gold/60"
        style={{ left: `${LAW_THRESHOLD}%` }}
        title="Law threshold (80%)"
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_SIM: SimState = {
  forInjection:       0,
  againstInjection:   0,
  velocityMultiplier: 1.0,
  debateBoost:        0,
}

export function SimulationClient({
  id,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: Props) {
  const [sim, setSim] = useState<SimState>(DEFAULT_SIM)
  const isResolved = status === 'law' || status === 'failed'

  const update = useCallback(<K extends keyof SimState>(key: K, value: SimState[K]) => {
    setSim((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => setSim(DEFAULT_SIM), [])

  const { simPct, simForVotes, simAgainstVotes, simTotal } = useMemo(
    () => computeSimulatedPrice(totalVotes, bluePct, sim),
    [totalVotes, bluePct, sim]
  )

  const outcomes = useMemo(() => computeOutcomes(simPct, status), [simPct, status])
  const delta = simPct - Math.round(bluePct)
  const lawGap   = Math.max(0, LAW_THRESHOLD - simPct)

  const votesToLaw  = Math.round((LAW_THRESHOLD / 100 * simTotal) - simForVotes)
  const isDirty     = sim.forInjection !== 0 || sim.againstInjection !== 0
    || sim.velocityMultiplier !== 1 || sim.debateBoost !== 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to market"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple/10 border border-purple/30">
                <Sliders className="h-3 w-3 text-purple" />
                <span className="text-[10px] font-mono font-semibold text-purple uppercase tracking-wider">Simulator</span>
              </div>
              {category && (
                <Badge variant="proposed" className="text-[10px]">{category}</Badge>
              )}
              <Badge variant={STATUS_BADGE[status] ?? 'proposed'}>
                {STATUS_LABEL[status] ?? status}
              </Badge>
            </div>
            <h1 className="text-base font-semibold text-white leading-snug line-clamp-2">
              {statement}
            </h1>
          </div>
        </div>

        {/* Price comparison bar */}
        <div className={cn(
          'rounded-2xl border p-5 mb-4 bg-gradient-to-br',
          priceBg(simPct),
          priceBorder(simPct),
        )}>
          <div className="flex items-start gap-4 mb-4">
            {/* Current price */}
            <div className="flex-1">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">Current</p>
              <p className="text-3xl font-bold font-mono text-surface-400 tabular-nums">
                {Math.round(bluePct)}¢
              </p>
              <p className="text-xs text-surface-500 mt-0.5">{fmtVotes(totalVotes)} votes</p>
            </div>

            {/* Arrow */}
            <div className="flex items-center self-center">
              <ArrowRight className={cn('h-5 w-5', delta > 0 ? 'text-for-400' : delta < 0 ? 'text-against-400' : 'text-surface-600')} />
            </div>

            {/* Simulated price */}
            <div className="flex-1 text-right">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-0.5">Simulated</p>
              <motion.p
                key={simPct}
                initial={{ scale: 0.9, opacity: 0.7 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className={cn('text-3xl font-bold font-mono tabular-nums', priceColor(simPct))}
              >
                {simPct}¢
              </motion.p>
              <p className="text-xs text-surface-500 mt-0.5">{fmtVotes(simTotal)} total</p>
            </div>
          </div>

          {/* Progress bar */}
          <PriceMeter current={Math.round(bluePct)} simulated={simPct} />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] font-mono text-against-400">0¢</span>
            <span className="text-[10px] font-mono text-gold">{LAW_THRESHOLD}¢ law</span>
            <span className="text-[10px] font-mono text-for-400">100¢</span>
          </div>

          {/* Delta badge */}
          {isDirty && (
            <div className="flex items-center gap-2 mt-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={delta}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold',
                    delta > 0
                      ? 'bg-for-500/20 border border-for-500/40 text-for-300'
                      : delta < 0
                      ? 'bg-against-500/20 border border-against-500/40 text-against-300'
                      : 'bg-surface-300/20 border border-surface-400/40 text-surface-400'
                  )}
                >
                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                  {delta > 0 ? '+' : ''}{delta}¢ from baseline
                </motion.div>
              </AnimatePresence>
              {!isResolved && lawGap > 0 && (
                <span className="text-[11px] font-mono text-surface-500">
                  {lawGap}¢ from law threshold
                </span>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        {!isResolved ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 px-5 py-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                  <Sliders className="h-3.5 w-3.5 text-surface-500" />
                </div>
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  Simulation Controls
                </h2>
              </div>
              {isDirty && (
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/40"
                  aria-label="Reset all controls to default"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reset
                </button>
              )}
            </div>

            <SliderRow
              label="Inject FOR votes"
              description="Simulate additional votes in favour of this topic"
              value={sim.forInjection}
              min={0}
              max={100_000}
              step={1_000}
              format={(v) => v === 0 ? '—' : `+${fmtVotes(v)}`}
              onChange={(v) => update('forInjection', v)}
              colorClass="text-for-400"
            />
            <SliderRow
              label="Inject AGAINST votes"
              description="Simulate additional votes opposing this topic"
              value={sim.againstInjection}
              min={0}
              max={100_000}
              step={1_000}
              format={(v) => v === 0 ? '—' : `+${fmtVotes(v)}`}
              onChange={(v) => update('againstInjection', v)}
              colorClass="text-against-400"
            />
            <SliderRow
              label="Vote velocity"
              description="Multiplier on the organic daily vote rate (30-day window)"
              value={sim.velocityMultiplier}
              min={0.5}
              max={3.0}
              step={0.1}
              format={(v) => `${v.toFixed(1)}×`}
              onChange={(v) => update('velocityMultiplier', v)}
              colorClass="text-purple"
            />
            <SliderRow
              label="Debate quality bias"
              description="How much a high-quality debate shifts undecided voters FOR (+) or AGAINST (−)"
              value={sim.debateBoost}
              min={-2}
              max={2}
              step={0.5}
              format={(v) => v === 0 ? 'Neutral' : v > 0 ? `+${v} FOR bias` : `${v} vs bias`}
              onChange={(v) => update('debateBoost', v)}
              colorClass={sim.debateBoost >= 0 ? 'text-for-400' : 'text-against-400'}
            />
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">
            <div className="flex items-center gap-2 text-xs text-surface-500 font-mono">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                This market has already resolved as <strong className="text-white">{STATUS_LABEL[status]}</strong>.
                Controls are disabled — outcomes are final.
              </span>
            </div>
          </div>
        )}

        {/* Outcome probabilities */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 px-5 py-4 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
              <BarChart2 className="h-3.5 w-3.5 text-surface-500" />
            </div>
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
              Outcome Probabilities
            </h2>
            {isDirty && (
              <span className="ml-auto text-[10px] font-mono text-purple bg-purple/10 border border-purple/30 px-2 py-0.5 rounded-full">
                Simulated
              </span>
            )}
          </div>

          <div className="space-y-3">
            {outcomes.map((o) => (
              <div key={o.label}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <o.icon className={cn('h-3.5 w-3.5', o.color)} />
                    <span className="text-xs font-medium text-surface-300">{o.label}</span>
                  </div>
                  <span className={cn('text-sm font-mono font-bold tabular-nums', o.color)}>
                    {o.probability}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
                  <motion.div
                    key={`${o.label}-${o.probability}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${o.probability}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className={cn('h-full rounded-full', o.bg.replace('bg-', 'bg-').replace('/10', ''))}
                    style={{ backgroundImage: `linear-gradient(90deg, var(--tw-gradient-from), var(--tw-gradient-to))` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vote math */}
        {!isResolved && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 px-5 py-4 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200">
                <Scale className="h-3.5 w-3.5 text-surface-500" />
              </div>
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                Vote Math
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/* Simulated FOR */}
              <div className="rounded-xl bg-for-500/10 border border-for-500/30 p-3">
                <p className="text-[10px] font-mono text-for-400 uppercase tracking-wider mb-1">
                  FOR (sim)
                </p>
                <p className="text-xl font-bold font-mono text-for-300 tabular-nums">
                  {fmtVotes(simForVotes)}
                </p>
                <p className="text-[10px] text-surface-500 mt-0.5">
                  {simTotal > 0 ? Math.round((simForVotes / simTotal) * 100) : 0}% of total
                </p>
              </div>

              {/* Simulated AGAINST */}
              <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-3">
                <p className="text-[10px] font-mono text-against-400 uppercase tracking-wider mb-1">
                  AGAINST (sim)
                </p>
                <p className="text-xl font-bold font-mono text-against-300 tabular-nums">
                  {fmtVotes(simAgainstVotes)}
                </p>
                <p className="text-[10px] text-surface-500 mt-0.5">
                  {simTotal > 0 ? Math.round((simAgainstVotes / simTotal) * 100) : 0}% of total
                </p>
              </div>

              {/* Votes to law */}
              {votesToLaw > 0 ? (
                <div className="rounded-xl bg-gold/10 border border-gold/30 p-3">
                  <p className="text-[10px] font-mono text-gold uppercase tracking-wider mb-1">
                    To reach law
                  </p>
                  <p className="text-xl font-bold font-mono text-gold tabular-nums">
                    {fmtVotes(votesToLaw)}
                  </p>
                  <p className="text-[10px] text-surface-500 mt-0.5">more FOR votes needed</p>
                </div>
              ) : (
                <div className="rounded-xl bg-gold/10 border border-gold/30 p-3">
                  <p className="text-[10px] font-mono text-gold uppercase tracking-wider mb-1">
                    Law threshold
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Gavel className="h-4 w-4 text-gold" />
                    <p className="text-sm font-bold text-gold">Crossed</p>
                  </div>
                  <p className="text-[10px] text-surface-500 mt-0.5">≥{LAW_THRESHOLD}% FOR reached</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Insight strip */}
        {isDirty && !isResolved && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-purple/10 border border-purple/30 px-5 py-4 mb-4"
          >
            <div className="flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-purple mb-1">Simulation Insight</p>
                <p className="text-xs text-surface-400 leading-relaxed">
                  {simPct >= LAW_THRESHOLD
                    ? `Under these conditions the market reaches the law threshold at ${simPct}¢ — a ${delta > 0 ? '+' : ''}${delta}¢ move. The FOR side would need to sustain this momentum through the voting phase.`
                    : simPct <= FAIL_THRESHOLD
                    ? `At ${simPct}¢ the market is heading toward failure. The FOR side would need ${fmtVotes(votesToLaw + (simTotal - Math.round(LAW_THRESHOLD / 100 * simTotal)))} additional votes to reverse course.`
                    : simPct >= VOTING_THRESHOLD
                    ? `At ${simPct}¢ the topic enters the voting zone — ${fmtVotes(votesToLaw)} more FOR votes would push it across the law threshold at ${LAW_THRESHOLD}¢.`
                    : `The market stays contested at ${simPct}¢. With ${fmtVotes(votesToLaw)} more FOR votes the market could reach the law threshold.`
                  }
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Nav links */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 divide-y divide-surface-300">
          {[
            { href: `/exchange/${id}/scenarios`, label: 'View all market scenarios', icon: BarChart2 },
            { href: `/exchange/${id}/risk`,      label: 'Risk analysis',              icon: Scale },
            { href: `/exchange/${id}/forecast`,  label: 'Price forecast',             icon: TrendingUp },
            { href: `/topic/${id}`,              label: 'Back to topic',              icon: ExternalLink },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-200/50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
                <span className="text-sm text-surface-400 group-hover:text-white transition-colors">{label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
