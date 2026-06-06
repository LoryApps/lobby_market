'use client'

/**
 * /inflection — The Civic Inflection Points Tracker
 *
 * Inflection points are structural turning points in civic debate:
 * moments when a topic's consensus crosses a key threshold that changes
 * its political meaning. Crossing 50% means a side has won. Crossing 67%
 * means supermajority. Crossing 75% is near-universal mandate.
 *
 * This page answers: which topics are on the verge of a threshold crossing?
 * Which ones just made it? And what does the overall consensus landscape
 * look like right now?
 *
 * Distinct from:
 *   /tipping-point  — topics closest to 50/50 flip
 *   /convergence    — topics building toward agreement
 *   /momentum       — rate of vote change
 *   /volatility     — swing magnitude
 *   /pressure       — accumulated weight of consensus
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  InflectionResponse,
  ThresholdGroup,
  InflectionTopic,
  BandSlice,
} from '@/app/api/stats/inflection/route'

// ─── Category config ──────────────────────────────────────────────────────────

const CAT_CONFIG: Record<string, { icon: typeof Landmark; color: string }> = {
  Economics:   { icon: TrendingUp,    color: 'text-gold' },
  Politics:    { icon: Landmark,      color: 'text-for-400' },
  Technology:  { icon: Cpu,           color: 'text-purple' },
  Science:     { icon: FlaskConical,  color: 'text-emerald' },
  Ethics:      { icon: Scale,         color: 'text-against-300' },
  Health:      { icon: Heart,         color: 'text-against-300' },
  Environment: { icon: Leaf,          color: 'text-emerald' },
  Education:   { icon: GraduationCap, color: 'text-purple' },
  Culture:     { icon: Music2,        color: 'text-gold' },
}

// ─── Threshold visual config ──────────────────────────────────────────────────

const THRESHOLD_CONFIG: Record<50 | 60 | 67 | 75, {
  color: string
  bgColor: string
  borderColor: string
  glowColor: string
  badge: string
}> = {
  50: {
    color:       'text-surface-400',
    bgColor:     'bg-surface-300/30',
    borderColor: 'border-surface-400/40',
    glowColor:   'shadow-surface-400/20',
    badge:       'bg-surface-400/20 text-surface-300 border-surface-400/30',
  },
  60: {
    color:       'text-for-400',
    bgColor:     'bg-for-600/10',
    borderColor: 'border-for-500/30',
    glowColor:   'shadow-for-500/20',
    badge:       'bg-for-600/20 text-for-300 border-for-500/30',
  },
  67: {
    color:       'text-purple',
    bgColor:     'bg-purple/10',
    borderColor: 'border-purple/30',
    glowColor:   'shadow-purple/20',
    badge:       'bg-purple/20 text-purple border-purple/30',
  },
  75: {
    color:       'text-gold',
    bgColor:     'bg-gold/10',
    borderColor: 'border-gold/30',
    glowColor:   'shadow-gold/20',
    badge:       'bg-gold/20 text-gold border-gold/30',
  },
}

const BAND_CONFIG: Record<BandSlice['side'], { bg: string; text: string }> = {
  against_strong:   { bg: 'bg-against-600',    text: 'text-against-200' },
  against_moderate: { bg: 'bg-against-500/70', text: 'text-against-200' },
  contested:        { bg: 'bg-surface-400/60', text: 'text-surface-200' },
  for_moderate:     { bg: 'bg-for-600/70',     text: 'text-for-200' },
  for_strong:       { bg: 'bg-for-500',        text: 'text-for-100' },
  for_super:        { bg: 'bg-for-400',        text: 'text-white' },
  for_landslide:    { bg: 'bg-for-300',        text: 'text-white' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function forPctDisplay(bluePct: number): { label: string; color: string } {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  if (bluePct >= 50) {
    return { label: `${forPct}% For`, color: 'text-for-400' }
  }
  return { label: `${againstPct}% Against`, color: 'text-against-400' }
}

// ─── Topic pill ───────────────────────────────────────────────────────────────

function TopicPill({
  topic,
  compact,
}: {
  topic: InflectionTopic
  compact?: boolean
}) {
  const { label: pctLabel, color: pctColor } = forPctDisplay(topic.blue_pct)
  const CatIcon = topic.category ? (CAT_CONFIG[topic.category]?.icon ?? Activity) : Activity
  const catColor = topic.category ? (CAT_CONFIG[topic.category]?.color ?? 'text-surface-400') : 'text-surface-400'

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex items-start gap-2.5 p-3 rounded-xl border transition-all',
        'bg-surface-200/40 border-surface-300/50 hover:border-surface-400/70 hover:bg-surface-200/70',
        compact ? 'py-2.5' : 'py-3'
      )}
    >
      <CatIcon className={cn('shrink-0 mt-0.5', catColor, compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-medium text-surface-100 leading-snug line-clamp-2 group-hover:text-white transition-colors',
          compact ? 'text-[11px]' : 'text-xs'
        )}>
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={cn('text-[10px] font-mono font-bold', pctColor)}>
            {pctLabel}
          </span>
          <span className="text-[10px] text-surface-500 font-mono">
            {topic.total_votes.toLocaleString()} votes
          </span>
          {topic.gap > 0 && (
            <span className="text-[10px] text-gold font-mono">
              {topic.gap.toFixed(1)}pt away
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="shrink-0 w-3.5 h-3.5 text-surface-500 group-hover:text-surface-300 transition-colors mt-1" />
    </Link>
  )
}

// ─── Consensus bar ───────────────────────────────────────────────────────────

function ConsensusBar({ bluePct }: { bluePct: number }) {
  const pct = Math.max(0, Math.min(100, bluePct))
  return (
    <div className="relative h-1.5 w-full rounded-full bg-surface-400/30 overflow-hidden">
      <div
        className={cn(
          'absolute inset-y-0 left-0 rounded-full transition-all duration-700',
          pct >= 50 ? 'bg-for-500' : 'bg-against-500'
        )}
        style={{ width: `${pct}%` }}
      />
      {/* Threshold markers */}
      {([50, 60, 67, 75] as const).map((t) => (
        <div
          key={t}
          className="absolute inset-y-0 w-px bg-white/20"
          style={{ left: `${t}%` }}
        />
      ))}
    </div>
  )
}

// ─── Distribution chart ───────────────────────────────────────────────────────

function DistributionChart({ bands, total }: { bands: BandSlice[]; total: number }) {
  return (
    <div className="space-y-1.5">
      {bands.map((band) => {
        const cfg = BAND_CONFIG[band.side]
        const width = total > 0 ? (band.count / total) * 100 : 0
        return (
          <div key={band.label} className="flex items-center gap-2.5">
            <span className="text-[10px] text-surface-500 font-mono w-20 shrink-0 text-right">
              {band.label}
            </span>
            <div className="flex-1 h-5 rounded bg-surface-300/30 overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={cn('h-full rounded', cfg.bg)}
              />
            </div>
            <span className={cn('text-[10px] font-mono font-bold w-6 text-right shrink-0', cfg.text)}>
              {band.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Threshold section ────────────────────────────────────────────────────────

function ThresholdSection({ group }: { group: ThresholdGroup }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = THRESHOLD_CONFIG[group.threshold]
  const totalApproaching =
    group.approaching_for.length + group.approaching_against.length + group.at_threshold.length

  if (totalApproaching === 0 && group.established.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 sm:p-5 space-y-4',
        cfg.bgColor,
        cfg.borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          'border font-mono font-bold text-sm',
          cfg.bgColor, cfg.borderColor, cfg.color
        )}>
          {group.threshold}%
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn('font-bold text-sm', cfg.color)}>
              {group.label}
            </h3>
            <span className={cn(
              'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border',
              cfg.badge
            )}>
              {group.count_above} topics here
            </span>
            {totalApproaching > 0 && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-gold/10 border border-gold/30 text-gold">
                {totalApproaching} approaching
              </span>
            )}
          </div>
          <p className="text-[11px] text-surface-400 mt-0.5 leading-relaxed">
            {group.civic_meaning}
          </p>
        </div>
      </div>

      {/* At threshold (right on the line) */}
      {group.at_threshold.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-gold mb-2 flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            Right on the line
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.at_threshold.map((t) => (
              <TopicPill key={t.id + group.threshold} topic={t} compact />
            ))}
          </div>
        </div>
      )}

      {/* Approaching FOR */}
      {group.approaching_for.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-for-400 mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            For side approaching
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.approaching_for.slice(0, expanded ? undefined : 4).map((t) => (
              <TopicPill key={t.id + group.threshold + 'for'} topic={t} compact />
            ))}
          </div>
        </div>
      )}

      {/* Approaching AGAINST */}
      {group.approaching_against.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-against-400 mb-2 flex items-center gap-1.5">
            <TrendingDown className="w-3 h-3" />
            Against side approaching
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.approaching_against.slice(0, expanded ? undefined : 4).map((t) => (
              <TopicPill key={t.id + group.threshold + 'against'} topic={t} compact />
            ))}
          </div>
        </div>
      )}

      {/* Just established */}
      {group.established.length > 0 && (
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-surface-400 mb-2 flex items-center gap-1.5">
            <Zap className="w-3 h-3" />
            Just crossed
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {group.established.slice(0, expanded ? undefined : 4).map((t) => (
              <TopicPill key={t.id + group.threshold + 'est'} topic={t} compact />
            ))}
          </div>
        </div>
      )}

      {/* Expand toggle */}
      {(group.approaching_for.length > 4 || group.approaching_against.length > 4 || group.established.length > 4) && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-[11px] text-surface-400 hover:text-surface-200 transition-colors font-mono"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </motion.div>
  )
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
      <p className="text-[10px] text-surface-500 font-mono uppercase tracking-wider mb-1">{label}</p>
      <p className={cn('text-2xl font-bold font-mono tabular-nums', color ?? 'text-white')}>
        <AnimatedNumber value={value} />
      </p>
      {sub && <p className="text-[10px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-100 border border-surface-300" />
        ))}
      </div>
      <div className="h-40 rounded-2xl bg-surface-100 border border-surface-300" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-48 rounded-2xl bg-surface-100 border border-surface-300" />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InflectionClient() {
  const [data, setData] = useState<InflectionResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stats/inflection')
      if (!res.ok) throw new Error('Failed to load')
      const json: InflectionResponse = await res.json()
      setData(json)
      setLastRefresh(new Date())
    } catch {
      setError('Could not load inflection data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(() => load(true), 10 * 60 * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const totalTopics = data?.stats.total_active ?? 0

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
        {/* Header */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-surface-400 hover:text-white text-xs mb-4 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Civic Inflection Points
              </h1>
              <p className="text-sm text-surface-400 mt-1 leading-relaxed max-w-lg">
                Where civic debate is about to transform — topics approaching, straddling, or having just
                crossed the thresholds that define political meaning.
              </p>
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="shrink-0 p-2 rounded-xl border border-surface-300 bg-surface-200 text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <EmptyState
            icon={Activity}
            title="Could not load inflection data"
            description={error}
            actions={[{ label: 'Retry', onClick: () => load() }]}
          />
        ) : data ? (
          <>
            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Active topics"
                value={data.stats.total_active}
                color="text-white"
              />
              <StatCard
                label="Contested (45–55%)"
                value={data.stats.contested}
                sub="near deadlock"
                color="text-gold"
              />
              <StatCard
                label="Strong consensus"
                value={data.stats.strong_consensus}
                sub="≥ 60% one side"
                color="text-for-400"
              />
              <StatCard
                label="Nearing threshold"
                value={data.stats.nearing_any_threshold}
                sub="within 7pt"
                color="text-purple"
              />
            </div>

            {/* Platform lean indicator */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-mono font-bold text-surface-400 uppercase tracking-wider">
                    Platform consensus landscape
                  </p>
                  <p className="text-[11px] text-surface-500 mt-0.5">
                    Distribution of {totalTopics.toLocaleString()} active topics by consensus band
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-lg font-bold font-mono',
                    data.stats.platform_lean >= 50 ? 'text-for-400' : 'text-against-400'
                  )}>
                    {data.stats.platform_lean}%
                  </p>
                  <p className="text-[10px] text-surface-500">platform lean</p>
                </div>
              </div>

              {/* Distribution bar */}
              <div className="flex h-6 rounded-lg overflow-hidden mb-4 gap-px">
                {data.distribution.map((band) => {
                  const pct = totalTopics > 0 ? (band.count / totalTopics) * 100 : 0
                  if (pct < 1) return null
                  const cfg = BAND_CONFIG[band.side]
                  return (
                    <motion.div
                      key={band.label}
                      title={`${band.label}: ${band.count} topics`}
                      initial={{ flex: 0 }}
                      animate={{ flex: pct }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={cn('h-full', cfg.bg)}
                    />
                  )
                })}
              </div>

              {/* Legend */}
              <DistributionChart bands={data.distribution} total={totalTopics} />

              {/* Threshold markers */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {([50, 60, 67, 75] as const).map((t) => {
                  const cfg = THRESHOLD_CONFIG[t]
                  return (
                    <div key={t} className="flex items-center gap-1.5">
                      <div className={cn('w-2 h-2 rounded-full border', cfg.borderColor)} />
                      <span className={cn('text-[10px] font-mono', cfg.color)}>{t}% threshold</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Most contested strip */}
            {data.most_contested.length > 0 && (
              <div className="rounded-2xl bg-gold/5 border border-gold/20 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="w-4 h-4 text-gold" />
                  <h2 className="text-sm font-bold text-gold">Most Contested</h2>
                  <span className="text-[10px] font-mono text-gold/60 bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded">
                    44–56% band
                  </span>
                </div>
                <p className="text-[11px] text-surface-400 mb-3">
                  These topics sit in the deadlock zone — neither side has a clear mandate. Every vote matters here.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.most_contested.map((t) => (
                    <Link
                      key={t.id}
                      href={`/topic/${t.id}`}
                      className="group flex items-start gap-2.5 p-3 rounded-xl border transition-all bg-surface-200/40 border-gold/20 hover:border-gold/40 hover:bg-surface-200/70"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-surface-100 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                          {t.statement}
                        </p>
                        <div className="mt-2 space-y-1">
                          <ConsensusBar bluePct={t.blue_pct} />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold">
                              {Math.round(t.blue_pct)}% For · {Math.round(100 - t.blue_pct)}% Against
                            </span>
                            <span className="text-[10px] text-surface-500 font-mono">
                              {t.total_votes.toLocaleString()} votes
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Threshold sections */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-surface-400" />
                <h2 className="text-sm font-bold text-white">Threshold Analysis</h2>
                <p className="text-xs text-surface-500">Topics near each consensus milestone</p>
              </div>
              {data.thresholds.map((group) => (
                <ThresholdSection key={group.threshold} group={group} />
              ))}
            </div>

            {/* Footer */}
            <p className="text-center text-[10px] text-surface-600 font-mono">
              Updated {lastRefresh.toLocaleTimeString()} · refreshes every 10 minutes
            </p>
          </>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
