'use client'

/**
 * /tipping-point — The Civic Tipping Point
 *
 * Surfaces topics where democracy is at a decision crossroads — the
 * debates that are tantalizingly close to crossing the consensus threshold
 * (FOR% ≥ 75%) or about to be definitively rejected (FOR% ≤ 25%).
 *
 * These are the make-or-break moments: a sustained push of votes in either
 * direction will determine whether a proposal becomes law or fails.
 *
 * Distinct from:
 *   /convergence    — whether RECENT voters are pushing toward or away from consensus
 *   /momentum       — raw vote velocity (how fast, not how close)
 *   /groundswell    — dormant topics awakening (revival, not threshold proximity)
 *   /pipeline       — all topics at every stage (not threshold-focused)
 *   /flashpoint     — the single most contested topic right now (not proximity)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Gavel,
  Info,
  RefreshCw,
  Scale,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TippingPointTopic, TippingPointResponse } from '@/app/api/topics/tipping-point/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
}

function categoryClass(cat: string | null) {
  return cat ? (CATEGORY_COLORS[cat] ?? 'bg-surface-300 text-surface-400 border-surface-400') : ''
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function timeLeft(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return `${Math.floor(diff / 60_000)}m left`
  if (h < 24) return `${h}h left`
  return `${d}d left`
}

// ─── Proximity meter ──────────────────────────────────────────────────────────

function ProximityMeter({
  forPct,
  zone,
  thresholdPct,
}: {
  forPct: number
  zone: 'breaking_through' | 'about_to_fall'
  thresholdPct: number
}) {
  const rejectionThreshold = 100 - thresholdPct

  // For "breaking through": show progress from 58% toward 75%
  // For "about to fall": show progress from 25% toward 42% (inverted — AGAINST votes)
  let progress: number
  let barColor: string
  let thresholdLabel: string

  if (zone === 'breaking_through') {
    const rangeMin = 58
    const rangeMax = thresholdPct
    progress = Math.min(100, Math.max(0, ((forPct - rangeMin) / (rangeMax - rangeMin)) * 100))
    barColor = 'bg-for-500'
    thresholdLabel = `${thresholdPct}% consensus`
  } else {
    const rangeMax = 42
    const rangeMin = rejectionThreshold
    progress = Math.min(100, Math.max(0, ((rangeMax - forPct) / (rangeMax - rangeMin)) * 100))
    barColor = 'bg-against-500'
    thresholdLabel = `${rejectionThreshold}% rejection`
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span>{zone === 'breaking_through' ? 'Approaching' : 'Sliding toward'}</span>
        <span className={zone === 'breaking_through' ? 'text-for-400' : 'text-against-400'}>
          {thresholdLabel}
        </span>
      </div>
      <div className="relative h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* Threshold marker */}
        <div className="absolute right-0 top-0 h-full w-0.5 bg-surface-100 opacity-60" />
      </div>
      <div className="text-[9px] font-mono text-surface-600 text-right">
        {Math.round(progress)}% of the way there
      </div>
    </div>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TippingCard({
  topic,
  index,
  thresholdPct,
}: {
  topic: TippingPointTopic
  index: number
  thresholdPct: number
}) {
  const [expanded, setExpanded] = useState(false)
  const isBreaking = topic.zone === 'breaking_through'
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const borderColor = isBreaking
    ? 'border-for-500/30 hover:border-for-500/50'
    : 'border-against-500/30 hover:border-against-500/50'

  const accentColor = isBreaking ? 'text-for-400' : 'text-against-400'
  const accentBg = isBreaking ? 'bg-for-500/10' : 'bg-against-500/10'

  const votingDeadline = timeLeft(topic.voting_ends_at)
  const isVoting = topic.status === 'voting'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden transition-colors',
        borderColor,
      )}
    >
      {/* Top strip */}
      <div className={cn('h-0.5', isBreaking ? 'bg-for-500/40' : 'bg-against-500/40')} />

      <div className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-2">
          {/* Proximity badge */}
          <div className={cn('flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl', accentBg)}>
            {isBreaking
              ? <TrendingUp className={cn('h-4 w-4', accentColor)} aria-hidden="true" />
              : <TrendingDown className={cn('h-4 w-4', accentColor)} aria-hidden="true" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <Link
              href={`/topic/${topic.id}`}
              className="text-sm font-mono text-white hover:text-for-300 transition-colors leading-snug line-clamp-2 block"
            >
              {topic.statement}
            </Link>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {topic.category && (
                <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', categoryClass(topic.category))}>
                  {topic.category}
                </span>
              )}
              {isVoting && (
                <Badge variant="proposed" className="text-[10px]">
                  <Scale className="h-2.5 w-2.5 mr-0.5" /> Voting
                </Badge>
              )}
              {votingDeadline && (
                <span className="text-[10px] font-mono text-surface-500">{votingDeadline}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Vote bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono font-bold text-for-400">{forPct}% FOR</span>
            <span className="text-[10px] font-mono text-surface-500">
              {topic.total_votes.toLocaleString()} votes
            </span>
            <span className="text-xs font-mono font-bold text-against-400">{againstPct}% AGAINST</span>
          </div>
          <div className="h-2 bg-against-500/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          {/* Threshold markers */}
          <div className="relative h-1">
            <div
              className="absolute top-0 -translate-x-1/2 h-1 w-0.5 bg-for-400/60 rounded"
              style={{ left: `${thresholdPct}%` }}
            />
            <div
              className="absolute top-0 -translate-x-1/2 h-1 w-0.5 bg-against-400/60 rounded"
              style={{ left: `${100 - thresholdPct}%` }}
            />
          </div>
        </div>

        {/* Proximity meter */}
        <ProximityMeter forPct={topic.blue_pct} zone={topic.zone} thresholdPct={thresholdPct} />

        {/* Expanded details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-2 border-t border-surface-300 space-y-3">
                {/* Votes needed callout */}
                <div className={cn('rounded-xl p-3 flex items-center gap-3', accentBg)}>
                  {isBreaking ? (
                    <>
                      <ThumbsUp className={cn('h-4 w-4 flex-shrink-0', accentColor)} aria-hidden="true" />
                      <div>
                        <p className={cn('text-xs font-mono font-semibold', accentColor)}>
                          ~{topic.for_votes_needed.toLocaleString()} more FOR votes to reach consensus
                        </p>
                        <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                          Once FOR% hits {thresholdPct}%, this debate enters the final voting phase.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ThumbsDown className={cn('h-4 w-4 flex-shrink-0', accentColor)} aria-hidden="true" />
                      <div>
                        <p className={cn('text-xs font-mono font-semibold', accentColor)}>
                          ~{topic.against_votes_needed.toLocaleString()} more AGAINST votes to reject
                        </p>
                        <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                          Once FOR% drops to {100 - thresholdPct}%, this proposal is definitively rejected.
                        </p>
                      </div>
                    </>
                  )}
                </div>
                {/* Distance stat */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-surface-200 p-2.5 text-center">
                    <p className="text-[10px] font-mono text-surface-500">Distance to consensus</p>
                    <p className="text-sm font-mono font-bold text-for-400 mt-0.5">
                      {topic.distance_to_for_threshold.toFixed(1)}pp
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-200 p-2.5 text-center">
                    <p className="text-[10px] font-mono text-surface-500">Distance to rejection</p>
                    <p className="text-sm font-mono font-bold text-against-400 mt-0.5">
                      {topic.distance_to_against_threshold.toFixed(1)}pp
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-surface-600">{relTime(topic.created_at)}</span>
                  <Link
                    href={`/topic/${topic.id}`}
                    className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Vote on this topic
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function TippingPointSkeleton() {
  return (
    <div className="space-y-10">
      {[0, 1].map((s) => (
        <div key={s} className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-4 w-40" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
  accentClass,
  bgClass,
}: {
  icon: typeof TrendingUp
  label: string
  count: number
  accentClass: string
  bgClass: string
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className={cn('flex h-7 w-7 items-center justify-center rounded-xl', bgClass)}>
          <Icon className={cn('h-3.5 w-3.5', accentClass)} aria-hidden="true" />
        </div>
        <span className="text-sm font-mono font-bold text-white uppercase tracking-widest">
          {label}
        </span>
        <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full', bgClass, accentClass)}>
          {count}
        </span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'breaking_through' | 'about_to_fall'

export default function TippingPointPage() {
  const [data, setData] = useState<TippingPointResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('breaking_through')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [expandedInfo, setExpandedInfo] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/tipping-point', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch')
      const json = await res.json() as TippingPointResponse
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      refreshTimer.current = setTimeout(() => setData(null), 5 * 60_000)
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
    }
  }, [load])

  const thresholdPct = data?.threshold_pct ?? 75

  const allCategories = Array.from(
    new Set([
      ...(data?.breaking_through.map((t) => t.category).filter(Boolean) ?? []),
      ...(data?.about_to_fall.map((t) => t.category).filter(Boolean) ?? []),
    ])
  ).sort() as string[]

  function filterTopics(topics: TippingPointTopic[]) {
    if (!categoryFilter) return topics
    return topics.filter((t) => t.category === categoryFilter)
  }

  const breakingThrough = filterTopics(data?.breaking_through ?? [])
  const aboutToFall = filterTopics(data?.about_to_fall ?? [])
  const displayTopics = tab === 'breaking_through' ? breakingThrough : aboutToFall

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Target className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-tight">
                The Tipping Point
              </h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Debates within striking distance of consensus — or collapse
              </p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh data"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* ── Explainer ─────────────────────────────────────────────────── */}
        <div className="mb-5 rounded-xl border border-surface-300 bg-surface-100/60">
          <button
            onClick={() => setExpandedInfo((v) => !v)}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
          >
            <Info className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-xs font-mono text-surface-400 flex-1">
              How the Tipping Point works
            </span>
            {expandedInfo
              ? <ChevronUp className="h-3.5 w-3.5 text-surface-500" />
              : <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
            }
          </button>
          <AnimatePresence>
            {expandedInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-2 border-t border-surface-300">
                  <p className="text-xs font-mono text-surface-500 pt-3 leading-relaxed">
                    A topic reaches <span className="text-for-400">civic consensus</span> when FOR% hits{' '}
                    <span className="text-for-400 font-semibold">{thresholdPct}%</span>, entering the final
                    voting phase. It is <span className="text-against-400">definitively rejected</span> when
                    FOR% falls to <span className="text-against-400 font-semibold">{100 - thresholdPct}%</span>.
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg bg-for-500/5 border border-for-500/20 p-2.5">
                      <p className="text-[10px] font-mono text-for-400 font-semibold">Breaking Through</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                        FOR% 58–{thresholdPct}%. A push of FOR votes could seal consensus.
                      </p>
                    </div>
                    <div className="rounded-lg bg-against-500/5 border border-against-500/20 p-2.5">
                      <p className="text-[10px] font-mono text-against-400 font-semibold">About to Fall</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                        FOR% 25–42%. Sliding toward definitive rejection by the community.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Category filter ────────────────────────────────────────────── */}
        {allCategories.length > 1 && !loading && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono border transition-colors',
                !categoryFilter
                  ? 'bg-for-600 border-for-500 text-white'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono border transition-colors',
                  categoryFilter === cat
                    ? 'bg-for-600 border-for-500 text-white'
                    : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        {!loading && !error && data && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTab('breaking_through')}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-semibold border transition-all flex-1 justify-center',
                tab === 'breaking_through'
                  ? 'bg-for-500/10 border-for-500/40 text-for-400'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              Breaking Through
              <span className={cn(
                'ml-1 px-1.5 py-0.5 rounded-full text-[9px]',
                tab === 'breaking_through' ? 'bg-for-500/20 text-for-300' : 'bg-surface-300 text-surface-500',
              )}>
                {breakingThrough.length}
              </span>
            </button>
            <button
              onClick={() => setTab('about_to_fall')}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-semibold border transition-all flex-1 justify-center',
                tab === 'about_to_fall'
                  ? 'bg-against-500/10 border-against-500/40 text-against-400'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              About to Fall
              <span className={cn(
                'ml-1 px-1.5 py-0.5 rounded-full text-[9px]',
                tab === 'about_to_fall' ? 'bg-against-500/20 text-against-300' : 'bg-surface-300 text-surface-500',
              )}>
                {aboutToFall.length}
              </span>
            </button>
          </div>
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TippingPointSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center space-y-4"
            >
              <Activity className="h-8 w-8 text-surface-600 mx-auto" aria-hidden="true" />
              <div>
                <p className="font-mono text-white font-semibold">Could not load data</p>
                <p className="text-sm font-mono text-surface-500 mt-1">Something went wrong fetching tipping-point topics.</p>
              </div>
              <button
                onClick={load}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Try again
              </button>
            </motion.div>
          ) : (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {displayTopics.length === 0 ? (
                <EmptyState
                  icon={
                    tab === 'breaking_through'
                      ? <TrendingUp className="h-8 w-8 text-surface-600" />
                      : <TrendingDown className="h-8 w-8 text-surface-600" />
                  }
                  title={
                    tab === 'breaking_through'
                      ? 'No debates near consensus right now'
                      : 'No debates near rejection right now'
                  }
                  description={
                    tab === 'breaking_through'
                      ? 'No active topics are within striking distance of the consensus threshold. Check back as more votes come in.'
                      : 'No active topics are sliding toward definitive rejection right now. The community seems to be leaning FOR on most debates.'
                  }
                  action={
                    <Link
                      href="/trending"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono transition-colors"
                    >
                      Browse all topics <ArrowRight className="h-4 w-4" />
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {tab === 'breaking_through' && (
                    <SectionHeader
                      icon={TrendingUp}
                      label="Breaking Through"
                      count={breakingThrough.length}
                      accentClass="text-for-400"
                      bgClass="bg-for-500/10"
                    />
                  )}
                  {tab === 'about_to_fall' && (
                    <SectionHeader
                      icon={TrendingDown}
                      label="About to Fall"
                      count={aboutToFall.length}
                      accentClass="text-against-400"
                      bgClass="bg-against-500/10"
                    />
                  )}
                  {displayTopics.map((topic, i) => (
                    <TippingCard
                      key={topic.id}
                      topic={topic}
                      index={i}
                      thresholdPct={thresholdPct}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer links ──────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { href: '/convergence', label: 'Convergence', icon: Activity, color: 'text-emerald' },
              { href: '/momentum',    label: 'Momentum',    icon: Zap,       color: 'text-for-400' },
              { href: '/groundswell', label: 'Groundswell', icon: TrendingUp, color: 'text-gold'  },
              { href: '/pipeline',    label: 'Pipeline',    icon: Gavel,     color: 'text-purple' },
            ].map(({ href, label, icon: Icon, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 p-3 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
              >
                <Icon className={cn('h-3.5 w-3.5', color)} aria-hidden="true" />
                <span className="text-[11px] font-mono text-surface-400 group-hover:text-white transition-colors">{label}</span>
              </Link>
            ))}
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}
