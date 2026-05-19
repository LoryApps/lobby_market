'use client'

/**
 * /convergence — The Civic Convergence Tracker
 *
 * Reveals the hidden momentum beneath the surface of civic debate.
 * By comparing the opinion split among RECENT voters (last 7 days) against
 * the platform's overall consensus, it shows two phenomena simultaneously:
 *
 * CONVERGING topics: Recent voters are doubling down on the existing majority —
 *   they're MORE aligned with one side than the overall average. These topics
 *   are building toward clear, durable consensus.
 *
 * FRACTURING topics: Recent voters are more divided than the platform average —
 *   they're challenging the existing consensus. An established majority is
 *   being eroded from within.
 *
 * Distinct from:
 *   /drift       — shows FOR% change vs all-time baseline (not consensus direction)
 *   /polarization — shows current division level (not trajectory)
 *   /momentum    — tracks vote volume/velocity, not opinion alignment
 *   /shifts      — tracks percentage-point swings, not consensus vs deadlock
 *   /groundswell — tracks dormant topics awakening (volume, not opinion)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  GitMerge,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConvergenceTopic, ConvergenceResponse } from '@/app/api/topics/convergence/route'

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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-500' },
  active:   { label: 'Active',   color: 'text-for-400' },
  voting:   { label: 'Voting',   color: 'text-purple' },
  law:      { label: 'LAW',      color: 'text-gold' },
  failed:   { label: 'Failed',   color: 'text-surface-600' },
}

function opinionLabel(pct: number): string {
  if (pct >= 75) return 'Strong FOR'
  if (pct >= 60) return 'FOR'
  if (pct >= 53) return 'Lean FOR'
  if (pct >= 47) return 'Deadlock'
  if (pct >= 40) return 'Lean AGAINST'
  if (pct >= 25) return 'AGAINST'
  return 'Strong AGAINST'
}

function opinionColor(pct: number): string {
  if (pct >= 60) return 'text-for-400'
  if (pct >= 53) return 'text-for-600'
  if (pct >= 47) return 'text-surface-500'
  if (pct >= 40) return 'text-against-600'
  return 'text-against-400'
}

// ─── Convergence Card ─────────────────────────────────────────────────────────

function ConvergenceCard({
  topic,
  rank,
  mode,
}: {
  topic: ConvergenceTopic
  rank: number
  mode: 'converging' | 'fracturing'
}) {
  const isConverging = mode === 'converging'
  const statusCfg = STATUS_CONFIG[topic.status] ?? { label: topic.status, color: 'text-surface-500' }
  const catClass = topic.category ? (CATEGORY_COLORS[topic.category] ?? 'bg-surface-200 text-surface-400 border-surface-400/30') : ''

  // Momentum display
  const momentumAbs = Math.abs(topic.convergence_momentum)
  const momentumTier = momentumAbs >= 20 ? 'extreme' : momentumAbs >= 12 ? 'strong' : momentumAbs >= 6 ? 'moderate' : 'slight'
  const momentumLabel = { extreme: 'Extreme', strong: 'Strong', moderate: 'Moderate', slight: 'Slight' }[momentumTier]

  // Overall opinion vs recent opinion
  const overallPct = Math.round(topic.blue_pct)
  const recentPct = Math.round(topic.recent_blue_pct)
  const recentAgainstPct = 100 - recentPct
  const overallAgainstPct = 100 - overallPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'block rounded-2xl bg-surface-100 border p-4 md:p-5',
          'hover:bg-surface-200/50 transition-colors group',
          isConverging
            ? 'border-for-500/20 hover:border-for-500/40'
            : 'border-against-500/20 hover:border-against-500/40'
        )}
        aria-label={topic.statement}
      >
        {/* Top row: rank + badges + momentum pill */}
        <div className="flex items-start gap-3">
          {/* Rank */}
          <span className={cn(
            'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-mono font-bold mt-0.5',
            isConverging
              ? 'bg-for-500/15 text-for-400'
              : 'bg-against-500/15 text-against-400'
          )}>
            {rank + 1}
          </span>

          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide', statusCfg.color)}>
                {statusCfg.label}
              </span>
              {topic.category && (
                <span className={cn('text-[10px] font-mono px-2 py-0.5 rounded-full border', catClass)}>
                  {topic.category}
                </span>
              )}
              {topic.scope && topic.scope !== 'Global' && (
                <span className="text-[10px] font-mono text-surface-600 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                  {topic.scope}
                </span>
              )}
            </div>

            {/* Statement */}
            <p className="text-sm font-mono text-white leading-snug group-hover:text-white/90 transition-colors mb-3 line-clamp-2">
              {topic.statement}
            </p>

            {/* Opinion comparison: overall vs recent */}
            <div className="space-y-2.5">
              {/* Overall consensus bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">Platform consensus</span>
                  <span className={cn('text-[10px] font-mono font-semibold', opinionColor(overallPct))}>
                    {opinionLabel(overallPct)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] font-mono text-for-400">{overallPct}% FOR</span>
                  <span className="text-[10px] font-mono text-against-400">{overallAgainstPct}% AGAINST</span>
                </div>
              </div>

              {/* Recent voter bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                    Recent voters (7d · {topic.recent_vote_count} votes)
                  </span>
                  <span className={cn('text-[10px] font-mono font-semibold', opinionColor(recentPct))}>
                    {opinionLabel(recentPct)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-300 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      isConverging
                        ? 'bg-gradient-to-r from-for-700 to-for-300'
                        : 'bg-gradient-to-r from-against-700 to-against-400'
                    )}
                    style={{ width: `${recentPct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[10px] font-mono text-for-400">{recentPct}% FOR</span>
                  <span className="text-[10px] font-mono text-against-400">{recentAgainstPct}% AGAINST</span>
                </div>
              </div>
            </div>
          </div>

          {/* Momentum badge */}
          <div className={cn(
            'flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-center ml-2',
            isConverging
              ? 'bg-for-500/10 border-for-500/30'
              : 'bg-against-500/10 border-against-500/30'
          )}>
            {isConverging
              ? <TrendingUp className="h-4 w-4 text-for-400" aria-hidden="true" />
              : <TrendingDown className="h-4 w-4 text-against-400" aria-hidden="true" />
            }
            <span className={cn(
              'text-base font-mono font-bold leading-none',
              isConverging ? 'text-for-300' : 'text-against-300'
            )}>
              {momentumAbs.toFixed(1)}
            </span>
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wide leading-tight',
              isConverging ? 'text-for-500' : 'text-against-500'
            )}>
              {momentumLabel}
            </span>
          </div>
        </div>

        {/* Bottom: total votes + view cue */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-300/50">
          <span className="text-[10px] font-mono text-surface-600">
            {topic.total_votes.toLocaleString()} total votes
          </span>
          <span className={cn(
            'text-[10px] font-mono flex items-center gap-1',
            isConverging ? 'text-for-500' : 'text-against-500'
          )}>
            View topic
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton cards ────────────────────────────────────────────────────────────

function CardSkeleton({ i }: { i: number }) {
  return (
    <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 md:p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-7 w-7 rounded-full flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="space-y-2 mt-3">
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
        <Skeleton className="h-16 w-16 rounded-xl flex-shrink-0" />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'converging' | 'fracturing'

export default function ConvergencePage() {
  const [data, setData] = useState<ConvergenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<Tab>('converging')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [expandedInfo, setExpandedInfo] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/topics/convergence', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch')
      const json: ConvergenceResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    refreshTimer.current = setInterval(load, 120_000)
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [load])

  // All categories present in results
  const allCategories = Array.from(
    new Set([
      ...(data?.converging ?? []).map((t) => t.category).filter(Boolean),
      ...(data?.fracturing ?? []).map((t) => t.category).filter(Boolean),
    ])
  ) as string[]

  function filtered(list: ConvergenceTopic[]) {
    if (!categoryFilter) return list
    return list.filter((t) => t.category === categoryFilter)
  }

  const currentList = filtered(tab === 'converging' ? (data?.converging ?? []) : (data?.fracturing ?? []))
  const convergingCount = filtered(data?.converging ?? []).length
  const fracturingCount = filtered(data?.fracturing ?? []).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mt-0.5">
              <GitMerge className="h-5 w-5 text-surface-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-mono font-bold text-white">Civic Convergence</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Where consensus is building — and where it&apos;s cracking.
              </p>
            </div>
          </div>

          {/* Explainer card (collapsible) */}
          <div className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden">
            <button
              onClick={() => setExpandedInfo((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-200/50 transition-colors"
              aria-expanded={expandedInfo}
            >
              <span className="text-xs font-mono text-surface-400 uppercase tracking-wide">
                How this works
              </span>
              {expandedInfo
                ? <ChevronUp className="h-4 w-4 text-surface-500" aria-hidden="true" />
                : <ChevronDown className="h-4 w-4 text-surface-500" aria-hidden="true" />
              }
            </button>
            <AnimatePresence>
              {expandedInfo && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 grid sm:grid-cols-2 gap-4 text-xs font-mono text-surface-500 border-t border-surface-300">
                    <div className="pt-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
                        <span className="text-for-400 font-semibold">Converging topics</span>
                      </div>
                      <p>
                        Recent voters (last 7 days) are <em>more</em> aligned with one side than
                        the platform&apos;s overall average. The majority is being reinforced —
                        these topics are building toward durable consensus.
                      </p>
                    </div>
                    <div className="pt-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <TrendingDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
                        <span className="text-against-400 font-semibold">Fracturing topics</span>
                      </div>
                      <p>
                        Recent voters are <em>less</em> aligned than the platform average — they&apos;re
                        more evenly split, pushing the debate back toward deadlock. An existing
                        consensus is being challenged from within.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-4" role="tablist" aria-label="Convergence type">
          <button
            role="tab"
            aria-selected={tab === 'converging'}
            onClick={() => setTab('converging')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
              tab === 'converging'
                ? 'bg-for-600/20 border-for-500/50 text-for-300'
                : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            Converging
            {!loading && data && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-for-600/30 text-for-300 text-[10px]">
                {convergingCount}
              </span>
            )}
          </button>
          <button
            role="tab"
            aria-selected={tab === 'fracturing'}
            onClick={() => setTab('fracturing')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
              tab === 'fracturing'
                ? 'bg-against-600/20 border-against-500/50 text-against-300'
                : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            Fracturing
            {!loading && data && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-against-600/30 text-against-300 text-[10px]">
                {fracturingCount}
              </span>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh convergence data"
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-100 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden="true" />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* ── Category filter pills ── */}
        {!loading && allCategories.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="Filter by category">
            <button
              onClick={() => setCategoryFilter(null)}
              className={cn(
                'px-3 py-1 rounded-full text-[11px] font-mono border transition-all',
                !categoryFilter
                  ? 'bg-surface-300 border-surface-400 text-white'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
              aria-pressed={!categoryFilter}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-[11px] font-mono border transition-all',
                  categoryFilter === cat
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
                aria-pressed={categoryFilter === cat}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="space-y-3" aria-live="polite" aria-label="Loading convergence data">
            {Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} i={i} />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-against-500/10 border border-against-500/30 flex items-center justify-center">
              <Activity className="h-6 w-6 text-against-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-white font-mono text-sm font-semibold mb-1">Could not load convergence data</p>
              <p className="text-surface-500 font-mono text-xs">Something went wrong. Try again in a moment.</p>
            </div>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : currentList.length === 0 ? (
          <EmptyState
            icon={tab === 'converging' ? TrendingUp : TrendingDown}
            iconColor={tab === 'converging' ? 'text-for-400' : 'text-against-400'}
            iconBg={tab === 'converging' ? 'bg-for-500/10' : 'bg-against-500/10'}
            iconBorder={tab === 'converging' ? 'border-for-500/30' : 'border-against-500/30'}
            title={
              tab === 'converging'
                ? categoryFilter
                  ? `No converging topics in ${categoryFilter} right now`
                  : 'No convergence detected right now'
                : categoryFilter
                  ? `No fracturing topics in ${categoryFilter} right now`
                  : 'No fracturing detected right now'
            }
            description={
              tab === 'converging'
                ? 'Consensus is stable — recent voters are moving in line with the overall split. Check back as new votes come in.'
                : 'No established consensus is being challenged right now. The platform is in equilibrium.'
            }
            actions={[
              { label: 'Opinion Drift', href: '/drift', icon: BarChart2, variant: 'primary' },
              { label: 'Shifting', href: '/shifting', icon: Scale, variant: 'secondary' },
            ]}
            size="md"
          />
        ) : (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-mono text-surface-600">
                <span className="text-white font-semibold">{currentList.length}</span> topic{currentList.length !== 1 ? 's' : ''}
                {' '}
                {tab === 'converging' ? 'building consensus' : 'losing consensus'}
              </p>
              {data?.generated_at && (
                <p className="text-[11px] font-mono text-surface-700">
                  Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            <div className="space-y-3" role="list" aria-label={`${tab === 'converging' ? 'Converging' : 'Fracturing'} topics`}>
              {currentList.map((topic, i) => (
                <div key={topic.id} role="listitem">
                  <ConvergenceCard topic={topic} rank={i} mode={tab} />
                </div>
              ))}
            </div>

            {/* Related links */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { href: '/drift',      label: 'Opinion Drift',      desc: 'FOR% vs all-time baseline', icon: BarChart2 },
                { href: '/polarization', label: 'Polarization Index', desc: 'Current division levels',  icon: Scale },
                { href: '/momentum',   label: 'Momentum',           desc: 'Vote volume & velocity',    icon: Zap },
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
