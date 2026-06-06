'use client'

/**
 * /stalemate — The Civic Stalemate
 *
 * Shows civic debates in perfect democratic deadlock — topics where FOR and
 * AGAINST forces are so evenly matched that neither side can advance.
 *
 * Stalemate Score = balance (60%) + argument symmetry (25%) + vote volume (15%)
 *   where balance    = 1 – |for_pct – 50| / 50   (1.0 at exact 50/50)
 *         symmetry   = min(for_args, against_args) / max(…)  (1.0 when equal)
 *         volume     = log10(votes) / 3  (caps at 1000 votes)
 *
 * "Breaking Force" = net FOR votes needed to shift the FOR% by +2 points.
 * The harder to break, the more entrenched the deadlock.
 *
 * Distinct from:
 *   /friction       — total accumulated engagement × time (endurance-weighted)
 *   /uncertainty    — closeness to 50/50 in votes AND arguments
 *   /polarization   — platform-wide division health
 *   /equilibrium    — stable consensus (can be 80% FOR and stable)
 *   /tipping-point  — topics nearest the law/fail threshold
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Lock,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Timer,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  StalemateResponse,
  StaletateTopic,
  CategoryStalemate,
  StalemateStrength,
} from '@/app/api/stalemate/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 15 * 60 * 1000

const CAT_ICON: Record<string, typeof Landmark> = {
  Economics:   TrendingUp,
  Politics:    Landmark,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
  Culture:     Music2,
  Philosophy:  Scale,
}

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
  Culture:     'text-gold',
  Philosophy:  'text-sky-400',
}

// ─── Strength config ──────────────────────────────────────────────────────────

const STRENGTH_CONFIG: Record<
  StalemateStrength,
  { label: string; color: string; bg: string; border: string; description: string }
> = {
  perfect: {
    label: 'Perfect Deadlock',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    description: 'Exact 50/50 with equal arguments — total impasse',
  },
  locked: {
    label: 'Locked',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/40',
    description: 'Near-equal split, strongly defended on both sides',
  },
  contested: {
    label: 'Contested',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    description: 'Active deadlock — one side holds a narrow edge',
  },
  leaning: {
    label: 'Leaning',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-500/30',
    description: 'Some imbalance — not a true stalemate',
  },
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'score' | 'margin' | 'votes' | 'breaking_force' | 'symmetry'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',         label: 'Stalemate Score' },
  { key: 'margin',        label: 'Closest to 50/50' },
  { key: 'votes',         label: 'Most Votes' },
  { key: 'breaking_force', label: 'Hardest to Break' },
  { key: 'symmetry',      label: 'Argument Symmetry' },
]

// ─── Tug-of-war bar ───────────────────────────────────────────────────────────

function TugBar({
  forPct,
  className,
}: {
  forPct: number
  className?: string
}) {
  const margin = Math.abs(forPct - 50)
  const tensionColor =
    margin < 2 ? 'bg-against-500'
    : margin < 5 ? 'bg-orange-500'
    : margin < 10 ? 'bg-gold'
    : 'bg-surface-500'

  return (
    <div className={cn('relative h-2 rounded-full overflow-hidden', className)}>
      {/* Red (AGAINST) background */}
      <div className="absolute inset-0 bg-against-500/30" />
      {/* Blue (FOR) fill */}
      <motion.div
        initial={{ width: '50%' }}
        animate={{ width: `${forPct}%` }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className="absolute left-0 top-0 h-full bg-for-500/70"
      />
      {/* Centre marker */}
      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-px h-full bg-surface-900/80" />
      {/* Tension indicator at actual split point */}
      <motion.div
        initial={{ left: '50%' }}
        animate={{ left: `${forPct}%` }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        className={cn('absolute top-0 w-1 h-full -translate-x-1/2 rounded-full', tensionColor)}
      />
    </div>
  )
}

// ─── Score dial ───────────────────────────────────────────────────────────────

function ScoreDial({ score }: { score: number }) {
  const color =
    score >= 70 ? 'text-against-300'
    : score >= 50 ? 'text-orange-400'
    : score >= 30 ? 'text-gold'
    : 'text-surface-500'

  return (
    <div className="flex flex-col items-center justify-center">
      <span className={cn('text-lg font-bold tabular-nums leading-none', color)}>
        {score}
      </span>
      <span className="text-[9px] text-surface-500 uppercase tracking-wide mt-0.5">score</span>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function StalemateCard({
  topic,
  rank,
  compact = false,
}: {
  topic: StaletateTopic
  rank?: number
  compact?: boolean
}) {
  const cfg = STRENGTH_CONFIG[topic.strength]
  const CatIcon = topic.category ? (CAT_ICON[topic.category] ?? Activity) : Activity
  const catColor = topic.category ? (CAT_COLOR[topic.category] ?? 'text-surface-400') : 'text-surface-400'

  const forPct  = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const totalArgs = topic.for_args + topic.against_args

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex items-start gap-3 rounded-xl border transition-all',
        'bg-surface-200/40 hover:bg-surface-200/70',
        cfg.border,
        compact ? 'p-3' : 'p-4',
        'hover:shadow-lg',
      )}
    >
      {rank !== undefined && (
        <span className="shrink-0 w-6 text-center text-[11px] font-mono text-surface-500 mt-1">
          {rank}
        </span>
      )}

      {/* Score dial */}
      <div className={cn(
        'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
        cfg.bg,
        cfg.border,
        'border',
      )}>
        <ScoreDial score={topic.stalemate_score} />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Title row */}
        <div className="flex items-start gap-1.5">
          <CatIcon className={cn('shrink-0 mt-0.5 w-3 h-3', catColor)} />
          <p className={cn(
            'font-medium text-surface-100 leading-snug group-hover:text-white transition-colors line-clamp-2',
            compact ? 'text-xs' : 'text-xs sm:text-[13px]',
          )}>
            {topic.statement}
          </p>
        </div>

        {/* Tug-of-war bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">{forPct}% FOR</span>
            <span className={cn('font-semibold', cfg.color)}>
              {topic.margin.toFixed(1)}pt gap
            </span>
            <span className="text-against-400">{againstPct}% AGAINST</span>
          </div>
          <TugBar forPct={forPct} />
        </div>

        {/* Strength badge + metrics */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
            cfg.bg, cfg.color,
          )}>
            <Lock className="w-2.5 h-2.5" />
            {cfg.label}
          </span>

          {/* Argument symmetry */}
          {totalArgs > 0 && (
            <span className="text-[10px] text-surface-500 flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" />
              {topic.for_args}↑ {topic.against_args}↓
              <span className={cn(
                'ml-0.5',
                topic.arg_symmetry >= 0.8 ? 'text-against-400' : 'text-surface-500',
              )}>
                ({Math.round(topic.arg_symmetry * 100)}% sym)
              </span>
            </span>
          )}

          {/* Votes */}
          <span className="text-[10px] text-surface-500 flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            {topic.total_votes.toLocaleString()}
          </span>
        </div>

        {/* Breaking force */}
        {!compact && (
          <div className="flex items-center gap-3 text-[10px] text-surface-500">
            <span className="flex items-center gap-1">
              <ThumbsUp className="w-2.5 h-2.5 text-for-400" />
              <span>+{topic.breaking_force} FOR to shift</span>
            </span>
            <span className="flex items-center gap-1">
              <ThumbsDown className="w-2.5 h-2.5 text-against-400" />
              <span>+{topic.breaking_force_against} AGAINST to shift</span>
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryStalemate }) {
  const CatIcon = CAT_ICON[cat.category] ?? Activity
  const catColor = CAT_COLOR[cat.category] ?? 'text-surface-400'
  const intensity =
    cat.avg_stalemate_score >= 60 ? 'text-against-300'
    : cat.avg_stalemate_score >= 40 ? 'text-orange-400'
    : cat.avg_stalemate_score >= 20 ? 'text-gold'
    : 'text-surface-500'

  return (
    <div className="rounded-xl border border-surface-600/40 bg-surface-200/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CatIcon className={cn('w-3.5 h-3.5', catColor)} />
        <span className="text-xs font-medium text-surface-200">{cat.category}</span>
        <span className={cn('ml-auto text-sm font-bold tabular-nums', intensity)}>
          {cat.avg_stalemate_score}
        </span>
      </div>

      {/* Avg margin bar */}
      <div className="space-y-1">
        <div className="h-1 rounded-full bg-surface-600/40 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${100 - cat.avg_margin * 2}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              cat.avg_stalemate_score >= 60 ? 'bg-against-500'
              : cat.avg_stalemate_score >= 40 ? 'bg-orange-500'
              : cat.avg_stalemate_score >= 20 ? 'bg-gold'
              : 'bg-surface-500',
            )}
          />
        </div>
        <div className="flex justify-between text-[10px] text-surface-500">
          <span>{cat.topic_count} topics</span>
          {cat.perfect_count > 0 && (
            <span className="text-against-400">{cat.perfect_count} perfect</span>
          )}
          <span>avg {cat.avg_margin.toFixed(1)}pt gap</span>
        </div>
      </div>

      {cat.most_deadlocked && (
        <p className="text-[10px] text-surface-500 line-clamp-1 italic">
          &ldquo;{cat.most_deadlocked}&rdquo;
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StalemateClient() {
  const [data, setData] = useState<StalemateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [showCategories, setShowCategories] = useState(false)
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/stalemate', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json: StalemateResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    timerRef.current = setInterval(fetchData, REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  // Sort topics
  const sortedTopics = (data?.topics ?? [])
    .filter((t) => !activeCategory || t.category === activeCategory)
    .slice()
    .sort((a, b) => {
      if (sortKey === 'score')          return b.stalemate_score - a.stalemate_score
      if (sortKey === 'margin')         return a.margin - b.margin
      if (sortKey === 'votes')          return b.total_votes - a.total_votes
      if (sortKey === 'breaking_force') return b.breaking_force - a.breaking_force
      if (sortKey === 'symmetry')       return b.arg_symmetry - a.arg_symmetry
      return 0
    })

  const stats = data?.stats
  const categories = data?.categories ?? []

  // Platform deadlock level
  const deadlockLevel =
    (stats?.avg_stalemate_score ?? 0) >= 60 ? { label: 'Total Gridlock',   color: 'text-against-300' }
    : (stats?.avg_stalemate_score ?? 0) >= 45 ? { label: 'Deep Deadlock',    color: 'text-orange-400' }
    : (stats?.avg_stalemate_score ?? 0) >= 30 ? { label: 'Contested',         color: 'text-gold' }
    : (stats?.avg_stalemate_score ?? 0) >= 15 ? { label: 'Some Tension',      color: 'text-for-400' }
    : { label: 'Mostly Resolved',  color: 'text-emerald' }

  return (
    <div className="min-h-screen bg-surface-900 pb-24">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-8 space-y-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-2 text-surface-500 text-xs mb-3">
            <Link href="/discover" className="hover:text-surface-300 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Discover
            </Link>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-against-500/15 border border-against-500/30 flex items-center justify-center">
                <Swords className="w-4 h-4 text-against-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  The Civic Stalemate
                </h1>
                <p className="text-[11px] text-surface-500">
                  Democratic deadlock — neither side can advance
                </p>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="shrink-0 p-2 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-700/50 transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>

          <p className="text-xs text-surface-500 leading-relaxed pt-1">
            Ranked by the{' '}
            <span className="text-surface-300 font-medium">Stalemate Score</span>
            {' '}— a composite of vote balance (60%), argument symmetry (25%), and engagement (15%).
            <span className="text-surface-600"> A score of 100 means perfect 50/50 with equally-matched arguments and high participation.</span>
          </p>
        </motion.div>

        {/* ── Stats bar ── */}
        {!loading && stats && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <StatCard
              label="Platform Level"
              value={deadlockLevel.label}
              valueClass={deadlockLevel.color}
              sub="avg stalemate score"
              icon={<BarChart2 className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Perfect Deadlocks"
              value={<AnimatedNumber value={stats.perfect_deadlock_count} />}
              valueClass="text-against-300"
              sub="topics at exact 50/50"
              icon={<Scale className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Most Deadlocked"
              value={stats.most_deadlocked_category ?? '—'}
              valueClass="text-orange-400"
              sub="category"
              icon={<Shield className="w-3.5 h-3.5" />}
            />
            <StatCard
              label="Avg Breaking Force"
              value={<><AnimatedNumber value={stats.hardest_to_break_force} /> votes</>}
              valueClass="text-gold"
              sub="to shift the hardest topic"
              icon={<Zap className="w-3.5 h-3.5" />}
            />
          </motion.div>
        )}

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort pills */}
          <div className="flex gap-1.5 flex-wrap">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortKey(opt.key)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                  sortKey === opt.key
                    ? 'bg-against-500/20 text-against-300 border border-against-500/40'
                    : 'bg-surface-700/40 text-surface-400 border border-surface-600/30 hover:text-surface-200',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Category filter toggle */}
          <button
            onClick={() => setShowCategories(!showCategories)}
            className={cn(
              'ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] transition-colors border',
              showCategories
                ? 'bg-surface-600/40 text-surface-200 border-surface-500/50'
                : 'bg-surface-700/30 text-surface-500 border-surface-600/30 hover:text-surface-300',
            )}
          >
            <Activity className="w-3 h-3" />
            By Category
            {showCategories ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* ── Category grid ── */}
        <AnimatePresence>
          {showCategories && !loading && categories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() =>
                      setActiveCategory(activeCategory === cat.category ? null : cat.category)
                    }
                    className={cn(
                      'text-left transition-all rounded-xl',
                      activeCategory === cat.category
                        ? 'ring-2 ring-against-500/60 ring-offset-1 ring-offset-surface-900'
                        : '',
                    )}
                  >
                    <CategoryCard cat={cat} />
                  </button>
                ))}
              </div>
              {activeCategory && (
                <button
                  onClick={() => setActiveCategory(null)}
                  className="text-[11px] text-surface-500 hover:text-surface-300 transition-colors mt-2 ml-1"
                >
                  × Clear filter
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Hardest-to-break callout ── */}
        {!loading && stats?.hardest_to_break && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4"
          >
            <div className="flex items-start gap-3">
              <Lock className="shrink-0 w-4 h-4 text-orange-400 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] text-orange-400 font-medium uppercase tracking-wide mb-1">
                  Hardest Deadlock to Break
                </p>
                <p className="text-sm text-surface-200 leading-snug line-clamp-2">
                  {stats.hardest_to_break}
                </p>
                <p className="text-[11px] text-surface-500 mt-1.5">
                  Requires <span className="text-orange-400 font-medium">{stats.hardest_to_break_force.toLocaleString()} net FOR votes</span> to shift by just 2 points
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Topic list ── */}
        <div className="space-y-2">
          {loading ? (
            [...Array(8)].map((_, i) => (
              <div key={i} className="h-28 bg-surface-700/30 rounded-xl animate-pulse" />
            ))
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-surface-500 text-sm">Failed to load stalemate data.</p>
              <button
                onClick={fetchData}
                className="mt-3 text-xs text-surface-400 hover:text-surface-200 underline"
              >
                Retry
              </button>
            </div>
          ) : sortedTopics.length === 0 ? (
            <EmptyState
              icon={Swords}
              title="No deadlocked debates found"
              description={
                activeCategory
                  ? `No stalemates in ${activeCategory} yet.`
                  : 'No topics are in deadlock right now — the community is making progress!'
              }
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {sortedTopics.map((topic, idx) => (
                <motion.div
                  key={topic.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                  onClick={() =>
                    setExpandedTopicId(expandedTopicId === topic.id ? null : topic.id)
                  }
                >
                  <StalemateCard
                    topic={topic}
                    rank={sortKey === 'score' ? idx + 1 : undefined}
                    compact={expandedTopicId !== null && expandedTopicId !== topic.id}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* ── Footer context ── */}
        {!loading && sortedTopics.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-surface-600/30 bg-surface-800/30 p-4 space-y-2"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-surface-500" />
              <span className="text-[11px] text-surface-500 uppercase tracking-wide font-medium">
                How to read this
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-surface-500">
              <div className="flex items-start gap-2">
                <Scale className="w-3 h-3 text-against-400 mt-0.5 shrink-0" />
                <span>
                  <span className="text-against-300">Perfect Deadlock</span> — vote split ≥95% balanced,
                  arguments equally matched. True impasse.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Zap className="w-3 h-3 text-gold mt-0.5 shrink-0" />
                <span>
                  <span className="text-gold">Breaking Force</span> — net votes one side needs to gain a
                  2-point lead. Higher = more entrenched.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MessageSquare className="w-3 h-3 text-purple mt-0.5 shrink-0" />
                <span>
                  <span className="text-purple">Argument Symmetry</span> — how evenly the FOR/AGAINST
                  arguments are matched. 100% = equal on both sides.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="w-3 h-3 text-emerald mt-0.5 shrink-0" />
                <span>
                  These are not failures — some civic questions are
                  genuinely hard. The stalemate is where democracy is most tested.
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-surface-600/20 flex flex-wrap gap-3 text-[10px] text-surface-600">
              <Link href="/friction" className="hover:text-surface-400 transition-colors flex items-center gap-1">
                <Timer className="w-2.5 h-2.5" /> Friction Index
              </Link>
              <Link href="/uncertainty" className="hover:text-surface-400 transition-colors flex items-center gap-1">
                <Activity className="w-2.5 h-2.5" /> Uncertainty Index
              </Link>
              <Link href="/polarization" className="hover:text-surface-400 transition-colors flex items-center gap-1">
                <BarChart2 className="w-2.5 h-2.5" /> Polarization
              </Link>
              <Link href="/equilibrium" className="hover:text-surface-400 transition-colors flex items-center gap-1">
                <Scale className="w-2.5 h-2.5" /> Equilibrium
              </Link>
              <Link href="/tipping-point" className="hover:text-surface-400 transition-colors flex items-center gap-1">
                <TrendingUp className="w-2.5 h-2.5" /> Tipping Point
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueClass,
  sub,
  icon,
}: {
  label: string
  value: React.ReactNode
  valueClass?: string
  sub?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-surface-600/40 bg-surface-800/50 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] text-surface-500 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className={cn('text-sm font-bold leading-tight', valueClass)}>
        {value}
      </div>
      {sub && <p className="text-[10px] text-surface-600">{sub}</p>}
    </div>
  )
}
