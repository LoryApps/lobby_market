'use client'

/**
 * /analytics/laws — Law Impact Analytics
 *
 * Platform-wide stats on every established law:
 *   - Total laws, pace this month/week
 *   - Vote margin distribution (decisive / competitive / close)
 *   - Category breakdown (which domains pass the most legislation)
 *   - Monthly establishment timeline
 *   - Top laws by argument engagement and total votes
 *   - Recent law feed
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LawAnalyticsResponse,
  LawEntry,
  LawCategoryStat,
  LawMonthlyPoint,
} from '@/app/api/analytics/laws/route'

// ─── Category colour map (matches existing Tailwind theme tokens) ─────────────────

const CATEGORY_COLOR: Record<string, string> = {
  Economics:    'bg-gold/30 text-gold',
  Politics:     'bg-for-500/30 text-for-300',
  Technology:   'bg-purple/30 text-purple',
  Science:      'bg-emerald/30 text-emerald',
  Ethics:       'bg-against-500/30 text-against-300',
  Philosophy:   'bg-purple/25 text-purple',
  Culture:      'bg-gold/25 text-gold',
  Health:       'bg-emerald/25 text-emerald',
  Environment:  'bg-emerald/20 text-emerald',
  Education:    'bg-for-500/20 text-for-400',
}

const CAT_BAR_COLOR: Record<string, string> = {
  Economics:    'bg-gold',
  Politics:     'bg-for-500',
  Technology:   'bg-purple',
  Science:      'bg-emerald',
  Ethics:       'bg-against-500',
  Philosophy:   'bg-purple',
  Culture:      'bg-gold',
  Health:       'bg-emerald',
  Environment:  'bg-emerald',
  Education:    'bg-for-400',
}

function catBadge(cat: string | null): string {
  return CATEGORY_COLOR[cat ?? ''] ?? 'bg-surface-300/40 text-surface-500'
}

function catBar(cat: string | null): string {
  return CAT_BAR_COLOR[cat ?? ''] ?? 'bg-surface-400'
}

// ─── Margin label ───────────────────────────────────────────────────────────────────────

function marginLabel(bluePct: number): { label: string; color: string } {
  const margin = Math.abs(bluePct - 50)
  if (margin >= 15) return { label: 'Decisive', color: 'text-gold' }
  if (margin >= 5) return { label: 'Competitive', color: 'text-for-300' }
  return { label: 'Close Call', color: 'text-against-300' }
}

// ─── Relative time ─────────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const w = Math.floor(d / 7)
  const mo = Math.floor(d / 30)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (w < 5) return `${w}w ago`
  if (mo < 12) return `${mo}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Stat card ──────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delay = 0,
}: {
  label: string
  value: number
  sub: string
  icon: typeof Gavel
  color: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-1"
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('text-2xl font-mono font-bold', color)}>
        <AnimatedNumber value={value} />
      </p>
      <p className="text-xs text-surface-500 font-mono">{sub}</p>
    </motion.div>
  )
}

// ─── Law row ───────────────────────────────────────────────────────────────────────────

function LawRow({ law, rank }: { law: LawEntry; rank: number }) {
  const forPct = Math.round(law.blue_pct)
  const { label: mLabel, color: mColor } = marginLabel(law.blue_pct)

  return (
    <Link
      href={`/topic/${law.id}`}
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-200/50 transition-colors border-b border-surface-300 last:border-0 group"
    >
      <span className="text-xs font-mono text-surface-500 w-5 pt-0.5 flex-shrink-0 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
          {law.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {law.category && (
            <span className={cn('text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md', catBadge(law.category))}>
              {law.category}
            </span>
          )}
          <span className={cn('text-[10px] font-mono font-semibold', mColor)}>{mLabel}</span>
          <span className="text-[10px] font-mono text-surface-500">{relTime(law.updated_at)}</span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right space-y-1">
        <p className="text-xs font-mono font-bold text-gold">{forPct}% FOR</p>
        <p className="text-[10px] font-mono text-surface-500">{law.total_votes.toLocaleString()} votes</p>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5 group-hover:text-gold transition-colors" />
    </Link>
  )
}

// ─── Category bar ────────────────────────────────────────────────────────────────────────

function CategoryBar({ stat, maxCount }: { stat: LawCategoryStat; maxCount: number }) {
  const widthPct = maxCount > 0 ? (stat.count / maxCount) * 100 : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-semibold text-surface-600">{stat.category}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-surface-500">{stat.avg_margin}° avg margin</span>
          <span className="text-xs font-mono font-bold text-white">{stat.count}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-300/60 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
          className={cn('h-full rounded-full', catBar(stat.category))}
        />
      </div>
    </div>
  )
}

// ─── Monthly bar ─────────────────────────────────────────────────────────────────────────

function MonthlyTimeline({ points }: { points: LawMonthlyPoint[] }) {
  if (points.length === 0) return null

  const maxCount = Math.max(...points.map((p) => p.count), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="h-4 w-4 text-gold" />
        <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
          Law Establishment Timeline
        </h3>
      </div>
      <div className="flex items-end gap-1 h-28">
        {points.map((p) => {
          const h = maxCount > 0 ? (p.count / maxCount) * 100 : 0
          return (
            <div key={p.month_key} className="flex-1 flex flex-col items-center gap-1 group">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="w-full rounded-t-sm bg-gold/60 group-hover:bg-gold transition-colors relative"
                title={`${p.month}: ${p.count} law${p.count !== 1 ? 's' : ''}`}
              >
                {p.count > 0 && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-gold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {p.count}
                  </span>
                )}
              </motion.div>
              <span className="text-[9px] font-mono text-surface-500 text-center leading-none">
                {p.month.replace(' ', '\n')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Margin distribution ───────────────────────────────────────────────────────────────────

function MarginDistribution({
  decisive,
  competitive,
  close,
  total,
}: {
  decisive: number
  competitive: number
  close: number
  total: number
}) {
  const sections = [
    {
      label: 'Decisive',
      sublabel: 'Passed by ≥65%',
      count: decisive,
      icon: Gavel,
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/20',
      bar: 'bg-gold',
    },
    {
      label: 'Competitive',
      sublabel: 'Passed by 55–65%',
      count: competitive,
      icon: TrendingUp,
      color: 'text-for-400',
      bg: 'bg-for-500/10',
      border: 'border-for-500/20',
      bar: 'bg-for-500',
    },
    {
      label: 'Close Call',
      sublabel: 'Passed by <55%',
      count: close,
      icon: Scale,
      color: 'text-against-300',
      bg: 'bg-against-500/10',
      border: 'border-against-500/20',
      bar: 'bg-against-500',
    },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 className="h-4 w-4 text-for-400" />
        <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
          Vote Margin Distribution
        </h3>
      </div>

      {/* Stacked bar */}
      {total > 0 && (
        <div className="flex h-3 rounded-full overflow-hidden mb-4 gap-px">
          {sections.map((s) => {
            const w = total > 0 ? (s.count / total) * 100 : 0
            if (w === 0) return null
            return (
              <motion.div
                key={s.label}
                initial={{ width: 0 }}
                animate={{ width: `${w}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className={cn('h-full', s.bar)}
                title={`${s.label}: ${s.count}`}
              />
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {sections.map((s) => {
          const Icon = s.icon
          const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
          return (
            <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.bg, s.border)}>
              <Icon className={cn('h-4 w-4 mx-auto mb-1', s.color)} />
              <p className={cn('text-lg font-mono font-bold', s.color)}>{s.count}</p>
              <p className="text-[10px] font-mono font-semibold text-white mt-0.5">{s.label}</p>
              <p className="text-[10px] font-mono text-surface-500">{s.sublabel}</p>
              <p className="text-[10px] font-mono text-surface-500 mt-1">{pct}% of laws</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 p-3 space-y-2">
                <Skeleton className="h-4 w-4 mx-auto rounded" />
                <Skeleton className="h-6 w-10 mx-auto" />
                <Skeleton className="h-3 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-300 last:border-0">
            <Skeleton className="h-3 w-4 flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16 flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────────────

export default function LawAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<LawAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'arguments' | 'votes' | 'recent'>('recent')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/laws', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load law analytics')
      const json: LawAnalyticsResponse = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeList =
    tab === 'arguments' ? data?.top_by_arguments
    : tab === 'votes'   ? data?.top_by_votes
    :                     data?.recent_laws

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-surface-200/80 border border-surface-300/60 hover:border-surface-400 text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Link
              href="/analytics"
              className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Analytics
            </Link>
            <span className="text-xs text-surface-600">/</span>
            <span className="text-xs font-mono text-gold font-semibold">Law Analytics</span>
          </div>

          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Gavel className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Law Impact Analytics</h1>
              <p className="text-sm text-surface-500 font-mono mt-0.5">
                Every law the Lobby has established — how it passed, who voted, and what it sparked.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center space-y-3">
            <p className="text-sm text-against-300 font-mono">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm text-white font-mono hover:border-surface-400 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : data && data.total_laws === 0 ? (
          <EmptyState
            icon={Gavel}
            title="No Laws Yet"
            description="When the Lobby establishes its first law, you'll see the analytics here."
          />
        ) : data ? (
          <div className="space-y-6">

            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Total Laws"
                value={data.total_laws}
                sub="established by consensus"
                icon={Gavel}
                color="text-gold"
                delay={0}
              />
              <StatCard
                label="This Month"
                value={data.laws_this_month}
                sub="laws in last 30 days"
                icon={Calendar}
                color="text-for-400"
                delay={0.05}
              />
              <StatCard
                label="This Week"
                value={data.laws_this_week}
                sub="laws in last 7 days"
                icon={Flame}
                color="text-against-400"
                delay={0.1}
              />
              <StatCard
                label="Avg FOR"
                value={data.avg_for_pct}
                sub="average FOR% at passage"
                icon={ThumbsUp}
                color="text-emerald"
                delay={0.15}
              />
            </div>

            {/* Vote margin + Category breakdown side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <MarginDistribution
                decisive={data.decisive_count}
                competitive={data.competitive_count}
                close={data.close_count}
                total={data.total_laws}
              />

              {/* Category breakdown */}
              {data.category_breakdown.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <BarChart2 className="h-4 w-4 text-purple" />
                    <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                      Laws by Category
                    </h3>
                  </div>
                  <div className="space-y-3.5">
                    {data.category_breakdown.map((stat) => (
                      <CategoryBar
                        key={stat.category}
                        stat={stat}
                        maxCount={data.category_breakdown[0]?.count ?? 1}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Monthly timeline */}
            {data.monthly_timeline.length > 0 && (
              <MonthlyTimeline points={data.monthly_timeline} />
            )}

            {/* Law tables */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
            >
              {/* Tab bar */}
              <div className="flex border-b border-surface-300">
                {(
                  [
                    { id: 'recent', label: 'Recent', icon: CheckCircle2 },
                    { id: 'arguments', label: 'Most Debated', icon: MessageSquare },
                    { id: 'votes', label: 'Most Voted', icon: Vote },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={cn(
                      'flex items-center gap-1.5 flex-1 justify-center py-3 text-xs font-mono font-semibold transition-colors border-b-2 -mb-px',
                      tab === id
                        ? 'text-gold border-gold'
                        : 'text-surface-500 border-transparent hover:text-white'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab label */}
              <div className="px-4 py-2.5 bg-surface-200/40 border-b border-surface-300">
                <p className="text-[10px] font-mono text-surface-500">
                  {tab === 'recent' && 'Most recently established laws'}
                  {tab === 'arguments' && 'Laws that generated the most debate arguments'}
                  {tab === 'votes' && 'Laws with the highest total vote participation'}
                </p>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {(activeList ?? []).length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-surface-500 font-mono">
                      No data yet
                    </div>
                  ) : (
                    (activeList ?? []).map((law, i) => (
                      <LawRow key={law.id} law={law} rank={i + 1} />
                    ))
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Footer link */}
              <div className="px-4 py-3 border-t border-surface-300 bg-surface-200/30">
                <Link
                  href="/law"
                  className="flex items-center justify-between text-xs font-mono text-surface-500 hover:text-gold transition-colors group"
                >
                  <span>Browse the full Law Codex</span>
                  <div className="flex items-center gap-1">
                    <span>Open</span>
                    <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Link>
              </div>
            </motion.div>

            {/* Engagement insight strip */}
            {data.top_by_arguments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-2xl border border-gold/20 bg-gold/5 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/15 border border-gold/25 flex-shrink-0">
                    <Zap className="h-4 w-4 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-semibold text-white mb-1">Most Debated Law</p>
                    <Link
                      href={`/topic/${data.top_by_arguments[0].id}`}
                      className="text-xs text-surface-500 hover:text-white transition-colors line-clamp-2 font-mono"
                    >
                      &ldquo;{data.top_by_arguments[0].statement}&rdquo;
                    </Link>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs font-mono text-gold font-bold">
                        {data.top_by_arguments[0].argument_count} arguments
                      </span>
                      <span className="text-xs font-mono text-surface-500">
                        {data.top_by_arguments[0].total_votes.toLocaleString()} votes
                      </span>
                      <span className="text-xs font-mono text-emerald font-semibold">
                        {Math.round(data.top_by_arguments[0].blue_pct)}% FOR
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/topic/${data.top_by_arguments[0].id}`}
                    className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-gold/40 hover:bg-gold/10 text-surface-500 hover:text-gold transition-colors"
                    aria-label="View topic"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* Nav links */}
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/law"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/25 text-gold hover:bg-gold/20 transition-colors text-xs font-mono font-semibold"
              >
                <Gavel className="h-3.5 w-3.5" />
                Law Codex
              </Link>
              <Link
                href="/analytics"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200/80 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono font-semibold"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Analytics Hub
              </Link>
              <Link
                href="/analytics/topics"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200/80 border border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono font-semibold"
              >
                <Scale className="h-3.5 w-3.5" />
                Topic Analytics
              </Link>
            </div>

          </div>
        ) : null}

      </main>
      <BottomNav />
    </div>
  )
}
