'use client'

/**
 * /thesis/analytics — Thesis Prediction Analytics
 *
 * Platform-wide breakdown of civic thesis prediction accuracy:
 *   • Top predictors ranked by vindication rate
 *   • Category breakdown (which fields produce best predictions)
 *   • Platform stats: total resolved, avg days to resolution, etc.
 *   • Contrarian calls: vindicated theses where few agreed upfront
 *
 * Distinct from:
 *   /leaderboard/theses  — raw thesis engagement (upvotes/agree counts)
 *   /thesis/digest       — curated weekly digest
 *   /thesis/hot          — currently trending by activity
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
  ChevronRight,
  Crown,
  Flame,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ThesisAnalyticsResponse,
  TopPredictor,
  CategoryStat,
} from '@/app/api/thesis/analytics/route'

// ─── Category color map ───────────────────────────────────────────────────────

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

// ─── Accuracy bar ─────────────────────────────────────────────────────────────

function AccuracyBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' }) {
  const color =
    pct >= 75 ? 'bg-emerald' :
    pct >= 55 ? 'bg-for-500' :
    pct >= 40 ? 'bg-gold' :
                'bg-against-500'

  return (
    <div className={cn('relative w-full rounded-full bg-surface-300/50', size === 'sm' ? 'h-1' : 'h-1.5')}>
      <div
        className={cn('absolute left-0 top-0 h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  )
}

// ─── Accuracy label ───────────────────────────────────────────────────────────

function AccuracyLabel({ pct }: { pct: number }) {
  if (pct >= 80) return <span className="text-emerald font-mono text-xs">Prescient</span>
  if (pct >= 65) return <span className="text-for-400 font-mono text-xs">Sharp</span>
  if (pct >= 50) return <span className="text-gold font-mono text-xs">Solid</span>
  return <span className="text-against-400 font-mono text-xs">Developing</span>
}

// ─── Platform stat card ───────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Trophy
  color: string
}) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-xl bg-surface-200/60 border border-surface-300/60">
      <div className={cn('flex items-center gap-2', color)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── Top predictor row ────────────────────────────────────────────────────────

function PredictorRow({
  rank,
  predictor,
}: {
  rank: number
  predictor: TopPredictor
}) {
  const medal =
    rank === 1 ? '🥇' :
    rank === 2 ? '🥈' :
    rank === 3 ? '🥉' :
    null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 transition-colors"
    >
      {/* Rank */}
      <span className="w-7 text-center text-sm font-mono text-surface-500 shrink-0">
        {medal ?? `#${rank}`}
      </span>

      {/* Avatar + name */}
      <Link
        href={`/profile/${predictor.username}`}
        className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity"
      >
        <Avatar
          src={predictor.avatar_url}
          fallback={predictor.display_name ?? predictor.username}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {predictor.display_name ?? predictor.username}
          </p>
          <p className="text-[11px] text-surface-500 truncate">@{predictor.username}</p>
        </div>
      </Link>

      {/* Accuracy */}
      <div className="shrink-0 text-right">
        <div className="flex items-center gap-1.5 justify-end">
          <span className="text-sm font-bold text-white tabular-nums">
            {predictor.accuracy_pct}%
          </span>
          <AccuracyLabel pct={predictor.accuracy_pct} />
        </div>
        <p className="text-[11px] text-surface-500 mt-0.5">
          {predictor.vindicated}✓ / {predictor.refuted}✗ of {predictor.total_resolved}
        </p>
        <div className="mt-1 w-24">
          <AccuracyBar pct={predictor.accuracy_pct} size="sm" />
        </div>
      </div>

      {/* Contrarian badge */}
      {predictor.contrarian_count > 0 && (
        <div
          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple/15 border border-purple/30"
          title={`${predictor.contrarian_count} contrarian calls — vindicated despite minority agreement`}
        >
          <Zap className="h-3 w-3 text-purple" aria-hidden="true" />
          <span className="text-[10px] font-mono text-purple">{predictor.contrarian_count}</span>
        </div>
      )}
    </motion.div>
  )
}

// ─── Category stat row ────────────────────────────────────────────────────────

function CategoryRow({ cat, rank }: { cat: CategoryStat; rank: number }) {
  const label = cat.category.charAt(0).toUpperCase() + cat.category.slice(1)
  const colorText = CAT_COLOR[cat.category] ?? 'text-surface-600'
  const colorBg = CAT_BG[cat.category] ?? 'bg-surface-200/60 border-surface-300/40'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40"
    >
      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', colorBg, colorText)}>
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-surface-500">{cat.total} theses</span>
          {cat.active > 0 && (
            <span className="text-[10px] text-for-400 bg-for-500/10 border border-for-500/20 rounded px-1">
              {cat.active} active
            </span>
          )}
        </div>
        <AccuracyBar pct={cat.accuracy_pct} size="sm" />
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-white tabular-nums">{cat.accuracy_pct}%</p>
        <p className="text-[10px] text-surface-500">
          {cat.vindicated}✓ {cat.refuted}✗
        </p>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4 px-4">
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-6 w-40 rounded" />
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-6 w-40 rounded" />
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ThesisAnalyticsClient() {
  const [data, setData] = useState<ThesisAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/thesis/analytics', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load analytics')
      const json = (await res.json()) as ThesisAnalyticsResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const p = data?.platform

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24 md:pb-8">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-surface-50/95 backdrop-blur-md border-b border-surface-300/60">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link
              href="/thesis"
              className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Thesis</span>
            </Link>
            <span className="text-surface-500">/</span>
            <span className="text-sm font-semibold text-white">Analytics</span>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
          {/* Page title */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-for-400" aria-hidden="true" />
                Thesis Analytics
              </h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Who predicts the future of civic debate most accurately?
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh analytics"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>

          {/* Error state */}
          {error && (
            <div className="p-4 rounded-xl bg-against-500/10 border border-against-500/30 text-against-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <AnalyticsSkeleton />
          ) : data ? (
            <>
              {/* Platform stats grid */}
              {p && (
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Total Theses"
                    value={p.total_theses.toLocaleString()}
                    sub={`${p.active} still active`}
                    icon={Brain}
                    color="text-for-400"
                  />
                  <StatCard
                    label="Platform Accuracy"
                    value={`${p.accuracy_pct}%`}
                    sub={`${p.vindicated} vindicated`}
                    icon={Target}
                    color="text-emerald"
                  />
                  <StatCard
                    label="Avg Resolution"
                    value={p.avg_resolution_days !== null ? `${p.avg_resolution_days}d` : '—'}
                    sub="days from post to resolve"
                    icon={TrendingUp}
                    color="text-gold"
                  />
                  <StatCard
                    label="Predictors"
                    value={p.total_predictors?.toLocaleString() ?? '0'}
                    sub="total thesis authors"
                    icon={Crown}
                    color="text-purple"
                  />
                </div>
              )}

              {/* Status breakdown */}
              {p && (
                <div className="p-4 rounded-xl bg-surface-200/40 border border-surface-300/40 space-y-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500">
                    Resolution Breakdown
                  </h2>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald" aria-hidden="true" />
                      <span className="text-sm text-white font-semibold">{p.vindicated}</span>
                      <span className="text-xs text-surface-500">Vindicated</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-against-400" aria-hidden="true" />
                      <span className="text-sm text-white font-semibold">{p.refuted}</span>
                      <span className="text-xs text-surface-500">Refuted</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Scale className="h-4 w-4 text-surface-500" aria-hidden="true" />
                      <span className="text-sm text-white font-semibold">{p.expired}</span>
                      <span className="text-xs text-surface-500">Expired</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-for-400" aria-hidden="true" />
                      <span className="text-sm text-white font-semibold">{p.active}</span>
                      <span className="text-xs text-surface-500">Active</span>
                    </div>
                  </div>
                  {/* Overall accuracy bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-surface-500">
                      <span>Platform accuracy</span>
                      <span>{p.accuracy_pct}% of resolved</span>
                    </div>
                    <AccuracyBar pct={p.accuracy_pct} />
                  </div>
                </div>
              )}

              {/* Most agreed thesis */}
              {p?.most_agreed_thesis_id && p.most_agreed_thesis_statement && (
                <Link
                  href={`/thesis/${p.most_agreed_thesis_id}`}
                  className="block p-4 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
                    <span className="text-xs font-semibold uppercase tracking-widest text-gold">
                      Most Agreed Thesis
                    </span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-surface-500 group-hover:text-white transition-colors">
                      View <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="text-sm text-white line-clamp-2 leading-relaxed">
                    {p.most_agreed_thesis_statement}
                  </p>
                  <p className="text-xs text-surface-500 mt-1">
                    {p.most_agreed_count} agreed
                  </p>
                </Link>
              )}

              {/* Category breakdown */}
              {data.categories.length > 0 && (
                <section aria-labelledby="categories-heading">
                  <h2
                    id="categories-heading"
                    className="text-sm font-semibold text-white mb-3 flex items-center gap-2"
                  >
                    <BarChart2 className="h-4 w-4 text-for-400" aria-hidden="true" />
                    Accuracy by Category
                  </h2>
                  <div className="space-y-2">
                    {data.categories.map((cat, i) => (
                      <CategoryRow key={cat.category} cat={cat} rank={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* Top predictors */}
              {data.top_predictors.length > 0 ? (
                <section aria-labelledby="predictors-heading">
                  <div className="flex items-center justify-between mb-3">
                    <h2
                      id="predictors-heading"
                      className="text-sm font-semibold text-white flex items-center gap-2"
                    >
                      <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
                      Top Predictors
                    </h2>
                    <Link
                      href="/leaderboard/theses"
                      className="text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      Full leaderboard <ChevronRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    <AnimatePresence>
                      {data.top_predictors.map((predictor, i) => (
                        <PredictorRow key={predictor.user_id} rank={i + 1} predictor={predictor} />
                      ))}
                    </AnimatePresence>
                  </div>
                  <p className="text-[11px] text-surface-600 mt-3 px-1">
                    Ranked by vindication rate · minimum 2 resolved theses · ⚡ = contrarian calls vindicated against the crowd
                  </p>
                </section>
              ) : (
                <div className="p-8 text-center text-surface-500 text-sm rounded-xl border border-surface-300/40 bg-surface-200/20">
                  <Brain className="h-8 w-8 mx-auto mb-3 opacity-40" aria-hidden="true" />
                  <p>No resolved theses yet.</p>
                  <p className="text-xs mt-1">Stats appear when theses are vindicated or refuted.</p>
                  <Link
                    href="/thesis/create"
                    className="inline-flex items-center gap-1.5 mt-4 text-for-400 text-xs hover:text-for-300 transition-colors"
                  >
                    Make a prediction <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              )}

              {/* Explore more */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                <Link
                  href="/thesis"
                  className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 transition-colors group"
                >
                  <Brain className="h-4 w-4 text-purple shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">All Theses</p>
                    <p className="text-[10px] text-surface-500">Browse the Oracle</p>
                  </div>
                </Link>
                <Link
                  href="/thesis/calibration"
                  className="flex items-center gap-2 p-3 rounded-xl bg-purple/10 border border-purple/25 hover:border-purple/40 transition-colors group"
                >
                  <Target className="h-4 w-4 text-purple shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">Calibration</p>
                    <p className="text-[10px] text-surface-500">Confidence vs reality</p>
                  </div>
                </Link>
                <Link
                  href="/thesis/create"
                  className="flex items-center gap-2 p-3 rounded-xl bg-for-500/10 border border-for-500/25 hover:border-for-500/40 transition-colors group"
                >
                  <Sparkles className="h-4 w-4 text-for-400 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">Stake a Thesis</p>
                    <p className="text-[10px] text-surface-500">Make a prediction</p>
                  </div>
                </Link>
              </div>
            </>
          ) : null}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
