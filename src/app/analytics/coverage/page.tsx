'use client'

/**
 * /analytics/coverage — Civic Coverage
 *
 * Answers the question: of everything the Lobby debates, what share are you
 * actually participating in?
 *
 * Coverage % = user's votes / total platform topics.
 * Broken down by category, with a monthly growth trend and suggestions for
 * the least-explored category.
 *
 * Distinct from:
 *   /analytics/diversity  — balance/entropy across categories (Shannon score)
 *   /analytics/engagement — general activity level (streak, frequency)
 *   /analytics/fingerprint — deviation from consensus, not participation rate
 *   /analytics/territory   — geographic and topic-domain ownership
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Compass,
  ExternalLink,
  Flame,
  Globe,
  Info,
  Map,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CoverageData, CategoryCoverage, CoverageTier } from '@/app/api/analytics/coverage/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   '#c9a84c',
  Politics:    '#3b82f6',
  Technology:  '#8b5cf6',
  Science:     '#10b981',
  Ethics:      '#ef4444',
  Philosophy:  '#a78bfa',
  Culture:     '#f59e0b',
  Health:      '#ec4899',
  Environment: '#22c55e',
  Education:   '#06b6d4',
}

const TIER_META: Record<CoverageTier, { color: string; bg: string; border: string; icon: typeof Globe }> = {
  'Lurker':          { color: 'text-surface-500',  bg: 'bg-surface-300/10',  border: 'border-surface-400/20',  icon: Globe },
  'Observer':        { color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/20',          icon: Compass },
  'Participant':     { color: 'text-for-400',       bg: 'bg-for-500/10',       border: 'border-for-500/20',       icon: Zap },
  'Engaged Citizen': { color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/20',       icon: Target },
  'Civic Stalwart':  { color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/20',        icon: Flame },
  'Omnivote':        { color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/20',          icon: Sparkles },
}

const STATUS_COLOR: Record<string, string> = {
  active:   'text-for-400',
  voting:   'text-purple',
  law:      'text-gold',
  proposed: 'text-surface-500',
  failed:   'text-against-400',
}

const STATUS_LABEL: Record<string, string> = {
  active:   'Active',
  voting:   'Voting',
  law:      'LAW',
  proposed: 'Proposed',
  failed:   'Failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(n: number): string {
  if (n === 0) return '0%'
  if (n < 1) return '<1%'
  return `${n.toFixed(1)}%`
}

function fmtMonth(ym: string): string {
  const [year, month] = ym.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ─── Coverage Meter ───────────────────────────────────────────────────────────

function CoverageMeter({ pct, size = 140 }: { pct: number; size?: number }) {
  const r = (size - 20) / 2
  const circ = 2 * Math.PI * r
  const filled = Math.min(pct / 100, 1) * circ
  const cx = size / 2
  const cy = size / 2

  const color =
    pct >= 80 ? '#f59e0b' :
    pct >= 55 ? '#8b5cf6' :
    pct >= 30 ? '#10b981' :
    pct >= 15 ? '#3b82f6' :
    pct >= 5  ? '#c9a84c' : '#71717a'

  return (
    <svg width={size} height={size} className="drop-shadow-lg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#24242e" strokeWidth={14} />
      <circle
        cx={cx} cy={cy} r={r}
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="white" fontSize={size > 100 ? 24 : 18} fontWeight="bold" fontFamily="monospace">
        {pct < 1 ? '<1' : Math.floor(pct)}%
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#71717a" fontSize={10} fontFamily="monospace">
        coverage
      </text>
    </svg>
  )
}

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: CoverageData['monthly'] }) {
  if (data.length === 0) return null

  const maxVal = Math.max(...data.map((d) => d.cumulative_votes), 1)
  const barW = Math.max(8, Math.min(24, Math.floor(240 / data.length) - 2))
  const chartH = 60

  return (
    <div className="flex items-end gap-0.5 h-16 mt-2 overflow-hidden" style={{ maxWidth: '100%' }}>
      {data.map((d, i) => {
        const barH = Math.max(2, (d.cumulative_votes / maxVal) * chartH)
        const isLast = i === data.length - 1
        return (
          <div key={d.month} className="flex flex-col items-center gap-0.5 group" style={{ minWidth: barW }}>
            <div
              className={cn(
                'rounded-t transition-all',
                isLast ? 'bg-for-500' : 'bg-surface-300 group-hover:bg-for-500/60'
              )}
              style={{ width: barW, height: barH }}
              title={`${fmtMonth(d.month)}: ${d.cumulative_votes} topics`}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Category Row ─────────────────────────────────────────────────────────────

function CategoryRow({ row, rank }: { row: CategoryCoverage; rank: number }) {
  const color = CATEGORY_COLOR[row.category] ?? '#71717a'
  const pct = row.coverage_pct

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.04 }}
      className="flex items-center gap-3 py-2.5 border-b border-surface-200/40 last:border-0"
    >
      <div className="w-5 text-right">
        <span className="text-[11px] font-mono text-surface-500">{rank}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[13px] font-mono font-medium" style={{ color }}>
            {row.category}
          </span>
          <span className="text-[12px] font-mono text-white ml-2 shrink-0">
            {row.user_votes}/{row.total_topics}
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, delay: rank * 0.04, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
      <div className="w-12 text-right shrink-0">
        <span className="text-[12px] font-mono text-white">{fmtPct(pct)}</span>
      </div>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoveragePage() {
  const router = useRouter()
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTooltip, setShowTooltip] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/coverage', {
        signal: abortRef.current.signal,
        cache: 'no-store',
      })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load coverage data')
      setData(await res.json() as CoverageData)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Could not load coverage data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const tierMeta = data ? TIER_META[data.tier] : null
  const TierIcon = tierMeta?.icon ?? Globe

  // Comparison label
  function compLabel(): string {
    if (!data) return ''
    const diff = data.coverage_pct - data.platform_avg_coverage_pct
    if (Math.abs(diff) < 1) return 'exactly average'
    if (diff > 0) return `${fmtPct(diff)} above average`
    return `${fmtPct(Math.abs(diff))} below average`
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back */}
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Analytics
        </Link>

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 shrink-0">
            <Map className="h-5 w-5 text-for-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white leading-tight">
              Civic Coverage
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-1">
              Of all the Lobby debates, how many have you weighed in on?
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40"
            aria-label="Refresh coverage data"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-against-500/10 border border-against-500/20 text-sm font-mono text-against-400">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.total_user_votes === 0 && (
          <EmptyState
            icon={Map}
            title="No votes yet"
            description="Cast your first vote on a topic to start tracking your civic coverage."
            action={{ label: 'Explore topics', href: '/' }}
          />
        )}

        {/* Content */}
        {data && data.total_user_votes > 0 && (
          <div className="space-y-5">

            {/* Hero: meter + tier */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-surface-100 border border-surface-200/60 p-6"
            >
              <div className="flex items-center gap-6">
                <CoverageMeter pct={data.coverage_pct} />
                <div className="flex-1 min-w-0">
                  {/* Tier badge */}
                  {tierMeta && (
                    <div className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border mb-2',
                      tierMeta.color, tierMeta.bg, tierMeta.border
                    )}>
                      <TierIcon className="h-3 w-3" />
                      {data.tier}
                    </div>
                  )}
                  <p className="text-xs font-mono text-surface-500 leading-relaxed mb-3">
                    {data.tier_desc}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                    <BarChart2 className="h-3 w-3 shrink-0" />
                    <span>
                      {data.total_user_votes.toLocaleString()} of {data.total_platform_topics.toLocaleString()} topics voted on
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 mt-1">
                    <TrendingUp className="h-3 w-3 shrink-0" />
                    <span>You are {compLabel()}</span>
                  </div>
                </div>
              </div>

              {/* Progress to next tier */}
              {data.tier_next && data.pct_to_next_tier !== null && (
                <div className="mt-5 pt-4 border-t border-surface-200/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono text-surface-500">
                      Next: <span className="text-white">{data.tier_next}</span>
                    </span>
                    <span className="text-[11px] font-mono text-surface-500">
                      {fmtPct(data.pct_to_next_tier)} more coverage needed
                    </span>
                  </div>
                  <div className="relative h-1 rounded-full bg-surface-300/50 overflow-hidden">
                    {(() => {
                      const tierDef: Record<string, number> = {
                        'Lurker': 0, 'Observer': 5, 'Participant': 15,
                        'Engaged Citizen': 30, 'Civic Stalwart': 55, 'Omnivote': 80,
                      }
                      const min = tierDef[data.tier] ?? 0
                      const max = tierDef[data.tier_next ?? 'Omnivote'] ?? 100
                      const withinTier = Math.min(1, (data.coverage_pct - min) / (max - min))
                      return (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${withinTier * 100}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="absolute inset-y-0 left-0 rounded-full bg-for-500"
                        />
                      )
                    })()}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Category breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl bg-surface-100 border border-surface-200/60 p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-for-400" />
                  <h2 className="text-sm font-mono font-semibold text-white">Coverage by category</h2>
                </div>
                <button
                  onClick={() => setShowTooltip((v) => !v)}
                  className="text-surface-500 hover:text-white transition-colors"
                  aria-label="What does this mean?"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>

              <AnimatePresence>
                {showTooltip && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-surface-200/60 border border-surface-300/40 text-[11px] font-mono text-surface-500 leading-relaxed overflow-hidden"
                  >
                    Coverage % = your votes ÷ total topics in that category.
                    A score of 100% means you&apos;ve voted on every topic in
                    that category. Platform average is shown for context.
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="divide-y divide-surface-200/30">
                {data.by_category.filter((c) => c.total_topics > 0).map((row, i) => (
                  <CategoryRow key={row.category} row={row} rank={i + 1} />
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-surface-200/40 flex items-center justify-between text-[11px] font-mono text-surface-500">
                <span>Platform average coverage</span>
                <span className="text-white">{fmtPct(data.platform_avg_coverage_pct)}</span>
              </div>
            </motion.div>

            {/* Monthly trend */}
            {data.monthly.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-200/60 p-5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-for-400" />
                  <h2 className="text-sm font-mono font-semibold text-white">Cumulative topics voted</h2>
                </div>
                <p className="text-[11px] font-mono text-surface-500 mb-3">
                  All-time growth of your civic footprint
                </p>
                <MiniBarChart data={data.monthly} />
                <div className="flex items-center justify-between mt-3 text-[11px] font-mono text-surface-500">
                  <span>{fmtMonth(data.monthly[0].month)}</span>
                  <span>{fmtMonth(data.monthly.at(-1)!.month)}</span>
                </div>
                {data.monthly.length > 0 && (
                  <p className="text-[11px] font-mono text-surface-500 mt-2">
                    +{data.monthly.at(-1)!.votes_in_month} topics this month
                  </p>
                )}
              </motion.div>
            )}

            {/* Unexplored territory */}
            {data.least_covered_category && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-200/60 p-5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Compass className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-semibold text-white">Unexplored territory</h2>
                </div>
                <p className="text-[11px] font-mono text-surface-500 mb-4">
                  Your least covered category is{' '}
                  <span style={{ color: CATEGORY_COLOR[data.least_covered_category] ?? '#71717a' }}>
                    {data.least_covered_category}
                  </span>
                  {data.by_category.find((c) => c.category === data.least_covered_category)
                    ? ` — ${fmtPct(data.by_category.find((c) => c.category === data.least_covered_category)!.coverage_pct)} coverage`
                    : ''}
                  . Explore it to grow your civic surface area.
                </p>

                {data.unvoted_suggestions.length > 0 ? (
                  <div className="space-y-2">
                    {data.unvoted_suggestions.map((topic) => {
                      const pct = Math.round(topic.blue_pct)
                      return (
                        <Link
                          key={topic.id}
                          href={`/topic/${topic.id}`}
                          className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/40 hover:border-for-500/40 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
                              {topic.statement}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={cn('text-[10px] font-mono', STATUS_COLOR[topic.status] ?? 'text-surface-500')}>
                                {STATUS_LABEL[topic.status] ?? topic.status}
                              </span>
                              <span className="text-[10px] font-mono text-surface-500">
                                {topic.total_votes.toLocaleString()} votes
                              </span>
                              <span className="text-[10px] font-mono text-for-400">{pct}% For</span>
                            </div>
                          </div>
                          <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors shrink-0 mt-0.5" />
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <Link
                    href={`/categories/${data.least_covered_category}`}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                  >
                    Browse {data.least_covered_category} topics
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}

                <Link
                  href={`/categories/${data.least_covered_category}`}
                  className="mt-3 flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  All {data.least_covered_category} debates
                </Link>
              </motion.div>
            )}

            {/* Related analytics */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-surface-100 border border-surface-200/60 p-5"
            >
              <h2 className="text-sm font-mono font-semibold text-white mb-3">Related analytics</h2>
              <div className="space-y-2">
                {[
                  { href: '/analytics/diversity', label: 'Civic Diversity', desc: 'Balance and independence of your votes' },
                  { href: '/analytics/engagement', label: 'Engagement', desc: 'Activity streaks and frequency' },
                  { href: '/analytics/fingerprint', label: 'Civic Fingerprint', desc: 'How your votes deviate from consensus' },
                  { href: '/analytics/territory', label: 'Territory', desc: 'Your strongest policy domains' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/30 hover:border-for-500/30 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-medium text-white group-hover:text-for-300 transition-colors">
                        {link.label}
                      </p>
                      <p className="text-[11px] font-mono text-surface-500">{link.desc}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-white transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </motion.div>

          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
