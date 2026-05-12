'use client'

/**
 * /analytics/coalitions — Coalition Performance Analytics
 *
 * User-centric view of all coalitions they belong to:
 *  - Stance win rate per coalition (FOR+law or AGAINST+failed)
 *  - How aligned the user's own votes are with each coalition's stances
 *  - Category activity breakdown per coalition
 *  - Cross-coalition summary stats
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Crown,
  Gavel,
  RefreshCw,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  CoalitionStat,
  CoalitionsAnalyticsResponse,
} from '@/app/api/analytics/coalitions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  leader:  { label: 'Leader',  Icon: Crown,  color: 'text-gold',       bg: 'bg-gold/10',       border: 'border-gold/30'       },
  officer: { label: 'Officer', Icon: Shield, color: 'text-purple',     bg: 'bg-purple/10',     border: 'border-purple/30'     },
  member:  { label: 'Member',  Icon: Users,  color: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-300/30' },
} as const

const CAT_COLORS: Record<string, string> = {
  Economics:   'bg-gold/70',
  Politics:    'bg-for-500',
  Technology:  'bg-for-400',
  Science:     'bg-emerald',
  Ethics:      'bg-purple',
  Philosophy:  'bg-purple',
  Culture:     'bg-against-500',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-for-400',
}

function catColor(cat: string): string {
  return CAT_COLORS[cat] ?? 'bg-surface-400'
}

function winRateColor(pct: number | null): string {
  if (pct === null) return 'text-surface-500'
  if (pct >= 70) return 'text-emerald'
  if (pct >= 50) return 'text-for-400'
  if (pct >= 30) return 'text-gold'
  return 'text-against-400'
}

function alignmentColor(pct: number | null): string {
  if (pct === null) return 'text-surface-500'
  if (pct >= 80) return 'text-emerald'
  if (pct >= 60) return 'text-for-400'
  if (pct >= 40) return 'text-gold'
  return 'text-against-400'
}

function relativeTime(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delay = 0,
}: {
  icon: typeof BarChart2
  label: string
  value: string | number | null
  sub?: string
  accent?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        {label}
      </div>
      <div className={cn('text-3xl font-bold font-mono', accent ?? 'text-white')}>
        {value ?? 'N/A'}
      </div>
      {sub && <p className="text-xs text-surface-500 mt-1">{sub}</p>}
    </motion.div>
  )
}

// ─── Coalition card ───────────────────────────────────────────────────────────

function CoalitionCard({ coalition, idx }: { coalition: CoalitionStat; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const role = ROLE_CONFIG[coalition.userRole]
  const RoleIcon = role.Icon
  const totalResolved = coalition.resolvedStances

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + idx * 0.05 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl border',
              role.bg, role.border,
            )}>
              <RoleIcon className={cn('h-4.5 w-4.5', role.color)} />
            </div>
            <div className="min-w-0">
              <Link
                href={`/coalitions/${coalition.id}`}
                className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate block"
              >
                {coalition.name}
              </Link>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-xs font-mono', role.color)}>{role.label}</span>
                <span className="text-surface-600 text-xs">·</span>
                <span className="text-xs text-surface-500">{coalition.memberCount} members</span>
                <span className="text-surface-600 text-xs">·</span>
                <span className="text-xs text-surface-500">joined {relativeTime(coalition.joinedAt)}</span>
              </div>
            </div>
          </div>
          <Link
            href={`/coalitions/${coalition.id}/analytics`}
            className="flex-shrink-0 flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            Details
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Stance win rate bar */}
        {coalition.totalStances > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-surface-500">Stance Win Rate</span>
              <span className={cn('font-semibold', winRateColor(coalition.stanceWinRate))}>
                {coalition.stanceWinRate !== null
                  ? `${coalition.stanceWinRate}%`
                  : totalResolved === 0 ? 'No outcomes yet' : 'N/A'}
              </span>
            </div>
            <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${coalition.stanceWinRate ?? 0}%` }}
                transition={{ duration: 0.7, delay: 0.2 + idx * 0.05 }}
                className={cn(
                  'h-full rounded-full',
                  (coalition.stanceWinRate ?? 0) >= 70 ? 'bg-emerald' :
                  (coalition.stanceWinRate ?? 0) >= 50 ? 'bg-for-500' :
                  (coalition.stanceWinRate ?? 0) >= 30 ? 'bg-gold' : 'bg-against-500'
                )}
              />
            </div>
            <p className="text-[11px] text-surface-500">
              {coalition.wonStances} won · {coalition.resolvedStances - coalition.wonStances} lost
              {' '}· {coalition.totalStances - coalition.resolvedStances} pending
            </p>
          </div>
        )}

        {/* User alignment bar */}
        {coalition.userTotalStanceVotes > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-surface-500">Your Alignment</span>
              <span className={cn('font-semibold', alignmentColor(coalition.userAlignmentPct))}>
                {coalition.userAlignmentPct !== null ? `${coalition.userAlignmentPct}%` : 'N/A'}
              </span>
            </div>
            <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${coalition.userAlignmentPct ?? 0}%` }}
                transition={{ duration: 0.7, delay: 0.3 + idx * 0.05 }}
                className={cn(
                  'h-full rounded-full',
                  (coalition.userAlignmentPct ?? 0) >= 80 ? 'bg-emerald' :
                  (coalition.userAlignmentPct ?? 0) >= 60 ? 'bg-for-500' :
                  (coalition.userAlignmentPct ?? 0) >= 40 ? 'bg-gold' : 'bg-against-500'
                )}
              />
            </div>
            <p className="text-[11px] text-surface-500">
              Voted with coalition on {coalition.userAlignedVotes} of {coalition.userTotalStanceVotes} shared topics
            </p>
          </div>
        )}
      </div>

      {/* Category breakdown (expandable) */}
      {coalition.categoryBreakdown.length > 0 && (
        <div className="border-t border-surface-300">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-5 py-3 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200/40 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <BarChart2 className="h-3 w-3" />
              Category Breakdown
            </span>
            <span className="flex items-center gap-1">
              {coalition.topCategory && (
                <span className="text-surface-400 mr-1">{coalition.topCategory}</span>
              )}
              <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
            </span>
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="cats"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 space-y-2">
                  {coalition.categoryBreakdown.map((cat) => {
                    const maxCount = coalition.categoryBreakdown[0]?.count ?? 1
                    const pct = (cat.count / maxCount) * 100
                    return (
                      <div key={cat.category}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-surface-300">{cat.category}</span>
                          <span className="text-surface-500 font-mono">{cat.count}</span>
                        </div>
                        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', catColor(cat.category))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* No stances */}
      {coalition.totalStances === 0 && (
        <div className="border-t border-surface-300 px-5 py-3">
          <p className="text-xs text-surface-600 font-mono">No official stances declared yet.</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CoalitionsAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<CoalitionsAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/analytics/coalitions', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const summary = data?.summary
  const coalitions = data?.coalitions ?? []
  const isEmpty = !loading && coalitions.length === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">Coalition Analytics</h1>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Stance performance across all your coalitions
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh data"
            className="ml-auto flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <EmptyState
            icon={Users}
            title="No coalitions yet"
            description="Join or create a coalition to track stance performance and alignment with fellow citizens."
            action={{ label: 'Browse Coalitions', href: '/coalitions' }}
          />
        )}

        {/* Content */}
        {!loading && !isEmpty && summary && (
          <div className="space-y-6">

            {/* Summary stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={Users}
                label="Coalitions"
                value={summary.totalCoalitions}
                sub="you belong to"
                delay={0}
              />
              <StatTile
                icon={Target}
                label="Total Stances"
                value={summary.totalStances}
                sub="across all coalitions"
                delay={0.05}
              />
              <StatTile
                icon={Trophy}
                label="Avg Win Rate"
                value={summary.avgStanceWinRate !== null ? `${summary.avgStanceWinRate}%` : null}
                sub="stance outcomes"
                accent={winRateColor(summary.avgStanceWinRate)}
                delay={0.1}
              />
              <StatTile
                icon={Zap}
                label="Your Alignment"
                value={summary.avgUserAlignment !== null ? `${summary.avgUserAlignment}%` : null}
                sub="avg across coalitions"
                accent={alignmentColor(summary.avgUserAlignment)}
                delay={0.15}
              />
            </div>

            {/* Highlights */}
            {(summary.bestCoalitionId || summary.mostAlignedCoalitionId) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5 text-gold" />
                  Highlights
                </div>
                <div className="space-y-2">
                  {summary.bestCoalitionName && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
                        <span className="text-xs text-surface-400">Highest stance win rate</span>
                      </div>
                      <Link
                        href={`/coalitions/${summary.bestCoalitionId}`}
                        className="text-xs font-semibold text-emerald hover:text-emerald/80 transition-colors truncate max-w-[160px]"
                      >
                        {summary.bestCoalitionName}
                      </Link>
                    </div>
                  )}
                  {summary.mostAlignedCoalitionName && summary.mostAlignedCoalitionId !== summary.bestCoalitionId && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Gavel className="h-4 w-4 text-for-400 flex-shrink-0" />
                        <span className="text-xs text-surface-400">Most aligned with your votes</span>
                      </div>
                      <Link
                        href={`/coalitions/${summary.mostAlignedCoalitionId}`}
                        className="text-xs font-semibold text-for-400 hover:text-for-300 transition-colors truncate max-w-[160px]"
                      >
                        {summary.mostAlignedCoalitionName}
                      </Link>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Coalition cards */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                <Users className="h-3.5 w-3.5" />
                Your Coalitions ({coalitions.length})
              </div>
              {coalitions.map((coalition, idx) => (
                <CoalitionCard key={coalition.id} coalition={coalition} idx={idx} />
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-white">Build your coalition</p>
                <p className="text-xs text-surface-500 mt-0.5">Coordinate with like-minded citizens and amplify your civic impact</p>
              </div>
              <Link
                href="/coalitions"
                className="flex-shrink-0 flex items-center gap-1.5 px-4 h-9 rounded-xl bg-purple text-white text-xs font-semibold font-mono hover:bg-purple/80 transition-colors"
              >
                <Users className="h-3.5 w-3.5" />
                Coalitions
              </Link>
            </motion.div>

            {/* Back to analytics hub */}
            <div className="flex items-center justify-center pt-2">
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Back to Analytics Hub
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
