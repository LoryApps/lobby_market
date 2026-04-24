'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  FileText,
  Gavel,
  Landmark,
  Mic,
  Scale,
  TrendingUp,
  Users,
  Vote,
  Zap,
  MessageSquare,
  Users2,
  RefreshCw,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { PlatformStats } from '@/app/api/stats/route'

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: '#f59e0b',
  Politics: '#60a5fa',
  Technology: '#8b5cf6',
  Science: '#10b981',
  Ethics: '#f87171',
  Philosophy: '#818cf8',
  Culture: '#fb923c',
  Health: '#f472b6',
  Environment: '#4ade80',
  Education: '#22d3ee',
  Other: '#71717a',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.Other
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  proposed: { label: 'Proposed', color: 'text-surface-600', bg: 'bg-surface-400/20' },
  active: { label: 'Active', color: 'text-for-400', bg: 'bg-for-500/15' },
  voting: { label: 'Voting', color: 'text-purple', bg: 'bg-purple/15' },
  law: { label: 'Laws', color: 'text-emerald', bg: 'bg-emerald/15' },
  failed: { label: 'Failed', color: 'text-against-400', bg: 'bg-against-500/15' },
  continued: { label: 'Continued', color: 'text-gold', bg: 'bg-gold/15' },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-300/50', className)} />
}

function StatsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
            <Sk className="h-4 w-20 mb-3" />
            <Sk className="h-8 w-24 mb-1" />
            <Sk className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-3">
          <Sk className="h-5 w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Sk key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-3">
          <Sk className="h-5 w-32" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Sk key={i} className="h-8 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  bg,
  border,
  delay = 0,
}: {
  icon: typeof Vote
  label: string
  value: number
  sub?: string
  color: string
  bg: string
  border: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'bg-surface-100 border rounded-2xl p-5 flex flex-col gap-3',
        border
      )}
    >
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl', bg)}>
        <Icon className={cn('h-5 w-5', color)} aria-hidden="true" />
      </div>
      <div>
        <div className="text-2xl font-mono font-bold text-white">
          <AnimatedNumber value={value} />
        </div>
        <div className="text-xs font-mono text-surface-500 mt-0.5">{label}</div>
        {sub && <div className="text-[10px] text-surface-600 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  )
}

// ─── Category bar ────────────────────────────────────────────────────────────

function CategoryBar({
  category,
  count,
  max,
  extra,
  color,
  delay = 0,
}: {
  category: string
  count: number
  max: number
  extra?: string
  color: string
  delay?: number
}) {
  const pct = max > 0 ? (count / max) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className="flex items-center gap-3"
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-surface-700 font-mono truncate">{category}</span>
          <span className="text-xs font-mono text-surface-500 ml-2 flex-shrink-0">
            {count.toLocaleString()}
            {extra ? <span className="text-surface-600"> · {extra}</span> : null}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, delay: delay + 0.1, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Mini sparkline ───────────────────────────────────────────────────────────

function Sparkline({
  data,
  color = '#3b82f6',
}: {
  data: Array<{ date: string; votes: number }>
  color?: string
}) {
  const max = Math.max(...data.map((d) => d.votes), 1)
  const height = 64
  const width = data.length

  const points = data
    .map((d, i) => {
      const x = (i / (width - 1)) * 100
      const y = height - (d.votes / max) * height
      return `${x},${y}`
    })
    .join(' ')

  const area = `0,${height} ${points} 100,${height}`

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full h-16"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-fill)" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

// ─── Status distribution pill group ──────────────────────────────────────────

function StatusPills({ byStatus }: { byStatus: Record<string, number> }) {
  const total = Object.values(byStatus).reduce((s, v) => s + v, 0)
  if (total === 0) return null

  const order = ['law', 'active', 'voting', 'proposed', 'continued', 'failed']
  const items = order
    .map((s) => ({ status: s, count: byStatus[s] ?? 0 }))
    .filter((i) => i.count > 0)

  return (
    <div className="space-y-2.5" role="list" aria-label="Topics by status">
      {items.map(({ status, count }, idx) => {
        const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.proposed
        const pct = Math.round((count / total) * 100)
        return (
          <motion.div
            key={status}
            role="listitem"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: idx * 0.06 }}
            className="flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className={cn('text-sm font-mono', cfg.color)}>
                  {cfg.label}
                </span>
                <span className="text-xs font-mono text-surface-500">
                  {count.toLocaleString()}
                  <span className="text-surface-600 ml-1">({pct}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: idx * 0.06 + 0.1, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', cfg.bg)}
                  style={{
                    background: undefined,
                    backgroundColor:
                      status === 'law'
                        ? '#10b981'
                        : status === 'active'
                        ? '#3b82f6'
                        : status === 'voting'
                        ? '#8b5cf6'
                        : status === 'failed'
                        ? '#ef4444'
                        : status === 'continued'
                        ? '#f59e0b'
                        : '#71717a',
                  }}
                />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Role badge helper ────────────────────────────────────────────────────────

type RoleBadgeVariant = 'person' | 'debator' | 'troll_catcher' | 'elder'
const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Moderator',
  elder: 'Elder',
}

function roleBadge(role: string): RoleBadgeVariant {
  if (role === 'elder') return 'elder'
  if (role === 'troll_catcher') return 'troll_catcher'
  if (role === 'debator') return 'debator'
  return 'person'
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as PlatformStats
      setStats(data)
      setLastUpdated(new Date())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const maxCatCount = stats
    ? Math.max(...stats.topicsByCategory.map((c) => c.count), 1)
    : 1
  const maxLawCatCount = stats
    ? Math.max(...stats.lawsByCategory.map((c) => c.count), 1)
    : 1

  const hasVoteActivity =
    stats?.dailyVotes.some((d) => d.votes > 0) ?? false

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Feed
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
                  <BarChart2 className="h-5 w-5 text-for-400" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="font-mono text-2xl font-bold text-white tracking-tight">
                    State of the Lobby
                  </h1>
                  <p className="text-xs font-mono text-surface-500">
                    Platform-wide statistics · live data
                  </p>
                </div>
              </div>
              {lastUpdated && (
                <p className="text-[11px] font-mono text-surface-600 ml-14">
                  Updated {lastUpdated.toLocaleTimeString()}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || refreshing}
              aria-label="Refresh stats"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0'
              )}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* ── Error ── */}
        {error && (
          <div className="text-center py-16 text-surface-500 font-mono text-sm">
            Failed to load stats. Check your connection.
          </div>
        )}

        {/* ── Loading ── */}
        {loading && !error && <StatsSkeleton />}

        {/* ── Content ── */}
        {stats && !loading && (
          <div className="space-y-6">

            {/* ── Totals grid ── */}
            <section aria-label="Platform totals">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon={Vote}
                  label="Total Votes"
                  value={stats.totals.votes}
                  color="text-for-400"
                  bg="bg-for-500/10"
                  border="border-for-500/20"
                  delay={0}
                />
                <StatCard
                  icon={FileText}
                  label="Topics"
                  value={stats.totals.topics}
                  sub={`${stats.topicsByStatus.law ?? 0} became law`}
                  color="text-purple"
                  bg="bg-purple/10"
                  border="border-purple/20"
                  delay={0.05}
                />
                <StatCard
                  icon={Gavel}
                  label="Laws"
                  value={stats.totals.laws}
                  color="text-emerald"
                  bg="bg-emerald/10"
                  border="border-emerald/20"
                  delay={0.1}
                />
                <StatCard
                  icon={Users}
                  label="Citizens"
                  value={stats.totals.users}
                  color="text-gold"
                  bg="bg-gold/10"
                  border="border-gold/20"
                  delay={0.15}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <StatCard
                  icon={Mic}
                  label="Debates"
                  value={stats.totals.debates}
                  color="text-against-400"
                  bg="bg-against-500/10"
                  border="border-against-500/20"
                  delay={0.2}
                />
                <StatCard
                  icon={MessageSquare}
                  label="Arguments"
                  value={stats.totals.arguments}
                  color="text-for-300"
                  bg="bg-for-500/10"
                  border="border-for-500/20"
                  delay={0.25}
                />
                <StatCard
                  icon={Users2}
                  label="Coalitions"
                  value={stats.totals.coalitions}
                  color="text-purple"
                  bg="bg-purple/10"
                  border="border-purple/20"
                  delay={0.3}
                />
              </div>
            </section>

            {/* ── Vote Activity ── */}
            {hasVoteActivity && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.35 }}
                aria-label="Vote activity last 30 days"
                className="bg-surface-100 border border-surface-300 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-for-400" aria-hidden="true" />
                    <h2 className="text-sm font-mono font-semibold text-white">
                      Vote Activity
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-surface-500">
                    Last 30 days
                  </span>
                </div>
                <Sparkline data={stats.dailyVotes} color="#3b82f6" />
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-mono text-surface-600">
                    {new Date(stats.dailyVotes[0]?.date ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-mono text-surface-600">Today</span>
                </div>
              </motion.section>
            )}

            {/* ── Status + Category grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Status breakdown */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 }}
                aria-label="Topics by status"
                className="bg-surface-100 border border-surface-300 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="h-4 w-4 text-purple" aria-hidden="true" />
                  <h2 className="text-sm font-mono font-semibold text-white">
                    Topic Pipeline
                  </h2>
                </div>
                {Object.keys(stats.topicsByStatus).length > 0 ? (
                  <StatusPills byStatus={stats.topicsByStatus} />
                ) : (
                  <p className="text-sm text-surface-500 font-mono">No topics yet.</p>
                )}
              </motion.section>

              {/* Topics by category */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45 }}
                aria-label="Topics by category"
                className="bg-surface-100 border border-surface-300 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-4 w-4 text-gold" aria-hidden="true" />
                  <h2 className="text-sm font-mono font-semibold text-white">
                    Topics by Category
                  </h2>
                </div>
                {stats.topicsByCategory.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topicsByCategory.map((c, i) => (
                      <CategoryBar
                        key={c.category}
                        category={c.category}
                        count={c.count}
                        max={maxCatCount}
                        extra={c.vote_share > 0 ? `${c.vote_share}% of votes` : undefined}
                        color={getCategoryColor(c.category)}
                        delay={i * 0.05}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-surface-500 font-mono">No topics yet.</p>
                )}
              </motion.section>
            </div>

            {/* ── Top topics ── */}
            {stats.topTopics.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
                aria-label="Most voted topics"
                className="bg-surface-100 border border-surface-300 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-for-400" aria-hidden="true" />
                    <h2 className="text-sm font-mono font-semibold text-white">
                      Most Voted Topics
                    </h2>
                  </div>
                  <Link
                    href="/?sort=top"
                    className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {stats.topTopics.map((t, i) => {
                    const forPct = Math.round(t.blue_pct ?? 50)
                    const againstPct = 100 - forPct
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.5 + i * 0.06 }}
                      >
                        <Link
                          href={`/topic/${t.id}`}
                          className={cn(
                            'flex items-start gap-3 rounded-xl p-3.5',
                            'border border-surface-300 bg-surface-200',
                            'hover:border-surface-400 hover:bg-surface-300/50 transition-colors group'
                          )}
                        >
                          <span className="text-xs font-mono text-surface-600 mt-0.5 w-4 flex-shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-surface-700 group-hover:text-white transition-colors line-clamp-2 leading-snug font-mono">
                              {t.statement}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              {/* Vote bar mini */}
                              <div className="flex-1 h-1 rounded-full overflow-hidden bg-against-900/50">
                                <div
                                  className="h-full bg-for-500 rounded-full"
                                  style={{ width: `${forPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-for-400 flex-shrink-0">
                                {forPct}%
                              </span>
                              <span className="text-[10px] font-mono text-against-400 flex-shrink-0">
                                {againstPct}%
                              </span>
                              <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                                {t.total_votes.toLocaleString()} votes
                              </span>
                            </div>
                          </div>
                          {t.category && (
                            <div
                              className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: getCategoryColor(t.category) }}
                              aria-label={t.category}
                            />
                          )}
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.section>
            )}

            {/* ── Laws by category + Recent laws ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Laws by category */}
              {stats.lawsByCategory.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.55 }}
                  aria-label="Laws by category"
                  className="bg-surface-100 border border-emerald/20 rounded-2xl p-5"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Gavel className="h-4 w-4 text-emerald" aria-hidden="true" />
                    <h2 className="text-sm font-mono font-semibold text-white">
                      Laws by Category
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {stats.lawsByCategory.map((c, i) => (
                      <CategoryBar
                        key={c.category}
                        category={c.category}
                        count={c.count}
                        max={maxLawCatCount}
                        color={getCategoryColor(c.category)}
                        delay={i * 0.05}
                      />
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Recent laws */}
              {stats.recentLaws.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.6 }}
                  aria-label="Recently established laws"
                  className="bg-surface-100 border border-emerald/20 rounded-2xl p-5"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-emerald" aria-hidden="true" />
                      <h2 className="text-sm font-mono font-semibold text-white">
                        Recent Laws
                      </h2>
                    </div>
                    <Link
                      href="/law"
                      className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      View codex <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {stats.recentLaws.map((law, i) => (
                      <motion.div
                        key={law.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.6 + i * 0.06 }}
                      >
                        <Link
                          href={`/law/${law.id}`}
                          className={cn(
                            'block rounded-xl p-3 border border-surface-300 bg-surface-200',
                            'hover:border-emerald/30 hover:bg-emerald/5 transition-colors group'
                          )}
                        >
                          <p className="text-xs font-mono text-surface-700 group-hover:text-white transition-colors line-clamp-2 leading-snug">
                            {law.statement}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {law.category && (
                              <span
                                className="text-[10px] font-mono"
                                style={{ color: getCategoryColor(law.category) }}
                              >
                                {law.category}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-surface-600">
                              {new Date(law.established_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              )}
            </div>

            {/* ── Top citizens ── */}
            {stats.topDebaters.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.65 }}
                aria-label="Top citizens by reputation"
                className="bg-surface-100 border border-surface-300 rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gold" aria-hidden="true" />
                    <h2 className="text-sm font-mono font-semibold text-white">
                      Top Citizens
                    </h2>
                  </div>
                  <Link
                    href="/leaderboard"
                    className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    Full leaderboard <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {stats.topDebaters.map((user, i) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.65 + i * 0.07 }}
                    >
                      <Link
                        href={`/profile/${user.username}`}
                        className={cn(
                          'flex items-center gap-3 rounded-xl p-3 border border-surface-300 bg-surface-200',
                          'hover:border-surface-400 hover:bg-surface-300/50 transition-colors group'
                        )}
                      >
                        <span className="text-xs font-mono text-surface-600 w-4 flex-shrink-0 text-center">
                          {i + 1}
                        </span>
                        <Avatar
                          src={user.avatar_url}
                          fallback={user.display_name ?? user.username}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-white truncate group-hover:text-for-300 transition-colors">
                              {user.display_name ?? user.username}
                            </span>
                            <Badge variant={roleBadge(user.role)}>
                              {ROLE_LABEL[user.role] ?? user.role}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-mono text-gold">
                              {user.reputation_score.toLocaleString()} rep
                            </span>
                            <span className="text-[10px] font-mono text-surface-500">
                              {user.total_votes.toLocaleString()} votes
                            </span>
                            <span className="text-[10px] font-mono text-surface-500">
                              {user.clout.toLocaleString()} clout
                            </span>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── Quick links ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.75 }}
              className="flex flex-wrap justify-center gap-2 pb-2"
            >
              <Link
                href="/heatmap"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-for-600/15 border border-for-500/30 hover:border-for-500/60 hover:bg-for-600/25 transition-colors text-sm font-mono text-for-400 hover:text-for-300"
              >
                <BarChart2 className="h-4 w-4" />
                Lobby Heatmap
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/digest"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 hover:bg-surface-300 transition-colors text-sm font-mono text-surface-500 hover:text-white"
              >
                <Calendar className="h-4 w-4" />
                View Weekly Digest
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>

            {/* ── Footer note ── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="text-center text-xs font-mono text-surface-600 pb-4"
            >
              Stats are computed live from the Lobby database.
              Vote counts reflect citizen participation across all scopes.
            </motion.p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
