'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Flag,
  Flame,
  Gavel,
  RefreshCw,
  Scale,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketMilestones, PriceMilestone } from '@/app/api/exchange/[id]/milestones/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function milestoneColor(m: PriceMilestone): { text: string; bg: string; border: string; ring: string } {
  if (!m.is_achieved) return {
    text: 'text-surface-500',
    bg: 'bg-surface-800',
    border: 'border-surface-600',
    ring: 'ring-surface-600/30',
  }
  if (m.tier === 'law') return {
    text: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    ring: 'ring-gold/20',
  }
  if (m.tier === 'dominant') return {
    text: 'text-for-300',
    bg: 'bg-for-600/20',
    border: 'border-for-500/40',
    ring: 'ring-for-500/20',
  }
  if (m.tier === 'strong') return {
    text: 'text-for-400',
    bg: 'bg-for-700/20',
    border: 'border-for-600/30',
    ring: 'ring-for-600/15',
  }
  if (m.tier === 'lean') return {
    text: 'text-for-500',
    bg: 'bg-for-800/20',
    border: 'border-for-700/30',
    ring: 'ring-for-700/10',
  }
  return {
    text: 'text-surface-400',
    bg: 'bg-surface-700/40',
    border: 'border-surface-500/40',
    ring: 'ring-surface-500/10',
  }
}

function MilestoneIcon({ m }: { m: PriceMilestone }) {
  if (!m.is_achieved) return <Circle className="h-5 w-5 text-surface-600" />
  if (m.tier === 'law') return <Gavel className="h-5 w-5 text-gold" />
  if (m.tier === 'dominant') return <Trophy className="h-5 w-5 text-for-300" />
  if (m.is_current) return <Target className="h-5 w-5 text-for-400" />
  return <CheckCircle2 className="h-5 w-5 text-for-500" />
}

function relDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatDays(n: number): string {
  if (n === 0) return 'Day 1'
  if (n === 1) return '1 day'
  return `${n} days`
}

function formatVolume(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function PriceProgressBar({ price, status }: { price: number; status: string }) {
  const pct = Math.min(100, Math.max(0, price))
  const isLaw = status === 'law'
  const isFailed = status === 'failed'

  const thresholds = [25, 33, 50, 60, 67, 75, 90]

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-surface-500">
        <span>0¢</span>
        <span className={cn('font-bold text-base', priceColor(price, status))}>
          {Math.round(price)}¢
        </span>
        <span>100¢</span>
      </div>
      <div className="relative h-4 bg-surface-800 rounded-full overflow-hidden ring-1 ring-surface-600">
        {/* Fill */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            isLaw
              ? 'bg-gradient-to-r from-gold/60 to-gold'
              : isFailed
                ? 'bg-against-600/60'
                : price >= 67
                  ? 'bg-gradient-to-r from-for-600/60 to-gold/80'
                  : price >= 50
                    ? 'bg-gradient-to-r from-for-700/60 to-for-500'
                    : 'bg-gradient-to-r from-against-800/40 to-surface-600',
          )}
        />
        {/* Threshold ticks */}
        {thresholds.map((t) => (
          <div
            key={t}
            className={cn(
              'absolute inset-y-0 w-px',
              pct >= t ? 'bg-surface-900/40' : 'bg-surface-600/60',
            )}
            style={{ left: `${t}%` }}
          />
        ))}
        {/* Law marker */}
        <div
          className="absolute inset-y-0 w-0.5 bg-gold/60"
          style={{ left: '67%' }}
          title="Law threshold (67¢)"
        />
      </div>
      <div className="relative h-3">
        {/* Labels under bar */}
        {thresholds.filter((t) => t !== 67).map((t) => (
          <span
            key={t}
            className={cn(
              'absolute text-[10px] -translate-x-1/2',
              pct >= t ? 'text-surface-500' : 'text-surface-700',
            )}
            style={{ left: `${t}%` }}
          >
            {t}¢
          </span>
        ))}
        <span
          className="absolute -translate-x-1/2 text-[10px] font-semibold text-gold/80"
          style={{ left: '67%' }}
        >
          67¢
        </span>
      </div>
    </div>
  )
}

// ─── Milestone Card ───────────────────────────────────────────────────────────

function MilestoneCard({ m, index }: { m: PriceMilestone; index: number }) {
  const colors = milestoneColor(m)

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className={cn(
        'relative flex items-start gap-4 rounded-xl border p-4',
        'transition-all duration-200',
        m.is_achieved
          ? cn('ring-1', colors.bg, colors.border, colors.ring)
          : 'bg-surface-900/40 border-surface-700/40',
        m.is_current && m.is_achieved && 'shadow-sm',
      )}
    >
      {/* Icon */}
      <div className={cn(
        'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-full',
        m.is_achieved ? colors.bg : 'bg-surface-800',
        'border',
        m.is_achieved ? colors.border : 'border-surface-700',
      )}>
        <MilestoneIcon m={m} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'font-mono font-bold text-lg',
            m.is_achieved ? colors.text : 'text-surface-600',
          )}>
            {m.label}
          </span>
          <span className={cn(
            'text-sm',
            m.is_achieved ? 'text-surface-400' : 'text-surface-600',
          )}>
            {m.description}
          </span>
          {m.is_current && m.is_achieved && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-for-500/20 text-for-300 border-for-500/30">
              Current
            </Badge>
          )}
          {m.tier === 'law' && m.is_achieved && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-gold/10 text-gold border-gold/30">
              LAW
            </Badge>
          )}
        </div>

        {m.is_achieved && m.crossed_at ? (
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-surface-500">
            <span className="flex items-center gap-1">
              <Flag className="h-3 w-3" />
              {relDate(m.crossed_at)}
            </span>
            {m.days_to_cross !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDays(m.days_to_cross)} from open
              </span>
            )}
            {m.crossed_at_volume !== null && (
              <span className="flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                {formatVolume(m.crossed_at_volume)} votes
              </span>
            )}
          </div>
        ) : !m.is_achieved ? (
          <div className="mt-1 text-xs text-surface-600">Not yet reached</div>
        ) : null}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MilestonesSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-20 w-full rounded-xl" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  id: string
}

export function MilestonesClient({ id }: Props) {
  const [data, setData] = useState<MarketMilestones | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/${id}/milestones`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load milestones.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const isLaw = data?.status === 'law'
  const isFailed = data?.status === 'failed'

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-28">
        {/* ── Back + Title ── */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href={`/exchange/${id}`}
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Market
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
          <span className="text-sm text-surface-400">Milestones</span>
        </div>

        {loading && <MilestonesSkeleton />}

        {error && (
          <EmptyState
            icon={Scale}
            title="Could not load milestones"
            description={error}
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* ── Header ── */}
              <div className={cn(
                'rounded-2xl border p-5 space-y-4',
                isLaw
                  ? 'bg-gold/5 border-gold/20'
                  : isFailed
                    ? 'bg-against-900/20 border-against-700/20'
                    : 'bg-surface-100 border-surface-300',
              )}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isLaw
                        ? <Gavel className="h-4 w-4 text-gold flex-shrink-0" />
                        : <TrendingUp className="h-4 w-4 text-for-400 flex-shrink-0" />
                      }
                      <span className={cn(
                        'text-xs font-semibold uppercase tracking-wider',
                        isLaw ? 'text-gold/80' : 'text-surface-500',
                      )}>
                        {isLaw ? 'Established as Law' : isFailed ? 'Failed' : 'Milestone Tracker'}
                      </span>
                    </div>
                    <p className="text-sm text-surface-300 leading-snug line-clamp-2">
                      {data.statement}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={cn('text-3xl font-mono font-bold', priceColor(data.current_price, data.status))}>
                      {Math.round(data.current_price)}¢
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      {data.total_votes.toLocaleString()} votes
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <PriceProgressBar price={data.current_price} status={data.status} />
              </div>

              {/* ── Velocity stats ── */}
              {!isFailed && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                    <div className={cn(
                      'text-lg font-bold font-mono',
                      data.velocity.delta_7d === null
                        ? 'text-surface-500'
                        : data.velocity.delta_7d > 0
                          ? 'text-emerald'
                          : data.velocity.delta_7d < 0
                            ? 'text-against-400'
                            : 'text-surface-400',
                    )}>
                      {data.velocity.delta_7d === null
                        ? '—'
                        : `${data.velocity.delta_7d > 0 ? '+' : ''}${data.velocity.delta_7d.toFixed(1)}¢`}
                    </div>
                    <div className="text-[11px] text-surface-500 mt-0.5">7-day drift</div>
                  </div>

                  <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                    <div className="text-lg font-bold font-mono text-surface-300">
                      {data.velocity.days_to_next !== null
                        ? `~${data.velocity.days_to_next}d`
                        : '—'}
                    </div>
                    <div className="text-[11px] text-surface-500 mt-0.5">to next</div>
                  </div>

                  <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                    <div className="text-lg font-bold font-mono text-surface-300">
                      {data.velocity.daily_votes_rate.toFixed(1)}
                    </div>
                    <div className="text-[11px] text-surface-500 mt-0.5">votes/day</div>
                  </div>
                </div>
              )}

              {/* ── Next milestone callout ── */}
              {data.next_milestone && !isLaw && !isFailed && (
                <div className="rounded-xl bg-surface-200/40 border border-surface-400/40 p-4 flex items-center gap-3">
                  <Target className="h-5 w-5 text-for-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-surface-300">
                      Next: <span className="font-mono text-for-400">{data.next_milestone.label}</span>
                      {' '}— {data.next_milestone.description}
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">
                      {(data.next_milestone.threshold - data.current_price).toFixed(1)}¢ away
                      {data.velocity.days_to_next !== null && ` · ~${data.velocity.days_to_next} days at current rate`}
                    </div>
                  </div>
                  <Flame className="h-4 w-4 text-for-500/60 flex-shrink-0" />
                </div>
              )}

              {/* ── Law celebration ── */}
              {isLaw && (
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-xl bg-gold/10 border border-gold/30 p-4 flex items-center gap-3"
                >
                  <Trophy className="h-6 w-6 text-gold flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-gold">All milestones achieved</div>
                    <div className="text-xs text-gold/70 mt-0.5">
                      This market crossed the supermajority threshold and is now Law.
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Milestone list ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wide">
                    Journey
                  </h2>
                  <span className="text-xs text-surface-600">
                    {data.milestones.filter((m) => m.is_achieved).length} / {data.milestones.length} reached
                  </span>
                </div>

                {data.milestones.map((m, i) => (
                  <MilestoneCard key={m.threshold} m={m} index={i} />
                ))}
              </div>

              {/* ── Footer links ── */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Link
                  href={`/exchange/${id}/analysis`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-surface-400/40 bg-surface-200/40 px-4 py-3 text-sm text-surface-400 hover:text-surface-200 hover:border-surface-400 transition-colors"
                >
                  <BarChart2 className="h-4 w-4" />
                  Analysis
                </Link>
                <Link
                  href={`/exchange/${id}/activity`}
                  className="flex items-center justify-center gap-2 rounded-xl border border-surface-400/40 bg-surface-200/40 px-4 py-3 text-sm text-surface-400 hover:text-surface-200 hover:border-surface-400 transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  Activity
                </Link>
              </div>

              {/* ── Refresh ── */}
              <div className="flex justify-center pt-1">
                <button
                  onClick={load}
                  className="flex items-center gap-1.5 text-xs text-surface-600 hover:text-surface-400 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
