'use client'

/**
 * /uncertainty — The Civic Uncertainty Index
 *
 * Ranks civic debates by how genuinely uncertain the community is — not just
 * contested, but topics where both sides are evenly matched in votes AND
 * arguments, and many people have weighed in without reaching consensus.
 *
 * Distinct from:
 *   /crossfire     — passionate head-to-head fights, strong arguments each side
 *   /meridian      — most-engaged unresolved debates (high total engagement)
 *   /battleground  — topics actively approaching the law threshold
 *   /volatility    — topics with rapid consensus shifts
 *
 * Answers: "Where is society most genuinely unsure what to think?"
 *
 * Uncertainty Score = vote_contestedness (50%) + argument_balance (30%) + engagement_weight (20%)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  BarChart2,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
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
  Search,
  Shuffle,
  TrendingUp,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { UncertainTopic, CategoryUncertainty, UncertaintyResponse } from '@/app/api/uncertainty/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { icon: typeof Landmark; color: string; bg: string; border: string }> = {
  Politics:    { icon: Landmark,      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30'      },
  Economics:   { icon: TrendingUp,    color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30'          },
  Technology:  { icon: Cpu,           color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30'        },
  Science:     { icon: FlaskConical,  color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
  Ethics:      { icon: Scale,         color: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30'       },
  Philosophy:  { icon: BookOpen,      color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30'        },
  Culture:     { icon: Music2,        color: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30'   },
  Health:      { icon: Heart,         color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
  Education:   { icon: GraduationCap, color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30'          },
  Environment: { icon: Leaf,          color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
}

function getCatConfig(name: string | null) {
  return CATEGORY_CONFIG[name ?? ''] ?? {
    icon: FileText,
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
  }
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: 'text-for-400',    bg: 'bg-for-500/15'    },
  voting:   { label: 'Voting',   color: 'text-purple',     bg: 'bg-purple/15'     },
  law:      { label: 'Law',      color: 'text-gold',       bg: 'bg-gold/15'       },
  failed:   { label: 'Failed',   color: 'text-surface-500',bg: 'bg-surface-300/30'},
  proposed: { label: 'Proposed', color: 'text-surface-600',bg: 'bg-surface-400/20'},
}

// ─── Uncertainty color + label ────────────────────────────────────────────────

function uncertaintyColor(score: number): string {
  if (score >= 75) return 'text-against-400'
  if (score >= 55) return 'text-gold'
  if (score >= 35) return 'text-for-400'
  return 'text-surface-500'
}

function uncertaintyLabel(score: number): string {
  if (score >= 75) return 'High Uncertainty'
  if (score >= 55) return 'Moderate'
  if (score >= 35) return 'Low'
  return 'Minimal'
}

function uncertaintyRingColor(score: number): string {
  if (score >= 75) return 'border-against-500/50 bg-against-500/10'
  if (score >= 55) return 'border-gold/50 bg-gold/10'
  if (score >= 35) return 'border-for-500/50 bg-for-500/10'
  return 'border-surface-400 bg-surface-200'
}

// ─── Margin bar ───────────────────────────────────────────────────────────────

function MarginBar({ margin }: { margin: number }) {
  // margin 0 = perfectly split (50/50), 50 = unanimous
  const splitPct = Math.max(0, 50 - margin)  // how far from center
  const forPct = 50 + splitPct
  const againstPct = 50 - splitPct

  return (
    <div className="flex items-center gap-1.5 w-full">
      <span className="text-[10px] font-mono text-for-400 w-8 text-right tabular-nums">{Math.round(forPct)}%</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-surface-300">
        <div
          className="h-full bg-for-500/70 transition-all duration-500"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="h-full bg-against-500/70 transition-all duration-500"
          style={{ width: `${againstPct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-8 tabular-nums">{Math.round(againstPct)}%</span>
    </div>
  )
}

// ─── Dimension bar ────────────────────────────────────────────────────────────

function DimensionBar({
  label,
  value,
  color,
}: {
  label: string
  value: number  // 0–1
  color: string
}) {
  const pct = Math.min(100, value * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-surface-500 w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-500 w-8 text-right tabular-nums">
        {Math.round(pct)}%
      </span>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, rank }: { topic: UncertainTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const catConf = getCatConfig(topic.category)
  const statConf = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const CatIcon = catConf.icon

  return (
    <div className={cn(
      'rounded-xl border bg-surface-100 overflow-hidden transition-colors',
      'hover:border-surface-400',
      expanded ? 'border-surface-400' : 'border-surface-300',
    )}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <span className="text-xs font-mono text-surface-600 w-5 flex-shrink-0 tabular-nums">
          {rank}
        </span>

        {/* Uncertainty score ring */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full border-2 font-mono text-sm font-bold',
          uncertaintyRingColor(topic.uncertainty_score),
          uncertaintyColor(topic.uncertainty_score),
        )}>
          {topic.uncertainty_score}
        </div>

        {/* Category icon */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md border',
          catConf.bg, catConf.border,
        )}>
          <CatIcon className={cn('h-3.5 w-3.5', catConf.color)} />
        </div>

        {/* Statement */}
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm text-white leading-snug line-clamp-2">{topic.statement}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-md', statConf.bg, statConf.color)}>
              {statConf.label}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {topic.total_votes.toLocaleString()} votes
            </span>
            <span className={cn('text-[10px] font-mono', uncertaintyColor(topic.uncertainty_score))}>
              {uncertaintyLabel(topic.uncertainty_score)}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              ±{topic.margin.toFixed(1)}% from 50/50
            </span>
          </div>
        </div>

        {/* Chevron */}
        <span className="text-surface-500 flex-shrink-0">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {/* Vote split bar (always visible) */}
      <div className="px-4 pb-3">
        <MarginBar margin={topic.margin} />
      </div>

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
            <div className="px-4 pb-4 pt-1 border-t border-surface-300 space-y-4">
              {/* Score dimensions */}
              <div>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                  Uncertainty Dimensions
                </p>
                <div className="space-y-1.5">
                  <DimensionBar
                    label="Vote contestedness"
                    value={topic.vote_contestedness}
                    color="bg-against-500/70"
                  />
                  <DimensionBar
                    label="Argument balance"
                    value={topic.argument_balance}
                    color="bg-gold/70"
                  />
                  <DimensionBar
                    label="Engagement weight"
                    value={Math.min(1, topic.engagement_weight / 4)}
                    color="bg-for-500/70"
                  />
                </div>
              </div>

              {/* Argument breakdown */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-for-500/70" />
                  <span className="text-[11px] font-mono text-for-400">{topic.for_args} FOR args</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-against-500/70" />
                  <span className="text-[11px] font-mono text-against-400">{topic.against_args} AGAINST args</span>
                </div>
              </div>

              {/* Links */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/topic/${topic.id}`}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ArrowRight className="h-3 w-3" />
                  View debate
                </Link>
                <Link
                  href={`/topic/${topic.id}/versus`}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Scale className="h-3 w-3" />
                  FOR vs AGAINST
                </Link>
                <Link
                  href={`/topic/${topic.id}/arguments`}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MessageSquare className="h-3 w-3" />
                  Arguments
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryUncertainty }) {
  const conf = getCatConfig(cat.category)
  const CatIcon = conf.icon

  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center justify-center w-6 h-6 rounded-md border', conf.bg, conf.border)}>
          <CatIcon className={cn('h-3 w-3', conf.color)} />
        </div>
        <span className="text-xs font-mono text-white font-medium">{cat.category}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={cn('text-lg font-mono font-bold tabular-nums', uncertaintyColor(cat.avg_uncertainty_score))}>
          {cat.avg_uncertainty_score}
        </span>
        <span className="text-[10px] font-mono text-surface-600">{cat.topic_count} topics</span>
      </div>
      <p className="text-[10px] font-mono text-surface-500">
        avg ±{cat.avg_margin.toFixed(1)}% margin
      </p>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function UncertaintySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex gap-3 items-center">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          <Skeleton className="h-6 w-6 rounded-md flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SortKey = 'score' | 'margin' | 'votes' | 'args'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',  label: 'Uncertainty' },
  { key: 'margin', label: 'Closest split' },
  { key: 'votes',  label: 'Most voted' },
  { key: 'args',   label: 'Most argued' },
]

export default function UncertaintyPage() {
  const [data, setData] = useState<UncertaintyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('score')
  const [showInfo, setShowInfo] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/uncertainty', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as UncertaintyResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredTopics = data?.topics
    .filter((t) => {
      if (selectedCategory && t.category !== selectedCategory) return false
      if (query.trim()) {
        const q = query.toLowerCase()
        return (
          t.statement.toLowerCase().includes(q) ||
          (t.category ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      if (sort === 'score')  return b.uncertainty_score - a.uncertainty_score
      if (sort === 'margin') return a.margin - b.margin  // lower margin = closer to 50/50
      if (sort === 'votes')  return b.total_votes - a.total_votes
      if (sort === 'args')   return (b.for_args + b.against_args) - (a.for_args + a.against_args)
      return 0
    })
    ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <Shuffle className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Uncertainty Index
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Where society is most genuinely unsure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              aria-label="How this is calculated"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white transition-colors"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              aria-label="Refresh"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-against-400 flex-shrink-0" />
                  <p className="text-sm font-mono text-white font-semibold">How Uncertainty Is Scored</p>
                </div>
                <div className="space-y-2 text-xs font-mono text-surface-400">
                  <div className="flex items-start gap-2">
                    <span className="text-against-400 flex-shrink-0">50%</span>
                    <span><span className="text-white">Vote contestedness</span> — how close to 50/50 the split is. Perfectly split = 1.0.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gold flex-shrink-0">30%</span>
                    <span><span className="text-white">Argument balance</span> — whether FOR and AGAINST arguments are equally matched. Perfectly balanced = 1.0.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-for-400 flex-shrink-0">20%</span>
                    <span><span className="text-white">Engagement weight</span> — log-scaled vote count. More voters means more genuine uncertainty, not just indifference.</span>
                  </div>
                </div>
                <p className="text-[11px] font-mono text-surface-600">
                  Only topics with ≥ 20 votes are included. Low-traffic topics are excluded to filter out noise.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Platform stats */}
        {!loading && data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Topics Scored</p>
              <p className="text-xl font-mono font-bold text-white tabular-nums">
                {data.stats.total_topics_scored.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Near 50/50</p>
              <p className="text-xl font-mono font-bold text-against-400 tabular-nums">
                {data.stats.perfectly_split_count}
              </p>
              <p className="text-[10px] font-mono text-surface-600">within ±5%</p>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Avg Margin</p>
              <p className="text-xl font-mono font-bold text-gold tabular-nums">
                ±{data.stats.avg_margin}%
              </p>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl px-4 py-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Most Uncertain</p>
              <p className="text-sm font-mono font-semibold text-white truncate">
                {data.stats.most_uncertain_category ?? '—'}
              </p>
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {!loading && data && data.categories.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                Uncertainty by Category
              </span>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="ml-auto text-[10px] font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {data.categories.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setSelectedCategory(
                    selectedCategory === cat.category ? null : cat.category
                  )}
                  className={cn(
                    'text-left transition-all',
                    selectedCategory === cat.category && 'ring-1 ring-against-400 rounded-xl',
                  )}
                >
                  <CategoryCard cat={cat} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sort + search controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics…"
              className={cn(
                'w-full pl-9 pr-3 h-9 rounded-lg',
                'bg-surface-200 border border-surface-400 text-sm font-mono text-white',
                'placeholder:text-surface-600',
                'focus:outline-none focus:ring-1 focus:ring-against-400',
              )}
            />
          </div>

          {/* Sort pills */}
          <div className="flex gap-1.5 flex-wrap">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setSort(opt.key)}
                className={cn(
                  'px-3 h-9 rounded-lg text-xs font-mono font-medium border transition-all',
                  sort === opt.key
                    ? 'bg-against-600/20 border-against-500/50 text-against-400'
                    : 'bg-surface-200 border-surface-400 text-surface-500 hover:text-white hover:border-surface-300',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results header */}
        {!loading && (
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-surface-500">
              {filteredTopics.length} debate{filteredTopics.length !== 1 ? 's' : ''}
              {selectedCategory ? ` in ${selectedCategory}` : ''}
              {query ? ` matching "${query}"` : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-against-400" />
              <span className="text-[10px] font-mono text-surface-500">sorted by {SORT_OPTIONS.find((o) => o.key === sort)?.label}</span>
            </div>
          </div>
        )}

        {/* Main list */}
        {loading ? (
          <UncertaintySkeleton />
        ) : error ? (
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-against-400 mx-auto mb-3" />
            <p className="font-mono text-sm text-surface-400">Failed to load uncertainty data.</p>
            <button
              type="button"
              onClick={fetchData}
              className="mt-3 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : filteredTopics.length === 0 ? (
          <EmptyState
            icon={Vote}
            title="No debates found"
            description={
              query || selectedCategory
                ? 'Try a different search or category filter.'
                : 'Not enough votes on debates yet to compute uncertainty.'
            }
          />
        ) : (
          <motion.div
            className="space-y-2"
            initial="hidden"
            animate="show"
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
          >
            {filteredTopics.map((topic, idx) => (
              <motion.div
                key={topic.id}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
              >
                <TopicRow topic={topic} rank={idx + 1} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Cross-links */}
        {!loading && !error && (
          <div className="mt-8 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <p className="text-xs font-mono text-surface-500 mb-3">Related views</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { href: '/crossfire',   icon: Scale,       label: 'Crossfire',     sub: 'Sharpest head-to-head debates' },
                { href: '/meridian',    icon: Brain,       label: 'Meridian',      sub: 'Most engaged unresolved topics' },
                { href: '/battleground',icon: Vote,        label: 'Battleground',  sub: 'Active voting toward threshold' },
                { href: '/depth',       icon: BookOpen,    label: 'Depth Index',   sub: 'Richest intellectual discourse' },
                { href: '/volatility',  icon: TrendingUp,  label: 'Volatility',    sub: 'Fastest consensus shifts' },
                { href: '/tensions',    icon: AlertCircle, label: 'Tensions',      sub: 'Conflicting established laws' },
              ].map(({ href, icon: Icon, label, sub }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-start gap-2.5 p-3 rounded-lg border border-surface-300',
                    'bg-surface-200/50 hover:bg-surface-200 hover:border-surface-400',
                    'transition-all group',
                  )}
                >
                  <Icon className="h-4 w-4 text-surface-500 group-hover:text-white mt-0.5 flex-shrink-0 transition-colors" />
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-white font-medium">{label}</p>
                    <p className="text-[10px] font-mono text-surface-600 leading-snug">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
