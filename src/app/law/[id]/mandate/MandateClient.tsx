'use client'

/**
 * /law/[id]/mandate — Civic Mandate Analysis
 *
 * Shows how decisively a law passed:
 *  - Mandate class (Decisive / Strong) with score and percentile rank
 *  - Vote distribution (FOR vs AGAINST)
 *  - Daily vote trend chart built from raw timestamps
 *  - Comparable laws at a similar mandate level
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  Gavel,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MandateResponse, ComparableLaw, DailyBucket } from '@/app/api/laws/[id]/mandate/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  statement: string
  category: string | null
  establishedAt: string
  bluePct: number
  totalVotes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// ─── Mandate class colours ────────────────────────────────────────────────────

function mandateColors(cls: 'decisive' | 'strong') {
  if (cls === 'decisive') {
    return {
      badge: 'bg-gold/20 border border-gold/40 text-gold',
      bar: 'bg-gold',
      glow: 'shadow-gold/20',
    }
  }
  return {
    badge: 'bg-emerald/20 border border-emerald/40 text-emerald',
    bar: 'bg-emerald',
    glow: 'shadow-emerald/20',
  }
}

// ─── Trend Chart (SVG inline) ─────────────────────────────────────────────────

function TrendChart({ buckets }: { buckets: DailyBucket[] }) {
  if (buckets.length < 3) {
    return (
      <div className="flex items-center justify-center h-28 text-sm text-surface-500 font-mono">
        Not enough data to draw trend
      </div>
    )
  }

  const visible = buckets.slice(-60) // last 60 days max
  const W = 600
  const H = 90
  const yMin = 70  // all laws ≥ 75% so zoom in on 70–100 range
  const yMax = 100

  const pts = visible.map((b, i) => {
    const x = (i / (visible.length - 1)) * W
    const y = H - ((b.running_for_pct - yMin) / (yMax - yMin)) * H
    return `${x},${y}`
  })

  const poly = pts.join(' ')
  const area =
    `M0,${H} ` +
    pts.map((p, i) => (i === 0 ? `L${p}` : `L${p}`)).join(' ') +
    ` L${W},${H} Z`

  // Threshold line at 75%
  const thresholdY = H - ((75 - yMin) / (yMax - yMin)) * H

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      {/* 75% law threshold line */}
      <line
        x1="0" y1={thresholdY} x2={W} y2={thresholdY}
        stroke="rgb(234 179 8 / 0.3)" strokeWidth="1.5" strokeDasharray="6 4"
      />
      {/* Area fill */}
      <path d={area} fill="rgb(34 197 94 / 0.08)" />
      {/* Line */}
      <polyline points={poly} fill="none" stroke="rgb(34 197 94 / 0.8)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Comparable law card ──────────────────────────────────────────────────────

function ComparableCard({ law }: { law: ComparableLaw }) {
  const forPct = Math.round(law.blue_pct)
  return (
    <Link
      href={`/law/${law.id}/mandate`}
      className={cn(
        'block rounded-lg border border-surface-300 bg-surface-200 px-4 py-3',
        'hover:border-surface-400 hover:bg-surface-300 transition-colors',
      )}
    >
      <p className="text-sm font-medium text-white leading-snug line-clamp-2 mb-1.5">
        {law.statement}
      </p>
      <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span>{fmtNum(law.total_votes)} votes</span>
        {law.category && <span className="text-surface-600">{law.category}</span>}
      </div>
    </Link>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-white',
}: {
  icon: typeof Award
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-200 px-4 py-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-surface-500 text-xs font-mono">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={cn('text-2xl font-bold font-mono', color)}>{value}</p>
      {sub && <p className="text-xs text-surface-500 font-mono">{sub}</p>}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
      <Skeleton className="h-5 w-32 mb-6" />
      <Skeleton className="h-8 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-8" />
      <Skeleton className="h-28 w-full rounded-xl mb-6" />
      <div className="grid grid-cols-2 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-6 w-40 mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-lg mb-3" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MandateClient({
  lawId,
  statement,
  category,
  establishedAt,
  bluePct,
  totalVotes,
}: Props) {
  const [data, setData] = useState<MandateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/laws/${lawId}/mandate`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [lawId])

  const forPct = Math.round(bluePct)

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <LoadingSkeleton />
        <BottomNav />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          <EmptyState
            icon={Scale}
            title="Mandate data unavailable"
            description="Could not load mandate analysis for this law."
          />
        </div>
        <BottomNav />
      </div>
    )
  }

  const { mandate, comparable_laws, daily_trend } = data
  const colors = mandateColors(mandate.class)

  const staggerItem = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: i * 0.07 },
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Back */}
        <motion.div {...staggerItem(0)}>
          <Link
            href={`/law/${lawId}`}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to law
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div {...staggerItem(1)} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Gavel className="h-5 w-5 text-gold" />
            <span className="text-xs font-mono text-gold uppercase tracking-widest">Civic Mandate</span>
          </div>
          <h1 className="text-xl font-bold text-white leading-snug mb-1">
            {statement}
          </h1>
          <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
            {category && <span className="text-surface-400">{category}</span>}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {fmtDate(establishedAt)}
            </span>
          </div>
        </motion.div>

        {/* Mandate class badge + meter */}
        <motion.div
          {...staggerItem(2)}
          className={cn(
            'rounded-2xl border bg-surface-100 p-5 mb-6 shadow-lg',
            mandate.class === 'decisive' ? 'border-gold/30' : 'border-emerald/30',
            colors.glow,
          )}
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold mb-2', colors.badge)}>
                {mandate.class === 'decisive' ? <Trophy className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {mandate.label}
              </span>
              <p className="text-sm text-surface-400 max-w-sm leading-relaxed">
                {mandate.description}
              </p>
            </div>
            <div className="text-right ml-4 flex-shrink-0">
              <p className={cn('text-4xl font-bold font-mono', mandate.class === 'decisive' ? 'text-gold' : 'text-emerald')}>
                {forPct}%
              </p>
              <p className="text-xs font-mono text-surface-500">FOR</p>
            </div>
          </div>

          {/* Mandate meter — shows 70–100% range */}
          <div className="relative">
            <div className="flex items-center justify-between text-[10px] font-mono text-surface-600 mb-1">
              <span>70%</span>
              <span className="text-gold">75% law threshold</span>
              <span>100%</span>
            </div>
            <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
                style={{ width: `${Math.min(100, ((forPct - 70) / 30) * 100)}%` }}
              />
            </div>
            {/* Threshold tick at 75% = 16.67% into meter */}
            <div
              className="absolute top-5 bottom-0 w-px bg-gold/60"
              style={{ left: `${((75 - 70) / 30) * 100}%` }}
            />
          </div>
        </motion.div>

        {/* Stat tiles */}
        <motion.div {...staggerItem(3)} className="grid grid-cols-2 gap-3 mb-6">
          <StatTile
            icon={ThumbsUp}
            label="FOR votes"
            value={fmtNum(mandate.for_votes)}
            sub={`${forPct}% of total`}
            color="text-for-400"
          />
          <StatTile
            icon={ThumbsDown}
            label="AGAINST votes"
            value={fmtNum(mandate.against_votes)}
            sub={`${100 - forPct}% of total`}
            color="text-against-400"
          />
          <StatTile
            icon={Users}
            label="Total votes"
            value={fmtNum(totalVotes)}
          />
          <StatTile
            icon={Clock}
            label="Days to pass"
            value={`${data.law.days_to_pass}d`}
            sub="from proposal to law"
          />
        </motion.div>

        {/* Percentile rank */}
        <motion.div
          {...staggerItem(4)}
          className="rounded-xl border border-surface-300 bg-surface-200 p-4 mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Award className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold text-white">Mandate Rank</h2>
          </div>
          <p className="text-sm text-surface-400 mb-3">
            This law is in the{' '}
            <span className={cn('font-bold', mandate.class === 'decisive' ? 'text-gold' : 'text-emerald')}>
              {ordinal(mandate.percentile)} percentile
            </span>{' '}
            of all {fmtNum(mandate.total_laws)} laws by mandate strength — stronger than{' '}
            {fmtNum(mandate.stronger_than_count)} other laws.
          </p>
          {/* Percentile bar */}
          <div className="h-2.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn('h-full rounded-full', colors.bar)}
              style={{ width: `${mandate.percentile}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-surface-600 mt-1">
            <span>Weakest</span>
            <span>{mandate.percentile}th pct</span>
            <span>Strongest</span>
          </div>
        </motion.div>

        {/* Vote trend */}
        {daily_trend.length >= 3 && (
          <motion.div
            {...staggerItem(5)}
            className="rounded-xl border border-surface-300 bg-surface-200 p-4 mb-6"
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="h-4 w-4 text-emerald" />
              <h2 className="text-sm font-semibold text-white">Mandate Build-Up</h2>
              <span className="text-xs font-mono text-surface-500 ml-auto">
                Running FOR%
              </span>
            </div>
            <TrendChart buckets={daily_trend} />
            <p className="text-[10px] font-mono text-surface-600 mt-2 text-center">
              Dashed line = 75% law threshold · Chart shows last {Math.min(daily_trend.length, 60)} data points
            </p>
          </motion.div>
        )}

        {/* Comparable laws */}
        {comparable_laws.length > 0 && (
          <motion.div {...staggerItem(6)}>
            <div className="flex items-center gap-2 mb-3">
              <Scale className="h-4 w-4 text-surface-400" />
              <h2 className="text-sm font-semibold text-white">Laws with Similar Mandate</h2>
              <span className="text-xs font-mono text-surface-500 ml-auto">±3%</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {comparable_laws.map((law, i) => (
                <motion.div key={law.id} {...staggerItem(7 + i)}>
                  <ComparableCard law={law} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {comparable_laws.length === 0 && (
          <motion.div {...staggerItem(6)} className="mt-4">
            <p className="text-sm text-surface-500 font-mono text-center">
              No comparable laws found at ±3% of {forPct}% FOR
            </p>
          </motion.div>
        )}

      </div>

      <BottomNav />
    </div>
  )
}
