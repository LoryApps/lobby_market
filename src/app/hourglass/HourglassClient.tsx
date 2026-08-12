'use client'

/**
 * /hourglass — Civic Hourglass
 *
 * A funnel visualization of every topic's lifecycle: Proposed → Active → Voting → Law.
 * Shows how many topics exist at each stage, the average time spent there,
 * conversion rates, and a per-category breakdown.
 *
 * Distinct from:
 *   /momentum  — per-topic vote velocity
 *   /velocity  — category sparklines
 *   /pipeline  — (doesn't exist) — this IS the pipeline view
 *   /tide      — 30-day platform sentiment macro
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  BarChart2,
  ChevronRight,
  Clock,
  Gavel,
  Layers,
  RefreshCw,
  Scale,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { HourglassData, StageStats } from '@/app/api/hourglass/route'

// ─── Stage config ──────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, {
  icon: typeof Layers
  color: string
  border: string
  bg: string
  glow: string
  barColor: string
}> = {
  proposed: {
    icon: Layers,
    color: 'text-surface-600',
    border: 'border-surface-400/40',
    bg: 'bg-surface-300/20',
    glow: '',
    barColor: 'bg-surface-500',
  },
  active: {
    icon: Zap,
    color: 'text-for-400',
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    glow: 'shadow-for-500/10',
    barColor: 'bg-for-500',
  },
  voting: {
    icon: Scale,
    color: 'text-purple',
    border: 'border-purple/40',
    bg: 'bg-purple/10',
    glow: 'shadow-purple/10',
    barColor: 'bg-purple',
  },
  law: {
    icon: Gavel,
    color: 'text-gold',
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    glow: 'shadow-gold/10',
    barColor: 'bg-gold',
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'bg-gold/20 text-gold',
  Politics:    'bg-for-500/20 text-for-400',
  Technology:  'bg-purple/20 text-purple',
  Science:     'bg-emerald/20 text-emerald',
  Ethics:      'bg-against-500/20 text-against-400',
  Philosophy:  'bg-for-300/20 text-for-300',
  Culture:     'bg-pink-500/20 text-pink-400',
  Health:      'bg-rose-500/20 text-rose-400',
  Environment: 'bg-emerald/20 text-emerald',
  Education:   'bg-purple/20 text-purple',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDays(days: number | null) {
  if (days === null) return '—'
  if (days < 1) return '<1d'
  if (days < 7) return `${Math.round(days)}d`
  return `${Math.round(days / 7)}w`
}

function topCategories(breakdown: Record<string, number>, limit = 3) {
  return Object.entries(breakdown)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
}

// ─── Stage card ────────────────────────────────────────────────────────────────

function StageCard({
  stage,
  maxCount,
  isLast,
  delay,
}: {
  stage: StageStats
  maxCount: number
  isLast: boolean
  delay: number
}) {
  const cfg = STAGE_CONFIG[stage.status] ?? STAGE_CONFIG.proposed
  const Icon = cfg.icon
  const widthPct = maxCount > 0 ? Math.max(8, (stage.count / maxCount) * 100) : 8

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <div
        className={cn(
          'rounded-2xl border p-5 shadow-lg transition-shadow',
          cfg.border,
          cfg.bg,
          cfg.glow && `shadow-md ${cfg.glow}`,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', cfg.border, cfg.bg)}>
              <Icon className={cn('h-4 w-4', cfg.color)} aria-hidden="true" />
            </div>
            <div>
              <h2 className={cn('font-mono text-base font-bold', cfg.color)}>{stage.label}</h2>
              <p className="font-mono text-xs text-surface-500 mt-0.5">
                {stage.count.toLocaleString()} topic{stage.count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Conversion badge */}
          {stage.conversion_to_next !== null && (
            <div className={cn('text-xs font-mono px-2.5 py-1 rounded-full border', cfg.border, cfg.bg, cfg.color)}>
              {stage.conversion_to_next}% → next
            </div>
          )}
        </div>

        {/* Volume bar */}
        <div className="mb-4">
          <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', cfg.barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${widthPct}%` }}
              transition={{ duration: 0.7, delay: delay + 0.15, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl bg-surface-200/40 p-3 text-center">
            <div className={cn('font-mono text-xl font-bold', cfg.color)}>
              {stage.avg_votes.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] text-surface-500 mt-0.5 uppercase tracking-wide">
              avg votes
            </div>
          </div>
          <div className="rounded-xl bg-surface-200/40 p-3 text-center">
            <div className={cn('font-mono text-xl font-bold', cfg.color)}>
              {formatDays(stage.avg_days_in_stage)}
            </div>
            <div className="font-mono text-[10px] text-surface-500 mt-0.5 uppercase tracking-wide">
              avg age
            </div>
          </div>
        </div>

        {/* Top categories */}
        {topCategories(stage.category_breakdown).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {topCategories(stage.category_breakdown).map(([cat, n]) => (
              <span
                key={cat}
                className={cn('text-[11px] font-mono px-2 py-0.5 rounded-full', CATEGORY_COLOR[cat] ?? 'bg-surface-300/30 text-surface-500')}
              >
                {cat} · {n}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Connector arrow */}
      {!isLast && (
        <div className="flex justify-center my-2">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-0.5 h-3 bg-surface-400/40 rounded-full" />
            <ArrowDown className="h-4 w-4 text-surface-500" aria-hidden="true" />
            <div className="w-0.5 h-3 bg-surface-400/40 rounded-full" />
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Category breakdown table ─────────────────────────────────────────────────

function CategoryMatrix({ stages }: { stages: StageStats[] }) {
  const CATS = Object.keys(CATEGORY_COLOR)

  // Find categories with at least some data
  const activeCats = CATS.filter(cat =>
    stages.some(s => (s.category_breakdown[cat] ?? 0) > 0)
  )

  if (activeCats.length === 0) return null

  return (
    <motion.div
      className="rounded-2xl border border-surface-300/30 bg-surface-100/60 p-5 overflow-x-auto"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
    >
      <h3 className="font-mono text-sm font-bold text-white mb-4 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-surface-500" aria-hidden="true" />
        Category × Stage
      </h3>

      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr>
            <th className="text-left text-surface-500 pb-2 pr-3 font-normal">Category</th>
            {stages.map(s => (
              <th key={s.status} className={cn('text-center pb-2 px-2 font-normal', STAGE_CONFIG[s.status]?.color ?? 'text-surface-500')}>
                {s.label.split(' ')[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeCats.map((cat) => (
            <tr key={cat} className="border-t border-surface-300/20">
              <td className="py-1.5 pr-3">
                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px]', CATEGORY_COLOR[cat] ?? 'text-surface-500 bg-surface-300/30')}>
                  {cat}
                </span>
              </td>
              {stages.map(s => {
                const n = s.category_breakdown[cat] ?? 0
                return (
                  <td key={s.status} className="text-center py-1.5 px-2">
                    <span className={n > 0 ? 'text-surface-700' : 'text-surface-400'}>
                      {n > 0 ? n : '—'}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function HourglassClient() {
  const [data, setData] = useState<HourglassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hourglass')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: HourglassData = await res.json()
      setData(json)
    } catch {
      setError('Could not load hourglass data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxCount = data
    ? Math.max(...data.stages.map(s => s.count), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
                <Layers className="h-5 w-5 text-gold" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Hourglass</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  The full topic pipeline · Proposal → Law
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh hourglass data"
              className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>

          {/* Platform summary */}
          {data && (
            <motion.div
              className="mt-4 grid grid-cols-3 gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="rounded-xl bg-surface-100/60 border border-surface-300/30 p-3 text-center">
                <div className="font-mono text-xl font-bold text-white">
                  {data.total_topics.toLocaleString()}
                </div>
                <div className="font-mono text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">
                  Total Topics
                </div>
              </div>
              <div className="rounded-xl bg-gold/10 border border-gold/30 p-3 text-center">
                <div className="font-mono text-xl font-bold text-gold">
                  {data.total_laws.toLocaleString()}
                </div>
                <div className="font-mono text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">
                  Laws Passed
                </div>
              </div>
              <div className="rounded-xl bg-emerald/10 border border-emerald/30 p-3 text-center">
                <div className="font-mono text-xl font-bold text-emerald">
                  {data.overall_law_rate}%
                </div>
                <div className="font-mono text-[10px] text-surface-500 uppercase tracking-wide mt-0.5">
                  Law Rate
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            title="Hourglass unavailable"
            description={error}
            icon={Layers}
          />
        ) : data && data.stages.length > 0 ? (
          <div>
            {/* Funnel stages */}
            <div className="mb-8">
              {data.stages.map((stage, i) => (
                <StageCard
                  key={stage.status}
                  stage={stage}
                  maxCount={maxCount}
                  isLast={i === data.stages.length - 1}
                  delay={i * 0.1}
                />
              ))}
            </div>

            {/* Category × Stage matrix */}
            <CategoryMatrix stages={data.stages} />

            {/* How it works */}
            <motion.div
              className="mt-6 rounded-2xl border border-surface-300/20 bg-surface-100/30 p-5"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.8 }}
            >
              <h3 className="font-mono text-sm font-bold text-surface-600 mb-3 flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                How the pipeline works
              </h3>
              <div className="space-y-2.5">
                {[
                  { icon: Layers, label: 'Proposed', desc: 'New topics gather signatures to activate.' },
                  { icon: Zap, label: 'Active Debate', desc: 'Voting opens and arguments are posted.' },
                  { icon: Scale, label: 'In Voting', desc: 'Formal resolution window — final votes counted.' },
                  { icon: Gavel, label: 'Established Law', desc: 'Reached consensus threshold and was ratified.' },
                ].map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <span className="font-mono text-xs font-semibold text-surface-700">{label}</span>
                      <span className="font-mono text-xs text-surface-500"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* CTA links */}
            <motion.div
              className="mt-6 flex flex-wrap gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.0 }}
            >
              {[
                { href: '/topics', label: 'Browse All Topics', icon: Layers },
                { href: '/laws', label: 'View Established Laws', icon: Gavel },
                { href: '/momentum', label: 'Vote Momentum', icon: TrendingUp },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-700 transition-colors border border-surface-300/30 rounded-lg px-3 py-1.5 hover:border-surface-400/50"
                >
                  <Icon className="h-3 w-3" aria-hidden="true" />
                  {label}
                  <ChevronRight className="h-3 w-3 ml-0.5" aria-hidden="true" />
                </Link>
              ))}
            </motion.div>

            {/* Snapshot timestamp */}
            {data.snapshot_at && (
              <p className="mt-6 text-center font-mono text-[11px] text-surface-400">
                <Clock className="inline h-3 w-3 mr-1 mb-0.5" aria-hidden="true" />
                Snapshot at {new Date(data.snapshot_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            title="No pipeline data"
            description="Topics will appear here once they are created."
            icon={Layers}
          />
        )}
      </main>

      <BottomNav />
    </div>
  )
}
