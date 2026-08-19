'use client'

/**
 * /thesis/calibration — Thesis Calibration Engine
 *
 * Answers: "When the community is X% confident in a thesis, how often is it
 * actually vindicated?" Surfaces:
 *
 *   • Calibration curve — confidence bucket → historical vindication rate
 *   • Category breakdown — which fields produce the most accurate collective predictions
 *   • High-confidence active theses — the Lobby's strongest current convictions
 *   • Contested theses — closest to 50/50, most uncertain
 *   • Expiring soon — active theses with resolution dates in the next 30 days
 *
 * Distinct from:
 *   /thesis/analytics — overall predictor leaderboard & platform stats
 *   /thesis/hot       — currently trending by engagement
 *   /thesis/map       — geographic/category map of theses
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  CheckCircle2,
  Clock,
  Flame,
  Gauge,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CalibrationResponse,
  CalibrationBucket,
  CalibrationCategoryRow,
  ActiveThesisRow,
} from '@/app/api/thesis/calibration/route'

// ─── Color maps ───────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  economics:   'text-gold',
  politics:    'text-for-400',
  technology:  'text-purple',
  science:     'text-emerald',
  ethics:      'text-against-400',
  philosophy:  'text-for-300',
  culture:     'text-against-300',
  health:      'text-emerald',
  environment: 'text-emerald',
  education:   'text-for-400',
}

const CAT_BG: Record<string, string> = {
  economics:   'bg-gold/10 border-gold/25',
  politics:    'bg-for-500/10 border-for-500/25',
  technology:  'bg-purple/10 border-purple/25',
  science:     'bg-emerald/10 border-emerald/25',
  ethics:      'bg-against-500/10 border-against-500/25',
  philosophy:  'bg-for-500/8 border-for-500/20',
  culture:     'bg-against-500/8 border-against-500/20',
  health:      'bg-emerald/10 border-emerald/25',
  environment: 'bg-emerald/10 border-emerald/25',
  education:   'bg-for-500/10 border-for-500/25',
}

// ─── Calibration quality helpers ──────────────────────────────────────────────

function calibrationQuality(
  minPct: number,
  maxPct: number,
  vindicationRate: number
): { label: string; color: string } {
  const midpoint = (minPct + maxPct) / 2
  const expected = midpoint // for a perfectly calibrated crowd, vindication_rate ≈ confidence
  const diff = Math.abs(vindicationRate - expected)
  if (diff <= 10) return { label: 'Well calibrated', color: 'text-emerald' }
  if (diff <= 25) return { label: 'Slightly off', color: 'text-gold' }
  return { label: 'Overconfident', color: 'text-against-400' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BucketBar({ bucket }: { bucket: CalibrationBucket }) {
  const barH = Math.max(4, Math.round((bucket.vindication_rate / 100) * 80))
  const { label: calLabel, color: calColor } = calibrationQuality(
    bucket.min_pct,
    bucket.max_pct,
    bucket.vindication_rate
  )
  const hasSample = bucket.total_resolved >= 3

  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      {/* bar */}
      <div className="relative w-full flex items-end justify-center h-20">
        {/* Perfect calibration ghost */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 border border-dashed border-surface-400/30 rounded-sm"
          style={{ height: `${Math.round(((bucket.min_pct + bucket.max_pct) / 2 / 100) * 80)}px` }}
        />
        {/* Actual bar */}
        {hasSample ? (
          <motion.div
            className="w-3/4 rounded-t-sm bg-for-500/70 border border-for-500/40"
            initial={{ height: 0 }}
            animate={{ height: barH }}
            transition={{ duration: 0.6, delay: bucket.min_pct * 0.005, ease: 'easeOut' }}
          />
        ) : (
          <div className="w-3/4 h-1 rounded-t-sm bg-surface-300/40" />
        )}
      </div>
      {/* vindication rate label */}
      <span className={cn('text-xs font-mono font-bold', hasSample ? 'text-white' : 'text-surface-500')}>
        {hasSample ? `${bucket.vindication_rate}%` : '—'}
      </span>
      {/* confidence bucket label */}
      <span className="text-[10px] font-mono text-surface-500 text-center leading-tight">
        {bucket.label}
        <br />
        <span className="text-surface-600">agree</span>
      </span>
      {/* sample size */}
      {hasSample ? (
        <span className={cn('text-[10px] font-mono', calColor)}>{calLabel}</span>
      ) : (
        <span className="text-[10px] font-mono text-surface-600">
          {bucket.total_resolved < 3 ? `n=${bucket.total_resolved}` : ''}
        </span>
      )}
    </div>
  )
}

function CategoryRow({ cat }: { cat: CalibrationCategoryRow }) {
  const colText = CAT_COLOR[cat.category] ?? 'text-surface-400'
  const colBg   = CAT_BG[cat.category]   ?? 'bg-surface-200/40 border-surface-300/40'
  const hasData = cat.total_resolved >= 3

  return (
    <div className={cn('flex items-center gap-3 p-3 rounded-lg border', colBg)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold capitalize font-mono', colText)}>
            {cat.category}
          </span>
          <Badge variant="subtle" className="text-[10px] py-0 px-1.5">
            {cat.active_count} active
          </Badge>
        </div>
        <div className="text-xs text-surface-500 font-mono mt-0.5">
          {cat.total_resolved} resolved · avg confidence {cat.avg_confidence_pct}%
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        {hasData ? (
          <>
            <div className="text-sm font-bold font-mono text-white">
              {cat.vindication_rate}%
            </div>
            <div className="text-[10px] text-surface-500 font-mono">vindicated</div>
          </>
        ) : (
          <div className="text-xs text-surface-600 font-mono">too few</div>
        )}
      </div>
    </div>
  )
}

function ThesisRow({
  thesis,
  showDays,
}: {
  thesis: ActiveThesisRow
  showDays?: boolean
}) {
  const agreedPct  = thesis.confidence_pct
  const disagreePct = 100 - agreedPct
  const catText = CAT_COLOR[thesis.category] ?? 'text-surface-400'

  return (
    <Link
      href={`/thesis/${thesis.id}`}
      className={cn(
        'block p-3 rounded-lg border border-surface-300/40 bg-surface-200/30',
        'hover:bg-surface-200/60 hover:border-surface-300/60 transition-colors group'
      )}
    >
      <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-surface-100 mb-2">
        {thesis.statement}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-[10px] font-mono capitalize font-semibold', catText)}>
          {thesis.category}
        </span>
        <span className="text-[10px] font-mono text-surface-500">·</span>
        {/* Agree bar */}
        <div className="flex items-center gap-1.5">
          <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-surface-300/40">
            <div
              className="bg-for-500 h-full rounded-full"
              style={{ width: `${agreedPct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-for-400">{agreedPct}% agree</span>
        </div>
        <span className="text-[10px] font-mono text-surface-600">
          {thesis.total_votes} vote{thesis.total_votes !== 1 ? 's' : ''}
        </span>
        {showDays && thesis.days_until_resolution !== null && (
          <>
            <span className="text-[10px] font-mono text-surface-500">·</span>
            <span className="text-[10px] font-mono text-gold flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {thesis.days_until_resolution}d left
            </span>
          </>
        )}
        {thesis.author_username && (
          <span className="ml-auto text-[10px] text-surface-600 font-mono">
            @{thesis.author_username}
          </span>
        )}
      </div>
    </Link>
  )
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CalibrationClient() {
  const [data, setData] = useState<CalibrationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'confident' | 'contested' | 'expiring'>('confident')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/thesis/calibration')
      if (!res.ok) throw new Error('Failed to load calibration data')
      const json: CalibrationResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const activeList =
    tab === 'confident' ? data?.high_confidence :
    tab === 'contested' ? data?.contested :
    data?.expiring_soon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/thesis"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to thesis board"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-purple" />
              <h1 className="font-mono text-2xl font-bold text-white">
                Thesis Calibration
              </h1>
            </div>
            <p className="text-sm text-surface-500 font-mono mt-0.5">
              When the Lobby is {'{'}X%{'}'} confident, does it come true?
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40 flex-shrink-0"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-against-500/30 bg-against-500/10 p-4 mb-6 text-sm text-against-300 font-mono">
            {error}
          </div>
        )}

        {/* Platform stats */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {[
              {
                label: 'Active theses',
                value: data.platform.total_active.toLocaleString(),
                icon: Zap,
                color: 'text-for-400',
              },
              {
                label: 'Resolved',
                value: data.platform.total_resolved.toLocaleString(),
                icon: CheckCircle2,
                color: 'text-emerald',
              },
              {
                label: 'Vindication rate',
                value: `${data.platform.overall_vindication_rate}%`,
                icon: Target,
                color: 'text-gold',
              },
              {
                label: 'Avg confidence',
                value: `${data.platform.avg_confidence_on_active}%`,
                icon: Brain,
                color: 'text-purple',
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-lg border border-surface-300/40 bg-surface-200/30 p-3"
              >
                <Icon className={cn('h-4 w-4 mb-2', color)} />
                <div className="text-lg font-bold font-mono text-white">{value}</div>
                <div className="text-[11px] text-surface-500 font-mono mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Calibration curve */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4 text-surface-400" />
            <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider">
              Calibration Curve
            </h2>
            <span className="text-xs text-surface-600 font-mono ml-1">
              community agreement → actual vindication rate
            </span>
          </div>

          <div className="rounded-xl border border-surface-300/40 bg-surface-200/20 p-4">
            {loading ? (
              <div className="flex items-end justify-around gap-2 h-28">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${20 + i * 15}%` }} />
                ))}
              </div>
            ) : data ? (
              <>
                <div className="flex items-end justify-around gap-2 h-28">
                  {data.buckets.map((b) => (
                    <BucketBar key={b.label} bucket={b} />
                  ))}
                </div>
                <p className="text-[10px] text-surface-600 font-mono text-center mt-3">
                  Dashed line = perfect calibration. Bar = actual vindication rate. n shown per bucket.
                </p>
              </>
            ) : null}
          </div>
        </section>

        {/* Category breakdown */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-surface-400" />
            <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider">
              By Category
            </h2>
          </div>

          {loading ? (
            <SectionSkeleton rows={5} />
          ) : data && data.categories.length > 0 ? (
            <div className="space-y-2">
              {data.categories.map((cat) => (
                <CategoryRow key={cat.category} cat={cat} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BarChart2}
              title="No category data yet"
              description="Resolve some theses to see category accuracy."
            />
          )}
        </section>

        {/* Active theses tabbed list */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-surface-400" />
            <h2 className="font-mono text-sm font-semibold text-white uppercase tracking-wider">
              Active Theses
            </h2>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 bg-surface-200/40 rounded-lg border border-surface-300/30 w-fit">
            {(
              [
                { id: 'confident', label: 'High Confidence', icon: Flame },
                { id: 'contested', label: 'Contested', icon: Scale },
                { id: 'expiring',  label: 'Expiring Soon',  icon: Clock },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all',
                  tab === id
                    ? 'bg-surface-300 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              {loading ? (
                <SectionSkeleton rows={4} />
              ) : !activeList || activeList.length === 0 ? (
                <EmptyState
                  icon={tab === 'expiring' ? Clock : tab === 'contested' ? Scale : Flame}
                  title={
                    tab === 'confident'
                      ? 'No high-confidence theses'
                      : tab === 'contested'
                      ? 'No contested theses'
                      : 'No theses expiring soon'
                  }
                  description={
                    tab === 'expiring'
                      ? 'No active theses resolve in the next 30 days.'
                      : 'Need at least 3 votes on a thesis to appear here.'
                  }
                />
              ) : (
                <div className="space-y-2">
                  {activeList.map((t) => (
                    <ThesisRow key={t.id} thesis={t} showDays={tab === 'expiring'} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Footer nav */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/thesis/analytics"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white font-mono transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Thesis Analytics
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/thesis"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white font-mono transition-colors"
          >
            <Brain className="h-3.5 w-3.5" />
            All Theses
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/thesis/expiring"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white font-mono transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            Expiring Theses
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
