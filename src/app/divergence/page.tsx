'use client'

/**
 * /divergence — The Civic Opinion Oscillator
 *
 * Reveals debates where community opinion is actively swinging between
 * consecutive weekly windows — not just contested, but genuinely unstable.
 *
 * Unlike /convergence (which measures whether recent voters are more or less
 * aligned than the overall average), /divergence compares two separate time
 * windows directly:
 *   Window A = votes cast 0–7 days ago
 *   Window B = votes cast 7–14 days ago
 *
 * A large swing between A and B means the platform's collective view on this
 * topic REVERSED between the two weeks. That is not a close debate — it is
 * an unstable one. The community is genuinely oscillating.
 *
 * Three severity tiers:
 *   FRACTURE  — |swing| ≥ 30pp — opinion dramatically reversed
 *   RUPTURE   — |swing| ≥ 20pp — strong directional flip
 *   SPLIT     — |swing| ≥ 12pp — measurable week-over-week instability
 *
 * Distinct from:
 *   /convergence  — momentum vs. overall average (not window comparison)
 *   /polarization — current division level, not trajectory instability
 *   /schism       — factions within the community, not temporal swings
 *   /turbulence   — short-term vote-velocity spikes, not opinion reversal
 *   /flux         — single biggest net 24h swing, not 7-day window comparison
 *   /undertow     — hidden currents opposing surface consensus (directional)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart2,
  ChevronDown,
  ChevronRight,
  GitFork,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DivergenceResponse,
  DivergenceTopic,
  DivergenceStats,
  CategoryDivergence,
} from '@/app/api/topics/divergence/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-purple' },
  law:      { label: 'LAW',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-surface-600' },
}

function opinionLabel(pct: number): string {
  if (pct >= 75) return 'Strong FOR'
  if (pct >= 60) return 'FOR'
  if (pct >= 53) return 'Lean FOR'
  if (pct >= 47) return 'Contested'
  if (pct >= 40) return 'Lean AGAINST'
  if (pct >= 25) return 'AGAINST'
  return 'Strong AGAINST'
}

function swingLabel(swing: number): string {
  const abs = Math.abs(swing)
  const dir = swing > 0 ? 'toward FOR' : 'toward AGAINST'
  if (abs >= 30) return `Fractured ${dir}`
  if (abs >= 20) return `Ruptured ${dir}`
  return `Shifted ${dir}`
}

// ─── Divergence Card ──────────────────────────────────────────────────────────

function DivergenceCard({
  topic,
  rank,
}: {
  topic: DivergenceTopic
  rank: number
}) {
  const statusCfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-500' }
  const catClass = topic.category
    ? (CATEGORY_COLORS[topic.category] ?? 'bg-surface-200 text-surface-400 border-surface-400/30')
    : ''

  const swingForward = topic.swing > 0

  const classColor =
    topic.divergence_class === 'fracture'
      ? 'text-against-300 bg-against-500/10 border-against-500/30'
      : topic.divergence_class === 'rupture'
      ? 'text-amber-400 bg-amber-400/10 border-amber-400/30'
      : 'text-gold bg-gold/10 border-gold/30'

  const cardBorder =
    topic.divergence_class === 'fracture'
      ? 'border-against-500/20 hover:border-against-500/40'
      : topic.divergence_class === 'rupture'
      ? 'border-amber-400/20 hover:border-amber-400/40'
      : 'border-gold/20 hover:border-gold/40'

  const rankColor =
    topic.divergence_class === 'fracture'
      ? 'bg-against-500/15 text-against-400'
      : topic.divergence_class === 'rupture'
      ? 'bg-amber-400/15 text-amber-400'
      : 'bg-gold/15 text-gold'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl bg-surface-100 border p-4 md:p-5',
          'hover:bg-surface-200/50 transition-colors group',
          cardBorder
        )}
        aria-label={topic.statement}
      >
        {/* Top row: rank + badges + class pill */}
        <div className="flex items-start gap-3">
          <span className={cn(
            'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold mt-0.5',
            rankColor
          )}>
            {rank + 1}
          </span>

          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', statusCfg.color)}>
                {statusCfg.label}
              </span>
              {topic.category && (
                <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide border', catClass)}>
                  {topic.category}
                </span>
              )}
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide border', classColor)}>
                {topic.divergence_class === 'fracture' ? 'Fracture' : topic.divergence_class === 'rupture' ? 'Rupture' : 'Split'}
              </span>
            </div>

            {/* Statement */}
            <p className="text-sm font-medium text-surface-900 leading-snug group-hover:text-white transition-colors mb-3 line-clamp-2">
              {topic.statement}
            </p>

            {/* Window comparison */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Window B (prior week) */}
              <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 px-3 py-2">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Week prior</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    'text-lg font-bold font-mono tabular-nums',
                    topic.window_b_pct >= 55 ? 'text-for-400' : topic.window_b_pct <= 45 ? 'text-against-400' : 'text-surface-500'
                  )}>
                    {Math.round(topic.window_b_pct)}%
                  </span>
                  <span className="text-[11px] text-surface-500">FOR</span>
                </div>
                <p className="text-[10px] text-surface-600 mt-0.5">{opinionLabel(topic.window_b_pct)}</p>
                <p className="text-[10px] text-surface-600">{topic.window_b_count} votes</p>
              </div>

              {/* Window A (last week) */}
              <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 px-3 py-2 relative">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Last week</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    'text-lg font-bold font-mono tabular-nums',
                    topic.window_a_pct >= 55 ? 'text-for-400' : topic.window_a_pct <= 45 ? 'text-against-400' : 'text-surface-500'
                  )}>
                    {Math.round(topic.window_a_pct)}%
                  </span>
                  <span className="text-[11px] text-surface-500">FOR</span>
                </div>
                <p className="text-[10px] text-surface-600 mt-0.5">{opinionLabel(topic.window_a_pct)}</p>
                <p className="text-[10px] text-surface-600">{topic.window_a_count} votes</p>
              </div>
            </div>

            {/* Swing indicator */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {swingForward ? (
                  <ArrowUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                ) : (
                  <ArrowDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                )}
                <span className={cn(
                  'text-xs font-mono font-semibold',
                  swingForward ? 'text-for-400' : 'text-against-400'
                )}>
                  {swingForward ? '+' : ''}{topic.swing.toFixed(1)}pp swing
                </span>
                <span className="text-[11px] text-surface-600">
                  · {swingLabel(topic.swing)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-surface-600">
                <span>Overall: {Math.round(topic.blue_pct)}% FOR</span>
                <ChevronRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 md:p-5">
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', accent)}>{value}</p>
      {sub && <p className="text-xs text-surface-600 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, rank }: { cat: CategoryDivergence; rank: number }) {
  const catClass = CATEGORY_COLORS[cat.category] ?? 'bg-surface-200 text-surface-400 border-surface-400/30'
  const maxBar = 40 // pp
  const barW = Math.min((cat.avg_swing / maxBar) * 100, 100)
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.04 }}
      className="flex items-center gap-3 py-2 border-b border-surface-300/40 last:border-0"
    >
      <span className="w-5 text-xs font-mono text-surface-600 text-right">{rank + 1}</span>
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide border flex-shrink-0', catClass)}>
        {cat.category}
      </span>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-against-500 to-against-400"
            initial={{ width: 0 }}
            animate={{ width: `${barW}%` }}
            transition={{ duration: 0.6, delay: rank * 0.04 + 0.2 }}
          />
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <span className="text-xs font-mono text-against-300 font-semibold">{cat.avg_swing.toFixed(1)}pp</span>
        <span className="text-[10px] text-surface-600 ml-1">avg</span>
      </div>
      <span className="text-[10px] text-surface-600 flex-shrink-0">{cat.topic_count}t</span>
    </motion.div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DivergenceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4 mb-3" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ActiveTab = 'fracture' | 'rupture' | 'split'
type SortMode = 'swing' | 'total_votes'

const TAB_CONFIG: {
  id: ActiveTab
  label: string
  description: string
  color: string
  activeClass: string
  emptyTitle: string
  emptyDescription: string
}[] = [
  {
    id: 'fracture',
    label: 'Fracture',
    description: '≥ 30pp week-over-week reversal',
    color: 'text-against-300',
    activeClass: 'bg-against-500/20 text-against-300 border-against-500/50',
    emptyTitle: 'No fractures detected',
    emptyDescription: 'No topics showing 30pp+ opinion reversals between consecutive weeks.',
  },
  {
    id: 'rupture',
    label: 'Rupture',
    description: '≥ 20pp flip between windows',
    color: 'text-amber-400',
    activeClass: 'bg-amber-400/20 text-amber-400 border-amber-400/50',
    emptyTitle: 'No ruptures detected',
    emptyDescription: 'No topics showing 20pp+ opinion reversals between consecutive weeks.',
  },
  {
    id: 'split',
    label: 'Split',
    description: '≥ 12pp week-over-week shift',
    color: 'text-gold',
    activeClass: 'bg-gold/20 text-gold border-gold/50',
    emptyTitle: 'No splits detected',
    emptyDescription: 'No topics showing 12pp+ opinion shifts between consecutive weeks.',
  },
]

const STABILITY_CONFIG: Record<
  DivergenceStats['platform_stability'],
  { label: string; color: string; description: string }
> = {
  volatile: {
    label: 'Volatile',
    color: 'text-against-300',
    description: 'Multiple fractures active — platform opinion is highly unstable',
  },
  unstable: {
    label: 'Unstable',
    color: 'text-amber-400',
    description: 'Significant opinion oscillation across multiple topics',
  },
  settling: {
    label: 'Settling',
    color: 'text-emerald',
    description: 'Opinion patterns are relatively stable this fortnight',
  },
}

export default function DivergencePage() {
  const [data, setData] = useState<DivergenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('fracture')
  const [sort, setSort] = useState<SortMode>('swing')
  const [showCategories, setShowCategories] = useState(false)
  const fetchedAt = useRef<number>(0)

  const load = useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && fetchedAt.current && now - fetchedAt.current < 5 * 60_000) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/divergence', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch_failed')
      const json = (await res.json()) as DivergenceResponse
      setData(json)
      fetchedAt.current = now
      // Auto-select a tab with content
      if (json.fracture.length > 0) setActiveTab('fracture')
      else if (json.rupture.length > 0) setActiveTab('rupture')
      else setActiveTab('split')
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tabData = data
    ? {
        fracture: data.fracture,
        rupture: data.rupture,
        split: data.split,
      }[activeTab]
    : []

  const sorted = [...(tabData ?? [])].sort((a, b) =>
    sort === 'total_votes'
      ? b.total_votes - a.total_votes
      : Math.abs(b.swing) - Math.abs(a.swing)
  )

  const stability = data ? STABILITY_CONFIG[data.stats.platform_stability] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-20 pb-32">
        {/* ── Header ── */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GitFork className="h-5 w-5 text-against-400" aria-hidden="true" />
                <h1 className="text-xl font-bold text-white">Civic Divergence</h1>
              </div>
              <p className="text-sm text-surface-500 max-w-md">
                Debates where community opinion swung significantly between consecutive weekly windows. Not just contested — fundamentally oscillating.
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={loading}
              aria-label="Refresh divergence data"
              className="flex-shrink-0 p-2 rounded-xl border border-surface-300 text-surface-500 hover:text-surface-700 hover:border-surface-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>

          {/* Stability signal */}
          {stability && (
            <div className={cn(
              'mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono',
              data?.stats.platform_stability === 'volatile'
                ? 'bg-against-500/10 border-against-500/30 text-against-300'
                : data?.stats.platform_stability === 'unstable'
                ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                : 'bg-emerald/10 border-emerald/30 text-emerald'
            )}>
              <Activity className="h-3 w-3" aria-hidden="true" />
              <span className="font-semibold">{stability.label}:</span>
              <span className="opacity-75">{stability.description}</span>
            </div>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center mb-6">
            <AlertTriangle className="h-8 w-8 text-against-400 mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm text-surface-600 mb-4">Failed to load divergence data.</p>
            <button
              onClick={() => load(true)}
              className="px-4 py-2 rounded-xl bg-surface-200 text-surface-700 text-sm hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && !data && <DivergenceSkeleton />}

        {/* ── Stats grid ── */}
        {data && !loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Total oscillating"
                value={data.stats.total_diverging}
                sub="topics this fortnight"
                accent="text-white"
              />
              <StatCard
                label="Max swing"
                value={`${data.stats.max_swing.toFixed(1)}pp`}
                sub="largest reversal seen"
                accent="text-against-300"
              />
              <StatCard
                label="Avg swing"
                value={`${data.stats.avg_swing.toFixed(1)}pp`}
                sub="across all oscillating"
                accent="text-amber-400"
              />
              <StatCard
                label="Most volatile"
                value={data.stats.most_volatile_category ?? '—'}
                sub={data.stats.most_volatile_category ? 'category by avg swing' : 'no volatile category'}
                accent="text-gold"
              />
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {TAB_CONFIG.map((tab) => {
                const count = data[tab.id].length
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    aria-pressed={isActive}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                      isActive
                        ? tab.activeClass
                        : 'bg-surface-200/60 text-surface-500 border-surface-300 hover:border-surface-400'
                    )}
                  >
                    {tab.label}
                    <span className={cn(
                      'px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums',
                      isActive ? 'bg-white/20' : 'bg-surface-300/60'
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}

              {/* Sort */}
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  onClick={() => setSort(sort === 'swing' ? 'total_votes' : 'swing')}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 border border-surface-300 hover:border-surface-400 transition-colors"
                  aria-label={`Sort by ${sort === 'swing' ? 'total votes' : 'swing magnitude'}`}
                >
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  {sort === 'swing' ? 'By swing' : 'By votes'}
                </button>
              </div>
            </div>

            {/* Tab description */}
            {TAB_CONFIG.find((t) => t.id === activeTab) && (
              <p className="text-[11px] font-mono text-surface-600 mb-4">
                {TAB_CONFIG.find((t) => t.id === activeTab)!.description}
              </p>
            )}

            {/* ── Topic list ── */}
            <AnimatePresence mode="wait">
              {sorted.length === 0 ? (
                <EmptyState
                  key={activeTab}
                  icon={<Zap className="h-8 w-8" />}
                  title={TAB_CONFIG.find((t) => t.id === activeTab)!.emptyTitle}
                  description={TAB_CONFIG.find((t) => t.id === activeTab)!.emptyDescription}
                />
              ) : (
                <motion.div
                  key={activeTab + sort}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {sorted.map((topic, i) => (
                    <DivergenceCard key={topic.id} topic={topic} rank={i} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Category breakdown ── */}
            {data.category_breakdown.length > 0 && (
              <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <button
                  onClick={() => setShowCategories((v) => !v)}
                  aria-expanded={showCategories}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-white hover:bg-surface-200/40 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-against-400" aria-hidden="true" />
                    Category Divergence Breakdown
                  </span>
                  <ChevronDown
                    className={cn('h-4 w-4 text-surface-500 transition-transform', showCategories && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {showCategories && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden px-5 pb-4"
                    >
                      {data.category_breakdown.map((cat, i) => (
                        <CategoryRow key={cat.category} cat={cat} rank={i} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Footer ── */}
            <p className="text-center text-[11px] text-surface-600 mt-8">
              Windows: votes from 0–7 days ago vs 7–14 days ago ·{' '}
              <span className="text-surface-500">
                Generated {new Date(data.generated_at).toLocaleTimeString()}
              </span>
            </p>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
