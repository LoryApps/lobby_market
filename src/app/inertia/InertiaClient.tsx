'use client'

/**
 * /inertia — Civic Inertia Index
 *
 * Finds the debates that absorbed the most argument and engagement without
 * moving from their consensus position. High inertia = strong consensus +
 * high engagement. These are the "bedrock" beliefs of the platform — the
 * topics where no amount of argument could shift the community's verdict.
 *
 * Distinct from:
 *   /equilibrium — snapshot of current stability (any volume)
 *   /volatility  — rate of consensus change over time
 *   /gravity     — argument density relative to vote count
 *   /pressure    — topics near a flip point
 *   /momentum    — direction and speed of vote change
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  ChevronDown,
  Cpu,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Leaf,
  MessageSquare,
  Mountain,
  Music2,
  RefreshCw,
  Scale,
  Shield,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  InertiaTopic,
  InertiaTier,
  CategoryInertia,
  InertiaStats,
  InertiaResponse,
} from '@/app/api/inertia/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  InertiaTier,
  { label: string; desc: string; color: string; bg: string; border: string; bar: string; icon: string }
> = {
  bedrock: {
    label: 'Bedrock',
    desc: 'Immovable. Maximum consensus + maximum engagement.',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    bar: 'bg-gold',
    icon: '⛰',
  },
  granite: {
    label: 'Granite',
    desc: 'Very high inertia. Well-established and hard to shift.',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-400',
    icon: '🪨',
  },
  stone: {
    label: 'Stone',
    desc: 'Moderate inertia. Stable, but arguments can dent it.',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    bar: 'bg-purple',
    icon: '🪵',
  },
  clay: {
    label: 'Clay',
    desc: 'Some inertia. Consensus exists but can be reshaped.',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-400',
    icon: '🧱',
  },
  sand: {
    label: 'Sand',
    desc: 'Low inertia. Still forming, genuinely contested.',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    bar: 'bg-surface-500',
    icon: '🌊',
  },
}

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
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',       border: 'border-gold/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',     border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300',  bg: 'bg-against-500/10',border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',      bg: 'bg-for-400/10',    border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',         bg: 'bg-gold/10',       border: 'border-gold/30' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Education:   { text: 'text-purple',       bg: 'bg-purple/10',     border: 'border-purple/30' },
}
const defaultCat = { text: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-300/40' }

// ─── Tier Legend ─────────────────────────────────────────────────────────────

function TierLegend() {
  const tiers: InertiaTier[] = ['bedrock', 'granite', 'stone', 'clay', 'sand']
  return (
    <div className="flex flex-wrap gap-2">
      {tiers.map((tier) => {
        const cfg = TIER_CONFIG[tier]
        return (
          <div
            key={tier}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono',
              cfg.color, cfg.bg, cfg.border,
            )}
          >
            <div className={cn('w-2 h-2 rounded-full', cfg.bar)} />
            {cfg.label}
          </div>
        )
      })}
    </div>
  )
}

// ─── Stats panel ─────────────────────────────────────────────────────────────

function StatsPanel({ stats }: { stats: InertiaStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-3 text-center">
        <p className="text-lg font-mono font-bold text-gold">{stats.platform_score}</p>
        <p className="text-[10px] font-mono text-surface-600 mt-0.5">platform inertia</p>
      </div>
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-3 text-center">
        <p className="text-lg font-mono font-bold text-white">{stats.total_topics}</p>
        <p className="text-[10px] font-mono text-surface-600 mt-0.5">topics scored</p>
      </div>
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-3 text-center">
        <p className="text-lg font-mono font-bold text-gold">{stats.bedrock_count}</p>
        <p className="text-[10px] font-mono text-surface-600 mt-0.5">bedrock topics</p>
      </div>
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-3 text-center">
        <p className="text-lg font-mono font-bold text-for-300">{stats.avg_consensus_gap.toFixed(1)} pp</p>
        <p className="text-[10px] font-mono text-surface-600 mt-0.5">avg consensus gap</p>
      </div>
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-3 text-center">
        <p className="text-lg font-mono font-bold text-purple">{stats.avg_resistance_factor.toFixed(1)}</p>
        <p className="text-[10px] font-mono text-surface-600 mt-0.5">avg resistance</p>
      </div>
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 p-3 text-center">
        <p className="text-sm font-mono font-bold text-emerald truncate">
          {stats.most_resistant_category ?? '—'}
        </p>
        <p className="text-[10px] font-mono text-surface-600 mt-0.5">most resistant</p>
      </div>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function InertiaRow({ topic, rank }: { topic: InertiaTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const tier = TIER_CONFIG[topic.tier]
  const cat = topic.category ?? 'Unknown'
  const catColor = CAT_COLOR[cat] ?? defaultCat
  const CatIcon = CAT_ICON[cat] ?? Scale

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const leadingSide = forPct >= 50 ? 'FOR' : 'AGAINST'
  const leadingPct = forPct >= 50 ? forPct : againstPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.035, 0.5) }}
      className={cn(
        'rounded-2xl bg-surface-100 border overflow-hidden',
        topic.tier === 'bedrock' ? 'border-gold/30' : 'border-surface-300/60',
      )}
    >
      {/* Main row */}
      <div className="p-4 flex items-start gap-3">
        {/* Rank */}
        <span className="text-[10px] font-mono text-surface-600 w-5 flex-shrink-0 mt-1 text-right">
          {rank}
        </span>

        {/* Score ring */}
        <div className={cn(
          'relative flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 flex-shrink-0',
          topic.tier === 'bedrock'
            ? 'border-gold/60 bg-gold/5'
            : topic.tier === 'granite'
            ? 'border-for-500/40 bg-for-500/5'
            : topic.tier === 'stone'
            ? 'border-purple/40 bg-purple/5'
            : 'border-surface-400/30 bg-transparent',
        )}>
          <span className={cn('text-sm font-mono font-bold leading-none', tier.color)}>
            {topic.inertia_score}
          </span>
          <span className="text-[9px] font-mono text-surface-600 leading-none mt-0.5">inrtia</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-mono font-semibold text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
              tier.color, tier.bg, tier.border,
            )}>
              {tier.label}
            </span>
            <span className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
              catColor.text, catColor.bg, catColor.border,
            )}>
              <CatIcon className="h-2.5 w-2.5" />
              {cat}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3 text-for-400" />
              {leadingPct}% {leadingSide}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-purple" />
              {topic.total_arguments} args
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-gold" />
              {topic.resistance_factor.toFixed(1)}× resist
            </span>
          </div>

          {/* Consensus bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-for-400 w-7 text-right">{forPct}%</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-300/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-against-400 w-7">{againstPct}%</span>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="p-1 rounded-lg text-surface-600 hover:text-surface-400 hover:bg-surface-200/50 transition-colors flex-shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand details'}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-surface-300/30"
          >
            <div className="p-4 space-y-3">
              {/* Score breakdown */}
              <div className="rounded-xl bg-surface-200/40 border border-surface-300/30 p-3 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs font-mono font-bold text-for-300">{topic.consensus_gap.toFixed(1)} pp</p>
                  <p className="text-[10px] font-mono text-surface-600">consensus gap</p>
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-purple">{topic.total_votes.toLocaleString()}</p>
                  <p className="text-[10px] font-mono text-surface-600">total votes</p>
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-emerald">{topic.unique_arguers}</p>
                  <p className="text-[10px] font-mono text-surface-600">unique arguers</p>
                </div>
              </div>

              <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                <span className={cn('font-semibold', tier.color)}>{tier.label}</span>{' '}
                — {tier.desc}
              </p>

              <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
                Resistance factor of <span className="text-white font-semibold">{topic.resistance_factor.toFixed(1)}×</span> means
                {' '}{topic.total_arguments} arguments were filed for every {topic.resistance_factor.toFixed(1)} pp of consensus gap —
                showing how hard the community tried but failed to shift this debate.
              </p>

              <Link
                href={`/topic/${topic.id}`}
                className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View topic
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryInertia }) {
  const color = CAT_COLOR[cat.category] ?? defaultCat
  const CatIcon = CAT_ICON[cat.category] ?? Scale

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2',
      color.bg, color.border,
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <CatIcon className={cn('h-3.5 w-3.5', color.text)} />
          <span className={cn('text-xs font-mono font-semibold', color.text)}>{cat.category}</span>
        </div>
        <span className="text-xs font-mono font-bold text-white">
          {cat.avg_score}<span className="text-surface-600">/100</span>
        </span>
      </div>

      <div className="h-1 rounded-full bg-surface-300/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full', color.text.replace('text-', 'bg-'))}
          style={{ width: `${cat.avg_score}%`, opacity: 0.7 }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
        <span>{cat.topic_count} topics</span>
        {cat.bedrock_count > 0 && (
          <span className="text-gold">{cat.bedrock_count} bedrock</span>
        )}
      </div>

      {cat.strongest && (
        <p className="text-[10px] font-mono text-surface-500 leading-relaxed line-clamp-2">
          &ldquo;{cat.strongest}…&rdquo;
        </p>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function InertiaSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/40 p-4 flex items-center gap-3">
          <Skeleton className="h-4 w-4 flex-shrink-0" />
          <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Sort / Filter controls ───────────────────────────────────────────────────

type SortOption = 'inertia' | 'consensus' | 'resistance' | 'engagement'

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'inertia',    label: 'Inertia' },
  { id: 'consensus',  label: 'Consensus' },
  { id: 'resistance', label: 'Resistance' },
  { id: 'engagement', label: 'Arguments' },
]

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function InertiaClient() {
  const [data, setData] = useState<InertiaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('inertia')
  const [category, setCategory] = useState('All')
  const [tab, setTab] = useState<'topics' | 'categories'>('topics')
  const [showInfo, setShowInfo] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (refresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ sort, limit: '30' })
      if (category !== 'All') params.set('category', category)

      const res = await fetch(`/api/inertia?${params}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') setError('Failed to load inertia data.')
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
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/10 border border-gold/30">
                <Mountain className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white leading-none">
                  Civic Inertia Index
                </h1>
                <p className="text-xs font-mono text-surface-500 mt-0.5">
                  The debates that absorbed everything — and didn&apos;t move
                </p>
              </div>
            </div>
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
                  <span className="text-white font-semibold">Inertia Score</span> measures how strongly a debate resists consensus change. High inertia means: many votes, many arguments, yet the community&apos;s verdict never shifted.
                </p>
                <div className="space-y-1.5 text-xs font-mono text-surface-500">
                  <p>Formula: <span className="text-white">(consensus_gap / 50)² × log₁₀(votes + args×3) / log₁₀(100k) × 100</span></p>
                  <p><span className="text-white">Consensus gap</span> is how far the split is from 50/50 (in percentage points).</p>
                  <p><span className="text-white">Resistance factor</span> = total arguments ÷ pp consensus gap — how hard the community tried to shift it.</p>
                  <p>Click any topic to see the score breakdown and enter the debate.</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats */}
        {stats && !loading && <StatsPanel stats={stats} />}

        {/* Tier legend */}
        <TierLegend />

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-surface-200/50 p-1 rounded-xl border border-surface-300/40">
          {(['topics', 'categories'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                tab === t
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300',
              )}
            >
              {t === 'topics' ? 'Top Topics' : 'By Category'}
            </button>
          ))}
        </div>

        {/* Sort + category filter (topics tab only) */}
        {tab === 'topics' && (
          <>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSort(opt.id)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
                    sort === opt.id
                      ? 'bg-gold/20 border-gold/40 text-gold'
                      : 'bg-surface-200/50 border-surface-300/40 text-surface-500 hover:text-surface-300',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                    category === cat
                      ? 'bg-gold/15 border-gold/30 text-gold'
                      : 'bg-surface-200/40 border-surface-300/30 text-surface-600 hover:text-surface-400',
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-2xl bg-against-500/10 border border-against-500/30 text-against-300 text-sm font-mono">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Content */}
        {tab === 'topics' ? (
          loading ? (
            <InertiaSkeleton />
          ) : topics.length === 0 ? (
            <EmptyState
              icon={<Mountain className="h-8 w-8 text-surface-600" />}
              title="No inertia data yet"
              description={
                category !== 'All'
                  ? 'Try a different category, or check back as more topics accumulate votes and arguments.'
                  : 'Not enough debate history yet. Check back once more topics have been argued.'
              }
            />
          ) : (
            <div className="space-y-2">
              {topics.map((topic, i) => (
                <InertiaRow key={topic.id} topic={topic} rank={i + 1} />
              ))}
            </div>
          )
        ) : (
          loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<Mountain className="h-8 w-8 text-surface-600" />}
              title="No category data yet"
              description="Not enough topics with votes yet to compute category inertia."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categories.map((cat) => (
                <CategoryCard key={cat.category} cat={cat} />
              ))}
            </div>
          )
        )}

        {/* Legend footer */}
        {!loading && topics.length > 0 && tab === 'topics' && (
          <div className="rounded-2xl bg-surface-200/40 border border-surface-300/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Mountain className="h-3.5 w-3.5 text-gold" />
              <p className="text-xs font-mono font-semibold text-surface-400">How Inertia Score works</p>
            </div>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              Inertia rewards topics that have both <span className="text-white">strong consensus</span> (far from 50/50) and
              {' '}<span className="text-white">high engagement</span> (many votes and arguments). A topic with millions of votes
              at 95% FOR has maximum inertia — the community spoke loudly and clearly, and no argument could dislodge it.
            </p>
            <Link
              href="/equilibrium"
              className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Compare with Equilibrium Monitor
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Timestamp */}
        {!loading && data?.generatedAt && (
          <p className="text-center text-[10px] font-mono text-surface-700">
            Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' · '}refreshes every 10 min
          </p>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
