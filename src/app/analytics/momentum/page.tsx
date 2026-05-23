'use client'

/**
 * /analytics/momentum — Civic Momentum Report
 *
 * Shows whether your civic engagement is accelerating, stable, or
 * decelerating across three dimensions: voting, arguing, and reputation.
 *
 * Method: compares the last 4 weeks to the prior 4 weeks for each
 * dimension, producing a percentage change that feeds into an overall
 * momentum score (-100 to +100) and a tier label.
 *
 * Distinct from:
 *   /analytics/growth    — cumulative monthly activity chart
 *   /analytics/velocity  — argument upvote speed
 *   /analytics/streak    — daily vote streak
 *   /analytics/snapshot  — current-state identity card
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Coins,
  Flame,
  MessageSquare,
  RefreshCw,
  Rocket,
  Scale,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { MomentumResponse, MomentumTier, DimensionMomentum, WeeklyBucket } from '@/app/api/analytics/momentum/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<MomentumTier, {
  label: string
  desc: string
  color: string
  bg: string
  border: string
  bar: string
  icon: typeof Rocket
  gradient: string
}> = {
  surging: {
    label: 'Surging',
    desc: 'Your civic engagement is accelerating sharply. Keep the momentum going.',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    icon: Rocket,
    gradient: 'from-emerald/20 to-transparent',
  },
  building: {
    label: 'Building',
    desc: "You're gaining ground. Consistent effort is compounding.",
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
    icon: TrendingUp,
    gradient: 'from-for-500/15 to-transparent',
  },
  steady: {
    label: 'Steady',
    desc: "You're maintaining a consistent civic presence.",
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    bar: 'bg-gold',
    icon: Scale,
    gradient: 'from-gold/10 to-transparent',
  },
  easing: {
    label: 'Easing',
    desc: "Your recent activity has slowed. A few votes or arguments can reverse this.",
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
    icon: TrendingDown,
    gradient: 'from-against-500/15 to-transparent',
  },
  fading: {
    label: 'Fading',
    desc: 'Engagement has dropped significantly. Your voice is needed.',
    color: 'text-against-500',
    bg: 'bg-against-600/10',
    border: 'border-against-600/30',
    bar: 'bg-against-600',
    icon: TrendingDown,
    gradient: 'from-against-600/20 to-transparent',
  },
}

const DIM_ICONS: Record<string, typeof Vote> = {
  Voting: Vote,
  Arguing: MessageSquare,
  Reputation: ThumbsUp,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

function fmtPctColor(pct: number | null): string {
  if (pct === null) return 'text-surface-500'
  if (pct >= 10) return 'text-emerald'
  if (pct >= -10) return 'text-gold'
  return 'text-against-400'
}

// ─── Sparkline chart ──────────────────────────────────────────────────────────

function Sparkline({
  data,
  field,
  color,
}: {
  data: WeeklyBucket[]
  field: keyof Omit<WeeklyBucket, 'week'>
  color: string
}) {
  const values = data.map((b) => b[field] as number)
  const max = Math.max(...values, 1)
  const width = 160
  const height = 48
  const pad = 4

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v / max) * (height - pad * 2))
    return `${x},${y}`
  })

  const polyline = points.join(' ')

  // Area fill
  const areaPoints = [
    `${pad},${height - pad}`,
    ...points,
    `${pad + (width - pad * 2)},${height - pad}`,
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      {/* Area */}
      <polygon
        points={areaPoints}
        className={cn('opacity-20', color.replace('text-', 'fill-'))}
        style={{ fill: 'currentColor' }}
      />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={color}
        style={{ stroke: 'currentColor' }}
      />
      {/* Dots */}
      {points.map((pt, i) => {
        const [x, y] = pt.split(',').map(Number)
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={values[i] > 0 ? 2.5 : 1.5}
            className={values[i] > 0 ? color : 'fill-surface-400'}
            style={{ fill: 'currentColor' }}
          />
        )
      })}
    </svg>
  )
}

// ─── Momentum meter ───────────────────────────────────────────────────────────

function MomentumMeter({ score }: { score: number }) {
  // score: -100 to +100 → position 0–100%
  const pct = ((score + 100) / 200) * 100
  const clampedPct = Math.max(2, Math.min(98, pct))

  let indicatorColor = 'bg-gold'
  if (score >= 40) indicatorColor = 'bg-emerald'
  else if (score >= 10) indicatorColor = 'bg-for-400'
  else if (score <= -40) indicatorColor = 'bg-against-600'
  else if (score <= -10) indicatorColor = 'bg-against-400'

  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-full overflow-hidden bg-surface-300">
        {/* Gradient track */}
        <div className="absolute inset-0 bg-gradient-to-r from-against-600 via-gold to-emerald opacity-40 rounded-full" />
        {/* Indicator */}
        <motion.div
          className={cn('absolute top-0.5 bottom-0.5 w-3 rounded-full shadow-lg', indicatorColor)}
          initial={{ left: '50%' }}
          animate={{ left: `${clampedPct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ transform: 'translateX(-50%)' }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-surface-500">
        <span>Fading</span>
        <span>Steady</span>
        <span>Surging</span>
      </div>
    </div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ dim, field }: {
  dim: DimensionMomentum
  field: keyof Omit<WeeklyBucket, 'week'>
}) {
  const tier = TIER_CONFIG[dim.tier]
  const Icon = DIM_ICONS[dim.label] ?? Activity

  const sparkColor = dim.tier === 'surging' || dim.tier === 'building'
    ? 'text-emerald'
    : dim.tier === 'steady'
      ? 'text-gold'
      : 'text-against-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 space-y-4',
        'bg-surface-100',
        tier.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', tier.bg, tier.border)}>
            <Icon className={cn('h-4 w-4', tier.color)} aria-hidden />
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-white">{dim.label}</p>
            <p className={cn('text-xs font-mono', tier.color)}>{tier.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={cn('font-mono text-lg font-bold', fmtPctColor(dim.pct_change))}>
            {fmtPct(dim.pct_change)}
          </p>
          <p className="text-[10px] font-mono text-surface-500">vs prior 4w</p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="px-1">
        <Sparkline data={dim.weekly} field={field} color={sparkColor} />
        <div className="flex justify-between text-[9px] font-mono text-surface-600 mt-1 px-1">
          <span>8 weeks ago</span>
          <span>Now</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-200/60 px-3 py-2 text-center">
          <p className="font-mono text-base font-bold text-white">
            <AnimatedNumber value={dim.recent} />
          </p>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">Last 4 weeks</p>
        </div>
        <div className="rounded-lg bg-surface-200/60 px-3 py-2 text-center">
          <p className="font-mono text-base font-bold text-surface-400">
            <AnimatedNumber value={dim.prior} />
          </p>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">Prior 4 weeks</p>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function MomentumSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 space-y-4">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
          <div className="flex justify-between">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-16" />
          </div>
          <Skeleton className="h-12 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-xl" />
            <Skeleton className="h-14 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tips ─────────────────────────────────────────────────────────────────────

function MomentumTip({ tier }: { tier: MomentumTier }) {
  const tips: Record<MomentumTier, { heading: string; actions: string[] }> = {
    surging: {
      heading: "You're on fire — here's how to sustain it",
      actions: [
        'Post arguments on topics near the 60% threshold — your voice matters most there.',
        'Challenge another citizen to a debate to capitalise on your momentum.',
        'Share your stance card to recruit allies to your position.',
      ],
    },
    building: {
      heading: "You're gaining — keep going",
      actions: [
        'Aim to vote on at least 3 topics today to maintain your streak.',
        'Add a cited argument — sourced arguments earn more upvotes.',
        "Join an active coalition to amplify your reach.",
      ],
    },
    steady: {
      heading: 'Consistent — push for more impact',
      actions: [
        'Explore a new category to broaden your civic footprint.',
        'Reply to a counterargument with a well-reasoned rebuttal.',
        'RSVP to an upcoming debate to lock in a participation spike.',
      ],
    },
    easing: {
      heading: "Activity has slowed — here's how to re-engage",
      actions: [
        'Vote on 5 topics today — it only takes 2 minutes and breaks the drift.',
        'Write one argument on a topic you care about.',
        "Check /briefing for today's most actionable items.",
      ],
    },
    fading: {
      heading: "Your voice is needed — let's reverse this",
      actions: [
        "Start with one vote. It resets the momentum counter.",
        'Visit /training to sharpen your argument skills offline.',
        'Set a 5-minute civic daily timer to rebuild the habit.',
      ],
    },
  }

  const tip = tips[tier]
  const cfg = TIER_CONFIG[tier]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn('rounded-2xl border p-5', cfg.bg, cfg.border)}
    >
      <div className="flex items-center gap-2 mb-3">
        <Zap className={cn('h-4 w-4 flex-shrink-0', cfg.color)} aria-hidden />
        <h3 className={cn('font-mono text-sm font-bold', cfg.color)}>{tip.heading}</h3>
      </div>
      <ul className="space-y-2">
        {tip.actions.map((action, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn('font-mono text-xs font-bold mt-0.5 flex-shrink-0', cfg.color)}>
              {i + 1}.
            </span>
            <p className="text-xs font-mono text-surface-400 leading-relaxed">{action}</p>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MomentumPage() {
  const router = useRouter()
  const [data, setData] = useState<MomentumResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/analytics/momentum', { cache: 'no-store' })
      if (res.status === 401) { router.replace('/login'); return }
      if (!res.ok) throw new Error('failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const tier = data ? TIER_CONFIG[data.overall_tier] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Activity className="h-5 w-5 text-for-400" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Momentum Report</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Is your civic engagement accelerating?
              </p>
            </div>
          </div>

          <p className="text-sm font-mono text-surface-400 leading-relaxed">
            Compares your last 4 weeks of activity to the prior 4 weeks across
            voting, arguing, and reputation. A score above zero means you&apos;re
            gaining momentum; below zero means slowing down.
          </p>
        </div>

        {/* ── Content ─────────────────────────────────────────────────── */}
        {loading ? (
          <MomentumSkeleton />
        ) : error ? (
          <EmptyState
            icon={<Activity className="h-6 w-6 text-against-400" />}
            title="Couldn't load momentum data"
            description="Something went wrong. Try refreshing."
            action={
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            }
          />
        ) : data && !data.has_data ? (
          <EmptyState
            icon={<Flame className="h-6 w-6 text-for-400" />}
            title="No momentum data yet"
            description="Start voting and posting arguments to build your civic momentum."
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-for-500/10 border border-for-500/30 text-sm font-mono font-semibold text-for-400 hover:bg-for-500/20 transition-colors"
              >
                Browse topics
                <ArrowRight className="h-4 w-4" />
              </Link>
            }
          />
        ) : data ? (
          <div className="space-y-6">

            {/* ── Overall momentum card ──────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border p-6 space-y-5',
                'bg-surface-100',
                tier?.border,
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-1">
                    Overall Momentum
                  </p>
                  <div className="flex items-center gap-3">
                    {tier && (() => { const I = tier.icon; return <I className={cn('h-6 w-6', tier.color)} aria-hidden /> })()}
                    <h2 className={cn('font-mono text-3xl font-bold', tier?.color)}>
                      {tier?.label}
                    </h2>
                  </div>
                  <p className="text-sm font-mono text-surface-400 mt-1.5 leading-relaxed">
                    {tier?.desc}
                  </p>
                </div>
                <div className={cn(
                  'flex-shrink-0 h-16 w-16 rounded-2xl border flex items-center justify-center',
                  tier?.bg, tier?.border,
                )}>
                  <span className={cn('font-mono text-xl font-bold', tier?.color)}>
                    {data.overall_score > 0 ? '+' : ''}{data.overall_score}
                  </span>
                </div>
              </div>

              {/* Meter */}
              <MomentumMeter score={data.overall_score} />

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-surface-300 bg-surface-200/60 px-3 py-3 text-center">
                  <Vote className="h-3.5 w-3.5 text-for-400 mx-auto mb-1" aria-hidden />
                  <p className="font-mono text-base font-bold text-white">
                    <AnimatedNumber value={data.total_votes} />
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">Total votes</p>
                </div>
                <div className="rounded-xl border border-surface-300 bg-surface-200/60 px-3 py-3 text-center">
                  <MessageSquare className="h-3.5 w-3.5 text-purple mx-auto mb-1" aria-hidden />
                  <p className="font-mono text-base font-bold text-white">
                    <AnimatedNumber value={data.total_arguments} />
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">Arguments</p>
                </div>
                <div className="rounded-xl border border-surface-300 bg-surface-200/60 px-3 py-3 text-center">
                  <Coins className="h-3.5 w-3.5 text-gold mx-auto mb-1" aria-hidden />
                  <p className="font-mono text-base font-bold text-white">
                    <AnimatedNumber value={data.clout_now} />
                  </p>
                  <p className="text-[10px] font-mono text-surface-500 mt-0.5">Clout</p>
                </div>
              </div>
            </motion.div>

            {/* ── Dimension cards ────────────────────────────────────── */}
            <DimensionCard dim={data.voting}     field="votes" />
            <DimensionCard dim={data.arguing}    field="arguments" />
            <DimensionCard dim={data.reputation} field="upvotes_received" />

            {/* ── Tips ───────────────────────────────────────────────── */}
            <MomentumTip tier={data.overall_tier} />

            {/* ── Related analytics links ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
            >
              <h3 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-3">
                Dig deeper
              </h3>
              <div className="space-y-2">
                {[
                  { href: '/analytics/growth',   label: 'Activity Growth',  desc: 'Monthly cumulative chart',  color: 'text-emerald' },
                  { href: '/analytics/velocity',  label: 'Argument Velocity', desc: 'Upvote speed per argument', color: 'text-for-400' },
                  { href: '/analytics/streak',    label: 'Vote Streak',       desc: 'Daily voting consistency',  color: 'text-gold' },
                  { href: '/analytics/persuasion', label: 'Persuasion Power', desc: 'Normalised argument impact', color: 'text-purple' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-200/60 transition-colors group"
                  >
                    <div>
                      <p className={cn('font-mono text-sm font-semibold', link.color)}>{link.label}</p>
                      <p className="text-xs font-mono text-surface-500">{link.desc}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </motion.div>

          </div>
        ) : null}

      </main>

      <BottomNav />
    </div>
  )
}
