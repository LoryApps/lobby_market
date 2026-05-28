'use client'

/**
 * /meridian — The Civic Meridian
 *
 * The great unresolved questions of civic society: topics that sit precisely
 * at the dividing line — highest engagement AND closest to 50/50.
 *
 * Meridian Score = (votes + args × 8 + debates × 25) × (1 – |blue_pct – 50| / 50)
 *
 * Distinct from:
 *   /split          — snapshot of topics closest to 50/50 right now
 *   /crossfire      — contested topics with arguments shown head-to-head
 *   /polarization   — platform-wide polarisation health metrics
 *   /tipping-point  — topics on the edge of passing or failing
 *
 * The Meridian asks: "Which debates refuse to resolve — AND matter most?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  ChevronDown,
  Clock,
  Flame,
  GitFork,
  Globe,
  Loader2,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MeridianTopic, MeridianResponse } from '@/app/api/meridian/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-amber-400',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-300',
}

const SORT_OPTIONS = [
  { id: 'meridian', label: 'Meridian Score', icon: Target },
  { id: 'votes', label: 'Most Votes', icon: TrendingUp },
  { id: 'contest', label: 'Most Contested', icon: Scale },
] as const

type SortId = (typeof SORT_OPTIONS)[number]['id']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000) return (n / 1_000).toFixed(0) + 'K'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

function contestLabel(bluePct: number): { label: string; color: string } {
  const dist = Math.abs(bluePct - 50)
  if (dist <= 3) return { label: 'Dead Heat', color: 'text-gold' }
  if (dist <= 8) return { label: 'Near Even', color: 'text-amber-400' }
  if (dist <= 15) return { label: 'Tight Race', color: 'text-against-300' }
  return { label: 'Contested', color: 'text-surface-400' }
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function MeridianCard({ topic, rank }: { topic: MeridianTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const { label: cLabel, color: cColor } = contestLabel(topic.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.3 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-100/80 transition-all duration-200',
          'p-4 sm:p-5 group',
        )}
      >
        {/* ── Top row ── */}
        <div className="flex items-start gap-3 mb-3">
          {/* Rank badge */}
          <div className={cn(
            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
            'text-[11px] font-mono font-bold',
            rank === 0
              ? 'bg-gold/20 text-gold border border-gold/40'
              : rank === 1
              ? 'bg-surface-400/30 text-surface-300 border border-surface-400/40'
              : rank === 2
              ? 'bg-amber-900/20 text-amber-500 border border-amber-800/40'
              : 'bg-surface-200 text-surface-500 border border-surface-300',
          )}>
            {rank + 1}
          </div>

          <div className="flex-1 min-w-0">
            {/* Meta row */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {topic.category && (
                <span className={cn('text-[11px] font-mono font-medium', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                  {topic.category}
                </span>
              )}
              <Badge variant={topic.status === 'voting' ? 'active' : 'proposed'} className="text-[9px] py-0">
                {topic.status === 'voting' ? 'Voting' : 'Active'}
              </Badge>
              {topic.scope && topic.scope !== 'Global' && (
                <span className="text-[10px] font-mono text-surface-600 flex items-center gap-0.5">
                  <Globe className="h-2.5 w-2.5" />
                  {topic.scope}
                </span>
              )}
              <span className={cn('text-[10px] font-mono font-semibold ml-auto', cColor)}>
                {cLabel}
              </span>
            </div>

            {/* Statement */}
            <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-100 transition-colors">
              {topic.statement}
            </p>
          </div>
        </div>

        {/* ── Vote bar ── */}
        <div className="mb-3">
          <div className="flex justify-between text-[11px] font-mono mb-1">
            <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
            <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${forPct}%`,
                background: `linear-gradient(90deg, #3b82f6 0%, ${forPct < 50 ? '#ef4444' : '#3b82f6'} 100%)`,
              }}
            />
          </div>
        </div>

        {/* ── Stats row ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {topic.argument_count}
              <span className="hidden sm:inline">args</span>
            </span>
            {topic.debate_count > 0 && (
              <span className="flex items-center gap-1">
                <Mic className="h-3 w-3" />
                {topic.debate_count}
                <span className="hidden sm:inline">debates</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {topic.age_days}d old
            </span>
          </div>

          {/* Meridian score chip */}
          <div className="flex items-center gap-1 bg-purple/10 border border-purple/30 rounded-full px-2 py-0.5">
            <Target className="h-3 w-3 text-purple" />
            <span className="text-[11px] font-mono font-bold text-purple">
              {formatScore(topic.meridian_score)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function MeridianCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
      <Skeleton className="h-1.5 w-full rounded-full mb-3" />
      <div className="flex justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, value, sub, icon: Icon, accent }: {
  label: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <div className={cn('rounded-2xl bg-surface-100 border border-surface-300 p-4 flex flex-col gap-2', accent)}>
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xl font-bold text-white font-mono leading-none">{value}</p>
      {sub && <p className="text-[11px] text-surface-500">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MeridianClient() {
  const [data, setData] = useState<MeridianResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<SortId>('meridian')
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort, limit: '30' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/meridian?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch')
      setData(await res.json())
    } catch {
      setError('Failed to load Meridian data.')
    } finally {
      setLoading(false)
    }
  }, [category, sort])

  useEffect(() => { load() }, [load])

  const currentSort = SORT_OPTIONS.find((s) => s.id === sort)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-[11px] font-mono text-surface-600 hover:text-white transition-colors"
            >
              ← Home
            </Link>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0 mt-1">
              <GitFork className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">The Civic Meridian</h1>
              <p className="text-sm text-surface-500 mt-0.5 leading-relaxed">
                Society&apos;s great unresolved debates — the issues with the highest engagement that still refuse to tip either way. Ranked by Meridian Score: engagement × contestedness.
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <Skeleton className="h-2.5 w-16 mb-2" />
                <Skeleton className="h-7 w-12" />
              </div>
            ))}
          </div>
        ) : data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatChip
              label="Qualified"
              value={data.stats.total_qualified.toString()}
              sub="contested topics"
              icon={Target}
              accent=""
            />
            <StatChip
              label="Avg Score"
              value={formatScore(data.stats.avg_meridian_score)}
              sub="meridian score"
              icon={BarChart2}
              accent=""
            />
            <StatChip
              label="Avg Age"
              value={`${data.stats.avg_age_days}d`}
              sub="unresolved"
              icon={Clock}
              accent=""
            />
            <StatChip
              label="Top Category"
              value={data.stats.most_contested_category ?? '—'}
              sub="most contested"
              icon={Flame}
              accent=""
            />
          </div>
        )}

        {/* ── Explainer ── */}
        <div className="rounded-2xl bg-purple/10 border border-purple/20 p-4 mb-6 flex gap-3">
          <Sparkles className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-mono text-purple font-semibold mb-0.5">How Meridian Score works</p>
            <p className="text-[11px] text-surface-400 leading-relaxed">
              <strong className="text-surface-300">Votes</strong> + <strong className="text-surface-300">Arguments × 8</strong> + <strong className="text-surface-300">Debates × 25</strong>, then multiplied by how close the topic is to 50/50. A topic at exactly 50/50 gets full weight; one at 80/20 gets only 40% weight. The highest scores represent the issues most people care about but can&apos;t agree on.
            </p>
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {/* Category filter */}
          <div className="relative">
            <button
              onClick={() => { setShowCategoryMenu((v) => !v); setShowSortMenu(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium',
                'border transition-all',
                category
                  ? 'bg-for-600/20 border-for-600/40 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              {category ?? 'All Categories'}
              <ChevronDown className="h-3 w-3" />
            </button>
            <AnimatePresence>
              {showCategoryMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 z-30 w-40 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden"
                >
                  <button
                    onClick={() => { setCategory(null); setShowCategoryMenu(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-[11px] font-mono hover:bg-surface-200 transition-colors',
                      !category ? 'text-white font-semibold' : 'text-surface-400',
                    )}
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => { setCategory(cat); setShowCategoryMenu(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-[11px] font-mono hover:bg-surface-200 transition-colors',
                        category === cat ? 'text-white font-semibold' : 'text-surface-400',
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => { setShowSortMenu((v) => !v); setShowCategoryMenu(false) }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium',
                'bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all',
              )}
            >
              <currentSort.icon className="h-3 w-3" />
              {currentSort.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-1 z-30 w-44 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { setSort(opt.id); setShowSortMenu(false) }}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-[11px] font-mono hover:bg-surface-200 transition-colors',
                          sort === opt.id ? 'text-white font-semibold' : 'text-surface-400',
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1" />

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="p-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* ── Content ── */}
        {error ? (
          <div className="text-center py-16">
            <p className="text-surface-500 text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-xl bg-surface-200 text-sm text-surface-300 hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <MeridianCardSkeleton key={i} />)}
          </div>
        ) : !data || data.topics.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No contested topics found"
            description={category ? `No contested topics in ${category} right now.` : 'No topics meeting the Meridian threshold right now. Check back soon.'}
          />
        ) : (
          <>
            <p className="text-[11px] font-mono text-surface-600 mb-3">
              {data.topics.length} topics · sorted by {currentSort.label.toLowerCase()}
              {category && ` · ${category}`}
            </p>
            <div className="space-y-3">
              {data.topics.map((topic, i) => (
                <MeridianCard key={topic.id} topic={topic} rank={i} />
              ))}
            </div>

            {/* Bottom CTA */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              <Link
                href="/crossfire"
                className="flex items-center justify-center gap-2 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 transition-all group"
              >
                <Zap className="h-4 w-4 text-against-400" />
                <span className="text-sm font-medium text-surface-300 group-hover:text-white transition-colors">Crossfire</span>
                <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 ml-auto" />
              </Link>
              <Link
                href="/tipping-point"
                className="flex items-center justify-center gap-2 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 transition-all group"
              >
                <Target className="h-4 w-4 text-for-400" />
                <span className="text-sm font-medium text-surface-300 group-hover:text-white transition-colors">Tipping Point</span>
                <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 ml-auto" />
              </Link>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
