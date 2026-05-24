'use client'

/**
 * /analytics/compare — You vs. The Platform
 *
 * Multi-dimensional comparison of your civic profile against
 * the platform-wide median across all active citizens.
 *
 * Distinct from:
 *   /analytics/benchmark   — compares to join-date cohort only
 *   /analytics/kin         — finds users who think like you
 *   /leaderboard           — ranks you on a single axis
 *   /compare-users         — compares two specific users
 *   /twins                 — finds ideologically-similar users
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Flame,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsUp,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CompareResponse, DimensionStat, CategoryComparison } from '@/app/api/analytics/compare/route'

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const CAT_BAR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-for-400',
  Culture:     'bg-gold',
  Health:      'bg-against-400',
  Environment: 'bg-emerald',
  Education:   'bg-purple',
}

// ─── Role label ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  senator:       'Senator',
  lawmaker:      'Lawmaker',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function percentileLabel(pct: number): { label: string; color: string } {
  if (pct >= 95) return { label: 'Top 5%',  color: 'text-gold' }
  if (pct >= 90) return { label: 'Top 10%', color: 'text-gold' }
  if (pct >= 75) return { label: 'Top 25%', color: 'text-emerald' }
  if (pct >= 50) return { label: 'Top 50%', color: 'text-for-400' }
  if (pct >= 25) return { label: 'Top 75%', color: 'text-surface-400' }
  return { label: 'Bottom 25%', color: 'text-against-400' }
}

function PercentileBar({ pct, delay = 0 }: { pct: number; delay?: number }) {
  const color =
    pct >= 75 ? 'bg-emerald' :
    pct >= 50 ? 'bg-for-500' :
    pct >= 25 ? 'bg-gold' :
    'bg-against-500'

  return (
    <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, delay, ease: 'easeOut' }}
        className={cn('absolute inset-y-0 left-0 rounded-full', color)}
      />
      {/* Median line at 50% */}
      <div className="absolute top-0 bottom-0 w-px bg-surface-500/60" style={{ left: '50%' }} />
    </div>
  )
}

// ─── Dimension card ───────────────────────────────────────────────────────────

function DimensionCard({ dim, idx }: { dim: DimensionStat; idx: number }) {
  const { label: pLabel, color: pColor } = percentileLabel(dim.percentile)
  const diff = dim.user_value - dim.platform_median
  const absDiff = Math.abs(diff)
  const isAbove = diff > 0

  const icon =
    dim.key === 'votes'     ? ThumbsUp :
    dim.key === 'arguments' ? MessageSquare :
    dim.key === 'clout'     ? Zap :
    dim.key === 'reputation' ? Trophy :
    Flame

  const Icon = icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: idx * 0.07 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-surface-500 flex-shrink-0" />
          <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">{dim.label}</span>
        </div>
        <span className={cn('text-xs font-mono font-semibold', pColor)}>{pLabel}</span>
      </div>

      <div className="flex items-end justify-between gap-4 mb-3">
        <div>
          <div className="text-2xl font-mono font-bold text-white">
            <AnimatedNumber value={dim.user_value} />
            {dim.unit && <span className="text-sm font-normal text-surface-500 ml-1">{dim.unit}</span>}
          </div>
          <div className="text-[11px] font-mono text-surface-500 mt-0.5">your score</div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 justify-end">
            {isAbove
              ? <TrendingUp className="h-3 w-3 text-emerald" />
              : <TrendingDown className="h-3 w-3 text-against-400" />}
            <span className={cn('text-sm font-mono font-semibold', isAbove ? 'text-emerald' : 'text-against-400')}>
              {isAbove ? '+' : '-'}{fmtNum(absDiff)}
            </span>
          </div>
          <div className="text-[11px] font-mono text-surface-500 mt-0.5">vs. median {fmtNum(dim.platform_median)}</div>
        </div>
      </div>

      <PercentileBar pct={dim.percentile} delay={idx * 0.07 + 0.2} />

      <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-surface-500">
        <span>0</span>
        <span>Median ({fmtNum(dim.platform_median)})</span>
        <span>100th</span>
      </div>

      <p className="text-[11px] font-mono text-surface-600 mt-2 leading-relaxed">{dim.description}</p>
    </motion.div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, idx }: { cat: CategoryComparison; idx: number }) {
  const diff = cat.user_pct - cat.platform_pct
  const forDiff = cat.user_for_pct - cat.platform_for_pct
  const catColor = CAT_COLOR[cat.category] ?? 'text-surface-400'
  const catBar   = CAT_BAR[cat.category]   ?? 'bg-surface-400'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.04 }}
      className="py-3 border-b border-surface-300/60 last:border-0"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className={cn('text-sm font-mono font-semibold', catColor)}>{cat.category}</span>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className={cn(diff > 2 ? 'text-emerald' : diff < -2 ? 'text-against-400' : 'text-surface-500')}>
            {diff > 0 ? '+' : ''}{diff.toFixed(1)}% vs platform
          </span>
        </div>
      </div>

      {/* Bar comparison */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-surface-500 w-14 text-right shrink-0">You</span>
          <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(cat.user_pct * 2, 100)}%` }}
              transition={{ duration: 0.5, delay: idx * 0.04 + 0.2 }}
              className={cn('h-full rounded-full', catBar)}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-400 w-10 shrink-0">{cat.user_pct.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-surface-600 w-14 text-right shrink-0">Platform</span>
          <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(cat.platform_pct * 2, 100)}%` }}
              transition={{ duration: 0.5, delay: idx * 0.04 + 0.3 }}
              className="h-full rounded-full bg-surface-400/60"
            />
          </div>
          <span className="text-[10px] font-mono text-surface-600 w-10 shrink-0">{cat.platform_pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* FOR% comparison */}
      {cat.user_count >= 5 && (
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] font-mono text-surface-600 w-14 text-right shrink-0">FOR%</span>
          <div className="flex items-center gap-1.5 flex-1">
            <span className="text-[10px] font-mono text-for-400">{cat.user_for_pct}%</span>
            <span className="text-[10px] font-mono text-surface-600">you</span>
            <span className="text-[10px] font-mono text-surface-600 mx-1">·</span>
            <span className="text-[10px] font-mono text-surface-500">{cat.platform_for_pct}%</span>
            <span className="text-[10px] font-mono text-surface-600">platform</span>
            {Math.abs(forDiff) >= 10 && (
              <span className={cn(
                'text-[10px] font-mono font-semibold ml-1',
                forDiff > 0 ? 'text-for-400' : 'text-against-400'
              )}>
                ({forDiff > 0 ? 'more FOR' : 'more AGAINST'})
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Side lean card ───────────────────────────────────────────────────────────

function SideLeanCard({ data }: { data: CompareResponse }) {
  const userForPct = data.user.total_votes > 0
    ? Math.round((data.user.blue_vote_count / (data.user.blue_vote_count + data.user.red_vote_count)) * 100)
    : 50
  const platformForPct = data.platform_totals.platform_for_pct

  const userLean = userForPct >= 55 ? 'FOR-leaning' : userForPct <= 45 ? 'AGAINST-leaning' : 'Balanced'
  const platLean = platformForPct >= 55 ? 'FOR-leaning' : platformForPct <= 45 ? 'AGAINST-leaning' : 'Balanced'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.4 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Scale className="h-4 w-4 text-surface-500" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Civic Lean</span>
        <span className="text-xs font-mono text-surface-600">— how your vote bias compares</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-xs font-mono text-surface-500 mb-2">You</div>
          <div className="text-3xl font-mono font-bold text-white mb-1">{userForPct}%</div>
          <div className="text-xs font-mono text-for-400 mb-2">FOR</div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
              style={{ width: `${userForPct}%` }}
            />
          </div>
          <div className={cn(
            'text-[11px] font-mono font-medium',
            userLean === 'FOR-leaning' ? 'text-for-400' :
            userLean === 'AGAINST-leaning' ? 'text-against-400' : 'text-surface-500'
          )}>
            {userLean}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs font-mono text-surface-500 mb-2">Platform</div>
          <div className="text-3xl font-mono font-bold text-surface-400 mb-1">{platformForPct}%</div>
          <div className="text-xs font-mono text-for-400 mb-2">FOR</div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden mb-1">
            <div
              className="h-full rounded-full bg-gradient-to-r from-surface-400 to-surface-500"
              style={{ width: `${platformForPct}%` }}
            />
          </div>
          <div className={cn(
            'text-[11px] font-mono font-medium',
            platLean === 'FOR-leaning' ? 'text-for-400' :
            platLean === 'AGAINST-leaning' ? 'text-against-400' : 'text-surface-500'
          )}>
            {platLean}
          </div>
        </div>
      </div>

      {Math.abs(userForPct - platformForPct) >= 10 && (
        <div className={cn(
          'mt-3 px-3 py-2 rounded-lg text-xs font-mono border',
          userForPct > platformForPct
            ? 'bg-for-500/10 border-for-500/20 text-for-300'
            : 'bg-against-500/10 border-against-500/20 text-against-300'
        )}>
          You vote {userForPct > platformForPct ? 'more FOR' : 'more AGAINST'} than the platform average
          by {Math.abs(userForPct - platformForPct)} percentage points.
        </div>
      )}
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsComparePage() {
  const router = useRouter()
  const [data, setData] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catOpen, setCatOpen] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/compare')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as CompareResponse)
    } catch {
      setError('Could not load your comparison data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-for-400" />
              <h1 className="font-mono text-2xl font-bold text-white">You vs. The Platform</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              How your civic profile compares to the platform-wide median
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center mb-6">
            <p className="text-sm font-mono text-against-300">{error}</p>
            <button onClick={load} className="mt-3 text-xs font-mono text-against-400 hover:text-against-300 underline">
              Try again
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 h-32">
              <Skeleton className="h-4 w-48 mb-3" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[0,1,2,3,4].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-40">
                  <Skeleton className="h-3 w-24 mb-3" />
                  <Skeleton className="h-7 w-20 mb-2" />
                  <Skeleton className="h-2 w-full mb-1" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
          </div>
        )}

        {data && (
          <AnimatePresence>

            {/* Profile + archetype hero */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-6"
            >
              <div className="flex items-center gap-4">
                <Avatar
                  src={data.user.avatar_url}
                  fallback={data.user.display_name || data.user.username}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-mono font-bold text-white truncate">
                    {data.user.display_name || data.user.username}
                  </div>
                  <div className="text-xs font-mono text-surface-500">
                    @{data.user.username} · {ROLE_LABEL[data.user.role] ?? data.user.role}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={cn('text-sm font-mono font-bold', data.archetype_color)}>
                    {data.archetype}
                  </div>
                  <div className="text-xs font-mono text-surface-500 mt-0.5">
                    {data.overall_percentile}th percentile
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-surface-300">
                {[
                  { label: 'Citizens', value: fmtNum(data.platform_totals.total_users), icon: Users, color: 'text-for-400' },
                  { label: 'Total Votes', value: fmtNum(data.platform_totals.total_votes), icon: ThumbsUp, color: 'text-purple' },
                  { label: 'Arguments', value: fmtNum(data.platform_totals.total_arguments), icon: MessageSquare, color: 'text-emerald' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <s.icon className={cn('h-4 w-4 mx-auto mb-1', s.color)} />
                    <div className="text-base font-mono font-bold text-white">{s.value}</div>
                    <div className="text-[10px] font-mono text-surface-500">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Overall percentile bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono text-surface-500">Overall Civic Percentile</span>
                  <span className={cn('text-xs font-mono font-semibold', data.archetype_color)}>
                    {data.overall_percentile}th
                  </span>
                </div>
                <PercentileBar pct={data.overall_percentile} delay={0.2} />
              </div>
            </motion.div>

            {/* Dimensions grid */}
            <div className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-4 w-4 text-surface-500" />
                <h2 className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-wider">
                  Dimension Breakdown
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {data.dimensions.map((dim, i) => (
                  <DimensionCard key={dim.key} dim={dim} idx={i} />
                ))}
              </div>
            </div>

            {/* Side lean */}
            <div className="mb-6">
              <SideLeanCard data={data} />
            </div>

            {/* Category comparison */}
            {data.categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.5 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden mb-6"
              >
                <button
                  onClick={() => setCatOpen((o) => !o)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-200/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-surface-500" />
                    <span className="text-sm font-mono font-semibold text-surface-400 uppercase tracking-wider">
                      Category Focus vs. Platform
                    </span>
                  </div>
                  <ChevronRight className={cn('h-4 w-4 text-surface-500 transition-transform', catOpen && 'rotate-90')} />
                </button>

                <AnimatePresence>
                  {catOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-4">
                        <p className="text-xs font-mono text-surface-600 mb-4 leading-relaxed">
                          How your vote distribution across categories compares to where the platform focuses —
                          and whether you lean more FOR or AGAINST in each area.
                        </p>
                        {data.categories.map((cat, i) => (
                          <CategoryRow key={cat.category} cat={cat} idx={i} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Platform context */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.6 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Platform Medians</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Median Votes',      value: fmtNum(data.platform_totals.median_votes),      sub: `avg ${fmtNum(data.platform_totals.avg_votes)}` },
                  { label: 'Median Clout',      value: fmtNum(data.platform_totals.median_clout),      sub: `avg ${fmtNum(data.platform_totals.avg_clout)}` },
                  { label: 'Median Arguments',  value: fmtNum(data.platform_totals.median_arguments),  sub: `avg ${fmtNum(data.platform_totals.avg_arguments)}` },
                  { label: 'Median Reputation', value: fmtNum(data.platform_totals.median_reputation), sub: `avg ${fmtNum(data.platform_totals.avg_reputation)}` },
                  { label: 'Median Streak',     value: `${data.platform_totals.median_streak}d`,       sub: `avg ${data.platform_totals.avg_streak}d` },
                  { label: 'Platform FOR%',     value: `${data.platform_totals.platform_for_pct}%`,    sub: 'of all votes' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-3 text-center">
                    <div className="text-lg font-mono font-bold text-white">{s.value}</div>
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">{s.label}</div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Navigation links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap gap-2"
            >
              {[
                { href: '/analytics/benchmark',  label: 'Cohort Benchmark',   color: 'text-gold border-gold/30 bg-gold/5 hover:bg-gold/10' },
                { href: '/analytics/kin',         label: 'Find Civic Kin',     color: 'text-emerald border-emerald/30 bg-emerald/5 hover:bg-emerald/10' },
                { href: '/compare-users',         label: 'Compare Users',      color: 'text-purple border-purple/30 bg-purple/5 hover:bg-purple/10' },
                { href: '/analytics',             label: '← All Analytics',    color: 'text-surface-500 border-surface-400/30 bg-surface-200/50 hover:bg-surface-200' },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                    l.color
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </motion.div>

          </AnimatePresence>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.user.total_votes === 0 && (
          <EmptyState
            icon={ThumbsUp}
            title="No votes yet"
            description="Cast your first vote to see how you compare to the platform."
            action={{ label: 'Explore Topics', href: '/' }}
          />
        )}

      </main>
      <BottomNav />
    </div>
  )
}
