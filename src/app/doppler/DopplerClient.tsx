'use client'

/**
 * /doppler — Civic Doppler
 *
 * A 2-D scatter plot placing every active topic in a velocity × direction space:
 *   X-axis  — vote velocity (how fast votes are coming in)
 *   Y-axis  — consensus direction (blue_pct shift over 7 days: FOR ↑, AGAINST ↓)
 *
 * Four quadrants:
 *   Top-right    LAUNCHING  — high velocity + gaining FOR support
 *   Bottom-right CRASHING   — high velocity + losing FOR support
 *   Top-left     DRIFTING ↑ — quiet but gradually moving FOR
 *   Bottom-left  DRIFTING ↓ — quiet but gradually moving AGAINST
 *   Centre       PARKED     — low velocity + stable
 *
 * Distinct from /trajectory (grouped trajectory sections), /momentum (ranked
 * velocity list), and /flux (biggest 24h consensus swings).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Info,
  Loader2,
  Minus,
  RefreshCw,
  Rocket,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DopplerResponse, DopplerTopic, DopplerQuadrant } from '@/app/api/doppler/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const QUADRANT_CONFIG: Record<
  DopplerQuadrant,
  {
    label: string
    icon: typeof Rocket
    color: string
    bg: string
    border: string
    description: string
  }
> = {
  launching: {
    label: 'Launching',
    icon: Rocket,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'High velocity + gaining FOR support',
  },
  crashing: {
    label: 'Crashing',
    icon: TrendingDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'High velocity + losing FOR support',
  },
  drifting_for: {
    label: 'Drifting FOR',
    icon: ArrowUpRight,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Quiet but gradually gaining FOR support',
  },
  drifting_against: {
    label: 'Drifting AGAINST',
    icon: ArrowDownRight,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    description: 'Quiet but gradually losing FOR support',
  },
  parked: {
    label: 'Parked',
    icon: Minus,
    color: 'text-surface-400',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    description: 'Low activity, stable consensus',
  },
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-surface-400',
  Philosophy:  'bg-surface-400',
  Culture:     'bg-amber-400',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-for-400',
}

function dotColor(topic: DopplerTopic): string {
  if (topic.blue_pct >= 65) return 'bg-for-500 border-for-600'
  if (topic.blue_pct <= 35) return 'bg-against-500 border-against-600'
  return 'bg-gold border-gold/80'
}

function dotBorderColor(topic: DopplerTopic): string {
  if (topic.blue_pct >= 65) return '#3b82f6'
  if (topic.blue_pct <= 35) return '#ef4444'
  return '#f59e0b'
}

function dotSize(topic: DopplerTopic): number {
  const minSize = 8
  const maxSize = 22
  const log = Math.log10(Math.max(1, topic.total_votes))
  const maxLog = Math.log10(10000)
  return minSize + ((log / maxLog) * (maxSize - minSize))
}

// ─── Scatter Plot ─────────────────────────────────────────────────────────────

interface PlotProps {
  topics: DopplerTopic[]
  onHover: (t: DopplerTopic | null) => void
  hovered: DopplerTopic | null
  filter: DopplerQuadrant | null
}

function ScatterPlot({ topics, onHover, hovered, filter }: PlotProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const visible = filter ? topics.filter((t) => t.quadrant === filter) : topics

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square rounded-2xl overflow-hidden bg-surface-100 border border-surface-300 select-none"
      onMouseLeave={() => onHover(null)}
    >
      {/* Quadrant grid lines */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Vertical centre line (velocity boundary) */}
        <div className="absolute top-0 bottom-0 left-[35%] w-px bg-surface-300/60" />
        {/* Horizontal centre line (direction boundary) */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-surface-300/60" />

        {/* Quadrant labels */}
        <span className="absolute top-2 right-3 text-[10px] font-mono text-for-500/70 uppercase tracking-wider">
          Launching ↗
        </span>
        <span className="absolute bottom-2 right-3 text-[10px] font-mono text-against-400/70 uppercase tracking-wider">
          Crashing ↘
        </span>
        <span className="absolute top-2 left-3 text-[10px] font-mono text-emerald/70 uppercase tracking-wider">
          Drifting ↑
        </span>
        <span className="absolute bottom-2 left-3 text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">
          Drifting ↓
        </span>

        {/* Axis labels */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1">
          <span className="text-[9px] font-mono text-surface-500">slow</span>
          <div className="w-16 h-px bg-surface-400/40" />
          <Zap className="h-2.5 w-2.5 text-surface-500" />
          <div className="w-16 h-px bg-surface-400/40" />
          <span className="text-[9px] font-mono text-surface-500">fast</span>
        </div>
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1" style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}>
          <span className="text-[9px] font-mono text-surface-500">← AGAINST</span>
          <div className="h-12 w-px bg-surface-400/40" />
          <TrendingUp className="h-2.5 w-2.5 text-surface-500" />
          <div className="h-12 w-px bg-surface-400/40" />
          <span className="text-[9px] font-mono text-surface-500">FOR →</span>
        </div>
      </div>

      {/* Dots */}
      {visible.map((topic) => {
        const size = dotSize(topic)
        const isHovered = hovered?.id === topic.id
        const dimmed = filter !== null && topic.quadrant !== filter

        return (
          <Link
            key={topic.id}
            href={`/topic/${topic.id}`}
            onMouseEnter={() => onHover(topic)}
            style={{
              position: 'absolute',
              left: `calc(${topic.x * 100}% - ${size / 2}px)`,
              top: `calc(${(1 - topic.y) * 100}% - ${size / 2}px)`,
              width: size,
              height: size,
            }}
            className={cn(
              'rounded-full border-2 transition-all duration-150 cursor-pointer z-10',
              dotColor(topic),
              isHovered ? 'scale-150 z-30 shadow-lg' : '',
              dimmed ? 'opacity-20' : 'opacity-90 hover:opacity-100'
            )}
          />
        )
      })}

      {/* Parked cluster label if many */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-[9px] font-mono text-surface-500/60">● Parked</span>
      </div>
    </div>
  )
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function TopicTooltip({ topic }: { topic: DopplerTopic }) {
  const cfg = QUADRANT_CONFIG[topic.quadrant]
  const Icon = cfg.icon
  const forPct = Math.round(topic.blue_pct)
  const velLabel = topic.velocity < 1
    ? '<1 vote/day'
    : `${Math.round(topic.velocity)} votes/day`
  const dirLabel = topic.direction > 0
    ? `+${topic.direction.toFixed(1)} pp FOR`
    : `${topic.direction.toFixed(1)} pp`

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="absolute top-4 right-4 z-50 max-w-xs bg-surface-200 border border-surface-300 rounded-xl p-3 shadow-xl pointer-events-none"
    >
      <div className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono mb-2 border', cfg.bg, cfg.color, cfg.border)}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </div>
      <p className="text-xs font-mono text-white leading-snug mb-2 line-clamp-3">
        {topic.statement}
      </p>
      <div className="flex gap-3 text-[10px] font-mono text-surface-400">
        <span>{forPct}% FOR</span>
        <span>{topic.total_votes.toLocaleString()} votes</span>
      </div>
      <div className="flex gap-3 text-[10px] font-mono text-surface-500 mt-0.5">
        <span>{velLabel}</span>
        <span className={topic.direction >= 0 ? 'text-for-400' : 'text-against-400'}>{dirLabel} / 7d</span>
      </div>
    </motion.div>
  )
}

// ─── Sidebar list ─────────────────────────────────────────────────────────────

function QuadrantList({ topics, quadrant }: { topics: DopplerTopic[]; quadrant: DopplerQuadrant | null }) {
  const filtered = quadrant
    ? topics.filter((t) => t.quadrant === quadrant).slice(0, 8)
    : [...topics].sort((a, b) => b.velocity - a.velocity).slice(0, 8)

  if (filtered.length === 0) {
    return (
      <p className="text-xs font-mono text-surface-500 py-4 text-center">No topics in this quadrant</p>
    )
  }

  return (
    <div className="space-y-2">
      {filtered.map((topic) => {
        const cfg = QUADRANT_CONFIG[topic.quadrant]
        return (
          <Link
            key={topic.id}
            href={`/topic/${topic.id}`}
            className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
          >
            <div className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', dotColor(topic).split(' ')[0])} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-white leading-snug line-clamp-2 group-hover:text-for-400 transition-colors">
                {topic.statement}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn('text-[10px] font-mono', cfg.color)}>{cfg.label}</span>
                <span className="text-[10px] font-mono text-surface-500">
                  {topic.velocity < 1 ? '<1' : Math.round(topic.velocity)} v/day
                </span>
                <span className={cn('text-[10px] font-mono', topic.direction >= 0 ? 'text-for-400' : 'text-against-400')}>
                  {topic.direction >= 0 ? '+' : ''}{topic.direction.toFixed(1)}pp
                </span>
              </div>
            </div>
            <ChevronRight className="h-3 w-3 text-surface-500 flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DopplerClient() {
  const [data, setData] = useState<DopplerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [hovered, setHovered] = useState<DopplerTopic | null>(null)
  const [filter, setFilter] = useState<DopplerQuadrant | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/doppler')
      if (!res.ok) throw new Error('fetch failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const topics = data?.topics ?? []
  const stats = data?.stats

  const QUADRANTS: DopplerQuadrant[] = ['launching', 'crashing', 'drifting_for', 'drifting_against', 'parked']
  const quadrantCounts = QUADRANTS.reduce<Record<string, number>>((acc, q) => {
    acc[q] = topics.filter((t) => t.quadrant === q).length
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-1">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-for-400" />
              <h1 className="text-xl font-mono font-bold text-white">Civic Doppler</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInfo((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
              >
                <Info className="h-3.5 w-3.5" />
                How it works
              </button>
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
          <p className="text-sm font-mono text-surface-400">
            Vote velocity vs. consensus direction — where is every active debate heading?
          </p>
        </div>

        {/* Info panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 overflow-hidden"
            >
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-xs font-mono text-surface-400 leading-relaxed">
                <p className="text-white font-semibold mb-2 text-sm">Reading the Doppler chart</p>
                <ul className="space-y-1.5 list-none">
                  <li><span className="text-for-400">X-axis (→)</span> — vote velocity: how many votes/day the topic is receiving over the last 3 days. Further right = more active.</li>
                  <li><span className="text-for-400">Y-axis (↑)</span> — consensus direction: how much the FOR% has shifted over 7 days. Higher = gaining FOR support. Lower = losing it.</li>
                  <li><span className="text-white">Dot size</span> — proportional to total vote count. Bigger = more debated.</li>
                  <li><span className="text-for-500">Blue dots</span> = strong FOR majority · <span className="text-against-400">Red</span> = strong AGAINST · <span className="text-gold">Gold</span> = contested (near 50/50).</li>
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading && (
          <div className="space-y-4">
            <Skeleton className="w-full aspect-square max-w-lg rounded-2xl" />
          </div>
        )}

        {!loading && error && (
          <EmptyState
            icon={Activity}
            title="Doppler offline"
            description="Could not load topic velocity data. Try refreshing."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && topics.length === 0 && (
          <EmptyState
            icon={Activity}
            title="No active debates"
            description="There are no active topics to display on the Doppler right now."
            action={{ label: 'Browse topics', href: '/topics' }}
          />
        )}

        {!loading && !error && topics.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Scatter plot */}
            <div className="lg:col-span-2 space-y-4">
              {/* Stats strip */}
              {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Analyzed', value: stats.total_analyzed, color: 'text-white' },
                    { label: 'Launching', value: stats.launching_count, color: 'text-for-400' },
                    { label: 'Crashing', value: stats.crashing_count, color: 'text-against-400' },
                    {
                      label: 'Net Trend',
                      value: `${stats.avg_direction >= 0 ? '+' : ''}${stats.avg_direction.toFixed(1)}pp`,
                      color: stats.avg_direction >= 0 ? 'text-for-400' : 'text-against-400',
                    },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-surface-100 border border-surface-300 px-3 py-2 text-center">
                      <p className={cn('text-lg font-mono font-bold', stat.color)}>{stat.value}</p>
                      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* The plot itself */}
              <div className="relative">
                <ScatterPlot
                  topics={topics}
                  onHover={setHovered}
                  hovered={hovered}
                  filter={filter}
                />
                <AnimatePresence>
                  {hovered && <TopicTooltip topic={hovered} />}
                </AnimatePresence>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono text-surface-500">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-for-500" /> FOR majority
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-against-500" /> AGAINST majority
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-gold" /> Contested (near 50/50)
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-surface-400/50" /> Larger = more votes
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Quadrant filters */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest mb-2.5">Filter by quadrant</p>
                <div className="space-y-1.5">
                  <button
                    onClick={() => setFilter(null)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition-colors',
                      filter === null
                        ? 'bg-surface-300 text-white'
                        : 'text-surface-400 hover:text-white hover:bg-surface-200'
                    )}
                  >
                    <span>All topics</span>
                    <span className="text-surface-500">{topics.length}</span>
                  </button>
                  {QUADRANTS.map((q) => {
                    const cfg = QUADRANT_CONFIG[q]
                    const Icon = cfg.icon
                    return (
                      <button
                        key={q}
                        onClick={() => setFilter(filter === q ? null : q)}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition-colors border',
                          filter === q
                            ? cn(cfg.bg, cfg.color, cfg.border)
                            : 'border-transparent text-surface-400 hover:text-white hover:bg-surface-200'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {cfg.label}
                        </div>
                        <span className="text-surface-500">{quadrantCounts[q] ?? 0}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Topic list */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest mb-2.5">
                  {filter ? QUADRANT_CONFIG[filter].label : 'Most active'}
                </p>
                <QuadrantList topics={topics} quadrant={filter} />
              </div>

              {/* Related pages */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
                <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest mb-2.5">Related views</p>
                <div className="space-y-1">
                  {[
                    { href: '/trajectory', label: 'Civic Trajectory', icon: TrendingUp, color: 'text-for-400' },
                    { href: '/momentum', label: 'Vote Momentum', icon: Zap, color: 'text-gold' },
                    { href: '/flux', label: 'Civic Flux', icon: Activity, color: 'text-purple' },
                    { href: '/climate', label: 'Civic Climate', icon: ArrowRight, color: 'text-emerald' },
                  ].map((link) => {
                    const Icon = link.icon
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-mono text-surface-400 hover:text-white hover:bg-surface-200 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <Icon className={cn('h-3.5 w-3.5', link.color)} />
                          {link.label}
                        </div>
                        <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
