'use client'

/**
 * /progress — Civic Progress Tracker
 *
 * Shows platform-wide milestone achievements — how far the Lobby has come
 * in votes cast, laws established, debates held, and arguments written.
 *
 * Distinct from:
 *   /stats         — raw platform numbers
 *   /vitals        — discourse quality scores
 *   /observatory   — aggregate deliberation health
 *
 * This page frames the numbers as a journey: milestones unlocked, the
 * progress bar to the next one, and category-level law pass rates.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  CheckCircle2,
  Circle,
  Flame,
  Gavel,
  Layers,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PlatformStats } from '@/app/api/stats/route'

// ─── Milestone definitions ────────────────────────────────────────────────────

interface Milestone {
  value: number
  label: string
}

interface MilestoneTrack {
  key: keyof PlatformStats['totals']
  label: string
  icon: typeof Vote
  color: string
  bg: string
  border: string
  glow: string
  milestones: Milestone[]
  unit?: string
  href: string
}

const TRACKS: MilestoneTrack[] = [
  {
    key: 'votes',
    label: 'Votes Cast',
    icon: Vote,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'bg-for-500/8',
    href: '/vote-stream',
    milestones: [
      { value: 100,     label: 'First Hundred' },
      { value: 1_000,   label: 'The Thousand' },
      { value: 5_000,   label: 'Civic Surge' },
      { value: 10_000,  label: 'Ten Thousand' },
      { value: 50_000,  label: 'Groundswell' },
      { value: 100_000, label: 'The Hundred K' },
      { value: 500_000, label: 'Mass Movement' },
      { value: 1_000_000, label: 'One Million' },
    ],
  },
  {
    key: 'laws',
    label: 'Laws Established',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'bg-gold/8',
    href: '/law',
    milestones: [
      { value: 1,   label: 'First Law' },
      { value: 5,   label: 'The Five' },
      { value: 10,  label: 'First Codex' },
      { value: 25,  label: 'Quarter Century' },
      { value: 50,  label: 'Golden Fifty' },
      { value: 100, label: 'The Century' },
      { value: 250, label: 'The Archive' },
      { value: 500, label: 'Half Thousand' },
    ],
  },
  {
    key: 'users',
    label: 'Citizens',
    icon: Users,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'bg-purple/8',
    href: '/leaderboard',
    milestones: [
      { value: 10,    label: 'Founding Ten' },
      { value: 50,    label: 'The Council' },
      { value: 100,   label: 'The Assembly' },
      { value: 500,   label: 'The Convention' },
      { value: 1_000, label: 'The Thousand' },
      { value: 5_000, label: 'The Movement' },
      { value: 10_000, label: 'The Parliament' },
      { value: 50_000, label: 'The Nation' },
    ],
  },
  {
    key: 'arguments',
    label: 'Arguments Written',
    icon: MessageSquare,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'bg-emerald/8',
    href: '/arguments',
    milestones: [
      { value: 10,    label: 'First Voices' },
      { value: 50,    label: 'The Debate' },
      { value: 100,   label: 'Hundred Arguments' },
      { value: 500,   label: 'Five Hundred' },
      { value: 1_000, label: 'The Thousand' },
      { value: 5_000, label: 'The Library' },
      { value: 10_000, label: 'Ten Thousand' },
      { value: 50_000, label: 'The Archive' },
    ],
  },
  {
    key: 'topics',
    label: 'Topics Proposed',
    icon: Layers,
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/30',
    glow: 'bg-for-400/8',
    href: '/topics',
    milestones: [
      { value: 10,   label: 'First Proposals' },
      { value: 25,   label: 'The Quarter' },
      { value: 50,   label: 'Fifty Topics' },
      { value: 100,  label: 'The Hundred' },
      { value: 250,  label: 'The Archive' },
      { value: 500,  label: 'Five Hundred' },
      { value: 1_000, label: 'The Thousand' },
      { value: 2_500, label: 'The Library' },
    ],
  },
  {
    key: 'debates',
    label: 'Debates Held',
    icon: Mic,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'bg-against-500/8',
    href: '/debate',
    milestones: [
      { value: 1,   label: 'First Debate' },
      { value: 5,   label: 'The Five' },
      { value: 10,  label: 'First Season' },
      { value: 25,  label: 'Twenty-Five' },
      { value: 50,  label: 'Fifty' },
      { value: 100, label: 'The Century' },
      { value: 250, label: 'Two Fifty' },
      { value: 500, label: 'Half Thousand' },
    ],
  },
  {
    key: 'coalitions',
    label: 'Coalitions Formed',
    icon: Swords,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/25',
    glow: 'bg-gold/6',
    href: '/lobbies',
    milestones: [
      { value: 1,   label: 'First Alliance' },
      { value: 5,   label: 'The Five' },
      { value: 10,  label: 'The Ten' },
      { value: 25,  label: 'Twenty-Five' },
      { value: 50,  label: 'Fifty' },
      { value: 100, label: 'The Century' },
      { value: 250, label: 'The Network' },
      { value: 500, label: 'The Web' },
    ],
  },
]

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bar: string; text: string }> = {
  Economics:   { bar: 'bg-gold',          text: 'text-gold' },
  Politics:    { bar: 'bg-for-500',       text: 'text-for-400' },
  Technology:  { bar: 'bg-purple',        text: 'text-purple' },
  Science:     { bar: 'bg-emerald',       text: 'text-emerald' },
  Ethics:      { bar: 'bg-against-500',   text: 'text-against-400' },
  Philosophy:  { bar: 'bg-purple',        text: 'text-purple' },
  Culture:     { bar: 'bg-amber-500',     text: 'text-amber-400' },
  Health:      { bar: 'bg-pink-500',      text: 'text-pink-400' },
  Environment: { bar: 'bg-emerald',       text: 'text-emerald' },
  Education:   { bar: 'bg-for-300',       text: 'text-for-300' },
}

function getCatStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bar: 'bg-surface-400', text: 'text-surface-500' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMilestoneStatus(current: number, milestones: Milestone[]) {
  const unlocked = milestones.filter((m) => current >= m.value)
  const next = milestones.find((m) => current < m.value) ?? null
  const latest = unlocked[unlocked.length - 1] ?? null
  return { unlocked: unlocked.length, total: milestones.length, next, latest }
}

function milestoneProgress(current: number, next: Milestone | null, prev: number): number {
  if (!next) return 100
  const range = next.value - prev
  const done = current - prev
  return Math.min(100, Math.max(0, Math.round((done / range) * 100)))
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
  return n.toLocaleString()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-surface-300/50', className)} />
}

// ─── Milestone Track Card ─────────────────────────────────────────────────────

function MilestoneCard({
  track,
  value,
  delay = 0,
}: {
  track: MilestoneTrack
  value: number
  delay?: number
}) {
  const { unlocked, total, next, latest } = getMilestoneStatus(value, track.milestones)
  const prevValue = next
    ? track.milestones[unlocked - 1]?.value ?? 0
    : track.milestones[track.milestones.length - 1]?.value ?? 0
  const pct = milestoneProgress(value, next, prevValue)
  const Icon = track.icon
  const allDone = !next

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={cn(
        'relative rounded-2xl p-5 border overflow-hidden',
        track.bg,
        track.border,
      )}
    >
      {/* Glow */}
      <div className={cn('absolute inset-0 pointer-events-none', track.glow)} />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4 flex-shrink-0', track.color)} />
            <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
              {track.label}
            </span>
          </div>
          {allDone && (
            <span className="text-[10px] font-mono font-bold text-gold bg-gold/10 border border-gold/30 rounded-full px-2 py-0.5">
              MAX
            </span>
          )}
        </div>

        {/* Current value */}
        <div className="flex items-baseline gap-1.5">
          <span className={cn('text-3xl font-black font-mono tabular-nums', track.color)}>
            <AnimatedNumber value={value} />
          </span>
          <span className="text-xs text-surface-500 font-mono">total</span>
        </div>

        {/* Milestone progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-surface-500 font-mono">
              {latest ? (
                <span className={track.color}>{latest.label}</span>
              ) : (
                'First milestone'
              )}
            </span>
            <span className="text-[10px] text-surface-500 font-mono">
              {unlocked}/{total}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-300/50 overflow-hidden">
            <motion.div
              className={cn('h-full rounded-full', track.color.replace('text-', 'bg-').replace('-400', '-500').replace('-300', '-400'))}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, delay: delay + 0.2 }}
            />
          </div>
        </div>

        {/* Next milestone */}
        {next ? (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-surface-500">
              Next: <span className="text-white font-medium">{next.label}</span>
            </span>
            <span className={cn('text-[11px] font-mono font-bold', track.color)}>
              {formatCount(next.value - value)} to go
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-gold" />
            <span className="text-[11px] text-gold font-medium">All milestones reached!</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProgressClient() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: PlatformStats = await res.json()
      setStats(data)
      setError(null)
    } catch (e) {
      setError('Failed to load progress data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totals = stats?.totals
  const byCategory = stats?.topicsByCategory ?? []
  const lawsByCategory = stats?.lawsByCategory ?? []

  // Build category stats: topics count + laws count
  const categoryRows = byCategory.map((row) => {
    const lawRow = lawsByCategory.find((l) => l.category === row.category)
    const laws = lawRow?.count ?? 0
    const pct = row.count > 0 ? Math.round((laws / row.count) * 100) : 0
    return { ...row, laws, pct }
  }).sort((a, b) => b.count - a.count)

  // Overall platform score (% of topics that became law)
  const totalTopics = byCategory.reduce((s, r) => s + r.count, 0)
  const totalLaws = lawsByCategory.reduce((s, r) => s + r.count, 0)
  const overallLawRate = totalTopics > 0 ? Math.round((totalLaws / totalTopics) * 100) : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-24 md:pb-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
              <TrendingUp className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="font-mono font-bold text-white text-xl tracking-tight">
                Civic Progress
              </h1>
              <p className="text-sm text-surface-500 mt-0.5">
                Platform milestones and category achievements
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-xs text-surface-500 hover:text-white font-mono transition-colors disabled:opacity-40 mt-0.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading ? (
          /* Skeleton */
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <Sk className="h-3 w-16" />
                  <Sk className="h-9 w-24" />
                  <Sk className="h-1.5 w-full" />
                  <Sk className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <Sk className="h-3 w-16" />
                  <Sk className="h-9 w-24" />
                  <Sk className="h-1.5 w-full" />
                  <Sk className="h-3 w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-against-400 font-mono text-sm">{error}</p>
            <button
              onClick={() => load()}
              className="mt-4 text-sm text-surface-500 hover:text-white font-mono transition-colors"
            >
              Try again
            </button>
          </div>
        ) : totals ? (
          <AnimatePresence>
            <div className="space-y-8">

              {/* Overall platform score */}
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-1">
                      Platform Maturity
                    </p>
                    <p className="text-sm text-surface-400 max-w-xs">
                      {overallLawRate}% of proposed topics have become laws — measuring how much civic consensus the Lobby has built.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-4xl font-black font-mono text-gold">
                        <AnimatedNumber value={overallLawRate} suffix="%" />
                      </p>
                      <p className="text-[11px] text-surface-500 font-mono mt-0.5">law rate</p>
                    </div>
                    <div className="h-12 w-px bg-surface-300" />
                    <div className="text-center">
                      <p className="text-4xl font-black font-mono text-gold">
                        <AnimatedNumber value={totalLaws} />
                      </p>
                      <p className="text-[11px] text-surface-500 font-mono mt-0.5">laws</p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-surface-300/50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gold"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallLawRate}%` }}
                    transition={{ duration: 0.9, delay: 0.1 }}
                  />
                </div>
              </motion.div>

              {/* Milestone tracks — main 4 */}
              <div>
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  Milestones
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TRACKS.slice(0, 4).map((track, i) => (
                    <Link key={track.key} href={track.href} className="group block hover:opacity-90 transition-opacity">
                      <MilestoneCard
                        track={track}
                        value={totals[track.key] as number}
                        delay={i * 0.06}
                      />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Secondary milestone tracks */}
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TRACKS.slice(4).map((track, i) => (
                    <Link key={track.key} href={track.href} className="group block hover:opacity-90 transition-opacity">
                      <MilestoneCard
                        track={track}
                        value={totals[track.key] as number}
                        delay={0.24 + i * 0.06}
                      />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Category law pass rates */}
              {categoryRows.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Scale className="h-4 w-4 text-surface-500" />
                      <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                        Law Rate by Category
                      </h2>
                    </div>
                    <span className="text-[11px] text-surface-500 font-mono">
                      laws / total topics
                    </span>
                  </div>
                  <div className="space-y-3.5">
                    {categoryRows.map((row, i) => {
                      const style = getCatStyle(row.category)
                      return (
                        <motion.div
                          key={row.category}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.04 }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Link
                              href={`/categories/${row.category.toLowerCase()}`}
                              className={cn('text-sm font-medium hover:opacity-80 transition-opacity', style.text)}
                            >
                              {row.category}
                            </Link>
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <span className={style.text}>{row.laws}</span>
                              <span className="text-surface-500">/ {row.count}</span>
                              <span className="text-surface-400 w-8 text-right">{row.pct}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-surface-300/50 overflow-hidden">
                            <motion.div
                              className={cn('h-full rounded-full', style.bar)}
                              initial={{ width: 0 }}
                              animate={{ width: `${row.pct}%` }}
                              transition={{ duration: 0.6, delay: 0.55 + i * 0.04 }}
                            />
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* Recent laws highlight */}
              {stats.recentLaws && stats.recentLaws.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Gavel className="h-4 w-4 text-gold" />
                      <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                        Recent Laws
                      </h2>
                    </div>
                    <Link
                      href="/law"
                      className="text-[11px] font-mono text-gold hover:text-amber-300 transition-colors flex items-center gap-1"
                    >
                      All laws <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {stats.recentLaws.slice(0, 5).map((law, i) => {
                      const catStyle = getCatStyle(law.category ?? '')
                      return (
                        <motion.div
                          key={law.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.65 + i * 0.05 }}
                        >
                          <Link
                            href={`/law/${law.id}`}
                            className="flex items-start gap-3 p-3 rounded-xl bg-surface-200 border border-surface-300/50 hover:border-gold/30 transition-colors group"
                          >
                            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0 mt-0.5">
                              <Gavel className="h-3.5 w-3.5 text-gold" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium leading-snug line-clamp-2 group-hover:text-gold transition-colors">
                                {law.statement}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {law.category && (
                                  <span className={cn('text-[10px] font-mono', catStyle.text)}>
                                    {law.category}
                                  </span>
                                )}
                                {law.total_votes != null && (
                                  <span className="text-[10px] text-surface-500 font-mono">
                                    {law.total_votes.toLocaleString()} votes
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {/* Quick links */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {[
                  { href: '/stats', label: 'Platform Stats', icon: BarChart2 },
                  { href: '/observatory', label: 'Observatory', icon: Zap },
                  { href: '/vitals', label: 'Discourse Vitals', icon: Flame },
                  { href: '/leaderboard', label: 'Leaderboard', icon: Award },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 text-sm text-surface-500 hover:text-white transition-colors"
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-xs font-mono truncate">{label}</span>
                  </Link>
                ))}
              </motion.div>

            </div>
          </AnimatePresence>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
