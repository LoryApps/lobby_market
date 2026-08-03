'use client'

/**
 * /law/[id]/pressure — Social Pressure Analysis
 *
 * Measures how much civic pressure a law is under after passage:
 *   • Stability Index — composite 0-100 score
 *   • Elite vs grassroots sentiment split
 *   • Temporal pressure — recent vs historical vote drift
 *   • Role-based breakdown
 *   • Active challenges, vetoes, amendments
 *
 * Distinct from:
 *   /law/[id]/dissent  — who voted against (individual dissenters)
 *   /law/[id]/mandate  — how decisively it passed
 *   /law/[id]/audit    — democratic legitimacy check
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Edit3,
  FileText,
  Flame,
  Gauge,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
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
import type { LawPressureResponse, PressureCohort, PressureSignal } from '@/app/api/laws/[id]/pressure/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  statement: string
  category: string | null
  bluePct: number
  totalVotes: number
  establishedAt: string | null
}

// ─── Stability gauge ──────────────────────────────────────────────────────────

function StabilityGauge({ index, label }: { index: number; label: string }) {
  const color =
    index >= 75 ? 'text-emerald' :
    index >= 50 ? 'text-for-400' :
    index >= 25 ? 'text-gold' :
    'text-against-400'

  const bgColor =
    index >= 75 ? 'bg-emerald' :
    index >= 50 ? 'bg-for-500' :
    index >= 25 ? 'bg-gold' :
    'bg-against-500'

  const borderColor =
    index >= 75 ? 'border-emerald/30' :
    index >= 50 ? 'border-for-500/30' :
    index >= 25 ? 'border-gold/30' :
    'border-against-500/30'

  const r = 52
  const strokeWidth = 10
  const circumference = 2 * Math.PI * r
  const filled = (index / 100) * circumference

  return (
    <div className={cn(
      'flex flex-col items-center rounded-2xl border p-6',
      'bg-surface-100',
      borderColor
    )}>
      <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
        <svg width={140} height={140} className="-rotate-90">
          <circle
            cx={70} cy={70} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-surface-300/30"
          />
          <circle
            cx={70} cy={70} r={r}
            fill="none"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            strokeLinecap="round"
            className={cn('transition-all duration-700', bgColor.replace('bg-', 'stroke-'))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold font-mono', color)}>{index}</span>
          <span className="text-xs text-surface-500 mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={cn('mt-3 text-sm font-semibold font-mono', color)}>{label}</span>
    </div>
  )
}

// ─── Mini bar ─────────────────────────────────────────────────────────────────

function MiniBar({ forPct, baseline, label }: { forPct: number; baseline: number; label: string }) {
  const delta = forPct - baseline
  const deltaColor = delta >= 0 ? 'text-for-400' : 'text-against-400'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-surface-500 font-mono">{label}</span>
        <span className={cn('font-mono font-semibold', deltaColor)}>
          {forPct}% FOR
          {delta !== 0 && (
            <span className="ml-1 text-[10px] opacity-70">
              ({delta > 0 ? '+' : ''}{delta}pp)
            </span>
          )}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full transition-all duration-500"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Signal badge ─────────────────────────────────────────────────────────────

const SIGNAL_META: Record<PressureSignal['type'], { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  challenge: { icon: Flame,     label: 'Challenge',  color: 'text-against-400' },
  veto:      { icon: ShieldX,   label: 'Civic Veto', color: 'text-gold' },
  reopen:    { icon: FileText,  label: 'Reopen',     color: 'text-purple' },
  amendment: { icon: Edit3,     label: 'Amendment',  color: 'text-for-400' },
}

function SignalRow({ signal }: { signal: PressureSignal }) {
  const meta = SIGNAL_META[signal.type]
  const Icon = meta.icon
  const ago = (() => {
    const ms = Date.now() - new Date(signal.created_at).getTime()
    const days = Math.floor(ms / 86400000)
    if (days === 0) return 'today'
    if (days === 1) return 'yesterday'
    return `${days}d ago`
  })()

  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-300/20 last:border-0">
      <span className={cn('flex-shrink-0', meta.color)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{signal.title}</p>
        <p className={cn('text-xs font-mono', meta.color)}>
          {meta.label} · {signal.status}
          {signal.signature_pct > 0 && ` · ${signal.signature_pct}% signed`}
        </p>
      </div>
      <span className="text-xs text-surface-500 flex-shrink-0 font-mono">{ago}</span>
    </div>
  )
}

// ─── Role row ─────────────────────────────────────────────────────────────────

function RoleRow({ cohort }: { cohort: PressureCohort }) {
  const deltaColor = cohort.deltaFromLaw >= 0 ? 'text-for-400' : 'text-against-400'
  return (
    <div className="flex items-center gap-3 py-2 border-b border-surface-300/15 last:border-0">
      <div className="w-24 shrink-0">
        <span className="text-xs font-mono text-surface-600">{cohort.label}</span>
      </div>
      <div className="flex-1 h-2 rounded-full bg-surface-300/20 overflow-hidden">
        <div className="h-full bg-for-500/70 rounded-full" style={{ width: `${cohort.forPct}%` }} />
      </div>
      <span className="text-xs font-mono text-white w-10 text-right">{cohort.forPct}%</span>
      <span className={cn('text-[10px] font-mono w-12 text-right shrink-0', deltaColor)}>
        {cohort.deltaFromLaw > 0 ? '+' : ''}{cohort.deltaFromLaw}pp
      </span>
      <span className="text-[10px] text-surface-500 w-14 text-right shrink-0">
        {cohort.total.toLocaleString()} votes
      </span>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PressureSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-4">
        <Skeleton className="h-48 w-48 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-20 rounded-xl mt-4" />
        </div>
      </div>
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LawPressureClient({
  lawId,
  statement,
  category,
  bluePct,
  totalVotes,
  establishedAt,
}: Props) {
  const [data, setData] = useState<LawPressureResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/pressure`)
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch {
      setError('Failed to load pressure analysis.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const estYear = establishedAt
    ? new Date(establishedAt).getFullYear()
    : null

  // Stability icon
  const StabilityIcon =
    !data ? Shield :
    data.stabilityIndex >= 75 ? ShieldCheck :
    data.stabilityIndex >= 50 ? Shield :
    data.stabilityIndex >= 25 ? ShieldAlert :
    ShieldX

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="font-mono">{statement.slice(0, 45)}{statement.length > 45 ? '…' : ''}</span>
        </Link>

        {/* Header */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="law" size="sm">LAW</Badge>
            {category && (
              <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">{category}</span>
            )}
            {estYear && (
              <span className="text-xs font-mono text-surface-500">· Est. {estYear}</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white mb-1 leading-snug">{statement}</h1>
          <p className="text-sm text-surface-500 font-mono">
            {totalVotes.toLocaleString()} votes · {bluePct}% FOR
          </p>

          <div className="mt-4 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-surface-500" />
            <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
              Social Pressure Analysis
            </span>
          </div>
        </div>

        {loading && <PressureSkeleton />}
        {error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-2" />
            <p className="text-sm text-against-300">{error}</p>
            <button
              onClick={load}
              className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-surface-500 hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="space-y-5"
          >

            {/* ── Stability Index ── */}
            <section>
              <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-3 flex items-center gap-1.5">
                <StabilityIcon className="h-3.5 w-3.5" />
                Stability Index
              </h2>
              <div className="flex gap-4 items-start">
                <StabilityGauge index={data.stabilityIndex} label={data.stabilityLabel} />
                <div className="flex-1 rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                  <p className="text-sm text-surface-600 leading-relaxed">
                    {data.stabilityDescription}
                  </p>

                  {/* Signal count summary */}
                  {data.signalCounts.total > 0 && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {data.signalCounts.challenges > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Flame className="h-3.5 w-3.5 text-against-400" />
                          <span className="text-surface-500 font-mono">
                            {data.signalCounts.challenges} challenge{data.signalCounts.challenges !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {data.signalCounts.vetoes > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <ShieldX className="h-3.5 w-3.5 text-gold" />
                          <span className="text-surface-500 font-mono">
                            {data.signalCounts.vetoes} veto{data.signalCounts.vetoes !== 1 ? 'es' : ''}
                          </span>
                        </div>
                      )}
                      {data.signalCounts.reopenRequests > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <FileText className="h-3.5 w-3.5 text-purple" />
                          <span className="text-surface-500 font-mono">
                            {data.signalCounts.reopenRequests} reopen petition{data.signalCounts.reopenRequests !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {data.signalCounts.amendments > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Edit3 className="h-3.5 w-3.5 text-for-400" />
                          <span className="text-surface-500 font-mono">
                            {data.signalCounts.amendments} amendment{data.signalCounts.amendments !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {data.signalCounts.total === 0 && (
                        <div className="col-span-2 flex items-center gap-1.5 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                          <span className="text-surface-500 font-mono">No active challenges</span>
                        </div>
                      )}
                    </div>
                  )}

                  {data.signalCounts.total === 0 && (
                    <div className="flex items-center gap-1.5 text-xs pt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                      <span className="text-surface-500 font-mono">No active challenges on record</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* ── Elite vs Grassroots ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" />
                Elite vs Grassroots
              </h2>

              <div className="space-y-3">
                <MiniBar
                  label={`Elite voters (clout ≥ ${data.eliteVsGrassroots.cloutThreshold})`}
                  forPct={data.eliteVsGrassroots.eliteForPct}
                  baseline={bluePct}
                />
                <MiniBar
                  label={`Grassroots voters (clout < ${data.eliteVsGrassroots.cloutThreshold})`}
                  forPct={data.eliteVsGrassroots.grassrootsForPct}
                  baseline={bluePct}
                />
              </div>

              {Math.abs(data.eliteVsGrassroots.eliteInfluenceDelta) >= 3 && (
                <div className={cn(
                  'mt-4 rounded-lg px-3 py-2 border text-xs font-mono',
                  data.eliteVsGrassroots.eliteInfluenceDelta > 0
                    ? 'bg-for-500/5 border-for-500/20 text-for-400'
                    : 'bg-against-500/5 border-against-500/20 text-against-400'
                )}>
                  Elite voters lean{' '}
                  {data.eliteVsGrassroots.eliteInfluenceDelta > 0 ? 'more FOR' : 'more AGAINST'}{' '}
                  than the grassroots by{' '}
                  {Math.abs(data.eliteVsGrassroots.eliteInfluenceDelta)}pp.
                </div>
              )}

              <p className="text-xs text-surface-500 mt-3 font-mono">
                {data.eliteVsGrassroots.eliteTotal.toLocaleString()} elite ·{' '}
                {data.eliteVsGrassroots.grassrootsTotal.toLocaleString()} grassroots voters
              </p>
            </section>

            {/* ── Temporal Pressure ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Temporal Pressure
              </h2>

              {data.temporalPressure.hasRecentActivity ? (
                <>
                  <div className="space-y-3">
                    <MiniBar
                      label="Last 30 days"
                      forPct={data.temporalPressure.recentForPct}
                      baseline={bluePct}
                    />
                    <MiniBar
                      label="Historical (all prior)"
                      forPct={data.temporalPressure.historicalForPct}
                      baseline={bluePct}
                    />
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    {data.temporalPressure.momentumShift >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-for-400 flex-shrink-0" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-against-400 flex-shrink-0" />
                    )}
                    <p className="text-xs text-surface-500 font-mono">
                      {Math.abs(data.temporalPressure.momentumShift) < 2
                        ? 'Sentiment is stable — no significant drift in recent activity.'
                        : data.temporalPressure.momentumShift > 0
                        ? `Recent votes lean ${data.temporalPressure.momentumShift}pp more FOR than the historical average — pressure is easing.`
                        : `Recent votes lean ${Math.abs(data.temporalPressure.momentumShift)}pp more AGAINST than the historical average — pressure may be building.`}
                    </p>
                  </div>

                  <p className="text-xs text-surface-500 mt-2 font-mono">
                    {data.temporalPressure.recentTotal} recent votes ·{' '}
                    {data.temporalPressure.historicalTotal.toLocaleString()} historical
                  </p>
                </>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No recent vote activity"
                  description="There has been no fresh voting activity on this law in the past 30 days."
                  size="sm"
                />
              )}
            </section>

            {/* ── Role breakdown ── */}
            {data.byRole.length > 0 && (
              <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Pressure by Role
                </h2>
                <div>
                  {data.byRole.map((cohort) => (
                    <RoleRow key={cohort.key} cohort={cohort} />
                  ))}
                </div>
                <p className="text-xs text-surface-500 mt-3 font-mono">
                  Delta shown relative to law&apos;s {bluePct}% FOR baseline.
                </p>
              </section>
            )}

            {/* ── Active signals ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Active Pressure Signals
              </h2>

              {data.activeSignals.length > 0 ? (
                <div>
                  {data.activeSignals.map((signal) => (
                    <SignalRow key={signal.id} signal={signal} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="No active pressure signals"
                  description="This law has no open challenges, vetoes, reopen petitions, or pending amendments."
                  size="sm"
                />
              )}
            </section>

            {/* ── Related analytics ── */}
            <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <h2 className="text-xs font-mono uppercase tracking-widest text-surface-500 mb-4 flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Related Analysis
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: `/law/${lawId}/dissent`, label: 'Dissent', desc: 'Who voted against' },
                  { href: `/law/${lawId}/mandate`, label: 'Mandate', desc: 'How decisively it passed' },
                  { href: `/law/${lawId}/audit`, label: 'Audit', desc: 'Democratic legitimacy' },
                  { href: `/law/${lawId}/blocs`, label: 'Voting Blocs', desc: 'Group dynamics' },
                  { href: `/law/${lawId}/amendments`, label: 'Amendments', desc: 'Proposed changes' },
                  { href: `/law/${lawId}/verdict`, label: 'Verdict', desc: 'Community verdict' },
                ].map(({ href, label, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg',
                      'bg-surface-200/40 border border-surface-300/30',
                      'hover:border-surface-400/50 hover:bg-surface-200/70 transition-colors'
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{label}</p>
                      <p className="text-[10px] text-surface-500 truncate">{desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </section>

          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
