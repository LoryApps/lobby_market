'use client'

/**
 * /drought — The Civic Drought
 *
 * Surfaces active, unresolved debates that have gone silent — no new votes
 * or arguments in 7+ days. These are important civic questions the community
 * has stopped engaging with.
 *
 * Distinct from:
 *   /graveyard     — failed/dead topics (resolved negatively)
 *   /undertow      — topics with hidden engagement beneath the surface
 *   /groundswell   — topics that are WAKING UP (opposite: topics going quiet)
 *   /tipping-point — topics near a decision threshold
 *   /stagnant      — does not exist; this IS the stagnation page
 *
 * The Drought asks: "Which important debates is the community abandoning?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  BarChart2,
  ChevronDown,
  Droplets,
  ExternalLink,
  Flame,
  GlassWater,
  RefreshCw,
  Scale,
  SlidersHorizontal,
  Timer,
  TrendingDown,
  Wind,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DroughtTopic, DroughtStats, DroughtResponse } from '@/app/api/topics/drought/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const DROUGHT_LEVELS = [
  { min: 0,   max: 14,  label: 'Dry Spell',    color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  { min: 14,  max: 30,  label: 'Drought',       color: 'text-against-300',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  { min: 30,  max: 60,  label: 'Severe Drought',color: 'text-against-400',  bg: 'bg-against-500/15',  border: 'border-against-500/40' },
  { min: 60,  max: 999, label: 'Desert',        color: 'text-against-500',  bg: 'bg-against-500/20',  border: 'border-against-500/50' },
]

function getDroughtLevel(daysSilent: number) {
  return DROUGHT_LEVELS.find((l) => daysSilent >= l.min && daysSilent < l.max) ?? DROUGHT_LEVELS[0]
}

function formatSilence(days: number): string {
  if (days < 1)  return 'hours ago'
  if (days === 1) return '1 day ago'
  if (days < 7)  return `${days} days ago`
  if (days < 14) return '1 week ago'
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}yr ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DroughtMeter({ severity }: { severity: number }) {
  const segments = 10
  const filled = Math.round((severity / 100) * segments)
  return (
    <div className="flex items-center gap-0.5" aria-label={`Drought severity ${severity}%`}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 h-3.5 rounded-[2px] transition-colors',
            i < filled
              ? i >= 8 ? 'bg-against-500' : i >= 5 ? 'bg-against-400' : 'bg-gold/80'
              : 'bg-surface-400'
          )}
        />
      ))}
    </div>
  )
}

function StatsBar({ stats }: { stats: DroughtStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="p-3 rounded-xl bg-surface-100 border border-surface-300 text-center">
        <p className="font-mono text-xl font-bold text-against-400">{stats.total_silent}</p>
        <p className="font-mono text-[10px] text-surface-500 mt-0.5">Silent Topics</p>
      </div>
      <div className="p-3 rounded-xl bg-surface-100 border border-surface-300 text-center">
        <p className="font-mono text-xl font-bold text-gold">{stats.avg_days_silent}d</p>
        <p className="font-mono text-[10px] text-surface-500 mt-0.5">Avg Silence</p>
      </div>
      <div className="p-3 rounded-xl bg-surface-100 border border-surface-300 text-center">
        <p className="font-mono text-xl font-bold text-against-500">{stats.longest_drought_days}d</p>
        <p className="font-mono text-[10px] text-surface-500 mt-0.5">Longest</p>
      </div>
    </div>
  )
}

function TopicCard({ topic, index }: { topic: DroughtTopic; index: number }) {
  const level = getDroughtLevel(topic.days_silent)
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="block p-4 rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all group"
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
              {topic.status.toUpperCase()}
            </Badge>
            {topic.category && (
              <span className="font-mono text-[10px] text-surface-500 bg-surface-200 px-1.5 py-0.5 rounded">
                {topic.category}
              </span>
            )}
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors flex-shrink-0 mt-0.5" />
        </div>

        {/* Statement */}
        <p className="font-mono text-sm text-white leading-relaxed mb-3 line-clamp-2">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <div className="mb-3">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
            <div className="bg-for-500 h-full transition-all" style={{ width: `${forPct}%` }} />
            <div className="bg-against-500 h-full transition-all" style={{ width: `${againstPct}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-mono text-[10px] text-for-400">{forPct}% FOR</span>
            <span className="font-mono text-[10px] text-against-400">{againstPct}% AGAINST</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3">
          {/* Silence indicator */}
          <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-lg', level.bg, level.border, 'border')}>
            <Timer className={cn('h-3 w-3', level.color)} />
            <span className={cn('font-mono text-[10px] font-semibold', level.color)}>
              {level.label} · {formatSilence(topic.days_silent)}
            </span>
          </div>

          <div className="flex items-center gap-3 text-right">
            {/* Drought meter */}
            <DroughtMeter severity={topic.drought_severity} />
            {/* Vote count */}
            <div className="flex items-center gap-1">
              <BarChart2 className="h-3 w-3 text-surface-500" />
              <span className="font-mono text-[10px] text-surface-500">
                {topic.total_votes.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function TopicSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-surface-100 border border-surface-300 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-20 rounded" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28 rounded-lg" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

// ─── Category breakdown bar ───────────────────────────────────────────────────

function CategoryBars({ categories }: { categories: DroughtStats['categories'] }) {
  if (!categories.length) return null
  const max = categories[0]?.count ?? 1
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs text-surface-500 mb-3">Most-neglected categories</p>
      {categories.map(({ category, count }) => (
        <div key={category} className="flex items-center gap-3">
          <span className="font-mono text-xs text-surface-400 w-24 truncate">{category}</span>
          <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
            <div
              className="h-full bg-against-500/60 rounded-full"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs text-surface-500 w-4 text-right tabular-nums">{count}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Sort = 'silence' | 'votes' | 'severity'
type Status = 'all' | 'active' | 'proposed' | 'voting'

export default function DroughtPage() {
  const [data, setData] = useState<DroughtResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sort, setSort] = useState<Sort>('silence')
  const [status, setStatus] = useState<Status>('all')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async (s: Sort, st: Status) => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ sort: s })
      if (st !== 'all') params.set('status', st)
      const res = await fetch(`/api/topics/drought?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as DroughtResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(sort, status)
  }, [load, sort, status])

  const handleSort = (s: Sort) => {
    setSort(s)
    load(s, status)
  }
  const handleStatus = (st: Status) => {
    setStatus(st)
    load(sort, st)
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24 pt-14">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30">
                <GlassWater className="h-5 w-5 text-against-400" />
              </div>
              <div>
                <h1 className="font-mono text-xl font-bold text-white">The Civic Drought</h1>
                <p className="font-mono text-xs text-surface-500">Active debates gone silent</p>
              </div>
            </div>
            <p className="font-mono text-sm text-surface-400 leading-relaxed">
              These debates are still unresolved — but the community has stopped talking.
              No new votes, no new arguments. Important civic questions, abandoned mid-sentence.
            </p>
          </motion.div>

          {/* ── Stats ─────────────────────────────────────────────────────── */}
          {loading && !data ? (
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : data?.stats ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <StatsBar stats={data.stats} />
            </motion.div>
          ) : null}

          {/* ── Context panel ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="p-4 rounded-2xl bg-surface-100 border border-surface-300 space-y-1.5"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-gold mt-0.5 flex-shrink-0" />
              <p className="font-mono text-xs text-surface-400">
                Topics qualify as drought if no vote or argument was posted in the last{' '}
                <span className="text-gold font-semibold">7+ days</span>, and they
                remain unresolved. Sorted by silence duration by default.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Droplets className="h-3.5 w-3.5 text-for-400 mt-0.5 flex-shrink-0" />
              <p className="font-mono text-xs text-surface-400">
                The drought severity bar shows how much engagement has dropped relative
                to the topic&apos;s lifetime average.
              </p>
            </div>
          </motion.div>

          {/* ── Filters ───────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters & sort
              <ChevronDown className={cn('h-3 w-3 transition-transform', showFilters && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-1 space-y-3">
                    {/* Sort */}
                    <div>
                      <p className="font-mono text-[10px] text-surface-500 mb-1.5">SORT BY</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {([
                          { id: 'silence', label: 'Longest silence' },
                          { id: 'votes',   label: 'Most votes' },
                          { id: 'severity', label: 'Worst drought' },
                        ] as { id: Sort; label: string }[]).map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => handleSort(id)}
                            aria-pressed={sort === id}
                            className={cn(
                              'px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all',
                              sort === id
                                ? 'bg-against-500/20 text-against-300 border-against-500/40'
                                : 'bg-surface-200/60 text-surface-500 border-transparent hover:text-surface-300'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <p className="font-mono text-[10px] text-surface-500 mb-1.5">STATUS</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {([
                          { id: 'all',      label: 'All' },
                          { id: 'active',   label: 'Active' },
                          { id: 'proposed', label: 'Proposed' },
                          { id: 'voting',   label: 'Voting' },
                        ] as { id: Status; label: string }[]).map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => handleStatus(id)}
                            aria-pressed={status === id}
                            className={cn(
                              'px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all',
                              status === id
                                ? 'bg-surface-300 text-white border-surface-400'
                                : 'bg-surface-200/60 text-surface-500 border-transparent hover:text-surface-300'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Topic list ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => <TopicSkeleton key={i} />)}
            </div>
          ) : error ? (
            <EmptyState
              icon={Wind}
              title="Data unavailable"
              description="Could not load drought data. Try refreshing."
              action={{ label: 'Retry', onClick: () => load(sort, status) }}
            />
          ) : !data?.topics.length ? (
            <EmptyState
              icon={Droplets}
              title="No drought detected"
              description="All active topics are receiving recent engagement. Check back later."
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${sort}-${status}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                {data.topics.map((topic, i) => (
                  <TopicCard key={topic.id} topic={topic} index={i} />
                ))}

                {data.has_more && (
                  <p className="font-mono text-xs text-center text-surface-500 pt-2">
                    Showing top {data.topics.length} most neglected debates.
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Category breakdown ────────────────────────────────────────── */}
          {data?.stats?.categories?.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="p-4 rounded-2xl bg-surface-100 border border-surface-300"
            >
              <CategoryBars categories={data.stats.categories} />
            </motion.div>
          )}

          {/* ── Related links ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { href: '/groundswell', label: 'Groundswell',   icon: TrendingDown, color: 'text-for-400',     desc: 'Topics waking up' },
              { href: '/graveyard',   label: 'Graveyard',     icon: Flame,        color: 'text-against-400', desc: 'Failed debates' },
              { href: '/accord',      label: 'Accord',        icon: Scale,        color: 'text-gold',        desc: 'Near-unanimous' },
              { href: '/tipping-point', label: 'Tipping Point', icon: Zap,        color: 'text-purple',      desc: 'Near threshold' },
            ].map(({ href, label, icon: Icon, color, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
              >
                <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', color)} />
                <div className="min-w-0">
                  <p className="font-mono text-xs text-surface-300 group-hover:text-white transition-colors">{label}</p>
                  <p className="font-mono text-[10px] text-surface-500">{desc}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Refresh */}
          <div className="flex items-center justify-between pt-2">
            <p className="font-mono text-[10px] text-surface-600">
              {data ? `${data.topics.length} neglected debates · computed ${new Date(data.generated_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </p>
            <button
              onClick={() => load(sort, status)}
              disabled={loading}
              className="flex items-center gap-1.5 font-mono text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
