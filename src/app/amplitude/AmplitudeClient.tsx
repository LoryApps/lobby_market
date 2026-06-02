'use client'

/**
 * /amplitude — The Civic Amplitude Index
 *
 * Measures the decisive force of community opinion. Amplitude = how far
 * the community has swung from a 50/50 deadlock, weighted by vote volume.
 *
 * A topic with high amplitude has reached an overwhelming majority verdict —
 * the community has spoken loudly and clearly. A topic with low amplitude is
 * still contested, either because opinion is genuinely split or because
 * too few citizens have weighed in.
 *
 * Amplitude score = sqrt(swing_strength × vote_weight) × 100
 *   swing_strength = |blue_pct − 50| / 50    (0 = deadlock, 1 = unanimous)
 *   vote_weight    = log(votes) / log(MAX)    (rewards high-volume mandates)
 *
 * Tiers:
 *   Peak    (≥80) — overwhelming mandate, near-unanimous verdict
 *   Ridge   (≥60) — strong consensus, decisive community position
 *   Hill    (≥40) — moderate amplitude, majority view visible
 *   Plateau (≥20) — low amplitude, opinion still forming
 *   Valley  (<20) — near-deadlock, genuinely divided community
 *
 * Distinct from:
 *   /inertia     — measures resistance to change (consensus × engagement)
 *   /equilibrium — snapshot of current consensus stability
 *   /volatility  — rate of change over time
 *   /momentum    — direction and speed of vote change
 *   /schism      — topics where opinion is most bitterly divided
 *   /gravity     — argument density relative to vote count
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
  Mountain,
  Music2,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Waves,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  AmplitudeTopic,
  AmplitudeTier,
  AmplitudeDirection,
  CategoryAmplitude,
  AmplitudeResponse,
} from '@/app/api/amplitude/route'

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
  Politics:    { text: 'text-for-400',    bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  Technology:  { text: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
  Science:     { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-for-300',    bg: 'bg-for-400/10',    border: 'border-for-400/30' },
  Culture:     { text: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30' },
  Health:      { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',    bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Education:   { text: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30' },
  Other:       { text: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-400/20' },
}

function catStyle(cat: string | null) {
  return CAT_COLOR[cat ?? 'Other'] ?? CAT_COLOR.Other
}
function catIcon(cat: string | null) {
  return CAT_ICON[cat ?? 'Other'] ?? Scale
}

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<AmplitudeTier, {
  label: string
  desc: string
  color: string
  bg: string
  border: string
  bar: string
  icon: string
}> = {
  peak: {
    label: 'Peak',
    desc: 'Overwhelming mandate — the community has spoken with near-unanimous force.',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    bar: 'bg-gold',
    icon: '⛰️',
  },
  ridge: {
    label: 'Ridge',
    desc: 'Strong consensus — a decisive community position backed by significant votes.',
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    bar: 'bg-for-400',
    icon: '🏔️',
  },
  hill: {
    label: 'Hill',
    desc: 'Moderate amplitude — a majority position is clear, but not overwhelming.',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    bar: 'bg-emerald',
    icon: '🌄',
  },
  plateau: {
    label: 'Plateau',
    desc: 'Low amplitude — opinion is still forming; the community hasn\'t committed.',
    color: 'text-surface-500',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/20',
    bar: 'bg-surface-500',
    icon: '🏜️',
  },
  valley: {
    label: 'Valley',
    desc: 'Near-deadlock — the community is genuinely divided on this issue.',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    bar: 'bg-against-500',
    icon: '🏞️',
  },
}

// ─── Direction config ─────────────────────────────────────────────────────────

const DIR_CONFIG: Record<AmplitudeDirection, {
  label: string
  icon: typeof ThumbsUp
  color: string
  bg: string
  border: string
}> = {
  for: {
    label: 'FOR',
    icon: ThumbsUp,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  against: {
    label: 'AGAINST',
    icon: ThumbsDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  contested: {
    label: 'CONTESTED',
    icon: Scale,
    color: 'text-surface-500',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/20',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500',
  active: 'text-for-400',
  voting: 'text-purple',
  law: 'text-gold',
  failed: 'text-against-400',
}

function Gauge({ score, tier }: { score: number; tier: AmplitudeTier }) {
  const cfg = TIER_CONFIG[tier]
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', cfg.bar)}
        />
      </div>
      <span className={cn('text-xs font-mono font-bold tabular-nums w-7 text-right', cfg.color)}>
        {score}
      </span>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  rank,
  expanded,
  onToggle,
}: {
  topic: AmplitudeTopic
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const tier = TIER_CONFIG[topic.tier]
  const dir = DIR_CONFIG[topic.direction]
  const DirIcon = dir.icon
  const catC = catStyle(topic.category)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.03, 0.5) }}
      className={cn(
        'rounded-2xl border overflow-hidden transition-colors',
        'bg-surface-100 border-surface-300',
        expanded && 'border-surface-400'
      )}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-surface-200/50 transition-colors"
        aria-expanded={expanded}
      >
        {/* Rank */}
        <span className="flex-shrink-0 text-xs font-mono text-surface-600 w-5 pt-0.5">
          {rank}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-mono text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            {topic.category && (
              <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', catC.text, catC.bg, catC.border)}>
                {topic.category}
              </span>
            )}
            <span className={cn('text-[10px] font-mono', STATUS_COLOR[topic.status] ?? 'text-surface-500')}>
              {STATUS_LABEL[topic.status] ?? topic.status}
            </span>
            <span className={cn('inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border', dir.color, dir.bg, dir.border)}>
              <DirIcon className="h-2.5 w-2.5" aria-hidden />
              {dir.label} {topic.dominant_pct.toFixed(0)}%
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              {topic.total_votes.toLocaleString()} votes
            </span>
          </div>

          {/* Amplitude bar */}
          <Gauge score={topic.amplitude_score} tier={topic.tier} />
        </div>

        {/* Tier badge */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-lg border', tier.color, tier.bg, tier.border)}>
            {tier.icon} {tier.label}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-surface-500 transition-transform',
              expanded && 'rotate-180'
            )}
            aria-hidden
          />
        </div>
      </button>

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
            <div className="px-4 pb-4 pt-1 border-t border-surface-300 space-y-3">
              {/* Tier description */}
              <p className="text-xs text-surface-500 font-mono">{tier.desc}</p>

              {/* Vote split visual */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-surface-600">
                  <span>FOR {topic.blue_pct.toFixed(1)}%</span>
                  <span>AGAINST {(100 - topic.blue_pct).toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden flex bg-surface-300">
                  <div
                    className="bg-for-500 transition-all"
                    style={{ width: `${topic.blue_pct}%` }}
                  />
                  <div className="flex-1 bg-against-500" />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-2 text-center">
                  <p className="text-[10px] text-surface-600 font-mono">Amplitude</p>
                  <p className={cn('text-sm font-bold font-mono', tier.color)}>{topic.amplitude_score}</p>
                </div>
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-2 text-center">
                  <p className="text-[10px] text-surface-600 font-mono">Swing</p>
                  <p className="text-sm font-bold font-mono text-white">±{topic.consensus_gap.toFixed(1)}pp</p>
                </div>
                <div className="rounded-xl bg-surface-200 border border-surface-300 p-2 text-center">
                  <p className="text-[10px] text-surface-600 font-mono">Votes</p>
                  <p className="text-sm font-bold font-mono text-white">{topic.total_votes.toLocaleString()}</p>
                </div>
              </div>

              <Link
                href={`/topic/${topic.id}`}
                className="inline-flex items-center gap-1 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View topic <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ cat }: { cat: CategoryAmplitude }) {
  const c = catStyle(cat.category)
  const Icon = catIcon(cat.category)
  const dir = DIR_CONFIG[cat.direction]

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', c.bg, c.border)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', c.text)} aria-hidden />
        <span className={cn('text-xs font-mono font-semibold', c.text)}>{cat.category}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-lg font-mono font-bold text-white">{cat.avg_score}</p>
          <p className="text-[10px] text-surface-600 font-mono">avg amplitude</p>
        </div>
        <div className="text-right">
          <p className={cn('text-xs font-mono font-semibold', dir.color)}>{dir.label}</p>
          <p className="text-[10px] text-surface-600 font-mono">{cat.topic_count} topics</p>
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-white' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-3 space-y-0.5">
      <p className="text-[10px] text-surface-600 font-mono uppercase tracking-wide">{label}</p>
      <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
      {sub && <p className="text-[10px] text-surface-600 font-mono">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type FilterTier = AmplitudeTier | 'all'
type FilterDir = AmplitudeDirection | 'all'

export function AmplitudeClient() {
  const [data, setData] = useState<AmplitudeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterTier, setFilterTier] = useState<FilterTier>('all')
  const [filterDir, setFilterDir] = useState<FilterDir>('all')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const fetchRef = useRef(0)

  const load = useCallback(async () => {
    const stamp = ++fetchRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/amplitude', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: AmplitudeResponse = await res.json()
      if (fetchRef.current === stamp) {
        setData(json)
        setLoading(false)
      }
    } catch (e) {
      if (fetchRef.current === stamp) {
        setError(e instanceof Error ? e.message : 'Failed to load')
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = (data?.topics ?? []).filter((t) => {
    if (filterTier !== 'all' && t.tier !== filterTier) return false
    if (filterDir !== 'all' && t.direction !== filterDir) return false
    if (filterCat !== 'all' && (t.category ?? 'Other') !== filterCat) return false
    return true
  })

  const stats = data?.stats
  const cats = data?.categories ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* ── Header ── */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Waves className="h-5 w-5 text-for-400" aria-hidden />
            <h1 className="text-xl font-bold font-mono text-white">Civic Amplitude Index</h1>
            <button
              onClick={() => setShowInfo(!showInfo)}
              aria-label="What is amplitude?"
              className="text-surface-600 hover:text-surface-400 transition-colors"
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <p className="text-sm text-surface-500 font-mono">
            How decisively has the community swung — and does volume back it up?
          </p>
        </div>

        {/* ── Info panel ── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3 text-xs font-mono text-surface-500">
                <p>
                  <strong className="text-white">Amplitude</strong> measures the decisive force of community opinion.
                  A topic with high amplitude has swung strongly FOR or AGAINST — and that swing is backed by significant vote volume.
                </p>
                <p>
                  <strong className="text-white">Score formula:</strong>{' '}
                  <code className="text-for-300">√(swing × volume) × 100</code>, where
                  swing = distance from 50/50 and volume = log-scaled vote count.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {(Object.entries(TIER_CONFIG) as [AmplitudeTier, typeof TIER_CONFIG.peak][]).map(([k, v]) => (
                    <div key={k} className={cn('rounded-lg border px-2 py-1.5', v.bg, v.border)}>
                      <p className={cn('font-bold', v.color)}>{v.icon} {v.label}</p>
                      <p className="text-[10px] leading-tight mt-0.5">{v.desc.split('—')[0].trim()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Platform stats ── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <StatCard label="Platform Amplitude" value={stats.platform_score} sub="out of 100" color="text-for-300" />
            <StatCard label="Peak Topics" value={stats.peak_count} sub="overwhelming mandate" color="text-gold" />
            <StatCard label="Valley Topics" value={stats.valley_count} sub="genuinely divided" color="text-against-400" />
            <StatCard label="FOR Leaning" value={stats.for_leaning} sub="tilting FOR" color="text-for-400" />
            <StatCard label="AGAINST Leaning" value={stats.against_leaning} sub="tilting AGAINST" color="text-against-400" />
            <StatCard label="Contested" value={stats.contested} sub="within 2pp of 50/50" />
          </div>
        ) : null}

        {/* ── Category heatmap ── */}
        {!loading && cats.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wide">
              Amplitude by Category
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {cats.slice(0, 9).map((c) => (
                <button
                  key={c.category}
                  onClick={() => setFilterCat(filterCat === c.category ? 'all' : c.category)}
                  className={cn(
                    'text-left transition-opacity',
                    filterCat !== 'all' && filterCat !== c.category && 'opacity-40'
                  )}
                  aria-pressed={filterCat === c.category}
                >
                  <CategoryCard cat={c} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters ── */}
        <div className="space-y-2">
          {/* Tier filter */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'peak', 'ridge', 'hill', 'plateau', 'valley'] as FilterTier[]).map((t) => {
              const cfg = t !== 'all' ? TIER_CONFIG[t] : null
              return (
                <button
                  key={t}
                  onClick={() => setFilterTier(t)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-all',
                    filterTier === t
                      ? cfg
                        ? cn(cfg.color, cfg.bg, cfg.border)
                        : 'bg-surface-300 text-white border-surface-400'
                      : 'text-surface-500 bg-surface-200 border-surface-300 hover:text-surface-700 hover:border-surface-400'
                  )}
                >
                  {t === 'all' ? 'All Tiers' : `${cfg?.icon} ${cfg?.label}`}
                </button>
              )
            })}
          </div>

          {/* Direction filter */}
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'for', 'against', 'contested'] as FilterDir[]).map((d) => {
              const cfg = d !== 'all' ? DIR_CONFIG[d] : null
              return (
                <button
                  key={d}
                  onClick={() => setFilterDir(d)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border transition-all',
                    filterDir === d
                      ? cfg
                        ? cn(cfg.color, cfg.bg, cfg.border)
                        : 'bg-surface-300 text-white border-surface-400'
                      : 'text-surface-500 bg-surface-200 border-surface-300 hover:text-surface-700 hover:border-surface-400'
                  )}
                >
                  {d === 'all' ? 'All Directions' : cfg?.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Topic list ── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-against-500/10 border border-against-500/20 text-against-400 text-sm font-mono">
            <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden />
            <span>{error}</span>
            <button
              onClick={load}
              className="ml-auto flex items-center gap-1 hover:text-against-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Mountain}
            title="No topics match"
            description="Try adjusting the tier or direction filters."
            size="md"
            actions={[{
              label: 'Clear filters',
              onClick: () => { setFilterTier('all'); setFilterDir('all'); setFilterCat('all') },
            }]}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-600 font-mono">
                {filtered.length} topic{filtered.length !== 1 ? 's' : ''} · sorted by amplitude
              </p>
              <button
                onClick={load}
                className="flex items-center gap-1 text-[11px] font-mono text-surface-600 hover:text-surface-400 transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Refresh
              </button>
            </div>

            <AnimatePresence mode="popLayout">
              {filtered.map((topic, i) => (
                <TopicRow
                  key={topic.id}
                  topic={topic}
                  rank={i + 1}
                  expanded={expandedId === topic.id}
                  onToggle={() => setExpandedId(expandedId === topic.id ? null : topic.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Related views ── */}
        {!loading && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wide">
              Related Perspectives
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { href: '/inertia',      label: 'Civic Inertia',      desc: 'Resistance to change' },
                { href: '/schism',       label: 'Civic Schism',       desc: 'Deepest divisions' },
                { href: '/equilibrium',  label: 'Equilibrium',        desc: 'Consensus stability' },
                { href: '/momentum',     label: 'Momentum',           desc: 'Direction & speed' },
                { href: '/volatility',   label: 'Volatility',         desc: 'Rate of change' },
                { href: '/gravity',      label: 'Civic Gravity',      desc: 'Argument density' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:bg-surface-300 hover:border-surface-400 transition-colors group"
                >
                  <div>
                    <p className="text-xs font-mono font-medium text-white">{link.label}</p>
                    <p className="text-[10px] font-mono text-surface-600">{link.desc}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden />
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
