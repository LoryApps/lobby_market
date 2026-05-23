'use client'

/**
 * /analytics/velocity — Argument Velocity Report
 *
 * Ranks your arguments by upvote velocity (upvotes ÷ days since posting).
 * Reveals evergreen arguments that keep earning long after posting, surging
 * newcomers gaining fast, and peaked classics that once shone brightly.
 *
 * Distinct from:
 *   /analytics/impact     — raw upvote totals and reach
 *   /analytics/arguments  — quality grades and argument portfolio
 *   /analytics/resonance  — cross-partisan appeal
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Flame,
  Leaf,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  VelocityResponse,
  VelocityArgument,
  VelocityLabel,
} from '@/app/api/analytics/velocity/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-gold',
}

const LABEL_META: Record<
  VelocityLabel,
  { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  evergreen: {
    label: 'Evergreen',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    icon: Leaf,
  },
  surging: {
    label: 'Surging',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: TrendingUp,
  },
  peaked: {
    label: 'Peaked',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: TrendingDown,
  },
  steady: {
    label: 'Steady',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    icon: Activity,
  },
  dormant: {
    label: 'Dormant',
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-500/20',
    icon: TrendingDown,
  },
}

function truncate(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}

function formatVelocity(v: number): string {
  if (v >= 10) return `${Math.round(v)}/d`
  if (v >= 1) return `${v.toFixed(1)}/d`
  if (v >= 0.1) return `${v.toFixed(2)}/d`
  return `${(v * 7).toFixed(2)}/wk`
}

function formatAge(days: number): string {
  if (days < 1) return 'today'
  if (days === 1) return '1 day old'
  if (days < 7) return `${days} days old`
  if (days < 30) return `${Math.floor(days / 7)}w old`
  if (days < 365) return `${Math.floor(days / 30)}mo old`
  return `${Math.floor(days / 365)}yr old`
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
  animateValue,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  label: string
  value: string | number
  sub?: string
  animateValue?: number
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
        <p className="text-xs font-mono text-surface-500 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] font-mono text-surface-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Argument Row ─────────────────────────────────────────────────────────────

function ArgRow({ arg, rank }: { arg: VelocityArgument; rank: number }) {
  const meta = LABEL_META[arg.label]
  const LabelIcon = meta.icon
  const catColor = CATEGORY_COLOR[arg.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 hover:border-surface-400/60 transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Rank */}
        <span className="font-mono text-xs text-surface-500 w-5 shrink-0 text-right mt-0.5 tabular-nums">
          {rank + 1}
        </span>

        {/* Side pill */}
        <span
          className={cn(
            'shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase',
            arg.side === 'blue'
              ? 'bg-for-500/20 text-for-300 border border-for-500/30'
              : 'bg-against-500/20 text-against-300 border border-against-500/30',
          )}
        >
          {arg.side === 'blue' ? 'For' : 'Against'}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug">
            {truncate(arg.content, 120)}
          </p>
          <Link
            href={`/topic/${arg.topic_id}`}
            className={cn('text-[11px] font-mono mt-1 hover:underline truncate block', catColor)}
          >
            {truncate(arg.statement, 80)}
          </Link>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <ThumbsUp className="h-3 w-3" />{arg.upvotes}
            </span>
            <span className="text-[11px] font-mono text-surface-500">
              {formatAge(arg.age_days)}
            </span>
            <span className={cn('flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded-full border', meta.bg, meta.border, meta.color)}>
              <LabelIcon className="h-2.5 w-2.5" />
              {meta.label}
            </span>
          </div>
        </div>

        {/* Velocity badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-mono text-base font-bold text-white tabular-nums">
            {formatVelocity(arg.velocity)}
          </span>
          <span className="text-[10px] font-mono text-surface-500">velocity</span>
          <Link
            href={`/topic/${arg.topic_id}`}
            className="text-surface-500 hover:text-white transition-colors"
            aria-label="View topic"
          >
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Tab ──────────────────────────────────────────────────────────────────────

type Tab = 'velocity' | 'evergreen' | 'peaked'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VelocityPage() {
  const router = useRouter()
  const [data, setData] = useState<VelocityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('velocity')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/velocity', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as VelocityResponse)
    } catch {
      setError('Could not load velocity data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const list =
    tab === 'velocity'
      ? (data?.top_by_velocity ?? [])
      : tab === 'evergreen'
      ? (data?.evergreen ?? [])
      : (data?.peaked ?? [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-surface-500 hover:text-white text-xs font-mono transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 shrink-0 mt-0.5">
                <Zap className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Argument Velocity
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Upvotes per day — which arguments keep running
                </p>
              </div>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40 shrink-0 mt-1"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-center">
            <p className="text-against-400 font-mono text-sm">{error}</p>
            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        )}

        {/* ── No arguments ── */}
        {!loading && !error && data && !data.viewer_has_arguments && (
          <EmptyState
            icon={Scale}
            title="No arguments yet"
            description="Start writing arguments on topics to track their velocity over time."
            action={{ label: 'Browse Topics', href: '/topics' }}
          />
        )}

        {/* ── Content ── */}
        {!loading && !error && data && data.viewer_has_arguments && (
          <div className="space-y-6">

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={Zap}
                iconColor="text-for-400"
                iconBg="bg-for-500/10"
                label="Total Arguments"
                value={data.total_arguments}
                animateValue={data.total_arguments}
              />
              <StatCard
                icon={Activity}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                label="Avg Velocity"
                value={data.avg_velocity !== null ? formatVelocity(data.avg_velocity) : '—'}
              />
              <StatCard
                icon={Leaf}
                iconColor="text-emerald"
                iconBg="bg-emerald/10"
                label="Evergreen"
                value={data.evergreen_count}
                sub="still running"
                animateValue={data.evergreen_count}
              />
              <StatCard
                icon={TrendingUp}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                label="Surging"
                value={data.surging_count}
                sub="gaining fast"
                animateValue={data.surging_count}
              />
            </div>

            {/* Velocity legend */}
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4">
              <p className="text-xs font-mono text-surface-500 mb-3 uppercase tracking-wide">Velocity labels</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(LABEL_META) as [VelocityLabel, typeof LABEL_META[VelocityLabel]][]).map(([key, meta]) => {
                  const Icon = meta.icon
                  return (
                    <span
                      key={key}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border',
                        meta.bg, meta.border, meta.color
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  )
                })}
              </div>
              <p className="text-[11px] font-mono text-surface-500 mt-3 leading-relaxed">
                <strong className="text-emerald">Evergreen</strong> = &gt;7 days old, ≥0.5 upvotes/day ·{' '}
                <strong className="text-for-400">Surging</strong> = ≤7 days old, ≥2 upvotes/day ·{' '}
                <strong className="text-gold">Peaked</strong> = ≥5 upvotes but now quiet
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-200 border border-surface-300/60 w-fit">
              {([
                { id: 'velocity' as Tab, label: 'Top Velocity', icon: Zap },
                { id: 'evergreen' as Tab, label: 'Evergreen', icon: Leaf },
                { id: 'peaked' as Tab, label: 'Peaked', icon: TrendingDown },
              ]).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-mono transition-all',
                    tab === id
                      ? 'bg-surface-100 text-white shadow-sm border border-surface-300/60'
                      : 'text-surface-500 hover:text-white'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{label.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Argument list */}
            <AnimatePresence mode="wait">
              {list.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <EmptyState
                    icon={tab === 'peaked' ? TrendingDown : Leaf}
                    title={
                      tab === 'velocity'
                        ? 'No arguments yet'
                        : tab === 'evergreen'
                        ? 'No evergreen arguments yet'
                        : 'No peaked arguments'
                    }
                    description={
                      tab === 'velocity'
                        ? 'Start writing arguments to see velocity rankings.'
                        : tab === 'evergreen'
                        ? 'Write arguments on compelling topics — the best ones keep earning upvotes long after posting.'
                        : 'Arguments with strong early bursts but lower recent activity will appear here.'
                    }
                    action={{ label: 'Browse Topics', href: '/topics' }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {list.map((arg, i) => (
                    <ArgRow key={arg.id} arg={arg} rank={i} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Category velocity breakdown */}
            {data.category_velocity.length > 0 && (
              <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wide mb-3">
                  Average velocity by category
                </p>
                <div className="space-y-2.5">
                  {data.category_velocity.map((cat) => {
                    const maxV = data.category_velocity[0]?.avg_velocity ?? 1
                    const barWidth = Math.round((cat.avg_velocity / Math.max(maxV, 0.01)) * 100)
                    const catColor = CATEGORY_COLOR[cat.category] ?? 'text-surface-400'
                    return (
                      <div key={cat.category} className="flex items-center gap-3">
                        <span className={cn('font-mono text-xs w-24 shrink-0 truncate', catColor)}>
                          {cat.category}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-for-500 transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs text-surface-400 w-16 text-right tabular-nums">
                          {formatVelocity(cat.avg_velocity)}
                        </span>
                        <span className="font-mono text-[10px] text-surface-600 w-8 text-right tabular-nums">
                          ×{cat.arguments}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Related links */}
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 space-y-2">
              <p className="text-xs font-mono text-surface-500 uppercase tracking-wide mb-3">Related analytics</p>
              {[
                { href: '/analytics/impact',    icon: BarChart2,  label: 'Argument Impact',    sub: 'Raw upvotes, reach, and debate win rate' },
                { href: '/analytics/resonance', icon: Flame,      label: 'Civic Resonance',    sub: 'Arguments that crossed the partisan divide' },
                { href: '/analytics/arguments', icon: ArrowRight, label: 'Argument Portfolio', sub: 'Quality grades and category breakdown' },
              ].map(({ href, icon: Icon, label, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-200 transition-colors group"
                >
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-white">{label}</p>
                    <p className="text-xs font-mono text-surface-500">{sub}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
