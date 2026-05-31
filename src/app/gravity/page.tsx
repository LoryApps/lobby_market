'use client'

/**
 * /gravity — The Civic Gravity Index
 *
 * Measures the "intellectual magnetism" of each topic — how much argument,
 * discussion, and engagement it attracts relative to its vote count.
 *
 * A topic with high gravity is an argument black hole: people vote, then stay
 * to argue, reply, and debate. A topic with low gravity is a silent consensus:
 * people vote and leave, with little discussion.
 *
 * Gravity score = f(arguments per vote, replies per argument, view-to-vote ratio)
 *
 * Tiers:
 *   Singularity (≥80) — extreme argument density, true intellectual black holes
 *   Supergiant  (≥60) — high gravity, powerful debate ecosystems
 *   Star        (≥40) — healthy gravity, normal debate activity
 *   Dwarf       (≥20) — low gravity, mostly votes with sparse discussion
 *   Void        (<20) — near-zero gravity, silent or neglected topics
 *
 * Distinct from:
 *   /equilibrium — measures how settled the consensus is
 *   /volatility  — measures how fast vote splits are changing
 *   /depth       — measures argument quality and elaboration
 *   /momentum    — measures direction and speed of vote change
 *   /vortex      — argument intensity per voter (close but gravity uses more dims)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  BookOpen,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GravityTopic, GravityTier, CategoryGravity, GravityStats, GravityResponse } from '@/app/api/gravity/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_ICON: Record<string, typeof Scale> = {
  Politics:    Landmark,
  Economics:   TrendingUp,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300',   bg: 'bg-against-500/10',   border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<GravityTier, {
  label: string
  desc: string
  color: string
  bg: string
  border: string
  glow: string
  icon: string
  bar: string
}> = {
  singularity: {
    label: 'Singularity',
    desc: 'Extreme argument density',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
    icon: '⬛',
    bar: 'bg-against-500',
  },
  supergiant: {
    label: 'Supergiant',
    desc: 'High intellectual pull',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    glow: 'shadow-[0_0_16px_rgba(245,158,11,0.12)]',
    icon: '⬛',
    bar: 'bg-gold',
  },
  star: {
    label: 'Star',
    desc: 'Healthy debate ecosystem',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: '',
    icon: '⬛',
    bar: 'bg-for-500',
  },
  dwarf: {
    label: 'Dwarf',
    desc: 'Mostly votes, few arguments',
    color: 'text-surface-500',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/30',
    glow: '',
    icon: '⬛',
    bar: 'bg-surface-500',
  },
  void: {
    label: 'Void',
    desc: 'Silent — minimal engagement',
    color: 'text-surface-600',
    bg: 'bg-surface-200/30',
    border: 'border-surface-500/20',
    glow: '',
    icon: '⬛',
    bar: 'bg-surface-600',
  },
}

// ─── Gravity orbit ring ───────────────────────────────────────────────────────

function GravityRing({ score, tier }: { score: number; tier: GravityTier }) {
  const config = TIER_CONFIG[tier]
  const r = 22
  const circumference = 2 * Math.PI * r
  const filled = (score / 100) * circumference

  const strokeColors: Record<GravityTier, string> = {
    singularity: '#ef4444',
    supergiant: '#f59e0b',
    star: '#3b82f6',
    dwarf: '#6b7280',
    void: '#374151',
  }

  return (
    <div
      className={cn('relative flex items-center justify-center flex-shrink-0', config.glow)}
      style={{ width: 56, height: 56 }}
    >
      <svg width="56" height="56" className="-rotate-90" aria-hidden="true">
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke="#1e2030"
          strokeWidth="3.5"
        />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke={strokeColors[tier]}
          strokeWidth="3.5"
          strokeDasharray={`${filled} ${circumference - filled}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-[11px] font-mono font-bold', config.color)}>
          {score}
        </span>
      </div>
    </div>
  )
}

// ─── Gravity bar chart ────────────────────────────────────────────────────────

function GravityBar({
  label,
  value,
  max,
  colorClass,
}: {
  label: string
  value: number
  max: number
  colorClass: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-surface-500">{label}</span>
        <span className="text-surface-600">{Math.round(value * 100)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicGravityRow({ topic, rank }: { topic: GravityTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const config = TIER_CONFIG[topic.tier]
  const catColor = CAT_COLOR[topic.category ?? '']

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.025, 0.3) }}
      className={cn(
        'rounded-2xl border transition-all duration-200',
        config.border,
        config.bg,
        config.glow,
        'hover:border-opacity-60'
      )}
    >
      {/* Main row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 p-3 text-left"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <span className="text-xs font-mono text-surface-600 w-6 flex-shrink-0 text-right">
          {rank}
        </span>

        {/* Gravity ring */}
        <GravityRing score={topic.gravity_score} tier={topic.tier} />

        {/* Statement + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {topic.category && catColor && (
              <span className={cn('text-[10px] font-mono font-semibold', catColor.text)}>
                {topic.category}
              </span>
            )}
            <span className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md border',
              config.color, config.bg, config.border
            )}>
              {config.label}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {topic.arg_count} arg{topic.arg_count !== 1 ? 's' : ''}
              {topic.reply_count > 0 && ` · ${topic.reply_count} replies`}
              {' '}· {topic.total_votes.toLocaleString()} votes
            </span>
          </div>
        </div>

        {/* Vote split */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3 text-for-400" />
            <span className="text-xs font-mono font-semibold text-for-400">
              {Math.round(topic.blue_pct)}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThumbsDown className="h-3 w-3 text-against-400" />
            <span className="text-xs font-mono font-semibold text-against-400">
              {Math.round(100 - topic.blue_pct)}%
            </span>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-4 border-t border-surface-300/30">
              {/* Gravity breakdown */}
              <div className="space-y-2">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                  Gravity Breakdown
                </p>
                <GravityBar
                  label="Discourse Density"
                  value={topic.discourse_density}
                  max={1}
                  colorClass="bg-against-500"
                />
                <GravityBar
                  label="View Pull"
                  value={topic.view_pull}
                  max={1}
                  colorClass="bg-gold"
                />
                <GravityBar
                  label="Thread Depth"
                  value={topic.depth_weight}
                  max={1}
                  colorClass="bg-purple"
                />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Arguments', value: topic.arg_count.toLocaleString(), color: 'text-for-400' },
                  { label: 'Replies', value: topic.reply_count.toLocaleString(), color: 'text-purple' },
                  { label: 'Views', value: topic.view_count.toLocaleString(), color: 'text-gold' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl bg-surface-200/40 border border-surface-300/30 p-2 text-center">
                    <p className={cn('text-sm font-mono font-bold', color)}>{value}</p>
                    <p className="text-[10px] font-mono text-surface-600 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Description */}
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                {config.desc}. This topic attracts{' '}
                <span className="text-white font-semibold">
                  {topic.total_votes > 0
                    ? ((topic.arg_count / topic.total_votes) * 100).toFixed(1)
                    : '0.0'}% argument density
                </span>{' '}
                — {topic.arg_count} argument{topic.arg_count !== 1 ? 's' : ''} across{' '}
                {topic.total_votes.toLocaleString()} votes.
              </p>

              {/* Link */}
              <Link
                href={`/topic/${topic.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View topic <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Stats panel ──────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: GravityStats }) {
  const statItems = [
    { label: 'Platform Gravity', value: stats.platform_score, suffix: '/100', color: 'text-for-400' },
    { label: 'Total Topics', value: stats.total_topics.toLocaleString(), suffix: '', color: 'text-white' },
    { label: 'Singularities', value: stats.singularity_count.toLocaleString(), suffix: '', color: 'text-against-400' },
    { label: 'Supergiants', value: stats.supergiant_count.toLocaleString(), suffix: '', color: 'text-gold' },
    { label: 'Total Arguments', value: stats.total_arguments.toLocaleString(), suffix: '', color: 'text-purple' },
    { label: 'Total Replies', value: stats.total_replies.toLocaleString(), suffix: '', color: 'text-emerald' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {statItems.map(({ label, value, suffix, color }) => (
        <div key={label} className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
          <p className={cn('text-xl font-mono font-bold', color)}>{value}{suffix}</p>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Category cards ───────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryGravity }) {
  const Icon = CAT_ICON[cat.category] ?? Scale
  const color = CAT_COLOR[cat.category] ?? { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-400' }

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2',
      color.bg, color.border
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-3.5 w-3.5', color.text)} />
          <span className={cn('text-xs font-mono font-bold', color.text)}>
            {cat.category}
          </span>
        </div>
        <span className="text-xs font-mono font-bold text-white">
          {cat.avg_score}<span className="text-surface-500">/100</span>
        </span>
      </div>

      {/* Score bar */}
      <div className="h-1 rounded-full bg-surface-300/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full', color.text.replace('text-', 'bg-'))}
          style={{ width: `${cat.avg_score}%`, opacity: 0.7 }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
        <span>{cat.topic_count} topics</span>
        {cat.singularity_count > 0 && (
          <span className="text-against-400">{cat.singularity_count} singularit{cat.singularity_count === 1 ? 'y' : 'ies'}</span>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function GravitySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-surface-200/40 border border-surface-300/20">
          <Skeleton className="h-4 w-5" />
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-10" />
        </div>
      ))}
    </div>
  )
}

// ─── Sort options ──────────────────────────────────────────────────────────────

type SortOption = 'gravity' | 'density' | 'depth' | 'pull'

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'gravity', label: 'Gravity' },
  { id: 'density', label: 'Discourse' },
  { id: 'depth', label: 'Depth' },
  { id: 'pull', label: 'Views' },
]

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Tier legend ──────────────────────────────────────────────────────────────

function TierLegend() {
  const tiers: GravityTier[] = ['singularity', 'supergiant', 'star', 'dwarf', 'void']
  return (
    <div className="flex flex-wrap gap-2">
      {tiers.map((tier) => {
        const config = TIER_CONFIG[tier]
        return (
          <div
            key={tier}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono',
              config.color, config.bg, config.border
            )}
          >
            <div className={cn('w-2 h-2 rounded-full', config.bar)} />
            {config.label}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GravityPage() {
  const [data, setData] = useState<GravityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('gravity')
  const [category, setCategory] = useState<string>('All')
  const [showInfo, setShowInfo] = useState(false)
  const [tab, setTab] = useState<'topics' | 'categories'>('topics')
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (refresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ sort })
      if (category !== 'All') params.set('category', category)

      const res = await fetch(`/api/gravity?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setError('Failed to load gravity data.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sort, category])

  useEffect(() => { load() }, [load])

  const topics = data?.topics ?? []
  const categories = data?.categories ?? []
  const stats = data?.stats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/" className="text-xs font-mono text-surface-500 hover:text-surface-700 transition-colors">
                ← Home
              </Link>
            </div>
            <h1 className="font-mono text-2xl font-bold text-white">
              Civic Gravity Index
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              Which debates are argument black holes?
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowInfo((s) => !s)}
              className="p-2 rounded-lg text-surface-600 hover:text-surface-400 hover:bg-surface-200/50 transition-colors"
              aria-label="What is this?"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-surface-600 hover:text-surface-400 hover:bg-surface-200/50 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4 space-y-3">
                <p className="text-sm font-mono text-surface-700 leading-relaxed">
                  <span className="text-white font-semibold">Gravity</span> measures intellectual magnetism — how many arguments and discussions a topic generates relative to its vote count.
                </p>
                <div className="space-y-2 text-xs font-mono text-surface-500">
                  <p>
                    <span className="text-against-300 font-semibold">Singularity</span> — extreme argument density. People can&apos;t stop debating this.
                  </p>
                  <p>
                    <span className="text-gold font-semibold">Supergiant</span> — strong intellectual pull. Rich discussion ecosystem.
                  </p>
                  <p>
                    <span className="text-for-300 font-semibold">Star</span> — healthy debate activity. Normal civic engagement.
                  </p>
                  <p>
                    <span className="text-surface-500 font-semibold">Dwarf</span> — mostly votes, sparse discussion.
                  </p>
                  <p>
                    <span className="text-surface-600 font-semibold">Void</span> — near-silent. Minimal engagement beyond voting.
                  </p>
                </div>
                <p className="text-[10px] font-mono text-surface-600">
                  Formula: gravity = f(args/vote, replies/arg, views/vote) · weighted composite
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Platform stats */}
        {stats && !loading && (
          <StatsPanel stats={stats} />
        )}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}

        {/* Tier legend */}
        <TierLegend />

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-surface-200/60 rounded-xl border border-surface-300/60 w-fit">
          {(['topics', 'categories'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all capitalize',
                tab === t
                  ? 'bg-surface-300 text-white shadow-sm'
                  : 'text-surface-500 hover:text-white'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'topics' && (
          <>
            {/* Sort + Filter controls */}
            <div className="flex flex-wrap gap-2">
              {/* Sort */}
              <div className="flex items-center gap-1 bg-surface-200/60 rounded-xl border border-surface-300/40 p-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSort(opt.id)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all',
                      sort === opt.id
                        ? 'bg-for-600/80 text-white border border-for-600/50'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Category filter */}
              <div className="flex items-center gap-1 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all border',
                      category === cat
                        ? 'bg-surface-300 text-white border-surface-400'
                        : 'text-surface-500 border-surface-400/30 hover:text-white hover:border-surface-400/60'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic list */}
            {loading ? (
              <GravitySkeleton />
            ) : error ? (
              <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
                <AlertCircle className="h-8 w-8 text-against-400 mx-auto mb-2" />
                <p className="text-sm font-mono text-surface-500">{error}</p>
                <button onClick={() => load()} className="mt-3 text-xs font-mono text-for-400 hover:text-for-300 transition-colors">
                  Try again
                </button>
              </div>
            ) : topics.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No topics yet"
                description="Topics need at least 3 votes to appear in the Gravity Index."
              />
            ) : (
              <div className="space-y-2">
                {topics.slice(0, 100).map((topic, i) => (
                  <TopicGravityRow key={topic.id} topic={topic} rank={i + 1} />
                ))}

                {topics.length > 100 && (
                  <p className="text-center text-xs font-mono text-surface-600 py-4">
                    Showing top 100 of {topics.length} topics
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'categories' && (
          <>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <EmptyState
                icon={BarChart2}
                title="No category data"
                description="Categories will appear as more topics are voted on."
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <CategoryCard key={cat.category} cat={cat} />
                  ))}
                </div>

                {stats?.heaviest_category && (
                  <div className="rounded-2xl bg-surface-200/40 border border-surface-300/40 p-4 space-y-3">
                    <p className="text-xs font-mono text-surface-500 uppercase tracking-widest">Category Insights</p>
                    <div className="space-y-2 text-sm font-mono">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                        <span className="text-surface-500">Heaviest:</span>
                        <span className="text-white font-semibold">{stats.heaviest_category}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
                        <span className="text-surface-500">Lightest:</span>
                        <span className="text-white font-semibold">{stats.lightest_category}</span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Generated at */}
        {data?.generatedAt && !loading && (
          <p className="text-center text-[10px] font-mono text-surface-700">
            Computed at {new Date(data.generatedAt).toLocaleTimeString()} · refreshes every 10 min
          </p>
        )}

        {/* Related pages */}
        <div className="rounded-2xl bg-surface-200/40 border border-surface-300/30 p-4">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-3">Related Insights</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: 'Equilibrium', href: '/equilibrium', desc: 'Settled vs. contested' },
              { label: 'Volatility', href: '/volatility', desc: 'Vote change rate' },
              { label: 'The Vortex', href: '/vortex', desc: 'Argument intensity' },
              { label: 'Depth Index', href: '/depth', desc: 'Argument quality' },
              { label: 'Correlations', href: '/correlations', desc: 'Topic alignment' },
              { label: 'Momentum', href: '/momentum', desc: 'Directional force' },
            ].map(({ label, href, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors group"
              >
                <ArrowRight className="h-3 w-3 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0" />
                <span>
                  <span className="block text-white group-hover:text-for-300 font-semibold transition-colors">{label}</span>
                  <span className="text-[10px]">{desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
