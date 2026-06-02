'use client'

/**
 * /turbulence — The Civic Turbulence Index
 *
 * In meteorology, turbulence is chaotic, irregular fluid motion — the
 * opposite of smooth laminar flow. In civic debate, turbulence describes
 * topics that can't settle: high engagement, near-50/50 deadlock, AND
 * recent activity surges all at once. These debates aren't just stuck —
 * they're actively contested, with new voters constantly joining both sides.
 *
 * Turbulence Score = instability(0.5) + volume(0.3) + activity(0.2)
 *   instability = 1 – |blue_pct – 50| / 50  (max at exact 50/50)
 *   volume      = log-scaled vote count
 *   activity    = sqrt-scaled feed_score (recent engagement proxy)
 *
 * Distinct from:
 *   /friction        — stuckness × age × volume (entrenched debates, not necessarily live)
 *   /volatility      — topics with wildly swinging FOR% day to day
 *   /flux            — biggest 24h consensus shifts
 *   /tipping-point   — closest to the 75% threshold (not the 50/50 deadlock)
 *   /equilibrium     — stable, resolved, calm debates
 *
 * Turbulence ≠ just controversy. A 50/50 split with 5 votes is not turbulent.
 * Turbulence = controversy × high engagement × recent activity — all together.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Wind,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  TurbulenceResponse,
  TurbulenceTopic,
  CategoryTurbulence,
} from '@/app/api/stats/turbulence/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 10 * 60 * 1000 // 10 minutes

const CAT_CONFIG: Record<string, { icon: typeof Landmark; color: string }> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold' },
  Politics:    { icon: Landmark,      color: 'text-for-400' },
  Technology:  { icon: Cpu,           color: 'text-purple' },
  Science:     { icon: FlaskConical,  color: 'text-emerald' },
  Ethics:      { icon: Scale,         color: 'text-against-300' },
  Health:      { icon: Heart,         color: 'text-against-300' },
  Environment: { icon: Leaf,          color: 'text-emerald' },
  Education:   { icon: GraduationCap, color: 'text-purple' },
  Culture:     { icon: Music2,        color: 'text-gold' },
  Philosophy:  { icon: Scale,         color: 'text-sky-400' },
}

// ─── Zone helpers ─────────────────────────────────────────────────────────────

function zoneConfig(zone: TurbulenceTopic['zone']): {
  label: string
  color: string
  bg: string
  border: string
} {
  switch (zone) {
    case 'extreme':  return { label: 'Extreme',  color: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/40' }
    case 'high':     return { label: 'High',     color: 'text-orange-400',   bg: 'bg-orange-500/10',   border: 'border-orange-500/40' }
    case 'moderate': return { label: 'Moderate', color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/40' }
    default:         return { label: 'Low',      color: 'text-surface-400',  bg: 'bg-surface-300/30',  border: 'border-surface-400/30' }
  }
}

function platformTurbulenceLabel(index: number): { label: string; color: string } {
  if (index >= 75) return { label: 'Storm',          color: 'text-against-300' }
  if (index >= 55) return { label: 'Heavy Turbulence', color: 'text-orange-400' }
  if (index >= 35) return { label: 'Moderate',       color: 'text-gold' }
  if (index >= 15) return { label: 'Light Chop',     color: 'text-for-400' }
  return                   { label: 'Smooth',         color: 'text-emerald' }
}

// ─── Turbulence bar ───────────────────────────────────────────────────────────

function TurbulenceBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100)
  const color =
    pct >= 80 ? 'bg-against-500'
    : pct >= 60 ? 'bg-orange-500'
    : pct >= 40 ? 'bg-gold'
    : pct >= 20 ? 'bg-for-500'
    : 'bg-surface-400'

  return (
    <div className={cn('h-1.5 rounded-full bg-surface-300/50 overflow-hidden', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={cn('h-full rounded-full', color)}
      />
    </div>
  )
}

// ─── Single topic card ────────────────────────────────────────────────────────

function TurbulenceCard({
  topic,
  rank,
  maxScore,
  compact = false,
}: {
  topic: TurbulenceTopic
  rank?: number
  maxScore: number
  compact?: boolean
}) {
  const cfg = zoneConfig(topic.zone)
  const CatIcon = topic.category ? (CAT_CONFIG[topic.category]?.icon ?? Activity) : Activity
  const catColor = topic.category ? (CAT_CONFIG[topic.category]?.color ?? 'text-surface-400') : 'text-surface-400'
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-2xl border bg-surface-200/40 hover:bg-surface-200/70 transition-all duration-200',
        cfg.border,
        compact ? 'p-3' : 'p-4',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Rank */}
        {rank !== undefined && (
          <span className="flex-shrink-0 w-5 text-[11px] font-mono text-surface-500 pt-0.5">
            {rank}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {/* Statement */}
          <p className={cn('font-medium text-white leading-snug', compact ? 'text-xs' : 'text-sm')}>
            {topic.statement}
          </p>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2">
            {topic.category && (
              <span className={cn('flex items-center gap-1 text-[11px] font-mono', catColor)}>
                <CatIcon className="h-3 w-3 flex-shrink-0" />
                {topic.category}
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              {topic.total_votes.toLocaleString()} votes
            </span>
            <span className={cn('text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md border', cfg.bg, cfg.color, cfg.border)}>
              {cfg.label}
            </span>
          </div>

          {/* Vote split bar */}
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-for-400">FOR {forPct}%</span>
              <span className="text-surface-500">instability {topic.instability}%</span>
              <span className="text-against-400">AGAINST {againstPct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden bg-surface-300/50 flex">
              <div
                className="h-full bg-gradient-to-r from-for-700 to-for-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-600 transition-all duration-500"
                style={{ width: `${againstPct}%` }}
              />
            </div>
          </div>

          {/* Turbulence score bar */}
          {!compact && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-surface-500">turbulence score</span>
                <span className={cfg.color}>{topic.turbulence_score}</span>
              </div>
              <TurbulenceBar value={topic.turbulence_score} max={maxScore} />
            </div>
          )}
        </div>

        <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1" />
      </div>
    </Link>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  maxTurbulence,
}: {
  cat: CategoryTurbulence
  maxTurbulence: number
}) {
  const [expanded, setExpanded] = useState(false)
  const CatIcon = CAT_CONFIG[cat.category]?.icon ?? Activity
  const catColor = CAT_CONFIG[cat.category]?.color ?? 'text-surface-400'
  const cfg = zoneConfig(
    cat.avg_turbulence >= 80 ? 'extreme'
    : cat.avg_turbulence >= 60 ? 'high'
    : cat.avg_turbulence >= 40 ? 'moderate'
    : 'low',
  )

  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-200/40 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-3.5 hover:bg-surface-200/60 transition-colors text-left"
      >
        <span className={cn('flex-shrink-0', catColor)}>
          <CatIcon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-white">{cat.category}</span>
            <div className="flex items-center gap-2">
              <span className={cn('text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded border', cfg.bg, cfg.color, cfg.border)}>
                {cat.avg_turbulence}
              </span>
              <span className="text-[11px] text-surface-500 font-mono">{cat.topic_count}t</span>
            </div>
          </div>
          <TurbulenceBar value={cat.avg_turbulence} max={maxTurbulence} />
        </div>
        {expanded
          ? <ChevronUp className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          : <ChevronDown className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />}
      </button>

      {expanded && cat.top_topic && (
        <div className="px-3.5 pb-3.5 pt-0 border-t border-surface-300/50">
          <p className="text-[10px] font-mono text-surface-500 mb-2 pt-2">Top turbulent topic</p>
          <TurbulenceCard
            topic={cat.top_topic}
            maxScore={cat.top_topic.turbulence_score}
            compact
          />
        </div>
      )}
    </div>
  )
}

// ─── Header gauge ─────────────────────────────────────────────────────────────

function TurbulenceGauge({ index }: { index: number }) {
  const { label, color } = platformTurbulenceLabel(index)
  const segments = [
    { from: 0,  to: 15,  color: 'bg-emerald/70' },
    { from: 15, to: 35,  color: 'bg-for-500/70' },
    { from: 35, to: 55,  color: 'bg-gold/70' },
    { from: 55, to: 75,  color: 'bg-orange-500/70' },
    { from: 75, to: 100, color: 'bg-against-500/70' },
  ]

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Segmented gauge bar */}
      <div className="relative w-full h-3 rounded-full overflow-hidden flex gap-px">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn('h-full transition-opacity duration-700', seg.color)}
            style={{ width: `${seg.to - seg.from}%`, opacity: index >= seg.from ? 1 : 0.15 }}
          />
        ))}
        {/* Needle */}
        <motion.div
          className="absolute top-0 bottom-0 w-0.5 bg-white rounded-full shadow"
          initial={{ left: '0%' }}
          animate={{ left: `${Math.min(99, index)}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between w-full text-[10px] font-mono text-surface-600">
        <span>Smooth</span>
        <span className={cn('font-semibold text-sm', color)}>{label}</span>
        <span>Storm</span>
      </div>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'top' as const,      label: 'Top Turbulent',   icon: Wind },
  { id: 'swings' as const,   label: 'Extreme Swings',  icon: Scale },
  { id: 'surging' as const,  label: 'Surging New',     icon: Sparkles },
  { id: 'categories' as const, label: 'Categories',    icon: Activity },
]

type TabId = typeof TABS[number]['id']

// ─── Main component ───────────────────────────────────────────────────────────

export function TurbulenceClient() {
  const [data, setData] = useState<TurbulenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('top')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/stats/turbulence', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as TurbulenceResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const maxScore = data
    ? Math.max(...data.top_turbulent.map((t) => t.turbulence_score), 1)
    : 100

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24 space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Wind className="h-5 w-5 text-against-300" />
                Civic Turbulence
              </h1>
              <p className="text-xs text-surface-500 mt-0.5">
                High engagement · near 50/50 · actively contested right now
              </p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh turbulence data"
              className="p-2 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 text-surface-400', loading && 'animate-spin')} />
            </button>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && !data && (
          <div className="space-y-4">
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
            {/* Gauge skeleton */}
            <Skeleton className="h-16 rounded-2xl" />
            {/* List skeletons */}
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && !data && (
          <EmptyState
            icon={AlertTriangle}
            title="Turbulence data unavailable"
            description="Could not load the turbulence index. Try refreshing."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {/* Content */}
        {data && (
          <>
            {/* Stats grid */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {[
                {
                  label: 'Platform Index',
                  value: <AnimatedNumber value={data.stats.platform_turbulence_index} suffix="/100" className="text-xl font-bold text-white" />,
                  sub: platformTurbulenceLabel(data.stats.platform_turbulence_index).label,
                  subColor: platformTurbulenceLabel(data.stats.platform_turbulence_index).color,
                  icon: Wind,
                  iconColor: 'text-against-300',
                },
                {
                  label: 'Extreme Zones',
                  value: <AnimatedNumber value={data.stats.extreme_count} className="text-xl font-bold text-against-300" />,
                  sub: `of ${data.stats.total_active} active`,
                  subColor: 'text-surface-500',
                  icon: AlertTriangle,
                  iconColor: 'text-against-300',
                },
                {
                  label: 'High Turbulence',
                  value: <AnimatedNumber value={data.stats.high_count} className="text-xl font-bold text-orange-400" />,
                  sub: 'topics',
                  subColor: 'text-surface-500',
                  icon: Zap,
                  iconColor: 'text-orange-400',
                },
                {
                  label: 'Avg Instability',
                  value: <AnimatedNumber value={data.stats.avg_instability} suffix="%" className="text-xl font-bold text-gold" />,
                  sub: `${data.stats.pct_turbulent}% turbulent`,
                  subColor: 'text-surface-500',
                  icon: Scale,
                  iconColor: 'text-gold',
                },
              ].map(({ label, value, sub, subColor, icon: Icon, iconColor }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-surface-300/50 bg-surface-200/40 p-3 flex flex-col gap-1"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('h-3.5 w-3.5', iconColor)} />
                    <span className="text-[11px] font-mono text-surface-500">{label}</span>
                  </div>
                  {value}
                  <span className={cn('text-[10px] font-mono', subColor)}>{sub}</span>
                </div>
              ))}
            </motion.div>

            {/* Platform gauge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-surface-300/50 bg-surface-200/40 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Wind className="h-4 w-4 text-against-300" />
                <span className="text-xs font-semibold text-white">Platform Turbulence Level</span>
              </div>
              <TurbulenceGauge index={data.stats.platform_turbulence_index} />
            </motion.div>

            {/* Tabs */}
            <div className="flex bg-surface-200/60 border border-surface-300 rounded-xl p-0.5 gap-0.5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={activeTab === tab.id}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all',
                    activeTab === tab.id
                      ? 'bg-surface-100 text-white shadow'
                      : 'text-surface-500 hover:text-surface-300',
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5 hidden sm:block" />
                  <span className="hidden sm:block">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              {activeTab === 'top' && (
                <motion.div
                  key="top"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs text-surface-500 font-mono">
                    <Wind className="w-3.5 h-3.5 text-against-300" />
                    <span>Ranked by turbulence = instability × volume × activity</span>
                  </div>
                  {data.top_turbulent.length === 0 ? (
                    <EmptyState
                      icon={Wind}
                      title="No turbulent topics"
                      description="The platform is in smooth consensus-building mode right now."
                    />
                  ) : (
                    data.top_turbulent.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <TurbulenceCard topic={topic} rank={i + 1} maxScore={maxScore} />
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'swings' && (
                <motion.div
                  key="swings"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs text-surface-500 font-mono">
                    <Scale className="w-3.5 h-3.5 text-against-400" />
                    <span>Closest to 50/50 — pure instability, regardless of volume</span>
                  </div>
                  {data.extreme_swings.length === 0 ? (
                    <EmptyState
                      icon={Scale}
                      title="No extreme swings"
                      description="No debates are currently split right down the middle."
                    />
                  ) : (
                    data.extreme_swings.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <TurbulenceCard topic={topic} rank={i + 1} maxScore={maxScore} />
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'surging' && (
                <motion.div
                  key="surging"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs text-surface-500 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-purple" />
                    <span>New topics (last 7 days) already showing turbulence — watch these closely</span>
                  </div>
                  {data.surging_unstable.length === 0 ? (
                    <EmptyState
                      icon={Sparkles}
                      title="No new turbulence"
                      description="No recent topics have reached turbulent status yet this week."
                    />
                  ) : (
                    data.surging_unstable.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <TurbulenceCard topic={topic} rank={i + 1} maxScore={maxScore} />
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === 'categories' && (
                <motion.div
                  key="categories"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs text-surface-500 font-mono">
                    <Activity className="w-3.5 h-3.5 text-purple" />
                    <span>Categories ranked by average turbulence score</span>
                  </div>
                  {data.category_breakdown.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title="No category data"
                      description="Not enough active topics to show category breakdown."
                    />
                  ) : (
                    data.category_breakdown.map((cat, i) => {
                      const maxCat = Math.max(...data.category_breakdown.map((c) => c.avg_turbulence), 1)
                      return (
                        <motion.div
                          key={cat.category}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <CategoryRow cat={cat} maxTurbulence={maxCat} />
                        </motion.div>
                      )
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Methodology note */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-surface-300/50 bg-surface-200/30 p-4 space-y-2"
            >
              <h3 className="text-xs font-semibold text-surface-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                How turbulence is calculated
              </h3>
              <p className="text-[11px] text-surface-500 leading-relaxed">
                <strong className="text-surface-300">Turbulence Score</strong> = instability(50%) + volume(30%) + activity(20%)
              </p>
              <ul className="text-[11px] text-surface-500 space-y-1 list-disc list-inside">
                <li><strong className="text-surface-400">Instability</strong> — 100% at exact 50/50, 0% at unanimous consensus</li>
                <li><strong className="text-surface-400">Volume</strong> — log-scaled vote count (high engagement amplifies instability)</li>
                <li><strong className="text-surface-400">Activity</strong> — recent engagement signal (debates getting new votes right now)</li>
              </ul>
              <p className="text-[11px] text-surface-500 leading-relaxed">
                High turbulence is not the same as mere controversy. A 50/50 split with 5 votes is not turbulent. These are the debates where <em>thousands</em> of engaged citizens genuinely cannot agree — the most contested civic questions on the platform.
              </p>
            </motion.div>

            {/* Navigation links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-2 gap-2"
            >
              {[
                { href: '/friction',       label: 'Friction Index',   desc: 'Stuck debates by age' },
                { href: '/tipping-point',  label: 'Tipping Points',   desc: 'Close to threshold' },
                { href: '/volatility',     label: 'Volatility',       desc: 'High-variance topics' },
                { href: '/flux',           label: 'Civic Flux',       desc: 'Fastest consensus shifts' },
              ].map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl border border-surface-300/50 bg-surface-200/30 hover:bg-surface-200/60 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-medium text-white group-hover:text-for-300 transition-colors">{label}</p>
                    <p className="text-[11px] text-surface-500">{desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                </Link>
              ))}
            </motion.div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
