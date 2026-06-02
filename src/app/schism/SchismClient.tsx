'use client'

/**
 * /schism — The Civic Schism Index
 *
 * A schism is not just a 50/50 split. It's a split where both sides fight back.
 * Where FOR and AGAINST aren't just opposite votes — they're opposite arguments,
 * opposite convictions, opposite visions of what's right.
 *
 * Schism Score = polarization(0.4) + argument_balance(0.3) + argument_depth(0.3)
 *   polarization     = closeness to 50/50 by vote
 *   argument_balance = how evenly arguments are split between FOR and AGAINST
 *   argument_depth   = log-scaled total argument volume
 *
 * Distinct from:
 *   /turbulence     — chaotic + recent activity surges (a schism can be old and quiet)
 *   /friction       — stuckness × age (doesn't require argued debate)
 *   /battleground   — proximity to 75% threshold (not about debate depth)
 *   /polarization   — category-level vote extremes (not argument-weighted)
 *
 * A topic can be turbulent without arguments. A schism requires voices on both sides.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Scissors,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  SchismResponse,
  SchismTopic,
  CategorySchism,
} from '@/app/api/stats/schism/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 10 * 60 * 1000

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

// ─── Grade helpers ────────────────────────────────────────────────────────────

function gradeConfig(grade: SchismTopic['grade']): {
  label: string
  color: string
  bg: string
  border: string
  desc: string
} {
  switch (grade) {
    case 'deep':     return { label: 'Deep Schism',    color: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/40', desc: 'Deeply divided — votes and arguments at war' }
    case 'moderate': return { label: 'Moderate',       color: 'text-orange-400',   bg: 'bg-orange-500/10',   border: 'border-orange-500/40',  desc: 'Clear divide with voices on both sides' }
    case 'emerging': return { label: 'Emerging',       color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/40',         desc: 'Split forming — debate gaining traction' }
    default:         return { label: 'Surface',        color: 'text-surface-400',  bg: 'bg-surface-300/30',  border: 'border-surface-400/30',  desc: 'Mild disagreement, limited engagement' }
  }
}

function platformLabel(index: number): { label: string; color: string } {
  if (index >= 75) return { label: 'Fractured',       color: 'text-against-300' }
  if (index >= 55) return { label: 'Deeply Divided',  color: 'text-orange-400' }
  if (index >= 35) return { label: 'Contested',       color: 'text-gold' }
  if (index >= 15) return { label: 'Simmering',       color: 'text-for-400' }
  return                   { label: 'Cohesive',        color: 'text-emerald' }
}

// ─── Fault-line bar ───────────────────────────────────────────────────────────

function FaultLine({
  blue_args,
  red_args,
  blue_votes_pct,
  className,
}: {
  blue_args: number
  red_args: number
  blue_votes_pct: number
  className?: string
}) {
  const total_args = blue_args + red_args
  const blue_arg_pct = total_args > 0 ? (blue_args / total_args) * 100 : 50
  const red_arg_pct = 100 - blue_arg_pct

  return (
    <div className={cn('space-y-1', className)}>
      {/* Argument distribution */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-for-400 font-mono w-12 text-right shrink-0">
          {blue_args} FOR
        </span>
        <div className="flex-1 h-2 rounded-full bg-surface-300/50 overflow-hidden flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${blue_arg_pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="h-full bg-for-500 rounded-l-full"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${red_arg_pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
            className="h-full bg-against-500 rounded-r-full"
          />
        </div>
        <span className="text-[10px] text-against-400 font-mono w-16 shrink-0">
          {red_args} AGAINST
        </span>
      </div>
      {/* Vote distribution */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-surface-500 font-mono w-12 text-right shrink-0">
          {Math.round(blue_votes_pct)}%
        </span>
        <div className="flex-1 h-1 rounded-full bg-surface-300/50 overflow-hidden flex">
          <div
            className="h-full bg-for-500/40"
            style={{ width: `${blue_votes_pct}%` }}
          />
          <div
            className="h-full bg-against-500/40"
            style={{ width: `${100 - blue_votes_pct}%` }}
          />
        </div>
        <span className="text-[10px] text-surface-500 font-mono w-16 shrink-0">
          {Math.round(100 - blue_votes_pct)}%
        </span>
      </div>
    </div>
  )
}

// ─── Schism score ring ────────────────────────────────────────────────────────

function SchismRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const fill = (score / 100) * circ
  const color =
    score >= 75 ? '#f87171'
    : score >= 55 ? '#fb923c'
    : score >= 35 ? '#c9a84c'
    : score >= 15 ? '#60a5fa'
    : '#34d399'

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#374151" strokeWidth={4} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - fill }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  )
}

// ─── Single topic card ────────────────────────────────────────────────────────

function SchismCard({
  topic,
  rank,
  compact = false,
}: {
  topic: SchismTopic
  rank?: number
  compact?: boolean
}) {
  const cfg = gradeConfig(topic.grade)
  const CatIcon = topic.category ? (CAT_CONFIG[topic.category]?.icon ?? Scale) : Scale
  const catColor = topic.category ? (CAT_CONFIG[topic.category]?.color ?? 'text-surface-500') : 'text-surface-500'
  const [expanded, setExpanded] = useState(false)

  if (compact) {
    return (
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'flex items-start gap-3 p-3 rounded-xl border transition-colors',
          'bg-surface-100/60 hover:bg-surface-100 border-surface-300',
        )}
      >
        <div className="relative shrink-0">
          <SchismRing score={topic.schism_score} size={40} />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
            {topic.schism_score}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white line-clamp-2 leading-snug">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
            <span className="text-xs text-surface-500">
              {topic.blue_arg_count + topic.red_arg_count} args
            </span>
            <span className="text-xs text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border transition-colors',
        cfg.bg, cfg.border,
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Rank + ring */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {rank !== undefined && (
              <span className="text-xs font-mono text-surface-500">#{rank}</span>
            )}
            <div className="relative">
              <SchismRing score={topic.schism_score} size={52} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                {topic.schism_score}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <CatIcon className={cn('h-3.5 w-3.5 shrink-0', catColor)} />
              {topic.category && (
                <span className={cn('text-xs font-medium', catColor)}>{topic.category}</span>
              )}
              <span className={cn('ml-auto text-xs font-semibold px-2 py-0.5 rounded-full', cfg.color, cfg.bg, cfg.border, 'border')}>
                {cfg.label}
              </span>
            </div>

            <Link
              href={`/topic/${topic.id}`}
              className="text-sm font-semibold text-white hover:text-for-300 transition-colors line-clamp-2 leading-snug block"
            >
              {topic.statement}
            </Link>

            {/* Fault line */}
            <div className="mt-2.5">
              <FaultLine
                blue_args={topic.blue_arg_count}
                red_args={topic.red_arg_count}
                blue_votes_pct={topic.blue_pct}
              />
            </div>

            {/* Score row */}
            <div className="flex items-center gap-3 mt-2.5 flex-wrap">
              <span className="text-xs text-surface-500">
                Polarization <span className="text-white font-mono">{topic.polarization}</span>
              </span>
              <span className="text-xs text-surface-500">
                Arg balance <span className="text-white font-mono">{topic.argument_balance}</span>
              </span>
              <span className="text-xs text-surface-500">
                {topic.total_votes.toLocaleString()} votes
              </span>
              <button
                onClick={() => setExpanded((e) => !e)}
                className="ml-auto text-xs text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                aria-label={expanded ? 'Collapse arguments' : 'View arguments'}
              >
                <MessageSquare className="h-3 w-3" />
                {topic.total_arg_count}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Argument preview */}
      <AnimatePresence>
        {expanded && (topic.top_blue_arg || topic.top_red_arg) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {topic.top_blue_arg && (
                <div className="rounded-xl bg-for-500/10 border border-for-500/20 p-3">
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-[10px] font-bold text-for-400 uppercase tracking-wide">FOR</span>
                  </div>
                  <p className="text-xs text-surface-700 leading-snug line-clamp-3">
                    {topic.top_blue_arg}
                  </p>
                </div>
              )}
              {topic.top_red_arg && (
                <div className="rounded-xl bg-against-500/10 border border-against-500/20 p-3">
                  <div className="flex items-center gap-1 mb-1.5">
                    <span className="text-[10px] font-bold text-against-400 uppercase tracking-wide">AGAINST</span>
                  </div>
                  <p className="text-xs text-surface-700 leading-snug line-clamp-3">
                    {topic.top_red_arg}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategorySchism }) {
  const cfg = gradeConfig(cat.dominant_grade)
  const CatIcon = CAT_CONFIG[cat.category]?.icon ?? Scale
  const catColor = CAT_CONFIG[cat.category]?.color ?? 'text-surface-500'

  return (
    <div className={cn('rounded-2xl border p-4', cfg.bg, cfg.border)}>
      <div className="flex items-center gap-2 mb-3">
        <CatIcon className={cn('h-4 w-4 shrink-0', catColor)} />
        <span className="text-sm font-semibold text-white">{cat.category}</span>
        <span className={cn('ml-auto text-xs font-mono', cfg.color)}>{cat.avg_schism}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500">Topics</span>
          <span className="text-white font-mono">{cat.topic_count}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500">Avg polarization</span>
          <span className="text-white font-mono">{cat.avg_polarization}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-surface-500">Dominant grade</span>
          <span className={cn('font-medium', cfg.color)}>{cfg.label}</span>
        </div>
      </div>

      {cat.top_topic && (
        <Link
          href={`/topic/${cat.top_topic.id}`}
          className="mt-3 flex items-start gap-1.5 text-xs text-surface-600 hover:text-white transition-colors group"
        >
          <ArrowRight className="h-3 w-3 shrink-0 mt-0.5 group-hover:text-for-400 transition-colors" />
          <span className="line-clamp-2">{cat.top_topic.statement}</span>
        </Link>
      )}
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SchismSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Skeleton className="h-3 w-4 rounded" />
              <Skeleton className="h-12 w-12 rounded-full" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-4/5 rounded" />
              <Skeleton className="h-4 w-full rounded-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'top' | 'contested' | 'vote_splits' | 'categories'

const TABS: { id: Tab; label: string; icon: typeof Scissors }[] = [
  { id: 'top',        label: 'Top Schisms',    icon: Scissors },
  { id: 'contested',  label: 'Most Contested', icon: MessageSquare },
  { id: 'vote_splits',label: 'Vote Splits',    icon: Scale },
  { id: 'categories', label: 'By Category',   icon: Sparkles },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function SchismClient() {
  const [data, setData] = useState<SchismResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('top')
  const [catFilter, setCatFilter] = useState<string>('All')
  const fetchRef = useRef(0)

  const load = useCallback(async () => {
    const id = ++fetchRef.current
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/stats/schism')
      if (!res.ok) throw new Error('fetch')
      const json: SchismResponse = await res.json()
      if (id === fetchRef.current) setData(json)
    } catch {
      if (id === fetchRef.current) setError(true)
    } finally {
      if (id === fetchRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  const stats = data?.stats
  const plat = platformLabel(stats?.platform_schism_index ?? 0)

  // Category list for filter
  const categories = ['All', ...(data?.category_breakdown.map((c) => c.category) ?? [])]

  // Filtered top schismatic
  const filteredTop = (data?.top_schismatic ?? []).filter(
    (t) => catFilter === 'All' || t.category === catFilter,
  )


  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">

        {/* Hero */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-against-300" />
            <h1 className="text-2xl font-bold text-white tracking-tight">The Civic Schism</h1>
          </div>
          <p className="text-sm text-surface-500">
            The debates where both sides don&apos;t just vote differently — they argue differently.
            Ranked by split depth: vote polarization × argument balance × engagement volume.
          </p>
        </div>

        {/* Platform index card */}
        {loading && !data ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-7 w-14 rounded" />
                  <Skeleton className="h-3 w-20 rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : stats ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-surface-500 uppercase tracking-widest mb-0.5">
                  Platform Schism Index
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-mono text-white">
                    <AnimatedNumber value={stats.platform_schism_index} />
                  </span>
                  <span className={cn('text-sm font-semibold', plat.color)}>{plat.label}</span>
                </div>
              </div>
              <button
                onClick={load}
                disabled={loading}
                className="p-2 rounded-xl hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Deep schisms',     value: stats.deep_count,                 color: 'text-against-300' },
                { label: 'Moderate',         value: stats.moderate_count,             color: 'text-orange-400' },
                { label: 'Avg polarization', value: `${stats.avg_polarization}`,      color: 'text-gold' },
                { label: '% schismatic',     value: `${stats.pct_schismatic}%`,       color: 'text-for-400' },
              ].map((s) => (
                <div key={s.label} className="bg-surface-200/50 rounded-xl p-3 text-center">
                  <div className={cn('text-xl font-bold font-mono', s.color)}>{s.value}</div>
                  <div className="text-xs text-surface-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <p className="text-xs text-surface-600 mt-3">
              {stats.total_analyzed} active topics analyzed &middot;{' '}
              {stats.total_contested_arguments.toLocaleString()} arguments in top schisms
            </p>
          </motion.div>
        ) : null}

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1 border border-surface-300">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                tab === t.id
                  ? 'bg-surface-200 text-white shadow-sm'
                  : 'text-surface-500 hover:text-white',
              )}
            >
              <t.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Category filter (only on top tab) */}
        {tab === 'top' && data && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                  catFilter === cat
                    ? 'bg-for-500 border-for-500 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {error ? (
          <EmptyState
            icon={Scissors}
            title="Couldn't load schism data"
            description="Couldn't fetch schism data. Check your connection and try again."
            action={{ label: 'Retry', onClick: load }}
          />
        ) : loading && !data ? (
          <SchismSkeleton />
        ) : (
          <AnimatePresence mode="wait">
            {tab === 'top' && (
              <motion.div
                key="top"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                {filteredTop.length === 0 ? (
                  <EmptyState
                    icon={Scissors}
                    title="No schisms in this category"
                    description="Not enough argued debate here yet. Try a different filter."
                  />
                ) : (
                  filteredTop.map((t, i) => (
                    <SchismCard
                      key={t.id}
                      topic={t}
                      rank={i + 1}
                    />
                  ))
                )}
              </motion.div>
            )}

            {tab === 'contested' && (
              <motion.div
                key="contested"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <p className="text-xs text-surface-500 px-1">
                  Topics where FOR and AGAINST arguments are most evenly matched — the debates both sides fight hardest.
                </p>
                {(data?.most_contested ?? []).length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No contested data yet"
                    description="As users post arguments, contested debates will appear here."
                  />
                ) : (
                  (data?.most_contested ?? []).map((t) => (
                    <SchismCard
                      key={t.id}
                      topic={t}
                    />
                  ))
                )}
              </motion.div>
            )}

            {tab === 'vote_splits' && (
              <motion.div
                key="vote_splits"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <p className="text-xs text-surface-500 px-1">
                  Topics closest to a perfect 50/50 vote split. These are the purest expressions of civic deadlock.
                </p>
                {(data?.vote_splits ?? []).map((t) => (
                  <SchismCard
                    key={t.id}
                    topic={t}
                    maxScore={maxScore}
                  />
                ))}
              </motion.div>
            )}

            {tab === 'categories' && (
              <motion.div
                key="categories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <p className="text-xs text-surface-500 px-1">
                  Where are the deepest ideological fault lines? Ranked by average schism score across all topics in each category.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(data?.category_breakdown ?? []).map((cat) => (
                    <CategoryCard key={cat.category} cat={cat} />
                  ))}
                </div>

                {(data?.category_breakdown ?? []).length === 0 && (
                  <EmptyState
                    icon={Sparkles}
                    title="No category data yet"
                    description="As more topics accumulate, category breakdowns will appear here."
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Legend */}
        {data && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3">
              How schism is scored
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-surface-500">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-for-400 shrink-0" />
                  <span className="font-medium text-white">Polarization (40%)</span>
                </div>
                <p>How close the vote is to 50/50. Max when exactly deadlocked.</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-gold shrink-0" />
                  <span className="font-medium text-white">Argument balance (30%)</span>
                </div>
                <p>How evenly arguments are distributed. Max when each side has equal representation.</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-purple shrink-0" />
                  <span className="font-medium text-white">Argument depth (30%)</span>
                </div>
                <p>Log-scaled total argument count. Without arguments there&apos;s no schism — just a vote.</p>
              </div>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
