'use client'

/**
 * /friction — The Civic Friction Index
 *
 * In physics, friction is the force that resists motion. In civic debate,
 * "friction" describes topics that accumulate massive engagement yet can't
 * reach a verdict — stuck near the 50/50 deadlock, sometimes for months.
 *
 * Friction Score = total_votes × stuck_factor × √days_active / 100
 *   where stuck_factor = 1 – |blue_pct – 50| / 50  (1.0 at exact 50/50, 0 at unanimous)
 *
 * High friction ≠ bad. Some civic questions are genuinely hard. But the
 * friction map shows WHERE the community's deepest, most intractable
 * disagreements live.
 *
 * Distinct from:
 *   /tipping-point  — topics closest to 50/50 right now (snapshot)
 *   /convergence    — topics building toward agreement
 *   /equilibrium    — topics in long-term stable state
 *   /drought        — topics with recent low engagement
 *   /inertia        — topics that haven't changed recently
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Lock,
  Music2,
  RefreshCw,
  Scale,
  Timer,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  FrictionResponse,
  FrictionTopic,
  CategoryFriction,
} from '@/app/api/stats/friction/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 15 * 60 * 1000 // 15 minutes

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

// ─── Friction level helpers ───────────────────────────────────────────────────

function frictionLevel(score: number): {
  label: string
  color: string
  bg: string
  border: string
  glow: string
} {
  if (score >= 50)  return { label: 'Critical', color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/40', glow: 'shadow-against-500/20' }
  if (score >= 20)  return { label: 'High',     color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/40', glow: 'shadow-orange-500/20' }
  if (score >= 8)   return { label: 'Medium',   color: 'text-gold',        bg: 'bg-gold/10',       border: 'border-gold/40',       glow: 'shadow-gold/20' }
  return              { label: 'Low',       color: 'text-surface-400', bg: 'bg-surface-300/30',border: 'border-surface-400/40',glow: '' }
}

function platformFrictionLabel(index: number): { label: string; color: string } {
  if (index >= 70) return { label: 'Gridlocked',   color: 'text-against-300' }
  if (index >= 50) return { label: 'High Friction', color: 'text-orange-400' }
  if (index >= 30) return { label: 'Contested',     color: 'text-gold' }
  if (index >= 15) return { label: 'Active',        color: 'text-for-400' }
  return                   { label: 'Fluid',         color: 'text-emerald' }
}

// ─── Friction gauge bar ───────────────────────────────────────────────────────

function FrictionBar({
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

// ─── Single friction topic card ───────────────────────────────────────────────

function FrictionCard({
  topic,
  rank,
  maxScore,
  compact = false,
}: {
  topic: FrictionTopic
  rank?: number
  maxScore: number
  compact?: boolean
}) {
  const level = frictionLevel(topic.friction_score)
  const CatIcon = topic.category ? (CAT_CONFIG[topic.category]?.icon ?? Activity) : Activity
  const catColor = topic.category ? (CAT_CONFIG[topic.category]?.color ?? 'text-surface-400') : 'text-surface-400'

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const distFrom50 = Math.abs(topic.blue_pct - 50).toFixed(1)

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex items-start gap-3 rounded-xl border transition-all',
        'bg-surface-200/40 hover:bg-surface-200/70',
        level.border,
        compact ? 'p-3' : 'p-4',
        'hover:shadow-lg',
      )}
    >
      {rank !== undefined && (
        <span className="shrink-0 w-6 text-center text-[11px] font-mono text-surface-500 mt-0.5">
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start gap-2">
          <CatIcon className={cn('shrink-0 mt-0.5 w-3.5 h-3.5', catColor)} />
          <p className={cn(
            'font-medium text-surface-100 leading-snug group-hover:text-white transition-colors line-clamp-2',
            compact ? 'text-xs' : 'text-xs sm:text-[13px]'
          )}>
            {topic.statement}
          </p>
        </div>

        {/* Deadlock bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">{forPct}% FOR</span>
            <span className="text-surface-500">{distFrom50}pt from 50/50</span>
            <span className="text-against-400">{againstPct}% AGAINST</span>
          </div>
          <div className="h-1.5 rounded-full bg-against-500/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500/70 transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        {/* Friction score bar */}
        <FrictionBar value={topic.friction_score} max={maxScore} />

        <div className="flex items-center gap-3 flex-wrap">
          <span className={cn('text-[10px] font-mono font-bold', level.color)}>
            {level.label} · {topic.friction_score.toFixed(1)}
          </span>
          <span className="text-[10px] text-surface-500 font-mono flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            {topic.total_votes.toLocaleString()}
          </span>
          <span className="text-[10px] text-surface-500 font-mono flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {topic.days_active}d
          </span>
          <span className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
            level.bg,
            level.border,
            level.color,
          )}>
            {topic.stuck_factor}% stuck
          </span>
        </div>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-surface-500 group-hover:text-surface-300 transition-colors shrink-0 mt-1" />
    </Link>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
  cat,
  maxFriction,
}: {
  cat: CategoryFriction
  maxFriction: number
}) {
  const [expanded, setExpanded] = useState(false)
  const CatIcon = CAT_CONFIG[cat.category]?.icon ?? Activity
  const catColor = CAT_CONFIG[cat.category]?.color ?? 'text-surface-400'
  const level = frictionLevel(cat.avg_friction)

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      level.border,
      'bg-surface-200/30',
    )}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        <CatIcon className={cn('w-4 h-4 shrink-0', catColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-surface-100">{cat.category}</span>
            <span className={cn('text-[10px] font-mono', level.color)}>{level.label}</span>
          </div>
          <FrictionBar value={cat.avg_friction} max={maxFriction} className="mt-1.5 w-32" />
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right hidden sm:block">
            <div className={cn('text-sm font-mono font-bold', level.color)}>
              {cat.avg_friction.toFixed(1)}
            </div>
            <div className="text-[10px] text-surface-500">avg friction</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-surface-300">{cat.topic_count}</div>
            <div className="text-[10px] text-surface-500">topics</div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-mono text-surface-300">{cat.avg_days_active}d</div>
            <div className="text-[10px] text-surface-500">avg age</div>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-surface-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-surface-400" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && cat.top_topic && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-surface-300/30">
              <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-2">
                Highest friction in category
              </p>
              <FrictionCard
                topic={cat.top_topic}
                maxScore={maxFriction}
                compact
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = 'top' | 'deadlocks' | 'long_runners' | 'categories'

export function FrictionClient() {
  const [data, setData] = useState<FrictionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('top')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stats/friction')
      if (!res.ok) throw new Error('Failed to load')
      const json: FrictionResponse = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch {
      setError('Could not load friction data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => load(true), REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const maxScore = data
    ? Math.max(...data.top_friction.map((t) => t.friction_score), 1)
    : 100

  const frLabel = data ? platformFrictionLabel(data.stats.platform_friction_index) : null

  const TABS: { id: Tab; label: string; icon: typeof Lock }[] = [
    { id: 'top',          label: 'Top Friction',  icon: Lock },
    { id: 'deadlocks',    label: 'Deadlocks',     icon: Scale },
    { id: 'long_runners', label: 'Long Runners',  icon: Timer },
    { id: 'categories',   label: 'Categories',    icon: Activity },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-24 space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-[11px] text-surface-500 hover:text-surface-300 transition-colors font-mono uppercase tracking-wider"
          >
            <ArrowLeft className="w-3 h-3" />
            Lobby
          </Link>
          <div className="flex items-start justify-between gap-4 mt-2">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-orange-400" />
                Civic Friction Index
              </h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Debates that resist resolution — high votes, long life, no verdict
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="shrink-0 p-1.5 rounded-lg border border-surface-300 text-surface-500 hover:text-surface-300 transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
          {data && (
            <p className="text-[10px] text-surface-600 font-mono">
              Updated {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-4 text-against-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Content */}
        {data && !loading && (
          <>
            {/* Platform stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Friction Index',
                  value: data.stats.platform_friction_index,
                  suffix: '',
                  sub: frLabel?.label ?? '',
                  color: frLabel?.color ?? 'text-surface-400',
                  icon: Lock,
                },
                {
                  label: 'High Friction',
                  value: data.stats.high_friction_count,
                  suffix: ' topics',
                  sub: 'score > 10',
                  color: 'text-orange-400',
                  icon: AlertTriangle,
                },
                {
                  label: 'Avg Age',
                  value: data.stats.avg_days_active,
                  suffix: 'd',
                  sub: 'days unresolved',
                  color: 'text-gold',
                  icon: Calendar,
                },
                {
                  label: 'Deadlocked',
                  value: data.stats.pct_deadlocked,
                  suffix: '%',
                  sub: '±10pt of 50/50',
                  color: 'text-against-300',
                  icon: Scale,
                },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-3 sm:p-4"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                    <stat.icon className="w-3 h-3" />
                    {stat.label}
                  </div>
                  <div className={cn('text-2xl font-bold font-mono', stat.color)}>
                    <AnimatedNumber value={stat.value} />
                    <span className="text-sm font-normal text-surface-400">{stat.suffix}</span>
                  </div>
                  <div className="text-[10px] text-surface-500 mt-0.5">{stat.sub}</div>
                </motion.div>
              ))}
            </div>

            {/* Platform friction gauge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 sm:p-5"
            >
              <div className="flex items-center gap-2 text-xs font-mono text-orange-400 uppercase tracking-wider mb-3">
                <Zap className="w-3.5 h-3.5" />
                Platform Friction Gauge
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] text-surface-500 font-mono mb-1">
                    <span>Fluid</span>
                    <span>Contested</span>
                    <span>Gridlocked</span>
                  </div>
                  <div className="h-4 rounded-full bg-gradient-to-r from-emerald via-gold to-against-500 relative overflow-hidden">
                    <div
                      className="absolute inset-y-0 right-0 bg-surface-50/60"
                      style={{ width: `${100 - data.stats.platform_friction_index}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-orange-400 shadow"
                      style={{ left: `calc(${data.stats.platform_friction_index}% - 6px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-surface-600 font-mono mt-1">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-3xl font-bold font-mono', frLabel?.color)}>
                    {data.stats.platform_friction_index}
                  </div>
                  <div className={cn('text-xs font-mono', frLabel?.color)}>
                    {frLabel?.label}
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">
                A score of <strong className="text-surface-300">{data.stats.platform_friction_index}</strong> means {' '}
                {data.stats.platform_friction_index >= 50
                  ? 'the Lobby is experiencing significant gridlock — many active debates are stuck near 50/50 with no path to resolution.'
                  : data.stats.platform_friction_index >= 30
                  ? 'the Lobby is moderately contested — several long-running debates are resisting consensus.'
                  : 'the Lobby is relatively fluid — most debates are trending toward resolution or have clear momentum.'
                }
              </p>
            </motion.div>

            {/* Tabs */}
            <div className="flex gap-1 bg-surface-200 rounded-xl p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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

            {/* Tab: Top Friction */}
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
                    <Lock className="w-3.5 h-3.5 text-orange-400" />
                    <span>Ranked by friction score = votes × stuckness × age</span>
                  </div>
                  {data.top_friction.length === 0 ? (
                    <EmptyState
                      icon={Lock}
                      title="No high-friction topics"
                      description="All active debates are moving toward resolution."
                    />
                  ) : (
                    data.top_friction.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <FrictionCard
                          topic={topic}
                          rank={i + 1}
                          maxScore={maxScore}
                        />
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* Tab: Deadlocks */}
              {activeTab === 'deadlocks' && (
                <motion.div
                  key="deadlocks"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs text-surface-500 font-mono">
                    <Scale className="w-3.5 h-3.5 text-against-400" />
                    <span>Topics closest to exactly 50/50 (≥30 votes) — pure deadlock</span>
                  </div>
                  {data.extreme_deadlocks.length === 0 ? (
                    <EmptyState
                      icon={Scale}
                      title="No deadlocked topics"
                      description="No active topics are near the 50/50 split right now."
                    />
                  ) : (
                    data.extreme_deadlocks.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <FrictionCard
                          topic={topic}
                          rank={i + 1}
                          maxScore={maxScore}
                        />
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* Tab: Long Runners */}
              {activeTab === 'long_runners' && (
                <motion.div
                  key="long_runners"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 text-xs text-surface-500 font-mono">
                    <Timer className="w-3.5 h-3.5 text-gold" />
                    <span>Oldest unresolved debates (≥10 votes) — entrenched controversies</span>
                  </div>
                  {data.long_runners.length === 0 ? (
                    <EmptyState
                      icon={Timer}
                      title="No long-running topics"
                      description="All active topics are relatively recent."
                    />
                  ) : (
                    data.long_runners.map((topic, i) => (
                      <motion.div
                        key={topic.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <FrictionCard
                          topic={topic}
                          rank={i + 1}
                          maxScore={maxScore}
                        />
                      </motion.div>
                    ))
                  )}
                </motion.div>
              )}

              {/* Tab: Categories */}
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
                    <span>Category friction — ranked by average friction score</span>
                  </div>
                  {data.category_breakdown.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title="No category data"
                      description="Not enough active topics to show category breakdown."
                    />
                  ) : (
                    data.category_breakdown.map((cat, i) => {
                      const maxCatFriction = Math.max(
                        ...data.category_breakdown.map((c) => c.avg_friction),
                        1,
                      )
                      return (
                        <motion.div
                          key={cat.category}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <CategoryRow cat={cat} maxFriction={maxCatFriction} />
                        </motion.div>
                      )
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer explanation */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl border border-surface-300/50 bg-surface-200/30 p-4 space-y-2"
            >
              <h3 className="text-xs font-semibold text-surface-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                How friction is calculated
              </h3>
              <p className="text-[11px] text-surface-500 leading-relaxed">
                <strong className="text-surface-300">Friction Score</strong> = votes × stuck_factor × √days_active / 100
              </p>
              <ul className="text-[11px] text-surface-500 space-y-1 list-disc list-inside">
                <li><strong className="text-surface-400">Votes</strong> — more debate engagement increases friction surface</li>
                <li><strong className="text-surface-400">Stuck factor</strong> — 100% at exact 50/50, 0% at unanimous consensus</li>
                <li><strong className="text-surface-400">Age</strong> — older open topics accumulate entrenchment (sqrt dampens runaway)</li>
              </ul>
              <p className="text-[11px] text-surface-500 leading-relaxed">
                High friction is not a flaw — it reflects genuine societal disagreement. The hardest debates are the ones most worth having.
              </p>
            </motion.div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
