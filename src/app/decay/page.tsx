'use client'

/**
 * /decay — The Civic Decay Index
 *
 * Identifies open debates that once had meaningful engagement but are now
 * going quiet. Not resolved — just forgotten. The platform's cold cases.
 *
 * Measures the drop in vote volume between two consecutive weekly windows:
 *   Window A = votes cast 0–7 days ago   (recent)
 *   Window B = votes cast 7–14 days ago  (prior)
 *
 * decay_rate = (prior − recent) / prior × 100
 *
 * Three tiers:
 *   DORMANT  — ≥ 80% drop — all but silent; may never recover
 *   FADING   — ≥ 60% drop — activity significantly declining
 *   COOLING  — ≥ 40% drop — noticeable momentum loss
 *
 * Distinct from:
 *   /inertia      — topics that resist change (still actively contested)
 *   /drift        — category-level ideological drift over months
 *   /gravity      — new topics attracting initial votes (opposite direction)
 *   /undertow     — hidden momentum opposing the surface consensus
 *   /convergence  — whether recent voters are more aligned than the average
 *   /cold         — does not exist; /decay is the only "forgotten" signal
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BatteryLow,
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Signal,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  DecayResponse,
  DecayTopic,
  DecayStats,
  CategoryDecay,
} from '@/app/api/topics/decay/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decayLabel(rate: number): string {
  if (rate >= 95) return 'Completely Silent'
  if (rate >= 80) return 'Near-Dormant'
  if (rate >= 60) return 'Rapidly Fading'
  return 'Cooling Off'
}

function decayColor(cls: DecayTopic['decay_class']): {
  bar: string; bg: string; border: string; text: string; badge: string
} {
  switch (cls) {
    case 'dormant': return {
      bar:    'bg-against-500',
      bg:     'bg-against-500/8',
      border: 'border-against-500/25 hover:border-against-500/50',
      text:   'text-against-400',
      badge:  'text-against-300 bg-against-500/10 border-against-500/30',
    }
    case 'fading': return {
      bar:    'bg-amber-500',
      bg:     'bg-amber-500/8',
      border: 'border-amber-500/25 hover:border-amber-500/50',
      text:   'text-amber-400',
      badge:  'text-amber-300 bg-amber-500/10 border-amber-500/30',
    }
    case 'cooling': return {
      bar:    'bg-for-600',
      bg:     'bg-for-500/8',
      border: 'border-for-600/25 hover:border-for-600/50',
      text:   'text-for-400',
      badge:  'text-for-300 bg-for-500/10 border-for-500/30',
    }
  }
}

// ─── Decay Card ───────────────────────────────────────────────────────────────

function DecayCard({
  topic,
  rank,
}: {
  topic: DecayTopic
  rank: number
}) {
  const statusCfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-500' }
  const catClass  = topic.category
    ? (CATEGORY_COLORS[topic.category] ?? 'bg-surface-200 text-surface-400 border-surface-400/30')
    : ''
  const col = decayColor(topic.decay_class)
  const isSilent = topic.recent_count === 0

  const tierLabel =
    topic.decay_class === 'dormant' ? 'Dormant'
    : topic.decay_class === 'fading' ? 'Fading'
    : 'Cooling'

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
          col.border
        )}
        aria-label={topic.statement}
      >
        {/* Top row: rank + badges */}
        <div className="flex items-start gap-3">
          <span className={cn(
            'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold mt-0.5',
            col.badge
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
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide border', col.badge)}>
                {tierLabel}
              </span>
              {isSilent && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide border text-surface-600 border-surface-600/30 bg-surface-600/10 flex items-center gap-1">
                  <VolumeX className="h-2.5 w-2.5" />
                  Silent
                </span>
              )}
            </div>

            {/* Statement */}
            <p className="text-sm font-medium text-surface-900 leading-snug group-hover:text-white transition-colors mb-3 line-clamp-2">
              {topic.statement}
            </p>

            {/* Window comparison */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Prior window */}
              <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 px-3 py-2">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">7–14 days ago</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold font-mono tabular-nums text-surface-700">
                    {topic.prior_count}
                  </span>
                  <span className="text-[11px] text-surface-500">votes</span>
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <Volume2 className="h-2.5 w-2.5 text-surface-600" />
                  <span className="text-[10px] text-surface-600">Active then</span>
                </div>
              </div>

              {/* Recent window */}
              <div className={cn(
                'rounded-xl border px-3 py-2',
                isSilent
                  ? 'bg-against-500/6 border-against-500/20'
                  : 'bg-surface-200/60 border-surface-300/60'
              )}>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Last 7 days</p>
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    'text-lg font-bold font-mono tabular-nums',
                    isSilent ? 'text-against-500' : col.text
                  )}>
                    {topic.recent_count}
                  </span>
                  <span className="text-[11px] text-surface-500">votes</span>
                </div>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {isSilent
                    ? <VolumeX className="h-2.5 w-2.5 text-against-500" />
                    : <TrendingDown className="h-2.5 w-2.5 text-amber-500" />
                  }
                  <span className={cn('text-[10px]', isSilent ? 'text-against-500' : 'text-amber-500')}>
                    {isSilent ? 'Complete silence' : decayLabel(topic.decay_rate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Decay rate bar */}
            <div className="space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Decay rate</span>
                <span className={cn('text-xs font-mono font-bold tabular-nums', col.text)}>
                  −{Math.round(topic.decay_rate)}%
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${topic.decay_rate}%` }}
                  transition={{ duration: 0.6, delay: rank * 0.04 + 0.2, ease: 'easeOut' }}
                  className={cn('absolute inset-y-0 left-0 rounded-full', col.bar)}
                />
              </div>
            </div>

            {/* Meta row: votes + half-life + FOR% */}
            <div className="flex items-center gap-3 text-[10px] font-mono text-surface-600">
              <span className="flex items-center gap-1">
                <Activity className="h-2.5 w-2.5" />
                {topic.total_votes.toLocaleString()} total votes
              </span>
              {topic.half_life_estimate !== null && topic.half_life_estimate > 0 && topic.half_life_estimate < 180 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  ~{topic.half_life_estimate}d half-life
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                <span className="text-for-400">{Math.round(topic.blue_pct)}% FOR</span>
                <span className="text-against-400">{100 - Math.round(topic.blue_pct)}% AGAINST</span>
              </span>
            </div>
          </div>

          <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0 mt-1 group-hover:text-surface-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({
  breakdown,
  selectedCategory,
  onSelect,
}: {
  breakdown: CategoryDecay[]
  selectedCategory: string
  onSelect: (cat: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (breakdown.length === 0) return null

  const visible = expanded ? breakdown : breakdown.slice(0, 4)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-4">
        <BarChart2 className="h-3.5 w-3.5" />
        Decay by Category
      </div>
      <div className="space-y-2.5">
        {visible.map((cat) => {
          const catClass = CATEGORY_COLORS[cat.category]
          const isSelected = selectedCategory === cat.category
          return (
            <button
              key={cat.category}
              onClick={() => onSelect(isSelected ? 'All' : cat.category)}
              className={cn(
                'w-full flex items-center gap-3 text-left rounded-xl px-3 py-2.5 transition-colors',
                isSelected
                  ? 'bg-surface-200/80 border border-surface-400/40'
                  : 'hover:bg-surface-200/40 border border-transparent'
              )}
            >
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wide border w-24 text-center flex-shrink-0', catClass ?? 'bg-surface-200 text-surface-400 border-surface-400/30')}>
                {cat.category}
              </span>
              <div className="flex-1 min-w-0">
                <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-against-500/60"
                    style={{ width: `${cat.avg_decay_rate}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-[10px] font-mono">
                <span className="text-against-400">−{Math.round(cat.avg_decay_rate)}%</span>
                <span className="text-surface-600">{cat.topic_count} topic{cat.topic_count !== 1 ? 's' : ''}</span>
              </div>
            </button>
          )
        })}
      </div>
      {breakdown.length > 4 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-3 flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
        >
          {expanded ? 'Show less' : `Show ${breakdown.length - 4} more`}
          <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}

// ─── Stats Strip ──────────────────────────────────────────────────────────────

function StatsStrip({ stats }: { stats: DecayStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Decaying</p>
        <p className="text-2xl font-bold font-mono text-white tabular-nums">{stats.total_decaying}</p>
        <p className="text-[11px] text-surface-500 mt-0.5">open topics</p>
      </div>
      <div className="rounded-xl bg-surface-100 border border-against-500/20 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Dormant</p>
        <p className="text-2xl font-bold font-mono text-against-400 tabular-nums">{stats.dormant_count}</p>
        <p className="text-[11px] text-surface-500 mt-0.5">≥80% drop</p>
      </div>
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Avg Decay</p>
        <p className="text-2xl font-bold font-mono text-amber-400 tabular-nums">−{Math.round(stats.avg_decay_rate)}%</p>
        <p className="text-[11px] text-surface-500 mt-0.5">week-on-week</p>
      </div>
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
        <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Silent</p>
        <p className="text-2xl font-bold font-mono text-surface-500 tabular-nums">{stats.total_silent}</p>
        <p className="text-[11px] text-surface-500 mt-0.5">zero recent votes</p>
      </div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function DecaySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-2.5 w-16 mb-3" />
            <Skeleton className="h-8 w-14 mb-1.5" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 md:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-1.5">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tier Section ─────────────────────────────────────────────────────────────

function TierSection({
  title,
  description,
  icon: Icon,
  iconColor,
  topics,
  category,
}: {
  title: string
  description: string
  icon: typeof TrendingDown
  iconColor: string
  topics: DecayTopic[]
  category: string
}) {
  const filtered = category === 'All' ? topics : topics.filter((t) => t.category === category)
  if (filtered.length === 0) return null

  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0', iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold font-mono text-white">{title}</h2>
          <p className="text-xs text-surface-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map((topic, idx) => (
          <DecayCard key={topic.id} topic={topic} rank={idx} />
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DecayPage() {
  const [data, setData]       = useState<DecayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)
  const [category, setCategory] = useState('All')
  const [catOpen, setCatOpen]   = useState(false)
  const fetchedAt = useRef<number>(0)

  const load = useCallback(async (force = false) => {
    if (!force && Date.now() - fetchedAt.current < 5 * 60_000) return
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams()
      const res = await fetch(`/api/topics/decay?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch_fail')
      const json = (await res.json()) as DecayResponse
      setData(json)
      fetchedAt.current = Date.now()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalFiltered = data
    ? [
        ...(category === 'All' ? data.dormant : data.dormant.filter((t) => t.category === category)),
        ...(category === 'All' ? data.fading  : data.fading.filter((t) => t.category === category)),
        ...(category === 'All' ? data.cooling : data.cooling.filter((t) => t.category === category)),
      ].length
    : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/trending"
              className="flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-against-500/10 border border-against-500/30">
                <BatteryLow className="h-4.5 w-4.5 text-against-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-mono text-white leading-tight">
                  Civic Decay Index
                </h1>
                <p className="text-xs font-mono text-surface-500">
                  Open debates the platform forgot
                </p>
              </div>
            </div>
            <button
              onClick={() => load(true)}
              disabled={loading}
              aria-label="Refresh"
              className="ml-auto flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          <p className="text-sm text-surface-500 leading-relaxed">
            Topics that had real momentum last week but went quiet this week.
            Not resolved — just abandoned. Each debate below is still open
            and needs your vote.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category picker */}
          <div className="relative">
            <button
              onClick={() => setCatOpen((o) => !o)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors',
                category !== 'All'
                  ? 'bg-for-500/10 border-for-500/30 text-for-400'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              <Signal className="h-3 w-3" />
              {category === 'All' ? 'All Categories' : category}
              <ChevronDown className={cn('h-3 w-3 transition-transform', catOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {catOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute left-0 top-full mt-1 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                >
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setCatOpen(false) }}
                      className={cn(
                        'w-full text-left px-3.5 py-2 text-xs font-mono transition-colors',
                        category === cat
                          ? 'bg-for-500/15 text-for-400'
                          : 'text-surface-500 hover:bg-surface-200/60 hover:text-white'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {data && !loading && (
            <span className="text-[11px] font-mono text-surface-600">
              {totalFiltered} debate{totalFiltered !== 1 ? 's' : ''} decaying
            </span>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <DecaySkeleton />
        ) : error ? (
          <EmptyState
            icon={Activity}
            title="Signal lost"
            description="Could not fetch decay data. Try refreshing."
            action={{ label: 'Retry', onClick: () => load(true) }}
          />
        ) : !data || data.stats.total_decaying === 0 ? (
          <EmptyState
            icon={Zap}
            title="All debates are alive"
            description="No open topics showing significant activity decay right now. Check back tomorrow."
          />
        ) : (
          <div className="space-y-8">
            {/* Stats */}
            <StatsStrip stats={data.stats} />

            {/* Interpretation note */}
            <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex gap-3">
              <TrendingDown className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-surface-400 leading-relaxed">
                  Decay rate = (prior 7-day votes − recent 7-day votes) ÷ prior 7-day votes.
                  A rate of 80% means a debate that had 100 votes last week now has ≤20.
                  These debates are still open — one vote can reignite a conversation.
                </p>
                {data.stats.most_forgotten_category && (
                  <p className="text-xs font-mono text-surface-500 mt-1.5">
                    Most forgotten category this week:{' '}
                    <span className="text-white">{data.stats.most_forgotten_category}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Dormant tier */}
            <TierSection
              title="Dormant"
              description="80%+ drop in activity — all but forgotten. These debates are barely breathing."
              icon={VolumeX}
              iconColor="bg-against-500/10 border-against-500/30 text-against-400"
              topics={data.dormant}
              category={category}
            />

            {/* Fading tier */}
            <TierSection
              title="Fading"
              description="60–79% drop — significantly quieter than last week. The momentum is leaving."
              icon={TrendingDown}
              iconColor="bg-amber-500/10 border-amber-500/30 text-amber-400"
              topics={data.fading}
              category={category}
            />

            {/* Cooling tier */}
            <TierSection
              title="Cooling"
              description="40–59% drop — noticeable slowdown. These debates are at an inflection point."
              icon={Activity}
              iconColor="bg-for-500/10 border-for-500/30 text-for-400"
              topics={data.cooling}
              category={category}
            />

            {/* No results for selected category */}
            {totalFiltered === 0 && category !== 'All' && (
              <EmptyState
                icon={Signal}
                title={`No ${category} decay`}
                description={`No ${category} debates show significant activity decay right now.`}
                action={{ label: 'Clear filter', onClick: () => setCategory('All') }}
              />
            )}

            {/* Category breakdown */}
            {category === 'All' && data.category_breakdown.length > 0 && (
              <CategoryBreakdown
                breakdown={data.category_breakdown}
                selectedCategory={category}
                onSelect={setCategory}
              />
            )}

            {/* CTA */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <ThumbsUp className="h-4 w-4 text-for-400" />
                <span className="text-sm font-mono font-semibold text-white">Vote to revive a debate</span>
                <ThumbsDown className="h-4 w-4 text-against-400" />
              </div>
              <p className="text-xs text-surface-500">
                Every forgotten debate above is still open. Your vote today could restart a conversation that matters.
              </p>
              <Link
                href="/topics?sort=new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold transition-colors"
              >
                Browse Open Topics
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
