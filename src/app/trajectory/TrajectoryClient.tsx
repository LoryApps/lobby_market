'use client'

/**
 * /trajectory — Civic Trajectory
 *
 * Shows the directional momentum of active civic debates:
 *   - Surging    = blue_pct rising fast (FOR support accelerating)
 *   - Gaining    = moderate positive momentum
 *   - Stable     = little movement
 *   - Declining  = moderate negative momentum
 *   - Reversing  = blue_pct falling fast (opinion shifting AGAINST)
 *   - Oscillating = high variance, no clear direction
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Minus,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Rocket,
  RotateCcw,
  Activity,
  AlertTriangle,
  Zap,
  BarChart2,
  Target,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TrajectoryResponse,
  TrajectoryTopic,
  TrajectoryLabel,
  TrajectorySection,
} from '@/app/api/trajectory/route'

// ─── Trajectory config ────────────────────────────────────────────────────────

type TrajectoryConfig = {
  icon: typeof Rocket
  color: string
  bg: string
  border: string
  label: string
  description: string
}

const TRAJECTORY_CONFIG: Record<TrajectoryLabel, TrajectoryConfig> = {
  surging:     { icon: Rocket,      color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     label: 'Surging FOR',   description: 'FOR support accelerating fast' },
  gaining:     { icon: TrendingUp,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', label: 'Gaining',       description: 'Steady positive momentum' },
  oscillating: { icon: Activity,    color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25', label: 'Oscillating',   description: 'Shifting back and forth — no clear direction' },
  stable:      { icon: Minus,       color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300',   label: 'Stable',        description: 'Minimal movement' },
  declining:   { icon: TrendingDown,color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/25',  label: 'Declining',     description: 'FOR support softening' },
  reversing:   { icon: RotateCcw,   color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30',label: 'Reversing',     description: 'Opinion shifting sharply AGAINST' },
}

const VOLUME_ICON = {
  growing:   '↑',
  stable:    '→',
  shrinking: '↓',
}

const VOLUME_COLOR = {
  growing:   'text-for-400',
  stable:    'text-surface-500',
  shrinking: 'text-against-400',
}

// ─── TopicRow ─────────────────────────────────────────────────────────────────

function MomentumBar({ momentum }: { momentum: number }) {
  const clamped = Math.max(-20, Math.min(20, momentum))
  const absWidth = Math.abs(clamped / 20) * 100

  return (
    <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
      <div className="relative h-full flex items-center">
        {clamped >= 0 ? (
          <div
            className="absolute right-1/2 h-full bg-for-500 rounded-full origin-right"
            style={{ width: `${absWidth / 2}%`, right: '50%' }}
          />
        ) : (
          <div
            className="absolute left-1/2 h-full bg-against-500 rounded-full origin-left"
            style={{ width: `${absWidth / 2}%`, left: '50%' }}
          />
        )}
        {/* Center tick */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-surface-400" />
      </div>
    </div>
  )
}

function TopicRow({ topic, rank }: { topic: TrajectoryTopic; rank: number }) {
  const cfg = TRAJECTORY_CONFIG[topic.trajectory]
  const isFor = topic.blue_pct >= 50
  const pctLabel = isFor ? `${Math.round(topic.blue_pct)}% FOR` : `${Math.round(100 - topic.blue_pct)}% AGN`
  const momentumLabel =
    topic.momentum > 0
      ? `+${topic.momentum.toFixed(1)}pp`
      : `${topic.momentum.toFixed(1)}pp`

  return (
    <Link href={`/topic/${topic.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.04 }}
        className={cn(
          'group rounded-xl p-3 border transition-all duration-200',
          'bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/60'
        )}
      >
        {/* Top row */}
        <div className="flex items-start gap-2 mb-2">
          <div className={cn('mt-0.5 flex-shrink-0 h-5 w-5 rounded flex items-center justify-center', cfg.bg, cfg.border, 'border')}>
            <cfg.icon className={cn('h-3 w-3', cfg.color)} />
          </div>
          <p className="flex-1 text-[13px] font-medium text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
        </div>

        {/* Momentum bar */}
        <MomentumBar momentum={topic.momentum} />

        {/* Stats row */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className={cn('text-[11px] font-mono font-semibold', isFor ? 'text-for-400' : 'text-against-400')}>
              {pctLabel}
            </span>
            <span className={cn('text-[11px] font-mono font-bold', topic.momentum > 0 ? 'text-for-400' : topic.momentum < 0 ? 'text-against-400' : 'text-surface-500')}>
              {momentumLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {topic.pivot_risk && (
              <span title="Pivot risk — near 50/50 and shifting">
                <AlertTriangle className="h-3 w-3 text-amber-400" />
              </span>
            )}
            <span className={cn('text-[10px] font-mono', VOLUME_COLOR[topic.volume_trend])}>
              {VOLUME_ICON[topic.volume_trend]} vol
            </span>
            {topic.category && (
              <Badge variant="outline" size="sm" className="text-[10px] px-1.5 py-0 border-surface-400 text-surface-500">
                {topic.category}
              </Badge>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── SectionBlock ─────────────────────────────────────────────────────────────

function SectionBlock({ section }: { section: TrajectorySection }) {
  const cfg = TRAJECTORY_CONFIG[section.label]
  const [expanded, setExpanded] = useState(section.label === 'surging' || section.label === 'reversing')

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-2 w-full group"
      >
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center border', cfg.bg, cfg.border)}>
          <cfg.icon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 text-left">
          <span className="text-sm font-semibold text-white">{cfg.label}</span>
          <span className="ml-2 text-xs text-surface-500">
            {section.topics.length} topic{section.topics.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span className="text-xs text-surface-500 group-hover:text-surface-400 transition-colors">
          {expanded ? '↑' : '↓'}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {section.topics.map((topic, i) => (
                <TopicRow key={topic.id} topic={topic} rank={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── StatsHeader ──────────────────────────────────────────────────────────────

function StatsHeader({ data }: { data: TrajectoryResponse }) {
  const { stats } = data

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-xl border border-for-500/30 bg-for-500/10 p-3 text-center">
        <p className="text-2xl font-mono font-bold text-for-400">{stats.surging_count}</p>
        <p className="text-[11px] text-surface-500 mt-0.5">Surging</p>
      </div>
      <div className="rounded-xl border border-surface-300 bg-surface-200 p-3 text-center">
        <p className="text-2xl font-mono font-bold text-surface-400">{stats.stable_count}</p>
        <p className="text-[11px] text-surface-500 mt-0.5">Stable</p>
      </div>
      <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-3 text-center">
        <p className="text-2xl font-mono font-bold text-against-400">{stats.reversing_count}</p>
        <p className="text-[11px] text-surface-500 mt-0.5">Reversing</p>
      </div>
    </div>
  )
}

// ─── SpotlightCard ────────────────────────────────────────────────────────────

function SpotlightCard({
  topic,
  kind,
}: {
  topic: TrajectoryTopic
  kind: 'highest' | 'fastest_reversal'
}) {
  const isHighest = kind === 'highest'
  const title = isHighest ? 'Fastest Mover' : 'Sharpest Reversal'
  const Icon = isHighest ? Rocket : RotateCcw
  const color = isHighest ? 'text-for-400' : 'text-against-400'
  const bg = isHighest ? 'bg-for-500/10' : 'bg-against-500/10'
  const border = isHighest ? 'border-for-500/30' : 'border-against-500/30'
  const sign = topic.momentum >= 0 ? '+' : ''

  return (
    <Link href={`/topic/${topic.id}`}>
      <div className={cn('rounded-xl border p-3 hover:opacity-90 transition-opacity', bg, border)}>
        <div className="flex items-center gap-1.5 mb-2">
          <Icon className={cn('h-3.5 w-3.5', color)} />
          <span className={cn('text-[11px] font-semibold uppercase tracking-wider', color)}>
            {title}
          </span>
        </div>
        <p className="text-[13px] text-white font-medium line-clamp-2 mb-2">{topic.statement}</p>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-mono font-bold', color)}>
            {sign}{topic.momentum.toFixed(1)}pp
          </span>
          <span className="text-[11px] text-surface-500">
            {Math.round(topic.blue_pct)}% FOR
          </span>
          {topic.category && (
            <Badge variant="outline" size="sm" className="ml-auto text-[10px] px-1.5 py-0 border-surface-400 text-surface-500">
              {topic.category}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TrajectoryClient() {
  const [data, setData] = useState<TrajectoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/trajectory', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load trajectory data')
      const json: TrajectoryResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load trajectory data. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRefresh = () => load(true)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-10">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Activity className="h-4 w-4 text-purple-400" />
              </div>
              <h1 className="text-2xl font-bold font-mono text-white">Civic Trajectory</h1>
            </div>
            <p className="text-sm text-surface-500 ml-10">
              Directional momentum of all active debates — where opinion is moving
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="mt-1 p-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-28 rounded-xl" />
              <Skeleton className="h-28 rounded-xl" />
            </div>
            <Skeleton className="h-8 w-40" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <EmptyState
            icon={Activity}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/20"
            title="Trajectory unavailable"
            description={error}
            actions={[{ label: 'Try again', onClick: handleRefresh }]}
          />
        )}

        {/* ── Data ── */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Stats header */}
              <StatsHeader data={data} />

              {/* Spotlight cards */}
              {(data.stats.highest_momentum_topic || data.stats.fastest_reversal_topic) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.stats.highest_momentum_topic && (
                    <SpotlightCard topic={data.stats.highest_momentum_topic} kind="highest" />
                  )}
                  {data.stats.fastest_reversal_topic && (
                    <SpotlightCard topic={data.stats.fastest_reversal_topic} kind="fastest_reversal" />
                  )}
                </div>
              )}

              {/* Key: momentum bar legend */}
              <div className="rounded-xl border border-surface-300 bg-surface-100 p-3">
                <p className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider mb-2">
                  How to read the momentum bar
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-8 rounded-full bg-for-500" />
                    <span className="text-[11px] text-surface-500">FOR gaining</span>
                  </div>
                  <div className="h-3 w-px bg-surface-400" />
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-8 rounded-full bg-against-500" />
                    <span className="text-[11px] text-surface-500">AGAINST gaining</span>
                  </div>
                  <div className="h-3 w-px bg-surface-400" />
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-amber-400" />
                    <span className="text-[11px] text-surface-500">Pivot risk</span>
                  </div>
                </div>
              </div>

              {/* Sections */}
              {data.sections.length === 0 ? (
                <EmptyState
                  icon={BarChart2}
                  iconColor="text-surface-400"
                  iconBg="bg-surface-200"
                  iconBorder="border-surface-300"
                  title="No trajectory data yet"
                  description="Trajectory requires price history data. Check back once debates have accumulated more votes."
                  actions={[{ label: 'Browse topics', href: '/' }]}
                />
              ) : (
                <div className="space-y-5">
                  {data.sections.map((section) => (
                    <SectionBlock key={section.label} section={section} />
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="pt-2">
                <p className="text-[10px] text-surface-600 mb-3">
                  Analysed {data.total_analyzed} active debate{data.total_analyzed !== 1 ? 's' : ''} ·{' '}
                  Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { href: '/climate',       label: 'Civic Climate',   icon: Activity },
                    { href: '/civic-forecast',label: 'Forecast',        icon: Target },
                    { href: '/velocity',      label: 'Velocity',        icon: Zap },
                    { href: '/momentum',      label: 'Momentum',        icon: TrendingUp },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-200 border border-surface-300 rounded-full text-xs text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
                    >
                      <Icon className="h-3 w-3" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
