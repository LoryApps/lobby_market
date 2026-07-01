'use client'

/**
 * /topic/[id]/signal — The Debate Signal Board
 *
 * A Bloomberg-Terminal-style live dashboard showing all key signals
 * for a debate: consensus strength, vote velocity, argument quality,
 * debate participation, prediction market confidence, coalition alignment.
 *
 * Distinct from:
 *   /radar       — radar chart of 6 debate dimensions
 *   /scorecard   — civic health scoring rubric
 *   /momentum    — historical vote balance over time
 *   /intelligence — AI-generated debate summary report
 *   /stats       — raw numeric statistics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  Globe,
  RefreshCw,
  Scale,
  Swords,
  Target,
  TrendingUp,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  Signal,
  SignalDirection,
  SignalStrength,
  CoalitionStance,
  SignalResponse,
} from '@/app/api/topics/[id]/signal/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reltime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ago`
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'bg-surface-400/20 text-surface-400 border-surface-400/30',
  active: 'bg-emerald/15 text-emerald border-emerald/30',
  voting: 'bg-gold/15 text-gold border-gold/30',
  law: 'bg-gold/20 text-gold border-gold/40',
  failed: 'bg-against-500/15 text-against-400 border-against-500/30',
}

// ─── Direction config ─────────────────────────────────────────────────────────

interface DirectionConfig {
  label: string
  textColor: string
  barColor: string
  bgColor: string
  borderColor: string
  icon: React.ElementType
  dot: string
}

const DIRECTION_CONFIG: Record<SignalDirection, DirectionConfig> = {
  bullish: {
    label: 'Bullish',
    textColor: 'text-for-400',
    barColor: 'bg-gradient-to-r from-for-600 to-for-400',
    bgColor: 'bg-for-500/8',
    borderColor: 'border-for-500/20',
    icon: TrendingUp,
    dot: 'bg-for-400',
  },
  bearish: {
    label: 'Bearish',
    textColor: 'text-against-400',
    barColor: 'bg-gradient-to-r from-against-600 to-against-400',
    bgColor: 'bg-against-500/8',
    borderColor: 'border-against-500/20',
    icon: ArrowLeft,
    dot: 'bg-against-400',
  },
  mixed: {
    label: 'Mixed',
    textColor: 'text-gold',
    barColor: 'bg-gradient-to-r from-gold/70 to-gold',
    bgColor: 'bg-gold/8',
    borderColor: 'border-gold/20',
    icon: Scale,
    dot: 'bg-gold',
  },
  neutral: {
    label: 'Neutral',
    textColor: 'text-surface-500',
    barColor: 'bg-surface-400',
    bgColor: 'bg-surface-200',
    borderColor: 'border-surface-300',
    icon: Activity,
    dot: 'bg-surface-400',
  },
}

const STRENGTH_LABEL: Record<SignalStrength, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
  neutral: '—',
}

// ─── Signal icon map ──────────────────────────────────────────────────────────

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  consensus: Scale,
  velocity: Zap,
  quality: BarChart2,
  participation: Swords,
  prediction: Target,
  coalition: Users,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignalGauge({ value, direction }: { value: number; direction: SignalDirection }) {
  const cfg = DIRECTION_CONFIG[direction]
  return (
    <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', cfg.barColor)}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

function SignalCard({ signal }: { signal: Signal }) {
  const cfg = DIRECTION_CONFIG[signal.direction]
  const Icon = SIGNAL_ICONS[signal.id] ?? Activity
  const DirIcon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 flex flex-col gap-3',
        cfg.bgColor,
        cfg.borderColor,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('p-1.5 rounded-lg', cfg.bgColor)}>
            <Icon className={cn('h-3.5 w-3.5', cfg.textColor)} />
          </div>
          <span className="text-xs font-mono text-surface-400 uppercase tracking-wide">
            {signal.label}
          </span>
        </div>
        <div className={cn('flex items-center gap-1', cfg.textColor)}>
          <DirIcon className="h-3 w-3" />
          <span className="text-xs font-mono font-semibold">
            {STRENGTH_LABEL[signal.strength]}
          </span>
        </div>
      </div>

      <SignalGauge value={signal.value} direction={signal.direction} />

      <div className="flex items-end justify-between gap-2">
        <p className="text-xs text-surface-500 leading-snug flex-1">
          {signal.description}
        </p>
        <span className={cn('text-xs font-mono font-bold shrink-0', cfg.textColor)}>
          {signal.value}
        </span>
      </div>

      <div className="text-[10px] font-mono text-surface-600 bg-surface-300/40 rounded px-2 py-1">
        {signal.raw}
      </div>
    </motion.div>
  )
}

function OverallMeter({
  score,
  direction,
  summary,
}: {
  score: number
  direction: SignalDirection
  summary: string
}) {
  const cfg = DIRECTION_CONFIG[direction]
  const DirIcon = cfg.icon

  const tier =
    score >= 75 ? 'Strong Signal'
    : score >= 50 ? 'Moderate Signal'
    : score >= 25 ? 'Weak Signal'
    : 'No Signal'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'rounded-2xl border p-5 mb-5',
        cfg.bgColor,
        cfg.borderColor,
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', cfg.dot)} />
          <span className={cn('text-xs font-mono font-semibold uppercase tracking-wider', cfg.textColor)}>
            {tier}
          </span>
        </div>
        <div className={cn('flex items-center gap-1.5 text-sm font-mono font-bold', cfg.textColor)}>
          <DirIcon className="h-4 w-4" />
          {cfg.label}
        </div>
      </div>

      {/* Big score */}
      <div className="flex items-end gap-3 mb-3">
        <motion.span
          className={cn('text-5xl font-mono font-black leading-none', cfg.textColor)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {score}
        </motion.span>
        <span className="text-surface-500 text-sm font-mono mb-1">/100</span>
      </div>

      {/* Overall gauge */}
      <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden mb-4">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', cfg.barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.1 }}
        />
      </div>

      <p className="text-sm text-surface-400 leading-relaxed">{summary}</p>
    </motion.div>
  )
}

function CoalitionRow({ stance }: { stance: CoalitionStance }) {
  const isFor = stance.stance === 'for'
  const isAgainst = stance.stance === 'against'

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-300/50 last:border-0">
      <div
        className={cn(
          'mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0',
          isFor ? 'bg-for-500/20' : isAgainst ? 'bg-against-500/20' : 'bg-surface-300',
        )}
      >
        {isFor ? (
          <CheckCircle2 className="h-3 w-3 text-for-400" />
        ) : isAgainst ? (
          <XCircle className="h-3 w-3 text-against-400" />
        ) : (
          <Scale className="h-3 w-3 text-surface-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">
            {stance.coalition_name}
          </span>
          <Badge
            className={cn(
              'text-[10px] font-mono uppercase',
              isFor
                ? 'bg-for-500/15 text-for-400 border-for-500/25'
                : isAgainst
                ? 'bg-against-500/15 text-against-400 border-against-500/25'
                : 'bg-surface-300 text-surface-500 border-surface-400/20',
            )}
          >
            {stance.stance}
          </Badge>
        </div>
        {stance.statement && (
          <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{stance.statement}</p>
        )}
        {stance.member_count > 0 && (
          <span className="text-[10px] font-mono text-surface-600">
            {stance.member_count.toLocaleString()} members
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SignalClient({ topicId }: { topicId: string }) {
  const params = useParams()
  const id = topicId || (params?.id as string)

  const [data, setData] = useState<SignalResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/topics/${id}/signal`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load signal data')
        const json: SignalResponse = await res.json()
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [id],
  )

  useEffect(() => { fetchData() }, [fetchData])

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
          <Skeleton className="h-4 w-32 mb-6" />
          <Skeleton className="h-5 w-20 rounded-full mb-2" />
          <Skeleton className="h-7 w-full mb-1" />
          <Skeleton className="h-7 w-3/4 mb-6" />
          <Skeleton className="h-28 rounded-2xl mb-5" />
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-4 w-28 mb-3" />
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl mb-2" />)}
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">
          <EmptyState
            icon={Activity}
            title="Signal unavailable"
            description={error ?? 'Could not load the signal board for this topic.'}
            action={{ label: 'Try again', onClick: () => fetchData() }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const { topic, signals, coalition_stances, overall_score, overall_direction, summary, refreshed_at } = data
  const statusLabel = STATUS_LABEL[topic.status] ?? topic.status
  const statusCls = STATUS_COLOR[topic.status] ?? 'bg-surface-400/20 text-surface-400 border-surface-400/30'
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  // Split signals into rows: 2 big cards (consensus + velocity) + 4 smaller
  const [sig1, sig2, ...restSignals] = signals

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-24">

        {/* ── Back nav ──────────────────────────────────────────────────── */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>

        {/* ── Topic header ──────────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border', statusCls)}>
              {statusLabel}
            </span>
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                {topic.category}
              </span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-white leading-snug mb-2">
            {topic.statement}
          </h1>
          <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
            <span className="text-for-400 font-semibold">{forPct}% For</span>
            <span>/</span>
            <span className="text-against-400 font-semibold">{againstPct}% Against</span>
            <span>·</span>
            <span>{topic.total_votes.toLocaleString()} votes</span>
          </div>
        </div>

        {/* ── Overall signal meter ──────────────────────────────────────── */}
        <OverallMeter
          score={overall_score}
          direction={overall_direction}
          summary={summary}
        />

        {/* ── Top 2 primary signals ─────────────────────────────────────── */}
        {sig1 && sig2 && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <SignalCard signal={sig1} />
            <SignalCard signal={sig2} />
          </div>
        )}

        {/* ── Remaining 4 signals ───────────────────────────────────────── */}
        {restSignals.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-5">
            {restSignals.map((sig) => (
              <SignalCard key={sig.id} signal={sig} />
            ))}
          </div>
        )}

        {/* ── Coalition stances panel ───────────────────────────────────── */}
        <section className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-surface-500" />
              <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider">
                Coalition Stances
              </h2>
            </div>
            {coalition_stances.length > 0 && (
              <span className="text-[10px] font-mono text-surface-600">
                {coalition_stances.length} coalition{coalition_stances.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className={cn(
            'rounded-2xl border border-surface-300 divide-y divide-surface-300/50 px-4',
            coalition_stances.length === 0 && 'py-6',
          )}>
            {coalition_stances.length === 0 ? (
              <p className="text-xs text-surface-500 text-center font-mono">
                No coalitions have declared a stance yet
              </p>
            ) : (
              coalition_stances.map((s) => (
                <CoalitionRow key={s.coalition_id} stance={s} />
              ))
            )}
          </div>
        </section>

        {/* ── Quick nav to related pages ────────────────────────────────── */}
        <section className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="h-3.5 w-3.5 text-surface-500" />
            <h2 className="text-xs font-mono text-surface-400 uppercase tracking-wider">
              Dig Deeper
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: `/topic/${id}/momentum`, label: 'Vote Momentum', Icon: TrendingUp },
              { href: `/topic/${id}/intelligence`, label: 'Intelligence Report', Icon: BarChart2 },
              { href: `/topic/${id}/predictions`, label: 'Prediction Market', Icon: Target },
              { href: `/topic/${id}/coalitions`, label: 'Coalition Landscape', Icon: Users },
              { href: `/topic/${id}/scorecard`, label: 'Civic Scorecard', Icon: Gavel },
              { href: `/topic/${id}/radar`, label: 'Debate Radar', Icon: Activity },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl',
                  'bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200',
                  'transition-colors group',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                  <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors truncate">
                    {label}
                  </span>
                </div>
                <ChevronRight className="h-3 w-3 text-surface-600 shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* ── Refresh row ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
          <span>Updated {reltime(refreshed_at)}</span>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh signals'}
          </button>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
