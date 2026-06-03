'use client'

/**
 * /overton — The Overton Window
 *
 * The Overton Window is a political science concept describing the range of
 * policy ideas the mainstream community finds acceptable. Policies inside
 * the window attract genuine debate; those outside it — whether near-
 * universally accepted or rejected — have left the zone of live controversy.
 *
 * On Lobby Market every topic vote is a signal of where that policy sits
 * within the community's window. This page maps the full distribution:
 *
 *   EXTREME AGAINST (<10%)  — rejected by near-consensus
 *   AGAINST CONSENSUS (10–20%)  — strong community opposition
 *   LEANING AGAINST (20–30%)    — sceptical mainstream
 *   ┌─────── MAINSTREAM (30–70%) ─────────┐
 *   │  Genuinely contested live debate     │
 *   └──────────────────────────────────────┘
 *   LEANING FOR (70–80%)        — broadly favoured
 *   FOR CONSENSUS (80–90%)      — strong community agreement
 *   EXTREME FOR (>90%)          — accepted by near-consensus
 *
 * Distinct from:
 *   /polarization  — how divided the community is overall
 *   /spectrum      — scatter of consensus × engagement
 *   /consensus     — which topics are reaching resolution
 *   /convergence   — momentum toward agreement on individual topics
 *   /divergence    — week-over-week opinion swings
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gavel,
  RefreshCw,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar }    from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn }        from '@/lib/utils/cn'
import type {
  OvertonsResponse,
  OvertonsWindowTopic,
  OvertonsZone,
  CategoryWindow,
} from '@/app/api/overton/route'

// ─── Zone config ──────────────────────────────────────────────────────────────

interface ZoneConfig {
  label: string
  short: string
  color: string
  bg: string
  border: string
  barColor: string
  description: string
}

const ZONE_CONFIG: Record<OvertonsZone, ZoneConfig> = {
  extreme_against: {
    label: 'Extreme Against',
    short: 'Extreme',
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    barColor: 'bg-against-600',
    description: 'Near-universal rejection — outside any reasonable window',
  },
  consensus_against: {
    label: 'Consensus Against',
    short: 'Against',
    color: 'text-against-400',
    bg: 'bg-against-500/15',
    border: 'border-against-500/30',
    barColor: 'bg-against-500',
    description: 'Strong community opposition — well outside the mainstream',
  },
  leaning_against: {
    label: 'Leaning Against',
    short: 'Leans Against',
    color: 'text-against-300',
    bg: 'bg-against-500/8',
    border: 'border-against-500/20',
    barColor: 'bg-against-400',
    description: 'Sceptical mainstream — the fringe of the window',
  },
  mainstream: {
    label: 'Inside the Window',
    short: 'Mainstream',
    color: 'text-white',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    barColor: 'bg-for-500',
    description: 'Genuinely contested — both sides have substantial standing',
  },
  leaning_for: {
    label: 'Leaning For',
    short: 'Leans For',
    color: 'text-for-300',
    bg: 'bg-for-500/8',
    border: 'border-for-500/20',
    barColor: 'bg-for-400',
    description: 'Broadly favoured — the leading edge of the window',
  },
  consensus_for: {
    label: 'Consensus For',
    short: 'For',
    color: 'text-emerald',
    bg: 'bg-emerald/15',
    border: 'border-emerald/30',
    barColor: 'bg-emerald',
    description: 'Strong community agreement — approaching universal acceptance',
  },
  extreme_for: {
    label: 'Extreme For',
    short: 'Extreme',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    barColor: 'bg-gold',
    description: 'Near-universal acceptance — beyond debate',
  },
}

const ZONES_LEFT_TO_RIGHT: OvertonsZone[] = [
  'extreme_against',
  'consensus_against',
  'leaning_against',
  'mainstream',
  'leaning_for',
  'consensus_for',
  'extreme_for',
]

// ─── Category color map ───────────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Politics:    'bg-for-500/20 text-for-300 border-for-500/30',
  Economics:   'bg-gold/20 text-gold border-gold/30',
  Technology:  'bg-purple/20 text-purple border-purple/30',
  Science:     'bg-emerald/20 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/20 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/20 text-purple border-purple/30',
  Culture:     'bg-against-400/20 text-against-300 border-against-400/30',
  Health:      'bg-emerald/20 text-emerald border-emerald/30',
  Environment: 'bg-emerald/20 text-emerald border-emerald/30',
  Education:   'bg-gold/20 text-gold border-gold/30',
}

function catColor(cat: string | null) {
  return cat ? (CAT_COLORS[cat] ?? 'bg-surface-300/40 text-surface-500 border-surface-400/30') : ''
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    proposed: 'bg-surface-500',
    active: 'bg-for-500',
    voting: 'bg-purple',
    law: 'bg-gold',
    failed: 'bg-against-500',
  }
  return (
    <span
      className={cn('inline-block w-1.5 h-1.5 rounded-full flex-shrink-0', colors[status] ?? 'bg-surface-500')}
    />
  )
}

function TopicRow({
  topic,
  rank,
}: {
  topic: OvertonsWindowTopic
  rank?: number
}) {
  const cfg = ZONE_CONFIG[topic.zone]
  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all hover:border-surface-400/60',
        'bg-surface-100/60 border-surface-300/60 hover:bg-surface-200/60 group'
      )}
    >
      {rank !== undefined && (
        <span className="text-[10px] font-mono text-surface-500 w-4 flex-shrink-0 text-right">
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-700 group-hover:text-white transition-colors truncate leading-snug">
          {topic.statement}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <StatusDot status={topic.status} />
          {topic.category && (
            <span
              className={cn(
                'text-[9px] font-semibold px-1.5 py-0.5 rounded-md border uppercase tracking-wide',
                catColor(topic.category)
              )}
            >
              {topic.category}
            </span>
          )}
          <span className="text-[9px] font-mono text-surface-500 ml-auto flex-shrink-0">
            {topic.total_votes.toLocaleString()} votes
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 w-12">
        <span className={cn('text-sm font-bold font-mono tabular-nums', cfg.color)}>
          {topic.blue_pct}%
        </span>
        <div className="w-full h-1 bg-surface-300 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full', cfg.barColor)}
            style={{ width: `${topic.blue_pct}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

function StatCard({
  label,
  value,
  sub,
  color = 'text-white',
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-3.5 text-center">
      <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
      {sub && <p className="text-[10px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── The visual Overton Window bar ────────────────────────────────────────────

function OvertonsWindowBar({
  center,
  drift,
}: {
  center: number
  drift: number | null
}) {
  // The bar spans 0–100 (representing FOR%)
  // The "window" is shaded between 30–70%
  // The center dot is placed at `center`%
  return (
    <div className="relative">
      {/* Labels */}
      <div className="flex justify-between text-[9px] font-mono text-surface-500 mb-1 px-0.5">
        <span>0% FOR ← AGAINST</span>
        <span>50% CENTER</span>
        <span>FOR → 100%</span>
      </div>

      {/* Main bar */}
      <div className="relative h-8 rounded-xl overflow-hidden bg-surface-300/40 border border-surface-400/30">
        {/* Extreme against (0–10%) */}
        <div className="absolute inset-y-0 left-0 bg-against-600/25" style={{ width: '10%' }} />
        {/* Consensus against (10–20%) */}
        <div className="absolute inset-y-0 bg-against-500/20" style={{ left: '10%', width: '10%' }} />
        {/* Leaning against (20–30%) */}
        <div className="absolute inset-y-0 bg-against-400/12" style={{ left: '20%', width: '10%' }} />
        {/* The Overton Window (30–70%) */}
        <div className="absolute inset-y-0 bg-for-500/15 border-x border-for-500/30" style={{ left: '30%', width: '40%' }} />
        {/* Leaning for (70–80%) */}
        <div className="absolute inset-y-0 bg-for-400/12" style={{ left: '70%', width: '10%' }} />
        {/* Consensus for (80–90%) */}
        <div className="absolute inset-y-0 bg-emerald/20" style={{ left: '80%', width: '10%' }} />
        {/* Extreme for (90–100%) */}
        <div className="absolute inset-y-0 right-0 bg-gold/25" style={{ width: '10%', left: '90%' }} />

        {/* Zone labels */}
        <div className="absolute inset-0 flex items-center pointer-events-none">
          <span className="text-[8px] font-mono text-against-400/60 w-[10%] text-center">✕</span>
          <span className="text-[8px] font-mono text-against-400/60 w-[10%] text-center">✕✕</span>
          <span className="text-[8px] font-mono text-against-400/40 w-[10%] text-center">~</span>
          <span className="text-[8px] font-semibold text-for-400/80 w-[40%] text-center tracking-widest uppercase">
            The Window
          </span>
          <span className="text-[8px] font-mono text-for-300/40 w-[10%] text-center">~</span>
          <span className="text-[8px] font-mono text-emerald/60 w-[10%] text-center">✓✓</span>
          <span className="text-[8px] font-mono text-gold/60 w-[10%] text-center">✓</span>
        </div>

        {/* Center-of-gravity marker */}
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${center}%` }}
          transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          className="absolute inset-y-0 w-0.5 bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.5)]"
          style={{ transform: 'translateX(-50%)' }}
        />

        {/* Drift arrow */}
        {drift !== null && Math.abs(drift) >= 0.5 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={cn(
              'absolute inset-y-0 flex items-center',
              drift > 0 ? 'text-for-400' : 'text-against-400'
            )}
            style={{
              left: `${center}%`,
              transform: drift > 0 ? 'translateX(4px)' : 'translateX(calc(-100% - 4px))',
            }}
          >
            {drift > 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />}
          </motion.div>
        )}
      </div>

      {/* Center % label */}
      <div
        className="absolute -bottom-5 text-[9px] font-mono text-surface-500"
        style={{ left: `${center}%`, transform: 'translateX(-50%)' }}
      >
        {center.toFixed(1)}%
      </div>
    </div>
  )
}

// ─── Category leans chart ─────────────────────────────────────────────────────

function CategoryLeanBar({ cat }: { cat: CategoryWindow }) {
  const lean = cat.lean
  const isFor = lean > 0
  const barWidth = Math.min(Math.abs(lean) * 2, 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-surface-600 w-24 flex-shrink-0 truncate">{cat.category}</span>
      <div className="flex-1 flex items-center gap-1">
        {/* Against side */}
        <div className="flex-1 flex justify-end h-2">
          {!isFor && (
            <div
              className="h-full rounded-l bg-against-500/60"
              style={{ width: `${barWidth}%` }}
            />
          )}
        </div>
        {/* Center line */}
        <div className="w-px h-3 bg-surface-400 flex-shrink-0" />
        {/* For side */}
        <div className="flex-1 flex justify-start h-2">
          {isFor && (
            <div
              className="h-full rounded-r bg-for-500/60"
              style={{ width: `${barWidth}%` }}
            />
          )}
        </div>
      </div>
      <span
        className={cn(
          'text-[10px] font-mono w-12 text-right flex-shrink-0',
          isFor ? 'text-for-400' : lean < 0 ? 'text-against-400' : 'text-surface-500'
        )}
      >
        {lean > 0 ? '+' : ''}{lean.toFixed(1)}
      </span>
      <span className="text-[9px] text-surface-600 w-8 flex-shrink-0 text-right">{cat.topic_count}</span>
    </div>
  )
}

// ─── Zone section ─────────────────────────────────────────────────────────────

function ZoneSection({
  zone,
  topics,
  defaultOpen = false,
}: {
  zone: OvertonsZone
  topics: OvertonsWindowTopic[]
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const cfg = ZONE_CONFIG[zone]

  if (topics.length === 0) return null

  return (
    <div className={cn('rounded-xl border overflow-hidden', cfg.border)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
          cfg.bg,
          'hover:bg-surface-200/40'
        )}
      >
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-semibold', cfg.color)}>{cfg.label}</span>
          <span
            className={cn(
              'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
              cfg.bg,
              cfg.border,
              cfg.color
            )}
          >
            {topics.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-surface-500 hidden sm:block">{cfg.description}</span>
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 text-surface-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-surface-500" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-1.5 bg-surface-100/30">
              {topics.slice(0, 30).map((t, i) => (
                <TopicRow key={t.id} topic={t} rank={i + 1} />
              ))}
              {topics.length > 30 && (
                <p className="text-center text-[10px] text-surface-500 pt-1">
                  +{topics.length - 30} more topics
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OvertonsWindowPage() {
  const [data, setData] = useState<OvertonsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const loadedAt = useRef<string | null>(null)

  const load = useCallback(async (bust = false) => {
    try {
      setRefreshing(true)
      const url = bust ? `/api/overton?t=${Date.now()}` : '/api/overton'
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch_error')
      const json = (await res.json()) as OvertonsResponse
      setData(json)
      loadedAt.current = json.generated_at
    } catch {
      setError('Failed to load Overton Window data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const topicsToShow = data
    ? activeCategory
      ? data.topics.filter((t) => t.category === activeCategory)
      : data.topics
    : []

  const topicsByZone = ZONES_LEFT_TO_RIGHT.reduce<Record<OvertonsZone, OvertonsWindowTopic[]>>(
    (acc, z) => {
      acc[z] = topicsToShow.filter((t) => t.zone === z)
      return acc
    },
    {} as Record<OvertonsZone, OvertonsWindowTopic[]>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-white mb-3 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Home
            </Link>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
                <Scale className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">The Overton Window</h1>
                <p className="text-xs text-surface-500">The range of civic positions the community finds acceptable</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh data"
            className={cn(
              'p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-all mt-8',
              refreshing && 'animate-spin opacity-50'
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-200/50 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-16">
            <p className="text-against-400 text-sm mb-3">{error}</p>
            <button onClick={() => load(true)} className="text-xs text-for-400 hover:text-for-300 underline">
              Try again
            </button>
          </div>
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* The Window visualisation */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-for-400" />
                  Window Position
                </h2>
                {data.stats.drift_7d !== null && (
                  <div
                    className={cn(
                      'flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded-lg border',
                      data.stats.drift_7d > 0
                        ? 'text-for-400 bg-for-500/10 border-for-500/20'
                        : data.stats.drift_7d < 0
                        ? 'text-against-400 bg-against-500/10 border-against-500/20'
                        : 'text-surface-500 bg-surface-200 border-surface-400'
                    )}
                  >
                    {data.stats.drift_7d > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : data.stats.drift_7d < 0 ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : null}
                    {data.stats.drift_7d > 0 ? '+' : ''}
                    {data.stats.drift_7d.toFixed(1)}pp 7d drift
                  </div>
                )}
              </div>

              <div className="mb-8">
                <OvertonsWindowBar
                  center={data.stats.window_center}
                  drift={data.stats.drift_7d}
                />
              </div>

              <p className="text-[11px] text-surface-500 leading-relaxed mt-4">
                The white line marks the community&apos;s centre of gravity — the vote-weighted average
                FOR% across all {data.stats.total_topics.toLocaleString()} active topics
                (minimum 10 votes). Topics inside the shaded band (30–70%) are genuinely contested
                civic debates. Topics outside it have reached a form of consensus — either widely
                accepted or widely rejected.
              </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatCard
                label="Inside Window"
                value={data.stats.mainstream_count}
                sub={`${Math.round((data.stats.mainstream_count / Math.max(1, data.stats.total_topics)) * 100)}% of topics`}
                color="text-for-300"
              />
              <StatCard
                label="Leaning"
                value={data.stats.leaning_count}
                sub="edge of window"
                color="text-surface-600"
              />
              <StatCard
                label="Consensus"
                value={data.stats.consensus_count}
                sub="strong agreement"
                color="text-emerald"
              />
              <StatCard
                label="Extreme"
                value={data.stats.extreme_count}
                sub="beyond debate"
                color="text-gold"
              />
            </div>

            {/* Window width */}
            <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Window Width (σ)</p>
                <p className="text-xl font-bold text-white mt-0.5">{data.stats.window_width.toFixed(1)}pp</p>
                <p className="text-[10px] text-surface-500 mt-0.5">
                  {data.stats.window_width < 15
                    ? 'Narrow window — unusually high civic agreement'
                    : data.stats.window_width < 22
                    ? 'Moderate window — healthy pluralism'
                    : 'Wide window — highly diverse civic positions'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-mono uppercase tracking-wider text-surface-500">Center</p>
                <p className={cn(
                  'text-xl font-bold mt-0.5',
                  data.stats.window_center > 55 ? 'text-for-400'
                  : data.stats.window_center < 45 ? 'text-against-400'
                  : 'text-white'
                )}>
                  {data.stats.window_center.toFixed(1)}%
                </p>
                <p className="text-[10px] text-surface-500 mt-0.5">
                  {data.stats.window_center > 55 ? 'skews FOR'
                   : data.stats.window_center < 45 ? 'skews AGAINST'
                   : 'near-neutral'}
                </p>
              </div>
            </div>

            {/* Spotlight topics */}
            {(data.stats.most_mainstream_topic || data.stats.most_extreme_topic) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {data.stats.most_mainstream_topic && (
                  <div className="rounded-xl bg-surface-100 border border-for-500/25 p-3.5">
                    <p className="text-[9px] font-mono uppercase tracking-wider text-for-400 mb-2 flex items-center gap-1">
                      <Scale className="w-3 h-3" />
                      Most Mainstream
                    </p>
                    <TopicRow topic={data.stats.most_mainstream_topic} />
                  </div>
                )}
                {data.stats.most_extreme_topic && (
                  <div className="rounded-xl bg-surface-100 border border-gold/25 p-3.5">
                    <p className="text-[9px] font-mono uppercase tracking-wider text-gold mb-2 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      Most Extreme
                    </p>
                    <TopicRow topic={data.stats.most_extreme_topic} />
                  </div>
                )}
              </div>
            )}

            {/* Category lean chart */}
            {data.category_breakdown.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-for-400" />
                  Category Leans
                </h2>
                <p className="text-[10px] text-surface-500 mb-4">
                  How each category&apos;s average FOR% deviates from the 50% midpoint.
                  Positive = leans FOR, negative = leans AGAINST.
                </p>
                <div className="space-y-2">
                  <div className="flex text-[9px] font-mono text-surface-500 gap-2 mb-1">
                    <span className="w-24 flex-shrink-0" />
                    <span className="flex-1 text-right text-against-400">← AGAINST</span>
                    <span className="w-px" />
                    <span className="flex-1 text-left text-for-400">FOR →</span>
                    <span className="w-12 text-right">lean</span>
                    <span className="w-8 text-right">n</span>
                  </div>
                  {data.category_breakdown.map((cat) => (
                    <CategoryLeanBar key={cat.category} cat={cat} />
                  ))}
                </div>
              </div>
            )}

            {/* Category filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  'flex-shrink-0 text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all',
                  activeCategory === null
                    ? 'bg-for-500/20 text-for-300 border-for-500/40'
                    : 'bg-surface-200/60 text-surface-500 border-surface-300/60 hover:text-white'
                )}
              >
                All
              </button>
              {data.category_breakdown.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => setActiveCategory(cat.category === activeCategory ? null : cat.category)}
                  className={cn(
                    'flex-shrink-0 text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all',
                    activeCategory === cat.category
                      ? 'bg-for-500/20 text-for-300 border-for-500/40'
                      : 'bg-surface-200/60 text-surface-500 border-surface-300/60 hover:text-white'
                  )}
                >
                  {cat.category}
                </button>
              ))}
            </div>

            {/* Topics by zone */}
            <div className="space-y-2.5">
              {ZONES_LEFT_TO_RIGHT.map((zone) => (
                <ZoneSection
                  key={zone}
                  zone={zone}
                  topics={topicsByZone[zone] ?? []}
                  defaultOpen={zone === 'mainstream'}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="rounded-xl bg-surface-100/60 border border-surface-300/40 px-4 py-3">
              <p className="text-[10px] text-surface-500 leading-relaxed">
                The <strong className="text-surface-600">Overton Window</strong> was introduced by political
                scientist Joseph P. Overton to describe the range of policy ideas the public will accept at a
                given moment. On Lobby Market, each active topic&apos;s FOR% vote split determines where it sits
                within the community&apos;s window of civic acceptability.
                Topics inside the window (30–70% FOR) attract genuine debate from both sides. Those outside
                it reflect a community that has largely made up its mind.
              </p>
              {loadedAt.current && (
                <p className="text-[9px] text-surface-600 mt-2">
                  Last computed: {new Date(loadedAt.current).toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Related tools */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { href: '/polarization', label: 'Polarization', icon: Scale },
                { href: '/spectrum', label: 'Civic Spectrum', icon: ArrowRight },
                { href: '/convergence', label: 'Convergence', icon: Gavel },
                { href: '/divergence', label: 'Divergence', icon: TrendingDown },
                { href: '/consensus', label: 'Consensus', icon: Sparkles },
                { href: '/schism', label: 'The Schism', icon: Zap },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200 transition-all text-xs text-surface-600 hover:text-white"
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 text-for-300" />
                  {label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
