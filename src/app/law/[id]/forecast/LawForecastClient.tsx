'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Gavel,
  Info,
  RefreshCw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LawForecastData, StabilityTier, RiskLevel, ForecastSignal } from '@/app/api/laws/[id]/forecast/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<StabilityTier, {
  label: string
  color: string
  bg: string
  border: string
  ring: string
  icon: typeof Shield
  desc: string
}> = {
  bedrock: {
    label: 'Bedrock',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/30',
    icon: ShieldCheck,
    desc: 'Unshakeable — the community stands behind this law',
  },
  stable: {
    label: 'Stable',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/30',
    icon: Shield,
    desc: 'Well-established with minor friction',
  },
  contested: {
    label: 'Contested',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/30',
    icon: ShieldAlert,
    desc: 'Under scrutiny — community actively debating its merits',
  },
  fragile: {
    label: 'Fragile',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/30',
    icon: ShieldOff,
    desc: 'At risk — significant opposition threatens this law',
  },
}

const RISK_CONFIG: Record<RiskLevel, {
  label: string
  color: string
  bg: string
  border: string
  dotColor: string
}> = {
  low: {
    label: 'Low',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    dotColor: 'bg-emerald',
  },
  moderate: {
    label: 'Moderate',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    dotColor: 'bg-for-400',
  },
  elevated: {
    label: 'Elevated',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    dotColor: 'bg-gold',
  },
  critical: {
    label: 'Critical',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    dotColor: 'bg-against-400',
  },
}

const SIGNAL_DIRECTION: Record<ForecastSignal['direction'], { icon: typeof CheckCircle2; color: string }> = {
  positive: { icon: CheckCircle2, color: 'text-emerald' },
  neutral:  { icon: Info,         color: 'text-surface-400' },
  negative: { icon: AlertTriangle, color: 'text-against-400' },
}

// ─── Stability gauge ──────────────────────────────────────────────────────────

function StabilityGauge({ score, tier }: { score: number; tier: StabilityTier }) {
  const cfg = TIER_CONFIG[tier]
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  const strokeColor =
    tier === 'bedrock'  ? '#10b981' :
    tier === 'stable'   ? '#60a5fa' :
    tier === 'contested'? '#c9a84c' : '#f87171'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-surface-300/40"
          />
          <motion.circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={strokeColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-3xl font-bold tabular-nums', cfg.color)}>{score}</span>
          <span className="text-xs text-surface-500 mt-0.5">/ 100</span>
        </div>
      </div>
      <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium', cfg.bg, cfg.border, cfg.color)}>
        <cfg.icon className="w-3.5 h-3.5" />
        {cfg.label}
      </div>
      <p className="text-xs text-surface-500 text-center max-w-[200px]">{cfg.desc}</p>
    </div>
  )
}

// ─── Risk meter ───────────────────────────────────────────────────────────────

function RiskMeter({ score, level, label }: { score: number; level: RiskLevel; label: string }) {
  const cfg = RISK_CONFIG[level]
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-500">{label}</span>
        <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: cfg.dotColor.replace('bg-', '') }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Star distribution bar ────────────────────────────────────────────────────

function StarBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-0.5 w-12 justify-end shrink-0">
        <Star className="w-3 h-3 text-gold fill-gold" />
        <span className="text-surface-400">{stars}</span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300/30 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gold"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: (5 - stars) * 0.07 }}
        />
      </div>
      <span className="text-surface-500 w-4 text-right shrink-0">{count}</span>
    </div>
  )
}

// ─── Signal row ───────────────────────────────────────────────────────────────

function SignalRow({ signal, index }: { signal: ForecastSignal; index: number }) {
  const dirCfg = SIGNAL_DIRECTION[signal.direction]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-start gap-3 py-3 border-b border-surface-300/20 last:border-0"
    >
      <dirCfg.icon className={cn('w-4 h-4 mt-0.5 shrink-0', dirCfg.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium text-surface-100">{signal.label}</span>
          <span className="text-xs text-surface-400">{signal.value}</span>
        </div>
        <p className="text-xs text-surface-500 mt-0.5">{signal.description}</p>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4">
      <Skeleton className="h-5 w-40" />
      <div className="flex justify-center py-4">
        <Skeleton className="w-36 h-36 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  lawId: string
  lawStatement: string
}

export function LawForecastClient({ lawId, lawStatement }: Props) {
  const [data, setData] = useState<LawForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/forecast`)
      if (!res.ok) throw new Error('Failed to load forecast')
      const json: LawForecastData = await res.json()
      setData(json)
    } catch {
      setError('Unable to load forecast data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  const tierCfg = data ? TIER_CONFIG[data.stability_tier] : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-900">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-900/90 backdrop-blur border-b border-surface-300/20 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href={`/law/${lawId}`} className="text-surface-400 hover:text-surface-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-surface-500 uppercase tracking-wider font-medium">Law Forecast</p>
              <h1 className="text-sm font-semibold text-surface-100 truncate">{lawStatement}</h1>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="text-surface-400 hover:text-surface-100 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {loading && !data ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4">
              <EmptyState
                icon={AlertTriangle}
                title="Forecast unavailable"
                description={error}
                action={{ label: 'Retry', onClick: load }}
              />
            </motion.div>
          ) : data ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 p-4">

              {/* Stability gauge + headline */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-xl border p-5 space-y-4',
                  tierCfg?.bg,
                  tierCfg?.border,
                )}
              >
                <div className="flex justify-center">
                  <StabilityGauge score={data.stability_score} tier={data.stability_tier} />
                </div>

                <div className="text-center space-y-1">
                  <p className={cn('text-base font-semibold', tierCfg?.color)}>{data.headline}</p>
                  <p className="text-xs text-surface-400 leading-relaxed">{data.summary}</p>
                </div>

                {/* Quick nav to related pages */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { href: `/law/${lawId}/challenge`, icon: Scale,   label: 'Challenges' },
                    { href: `/law/${lawId}/amendments`, icon: Edit3,  label: 'Amendments' },
                    { href: `/law/${lawId}/reviews`,   icon: Star,    label: 'Reviews' },
                  ].map(({ href, icon: Icon, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex flex-col items-center gap-1 py-2 rounded-lg bg-surface-800/60 border border-surface-300/20 hover:border-surface-300/40 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-surface-400" />
                      <span className="text-xs text-surface-500">{label}</span>
                    </Link>
                  ))}
                </div>
              </motion.div>

              {/* Risk meters */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-surface-300/20 bg-surface-800/40 p-4 space-y-4"
              >
                <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
                  <BarChart2 className="w-3.5 h-3.5" />
                  Risk Assessment
                </h2>

                <div className="space-y-4">
                  <RiskMeter
                    score={data.repeal_risk_score}
                    level={data.repeal_risk}
                    label="Repeal Risk"
                  />
                  <RiskMeter
                    score={data.amendment_pressure_score}
                    level={data.amendment_pressure}
                    label="Amendment Pressure"
                  />
                </div>

                {/* Count grid */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-lg bg-surface-700/40 p-3 space-y-1">
                    <p className="text-xs text-surface-500">Challenges</p>
                    <div className="flex gap-3 text-sm">
                      <span className="text-against-400 font-semibold">{data.challenge_open} open</span>
                      <span className="text-emerald font-medium">{data.challenge_dismissed} dismissed</span>
                    </div>
                    {data.challenge_upheld > 0 && (
                      <p className="text-xs text-against-400">{data.challenge_upheld} upheld</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-surface-700/40 p-3 space-y-1">
                    <p className="text-xs text-surface-500">Amendments</p>
                    <div className="flex gap-3 text-sm">
                      <span className="text-gold font-semibold">{data.amendment_pending} pending</span>
                      <span className="text-emerald font-medium">{data.amendment_ratified} ratified</span>
                    </div>
                    {data.amendment_rejected > 0 && (
                      <p className="text-xs text-surface-500">{data.amendment_rejected} rejected</p>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Review sentiment */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="rounded-xl border border-surface-300/20 bg-surface-800/40 p-4 space-y-3"
              >
                <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
                  <Star className="w-3.5 h-3.5" />
                  Community Sentiment
                </h2>

                {data.review_count === 0 ? (
                  <p className="text-xs text-surface-500 py-2">No reviews yet — be the first to rate this law.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-gold tabular-nums">{data.review_avg!.toFixed(1)}</p>
                        <div className="flex gap-0.5 justify-center mt-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={cn(
                                'w-3 h-3',
                                s <= Math.round(data.review_avg ?? 0)
                                  ? 'text-gold fill-gold'
                                  : 'text-surface-600',
                              )}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-surface-500 mt-1">{data.review_count} {data.review_count === 1 ? 'review' : 'reviews'}</p>
                      </div>
                      <div className="flex-1 space-y-1.5">
                        {[5, 4, 3, 2, 1].map((s) => {
                          const count = [data.review_stars_5, data.review_stars_4, data.review_stars_3, data.review_stars_2, data.review_stars_1][5 - s]
                          return (
                            <StarBar key={s} stars={s} count={count} total={data.review_count} />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <Link
                  href={`/law/${lawId}/reviews`}
                  className="flex items-center gap-1 text-xs text-surface-400 hover:text-surface-100 transition-colors pt-1"
                >
                  <span>See all reviews</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </motion.div>

              {/* Signals */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-xl border border-surface-300/20 bg-surface-800/40 p-4 space-y-1"
              >
                <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2 pb-2">
                  <Zap className="w-3.5 h-3.5" />
                  Forecast Signals
                </h2>
                {data.signals.map((signal, i) => (
                  <SignalRow key={signal.label} signal={signal} index={i} />
                ))}
              </motion.div>

              {/* Original mandate */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 }}
                className="rounded-xl border border-surface-300/20 bg-surface-800/40 p-4"
              >
                <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Gavel className="w-3.5 h-3.5" />
                  Original Mandate
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-3 rounded-full overflow-hidden bg-against-600/30 flex">
                      <motion.div
                        className="h-full bg-for-500 rounded-l-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.round(data.law.blue_pct ?? 50)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs">
                      <span className="text-for-400 font-semibold">{Math.round(data.law.blue_pct ?? 50)}% For</span>
                      <span className="text-against-400 font-semibold">{100 - Math.round(data.law.blue_pct ?? 50)}% Against</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-surface-100 tabular-nums">
                      {(data.law.total_votes ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-surface-500">votes cast</p>
                  </div>
                </div>
              </motion.div>

              {/* Related pages */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="rounded-xl border border-surface-300/20 bg-surface-800/40 divide-y divide-surface-300/15"
              >
                {[
                  { href: `/law/${lawId}`,           icon: Gavel,    label: 'Back to Law',         desc: 'Full law page' },
                  { href: `/law/${lawId}/momentum`,   icon: TrendingUp, label: 'Momentum',          desc: 'Week-by-week activity' },
                  { href: `/law/${lawId}/dissent`,    icon: TrendingDown, label: 'Loyal Opposition', desc: 'Who voted against' },
                  { href: `/law/${lawId}/similar`,    icon: Sparkles,  label: 'Similar Laws',        desc: 'Related legislation' },
                ].map(({ href, icon: Icon, label, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-700/30 transition-colors group"
                  >
                    <Icon className="w-4 h-4 text-surface-500 group-hover:text-surface-300 transition-colors shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-200 group-hover:text-surface-100 transition-colors">{label}</p>
                      <p className="text-xs text-surface-500">{desc}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
                  </Link>
                ))}
              </motion.div>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
