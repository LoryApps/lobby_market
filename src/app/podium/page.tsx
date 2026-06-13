'use client'

/**
 * /podium — The Civic Podium
 *
 * Weekly per-category leaderboard. Every Monday the podium resets and the
 * race begins again. Top 3 contributors per category earn gold, silver, and
 * bronze positions for the week.
 *
 * Score = votes cast (×1) + arguments posted (×3) + upvotes received (×2)
 *
 * Distinct from:
 *   /leaderboard  — all-time reputation ranking
 *   /league       — monthly clout-earning sprint (single tier ladder)
 *   /weekly       — platform-wide weekly digest (no per-category winners)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  BarChart2,
  BookOpen,
  Cpu,
  ExternalLink,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Timer,
  Trophy,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  PodiumResponse,
  PodiumCategoryResult,
  PodiumEntry,
} from '@/app/api/podium/route'

// ─── Category config ──────────────────────────────────────────────────────────

interface CatConfig {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  gradient: string
}

const CATEGORY_CONFIG: Record<string, CatConfig> = {
  Politics: {
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    gradient: 'from-for-600/20 to-transparent',
  },
  Economics: {
    icon: TrendingUp,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    gradient: 'from-amber-600/20 to-transparent',
  },
  Technology: {
    icon: Cpu,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    gradient: 'from-purple/20 to-transparent',
  },
  Science: {
    icon: FlaskConical,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    gradient: 'from-emerald/20 to-transparent',
  },
  Ethics: {
    icon: Scale,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    gradient: 'from-against-600/20 to-transparent',
  },
  Philosophy: {
    icon: BookOpen,
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/30',
    gradient: 'from-for-500/15 to-transparent',
  },
  Culture: {
    icon: Music2,
    color: 'text-gold',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    gradient: 'from-amber-500/20 to-transparent',
  },
  Health: {
    icon: Heart,
    color: 'text-against-300',
    bg: 'bg-against-400/10',
    border: 'border-against-400/30',
    gradient: 'from-against-500/15 to-transparent',
  },
  Environment: {
    icon: Leaf,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    gradient: 'from-emerald/15 to-transparent',
  },
  Education: {
    icon: GraduationCap,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    gradient: 'from-purple/15 to-transparent',
  },
}

// ─── Medal config ─────────────────────────────────────────────────────────────

const MEDAL: Record<1 | 2 | 3, { label: string; color: string; bg: string; border: string; ring: string }> = {
  1: {
    label: 'Gold',
    color: 'text-amber-400',
    bg: 'bg-amber-400/15',
    border: 'border-amber-400/40',
    ring: 'ring-2 ring-amber-400/30',
  },
  2: {
    label: 'Silver',
    color: 'text-surface-300',
    bg: 'bg-surface-300/15',
    border: 'border-surface-300/40',
    ring: 'ring-1 ring-surface-300/20',
  },
  3: {
    label: 'Bronze',
    color: 'text-amber-700',
    bg: 'bg-amber-800/15',
    border: 'border-amber-700/40',
    ring: 'ring-1 ring-amber-700/20',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function weekLabel(isoStart: string, isoEnd: string): string {
  const start = new Date(isoStart)
  const end = new Date(isoEnd)
  end.setDate(end.getDate() - 1) // inclusive end
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

function timeUntilReset(isoEnd: string): string {
  const diff = new Date(isoEnd).getTime() - Date.now()
  if (diff <= 0) return 'resetting now'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (d >= 1) return `resets in ${d}d ${h % 24}h`
  return `resets in ${h}h`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MedalIcon({ rank }: { rank: 1 | 2 | 3 }) {
  const m = MEDAL[rank]
  const label = rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'
  return (
    <div
      className={cn(
        'flex items-center justify-center h-7 w-7 rounded-full text-[11px] font-mono font-bold flex-shrink-0',
        m.bg,
        m.border,
        'border'
      )}
    >
      <span className={m.color}>{label}</span>
    </div>
  )
}

function PodiumEntryRow({ entry }: { entry: PodiumEntry }) {
  const m = MEDAL[entry.rank]
  const name = entry.user.display_name ?? entry.user.username
  const isFirst = entry.rank === 1

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (entry.rank - 1) * 0.06 }}
    >
      <Link
        href={`/profile/${entry.user.username}`}
        className={cn(
          'group flex items-center gap-3 rounded-xl p-3 border transition-all',
          isFirst
            ? 'bg-amber-400/5 border-amber-400/25 hover:border-amber-400/50 hover:bg-amber-400/10'
            : 'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200'
        )}
      >
        <MedalIcon rank={entry.rank} />

        <Avatar
          src={entry.user.avatar_url}
          fallback={name}
          size={isFirst ? 'md' : 'sm'}
          className={cn(isFirst && m.ring, 'flex-shrink-0')}
        />

        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-semibold truncate transition-colors group-hover:text-white',
            isFirst ? 'text-white text-sm' : 'text-surface-100 text-[13px]'
          )}>
            {name}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {entry.weekly_votes > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-mono text-surface-500">
                <Zap className="h-2.5 w-2.5 text-for-400" />
                {entry.weekly_votes}v
              </span>
            )}
            {entry.weekly_arguments > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-mono text-surface-500">
                <MessageSquare className="h-2.5 w-2.5 text-purple" />
                {entry.weekly_arguments}a
              </span>
            )}
            {entry.weekly_upvotes > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-mono text-surface-500">
                <Award className="h-2.5 w-2.5 text-gold" />
                {entry.weekly_upvotes}↑
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className={cn('font-mono font-bold text-sm', m.color)}>
            {fmtNum(entry.score)}
          </p>
          <p className="text-[10px] font-mono text-surface-500">pts</p>
        </div>

        <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

function CategoryPodium({ result }: { result: PodiumCategoryResult }) {
  const cfg = CATEGORY_CONFIG[result.category] ?? CATEGORY_CONFIG['Politics']
  const Icon = cfg.icon
  const hasEntries = result.entries.length > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border overflow-hidden', cfg.border, 'bg-surface-100')}
    >
      {/* Category header */}
      <div className={cn('px-4 pt-4 pb-3 bg-gradient-to-b', cfg.gradient)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border', cfg.bg, cfg.border)}>
              <Icon className={cn('h-4 w-4', cfg.color)} />
            </div>
            <div>
              <h2 className={cn('font-mono text-sm font-bold', cfg.color)}>{result.category}</h2>
              <p className="text-[11px] font-mono text-surface-500">
                {fmtNum(result.total_votes_this_week)}v · {fmtNum(result.total_arguments_this_week)}a this week
              </p>
            </div>
          </div>
          <Link
            href={`/categories/${result.category}`}
            className={cn(
              'text-[11px] font-mono px-2 py-1 rounded-lg border transition-colors',
              cfg.bg, cfg.border, cfg.color,
              'hover:opacity-80'
            )}
          >
            Browse →
          </Link>
        </div>
      </div>

      {/* Podium entries */}
      <div className="px-4 pb-4 space-y-2">
        {hasEntries ? (
          result.entries.map((entry) => (
            <PodiumEntryRow key={entry.user.id} entry={entry} />
          ))
        ) : (
          <div className="py-4 text-center">
            <p className="text-sm font-mono text-surface-500">No activity yet this week</p>
            <p className="text-xs font-mono text-surface-600 mt-1">Be the first to claim this podium</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function PodiumSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          {[0, 1, 2].map((j) => (
            <div key={j} className="flex items-center gap-3 rounded-xl bg-surface-200 p-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-2.5 w-20" />
              </div>
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PodiumPage() {
  const [data, setData] = useState<PodiumResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/podium', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Overall stats
  const totalParticipants = data
    ? new Set(
        data.categories.flatMap((c) => c.entries.map((e) => e.user.id))
      ).size
    : 0

  const totalVotes = data
    ? data.categories.reduce((sum, c) => sum + c.total_votes_this_week, 0)
    : 0

  const activeCategories = data
    ? data.categories.filter((c) => c.entries.length > 0).length
    : 0

  const filteredCategories = data
    ? activeCategory
      ? data.categories.filter((c) => c.category === activeCategory)
      : data.categories
    : []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-amber-400/10 border border-amber-400/30 flex-shrink-0">
                <Trophy className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">The Civic Podium</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {data ? weekLabel(data.week_start, data.week_end) : 'Weekly Category Champions'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => load(true)}
                disabled={loading || refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm font-mono text-surface-500 leading-relaxed max-w-2xl">
            Top 3 contributors per category each week, ranked by votes cast, arguments posted, and upvotes earned.
            The podium resets every Monday — claim your spot.
          </p>

          {/* Reset countdown */}
          {data && (
            <div className="flex items-center gap-2 mt-3">
              <Timer className="h-3.5 w-3.5 text-surface-500" />
              <span className="text-xs font-mono text-surface-500">{timeUntilReset(data.week_end)}</span>
            </div>
          )}
        </motion.div>

        {/* ── Platform-wide stats strip ─────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 mb-6"
          >
            {[
              {
                icon: Trophy,
                label: 'Active categories',
                value: activeCategories,
                color: 'text-amber-400',
              },
              {
                icon: Users,
                label: 'On the podium',
                value: totalParticipants,
                color: 'text-for-400',
              },
              {
                icon: Zap,
                label: 'Votes this week',
                value: totalVotes,
                color: 'text-emerald',
              },
              {
                icon: Globe,
                label: 'Categories tracked',
                value: 10,
                color: 'text-purple',
              },
            ].map(({ icon: Icon, label, value, color }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-100 border border-surface-300 px-4 py-3 min-w-[110px] flex-shrink-0"
              >
                <Icon className={cn('h-4 w-4', color)} />
                <span className={cn('font-mono text-2xl font-bold', color)}>
                  <AnimatedNumber value={value} />
                </span>
                <span className="text-[11px] font-mono text-surface-500 text-center">{label}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* ── Scoring legend ────────────────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mb-6 rounded-xl bg-surface-100 border border-surface-300 px-4 py-3"
          >
            <p className="text-[11px] font-mono text-surface-500 flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-semibold text-surface-400">Score formula:</span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-for-400" />
                <span>vote = <strong className="text-white">+1</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3 text-purple" />
                <span>argument = <strong className="text-white">+3</strong></span>
              </span>
              <span className="flex items-center gap-1">
                <Award className="h-3 w-3 text-gold" />
                <span>upvote received = <strong className="text-white">+2</strong></span>
              </span>
            </p>
          </motion.div>
        )}

        {/* ── Category filter pills ─────────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 mb-6 scrollbar-hide"
          >
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                activeCategory === null
                  ? 'bg-white text-surface-900 border-white'
                  : 'bg-surface-200 text-surface-400 border-surface-300 hover:border-surface-400 hover:text-white'
              )}
            >
              All 10
            </button>
            {data.categories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat.category]
              const isActive = activeCategory === cat.category
              const hasWinner = cat.entries.length > 0
              return (
                <button
                  key={cat.category}
                  onClick={() => setActiveCategory(isActive ? null : cat.category)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                    isActive
                      ? cn(cfg.bg, cfg.border, cfg.color)
                      : hasWinner
                      ? 'bg-surface-200 text-surface-300 border-surface-300 hover:border-surface-400 hover:text-white'
                      : 'bg-surface-100 text-surface-600 border-surface-200 opacity-50'
                  )}
                >
                  {cat.category}
                  {hasWinner && (
                    <span className={cn('opacity-70', isActive ? cfg.color : 'text-surface-500')}>
                      ({cat.entries.length})
                    </span>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PodiumSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Scale}
                title="Failed to load the podium"
                description="The Lobby is temporarily unavailable. Try refreshing."
                actions={[{ label: 'Retry', onClick: () => load() }]}
              />
            </motion.div>
          ) : data ? (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {filteredCategories.map((result, idx) => (
                <motion.div
                  key={result.category}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <CategoryPodium result={result} />
                </motion.div>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* ── Footer links ──────────────────────────────────────────────── */}
        {data && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-10 border-t border-surface-300 pt-6"
          >
            <div className="flex flex-wrap gap-3">
              <Link
                href="/podium/champions"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-xs font-mono font-semibold text-gold hover:bg-gold/20 transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                Hall of Champions
              </Link>
              <Link
                href="/leaderboard"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                All-time leaderboard
              </Link>
              <Link
                href="/league"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
              >
                <Loader2 className="h-3.5 w-3.5" />
                Monthly league
              </Link>
              <Link
                href="/weekly"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Weekly digest
              </Link>
              <Link
                href="/categories"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
              >
                <Globe className="h-3.5 w-3.5" />
                Browse categories
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
