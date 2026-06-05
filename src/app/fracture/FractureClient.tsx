'use client'

/**
 * /fracture — The Civic Fracture
 *
 * Reveals the deepest fault lines in civic discourse: topics where the
 * community is closest to a perfect 50/50 split, with high engagement and
 * balanced argument representation from both sides. These are the issues
 * democracy was built to hold — neither side can convince the other.
 *
 * Fracture score = vote_balance × log(votes) × (0.6 + 0.4 × arg_balance)
 *   vote_balance: 1 = perfect 50/50, 0 = unanimous
 *   arg_balance:  1 = equal FOR/AGAINST arguments, 0 = only one side arguing
 *
 * Distinct from:
 *   /stalemate   — deadlocked topics (low vote margin, but not argument-weighted)
 *   /schism      — ideological deep splits (structural, not metric-based)
 *   /divergence  — opinion trajectories over time
 *   /vortex      — argument intensity per voter
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  SlidersHorizontal,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FractureTopic, FractureResponse } from '@/app/api/fracture/route'

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-amber-400',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
  Justice:     'text-against-300',
  Immigration: 'text-surface-400',
}

const CATEGORY_BG: Record<string, string> = {
  Economics:   'bg-gold/10 border-gold/20',
  Politics:    'bg-for-500/10 border-for-500/20',
  Technology:  'bg-purple/10 border-purple/20',
  Science:     'bg-emerald/10 border-emerald/20',
  Ethics:      'bg-against-500/10 border-against-500/20',
  Philosophy:  'bg-purple/10 border-purple/20',
  Culture:     'bg-amber-500/10 border-amber-500/20',
  Health:      'bg-emerald/10 border-emerald/20',
  Environment: 'bg-emerald/10 border-emerald/20',
  Education:   'bg-for-300/10 border-for-300/20',
  Justice:     'bg-against-300/10 border-against-300/20',
  Immigration: 'bg-surface-400/10 border-surface-400/20',
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health',
  'Environment', 'Education',
]

function catColor(c: string | null): string {
  if (!c) return 'text-surface-400'
  const key = Object.keys(CATEGORY_COLORS).find(k =>
    c.toLowerCase().includes(k.toLowerCase()),
  )
  return key ? CATEGORY_COLORS[key] : 'text-surface-400'
}

function catBg(c: string | null): string {
  if (!c) return 'bg-surface-200 border-surface-300'
  const key = Object.keys(CATEGORY_BG).find(k =>
    c.toLowerCase().includes(k.toLowerCase()),
  )
  return key ? CATEGORY_BG[key] : 'bg-surface-200 border-surface-300'
}

// ─── Status badge ─────────────────────────────────────────────────────────────

type BadgeVariant = 'proposed' | 'active' | 'law' | 'failed'

function statusVariant(status: string): BadgeVariant {
  if (status === 'law') return 'law'
  if (status === 'active' || status === 'voting') return 'active'
  if (status === 'failed') return 'failed'
  return 'proposed'
}

// ─── Fracture bar ─────────────────────────────────────────────────────────────
// The visual signature of this page: a split vote bar with a glowing seam.

function FractureBar({
  bluePct,
  balance,
  size = 'md',
}: {
  bluePct: number
  balance: number
  size?: 'sm' | 'md' | 'lg'
}) {
  const redPct = 100 - bluePct
  const heightClass = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3'
  // Glow intensity scales with how close to 50/50 (balance approaching 1)
  const glowOpacity = Math.round(balance * 100)

  return (
    <div className="w-full space-y-1">
      <div className={cn('relative w-full rounded-full overflow-hidden flex', heightClass, 'bg-surface-300')}>
        {/* FOR side */}
        <div
          className="h-full bg-for-500 transition-all duration-500"
          style={{ width: `${bluePct}%` }}
        />
        {/* AGAINST side */}
        <div
          className="h-full bg-against-500 flex-1 transition-all duration-500"
        />
        {/* Fracture seam — glowing crack at the split point */}
        <div
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
          style={{
            left: `${bluePct}%`,
            opacity: glowOpacity / 100,
            boxShadow: `0 0 ${4 + balance * 8}px ${2 + balance * 4}px rgba(255,255,255,${balance * 0.6})`,
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-surface-500">
        <span className="text-for-400">{Math.round(bluePct)}% For</span>
        <span className="text-against-400">{Math.round(redPct)}% Against</span>
      </div>
    </div>
  )
}

// ─── Argument balance pill ────────────────────────────────────────────────────

function ArgBalancePill({
  blueArgs,
  redArgs,
}: {
  blueArgs: number
  redArgs: number
}) {
  const total = blueArgs + redArgs
  if (total === 0) return null

  const blueFrac = total > 0 ? blueArgs / total : 0.5

  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono">
      <ThumbsUp className="h-3 w-3 text-for-400" />
      <div className="relative w-12 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
          style={{ width: `${Math.round(blueFrac * 100)}%` }}
        />
      </div>
      <ThumbsDown className="h-3 w-3 text-against-400" />
      <span className="text-surface-500">
        {blueArgs}/{redArgs}
      </span>
    </div>
  )
}

// ─── Fracture intensity label ─────────────────────────────────────────────────

function intensityLabel(balance: number): { label: string; color: string } {
  if (balance >= 0.9) return { label: 'Critical', color: 'text-against-300' }
  if (balance >= 0.75) return { label: 'Deep', color: 'text-against-400' }
  if (balance >= 0.5) return { label: 'Moderate', color: 'text-gold' }
  return { label: 'Mild', color: 'text-surface-400' }
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Scale className="h-5 w-5 text-against-300" />
  if (rank === 2) return <span className="text-sm font-black text-surface-300">#2</span>
  if (rank === 3) return <span className="text-sm font-black text-surface-400">#3</span>
  return <span className="text-xs font-mono text-surface-500">#{rank}</span>
}

// ─── Podium card ──────────────────────────────────────────────────────────────

function PodiumCard({ topic, delay }: { topic: FractureTopic; delay: number }) {
  const isFirst = topic.rank === 1
  const { label: intLabel, color: intColor } = intensityLabel(topic.vote_balance)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div
          className={cn(
            'rounded-2xl border p-5 transition-all duration-200 group-hover:scale-[1.02]',
            isFirst
              ? 'border-against-500/40 bg-against-500/5 ring-1 ring-against-500/20'
              : 'border-surface-300 bg-surface-100',
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                isFirst ? 'bg-against-500/20' : 'bg-surface-200',
              )}
            >
              <RankMedal rank={topic.rank} />
            </div>
            <Badge variant={statusVariant(topic.status)} className="text-xs capitalize shrink-0">
              {topic.status}
            </Badge>
          </div>

          <p className="text-sm font-semibold text-surface-100 leading-snug line-clamp-3 mb-3">
            {topic.statement}
          </p>

          {topic.category && (
            <span className={cn('text-xs font-semibold uppercase tracking-widest', catColor(topic.category))}>
              {topic.category}
            </span>
          )}

          <div className="mt-4">
            <FractureBar bluePct={topic.blue_pct} balance={topic.vote_balance} size="md" />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-surface-500">
            <span className={cn('font-bold', intColor)}>{intLabel} fracture</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {topic.total_votes.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {topic.argument_count}
              </span>
            </div>
          </div>

          {topic.argument_count > 0 && (
            <div className="mt-2 pt-2 border-t border-surface-300">
              <ArgBalancePill blueArgs={topic.blue_arg_count} redArgs={topic.red_arg_count} />
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Row item ─────────────────────────────────────────────────────────────────

function FractureRow({ topic, index }: { topic: FractureTopic; index: number }) {
  const { label: intLabel, color: intColor } = intensityLabel(topic.vote_balance)

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <Link href={`/topic/${topic.id}`} className="block group">
        <div className="flex items-start gap-4 rounded-xl border border-surface-300 bg-surface-100 p-4 transition-all duration-200 hover:border-against-500/30 hover:bg-against-500/5">
          {/* Rank */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-200 mt-0.5">
            <RankMedal rank={topic.rank} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-semibold text-surface-100 leading-snug line-clamp-2 flex-1">
                {topic.statement}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {topic.category && (
                  <span
                    className={cn(
                      'hidden sm:inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border',
                      catBg(topic.category),
                      catColor(topic.category),
                    )}
                  >
                    {topic.category}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors" />
              </div>
            </div>

            <FractureBar bluePct={topic.blue_pct} balance={topic.vote_balance} size="sm" />

            <div className="mt-2 flex items-center gap-3 flex-wrap">
              <span className={cn('text-xs font-bold', intColor)}>{intLabel}</span>
              <span className="flex items-center gap-1 text-xs text-surface-500">
                <Users className="h-3 w-3" />
                {topic.total_votes.toLocaleString()} votes
              </span>
              {topic.argument_count > 0 && (
                <ArgBalancePill blueArgs={topic.blue_arg_count} redArgs={topic.red_arg_count} />
              )}
              <Badge variant={statusVariant(topic.status)} className="text-[10px] capitalize">
                {topic.status}
              </Badge>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category breakdown ───────────────────────────────────────────────────────

function CategoryBar({
  category,
  count,
  avgFracture,
  maxFracture,
}: {
  category: string
  count: number
  avgFracture: number
  maxFracture: number
}) {
  const pct = maxFracture > 0 ? (avgFracture / maxFracture) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className={cn('text-xs font-semibold w-24 shrink-0 truncate', catColor(category))}>
        {category}
      </span>
      <div className="flex-1 relative h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-against-500/70"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs text-surface-500 font-mono w-8 text-right shrink-0">
        {count}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SortKey = 'score' | 'votes' | 'split' | 'args'

export function FractureClient() {
  const [data, setData] = useState<FractureResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [showFilters, setShowFilters] = useState(false)
  const [limit, setLimit] = useState(30)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams({ limit: String(limit) })
        if (selectedCategory) params.set('category', selectedCategory)
        const res = await fetch(`/api/fracture?${params}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as FractureResponse
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selectedCategory, limit],
  )

  useEffect(() => {
    load()
  }, [load])

  // ── Sort fractures ──────────────────────────────────────────────────────────
  const sorted = data
    ? [...data.fractures].sort((a, b) => {
        if (sortKey === 'votes') return b.total_votes - a.total_votes
        if (sortKey === 'split') return b.vote_balance - a.vote_balance
        if (sortKey === 'args') return b.argument_count - a.argument_count
        return b.fracture_score - a.fracture_score
      })
    : []

  const podium = sorted.slice(0, 3)
  const rest = sorted.slice(3)

  const maxCatFracture =
    data ? Math.max(...data.stats.category_breakdown.map((c) => c.avg_fracture), 0) : 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-24 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-against-400 shrink-0" />
              <h1 className="font-mono text-xl font-bold text-white">The Civic Fracture</h1>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Fault lines — where consensus breaks and both sides hold equally firm
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── What is a fracture? ──────────────────────────────────────── */}
        <div className="rounded-xl border border-against-500/20 bg-against-500/5 px-4 py-3 text-xs text-surface-400 leading-relaxed">
          <span className="text-against-300 font-bold">Fracture score</span> = closeness to 50/50 vote split
          × engagement depth × argument balance. Higher means a deeper, more entrenched division — where
          equal numbers argue each side with equal force.
        </div>

        {/* ── Stats row ───────────────────────────────────────────────── */}
        {loading && !data && (
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        )}

        {data && (
          <motion.div
            className="grid grid-cols-3 gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <p className="text-2xl font-mono font-bold text-white">
                {data.stats.topics_analyzed.toLocaleString()}
              </p>
              <p className="text-[10px] text-surface-500 font-mono mt-0.5 uppercase tracking-wider">
                Topics analysed
              </p>
            </div>
            <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-3 text-center">
              <p className="text-2xl font-mono font-bold text-against-300">
                {data.stats.perfect_splits}
              </p>
              <p className="text-[10px] text-surface-500 font-mono mt-0.5 uppercase tracking-wider">
                Near-perfect splits
              </p>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
              <p className={cn('text-sm font-mono font-bold truncate', catColor(data.stats.most_fractured_category))}>
                {data.stats.most_fractured_category ?? '—'}
              </p>
              <p className="text-[10px] text-surface-500 font-mono mt-0.5 uppercase tracking-wider">
                Most fractured
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition-colors',
                showFilters
                  ? 'bg-against-500/20 text-against-300 border border-against-500/30'
                  : 'bg-surface-200 text-surface-400 border border-surface-300 hover:bg-surface-300 hover:text-white',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
            </button>

            {/* Sort pills */}
            <div className="flex items-center gap-1 ml-auto">
              {([
                { id: 'score', label: 'Score' },
                { id: 'votes', label: 'Votes' },
                { id: 'split', label: 'Split' },
                { id: 'args', label: 'Args' },
              ] as { id: SortKey; label: string }[]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortKey(opt.id)}
                  className={cn(
                    'px-2.5 h-7 rounded-md text-[11px] font-semibold transition-colors border',
                    sortKey === opt.id
                      ? 'bg-against-500/20 text-against-300 border-against-500/30'
                      : 'bg-surface-200 text-surface-500 border-surface-300 hover:bg-surface-300 hover:text-white',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={cn(
                      'px-3 h-7 rounded-md text-xs font-semibold border transition-colors',
                      !selectedCategory
                        ? 'bg-surface-300 text-white border-surface-400'
                        : 'bg-surface-200 text-surface-500 border-surface-300 hover:bg-surface-300 hover:text-white',
                    )}
                  >
                    All categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                      className={cn(
                        'px-3 h-7 rounded-md text-xs font-semibold border transition-colors',
                        selectedCategory === cat
                          ? cn('border-transparent', catBg(cat), catColor(cat))
                          : 'bg-surface-200 text-surface-500 border-surface-300 hover:bg-surface-300 hover:text-white',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {loading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        )}

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && !loading && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-4 text-center">
            <p className="text-sm text-against-300 mb-2">Failed to load fracture data</p>
            <button
              onClick={() => load()}
              className="text-xs text-surface-400 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* ── Empty ────────────────────────────────────────────────────── */}
        {!loading && !error && data && data.fractures.length === 0 && (
          <EmptyState
            icon={Scale}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="No fractures found"
            description="Try removing filters or lowering the minimum vote threshold."
            size="md"
          />
        )}

        {/* ── Podium ───────────────────────────────────────────────────── */}
        {!loading && data && podium.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Scale className="h-4 w-4 text-against-400" />
              <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider font-mono">
                Deepest Fractures
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {podium.map((topic, i) => (
                <PodiumCard key={topic.id} topic={topic} delay={i * 0.1} />
              ))}
            </div>
          </div>
        )}

        {/* ── Ranked list ──────────────────────────────────────────────── */}
        {!loading && rest.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-surface-400 uppercase tracking-wider font-mono px-1">
              Ranked list — {sorted.length} fractures
            </h2>
            {rest.map((topic, i) => (
              <FractureRow key={topic.id} topic={topic} index={i} />
            ))}
          </div>
        )}

        {/* ── Load more ────────────────────────────────────────────────── */}
        {!loading && data && data.fractures.length >= limit && (
          <div className="flex justify-center">
            <button
              onClick={() => setLimit((l) => l + 20)}
              className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-xs font-semibold bg-surface-200 text-surface-400 border border-surface-300 hover:bg-surface-300 hover:text-white transition-colors"
            >
              Load more
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── Category breakdown ───────────────────────────────────────── */}
        {!loading && data && data.stats.category_breakdown.length > 0 && (
          <motion.div
            className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-surface-400" />
              <h3 className="text-sm font-bold text-surface-300 font-mono">
                Fracture by category
              </h3>
            </div>
            <div className="space-y-3">
              {data.stats.category_breakdown.slice(0, 8).map((c) => (
                <CategoryBar
                  key={c.category}
                  category={c.category}
                  count={c.count}
                  avgFracture={c.avg_fracture}
                  maxFracture={maxCatFracture}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        {data && (
          <p className="text-center text-[10px] text-surface-600 font-mono pb-2">
            {data.stats.topics_analyzed} topics analysed
            {data.updated_at && (
              <> · updated {new Date(data.updated_at).toLocaleTimeString()}</>
            )}
          </p>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
