'use client'

/**
 * /undertow — The Civic Undertow
 *
 * Reveals hidden currents in civic debate: topics where the surface-level
 * consensus is moving in the OPPOSITE direction to recent voter momentum.
 *
 * FALSE SUMMITS: Topics currently winning (FOR% ≥ 55%) but whose recent
 *   24-hour votes are trending strongly against. The ground is shifting
 *   beneath an apparent majority — if the undertow holds, these could fall.
 *
 * RISING UNDERDOGS: Topics currently losing (FOR% ≤ 45%) but whose recent
 *   24-hour votes are trending strongly in favour. An apparent minority is
 *   building a wave — if momentum holds, these could surprise.
 *
 * Distinct from:
 *   /convergence  — compares recent vs overall consensus direction (relative)
 *   /flux         — shows the single biggest net 24h swing
 *   /shifts       — week-scale percentage-point changes
 *   /pendulum     — historical arc of resolved topics
 *   /momentum     — raw vote velocity, not opinion direction
 *   /tipping-point — topics near the 75/25 threshold (not momentum-based)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Droplets,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Waves,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { UndertowTopic, UndertowResponse } from '@/app/api/undertow/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 120_000

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-for-300/10 text-for-300 border-for-300/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Culture:     'bg-against-400/10 text-against-300 border-against-400/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-gold/10 text-gold border-gold/30',
}

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gapLabel(gap: number): string {
  if (gap >= 30) return 'extreme'
  if (gap >= 20) return 'severe'
  if (gap >= 12) return 'strong'
  return 'moderate'
}

function gapColor(gap: number, variant: 'summit' | 'underdog') {
  if (variant === 'summit') {
    if (gap >= 25) return 'text-against-400'
    if (gap >= 15) return 'text-gold'
    return 'text-surface-500'
  }
  if (gap >= 25) return 'text-for-400'
  if (gap >= 15) return 'text-gold'
  return 'text-surface-500'
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  variant,
  index,
}: {
  topic: UndertowTopic
  variant: 'summit' | 'underdog'
  index: number
}) {
  const isSummit = variant === 'summit'
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'bg-surface-200 text-surface-500 border-surface-300'
  const gapLbl = gapLabel(topic.gap)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-xl border p-4 transition-all hover:brightness-105 active:scale-[0.99]',
          isSummit
            ? 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
            : 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
        )}
      >
        {/* Header row */}
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          {topic.category && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono border',
              catColor
            )}>
              {topic.category}
            </span>
          )}
          <Badge
            variant={
              topic.status === 'law' ? 'law'
              : topic.status === 'failed' ? 'failed'
              : topic.status === 'voting' ? 'voting'
              : 'active'
            }
            size="sm"
          />
          <span className={cn(
            'ml-auto text-[11px] font-mono font-semibold uppercase tracking-wide',
            gapColor(topic.gap, variant)
          )}>
            {gapLbl} undertow
          </span>
        </div>

        {/* Statement */}
        <p className="text-sm font-semibold text-white leading-snug mb-3 line-clamp-2">
          {topic.statement}
        </p>

        {/* Vote bars */}
        <div className="space-y-2 mb-3">
          {/* Overall position */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-surface-500 font-mono uppercase tracking-wide">
                Current position
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-mono font-bold text-for-400">
                  {Math.round(topic.blue_pct)}% FOR
                </span>
                {isSummit
                  ? <ArrowDown className="h-3 w-3 text-against-400" />
                  : <ArrowUp className="h-3 w-3 text-for-400" />
                }
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-for-700 to-for-400 transition-all duration-500"
                style={{ width: `${topic.blue_pct}%` }}
              />
            </div>
          </div>

          {/* Recent momentum */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-surface-500 font-mono uppercase tracking-wide">
                Recent 24h momentum
              </span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  'text-[11px] font-mono font-bold',
                  topic.recent_blue_pct > 50 ? 'text-for-400' : 'text-against-400'
                )}>
                  {Math.round(topic.recent_blue_pct)}% FOR
                </span>
                {isSummit
                  ? <TrendingDown className="h-3 w-3 text-against-400" />
                  : <TrendingUp className="h-3 w-3 text-for-400" />
                }
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  topic.recent_blue_pct > 50
                    ? 'bg-gradient-to-r from-for-700 to-for-400'
                    : 'bg-gradient-to-r from-against-700 to-against-400'
                )}
                style={{ width: `${topic.recent_blue_pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Gap indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Waves className={cn(
              'h-3.5 w-3.5',
              isSummit ? 'text-against-400' : 'text-for-400'
            )} />
            <span className={cn(
              'font-mono font-bold tabular-nums',
              gapColor(topic.gap, variant)
            )}>
              {topic.gap.toFixed(1)} pt undertow
            </span>
            <span className="text-surface-600">
              · {topic.recent_vote_count.toLocaleString()} recent votes
            </span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-surface-500" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-2 w-full" />
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  variant,
  count,
}: {
  variant: 'summit' | 'underdog'
  count: number
}) {
  if (variant === 'summit') {
    return (
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-against-500/10 border border-against-500/30">
          <TrendingDown className="h-4.5 w-4.5 text-against-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white font-mono">False Summits</h2>
          <p className="text-xs text-surface-500">
            Currently winning · secretly losing momentum
          </p>
        </div>
        <span className="ml-auto inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-against-500/10 border border-against-500/30 text-[11px] font-mono font-bold text-against-400">
          {count}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/30">
        <TrendingUp className="h-4.5 w-4.5 text-for-400" />
      </div>
      <div>
        <h2 className="text-base font-bold text-white font-mono">Rising Underdogs</h2>
        <p className="text-xs text-surface-500">
          Currently losing · secretly building a wave
        </p>
      </div>
      <span className="ml-auto inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-for-500/10 border border-for-500/30 text-[11px] font-mono font-bold text-for-400">
        {count}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UndertowPage() {
  const [data, setData] = useState<UndertowResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [showCatPicker, setShowCatPicker] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const params = category ? `?category=${encodeURIComponent(category)}` : ''
      const res = await fetch(`/api/undertow${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const json: UndertowResponse = await res.json()
      setData(json)
    } catch {
      // keep existing data on refresh failure
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [category])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    timerRef.current = setInterval(() => load(true), REFRESH_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [load])

  const totalAlerts = (data?.false_summits.length ?? 0) + (data?.underdogs.length ?? 0)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white mb-5 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        {/* Hero */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-200 border border-surface-300">
              <Waves className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono">The Civic Undertow</h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Surface wins hiding a sinking current — and losing underdogs building a wave
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            <span className="text-xs font-mono">Refresh</span>
          </button>
        </div>

        {/* Explainer strip */}
        <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 mb-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-md bg-against-500/10 border border-against-500/30 flex items-center justify-center">
                <TrendingDown className="h-3.5 w-3.5 text-against-400" />
              </div>
              <div>
                <p className="text-xs font-mono font-semibold text-white mb-0.5">False Summit</p>
                <p className="text-[11px] text-surface-500 leading-relaxed">
                  FOR% ≥ 55% overall, but recent votes are swinging against. The tide is turning.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-md bg-for-500/10 border border-for-500/30 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-for-400" />
              </div>
              <div>
                <p className="text-xs font-mono font-semibold text-white mb-0.5">Rising Underdog</p>
                <p className="text-[11px] text-surface-500 leading-relaxed">
                  FOR% ≤ 45% overall, but recent votes are surging. An upset is brewing.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats + category filter row */}
        {!loading && data && (
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm">
              <Activity className="h-3.5 w-3.5 text-surface-500" />
              <span className="font-mono font-semibold text-white tabular-nums">{totalAlerts}</span>
              <span className="text-surface-500">
                {totalAlerts === 1 ? 'undertow signal' : 'undertow signals'} detected
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Zap className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-surface-500 text-xs font-mono">
                24h window · updated 2 min
              </span>
            </div>

            {/* Category filter */}
            <div className="ml-auto relative">
              <button
                onClick={() => setShowCatPicker(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Droplets className="h-3.5 w-3.5" />
                {category ?? 'All categories'}
                <ChevronDown className={cn('h-3 w-3 transition-transform', showCatPicker && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {showCatPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-1 z-10 w-44 rounded-xl border border-surface-300 bg-surface-100 shadow-lg overflow-hidden"
                  >
                    <button
                      onClick={() => { setCategory(null); setShowCatPicker(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                        !category ? 'text-white font-semibold' : 'text-surface-500'
                      )}
                    >
                      All categories
                    </button>
                    {CATEGORIES.map(c => (
                      <button
                        key={c}
                        onClick={() => { setCategory(c); setShowCatPicker(false) }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                          category === c ? 'text-white font-semibold' : 'text-surface-500'
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-36 mb-1" />
                  <Skeleton className="h-3.5 w-52" />
                </div>
              </div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-36 mb-1" />
                  <Skeleton className="h-3.5 w-52" />
                </div>
              </div>
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">

            {/* False summits */}
            <section>
              <SectionHeader variant="summit" count={data?.false_summits.length ?? 0} />
              {data?.false_summits.length === 0 ? (
                <EmptyState
                  icon={TrendingDown}
                  title="No false summits right now"
                  description={
                    category
                      ? `No ${category} topics are winning overall but losing recent momentum.`
                      : 'No topics are winning overall while losing recent momentum. The surface matches the depths.'
                  }
                  actions={category ? [{ label: 'Clear filter', onClick: () => setCategory(null) }] : []}
                />
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-3">
                    {data.false_summits.map((topic, i) => (
                      <TopicCard key={topic.id} topic={topic} variant="summit" index={i} />
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </section>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-300" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-surface-50 px-3 text-xs text-surface-500 font-mono">vs</span>
              </div>
            </div>

            {/* Rising underdogs */}
            <section>
              <SectionHeader variant="underdog" count={data?.underdogs.length ?? 0} />
              {data?.underdogs.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No rising underdogs right now"
                  description={
                    category
                      ? `No ${category} topics are currently losing but building FOR momentum.`
                      : 'No underdogs are building momentum. All losing topics are staying down.'
                  }
                  actions={category ? [{ label: 'Clear filter', onClick: () => setCategory(null) }] : []}
                />
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-3">
                    {data.underdogs.map((topic, i) => (
                      <TopicCard key={topic.id} topic={topic} variant="underdog" index={i} />
                    ))}
                  </div>
                </AnimatePresence>
              )}
            </section>

          </div>
        )}

        {/* Footer links */}
        {!loading && (
          <div className="mt-10 pt-6 border-t border-surface-200">
            <p className="text-xs text-surface-600 text-center mb-3">
              Undertow signals are computed from the gap between overall FOR% and the
              24-hour recent FOR%. A gap of ≥ 8 percentage points qualifies.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link href="/convergence" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Convergence
              </Link>
              <Link href="/flux" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Flux
              </Link>
              <Link href="/shifts" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Shifts
              </Link>
              <Link href="/pendulum" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <Waves className="h-3 w-3" />
                Pendulum
              </Link>
              <Link href="/momentum" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                Momentum
              </Link>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
