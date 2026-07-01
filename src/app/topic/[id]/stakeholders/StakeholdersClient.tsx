'use client'

/**
 * /topic/[id]/stakeholders — Stakeholder Map
 *
 * Shows which real-world groups have a stake in this debate:
 *   • Their power level (High / Medium / Low)
 *   • Their likely stance (strongly for ↔ strongly against)
 *   • What they stand to gain or lose if the debate passes
 *   • Relevant arguments from the debate
 *
 * Distinct from:
 *   /topic/[id]/breakdown  — voter demographic cohorts
 *   /topic/[id]/versus     — best FOR vs AGAINST arguments
 *   /topic/[id]/ripple     — cascade impact on other laws/topics
 *   /topic/[id]/impact     — argument-level impact scores
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Info,
  MessageSquare,
  RefreshCw,
  Shield,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  StakeholdersResponse,
  StakeholderGroup,
  StakeholderStance,
  StakeholderPower,
} from '@/app/api/topics/[id]/stakeholders/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const STANCE_CONFIG: Record<
  StakeholderStance,
  { label: string; short: string; color: string; bg: string; border: string; icon: typeof ThumbsUp }
> = {
  strongly_for:      { label: 'Strongly For',      short: 'For',     color: 'text-for-300',     bg: 'bg-for-500/15',     border: 'border-for-500/40',     icon: ThumbsUp },
  leaning_for:       { label: 'Leaning For',        short: 'Lean For',color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     icon: TrendingUp },
  neutral:           { label: 'Neutral / Mixed',    short: 'Neutral', color: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-300/50', icon: BarChart2 },
  leaning_against:   { label: 'Leaning Against',   short: 'Lean Ag.', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', icon: TrendingDown },
  strongly_against:  { label: 'Strongly Against',  short: 'Against', color: 'text-against-300',  bg: 'bg-against-500/15', border: 'border-against-500/40',  icon: ThumbsDown },
}

const POWER_CONFIG: Record<StakeholderPower, { label: string; color: string; bg: string; dots: number }> = {
  high:   { label: 'High Power',   color: 'text-gold',         bg: 'bg-gold/10',    dots: 3 },
  medium: { label: 'Medium Power', color: 'text-purple',       bg: 'bg-purple/10',  dots: 2 },
  low:    { label: 'Low Power',    color: 'text-surface-400',  bg: 'bg-surface-300/40', dots: 1 },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PowerDots({ power }: { power: StakeholderPower }) {
  const cfg = POWER_CONFIG[power]
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            'h-2 w-2 rounded-full transition-colors',
            i <= cfg.dots ? cfg.color.replace('text-', 'bg-') : 'bg-surface-300',
          )}
        />
      ))}
    </div>
  )
}

function StancePill({ stance }: { stance: StakeholderStance }) {
  const cfg = STANCE_CONFIG[stance]
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wide',
        cfg.bg,
        cfg.color,
        'border',
        cfg.border,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.short}
    </span>
  )
}

function StakeholderCard({ group, idx }: { group: StakeholderGroup; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const stanceCfg = STANCE_CONFIG[group.stance]
  const powerCfg  = POWER_CONFIG[group.power]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={cn(
        'rounded-2xl border bg-surface-100 transition-colors overflow-hidden',
        stanceCfg.border,
      )}
    >
      {/* Header */}
      <div className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Users className={cn('h-4 w-4 flex-shrink-0', stanceCfg.color)} />
              <h3 className="text-sm font-semibold text-white truncate">{group.name}</h3>
            </div>
            <p className="text-xs text-surface-500 leading-relaxed">{group.description}</p>
          </div>
          <StancePill stance={group.stance} />
        </div>

        {/* Power + stake bar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <PowerDots power={group.power} />
            <span className={cn('text-[11px] font-mono font-medium', powerCfg.color)}>
              {powerCfg.label}
            </span>
          </div>
          <span className="text-surface-600 text-[10px]">·</span>
          <span className="text-[11px] text-surface-500 font-mono">{group.affected_count_est} affected</span>
        </div>

        {/* Stake bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Stake Level</span>
            <span className={cn('text-[11px] font-mono font-bold', stanceCfg.color)}>{group.stake_level}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', stanceCfg.color.replace('text-', 'bg-'))}
              initial={{ width: 0 }}
              animate={{ width: `${group.stake_level}%` }}
              transition={{ duration: 0.6, delay: idx * 0.05 + 0.2 }}
            />
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Less detail' : 'More detail'}
        </button>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300/60 p-4 space-y-4">
              {/* Key interests */}
              <div>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-2">Key Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.key_interests.map((interest) => (
                    <span
                      key={interest}
                      className="px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300 text-[10px] font-mono text-surface-400"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>

              {/* If passes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-for-500/8 border border-for-500/20 p-3">
                  <p className="text-[10px] font-mono text-for-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" /> If Passes
                  </p>
                  <ul className="space-y-1">
                    {group.gains.slice(0, 2).map((g) => (
                      <li key={g} className="text-[11px] text-for-300 leading-relaxed">+ {g}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl bg-against-500/8 border border-against-500/20 p-3">
                  <p className="text-[10px] font-mono text-against-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <ThumbsDown className="h-3 w-3" /> If Fails
                  </p>
                  <ul className="space-y-1">
                    {group.losses.slice(0, 2).map((l) => (
                      <li key={l} className="text-[11px] text-against-300 leading-relaxed">− {l}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Top arguments */}
              {group.top_arguments.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> Relevant Arguments
                  </p>
                  <div className="space-y-2">
                    {group.top_arguments.map((arg) => (
                      <div
                        key={arg.id}
                        className={cn(
                          'rounded-lg p-2.5 border text-[11px] leading-relaxed',
                          arg.side === 'for'
                            ? 'bg-for-500/8 border-for-500/20 text-for-200'
                            : 'bg-against-500/8 border-against-500/20 text-against-200',
                        )}
                      >
                        <span className={cn('font-mono font-semibold text-[10px] mr-1', arg.side === 'for' ? 'text-for-400' : 'text-against-400')}>
                          {arg.side === 'for' ? 'FOR' : 'AGAINST'}
                        </span>
                        {arg.body}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Balance bar ──────────────────────────────────────────────────────────────

function BalanceBar({ balance, stakeholders }: { balance: number; stakeholders: StakeholderGroup[] }) {
  const forCount = stakeholders.filter((s) => s.stance === 'strongly_for' || s.stance === 'leaning_for').length
  const againstCount = stakeholders.filter((s) => s.stance === 'strongly_against' || s.stance === 'leaning_against').length
  const neutralCount = stakeholders.length - forCount - againstCount

  const pct = Math.round(50 + balance / 2)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono font-semibold text-white flex items-center gap-2">
          <Shield className="h-4 w-4 text-purple" />
          Stakeholder Balance
        </p>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="text-for-400">{forCount} For</span>
          {neutralCount > 0 && <span className="text-surface-500">{neutralCount} Neutral</span>}
          <span className="text-against-400">{againstCount} Against</span>
        </div>
      </div>

      {/* Balance bar */}
      <div className="relative h-3 rounded-full bg-against-500/30 overflow-hidden">
        <motion.div
          className="absolute left-0 top-0 h-full bg-for-500 rounded-full"
          initial={{ width: '50%' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7 }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-0.5 bg-white/20" />
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span>Stakeholders lean AGAINST</span>
        <span>Stakeholders lean FOR</span>
      </div>

      {balance !== 0 && (
        <p className="text-[11px] text-surface-500 text-center">
          Power-weighted balance:{' '}
          <span className={cn('font-semibold', balance > 0 ? 'text-for-400' : 'text-against-400')}>
            {balance > 0 ? `+${balance}` : balance} points {balance > 0 ? 'toward FOR' : 'toward AGAINST'}
          </span>
        </p>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((k) => (
          <Skeleton key={k} className="h-52 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StakeholdersClient({ topicId }: { topicId: string }) {
  const [data, setData] = useState<StakeholdersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'power' | 'stake' | 'stance'>('power')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/stakeholders`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as StakeholdersResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load stakeholder data')
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { void load() }, [load])

  const sortedStakeholders = data
    ? [...data.stakeholders].sort((a, b) => {
        if (sortBy === 'power') {
          const pw = { high: 3, medium: 2, low: 1 }
          return pw[b.power] - pw[a.power]
        }
        if (sortBy === 'stake') return b.stake_level - a.stake_level
        // stance: strongly for/against first
        const stanceOrder: Record<string, number> = {
          strongly_for: 0, strongly_against: 1, leaning_for: 2, leaning_against: 3, neutral: 4,
        }
        return (stanceOrder[a.stance] ?? 5) - (stanceOrder[b.stance] ?? 5)
      })
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Back link */}
        <Link
          href={`/topic/${topicId}`}
          className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to debate
        </Link>

        {loading && <LoadingSkeleton />}

        {error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center space-y-3">
            <Users className="h-8 w-8 text-against-400 mx-auto" />
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple" />
                <span className="text-xs font-mono text-purple uppercase tracking-widest">Stakeholder Map</span>
              </div>
              <h1 className="text-lg font-semibold text-white leading-snug">
                {data.topic.statement}
              </h1>
              <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
                {data.topic.category && (
                  <span className="text-purple">{data.topic.category}</span>
                )}
                <span>{data.stakeholders.length} stakeholder groups identified</span>
                {data.topic.scope && <span>Scope: {data.topic.scope}</span>}
              </div>
            </div>

            {/* Context note */}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface-200/60 border border-surface-300/60">
              <Info className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-surface-500 leading-relaxed">
                Stakeholder stances are inferred from the debate category, topic keywords, and argument content.
                They represent typical group interests, not confirmed positions. {data.scope_note}
              </p>
            </div>

            {/* Balance bar */}
            <BalanceBar balance={data.overall_balance} stakeholders={data.stakeholders} />

            {/* Sort controls */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-surface-500">Sort by:</span>
              {(['power', 'stake', 'stance'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSortBy(opt)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-colors capitalize',
                    sortBy === opt
                      ? 'bg-purple/20 border-purple/40 text-purple'
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>

            {/* Stakeholder cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sortedStakeholders.map((group, idx) => (
                <StakeholderCard key={group.id} group={group} idx={idx} />
              ))}
            </div>

            {/* Footer links */}
            <div className="border-t border-surface-300/60 pt-6 space-y-3">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wide">Explore more angles</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: 'breakdown', label: 'Voter Breakdown' },
                  { href: 'versus',    label: 'FOR vs AGAINST' },
                  { href: 'ripple',    label: 'Ripple Effect' },
                  { href: 'impact',    label: 'Impact Scores' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                  >
                    {link.label}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Refresh */}
            <div className="flex justify-center">
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
