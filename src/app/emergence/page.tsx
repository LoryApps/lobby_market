'use client'

/**
 * /emergence — Civic Emergence
 *
 * New topics finding their first real civic momentum. Brand-new debates
 * (< 45 days old) ranked by how quickly they are accumulating votes,
 * arguments, and engagement relative to their age.
 *
 * An "emerging" topic is not just young — it must be growing fast. A topic
 * 3 days old with 200 votes is emerging. A topic 3 days old with 5 votes is
 * still dormant.
 *
 * Distinct from:
 *   /trending      — algorithm-based feed score (older topics can trend too)
 *   /surge         — absolute high-volume topics (already established, loud)
 *   /groundswell   — dormant topics WAKING UP (long history, sudden revival)
 *   /momentum      — vote-direction swing (FOR vs AGAINST shifts)
 *   /rising        — general platform-wide rising metrics
 *
 * Emergence is about debut: the very first time a civic debate finds its crowd.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Filter,
  Flame,
  MessageSquare,
  RefreshCw,
  Rocket,
  Scale,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  EmergingTopic,
  EmergenceCategory,
  EmergenceResponse,
} from '@/app/api/emergence/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const SORT_OPTIONS = [
  { value: 'score', label: 'Top Score' },
  { value: 'velocity', label: 'Vote Velocity' },
  { value: 'acceleration', label: 'Accelerating' },
  { value: 'recency', label: 'Newest' },
]

const TIER_CONFIG: Record<EmergingTopic['emergence_tier'], {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Rocket
}> = {
  breakthrough: {
    label: 'Breakthrough',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    icon: Rocket,
  },
  surging: {
    label: 'Surging',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    icon: TrendingUp,
  },
  rising: {
    label: 'Rising',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    icon: Flame,
  },
  building: {
    label: 'Building',
    color: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/20',
    icon: Zap,
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeAge(daysOld: number): string {
  if (daysOld < 1) return 'Today'
  if (daysOld < 2) return '1 day old'
  if (daysOld < 7) return `${Math.floor(daysOld)} days old`
  if (daysOld < 14) return '1 week old'
  return `${Math.round(daysOld / 7)} weeks old`
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-gold'
  if (score >= 50) return 'text-for-300'
  if (score >= 25) return 'text-purple'
  return 'text-surface-500'
}

function scoreBg(score: number): string {
  if (score >= 75) return 'bg-gold/10 border-gold/30'
  if (score >= 50) return 'bg-for-500/10 border-for-500/30'
  if (score >= 25) return 'bg-purple/10 border-purple/30'
  return 'bg-surface-300/30 border-surface-400/20'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmergenceCard({ topic, rank }: { topic: EmergingTopic; rank: number }) {
  const [expanded, setExpanded] = useState(false)
  const tier = TIER_CONFIG[topic.emergence_tier]
  const TierIcon = tier.icon
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03 }}
      className={cn(
        'rounded-2xl bg-surface-100 border overflow-hidden transition-colors',
        tier.border
      )}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          {/* Emergence score badge */}
          <div className={cn(
            'flex-shrink-0 flex flex-col items-center justify-center h-12 w-12 rounded-xl border text-center',
            scoreBg(topic.emergence_score)
          )}>
            <span className={cn('text-sm font-mono font-black leading-none', scoreColor(topic.emergence_score))}>
              {topic.emergence_score}
            </span>
            <span className="text-[9px] font-mono text-surface-500 mt-0.5 leading-none">score</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {/* Tier badge */}
              <span className={cn(
                'flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border',
                tier.bg, tier.border, tier.color
              )}>
                <TierIcon className="h-3 w-3" />
                {tier.label}
              </span>

              {topic.category && (
                <span className={cn(
                  'text-xs font-mono px-1.5 py-0.5 rounded bg-surface-200 border border-surface-300',
                  CATEGORY_COLOR[topic.category] ?? 'text-surface-400'
                )}>
                  {topic.category}
                </span>
              )}

              <span className="text-xs font-mono text-surface-500 flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {relativeAge(topic.days_old)}
              </span>
            </div>

            <Link
              href={`/topic/${topic.id}`}
              className="text-sm font-mono font-semibold text-white leading-snug hover:text-for-400 transition-colors line-clamp-2"
            >
              {topic.statement}
            </Link>
          </div>
        </div>

        {/* ── Vote bar ─────────────────────────────────────────────────────── */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-for-400 font-bold">{forPct}% FOR</span>
            <span className="text-xs font-mono text-against-400 font-bold">{againstPct}% AGAINST</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all"
              style={{ width: `${forPct}%` }}
            />
          </div>
        </div>

        {/* ── Key metrics ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-xl bg-surface-200 border border-surface-300 p-2.5 text-center">
            <div className="text-lg font-mono font-black text-white">
              {topic.total_votes.toLocaleString()}
            </div>
            <div className="text-[10px] font-mono text-surface-500">votes</div>
          </div>
          <div className="rounded-xl bg-surface-200 border border-surface-300 p-2.5 text-center">
            <div className="text-lg font-mono font-black text-for-300">
              {topic.votes_per_day.toFixed(1)}
            </div>
            <div className="text-[10px] font-mono text-surface-500">votes/day</div>
          </div>
          <div className="rounded-xl bg-surface-200 border border-surface-300 p-2.5 text-center">
            <div className={cn(
              'text-lg font-mono font-black',
              topic.acceleration >= 3 ? 'text-gold' :
              topic.acceleration >= 2 ? 'text-for-300' :
              topic.acceleration >= 1 ? 'text-purple' : 'text-surface-400'
            )}>
              {topic.acceleration >= 10 ? '10×+' : `${topic.acceleration}×`}
            </div>
            <div className="text-[10px] font-mono text-surface-500">accel</div>
          </div>
        </div>

        {/* ── Expand toggle ─────────────────────────────────────────────────── */}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-surface-400/60 transition-colors text-xs font-mono text-surface-400 hover:text-surface-300"
          aria-expanded={expanded}
        >
          <span>More metrics</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Expanded detail ───────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 border-t border-surface-300/50 pt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <MessageSquare className="h-3 w-3 text-purple" />
                    <span className="text-[10px] font-mono text-surface-500">Arguments</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-white">{topic.arg_count}</div>
                  <div className="text-[10px] font-mono text-surface-600">
                    {topic.args_per_day.toFixed(1)}/day
                  </div>
                </div>

                {topic.view_count > 0 && (
                  <div className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Eye className="h-3 w-3 text-gold" />
                      <span className="text-[10px] font-mono text-surface-500">Views</span>
                    </div>
                    <div className="text-sm font-mono font-bold text-white">
                      {topic.view_count.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-surface-600">
                      {topic.views_per_day.toLocaleString()}/day
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="h-3 w-3 text-for-400" />
                    <span className="text-[10px] font-mono text-surface-500">Last 24h</span>
                  </div>
                  <div className="text-sm font-mono font-bold text-white">
                    +{topic.votes_last_24h}
                  </div>
                  <div className="text-[10px] font-mono text-surface-600">new votes</div>
                </div>

                {topic.scope && (
                  <div className="rounded-xl bg-surface-200/60 border border-surface-300/50 p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <BarChart2 className="h-3 w-3 text-surface-400" />
                      <span className="text-[10px] font-mono text-surface-500">Scope</span>
                    </div>
                    <div className="text-sm font-mono font-bold text-white capitalize">
                      {topic.scope}
                    </div>
                  </div>
                )}
              </div>

              <Link
                href={`/topic/${topic.id}`}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/50 hover:border-for-500/40 hover:bg-for-500/5 transition-all text-xs font-mono text-for-400 group"
              >
                <span>View debate</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function CategoryBar({ cat }: { cat: EmergenceCategory }) {
  return (
    <Link
      href={`/emergence?category=${encodeURIComponent(cat.category)}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200 transition-all group"
    >
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs font-mono font-bold mb-0.5', CATEGORY_COLOR[cat.category] ?? 'text-surface-400')}>
          {cat.category}
        </div>
        <div className="text-[10px] font-mono text-surface-500 truncate">
          {cat.emerging_count} emerging · avg score {cat.avg_emergence_score}
        </div>
      </div>
      <div className="text-xs font-mono font-bold text-surface-300 group-hover:text-for-400 transition-colors">
        {cat.avg_emergence_score}
      </div>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EmergencePage() {
  const [data, setData] = useState<EmergenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<string>('score')
  const [showFilters, setShowFilters] = useState(false)
  const [showCategories, setShowCategories] = useState(false)

  const load = useCallback(async (cat: string | null, s: string) => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ sort: s })
      if (cat) params.set('category', cat)
      const res = await fetch(`/api/emergence?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      const json: EmergenceResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Read category from URL on mount
    const url = new URL(window.location.href)
    const urlCat = url.searchParams.get('category')
    if (urlCat && CATEGORIES.includes(urlCat)) {
      setCategory(urlCat)
      load(urlCat, sort)
    } else {
      load(null, sort)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyFilters(newCat: string | null, newSort: string) {
    setCategory(newCat)
    setSort(newSort)
    setShowFilters(false)
    load(newCat, newSort)
  }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <div className="mb-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Feed
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-gold" />
                <h1 className="text-lg font-mono font-black text-white tracking-tight">
                  Civic Emergence
                </h1>
              </div>
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                New debates finding their first real civic momentum — ranked by
                how fast they&apos;re accumulating votes relative to their age.
              </p>
            </div>

            <button
              onClick={() => load(category, sort)}
              className="flex-shrink-0 p-2 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors text-surface-400 hover:text-white"
              aria-label="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Meta strip ────────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="flex items-center gap-3 mb-4 text-xs font-mono text-surface-500">
            <span>{data.total} emerging topics</span>
            <span>·</span>
            <span>last {data.window_days} days</span>
            {category && (
              <>
                <span>·</span>
                <button
                  onClick={() => applyFilters(null, sort)}
                  className="flex items-center gap-1 text-for-400 hover:text-for-300 transition-colors"
                >
                  {category}
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Filters bar ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all',
              showFilters
                ? 'bg-for-500/15 border-for-500/40 text-for-400'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-surface-400'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>

          {/* Sort quick-select */}
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => applyFilters(category, opt.value)}
              className={cn(
                'px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all',
                sort === opt.value
                  ? 'bg-surface-300 border-surface-400 text-white font-bold'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400/60 hover:text-surface-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Expanded filters ──────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
                <p className="text-xs font-mono text-surface-500 mb-3 font-semibold uppercase tracking-wider">Category</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyFilters(null, sort)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-xs font-mono transition-all',
                      !category
                        ? 'bg-for-500/15 border-for-500/40 text-for-400 font-bold'
                        : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400/60'
                    )}
                  >
                    All
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => applyFilters(cat, sort)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl border text-xs font-mono transition-all',
                        category === cat
                          ? 'bg-for-500/15 border-for-500/40 text-for-400 font-bold'
                          : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:border-surface-400/60'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Category breakdown (collapsible) ──────────────────────────────── */}
        {data?.categories && data.categories.length > 0 && !loading && (
          <div className="mb-5">
            <button
              onClick={() => setShowCategories((p) => !p)}
              className="w-full flex items-center justify-between mb-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
            >
              <span className="font-semibold uppercase tracking-wider">Category Breakdown</span>
              {showCategories
                ? <ChevronUp className="h-3.5 w-3.5" />
                : <ChevronDown className="h-3.5 w-3.5" />
              }
            </button>
            <AnimatePresence initial={false}>
              {showCategories && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 gap-2 mb-4">
                    {data.categories.map((cat) => (
                      <CategoryBar key={cat.category} cat={cat} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── Tier legend ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {(Object.entries(TIER_CONFIG) as [EmergingTopic['emergence_tier'], typeof TIER_CONFIG[keyof typeof TIER_CONFIG]][]).map(([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <div
                key={key}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-mono',
                  cfg.bg, cfg.border, cfg.color
                )}
              >
                <Icon className="h-3 w-3" />
                {cfg.label}
              </div>
            )
          })}
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                  <Skeleton className="h-14 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && !loading && (
          <EmptyState
            icon={Scale}
            title="Could not load emerging topics"
            description="Something went wrong. Try refreshing."
            action={{ label: 'Retry', onClick: () => load(category, sort) }}
          />
        )}

        {/* ── Empty ─────────────────────────────────────────────────────────── */}
        {!loading && !error && data?.topics.length === 0 && (
          <EmptyState
            icon={Sparkles}
            title="No emerging topics right now"
            description={
              category
                ? `No new topics are gaining traction in ${category} yet. Try a different category.`
                : 'No new topics are gaining traction right now. Check back soon.'
            }
            action={category ? { label: 'Clear filter', onClick: () => applyFilters(null, sort) } : undefined}
          />
        )}

        {/* ── Topic cards ───────────────────────────────────────────────────── */}
        {!loading && !error && data && data.topics.length > 0 && (
          <div className="space-y-3">
            {data.topics.map((topic, i) => (
              <EmergenceCard key={topic.id} topic={topic} rank={i} />
            ))}

            <div className="text-center pt-4">
              <p className="text-xs font-mono text-surface-600">
                Showing {data.topics.length} of {data.total} emerging topics from the last {data.window_days} days
              </p>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
