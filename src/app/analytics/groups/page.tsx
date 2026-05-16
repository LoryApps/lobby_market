'use client'

/**
 * /analytics/groups — Civic Group Analytics
 *
 * Platform-wide breakdown of how different civic roles (Citizens, Debators,
 * Troll Catchers, Elders) vote, argue, and engage. Shows whether experience
 * levels produce different political leanings and participation patterns.
 *
 * Distinct from:
 *   /analytics/benchmark  — how YOU compare to your cohort
 *   /leaderboard          — individual rankings
 *   /citizens             — profile directory by role
 *   /analytics            — personal stats hub
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Shield,
  ThumbsUp,
  TrendingUp,
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
  GroupsAnalyticsResponse,
  RoleVotePattern,
  CategoryRoleBreakdown,
  RoleActivityBucket,
  CivicRole,
} from '@/app/api/analytics/groups/route'

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  CivicRole,
  {
    color: string
    bg: string
    border: string
    dot: string
    icon: typeof Users
    description: string
    rank: number
  }
> = {
  person: {
    color: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/40',
    dot: 'bg-surface-400',
    icon: Users,
    description: 'New members who have cast their first votes.',
    rank: 1,
  },
  debator: {
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    dot: 'bg-for-400',
    icon: MessageSquare,
    description: 'Active arguers who consistently contribute to debates.',
    rank: 2,
  },
  troll_catcher: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    dot: 'bg-purple',
    icon: Shield,
    description: 'Trusted moderators who uphold discourse quality.',
    rank: 3,
  },
  elder: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    dot: 'bg-gold',
    icon: Trophy,
    description: 'Experienced citizens who have proven their civic impact.',
    rank: 4,
  },
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

function categoryColor(c: string) {
  return CATEGORY_COLORS[c] ?? 'text-surface-400'
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toFixed(decimals)
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div className={cn('text-center', highlight && 'opacity-100')}>
      <p className={cn('font-mono text-sm font-bold tabular-nums', highlight ? 'text-gold' : 'text-white')}>
        {value}
      </p>
      {sub && <p className="text-[10px] font-mono text-surface-500">{sub}</p>}
      <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  )
}

function RoleCard({ role }: { role: RoleVotePattern }) {
  const cfg = ROLE_CONFIG[role.role]
  const Icon = cfg.icon
  const forPct = Math.round(role.blueVotePct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 flex flex-col gap-4',
        'bg-surface-100',
        cfg.border,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0', cfg.bg, cfg.border)}>
            <Icon className={cn('h-5 w-5', cfg.color)} />
          </div>
          <div>
            <p className={cn('font-mono text-sm font-bold', cfg.color)}>{role.roleLabel}</p>
            <p className="text-[11px] font-mono text-surface-500 mt-0.5 max-w-[200px] leading-relaxed">
              {cfg.description}
            </p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-lg font-bold text-white">{fmt(role.count)}</p>
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">members</p>
        </div>
      </div>

      {/* Vote bar */}
      <div>
        <div className="flex justify-between text-[10px] font-mono mb-1">
          <span className="text-for-400">{forPct}% For</span>
          <span className="text-against-400">{againstPct}% Against</span>
        </div>
        <div className="h-2 rounded-full bg-against-800/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-700"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-surface-300/50">
        <StatCell
          label="Avg Votes"
          value={fmt(role.avgVotesPerMember, 0)}
        />
        <StatCell
          label="Avg Clout"
          value={fmt(role.avgClout, 0)}
          highlight={role.avgClout > 500}
        />
        <StatCell
          label="Avg Args"
          value={fmt(role.avgArguments, 1)}
        />
        <StatCell
          label="Avg Streak"
          value={fmt(role.avgStreak, 1)}
          sub="days"
        />
      </div>
    </motion.div>
  )
}

function CategoryBreakdownRow({ entry }: { entry: CategoryRoleBreakdown }) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('font-mono text-sm font-semibold', categoryColor(entry.category))}>
          {entry.category}
        </span>
        <span className="text-[10px] font-mono text-surface-600">
          · {entry.roles.reduce((s, r) => s + r.voteCount, 0).toLocaleString()} votes
        </span>
      </div>

      <div className="space-y-2">
        {entry.roles.map((r) => {
          const cfg = ROLE_CONFIG[r.role]
          return (
            <div key={r.role} className="flex items-center gap-2">
              <span className={cn('text-[10px] font-mono w-20 flex-shrink-0', cfg.color)}>
                {r.roleLabel}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-for-500/70 transition-all duration-700"
                  style={{ width: `${r.forPct}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-surface-500 w-10 text-right flex-shrink-0">
                {r.forPct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityRow({ bucket }: { bucket: RoleActivityBucket }) {
  const cfg = ROLE_CONFIG[bucket.role]
  const Icon = cfg.icon

  return (
    <div className="flex items-center gap-4 py-3 border-b border-surface-300/40 last:border-0">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border flex-shrink-0', cfg.bg, cfg.border)}>
        <Icon className={cn('h-4 w-4', cfg.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-mono text-sm font-semibold', cfg.color)}>{bucket.roleLabel}</p>
        <p className="text-[11px] font-mono text-surface-500">
          {bucket.totalMembers.toLocaleString()} total · {bucket.newMembers30d} joined this month
        </p>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-white">{bucket.participationRate}%</p>
          <p className="text-[10px] font-mono text-surface-500">active</p>
        </div>
        <div className="w-16 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', cfg.dot)}
            style={{ width: `${bucket.participationRate}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function GroupsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="grid grid-cols-4 gap-2 pt-1">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-1 text-center">
                  <Skeleton className="h-4 w-10 mx-auto" />
                  <Skeleton className="h-2.5 w-8 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function GroupsAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<GroupsAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'activity'>('overview')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/groups', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load group analytics')
      const json = await res.json() as GroupsAnalyticsResponse
      setData(json)
    } catch {
      setError('Could not load group analytics. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalMembers = data?.roles.reduce((s, r) => s + r.count, 0) ?? 0
  const totalVotes = data?.roles.reduce((s, r) => s + r.totalVotes, 0) ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </button>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
                <Users className="h-5 w-5 text-purple" aria-hidden />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Groups</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  How different roles vote and engage across the platform
                </p>
              </div>
            </div>

            <button
              onClick={() => load(true)}
              disabled={refreshing || loading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                (refreshing || loading) && 'opacity-50 cursor-not-allowed'
              )}
              aria-label="Refresh group analytics"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Summary strip */}
          {data && (
            <div className="mt-4 flex items-center gap-6 text-xs font-mono text-surface-500">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-purple" aria-hidden />
                {totalMembers.toLocaleString()} citizens
              </span>
              <span className="flex items-center gap-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden />
                {totalVotes.toLocaleString()} total votes
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-gold" aria-hidden />
                Updated {relativeTime(data.generatedAt)}
              </span>
            </div>
          )}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div
          role="tablist"
          aria-label="Group analytics views"
          className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-surface-200 border border-surface-300"
        >
          {([
            { id: 'overview', label: 'Overview', icon: BarChart2 },
            { id: 'categories', label: 'By Category', icon: Scale },
            { id: 'activity', label: 'Activity', icon: TrendingUp },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-mono font-medium transition-colors',
                activeTab === id
                  ? 'bg-surface-100 text-white border border-surface-400/50'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        {loading ? (
          <GroupsLoadingSkeleton />
        ) : error ? (
          <EmptyState
            icon={Users}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Failed to load group data"
            description={error}
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : !data ? null : (
          <AnimatePresence mode="wait">

            {/* ── OVERVIEW TAB ───────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Role cards */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                    <Users className="h-3.5 w-3.5 text-purple" aria-hidden />
                    Role Breakdown
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {data.roles
                      .filter((r) => r.count > 0)
                      .sort((a, b) => ROLE_CONFIG[b.role].rank - ROLE_CONFIG[a.role].rank)
                      .map((role) => (
                        <RoleCard key={role.role} role={role} />
                      ))}
                  </div>
                </div>

                {/* Voting alignment comparison */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Scale className="h-3.5 w-3.5" aria-hidden />
                    Overall Voting Alignment by Role
                  </div>
                  <div className="space-y-3">
                    {data.roles
                      .filter((r) => r.count > 0)
                      .sort((a, b) => b.blueVotePct - a.blueVotePct)
                      .map((role) => {
                        const cfg = ROLE_CONFIG[role.role]
                        const forPct = Math.round(role.blueVotePct)
                        return (
                          <div key={role.role} className="flex items-center gap-3">
                            <span className={cn('text-xs font-mono w-24 flex-shrink-0', cfg.color)}>
                              {role.roleLabel}
                            </span>
                            <div className="flex-1 flex items-center gap-2">
                              <div className="flex-1 h-2 rounded-full bg-surface-300/50 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-for-500/70 transition-all duration-700"
                                  style={{ width: `${forPct}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-for-400 w-12 text-right">
                                {forPct}% FOR
                              </span>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  <p className="text-[11px] font-mono text-surface-600 mt-4 leading-relaxed">
                    % of all votes cast as &ldquo;For&rdquo; across every topic on the platform.
                    Higher-ranked roles with more platform experience often show distinct patterns.
                  </p>
                </div>

                {/* Top categories */}
                {data.topCategories.length > 0 && (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                    <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                      <Flame className="h-3.5 w-3.5 text-gold" aria-hidden />
                      Most Debated Categories
                    </div>
                    <div className="space-y-2.5">
                      {data.topCategories.map((cat, i) => {
                        const maxVotes = data.topCategories[0]?.totalVotes ?? 1
                        const pct = Math.round((cat.totalVotes / maxVotes) * 100)
                        return (
                          <div key={cat.category} className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-surface-600 w-3">
                              {i + 1}
                            </span>
                            <span className={cn('text-xs font-mono w-24 flex-shrink-0', categoryColor(cat.category))}>
                              {cat.category}
                            </span>
                            <div className="flex-1 h-1.5 rounded-full bg-surface-300/50 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-surface-500 transition-all duration-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono text-surface-500 w-14 text-right">
                              {fmt(cat.totalVotes)} votes
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Quick links */}
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href="/citizens"
                    className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300/60 px-4 py-3 hover:border-purple/40 hover:bg-surface-100/80 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple" aria-hidden />
                      <span className="text-sm font-mono text-surface-400 group-hover:text-white transition-colors">Citizens</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden />
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="flex items-center justify-between rounded-xl bg-surface-100 border border-surface-300/60 px-4 py-3 hover:border-gold/40 hover:bg-surface-100/80 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-gold" aria-hidden />
                      <span className="text-sm font-mono text-surface-400 group-hover:text-white transition-colors">Leaderboard</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors" aria-hidden />
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── CATEGORIES TAB ─────────────────────────────────────────── */}
            {activeTab === 'categories' && (
              <motion.div
                key="categories"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <p className="text-sm font-mono text-surface-500 leading-relaxed">
                  Do different civic roles vote differently on specific policy areas?
                  Each bar shows the % FOR votes from that role on topics in the category.
                </p>

                {data.categoryBreakdown.length === 0 ? (
                  <EmptyState
                    icon={Scale}
                    title="Not enough data yet"
                    description="More platform votes are needed to compare roles by category."
                    size="sm"
                  />
                ) : (
                  <div className="space-y-3">
                    {data.categoryBreakdown.map((entry) => (
                      <CategoryBreakdownRow key={entry.category} entry={entry} />
                    ))}
                  </div>
                )}

                <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 px-4 py-3">
                  <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                    Only categories with sufficient votes from each role are shown.
                    Bars represent &ldquo;% of votes cast as FOR&rdquo; by that role on topics in the category.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── ACTIVITY TAB ───────────────────────────────────────────── */}
            {activeTab === 'activity' && (
              <motion.div
                key="activity"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                    Participation by Role
                  </div>
                  <div className="divide-y divide-surface-300/30">
                    {data.activity
                      .filter((b) => b.totalMembers > 0)
                      .sort((a, b) => b.totalMembers - a.totalMembers)
                      .map((bucket) => (
                        <ActivityRow key={bucket.role} bucket={bucket} />
                      ))}
                  </div>
                </div>

                {/* Engagement stat cards */}
                <div className="grid grid-cols-2 gap-3">
                  {data.roles
                    .filter((r) => r.count > 0)
                    .sort((a, b) => b.avgVotesPerMember - a.avgVotesPerMember)
                    .slice(0, 4)
                    .map((role) => {
                      const cfg = ROLE_CONFIG[role.role]
                      return (
                        <div
                          key={role.role}
                          className={cn(
                            'rounded-xl border p-4',
                            'bg-surface-100',
                            cfg.border,
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                            <span className={cn('text-xs font-mono font-semibold', cfg.color)}>
                              {role.roleLabel}
                            </span>
                          </div>
                          <p className="font-mono text-lg font-bold text-white tabular-nums">
                            {fmt(role.avgVotesPerMember, 0)}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                            avg votes / member
                          </p>
                          <p className="font-mono text-sm font-semibold text-gold mt-2 tabular-nums">
                            {fmt(role.avgArguments, 1)}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                            avg arguments
                          </p>
                        </div>
                      )
                    })}
                </div>

                <div className="rounded-xl bg-surface-200/60 border border-surface-300/40 px-4 py-3">
                  <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                    Active members have at least one vote cast. Participation rate reflects
                    the share of role members who have engaged with platform debates.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
