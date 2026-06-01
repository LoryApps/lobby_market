'use client'

/**
 * /entropy — Civic Entropy Index
 *
 * Applies Shannon information entropy to binary vote splits.
 * H(p) = -p·log₂(p) - (1-p)·log₂(1-p), normalised to [0, 1].
 *
 * A topic at 50/50 has maximum entropy (1 bit = 1.0).
 * A topic at 100/0 has zero entropy — no uncertainty, no disorder.
 *
 * The composite entropy_score weights raw entropy by log-vote volume,
 * so topics with genuine mass disagreement rank highest — not just obscure
 * topics where a handful of people split randomly.
 *
 * Distinct from:
 *   /equilibrium  — snapshot of current stability (favours balanced new topics)
 *   /volatility   — rate of consensus change over time
 *   /tipping-point — topics NEAR the consensus threshold (75% / 25%)
 *   /flashpoint   — the single hottest topic right now (not entropy-scored)
 *   /inertia      — high consensus + high engagement (opposite of entropy)
 *   /uncertainty  — probabilistic outcome forecast, not vote-split entropy
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
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
  Music2,
  RefreshCw,
  Scale,
  Shuffle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  EntropyTopic,
  EntropyTier,
  CategoryEntropy,
  EntropyStats,
  EntropyResponse,
} from '@/app/api/entropy/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  EntropyTier,
  { label: string; desc: string; color: string; bg: string; border: string; bar: string }
> = {
  schism: {
    label: 'Schism',
    desc: 'Maximum entropy. The community is almost perfectly split.',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    bar: 'bg-against-500',
  },
  discord: {
    label: 'Discord',
    desc: 'Highly contested. No clear direction is forming.',
    color: 'text-amber-300',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    bar: 'bg-amber-500',
  },
  contest: {
    label: 'Contest',
    desc: 'Genuine disagreement. Both sides are well-represented.',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    bar: 'bg-purple',
  },
  lean: {
    label: 'Lean',
    desc: 'A direction is forming, but the debate is not settled.',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-400',
  },
  resolve: {
    label: 'Resolve',
    desc: 'Clear majority opinion. Low entropy — strong consensus.',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
  },
}

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_ICON: Record<string, typeof Scale> = {
  Politics:    Landmark,
  Economics:   Activity,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

// ─── Entropy arc SVG ─────────────────────────────────────────────────────────
// A small semicircular "gauge" showing the entropy value

function EntropyGauge({ entropy, tier }: { entropy: number; tier: EntropyTier }) {
  const cfg = TIER_CONFIG[tier]
  const pct = Math.round(entropy * 100)
  // SVG arc from 180° to (180° - angle) where angle = entropy * 180
  const R = 22
  const CX = 28
  const CY = 28
  const startAngle = Math.PI   // 9 o'clock (left)
  const endAngle   = Math.PI - entropy * Math.PI  // sweeps to top for max

  const sx = CX + R * Math.cos(startAngle)
  const sy = CY + R * Math.sin(startAngle)
  const ex = CX + R * Math.cos(endAngle)
  const ey = CY + R * Math.sin(endAngle)
  const largeArc = entropy > 0.5 ? 1 : 0

  const arcColor =
    tier === 'schism'  ? '#ef4444' :
    tier === 'discord' ? '#f59e0b' :
    tier === 'contest' ? '#8b5cf6' :
    tier === 'lean'    ? '#3b82f6' :
                         '#10b981'

  return (
    <div className="relative flex flex-col items-center">
      <svg width="56" height="34" viewBox="0 0 56 34" className="overflow-visible">
        {/* Track */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#1e2030"
          strokeWidth="5"
          strokeLinecap="round"
        />
        {/* Active arc */}
        {entropy > 0.01 && (
          <path
            d={`M ${sx} ${sy} A ${R} ${R} 0 ${largeArc} 1 ${ex} ${ey}`}
            fill="none"
            stroke={arcColor}
            strokeWidth="5"
            strokeLinecap="round"
          />
        )}
      </svg>
      <span className={cn('text-[11px] font-mono font-bold leading-none -mt-1', cfg.color)}>
        {pct}%
      </span>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, idx }: { topic: EntropyTopic; idx: number }) {
  const cfg = TIER_CONFIG[topic.tier]
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(idx * 0.03, 0.5) }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group flex items-start gap-4 p-4 rounded-2xl border transition-all',
          'hover:border-surface-400/80 hover:bg-surface-200/60',
          cfg.border, 'bg-surface-100/60',
        )}
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-7 text-right">
          <span className="text-xs font-mono text-surface-500">#{idx + 1}</span>
        </div>

        {/* Entropy gauge */}
        <div className="flex-shrink-0 pt-1">
          <EntropyGauge entropy={topic.entropy} tier={topic.tier} />
        </div>

        {/* Statement + meta */}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
            {topic.statement}
          </p>

          {/* Tier pill + category */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border',
                cfg.bg, cfg.border, cfg.color,
              )}
            >
              {cfg.label}
            </span>
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500">
                {topic.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
            {topic.total_arguments > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <MessageSquare className="h-2.5 w-2.5" />
                {topic.total_arguments}
              </span>
            )}
          </div>

          {/* Vote bar */}
          <div className="space-y-1">
            <div className="flex h-1.5 rounded-full overflow-hidden bg-surface-300">
              <div
                className="h-full bg-for-500 rounded-l-full transition-all"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-500 rounded-r-full transition-all"
                style={{ width: `${againstPct}%` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] font-mono text-for-400">{forPct}% For</span>
              <span className="text-[10px] font-mono text-surface-500">
                {topic.consensus_gap.toFixed(1)}pp from 50/50
              </span>
              <span className="text-[10px] font-mono text-against-400">{againstPct}% Against</span>
            </div>
          </div>
        </div>

        <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TopicRowSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl border border-surface-300 bg-surface-100/60">
      <Skeleton className="w-7 h-4 mt-1" />
      <Skeleton className="w-14 h-8 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-1.5">
          <Skeleton className="h-4 w-16 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-full" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  )
}

// ─── Stats header ─────────────────────────────────────────────────────────────

function StatsHeader({ stats, loading }: { stats: EntropyStats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
    )
  }

  const entropyPct = Math.round(stats.platform_entropy * 100)

  const cells = [
    {
      label: 'Platform Entropy',
      value: `${entropyPct}%`,
      sub: 'avg across all topics',
      color: entropyPct >= 60 ? 'text-against-300' : entropyPct >= 40 ? 'text-amber-300' : 'text-emerald',
    },
    {
      label: 'Schism Topics',
      value: stats.schism_count.toString(),
      sub: 'maximum disagreement',
      color: 'text-against-300',
    },
    {
      label: 'Avg Split Gap',
      value: `${stats.avg_consensus_gap.toFixed(1)}pp`,
      sub: 'from 50/50 balance',
      color: stats.avg_consensus_gap < 15 ? 'text-amber-300' : 'text-for-300',
    },
    {
      label: 'Topics Scored',
      value: stats.total_topics.toLocaleString(),
      sub: 'with ≥10 votes',
      color: 'text-surface-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {cells.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-4"
        >
          <p className="text-xs font-mono text-surface-500 mb-1">{c.label}</p>
          <p className={cn('text-2xl font-mono font-bold', c.color)}>{c.value}</p>
          <p className="text-[10px] font-mono text-surface-600 mt-0.5">{c.sub}</p>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  cats,
  active,
  onSelect,
}: {
  cats: CategoryEntropy[]
  active: string | null
  onSelect: (c: string | null) => void
}) {
  if (cats.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-3 h-7 rounded-full text-xs font-mono border transition-colors',
          active === null
            ? 'bg-surface-300 border-surface-400 text-white'
            : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
        )}
      >
        All
      </button>
      {cats.map((cat) => {
        const Icon = CAT_ICON[cat.category] ?? Scale
        return (
          <button
            key={cat.category}
            onClick={() => onSelect(active === cat.category ? null : cat.category)}
            className={cn(
              'flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-mono border transition-colors',
              active === cat.category
                ? 'bg-surface-300 border-surface-400 text-white'
                : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
            )}
          >
            <Icon className={cn('h-3 w-3', active === cat.category ? 'text-white' : 'text-surface-500')} />
            {cat.category}
            <span className={cn('opacity-50', active === cat.category ? 'opacity-60' : '')}>
              {cat.schism_count > 0 ? `${cat.schism_count}⚡` : cat.topic_count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Tier distribution bar ────────────────────────────────────────────────────

function TierDistribution({ stats }: { stats: EntropyStats }) {
  const total = stats.total_topics
  if (total === 0) return null

  const tiers: Array<{ key: EntropyTier; count: number }> = [
    { key: 'schism',  count: stats.schism_count },
    { key: 'discord', count: stats.discord_count },
    { key: 'contest', count: stats.contest_count },
    { key: 'lean',    count: stats.lean_count },
    { key: 'resolve', count: stats.resolve_count },
  ]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 mb-6">
      <p className="text-xs font-mono text-surface-500 mb-3">Tier distribution</p>
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {tiers.map(({ key, count }) => {
          const pct = (count / total) * 100
          if (pct < 1) return null
          const cfg = TIER_CONFIG[key]
          return (
            <div
              key={key}
              title={`${cfg.label}: ${count} topics (${Math.round(pct)}%)`}
              className={cn('h-full transition-all', cfg.bar)}
              style={{ width: `${pct}%` }}
            />
          )
        })}
      </div>
      <div className="flex flex-wrap gap-3 mt-2.5">
        {tiers.map(({ key, count }) => {
          const cfg = TIER_CONFIG[key]
          return (
            <span key={key} className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
              <span className={cn('inline-block h-2 w-2 rounded-sm', cfg.bar)} />
              {cfg.label} ({count})
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SortKey = 'score' | 'entropy' | 'votes' | 'gap'

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'score',   label: 'Entropy score' },
  { key: 'entropy', label: 'Raw entropy' },
  { key: 'votes',   label: 'Vote count' },
  { key: 'gap',     label: 'Closest to 50/50' },
]

export function EntropyClient() {
  const [data, setData] = useState<EntropyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [sort, setSort] = useState<SortKey>('score')
  const [category, setCategory] = useState<string | null>(null)
  const [tierFilter, setTierFilter] = useState<EntropyTier | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (s: SortKey, cat: string | null, tf: EntropyTier | null) => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ sort: s, limit: '40' })
      if (cat) params.set('category', cat)
      if (tf)  params.set('tier', tf)
      const res = await fetch(`/api/entropy?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json: EntropyResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(sort, category, tierFilter)
  }, [load, sort, category, tierFilter])

  // Close sort menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    timerRef.current = setTimeout(() => load(sort, category, tierFilter), 5 * 60_000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [load, sort, category, tierFilter])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
                <Shuffle className="h-4.5 w-4.5 text-against-400" />
              </div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Entropy
              </h1>
            </div>
            <p className="text-sm font-mono text-surface-500 ml-11">
              Maximum disorder · maximum democracy
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowInfo((v) => !v)}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
                showInfo
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              )}
              aria-label="About entropy"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => load(sort, category, tierFilter)}
              disabled={loading}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Info panel ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-4 mb-6 space-y-2"
            >
              <p className="text-xs font-mono text-surface-400 leading-relaxed">
                <strong className="text-white">Shannon entropy</strong> measures how uncertain
                a binary outcome is. At 50/50, you can predict nothing — entropy is maximum (1.0).
                At 100/0, you know exactly what will happen — entropy is zero.
              </p>
              <p className="text-xs font-mono text-surface-500 leading-relaxed">
                The <strong className="text-surface-300">entropy score</strong> multiplies raw
                entropy by a log-volume weight so topics with high turnout rank above low-traffic
                50/50 splits. These are the debates where democratic disagreement is sharpest and
                most consequential.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {(Object.entries(TIER_CONFIG) as Array<[EntropyTier, typeof TIER_CONFIG[EntropyTier]]>).map(([key, cfg]) => (
                  <span
                    key={key}
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border',
                      cfg.bg, cfg.border, cfg.color,
                    )}
                  >
                    {cfg.label}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <StatsHeader stats={data?.stats ?? null} loading={loading} />

        {/* ── Tier distribution ──────────────────────────────────────────── */}
        {!loading && data && <TierDistribution stats={data.stats} />}

        {/* ── Controls ───────────────────────────────────────────────────── */}
        {!loading && data && (
          <>
            <CategoryBar
              cats={data.categories}
              active={category}
              onSelect={setCategory}
            />

            {/* Tier filter chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {(Object.entries(TIER_CONFIG) as Array<[EntropyTier, typeof TIER_CONFIG[EntropyTier]]>).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setTierFilter(tierFilter === key ? null : key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-mono border transition-colors',
                    tierFilter === key
                      ? cn(cfg.bg, cfg.border, cfg.color)
                      : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            {/* Sort control */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono text-surface-500">
                {data.topics.length} topic{data.topics.length !== 1 ? 's' : ''}
                {category ? ` in ${category}` : ''}
                {tierFilter ? ` · ${TIER_CONFIG[tierFilter].label}` : ''}
              </p>
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setShowSortMenu((v) => !v)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 h-7 rounded-lg border text-xs font-mono transition-colors',
                    showSortMenu
                      ? 'bg-surface-300 border-surface-400 text-white'
                      : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {SORT_OPTIONS.find((o) => o.key === sort)?.label ?? 'Sort'}
                  <ChevronDown className="h-3 w-3" />
                </button>
                <AnimatePresence>
                  {showSortMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 z-20 min-w-[160px] rounded-xl border border-surface-300 bg-surface-100 shadow-lg overflow-hidden"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => { setSort(opt.key); setShowSortMenu(false) }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-xs font-mono transition-colors text-left',
                            sort === opt.key
                              ? 'bg-surface-200 text-white'
                              : 'text-surface-400 hover:bg-surface-200 hover:text-white',
                          )}
                        >
                          {sort === opt.key && <Zap className="h-3 w-3 text-for-400 flex-shrink-0" />}
                          {opt.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}

        {/* ── Topic list ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <TopicRowSkeleton key={i} />)}
          </div>
        ) : error ? (
          <EmptyState
            icon={Activity}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="Entropy unavailable"
            description="Could not load entropy data. Try refreshing."
            actions={[{ label: 'Retry', onClick: () => load(sort, category, tierFilter) }]}
          />
        ) : !data || data.topics.length === 0 ? (
          <EmptyState
            icon={Shuffle}
            iconColor="text-surface-400"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title="No topics found"
            description={category || tierFilter ? 'Try a different filter.' : 'No topics with ≥10 votes yet.'}
            actions={
              category || tierFilter
                ? [{ label: 'Clear filters', onClick: () => { setCategory(null); setTierFilter(null) } }]
                : [{ label: 'View feed', href: '/' }]
            }
          />
        ) : (
          <div className="space-y-3">
            {data.topics.map((topic, i) => (
              <TopicRow key={topic.id} topic={topic} idx={i} />
            ))}

            {/* Category insights panel */}
            {data.categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-6 rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
              >
                <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
                  Entropy by category
                </p>
                {data.categories.slice(0, 6).map((cat) => {
                  const Icon = CAT_ICON[cat.category] ?? Scale
                  const entropyPct = Math.round(cat.avg_entropy * 100)
                  return (
                    <div key={cat.category} className="flex items-center gap-3">
                      <Icon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-surface-300">{cat.category}</span>
                          <span className="text-[10px] font-mono text-surface-500">{entropyPct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              entropyPct >= 70 ? 'bg-against-500' :
                              entropyPct >= 50 ? 'bg-amber-500' :
                              entropyPct >= 30 ? 'bg-purple' : 'bg-for-500'
                            )}
                            style={{ width: `${entropyPct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-surface-600 flex-shrink-0 w-16 text-right truncate">
                        {cat.schism_count > 0 ? `${cat.schism_count} schism` : `${cat.topic_count} topics`}
                      </span>
                    </div>
                  )
                })}

                {/* Cross-links to related pages */}
                <div className="pt-2 border-t border-surface-300 flex flex-wrap gap-2">
                  <Link
                    href="/inertia"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" />
                    Inertia Index
                  </Link>
                  <Link
                    href="/equilibrium"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" />
                    Equilibrium
                  </Link>
                  <Link
                    href="/tipping-point"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" />
                    Tipping Point
                  </Link>
                  <Link
                    href="/volatility"
                    className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" />
                    Volatility
                  </Link>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ── Last updated ───────────────────────────────────────────────── */}
        {data && !loading && (
          <p className="text-center text-[10px] font-mono text-surface-600 mt-6">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
