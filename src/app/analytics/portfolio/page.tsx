'use client'

/**
 * /analytics/portfolio — Civic Vote Portfolio
 *
 * Treats every vote as a civic "position" — like a Polymarket portfolio.
 * Open positions are still-active topics. Closed positions resolved as:
 *   • Won      — voted FOR, topic became Law
 *   • Right Call — voted AGAINST, topic failed
 *   • Missed   — voted AGAINST, topic became Law (bad call)
 *   • Lost     — voted FOR, topic failed
 *
 * Distinct from:
 *   /analytics/votes     — vote timing patterns (when you vote)
 *   /analytics/accuracy  — prediction market accuracy
 *   /analytics/laws      — platform-wide law statistics
 *   /analytics/impact    — argument influence metrics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Gavel,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  PortfolioAPIResponse,
  PortfolioResponse,
  Position,
  CategoryStat,
  PositionResult,
} from '@/app/api/analytics/portfolio/route'

// ─── Result config ─────────────────────────────────────────────────────────────

const RESULT_CONFIG: Record<
  PositionResult,
  {
    label: string
    shortLabel: string
    icon: typeof CheckCircle2
    color: string
    bg: string
    border: string
    badgeVariant: 'active' | 'proposed' | 'law' | 'failed'
  }
> = {
  won: {
    label: 'Won',
    shortLabel: 'Won',
    icon: CheckCircle2,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    badgeVariant: 'law',
  },
  right_call: {
    label: 'Right Call',
    shortLabel: 'Right Call',
    icon: Trophy,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badgeVariant: 'active',
  },
  missed: {
    label: 'Missed',
    shortLabel: 'Missed',
    icon: TrendingDown,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    badgeVariant: 'failed',
  },
  lost: {
    label: 'Lost',
    shortLabel: 'Lost',
    icon: XCircle,
    color: 'text-surface-500',
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/40',
    badgeVariant: 'failed',
  },
  open: {
    label: 'Open',
    shortLabel: 'Open',
    icon: Circle,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    badgeVariant: 'proposed',
  },
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function accuracyColor(pct: number | null): string {
  if (pct === null) return 'text-surface-500'
  if (pct >= 70) return 'text-emerald'
  if (pct >= 50) return 'text-for-400'
  if (pct >= 35) return 'text-gold'
  return 'text-against-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
  delay,
}: {
  label: string
  value: number | string
  sub?: string
  color: string
  icon: React.ElementType
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className={cn('text-3xl font-mono font-bold', color)}>
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && <p className="text-xs font-mono text-surface-500">{sub}</p>}
    </motion.div>
  )
}

function PositionRow({ position, rank }: { position: Position; rank?: number }) {
  const rc = RESULT_CONFIG[position.result]
  const Icon = rc.icon
  const forPct = Math.round(position.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${position.topic_id}`}
      className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200/80 transition-colors group"
    >
      {rank !== undefined && (
        <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-surface-300/60 text-[10px] font-mono text-surface-500 mt-0.5">
          {rank}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {position.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {position.category && (
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
              {position.category}
            </span>
          )}
          <Badge variant={STATUS_BADGE[position.status] ?? 'proposed'} size="xs">
            {STATUS_LABEL[position.status] ?? position.status}
          </Badge>
          <span className={cn('flex items-center gap-1 text-[10px] font-mono', position.side === 'blue' ? 'text-for-400' : 'text-against-400')}>
            {position.side === 'blue' ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
            {position.side === 'blue' ? 'FOR' : 'AGAINST'}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
        <div className={cn('flex items-center gap-1 text-xs font-mono font-semibold', rc.color)}>
          <Icon className="h-3 w-3" />
          {rc.shortLabel}
        </div>
        <div className="text-[10px] font-mono text-surface-500">
          <span className="text-for-400">{forPct}%</span>
          {' · '}
          <span className="text-against-400">{againstPct}%</span>
        </div>
        <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </Link>
  )
}

function CategoryBar({ stat, max }: { stat: CategoryStat; max: number }) {
  const pct = max > 0 ? (stat.total / max) * 100 : 0
  const resolvedCount = stat.won + stat.lost + stat.right_call + stat.missed

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono text-white truncate">{stat.category}</span>
          <span className="text-[10px] font-mono text-surface-500">{stat.total} votes</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {stat.win_rate !== null && (
            <span className={cn('text-xs font-mono font-bold', accuracyColor(stat.win_rate))}>
              {stat.win_rate}%
            </span>
          )}
          {stat.open > 0 && (
            <span className="text-[10px] font-mono text-gold">{stat.open} open</span>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-300/60 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full flex"
        >
          {resolvedCount > 0 && (
            <>
              <div
                style={{ width: `${((stat.won + stat.right_call) / resolvedCount) * 100}%` }}
                className="bg-emerald h-full"
              />
              <div
                style={{ width: `${((stat.lost + stat.missed) / resolvedCount) * 100}%` }}
                className="bg-against-500/60 h-full"
              />
            </>
          )}
          {resolvedCount === 0 && stat.open > 0 && (
            <div className="bg-gold/60 h-full w-full" />
          )}
        </motion.div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'open' | 'closed' | 'categories'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortfolioPage() {
  const router = useRouter()
  const [data, setData] = useState<PortfolioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('open')
  const [closedFilter, setClosedFilter] = useState<PositionResult | 'all'>('all')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/portfolio', { cache: 'no-store' })
      const json = (await res.json()) as PortfolioAPIResponse
      if (!json.authenticated) {
        router.push('/login')
        return
      }
      setData(json)
    } catch {
      setError('Failed to load portfolio')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const filteredClosed = data
    ? closedFilter === 'all'
      ? data.closed_positions
      : data.closed_positions.filter((p) => p.result === closedFilter)
    : []

  const maxCatTotal = data
    ? Math.max(...data.category_stats.map((s) => s.total), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 flex items-start justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors"
              aria-label="Back to Analytics"
            >
              <ArrowLeft className="h-4 w-4 text-surface-500" />
            </Link>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Portfolio</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Your votes as civic positions — open, won, lost, and right calls
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh portfolio"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-500', refreshing && 'animate-spin')} />
          </button>
        </motion.div>

        {/* ── Loading / Error ──────────────────────────────────────────────────── */}
        {loading && <LoadingSkeleton />}

        {error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">

            {/* ── Summary cards ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryCard
                label="Positions"
                value={data.summary.total_positions}
                sub={`${data.summary.resolved} resolved`}
                color="text-white"
                icon={BarChart2}
                delay={0}
              />
              <SummaryCard
                label="Accuracy"
                value={
                  data.summary.overall_accuracy !== null
                    ? `${data.summary.overall_accuracy}%`
                    : '—'
                }
                sub={data.summary.resolved > 0 ? `${data.summary.won + data.summary.right_call} correct` : 'no resolved positions'}
                color={accuracyColor(data.summary.overall_accuracy)}
                icon={Trophy}
                delay={0.05}
              />
              <SummaryCard
                label="Won"
                value={data.summary.won}
                sub={`+ ${data.summary.right_call} right calls`}
                color="text-emerald"
                icon={CheckCircle2}
                delay={0.1}
              />
              <SummaryCard
                label="Open"
                value={data.summary.open}
                sub="still active/voting"
                color="text-gold"
                icon={Zap}
                delay={0.15}
              />
            </div>

            {/* ── Accuracy breakdown ────────────────────────────────────────────── */}
            {data.summary.resolved > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-4">
                  Portfolio Breakdown
                </p>
                <div className="flex h-3 rounded-full overflow-hidden bg-surface-300/60 mb-3">
                  {data.summary.won > 0 && (
                    <div
                      style={{ width: `${(data.summary.won / data.summary.resolved) * 100}%` }}
                      className="bg-emerald"
                      title={`Won: ${data.summary.won}`}
                    />
                  )}
                  {data.summary.right_call > 0 && (
                    <div
                      style={{ width: `${(data.summary.right_call / data.summary.resolved) * 100}%` }}
                      className="bg-for-500"
                      title={`Right Call: ${data.summary.right_call}`}
                    />
                  )}
                  {data.summary.missed > 0 && (
                    <div
                      style={{ width: `${(data.summary.missed / data.summary.resolved) * 100}%` }}
                      className="bg-against-500/70"
                      title={`Missed: ${data.summary.missed}`}
                    />
                  )}
                  {data.summary.lost > 0 && (
                    <div
                      style={{ width: `${(data.summary.lost / data.summary.resolved) * 100}%` }}
                      className="bg-surface-500"
                      title={`Lost: ${data.summary.lost}`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {[
                    { key: 'won', label: 'Won', count: data.summary.won, color: 'bg-emerald' },
                    { key: 'right_call', label: 'Right Call', count: data.summary.right_call, color: 'bg-for-500' },
                    { key: 'missed', label: 'Missed', count: data.summary.missed, color: 'bg-against-500/70' },
                    { key: 'lost', label: 'Lost', count: data.summary.lost, color: 'bg-surface-500' },
                  ].map(({ key, label, count, color }) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', color)} />
                      <span className="text-xs font-mono text-surface-400">{label}</span>
                      <span className="text-xs font-mono font-bold text-white">{count}</span>
                    </div>
                  ))}
                </div>
                {data.summary.law_accuracy !== null && (
                  <p className="mt-3 text-xs font-mono text-surface-500">
                    Law accuracy:{' '}
                    <span className={cn('font-bold', accuracyColor(data.summary.law_accuracy))}>
                      {data.summary.law_accuracy}%
                    </span>
                    {' '}of topics you voted FOR became Law
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Top wins ──────────────────────────────────────────────────────── */}
            {data.top_wins.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.25 }}
                className="rounded-2xl bg-surface-100 border border-emerald/20 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Gavel className="h-4 w-4 text-emerald" />
                  <p className="text-sm font-mono font-semibold text-white">Top Wins</p>
                  <span className="text-[10px] font-mono text-surface-500">Topics you backed that became Law</span>
                </div>
                <div className="space-y-2">
                  {data.top_wins.map((p, i) => (
                    <PositionRow key={p.vote_id} position={p} rank={i + 1} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Tabs ──────────────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3 }}
            >
              <div className="flex gap-1 p-1 rounded-xl bg-surface-200/60 border border-surface-300/60 mb-4">
                {([
                  { id: 'open', label: `Open (${data.summary.open})`, icon: Zap },
                  { id: 'closed', label: `History (${data.summary.resolved})`, icon: BookOpen },
                  { id: 'categories', label: 'Categories', icon: BarChart2 },
                ] as Array<{ id: Tab; label: string; icon: React.ElementType }>).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all',
                      tab === id
                        ? 'bg-surface-100 text-white border border-surface-300'
                        : 'text-surface-500 hover:text-white'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {/* Open positions */}
              <AnimatePresence mode="wait">
                {tab === 'open' && (
                  <motion.div
                    key="open"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2"
                  >
                    {data.open_positions.length === 0 ? (
                      <EmptyState
                        icon={Scale}
                        title="No open positions"
                        description="Vote on active topics to build your civic portfolio."
                        action={{ label: 'Browse Topics', href: '/topics' }}
                      />
                    ) : (
                      <>
                        <p className="text-[11px] font-mono text-surface-500 mb-3">
                          {data.open_positions.length} open positions — FOR sorted by consensus proximity, AGAINST by divergence
                        </p>
                        {data.open_positions.map((p) => (
                          <PositionRow key={p.vote_id} position={p} />
                        ))}
                      </>
                    )}
                  </motion.div>
                )}

                {/* Closed positions */}
                {tab === 'closed' && (
                  <motion.div
                    key="closed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Filter pills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(['all', 'won', 'right_call', 'missed', 'lost'] as const).map((f) => {
                        const count = f === 'all'
                          ? data.summary.resolved
                          : data.summary[f === 'right_call' ? 'right_call' : f]
                        return (
                          <button
                            key={f}
                            onClick={() => setClosedFilter(f)}
                            className={cn(
                              'px-3 py-1 rounded-lg text-xs font-mono transition-all border',
                              closedFilter === f
                                ? f === 'all'
                                  ? 'bg-surface-300 text-white border-surface-400'
                                  : cn(RESULT_CONFIG[f as PositionResult].bg, RESULT_CONFIG[f as PositionResult].color, RESULT_CONFIG[f as PositionResult].border)
                                : 'bg-surface-200/60 text-surface-500 border-surface-300/60 hover:text-white'
                            )}
                          >
                            {f === 'all' ? `All (${count})` : `${RESULT_CONFIG[f as PositionResult].label} (${count})`}
                          </button>
                        )
                      })}
                    </div>
                    <div className="space-y-2">
                      {filteredClosed.length === 0 ? (
                        <EmptyState
                          icon={BookOpen}
                          title="No closed positions yet"
                          description="Positions close when topics become Law or fail. Keep voting to build history."
                        />
                      ) : (
                        filteredClosed.map((p) => (
                          <PositionRow key={p.vote_id} position={p} />
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Category breakdown */}
                {tab === 'categories' && (
                  <motion.div
                    key="categories"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                  >
                    {data.category_stats.length === 0 ? (
                      <EmptyState
                        icon={BarChart2}
                        title="No category data"
                        description="Vote on topics in different categories to see your breakdown."
                      />
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                            Category Allocation
                          </p>
                          <div className="flex items-center gap-3 text-[10px] font-mono text-surface-500">
                            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald" /> Correct</span>
                            <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-against-500/70" /> Incorrect</span>
                          </div>
                        </div>
                        <div className="space-y-4">
                          {data.category_stats.map((stat) => (
                            <CategoryBar key={stat.category} stat={stat} max={maxCatTotal} />
                          ))}
                        </div>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── Biggest misses ─────────────────────────────────────────────────── */}
            {data.biggest_misses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.35 }}
                className="rounded-2xl bg-surface-100 border border-against-500/20 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="h-4 w-4 text-against-400" />
                  <p className="text-sm font-mono font-semibold text-white">Biggest Misses</p>
                  <span className="text-[10px] font-mono text-surface-500">Laws you voted AGAINST that passed</span>
                </div>
                <div className="space-y-2">
                  {data.biggest_misses.map((p, i) => (
                    <PositionRow key={p.vote_id} position={p} rank={i + 1} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── CTA row ───────────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <Link
                href="/surge"
                className="flex items-center justify-between p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-4 w-4 text-for-400" />
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">Surge Topics</p>
                    <p className="text-[11px] font-mono text-surface-500">Topics nearing Law status</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 transition-colors" />
              </Link>
              <Link
                href="/analytics"
                className="flex items-center justify-between p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400/60 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <BarChart2 className="h-4 w-4 text-surface-500" />
                  <div>
                    <p className="text-sm font-mono font-semibold text-white">All Analytics</p>
                    <p className="text-[11px] font-mono text-surface-500">Your full civic dashboard</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
              </Link>
            </motion.div>

          </div>
        )}

        {!loading && !error && !data && (
          <EmptyState
            icon={BarChart2}
            title="No portfolio data"
            description="Start voting on topics to build your civic investment portfolio."
            action={{ label: 'Browse Topics', href: '/topics' }}
          />
        )}

      </main>
      <BottomNav />
    </div>
  )
}
