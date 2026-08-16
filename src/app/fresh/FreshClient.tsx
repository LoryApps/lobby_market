'use client'

/**
 * /fresh — Freshly Debated Topics
 *
 * Surfaces civic debates that are less than 14 days old, sorted by early
 * engagement velocity (votes per hour). The goal: catch debates before
 * consensus hardens and your vote still has outsized influence.
 *
 * Age tiers:
 *   New     — < 24h (just proposed, almost no signal yet)
 *   Fresh   — 1–3 d (early engagement, outcome wide open)
 *   Recent  — 3–7 d (gaining clarity but still contested)
 *   Week    — 7–14 d (approaching maturity, some consensus forming)
 *
 * Sort modes:
 *   velocity — votes per hour (default) — who's getting voted on fastest?
 *   newest   — time since creation ascending
 *   votes    — absolute vote count
 *   argued   — argument count — most debated
 *
 * Backed by /api/topics/fresh (no new migrations needed).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  BookOpen,
  Clock,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Rocket,
  Sparkles,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FreshTopic, FreshTopicsResponse } from '@/app/api/topics/fresh/route'

// ─── Age tier config ──────────────────────────────────────────────────────────

const AGE_TIER_CONFIG: Record<FreshTopic['age_tier'], {
  label: string
  color: string
  bg: string
  border: string
  icon: typeof Sparkles
  desc: string
}> = {
  new: {
    label: 'New',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    icon: Sparkles,
    desc: '< 24 hours old',
  },
  fresh: {
    label: 'Fresh',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    icon: Zap,
    desc: '1–3 days old',
  },
  recent: {
    label: 'Recent',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    icon: TrendingUp,
    desc: '3–7 days old',
  },
  week: {
    label: 'This Week',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    icon: Flame,
    desc: '7–14 days old',
  },
}

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'velocity', label: 'Fastest', icon: Zap },
  { id: 'newest',   label: 'Newest',  icon: Sparkles },
  { id: 'votes',    label: 'Most Voted', icon: Vote },
  { id: 'argued',   label: 'Most Argued', icon: MessageSquare },
] as const

type SortMode = (typeof SORT_OPTIONS)[number]['id']

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Economics:   'text-gold        border-gold/40        bg-gold/10',
  Politics:    'text-for-400     border-for-500/40     bg-for-500/10',
  Technology:  'text-purple      border-purple/40      bg-purple/10',
  Science:     'text-emerald     border-emerald/40     bg-emerald/10',
  Ethics:      'text-amber-400   border-amber-500/40   bg-amber-500/10',
  Philosophy:  'text-purple      border-purple/40      bg-purple/10',
  Culture:     'text-against-400 border-against-500/40 bg-against-500/10',
  Health:      'text-emerald     border-emerald/40     bg-emerald/10',
  Environment: 'text-emerald     border-emerald/40     bg-emerald/10',
  Education:   'text-gold        border-gold/40        bg-gold/10',
}

function catClass(cat: string | null): string {
  return CAT_COLORS[cat ?? ''] ?? 'text-surface-500 border-surface-400 bg-surface-300/40'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(hours: number): string {
  if (hours < 1)  return `${Math.round(hours * 60)}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatVelocity(vph: number): string {
  if (vph < 0.1)  return '<0.1/h'
  if (vph < 1)    return `${vph.toFixed(1)}/h`
  if (vph < 100)  return `${Math.round(vph)}/h`
  return `${(vph / 1000).toFixed(1)}k/h`
}

// ─── Fresh topic card ─────────────────────────────────────────────────────────

function FreshCard({ topic, rank }: { topic: FreshTopic; rank: number }) {
  const tier = AGE_TIER_CONFIG[topic.age_tier]
  const TierIcon = tier.icon
  const forPct = Math.round(topic.blue_pct)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(rank * 0.04, 0.5) }}
    >
      <Link href={`/topic/${topic.id}`}>
        <div className={cn(
          'relative rounded-xl border p-4 transition-all cursor-pointer group overflow-hidden',
          'bg-surface-200/60 hover:bg-surface-200 border-surface-300/60 hover:border-surface-400/60',
        )}>
          {/* Subtle new-topic shimmer for brand-new debates */}
          {topic.age_tier === 'new' && (
            <div className="absolute inset-0 bg-emerald/3 pointer-events-none rounded-xl" />
          )}

          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Rank circle */}
            <span className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-mono mt-0.5',
              rank === 1 ? 'bg-gold/20 text-gold border border-gold/40' :
              rank === 2 ? 'bg-surface-400/40 text-surface-600 border border-surface-400/40' :
              rank === 3 ? 'bg-amber-900/30 text-amber-500 border border-amber-700/40' :
                           'bg-surface-300/40 text-surface-500 border border-surface-300/40',
            )}>
              {rank}
            </span>

            {/* Statement + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                {topic.statement}
              </p>

              {/* Category + status + scope row */}
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {topic.category && (
                  <span className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                    catClass(topic.category),
                  )}>
                    {topic.category}
                  </span>
                )}
                {topic.scope && (
                  <span className="text-[10px] text-surface-500 font-mono">
                    {topic.scope}
                  </span>
                )}
                <Badge
                  variant={topic.status as 'proposed' | 'active' | 'voting' | 'law' | 'failed'}
                  size="sm"
                />
              </div>
            </div>

            {/* Age tier badge */}
            <div className={cn(
              'flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold',
              tier.bg, tier.border, tier.color,
            )}>
              <TierIcon className="w-3 h-3" />
              <span className="hidden sm:inline">{tier.label}</span>
            </div>
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Velocity */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-for-500/30 bg-for-600/10 text-[11px] font-mono font-semibold text-for-300">
              <Zap className="w-3 h-3" />
              <span>{formatVelocity(topic.votes_per_hour)}</span>
            </div>

            {/* Age */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-surface-400/40 bg-surface-300/30 text-[11px] font-mono text-surface-500">
              <Clock className="w-3 h-3" />
              <span>{formatAge(topic.age_hours)}</span>
            </div>

            {/* Arguments */}
            {topic.arg_count > 0 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-purple/30 bg-purple/10 text-[11px] font-mono font-semibold text-purple">
                <MessageSquare className="w-3 h-3" />
                <span>{topic.arg_count} {topic.arg_count === 1 ? 'arg' : 'args'}</span>
              </div>
            )}

            {/* Total votes */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-surface-400/40 bg-surface-300/30 text-[11px] font-mono text-surface-500">
              <Vote className="w-3 h-3" />
              <span>{topic.total_votes.toLocaleString()}</span>
            </div>

            {/* FOR / AGAINST split */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-for-400">{forPct}%</span>
              <div className="w-16 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-against-400">{100 - forPct}%</span>
            </div>
          </div>

          <ArrowRight className="absolute right-4 top-4 w-3.5 h-3.5 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function FreshCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300/60 bg-surface-200/40 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-6 h-6 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-2/5" />
        </div>
        <Skeleton className="w-16 h-6 rounded-lg flex-shrink-0" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-16 rounded-md" />
        <Skeleton className="h-5 w-14 rounded-md" />
        <Skeleton className="h-5 w-12 rounded-md" />
      </div>
    </div>
  )
}

// ─── Stat strip ───────────────────────────────────────────────────────────────

function StatStrip({ total, tierCounts }: {
  total: number
  tierCounts: Record<string, number>
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
      {(
        [
          { tier: 'new',    count: tierCounts.new    ?? 0 },
          { tier: 'fresh',  count: tierCounts.fresh  ?? 0 },
          { tier: 'recent', count: tierCounts.recent ?? 0 },
          { tier: 'week',   count: tierCounts.week   ?? 0 },
        ] as const
      ).map(({ tier, count }) => {
        const cfg = AGE_TIER_CONFIG[tier]
        const TierIcon = cfg.icon
        return (
          <div
            key={tier}
            className={cn(
              'flex items-center gap-2 p-2.5 rounded-lg border text-xs',
              cfg.bg, cfg.border,
            )}
          >
            <TierIcon className={cn('w-3.5 h-3.5 flex-shrink-0', cfg.color)} />
            <div className="min-w-0">
              <p className={cn('font-bold text-sm leading-none', cfg.color)}>{count}</p>
              <p className="text-[10px] text-surface-500 mt-0.5 truncate">{cfg.label} · {cfg.desc}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const PAGE_SIZE = 20

export function FreshClient() {
  const [data,        setData]        = useState<FreshTopicsResponse | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,       setError]       = useState(false)
  const [category,    setCategory]    = useState<string>('all')
  const [sort,        setSort]        = useState<SortMode>('velocity')
  const [ageTierFilter, setAgeTierFilter] = useState<FreshTopic['age_tier'] | 'all'>('all')
  const [topics,      setTopics]      = useState<FreshTopic[]>([])
  const [offset,      setOffset]      = useState(0)
  const [total,       setTotal]       = useState(0)

  const buildUrl = useCallback((off: number, cat: string, s: SortMode) => {
    const params = new URLSearchParams({
      sort:   s,
      limit:  String(PAGE_SIZE),
      offset: String(off),
    })
    if (cat !== 'all') params.set('category', cat)
    return `/api/topics/fresh?${params}`
  }, [])

  const load = useCallback(async (cat = category, s = sort) => {
    setLoading(true)
    setError(false)
    setOffset(0)
    setTopics([])
    try {
      const res = await fetch(buildUrl(0, cat, s))
      if (!res.ok) throw new Error('fetch')
      const json = (await res.json()) as FreshTopicsResponse
      setData(json)
      setTopics(json.topics)
      setTotal(json.total)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [category, sort, buildUrl])

  const loadMore = useCallback(async () => {
    const newOffset = offset + PAGE_SIZE
    setLoadingMore(true)
    try {
      const res = await fetch(buildUrl(newOffset, category, sort))
      if (!res.ok) throw new Error('fetch')
      const json = (await res.json()) as FreshTopicsResponse
      setTopics((prev) => [...prev, ...json.topics])
      setOffset(newOffset)
    } catch {
      // silent — user can try again
    } finally {
      setLoadingMore(false)
    }
  }, [offset, category, sort, buildUrl])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCategory(cat: string) {
    setCategory(cat)
    setAgeTierFilter('all')
    load(cat, sort)
  }

  function handleSort(s: SortMode) {
    setSort(s)
    load(category, s)
  }

  // Local age-tier filter (client-side, no refetch needed)
  const displayed = ageTierFilter === 'all'
    ? topics
    : topics.filter((t) => t.age_tier === ageTierFilter)

  const tierCounts: Record<string, number> = {}
  for (const t of topics) {
    tierCounts[t.age_tier] = (tierCounts[t.age_tier] ?? 0) + 1
  }

  const hasMore = offset + PAGE_SIZE < total

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="py-6">
          <div className="flex items-center gap-2.5 mb-1">
            <Sparkles className="w-5 h-5 text-emerald" />
            <h1 className="text-xl font-bold text-white tracking-tight">
              Fresh Debates
            </h1>
          </div>
          <p className="text-sm text-surface-500 leading-relaxed">
            Topics less than two weeks old, ranked by early engagement
            velocity. Your vote carries extra weight when consensus is still forming.
          </p>
        </div>

        {/* ── Sort bar ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          {SORT_OPTIONS.map(({ id, label, icon: Icon }) => {
            const active = sort === id
            return (
              <button
                key={id}
                onClick={() => handleSort(id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all',
                  active
                    ? 'bg-emerald/15 border-emerald/50 text-emerald'
                    : 'bg-transparent border-surface-400/50 text-surface-500 hover:text-white hover:border-surface-400',
                )}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            )
          })}

          <button
            onClick={() => load()}
            disabled={loading}
            aria-label="Refresh fresh topics"
            className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-surface-400/50 text-surface-500 hover:text-white hover:border-surface-400 text-xs font-semibold transition-all disabled:opacity-40"
          >
            <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Category pills ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4 overflow-x-auto pb-1">
          {['all', ...CATEGORIES].map((cat) => {
            const active = category === cat
            return (
              <button
                key={cat}
                onClick={() => handleCategory(cat)}
                className={cn(
                  'flex-shrink-0 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all',
                  active
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-transparent border-surface-400/40 text-surface-500 hover:text-white hover:border-surface-400',
                )}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            )
          })}
        </div>

        {/* ── Age-tier filter ───────────────────────────────────────────────── */}
        {!loading && !error && topics.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {([
              { id: 'all',    label: 'All Ages',    count: topics.length },
              { id: 'new',    label: 'New (<24h)',   count: tierCounts.new    ?? 0 },
              { id: 'fresh',  label: 'Fresh (1–3d)', count: tierCounts.fresh  ?? 0 },
              { id: 'recent', label: 'Recent (3–7d)',count: tierCounts.recent ?? 0 },
              { id: 'week',   label: 'Week (7–14d)', count: tierCounts.week   ?? 0 },
            ] as const).map(({ id, label, count }) => {
              if (id !== 'all' && count === 0) return null
              const active = ageTierFilter === id
              const cfg = id !== 'all' ? AGE_TIER_CONFIG[id] : null
              return (
                <button
                  key={id}
                  onClick={() => setAgeTierFilter(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all',
                    active && cfg
                      ? cn(cfg.bg, cfg.border, cfg.color)
                      : active
                        ? 'bg-surface-300 border-surface-400 text-white'
                        : 'bg-transparent border-surface-400/40 text-surface-500 hover:text-white hover:border-surface-400',
                  )}
                >
                  {label}
                  <span className={cn(
                    'text-[10px] font-mono',
                    active ? 'opacity-80' : 'opacity-50',
                  )}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Stat strip ────────────────────────────────────────────────────── */}
        {!loading && !error && topics.length > 0 && (
          <StatStrip total={total} tierCounts={tierCounts} />
        )}

        {/* ── Content ───────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="skeletons"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <FreshCardSkeleton key={i} />
              ))}
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={<Sparkles className="w-8 h-8 text-surface-500" />}
                title="Couldn't load fresh topics"
                description="Check back in a moment."
                action={{ label: 'Retry', onClick: () => load() }}
              />
            </motion.div>
          )}

          {!loading && !error && displayed.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={<BarChart2 className="w-8 h-8 text-surface-500" />}
                title="No fresh debates found"
                description={
                  category !== 'all'
                    ? `No recent topics in ${category}. Try a different category or check back soon.`
                    : ageTierFilter !== 'all'
                      ? `No ${AGE_TIER_CONFIG[ageTierFilter].label.toLowerCase()} topics right now.`
                      : 'No topics in the last 14 days. Check back soon!'
                }
                action={
                  category !== 'all' || ageTierFilter !== 'all'
                    ? {
                        label: 'Show all',
                        onClick: () => {
                          setAgeTierFilter('all')
                          handleCategory('all')
                        },
                      }
                    : undefined
                }
              />
            </motion.div>
          )}

          {!loading && !error && displayed.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {displayed.map((topic, i) => (
                <FreshCard key={topic.id} topic={topic} rank={i + 1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Load more ─────────────────────────────────────────────────────── */}
        {!loading && !error && hasMore && ageTierFilter === 'all' && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all',
                'bg-surface-200 border-surface-300 text-surface-400',
                'hover:bg-surface-300 hover:border-surface-400 hover:text-white',
                'disabled:opacity-50',
              )}
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loadingMore ? 'Loading…' : `Load more (${total - topics.length} remaining)`}
            </button>
          </div>
        )}

        {/* ── Explainer ─────────────────────────────────────────────────────── */}
        {!loading && !error && topics.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 rounded-xl border border-surface-300/60 bg-surface-200/40 p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-surface-500" />
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wide">
                Why vote on fresh topics?
              </p>
            </div>
            <div className="space-y-1.5 text-xs text-surface-500 leading-relaxed">
              <p>
                <span className="text-emerald font-semibold">New debates ({'<'}24h)</span>{' '}
                are the most malleable — consensus hasn&apos;t formed yet and every vote
                has maximum statistical weight on the final outcome.
              </p>
              <p>
                <span className="text-for-400 font-semibold">Fresh topics (1–3d)</span>{' '}
                have a small early signal but the outcome is still wide open. Your
                argument here can anchor others&apos; reasoning.
              </p>
              <p>
                <span className="text-purple font-semibold">Recent debates (3–7d)</span>{' '}
                are developing a pattern but strong FOR or AGAINST arguments can still
                shift the trajectory meaningfully.
              </p>
              <p className="text-surface-600 pt-1">
                Topics are ranked by{' '}
                <span className="text-white font-semibold">votes per hour</span> by default
                — measuring how quickly a new debate is attracting civic attention.
                Only topics with at least 3 votes are shown.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Related pages ─────────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {[
            { href: '/frontier',    label: 'Frontier',    icon: Rocket,    desc: 'Just proposed'         },
            { href: '/traction',    label: 'Traction',    icon: TrendingUp,desc: 'Building momentum'     },
            { href: '/trending',    label: 'Trending',    icon: Flame,     desc: 'All-time popular'      },
            { href: '/groundswell', label: 'Groundswell', icon: Zap,       desc: 'Vote revival spikes'   },
          ].map(({ href, label, icon: Icon, desc }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-surface-300/60 bg-surface-200/40 hover:bg-surface-200 hover:border-surface-400/60 transition-all group"
            >
              <Icon className="w-4 h-4 text-surface-500 group-hover:text-white transition-colors" />
              <div>
                <p className="text-xs font-semibold text-surface-400 group-hover:text-white transition-colors">
                  {label}
                </p>
                <p className="text-[10px] text-surface-600">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
