'use client'

/**
 * /groundswell — The Civic Groundswell
 *
 * Surfaces topics that were previously quiet but are suddenly attracting
 * a burst of new voter engagement. The "revival rate" measures how many
 * times more votes a topic received in the last 24 hours compared to its
 * 7-day baseline average.
 *
 * A revival rate of 5× means: "this topic got 5× its usual daily votes today."
 *
 * Distinct from:
 *   /surge       — absolute high-volume topics (already loud, staying loud)
 *   /momentum    — direction of vote change (FOR vs. AGAINST swings)
 *   /shifting    — percentage-point shifts in FOR/AGAINST split
 *   /trending    — algorithm-based trending score (feed_score)
 *
 * Groundswell specifically finds topics WAKING UP — previously dormant,
 * now suddenly drawing a crowd.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Loader2,
  RefreshCw,
  Scale,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { GroundswellTopic, GroundswellResponse } from '@/app/api/topics/groundswell/route'

// ─── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold border-gold/40 bg-gold/10',
  Politics: 'text-for-400 border-for-500/40 bg-for-500/10',
  Technology: 'text-purple border-purple/40 bg-purple/10',
  Science: 'text-emerald border-emerald/40 bg-emerald/10',
  Ethics: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  Philosophy: 'text-sky-400 border-sky-500/40 bg-sky-500/10',
  Culture: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  Health: 'text-rose-400 border-rose-500/40 bg-rose-500/10',
  Environment: 'text-lime-400 border-lime-500/40 bg-lime-500/10',
  Education: 'text-orange-400 border-orange-500/40 bg-orange-500/10',
}

/** Intensity label for the revival rate */
function revivalLabel(rate: number): { label: string; color: string; intensity: number } {
  if (rate >= 20) return { label: 'Erupting', color: 'text-against-300', intensity: 5 }
  if (rate >= 10) return { label: 'Surging', color: 'text-gold', intensity: 4 }
  if (rate >= 6)  return { label: 'Rising', color: 'text-for-300', intensity: 3 }
  if (rate >= 4)  return { label: 'Stirring', color: 'text-purple', intensity: 2 }
  return { label: 'Awakening', color: 'text-surface-500', intensity: 1 }
}

// ─── Vote bar ──────────────────────────────────────────────────────────────────

function VoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-mono">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex">
        <div
          className="h-full bg-gradient-to-r from-for-700 to-for-500"
          style={{ width: `${forPct}%` }}
          aria-hidden="true"
        />
        <div
          className="h-full bg-against-600"
          style={{ width: `${againstPct}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

// ─── Revival pulse indicator ──────────────────────────────────────────────────

function RevivalPulse({ rate, className }: { rate: number; className?: string }) {
  const { label, color, intensity } = revivalLabel(rate)
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Animated pulse rings */}
      <div className="relative flex-shrink-0">
        <div
          className={cn(
            'h-3 w-3 rounded-full',
            intensity >= 3 ? 'bg-gold' : intensity >= 2 ? 'bg-for-400' : 'bg-surface-500'
          )}
        />
        {intensity >= 2 && (
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-60',
              intensity >= 4 ? 'bg-gold' : 'bg-for-400'
            )}
          />
        )}
      </div>
      <span className={cn('text-xs font-mono font-semibold', color)}>{label}</span>
    </div>
  )
}

// ─── Topic card ────────────────────────────────────────────────────────────────

function GroundswellCard({
  topic,
  rank,
}: {
  topic: GroundswellTopic
  rank: number
}) {
  const [expanded, setExpanded] = useState(false)
  const catStyle = topic.category ? (CATEGORY_COLORS[topic.category] ?? 'text-surface-500 border-surface-400 bg-surface-300/40') : ''

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.05 }}
    >
      <div className="rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors overflow-hidden">
        {/* Main row */}
        <div className="p-4 md:p-5">
          <div className="flex items-start gap-3 md:gap-4">
            {/* Rank badge */}
            <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-surface-200 border border-surface-300 text-[11px] font-mono font-bold text-surface-500 mt-0.5">
              {rank + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Status + category row */}
              <div className="flex items-center flex-wrap gap-1.5 mb-2">
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px]">
                  {topic.status === 'voting' ? 'VOTING' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                </Badge>

                {topic.category && (
                  <span
                    className={cn(
                      'inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono border',
                      catStyle
                    )}
                  >
                    {topic.category}
                  </span>
                )}

                {topic.scope && topic.scope !== 'Global' && (
                  <span className="text-[10px] font-mono text-surface-600 border border-surface-400/50 bg-surface-300/30 px-1.5 py-0.5 rounded-md">
                    {topic.scope}
                  </span>
                )}
              </div>

              {/* Statement */}
              <Link
                href={`/topic/${topic.id}`}
                className="block text-sm font-mono font-semibold text-white hover:text-for-300 transition-colors leading-snug mb-3"
              >
                {topic.statement}
              </Link>

              {/* Revival metric row */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <RevivalPulse rate={topic.revival_rate} />

                <div className="flex items-center gap-3 text-[11px] font-mono">
                  {/* 24h votes */}
                  <span className="flex items-center gap-1 text-for-300">
                    <Flame className="h-3 w-3" aria-hidden="true" />
                    <strong>{topic.votes_24h.toLocaleString()}</strong>
                    <span className="text-surface-600">new today</span>
                  </span>

                  {/* Total votes */}
                  <span className="flex items-center gap-1 text-surface-600">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {topic.total_votes.toLocaleString()} total
                  </span>
                </div>
              </div>
            </div>

            {/* Revival rate badge — right side */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1">
              <div
                className={cn(
                  'px-2 py-1 rounded-xl border text-center min-w-[52px]',
                  topic.revival_rate >= 10
                    ? 'bg-gold/10 border-gold/40'
                    : topic.revival_rate >= 6
                      ? 'bg-for-600/10 border-for-500/30'
                      : 'bg-purple/10 border-purple/30'
                )}
                aria-label={`Revival rate: ${topic.revival_rate}×`}
              >
                <div
                  className={cn(
                    'text-lg font-mono font-black leading-none tabular-nums',
                    topic.revival_rate >= 10
                      ? 'text-gold'
                      : topic.revival_rate >= 6
                        ? 'text-for-300'
                        : 'text-purple'
                  )}
                >
                  {topic.revival_rate >= 100 ? '99+' : `${topic.revival_rate}×`}
                </div>
                <div className="text-[9px] font-mono text-surface-600 mt-0.5 uppercase tracking-wider">
                  revival
                </div>
              </div>

              {/* Expand toggle */}
              <button
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Hide details' : 'Show details'}
                className="p-1 rounded-md text-surface-600 hover:text-white hover:bg-surface-200 transition-colors"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Expanded detail panel */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 md:px-5 pb-4 border-t border-surface-300 pt-4 space-y-3">
                {/* Vote bar */}
                <VoteBar bluePct={topic.blue_pct} />

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg bg-surface-200/60 border border-surface-300">
                    <div className="text-base font-mono font-bold text-for-300 tabular-nums">
                      {topic.votes_24h.toLocaleString()}
                    </div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">last 24 h</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface-200/60 border border-surface-300">
                    <div className="text-base font-mono font-bold text-surface-500 tabular-nums">
                      {topic.baseline_daily > 0
                        ? topic.baseline_daily % 1 === 0
                          ? topic.baseline_daily.toFixed(0)
                          : topic.baseline_daily.toFixed(1)
                        : '<1'}
                    </div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">avg/day (7d)</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface-200/60 border border-surface-300">
                    <div
                      className={cn(
                        'text-base font-mono font-bold tabular-nums',
                        topic.revival_rate >= 10 ? 'text-gold' : 'text-for-300'
                      )}
                    >
                      {topic.revival_rate >= 100 ? '99+×' : `${topic.revival_rate}×`}
                    </div>
                    <div className="text-[10px] font-mono text-surface-600 mt-0.5">revival rate</div>
                  </div>
                </div>

                {/* CTA */}
                <Link
                  href={`/topic/${topic.id}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-for-600/10 border border-for-500/30 hover:bg-for-600/20 transition-colors group"
                  aria-label={`Join the debate on: ${topic.statement}`}
                >
                  <span className="text-xs font-mono text-for-300">Join the debate</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 text-for-400 group-hover:translate-x-0.5 transition-transform"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function GroundswellSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 md:p-5">
          <div className="flex items-start gap-3 md:gap-4">
            <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <div className="flex items-center gap-3 mt-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-12 w-14 rounded-xl flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function GroundswellPage() {
  const [data, setData] = useState<GroundswellResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'rate' | 'volume'>('rate')

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/topics/groundswell', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load groundswell data')
      const json = (await res.json()) as GroundswellResponse
      setData(json)
    } catch {
      setError('Could not load groundswell data. Try again in a moment.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const sorted = data?.awakenings
    ? [...data.awakenings].sort((a, b) =>
        sortBy === 'rate' ? b.revival_rate - a.revival_rate : b.votes_24h - a.votes_24h
      )
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12" id="main-content">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-for-500/10 border border-for-500/30">
              <Activity className="h-4 w-4 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-lg font-bold text-white">The Civic Groundswell</h1>
                {refreshing && (
                  <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin" aria-label="Refreshing" />
                )}
              </div>
              <p className="text-[11px] font-mono text-surface-600">
                Topics waking up — surge in new voter turnout vs. 7-day baseline
              </p>
            </div>
          </div>

          {/* Info strip */}
          <div className="rounded-xl bg-for-600/5 border border-for-500/20 px-4 py-3 mb-4">
            <p className="text-xs font-mono text-surface-600 leading-relaxed">
              A <span className="text-for-300 font-semibold">revival rate</span> of <span className="text-for-300">5×</span> means a topic drew 5× its usual daily votes in the past 24 hours.{' '}
              These are the civic debates that were quiet — and are now catching fire.
            </p>
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-surface-600">Sort by</span>
            <div className="flex items-center gap-1 bg-surface-200 border border-surface-300 rounded-lg p-0.5">
              <button
                onClick={() => setSortBy('rate')}
                aria-pressed={sortBy === 'rate'}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors',
                  sortBy === 'rate'
                    ? 'bg-for-600/80 text-white'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
                Revival Rate
              </button>
              <button
                onClick={() => setSortBy('volume')}
                aria-pressed={sortBy === 'volume'}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-colors',
                  sortBy === 'volume'
                    ? 'bg-for-600/80 text-white'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                <Zap className="h-3 w-3" aria-hidden="true" />
                24h Votes
              </button>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh groundswell data"
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono text-surface-500 border border-surface-300 bg-surface-200 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────── */}
        {loading ? (
          <GroundswellSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-8 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Activity}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/30"
            title="No groundswells right now"
            description="All topics are seeing their usual engagement level. Check back later — civic momentum can shift quickly."
            actions={[
              {
                label: 'View Trending',
                href: '/trending',
                icon: TrendingUp,
                variant: 'primary',
              },
              {
                label: 'Momentum Tracker',
                href: '/momentum',
                icon: Scale,
                variant: 'secondary',
              },
            ]}
            size="md"
          />
        ) : (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-surface-600">
                <span className="text-white font-semibold">{sorted.length}</span> topic{sorted.length !== 1 ? 's' : ''} awakening
              </p>
              {data?.generated_at && (
                <p className="text-[11px] font-mono text-surface-700">
                  Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            <div className="space-y-3" role="list" aria-label="Awakening topics">
              {sorted.map((topic, i) => (
                <div key={topic.id} role="listitem">
                  <GroundswellCard topic={topic} rank={i} />
                </div>
              ))}
            </div>

            {/* Related links */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { href: '/surge', label: 'Surge Board', desc: 'High-volume topics', icon: Zap },
                { href: '/momentum', label: 'Momentum', desc: 'Vote direction shifts', icon: TrendingUp },
                { href: '/shifting', label: 'Opinion Shifts', desc: 'FOR/AGAINST swings', icon: Scale },
              ].map(({ href, label, desc, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-colors group"
                >
                  <div className="flex-shrink-0 p-1.5 rounded-lg bg-surface-200 border border-surface-300 group-hover:border-surface-400 transition-colors mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-mono font-semibold text-white">{label}</p>
                    <p className="text-[11px] font-mono text-surface-600">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
