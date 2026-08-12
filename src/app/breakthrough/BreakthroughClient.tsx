'use client'

/**
 * /breakthrough — Civic Breakthrough Index
 *
 * Shows topics where the community has formed a decisive consensus —
 * the moments when democratic ambiguity resolved into a clear signal.
 *
 * Tiers (by consensus score: abs(blue_pct − 50) × 2):
 *   unanimous  ≥ 70  → ≥85% majority (or ≤15%)
 *   landmark   40–69 → 70–84% majority
 *   clear      20–39 → 60–69% majority
 *   forming    10–19 → 55–59% majority
 *
 * Distinct from:
 *   /equilibrium  — snapshot of stability (favours balanced topics)
 *   /entropy      — Shannon entropy of the vote split
 *   /inertia      — high consensus + high engagement
 *   /tipping-point — topics NEAR the consensus threshold
 *   /converging   — approaching consensus, not yet there
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
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
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  BreakthroughTopic,
  BreakthroughTier,
  BreakthroughDirection,
  CategoryBreakthrough,
  BreakthroughStats,
  BreakthroughResponse,
} from '@/app/api/breakthrough/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  BreakthroughTier,
  { label: string; desc: string; color: string; bg: string; border: string; bar: string; glow: string }
> = {
  unanimous: {
    label: 'Unanimous',
    desc: '≥85% agreement. The community has spoken decisively.',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    bar: 'bg-gold',
    glow: 'shadow-gold/20',
  },
  landmark: {
    label: 'Landmark',
    desc: '70–84% agreement. Rare and significant consensus.',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    bar: 'bg-emerald',
    glow: 'shadow-emerald/20',
  },
  clear: {
    label: 'Clear',
    desc: '60–69% agreement. A clear majority opinion.',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-500',
    glow: 'shadow-for-500/10',
  },
  forming: {
    label: 'Forming',
    desc: '55–59% agreement. Consensus is crystallising.',
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    bar: 'bg-surface-500',
    glow: '',
  },
}

const CATEGORIES = [
  'all',
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const TIERS: Array<{ id: BreakthroughTier | 'all'; label: string }> = [
  { id: 'all', label: 'All Tiers' },
  { id: 'unanimous', label: 'Unanimous' },
  { id: 'landmark', label: 'Landmark' },
  { id: 'clear', label: 'Clear' },
  { id: 'forming', label: 'Forming' },
]

const DIRECTIONS: Array<{ id: BreakthroughDirection | 'all'; label: string }> = [
  { id: 'all', label: 'Both' },
  { id: 'for', label: 'For' },
  { id: 'against', label: 'Against' },
]

const SORTS = [
  { id: 'score', label: 'Consensus Score' },
  { id: 'votes', label: 'Most Voted' },
  { id: 'recent', label: 'Most Recent' },
  { id: 'arguments', label: 'Most Argued' },
]

const CAT_ICONS: Record<string, typeof Scale> = {
  Politics:    Landmark,
  Economics:   BarChart2,
  Technology:  Cpu,
  Science:     Activity,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

// ─── Stat strip ───────────────────────────────────────────────────────────────

function StatStrip({ stats }: { stats: BreakthroughStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        {
          label: 'Breakthrough Topics',
          value: stats.total_breakthrough_topics.toLocaleString(),
          sub: `of ${stats.total_topics_analysed.toLocaleString()} analysed`,
          color: 'text-gold',
        },
        {
          label: 'Unanimous',
          value: stats.unanimous_count.toLocaleString(),
          sub: `${stats.landmark_count} landmark`,
          color: 'text-emerald',
        },
        {
          label: 'Avg Consensus',
          value: `${stats.avg_consensus_score}%`,
          sub: 'strength score',
          color: 'text-for-400',
        },
        {
          label: 'Strongest Category',
          value: stats.strongest_category ?? '—',
          sub: 'highest consensus avg',
          color: 'text-purple',
        },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-xl bg-surface-100 border border-surface-300 p-4"
        >
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-1">{s.label}</p>
          <p className={cn('text-xl font-bold font-mono', s.color)}>{s.value}</p>
          <p className="text-xs text-surface-600 mt-0.5">{s.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function BreakthroughCard({
  topic,
  rank,
}: {
  topic: BreakthroughTopic
  rank: number
}) {
  const tier = TIER_CONFIG[topic.tier]
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const majorityPct = topic.direction === 'for' ? forPct : againstPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.03 }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div
          className={cn(
            'rounded-xl border p-4 transition-all duration-200',
            'hover:bg-surface-200/50 hover:shadow-lg',
            tier.border,
            'bg-surface-100',
            tier.glow && `hover:${tier.glow}`,
          )}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-xs text-surface-600">#{rank}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold',
                  tier.bg,
                  tier.color,
                )}
              >
                {topic.tier === 'unanimous' && <Trophy className="h-3 w-3" />}
                {topic.tier === 'landmark' && <TrendingUp className="h-3 w-3" />}
                {topic.tier === 'clear' && <Vote className="h-3 w-3" />}
                {tier.label}
              </span>
              {topic.category && (
                <span className="text-xs font-mono text-surface-500">{topic.category}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ExternalLink className="h-3.5 w-3.5 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Statement */}
          <p className="text-sm font-mono text-white leading-snug mb-3 line-clamp-2">
            {topic.statement}
          </p>

          {/* Consensus indicator */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                {topic.direction === 'for' ? (
                  <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                ) : (
                  <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                )}
                <span className={cn(
                  'text-sm font-mono font-bold',
                  topic.direction === 'for' ? 'text-for-300' : 'text-against-300',
                )}>
                  {majorityPct}% {topic.direction === 'for' ? 'FOR' : 'AGAINST'}
                </span>
              </div>
              <span className="text-xs font-mono text-surface-500">
                Score: <span className={tier.color}>{topic.consensus_score}</span>
              </span>
            </div>
            {/* Vote bar */}
            <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${forPct}%`,
                  background: `linear-gradient(90deg, rgb(59 130 246 / 0.9), rgb(59 130 246 / 0.6))`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] font-mono text-for-400">{forPct}% For</span>
              <span className="text-[10px] font-mono text-against-400">{againstPct}% Against</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {topic.total_votes.toLocaleString()} votes
            </span>
            {topic.total_arguments > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {topic.total_arguments} arguments
              </span>
            )}
            <span
              className={cn(
                'ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                topic.status === 'law' ? 'text-emerald bg-emerald/10' : 'text-surface-500 bg-surface-300/30',
              )}
            >
              {topic.status.toUpperCase()}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryRow({ cat, maxScore }: { cat: CategoryBreakthrough; maxScore: number }) {
  const CatIcon = CAT_ICONS[cat.category] ?? Scale
  const barWidth = maxScore > 0 ? (cat.avg_consensus_score / maxScore) * 100 : 0

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <CatIcon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
        <span className="text-xs font-mono text-surface-400 truncate">{cat.category}</span>
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-emerald"
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-surface-400 w-12 text-right flex-shrink-0">
        {cat.avg_consensus_score}
      </span>
      <span className="text-xs font-mono text-surface-600 w-8 text-right flex-shrink-0">
        ({cat.topic_count})
      </span>
    </div>
  )
}

// ─── Info panel ───────────────────────────────────────────────────────────────

function InfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-for-500/30 bg-for-600/5 p-5 mb-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <h3 className="font-mono text-sm font-semibold text-for-300">How Breakthrough is calculated</h3>
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Each topic receives a{' '}
            <strong className="text-surface-300">Consensus Score</strong> = abs(blue_pct − 50) × 2.
            This maps a 50/50 split to 0 and unanimous agreement to 100.
          </p>
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Topics with a score ≥ 10 (meaning at least 5% lead) qualify as breakthroughs.
            Scores are divided into four tiers: Forming (10–19), Clear (20–39),
            Landmark (40–69), and Unanimous (70+).
          </p>
          <p className="text-xs font-mono text-surface-500 leading-relaxed">
            Unlike <strong className="text-surface-300">/entropy</strong> (which ranks disorder),
            Breakthrough ranks order — the clearest democratic signals on the platform.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(TIER_CONFIG).map(([key, cfg]) => (
              <span key={key} className={cn('text-[10px] font-mono px-2 py-1 rounded-full', cfg.bg, cfg.color)}>
                {cfg.label}: {cfg.desc.split('.')[0]}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-surface-500 hover:text-white transition-colors mt-0.5 flex-shrink-0"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function BreakthroughClient() {
  const [data, setData] = useState<BreakthroughResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [showCategories, setShowCategories] = useState(false)

  // Filters
  const [category, setCategory] = useState<string>('all')
  const [tier, setTier] = useState<string>('all')
  const [direction, setDirection] = useState<string>('all')
  const [sort, setSort] = useState<string>('score')
  const [page, setPage] = useState(0)

  const LIMIT = 20

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        category,
        tier,
        direction,
        sort,
        limit: String(LIMIT),
        offset: String(page * LIMIT),
      })
      const res = await fetch(`/api/breakthrough?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: BreakthroughResponse = await res.json()
      setData(json)
    } catch {
      setError('Failed to load breakthrough data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [category, tier, direction, sort, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [category, tier, direction, sort])

  const maxCatScore = data?.categories.reduce((m, c) => Math.max(m, c.avg_consensus_score), 0) ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-gold" />
              <h1 className="font-mono text-2xl font-bold text-white">Civic Breakthrough</h1>
            </div>
            <p className="text-sm font-mono text-surface-500">
              Topics where the community has formed a decisive consensus.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                showInfo
                  ? 'bg-for-500/20 text-for-300'
                  : 'text-surface-500 hover:text-white hover:bg-surface-200',
              )}
              aria-label="How is this calculated?"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && <InfoPanel onClose={() => setShowInfo(false)} />}
        </AnimatePresence>

        {/* Stats strip */}
        {data?.stats && !loading ? (
          <StatStrip stats={data.stats} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {/* Tier breakdown */}
        {data?.stats && !loading && (
          <div className="flex flex-wrap gap-2 mb-6">
            {(['unanimous', 'landmark', 'clear', 'forming'] as BreakthroughTier[]).map((t) => {
              const cfg = TIER_CONFIG[t]
              const tierCounts: Record<BreakthroughTier, number> = {
                unanimous: data.stats.unanimous_count,
                landmark: data.stats.landmark_count,
                clear: data.stats.clear_count,
                forming: data.stats.forming_count,
              }
              const count = tierCounts[t]
              return (
                <button
                  key={t}
                  onClick={() => setTier(tier === t ? 'all' : t)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold',
                    'border transition-all duration-150',
                    tier === t
                      ? cn(cfg.bg, cfg.color, cfg.border)
                      : 'bg-surface-200 text-surface-400 border-surface-300 hover:border-surface-400',
                  )}
                >
                  {cfg.label}
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[10px]',
                    tier === t ? 'bg-white/10' : 'bg-surface-300',
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {/* Category filter */}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 px-3 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-300 focus:outline-none focus:border-for-500 cursor-pointer"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'All Categories' : c}
              </option>
            ))}
          </select>

          {/* Direction filter */}
          <div className="flex rounded-lg overflow-hidden border border-surface-300">
            {DIRECTIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => setDirection(d.id)}
                className={cn(
                  'px-3 h-8 text-xs font-mono transition-colors',
                  direction === d.id
                    ? d.id === 'for'
                      ? 'bg-for-500/20 text-for-300'
                      : d.id === 'against'
                      ? 'bg-against-500/20 text-against-300'
                      : 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-white hover:bg-surface-200',
                )}
              >
                {d.id === 'for' && <ThumbsUp className="h-3 w-3 inline mr-1" />}
                {d.id === 'against' && <ThumbsDown className="h-3 w-3 inline mr-1" />}
                {d.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-8 px-3 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-300 focus:outline-none focus:border-for-500 cursor-pointer ml-auto"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Category breakdown (collapsible) */}
        {data?.categories && data.categories.length > 0 && !loading && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 mb-5 overflow-hidden">
            <button
              onClick={() => setShowCategories(!showCategories)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Consensus by Category
              </span>
              {showCategories ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <AnimatePresence>
              {showCategories && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 border-t border-surface-300 pt-3 space-y-1">
                    <p className="text-[10px] font-mono text-surface-600 mb-2 uppercase tracking-wider">
                      Average consensus score (0–100)
                    </p>
                    {data.categories.map((cat) => (
                      <CategoryRow key={cat.category} cat={cat} maxScore={maxCatScore} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Topic list */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Zap}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            title="Failed to load"
            description={error}
            action={{ label: 'Try again', onClick: fetchData }}
          />
        ) : !data?.topics.length ? (
          <EmptyState
            icon={Trophy}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            title="No breakthroughs found"
            description="No topics match the current filters. Try broadening your selection."
            action={{ label: 'Reset filters', onClick: () => { setCategory('all'); setTier('all'); setDirection('all') } }}
          />
        ) : (
          <>
            <div className="space-y-3">
              {data.topics.map((topic, i) => (
                <BreakthroughCard
                  key={topic.id}
                  topic={topic}
                  rank={page * LIMIT + i + 1}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-surface-300">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-xs font-mono text-surface-500">
                Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, (data.stats.total_breakthrough_topics))} of{' '}
                {data.stats.total_breakthrough_topics.toLocaleString()}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * LIMIT >= data.stats.total_breakthrough_topics}
                className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Related pages */}
        <div className="mt-10 pt-6 border-t border-surface-300">
          <p className="text-xs font-mono text-surface-600 uppercase tracking-wider mb-3">Related</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/entropy', label: 'Entropy Index', desc: 'Maximum disorder' },
              { href: '/tipping-point', label: 'Tipping Point', desc: 'Near-threshold topics' },
              { href: '/inertia', label: 'Inertia', desc: 'Stable high consensus' },
              { href: '/equilibrium', label: 'Equilibrium', desc: 'Balanced debates' },
              { href: '/converging', label: 'Converging', desc: 'Approaching consensus' },
              { href: '/schism', label: 'Schism', desc: 'Deepest divisions' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 hover:bg-surface-300 transition-colors group"
              >
                <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors">
                  {link.label}
                </span>
                <ArrowRight className="h-3 w-3 text-surface-500 group-hover:text-surface-300 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
