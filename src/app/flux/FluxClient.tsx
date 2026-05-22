'use client'

/**
 * /flux — Civic Consensus Flux
 *
 * Shows which active topics are undergoing the most significant consensus
 * shifts right now — topics where the FOR/AGAINST split is meaningfully
 * different in the last 24h compared to the previous 24h window.
 *
 * Distinct from:
 *   /momentum    — raw vote volume (how fast people are voting)
 *   /velocity    — category-level hourly vote rates
 *   /surge       — topics close to activation/vote thresholds
 *   /trending    — general trending by feed score
 *
 * This is the only page answering: "Where is the community changing its mind?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Minus,
  RefreshCw,
  Shuffle,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { FluxTopic, FluxResponse } from '@/app/api/topics/flux/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type SortMode = 'magnitude' | 'for' | 'against'

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function FluxCardSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

// ─── Flux direction pill ──────────────────────────────────────────────────────

function ShiftPill({ topic }: { topic: FluxTopic }) {
  const shift = topic.consensus_shift
  const abs   = topic.shift_magnitude
  if (abs < 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-surface-200 border border-surface-400 text-surface-400">
        <Minus className="h-3 w-3" />
        Stable
      </span>
    )
  }
  if (shift > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-for-500/15 border border-for-500/30 text-for-300">
        <ChevronUp className="h-3 w-3" />
        +{abs.toFixed(1)} pp FOR
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono bg-against-500/15 border border-against-500/30 text-against-300">
      <ChevronDown className="h-3 w-3" />
      -{abs.toFixed(1)} pp AGAINST
    </span>
  )
}

// ─── Flux intensity indicator ─────────────────────────────────────────────────

function FluxIntensity({ magnitude }: { magnitude: number }) {
  const level = magnitude >= 15 ? 'extreme' : magnitude >= 8 ? 'high' : magnitude >= 3 ? 'moderate' : 'low'
  const config = {
    extreme:  { label: 'EXTREME FLUX', cls: 'text-gold bg-gold/10 border-gold/30' },
    high:     { label: 'HIGH FLUX',    cls: 'text-against-300 bg-against-500/10 border-against-500/20' },
    moderate: { label: 'IN FLUX',      cls: 'text-purple bg-purple/10 border-purple/20' },
    low:      { label: 'MILD SHIFT',   cls: 'text-surface-400 bg-surface-200 border-surface-400' },
  }[level]
  return (
    <span className={cn('text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border', config.cls)}>
      {config.label}
    </span>
  )
}

// ─── Flux bar visual ──────────────────────────────────────────────────────────

function FluxBar({ recent, prior }: { recent: number; prior: number }) {
  const rFor  = Math.round(recent)
  const pFor  = Math.round(prior)
  const shift = recent - prior

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-surface-500 w-16">Prior 24h</span>
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-for-700/60 rounded-full transition-all"
            style={{ width: `${pFor}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-surface-500 w-8 text-right tabular-nums">{pFor}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-white w-16">Recent 24h</span>
        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden relative">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              shift > 0 ? 'bg-for-500' : 'bg-against-500',
            )}
            style={{ width: `${rFor}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-white w-8 text-right tabular-nums">{rFor}%</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-[10px] text-for-400 font-mono">FOR</span>
        <span className="text-[10px] text-against-400 font-mono">AGAINST</span>
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function FluxCard({ topic, index }: { topic: FluxTopic; index: number }) {
  const statusBadge = STATUS_BADGE[topic.status] ?? 'proposed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: 'easeOut' }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="block rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all duration-200 p-5 space-y-4 group"
      >
        {/* Header row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant={statusBadge} size="sm" />
            {topic.category && (
              <span className="text-[11px] font-mono text-surface-500 bg-surface-200 border border-surface-400 px-2 py-0.5 rounded-full">
                {topic.category}
              </span>
            )}
          </div>
          <FluxIntensity magnitude={topic.shift_magnitude} />
        </div>

        {/* Statement */}
        <p className="text-sm font-mono text-white leading-snug line-clamp-3 group-hover:text-for-100 transition-colors">
          {topic.statement}
        </p>

        {/* Flux bars */}
        <FluxBar recent={topic.blue_pct_recent} prior={topic.blue_pct_prior} />

        {/* Shift summary row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <ShiftPill topic={topic} />
          <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
            <span>{topic.votes_recent.toLocaleString()} recent votes</span>
            <span className="text-surface-600">·</span>
            <span>{topic.total_votes.toLocaleString()} total</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[11px] font-mono text-surface-600">
            Current consensus: {topic.blue_pct.toFixed(1)}% FOR
          </span>
          <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function FluxClient() {
  const [data, setData] = useState<FluxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<SortMode>('magnitude')
  const [computedAt, setComputedAt] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/topics/flux?sort=${sort}`)
      if (res.ok) {
        const json = (await res.json()) as FluxResponse
        setData(json)
        setComputedAt(json.meta.computed_at)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sort])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(() => load(true), 5 * 60_000)
    return () => clearInterval(id)
  }, [load])

  const topics = data?.topics ?? []

  const SORT_MODES: { value: SortMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'magnitude', label: 'Biggest Shift', icon: Shuffle },
    { value: 'for',       label: 'Swinging FOR',  icon: TrendingUp },
    { value: 'against',   label: 'Swinging AGAINST', icon: TrendingDown },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6 flex items-start gap-4">
          <Link
            href="/"
            className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-400 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to feed"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/25">
                <Activity className="h-4 w-4 text-purple" />
              </div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Flux</h1>
            </div>
            <p className="text-sm text-surface-500 leading-relaxed">
              Topics where the community is actively changing its mind — largest consensus shifts in the last 24h.
            </p>
          </div>
        </div>

        {/* ── Sort pills ── */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          {SORT_MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setSort(value)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-all',
                sort === value
                  ? 'bg-for-600 text-white border border-for-500/50'
                  : 'bg-surface-200 text-surface-400 border border-surface-400 hover:border-surface-500 hover:text-white',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}

          {/* Refresh + last-computed */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {computedAt && (
              <span className="text-[11px] font-mono text-surface-600 hidden sm:inline">
                {relativeTime(computedAt)}
              </span>
            )}
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh flux data"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Context note ── */}
        <div className="mb-5 rounded-xl bg-surface-200/50 border border-surface-400/50 px-4 py-3 flex items-start gap-3">
          <Zap className="h-4 w-4 text-purple mt-0.5 flex-shrink-0" />
          <p className="text-xs font-mono text-surface-400 leading-relaxed">
            Consensus shift compares the FOR% among <em className="not-italic text-surface-300">new votes cast in the last 24h</em> against the prior 24h window.
            A positive shift means recent voters are more supportive than those before them — the community is warming to the idea.
          </p>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <FluxCardSkeleton key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No flux detected"
            description="Not enough recent voting activity to detect consensus shifts. Check back once more topics accumulate votes."
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={sort}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {topics.map((topic, i) => (
                <FluxCard key={topic.id} topic={topic} index={i} />
              ))}

              {/* Summary footer */}
              {data && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: topics.length * 0.04 + 0.2 }}
                  className="text-center text-xs font-mono text-surface-600 pt-2"
                >
                  Analysed {data.meta.total_topics_analysed} topic
                  {data.meta.total_topics_analysed !== 1 ? 's' : ''} with ≥{data.meta.min_window_votes} votes in each window
                </motion.p>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
