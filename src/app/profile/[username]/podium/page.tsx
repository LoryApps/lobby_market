'use client'

/**
 * /profile/[username]/podium — Civic Podium Record
 *
 * Shows a user's complete history of weekly per-category podium finishes.
 * Gold (1st), Silver (2nd), Bronze (3rd) trophies with week, category,
 * score breakdown, and a career stats summary panel.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Cpu,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Medal,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  ThumbsUp,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PodiumHistoryResponse, PodiumHistoryEntry } from '@/app/api/podium/history/route'

// ─── Category icon map ────────────────────────────────────────────────────────

const CAT_ICON: Record<string, typeof Trophy> = {
  Politics:    Landmark,
  Economics:   BarChart2,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Philosophy:  BookOpen,
  Culture:     Music2,
  Health:      Heart,
  Environment: Leaf,
  Education:   GraduationCap,
}

const CAT_COLOR: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-for-300',
  Science:     'text-emerald',
  Ethics:      'text-purple',
  Philosophy:  'text-surface-600',
  Culture:     'text-against-400',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Rank config ──────────────────────────────────────────────────────────────

const RANK_CONFIG = {
  1: { label: '1st', medal: 'Gold',   color: 'text-gold',        bg: 'bg-gold/10',    border: 'border-gold/40',    icon: Trophy },
  2: { label: '2nd', medal: 'Silver', color: 'text-surface-600', bg: 'bg-surface-200/50', border: 'border-surface-400/40', icon: Medal },
  3: { label: '3rd', medal: 'Bronze', color: 'text-amber-600',   bg: 'bg-amber-900/20', border: 'border-amber-700/40', icon: Award },
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PodiumSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  )
}

// ─── Stats panel ──────────────────────────────────────────────────────────────

function StatsPanel({ data }: { data: PodiumHistoryResponse }) {
  const RANK_ICON = [Trophy, Medal, Award]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
      {/* Profile row */}
      <div className="flex items-center gap-3 mb-5">
        <Avatar
          src={data.avatar_url}
          fallback={data.display_name ?? data.username}
          size="lg"
        />
        <div>
          <p className="text-sm font-bold text-white">
            {data.display_name ?? data.username}
          </p>
          <p className="text-xs font-mono text-surface-500">@{data.username}</p>
        </div>
        <Link
          href={`/profile/${data.username}`}
          className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          Profile
        </Link>
      </div>

      {/* Medal counts */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {([1, 2, 3] as const).map((rank) => {
          const cfg = RANK_CONFIG[rank]
          const count = rank === 1 ? data.gold_count : rank === 2 ? data.silver_count : data.bronze_count
          const Icon = RANK_ICON[rank - 1]
          return (
            <div
              key={rank}
              className={cn(
                'flex flex-col items-center justify-center gap-1 p-3 rounded-xl border',
                cfg.bg, cfg.border
              )}
            >
              <Icon className={cn('h-5 w-5', cfg.color)} />
              <span className={cn('text-xl font-bold font-mono', cfg.color)}>{count}</span>
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                {cfg.medal}
              </span>
            </div>
          )
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-200/60 p-3">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Total Podiums</p>
          <p className="text-lg font-bold font-mono text-white">{data.total_podiums}</p>
        </div>
        <div className="rounded-xl bg-surface-200/60 p-3">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1">Best Score</p>
          <p className="text-lg font-bold font-mono text-gold">{data.best_score.toLocaleString()}</p>
        </div>
      </div>

      {/* Categories won */}
      {data.categories_won.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-300">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Categories Won</p>
          <div className="flex flex-wrap gap-1.5">
            {data.categories_won.map((cat) => {
              const Icon = CAT_ICON[cat] ?? Globe
              return (
                <span
                  key={cat}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/10 border border-gold/30 text-[10px] font-mono text-gold"
                >
                  <Icon className="h-2.5 w-2.5" />
                  {cat}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function EntryCard({ entry, idx }: { entry: PodiumHistoryEntry; idx: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = RANK_CONFIG[entry.rank]
  const CatIcon = CAT_ICON[entry.category] ?? Globe
  const RankIcon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.03 }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          'w-full text-left rounded-2xl border p-4 transition-all',
          'bg-surface-100 hover:bg-surface-200/50',
          cfg.border,
          expanded && 'rounded-b-none'
        )}
      >
        <div className="flex items-center gap-3">
          {/* Rank medal */}
          <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0', cfg.bg, cfg.border)}>
            <RankIcon className={cn('h-5 w-5', cfg.color)} />
          </div>

          {/* Category + week */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CatIcon className={cn('h-3.5 w-3.5 flex-shrink-0', CAT_COLOR[entry.category] ?? 'text-surface-500')} />
              <span className="text-sm font-semibold text-white truncate">{entry.category}</span>
              <span className={cn('text-xs font-mono font-bold px-1.5 py-0.5 rounded-md border', cfg.bg, cfg.border, cfg.color)}>
                #{entry.rank}
              </span>
            </div>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Week of {weekLabel(entry.week_start)}</p>
          </div>

          {/* Score + expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn('text-sm font-bold font-mono', cfg.color)}>
              {entry.score.toLocaleString()} pts
            </span>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-surface-500" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
            )}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'rounded-b-2xl border-l border-r border-b p-4 bg-surface-200/40',
              cfg.border
            )}>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-for-400 mb-1">
                    <Vote className="h-3 w-3" />
                  </div>
                  <p className="text-lg font-bold font-mono text-white">{entry.weekly_votes}</p>
                  <p className="text-[10px] font-mono text-surface-500">Votes</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-purple mb-1">
                    <MessageSquare className="h-3 w-3" />
                  </div>
                  <p className="text-lg font-bold font-mono text-white">{entry.weekly_arguments}</p>
                  <p className="text-[10px] font-mono text-surface-500">Arguments</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-emerald mb-1">
                    <ThumbsUp className="h-3 w-3" />
                  </div>
                  <p className="text-lg font-bold font-mono text-white">{entry.weekly_upvotes}</p>
                  <p className="text-[10px] font-mono text-surface-500">Upvotes</p>
                </div>
              </div>
              <p className="text-[10px] font-mono text-surface-600 mt-3 text-center">
                Score = votes×1 + arguments×3 + upvotes×2
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Filter pills ─────────────────────────────────────────────────────────────

type RankFilter = 'all' | '1' | '2' | '3'
type CatFilter = string | null

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProfilePodiumPage() {
  const params = useParams<{ username: string }>()
  const username = params?.username ?? ''

  const [data, setData] = useState<PodiumHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [rankFilter, setRankFilter] = useState<RankFilter>('all')
  const [catFilter, setCatFilter] = useState<CatFilter>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/podium/history?username=${encodeURIComponent(username)}`, {
        cache: 'no-store',
      })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [username])

  useEffect(() => { if (username) load() }, [load, username])

  const filtered = (data?.entries ?? []).filter((e) => {
    if (rankFilter !== 'all' && e.rank !== Number(rankFilter)) return false
    if (catFilter && e.category !== catFilter) return false
    return true
  })

  const availableCats = [...new Set((data?.entries ?? []).map((e) => e.category))].sort()

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/profile/${username}`}
            aria-label="Back to profile"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" aria-hidden="true" />
              Podium Record
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              @{username} · Weekly category finishes
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh podium history"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <PodiumSkeleton />
        ) : !data ? (
          <EmptyState
            icon={Trophy}
            title="User not found"
            description="This profile doesn't exist or hasn't earned any podium placements yet."
          />
        ) : (
          <>
            <StatsPanel data={data} />

            {data.entries.length === 0 ? (
              <EmptyState
                icon={Medal}
                title="No podium placements yet"
                description="Compete in the weekly per-category leaderboard by voting, writing arguments, and earning upvotes."
                actions={[{ label: 'View the Podium', href: '/podium' }]}
              />
            ) : (
              <>
                {/* Filters */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {/* Rank filters */}
                  {(['all', '1', '2', '3'] as RankFilter[]).map((r) => {
                    const label = r === 'all' ? 'All' : r === '1' ? 'Gold' : r === '2' ? 'Silver' : 'Bronze'
                    const isActive = rankFilter === r
                    return (
                      <button
                        key={r}
                        onClick={() => setRankFilter(r)}
                        className={cn(
                          'px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all',
                          isActive
                            ? r === '1' ? 'bg-gold/20 border-gold/50 text-gold'
                              : r === '2' ? 'bg-surface-300 border-surface-400 text-white'
                              : r === '3' ? 'bg-amber-900/30 border-amber-700/50 text-amber-500'
                              : 'bg-surface-300 border-surface-400 text-white'
                            : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                        )}
                      >
                        {label}
                      </button>
                    )
                  })}

                  {/* Category filter */}
                  {availableCats.length > 1 && (
                    <select
                      value={catFilter ?? ''}
                      onChange={(e) => setCatFilter(e.target.value || null)}
                      aria-label="Filter by category"
                      className="px-3 py-1 rounded-full text-xs font-mono bg-surface-100 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-all focus:outline-none focus:border-surface-400"
                    >
                      <option value="">All Categories</option>
                      {availableCats.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Results count */}
                <p className="text-xs font-mono text-surface-500 mb-3">
                  {filtered.length} placement{filtered.length !== 1 ? 's' : ''}
                  {filtered.length !== data.entries.length && ` (filtered from ${data.entries.length})`}
                </p>

                {/* Entry list */}
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {filtered.length === 0 ? (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <EmptyState
                          icon={Zap}
                          title="No matches"
                          description="Try adjusting the filters."
                          actions={[{ label: 'Clear filters', onClick: () => { setRankFilter('all'); setCatFilter(null) } }]}
                        />
                      </motion.div>
                    ) : (
                      filtered.map((entry, idx) => (
                        <EntryCard
                          key={`${entry.week_start}-${entry.category}-${entry.rank}`}
                          entry={entry}
                          idx={idx}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer link */}
                <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-3">
                  <Link
                    href="/podium"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-xs font-mono font-semibold text-gold hover:bg-gold/20 transition-colors"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Current week&apos;s podium
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    All-time leaderboard
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
