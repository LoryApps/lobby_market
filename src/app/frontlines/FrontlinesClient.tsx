'use client'

/**
 * /frontlines — The Civic Frontlines
 *
 * A live battle map of every contested debate on Lobby Market — sorted by how
 * close the vote is right now. The narrower the margin, the hotter the
 * frontline.
 *
 * Three tiers:
 *   Battle Zone  (±5%)  — a single vote could genuinely shift momentum
 *   Contested    (±15%) — still actively fought, majority not secured
 *   Leaning      (±25%) — majority emerging, but not yet decisive
 *
 * Distinct from:
 *   /triage    — ranked by urgency/deadline
 *   /seismic   — ranked by anomalous vote bursts
 *   /surge     — ranked by raw velocity
 *   /canary    — early-warning signals
 *   /signals   — broad platform dashboard
 *   /heat      — composite heat score
 *
 * The Frontlines answers: "Where does MY vote matter most right now?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Filter,
  Flame,
  Globe,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  FrontlineTopic,
  FrontlinesResponse,
} from '@/app/api/frontlines/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',        bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',         bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { text: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300',    bg: 'bg-against-600/10',   border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',         bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { text: 'text-gold',           bg: 'bg-gold/10',          border: 'border-gold/30' },
  Health:      { text: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',        bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',        bg: 'bg-for-600/10',       border: 'border-for-500/20' },
}
function categoryColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }
}

const TIER_CONFIG = {
  'battle-zone': {
    label: 'Battle Zone',
    sub: 'Within ±5% of 50/50',
    icon: Swords,
    iconColor: 'text-against-400',
    bg: 'bg-against-600/5',
    border: 'border-against-500/20',
    headerBorder: 'border-against-500/30',
    dot: 'bg-against-500 animate-pulse',
    accent: 'text-against-400',
    description: 'A single vote shifts momentum. Every voice is decisive.',
  },
  'contested': {
    label: 'Contested',
    sub: '±5–15% margin',
    icon: Scale,
    iconColor: 'text-gold',
    bg: 'bg-gold/5',
    border: 'border-gold/20',
    headerBorder: 'border-gold/30',
    dot: 'bg-gold',
    accent: 'text-gold',
    description: 'No majority secured. The outcome is still wide open.',
  },
  'leaning': {
    label: 'Leaning',
    sub: '±15–25% margin',
    icon: TrendingUp,
    iconColor: 'text-for-400',
    bg: 'bg-for-500/5',
    border: 'border-for-500/20',
    headerBorder: 'border-for-500/30',
    dot: 'bg-for-400',
    accent: 'text-for-400',
    description: 'Majority emerging but not yet decisive. Still in play.',
  },
}

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  accent,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  accent: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className={cn('text-2xl font-mono font-bold', accent)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <div className="text-xs font-mono text-surface-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function TopicCard({ topic }: { topic: FrontlineTopic }) {
  const catColor = categoryColor(topic.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-surface-300 bg-surface-100 overflow-hidden hover:border-surface-400 transition-all"
    >
      {/* ── Vote split bar ────────────────────────────────────────────────── */}
      <div className="flex h-1.5">
        <div
          className="bg-for-500 transition-all"
          style={{ width: `${topic.blue_pct}%` }}
        />
        <div
          className="bg-against-500 transition-all"
          style={{ width: `${topic.red_pct}%` }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* ── Split display ──────────────────────────────────────────── */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1 w-14">
            <div className="flex items-center gap-0.5">
              <ThumbsUp className="h-2.5 w-2.5 text-for-400" />
              <span className="font-mono text-xs font-bold text-for-400">
                {topic.blue_pct}%
              </span>
            </div>
            <div className="relative w-10 h-1 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-for-500 rounded-full"
                style={{ width: `${topic.blue_pct}%` }}
              />
            </div>
            <div className="flex items-center gap-0.5">
              <ThumbsDown className="h-2.5 w-2.5 text-against-400" />
              <span className="font-mono text-xs font-bold text-against-400">
                {topic.red_pct}%
              </span>
            </div>
          </div>

          {/* ── Topic info ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <Link href={`/topic/${topic.id}`}>
              <p className="text-sm font-mono font-semibold text-white leading-snug mb-2 line-clamp-2 group-hover:text-for-300 transition-colors">
                {topic.statement}
              </p>
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {topic.category && (
                <span
                  className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                    catColor.text, catColor.bg, catColor.border
                  )}
                >
                  {topic.category}
                </span>
              )}

              <span className="text-[10px] font-mono text-surface-500">
                {formatVotes(topic.total_votes)} votes
              </span>

              {topic.status === 'voting' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple/10 border border-purple/30 text-[10px] font-mono text-purple font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple animate-pulse" />
                  VOTING
                </span>
              )}

              {topic.scope && topic.scope !== 'Global' && (
                <span className="text-[10px] font-mono text-surface-600">
                  {topic.scope}
                </span>
              )}
            </div>
          </div>

          {/* ── Margin + CTA ───────────────────────────────────────────── */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <div className={cn(
              'text-lg font-mono font-bold leading-none',
              topic.margin <= 5 ? 'text-against-400' :
              topic.margin <= 15 ? 'text-gold' :
              'text-for-400'
            )}>
              ±{topic.margin}%
            </div>
            <div className="text-[10px] font-mono text-surface-600">margin</div>
            <Link
              href={`/topic/${topic.id}`}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-colors',
                topic.lean === 'blue'
                  ? 'bg-for-600/20 border border-for-500/40 text-for-300 hover:bg-for-600/30'
                  : topic.lean === 'red'
                  ? 'bg-against-600/20 border border-against-500/40 text-against-300 hover:bg-against-600/30'
                  : 'bg-purple/20 border border-purple/30 text-purple hover:bg-purple/30',
              )}
            >
              Vote
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* ── "Votes to tip" insight ─────────────────────────────────────── */}
        {topic.votes_needed > 0 && topic.votes_needed <= 50 && (
          <div className={cn(
            'mt-3 pt-3 border-t border-surface-300',
            'flex items-center gap-2 text-[11px] font-mono',
            topic.lean === 'blue' ? 'text-against-500' : 'text-for-500'
          )}>
            <Target className="h-3 w-3 flex-shrink-0" />
            <span>
              {topic.votes_needed === 1
                ? '1 vote could tip this debate'
                : `~${topic.votes_needed} votes on the trailing side would reach 50/50`}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function TierSection({
  tier,
  topics,
  defaultOpen = true,
  categoryFilter,
}: {
  tier: keyof typeof TIER_CONFIG
  topics: FrontlineTopic[]
  defaultOpen?: boolean
  categoryFilter: string | null
}) {
  const config = TIER_CONFIG[tier]
  const Icon = config.icon
  const [open, setOpen] = useState(defaultOpen)

  const filtered = categoryFilter
    ? topics.filter((t) => t.category === categoryFilter)
    : topics

  if (filtered.length === 0) return null

  return (
    <div className={cn('rounded-2xl border', config.bg, config.border)}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between px-5 py-4',
          'border-b', open ? config.headerBorder : 'border-transparent',
          'transition-colors'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('h-2 w-2 rounded-full', config.dot)} />
          <Icon className={cn('h-5 w-5', config.iconColor)} />
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className={cn('font-mono text-base font-bold', config.accent)}>
                {config.label}
              </span>
              <span className={cn(
                'inline-flex items-center justify-center h-5 min-w-[20px] px-1.5',
                'rounded-full text-[10px] font-mono font-bold',
                config.accent, config.bg, 'border', config.border
              )}>
                {filtered.length}
              </span>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              {config.sub} · {config.description}
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-surface-500" />
          : <ChevronDown className="h-4 w-4 text-surface-500" />
        }
      </button>

      {/* Topics */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 grid grid-cols-1 gap-3">
              {filtered.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function LoadingSkeletons() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-12 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      {[6, 4, 3].map((n, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: n }).map((_, j) => (
            <div key={j} className="rounded-xl border border-surface-300 bg-surface-200 p-4">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mb-3" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FrontlinesClient() {
  const [data, setData] = useState<FrontlinesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'margin' | 'votes'>('margin')
  const [showCatBreakdown, setShowCatBreakdown] = useState(false)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/frontlines', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: FrontlinesResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load the frontlines. Try refreshing.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    refreshRef.current = setInterval(() => load(true), 60_000)
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current)
    }
  }, [load])

  // Apply sort to each tier if sortMode === 'votes'
  function sortTopics(topics: FrontlineTopic[]): FrontlineTopic[] {
    if (sortMode === 'votes') return [...topics].sort((a, b) => b.total_votes - a.total_votes)
    return topics // already sorted by margin from API
  }

  const stats = data?.stats
  const totalContested = (stats?.battle_zone_count ?? 0) + (stats?.contested_count ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/trending"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Trending
          </Link>

          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-600/10 border border-against-500/30">
                <Swords className="h-6 w-6 text-against-400" />
              </div>
              <div>
                <h1 className="font-mono text-3xl font-bold text-white">The Frontlines</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Where your vote matters most right now
                </p>
              </div>
            </div>

            <button
              onClick={() => load(false)}
              disabled={loading}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            >
              {loading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
              Refresh
            </button>
          </div>

          <p className="text-sm font-mono text-surface-500 leading-relaxed max-w-xl">
            Every debate sorted by how close the vote is right now. Battle Zone debates are
            within ±5% of 50/50 — a handful of votes could shift the entire outcome.
          </p>
        </div>

        {loading && <LoadingSkeletons />}

        {!loading && error && (
          <EmptyState
            icon={Scale}
            title="Couldn't load the frontlines"
            description={error}
            actions={[{ label: 'Retry', onClick: () => load() }]}
          />
        )}

        {!loading && !error && data && (
          <div className="space-y-6">

            {/* ── Stats strip ───────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="In Battle Zone"
                value={stats!.battle_zone_count}
                sub="±5% of 50/50"
                icon={Swords}
                iconColor="text-against-400"
                accent="text-against-400"
              />
              <StatCard
                label="Contested"
                value={totalContested}
                sub="Majority not secured"
                icon={Scale}
                iconColor="text-gold"
                accent="text-gold"
              />
              <StatCard
                label="Narrowest Margin"
                value={`±${stats!.narrowest_margin}%`}
                sub="Closest to 50/50"
                icon={Target}
                iconColor="text-emerald"
                accent="text-emerald"
              />
              <StatCard
                label="Votes at Stake"
                value={formatVotes(stats!.total_votes_at_stake)}
                sub="Across all frontlines"
                icon={BarChart2}
                iconColor="text-for-400"
                accent="text-for-400"
              />
            </div>

            {/* ── Filters ───────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-surface-600 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3" />
                Filter:
              </span>

              <button
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                  categoryFilter === null
                    ? 'bg-surface-300 text-white border-surface-400'
                    : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-white'
                )}
              >
                All
              </button>

              {CATEGORIES.filter((c) => {
                const bk = data.category_breakdown.find((b) => b.category === c)
                return bk && (bk.battle_zone + bk.contested + bk.leaning) > 0
              }).map((cat) => {
                const cc = categoryColor(cat)
                const active = categoryFilter === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(active ? null : cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                      active
                        ? cn(cc.text, cc.bg, cc.border)
                        : 'bg-surface-100 text-surface-500 border-surface-300 hover:border-surface-400 hover:text-white'
                    )}
                  >
                    {cat}
                  </button>
                )
              })}

              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-xs font-mono text-surface-600">Sort:</span>
                {(['margin', 'votes'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSortMode(mode)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-mono transition-colors',
                      sortMode === mode
                        ? 'bg-surface-300 text-white'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    {mode === 'margin' ? 'Closest' : 'Most voted'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Empty state when filter yields nothing ─────────────────── */}
            {categoryFilter && (
              data.battle_zone.filter((t) => t.category === categoryFilter).length === 0 &&
              data.contested.filter((t) => t.category === categoryFilter).length === 0 &&
              data.leaning.filter((t) => t.category === categoryFilter).length === 0
            ) && (
              <EmptyState
                icon={Scale}
                title={`No contested ${categoryFilter} debates right now`}
                description="All debates in this category have a clear majority. Try another category."
                actions={[{ label: 'Show all', onClick: () => setCategoryFilter(null) }]}
              />
            )}

            {/* ── Tier sections ─────────────────────────────────────────── */}
            <TierSection
              tier="battle-zone"
              topics={sortTopics(data.battle_zone)}
              defaultOpen
              categoryFilter={categoryFilter}
            />
            <TierSection
              tier="contested"
              topics={sortTopics(data.contested)}
              defaultOpen
              categoryFilter={categoryFilter}
            />
            <TierSection
              tier="leaning"
              topics={sortTopics(data.leaning)}
              defaultOpen={false}
              categoryFilter={categoryFilter}
            />

            {/* ── Category breakdown ─────────────────────────────────────── */}
            {data.category_breakdown.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100">
                <button
                  onClick={() => setShowCatBreakdown((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 border-b border-surface-300"
                >
                  <div className="flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-for-400" />
                    <span className="font-mono text-sm font-semibold text-white">
                      Category breakdown
                    </span>
                  </div>
                  {showCatBreakdown
                    ? <ChevronUp className="h-4 w-4 text-surface-500" />
                    : <ChevronDown className="h-4 w-4 text-surface-500" />
                  }
                </button>

                <AnimatePresence initial={false}>
                  {showCatBreakdown && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-2">
                        {data.category_breakdown.map((cat) => {
                          const cc = categoryColor(cat.category)
                          const total = cat.battle_zone + cat.contested + cat.leaning
                          if (total === 0) return null
                          return (
                            <button
                              key={cat.category}
                              onClick={() => setCategoryFilter(
                                categoryFilter === cat.category ? null : cat.category
                              )}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                                categoryFilter === cat.category
                                  ? cn(cc.bg, cc.border, 'border')
                                  : 'hover:bg-surface-200 border border-transparent'
                              )}
                            >
                              <span className={cn('font-mono text-sm font-semibold w-24 flex-shrink-0', cc.text)}>
                                {cat.category}
                              </span>
                              <div className="flex-1 flex items-center gap-2">
                                {cat.battle_zone > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-against-400">
                                    <Swords className="h-2.5 w-2.5" />
                                    {cat.battle_zone}
                                  </span>
                                )}
                                {cat.contested > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gold">
                                    <Scale className="h-2.5 w-2.5" />
                                    {cat.contested}
                                  </span>
                                )}
                                {cat.leaning > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-for-400">
                                    <TrendingUp className="h-2.5 w-2.5" />
                                    {cat.leaning}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-mono text-surface-500">
                                avg ±{cat.avg_margin}%
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-surface-600" />
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── "How it works" explainer ────────────────────────────────── */}
            <div className="rounded-2xl border border-surface-300/50 bg-surface-100/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-for-400" />
                <span className="font-mono text-sm font-semibold text-white">How it works</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono text-surface-500 leading-relaxed">
                <div>
                  <span className="text-against-400 font-semibold">Battle Zone (±5%)</span>
                  <p className="mt-1">The vote split is within 5 percentage points of 50/50. No side has a majority. A small number of votes could genuinely change which way this tips.</p>
                </div>
                <div>
                  <span className="text-gold font-semibold">Contested (±15%)</span>
                  <p className="mt-1">One side has a slight edge, but no secure majority. The debate is still actively fought and the outcome is uncertain.</p>
                </div>
                <div>
                  <span className="text-for-400 font-semibold">Leaning (±25%)</span>
                  <p className="mt-1">A majority is emerging. The direction is clear, but the consensus required for a Law (67%) hasn&apos;t been reached. Momentum is building.</p>
                </div>
              </div>
            </div>

            {/* ── Related links ────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2">
              {[
                { href: '/triage',  label: 'Triage',   icon: Flame },
                { href: '/seismic', label: 'Seismic',  icon: Zap },
                { href: '/canary',  label: 'Canary',   icon: TrendingUp },
                { href: '/surge',   label: 'Surge',    icon: TrendingUp },
                { href: '/signals', label: 'Signals',  icon: BarChart2 },
                { href: '/map',     label: 'Map View', icon: Globe },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              ))}
            </div>

            {data.updated_at && (
              <p className="text-[10px] font-mono text-surface-600 text-center">
                Updated {new Date(data.updated_at).toLocaleTimeString()} · Auto-refreshes every 60s
              </p>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
