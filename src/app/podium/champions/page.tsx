'use client'

/**
 * /podium/champions — The Podium Hall of Champions
 *
 * All-time podium standings ranked by medal score (gold×5, silver×3, bronze×1).
 * Two views:
 *   - Overall: combined leaderboard across all 10 categories
 *   - By Category: each category's reigning gold champion + runner-up
 *
 * Powered by the podium_snapshots table written by the weekly cron.
 *
 * Distinct from:
 *   /podium                    — current week's live standings
 *   /profile/[u]/podium        — single user's full history
 *   /leaderboard/legends       — all-time records (most clout, most laws, etc.)
 *   /leaderboard/categories    — per-category weekly leaderboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Cpu,
  Crown,
  FlaskConical,
  GraduationCap,
  Globe,
  Heart,
  Landmark,
  Leaf,
  Medal,
  Music2,
  RefreshCw,
  Scale,
  Trophy,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { ChampionsResponse, ChampionEntry, CategoryChampion } from '@/app/api/podium/champions/route'

// ─── Category icon / color maps ───────────────────────────────────────────────

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

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',    border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',       border: 'border-gold/30' },
  Technology:  { text: 'text-for-300',     bg: 'bg-for-400/10',    border: 'border-for-400/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Ethics:      { text: 'text-purple',      bg: 'bg-purple/10',     border: 'border-purple/30' },
  Philosophy:  { text: 'text-surface-600', bg: 'bg-surface-300/30', border: 'border-surface-400/30' },
  Culture:     { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/20' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',    border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',    border: 'border-for-500/30' },
}

function catStyle(cat: string) {
  return CAT_COLOR[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-200/50', border: 'border-surface-400/30' }
}

// ─── Rank helpers ─────────────────────────────────────────────────────────────

const RANK_TOP3 = {
  1: { color: 'text-gold',        bg: 'bg-gold/10',       border: 'border-gold/40',       icon: Crown },
  2: { color: 'text-surface-600', bg: 'bg-surface-200/50', border: 'border-surface-400/40', icon: Medal },
  3: { color: 'text-amber-500',   bg: 'bg-amber-900/20',  border: 'border-amber-700/40',  icon: Award },
} as const

// ─── Medal pip ────────────────────────────────────────────────────────────────

function MedalPips({ gold, silver, bronze }: { gold: number; silver: number; bronze: number }) {
  if (gold + silver + bronze === 0) return <span className="text-surface-600 text-xs font-mono">—</span>
  return (
    <div className="flex items-center gap-1.5">
      {gold > 0 && (
        <span className="flex items-center gap-0.5 text-gold">
          <Crown className="h-3 w-3" />
          <span className="text-xs font-mono font-bold">{gold}</span>
        </span>
      )}
      {silver > 0 && (
        <span className="flex items-center gap-0.5 text-surface-600">
          <Medal className="h-3 w-3" />
          <span className="text-xs font-mono font-bold">{silver}</span>
        </span>
      )}
      {bronze > 0 && (
        <span className="flex items-center gap-0.5 text-amber-500">
          <Award className="h-3 w-3" />
          <span className="text-xs font-mono font-bold">{bronze}</span>
        </span>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChampionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Category Champion Card ───────────────────────────────────────────────────

function CategoryCard({ entry }: { entry: CategoryChampion }) {
  const Icon = CAT_ICON[entry.category] ?? Globe
  const cs = catStyle(entry.category)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'rounded-2xl border p-4 flex flex-col gap-2',
        'bg-surface-100 hover:bg-surface-200/50 transition-colors',
        entry.champion ? cs.border : 'border-surface-300'
      )}
    >
      {/* Category header */}
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center justify-center h-6 w-6 rounded-lg border flex-shrink-0', cs.bg, cs.border)}>
          <Icon className={cn('h-3.5 w-3.5', cs.text)} />
        </div>
        <span className={cn('text-[11px] font-mono font-bold uppercase tracking-wider truncate', cs.text)}>
          {entry.category}
        </span>
      </div>

      {entry.champion ? (
        <>
          <Link
            href={`/profile/${entry.champion.username}/podium`}
            className="flex items-center gap-2 group"
          >
            <Avatar
              src={entry.champion.avatar_url}
              fallback={entry.champion.display_name ?? entry.champion.username}
              size="xs"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate group-hover:text-for-300 transition-colors">
                {entry.champion.display_name ?? entry.champion.username}
              </p>
              <p className="text-[10px] font-mono text-surface-500 truncate">
                @{entry.champion.username}
              </p>
            </div>
            <Crown className="h-3 w-3 text-gold flex-shrink-0" />
          </Link>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-gold font-semibold">
              {entry.gold_wins}× Gold
            </span>
            {entry.runner_up && (
              <span className="text-[10px] font-mono text-surface-500 truncate">
                2nd @{entry.runner_up.username}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center py-2">
          <p className="text-xs font-mono text-surface-600">No data yet</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Overall Ranking Row ──────────────────────────────────────────────────────

function RankRow({ entry, idx }: { entry: ChampionEntry; idx: number }) {
  const isTop3 = entry.rank <= 3
  const rankCfg = isTop3 ? RANK_TOP3[entry.rank as 1 | 2 | 3] : null
  const RankIcon = rankCfg?.icon

  const catCs = entry.best_category ? catStyle(entry.best_category) : null
  const BestCatIcon = entry.best_category ? (CAT_ICON[entry.best_category] ?? Globe) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.025 }}
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3 transition-colors',
        'bg-surface-100 hover:bg-surface-200/50',
        isTop3 ? rankCfg!.border : 'border-surface-300'
      )}
    >
      {/* Rank badge */}
      <div
        className={cn(
          'flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0 font-mono font-bold',
          isTop3 ? cn(rankCfg!.bg, rankCfg!.border, rankCfg!.color) : 'bg-surface-200/50 border-surface-400/30 text-surface-500',
          isTop3 ? 'text-sm' : 'text-xs'
        )}
      >
        {isTop3 && RankIcon ? (
          <RankIcon className="h-4 w-4" />
        ) : (
          `#${entry.rank}`
        )}
      </div>

      {/* Avatar + name */}
      <Link
        href={`/profile/${entry.user.username}/podium`}
        className="flex items-center gap-2.5 flex-1 min-w-0 group"
      >
        <Avatar
          src={entry.user.avatar_url}
          fallback={entry.user.display_name ?? entry.user.username}
          size="sm"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
            {entry.user.display_name ?? entry.user.username}
          </p>
          <p className="text-xs font-mono text-surface-500 truncate">
            @{entry.user.username}
          </p>
        </div>
      </Link>

      {/* Best category badge */}
      {entry.best_category && catCs && BestCatIcon && (
        <div className={cn(
          'hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-mono font-semibold flex-shrink-0',
          catCs.bg, catCs.border, catCs.text
        )}>
          <BestCatIcon className="h-3 w-3" />
          {entry.best_category}
        </div>
      )}

      {/* Medal counts */}
      <div className="flex-shrink-0">
        <MedalPips gold={entry.gold} silver={entry.silver} bronze={entry.bronze} />
      </div>

      {/* Medal score */}
      <div className="flex-shrink-0 text-right hidden md:block">
        <p className={cn('text-sm font-bold font-mono', isTop3 ? rankCfg!.color : 'text-surface-500')}>
          <AnimatedNumber value={entry.medal_score} />
        </p>
        <p className="text-[10px] font-mono text-surface-600">pts</p>
      </div>
    </motion.div>
  )
}

// ─── View toggle ──────────────────────────────────────────────────────────────

type View = 'overall' | 'categories'

// ─── Main component ───────────────────────────────────────────────────────────

export default function PodiumChampionsPage() {
  const [data, setData] = useState<ChampionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<View>('categories')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/podium/champions?limit=50', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const topChampion = data?.overall[0] ?? null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/podium"
            aria-label="Back to current podium"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono flex items-center gap-2">
              <Crown className="h-5 w-5 text-gold" aria-hidden="true" />
              Hall of Champions
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              All-time podium medal standings
              {data && ` · ${data.weeks_tracked} week${data.weeks_tracked !== 1 ? 's' : ''} tracked`}
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh champions"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Current champion spotlight */}
        {!loading && topChampion && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl bg-gradient-to-br from-gold/10 via-surface-100 to-surface-200/50 border border-gold/30 p-5 mb-6"
          >
            <p className="text-[10px] font-mono font-bold text-gold uppercase tracking-wider mb-3">
              All-Time Champion
            </p>
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <Avatar
                  src={topChampion.user.avatar_url}
                  fallback={topChampion.user.display_name ?? topChampion.user.username}
                  size="lg"
                  className="h-16 w-16"
                />
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center h-6 w-6 rounded-full bg-gold border-2 border-surface-100">
                  <Crown className="h-3.5 w-3.5 text-surface-50" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${topChampion.user.username}/podium`}
                  className="text-xl font-bold text-white hover:text-gold transition-colors"
                >
                  {topChampion.user.display_name ?? topChampion.user.username}
                </Link>
                <p className="text-xs font-mono text-surface-500">@{topChampion.user.username}</p>
                <div className="flex items-center gap-3 mt-2">
                  <MedalPips
                    gold={topChampion.gold}
                    silver={topChampion.silver}
                    bronze={topChampion.bronze}
                  />
                  <span className="text-[10px] font-mono text-surface-500">
                    {topChampion.total_podiums} podiums
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-3xl font-bold font-mono text-gold">
                  <AnimatedNumber value={topChampion.medal_score} />
                </p>
                <p className="text-[10px] font-mono text-surface-500">medal score</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* View toggle */}
        <div className="flex gap-2 mb-5" role="tablist" aria-label="View selection">
          {(['categories', 'overall'] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                'px-4 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
                view === v
                  ? 'bg-gold/15 border-gold/40 text-gold'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {v === 'categories' ? 'By Category' : 'Overall Ranking'}
            </button>
          ))}
        </div>

        {loading ? (
          <ChampionsSkeleton />
        ) : !data ? (
          <EmptyState
            icon={Trophy}
            title="No podium data yet"
            description="Champion history builds up each Monday when the weekly podium resets. Check back after the first week concludes."
            actions={[{ label: 'View current podium', href: '/podium' }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            {view === 'categories' ? (
              <motion.div
                key="categories"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {data.by_category.every((c) => !c.champion) ? (
                  <EmptyState
                    icon={Trophy}
                    title="No champions yet"
                    description="Category champions are crowned each Monday when the podium resets."
                    actions={[{ label: 'See current standings', href: '/podium' }]}
                  />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {data.by_category.map((entry) => (
                      <CategoryCard key={entry.category} entry={entry} />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="overall"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {data.overall.length === 0 ? (
                  <EmptyState
                    icon={Crown}
                    title="No champions yet"
                    description="The all-time ranking builds up after the first weekly podium cycle."
                    actions={[{ label: 'See current standings', href: '/podium' }]}
                  />
                ) : (
                  <>
                    {/* Medal legend */}
                    <div className="flex items-center gap-4 mb-4 text-[10px] font-mono text-surface-500">
                      <span className="flex items-center gap-1">
                        <Crown className="h-3 w-3 text-gold" /> Gold ×5 pts
                      </span>
                      <span className="flex items-center gap-1">
                        <Medal className="h-3 w-3 text-surface-600" /> Silver ×3 pts
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3 text-amber-500" /> Bronze ×1 pt
                      </span>
                    </div>

                    <div className="space-y-2">
                      {data.overall.map((entry, idx) => (
                        <RankRow key={entry.user.id} entry={entry} idx={idx} />
                      ))}
                    </div>

                    <p className="text-center text-xs font-mono text-surface-600 mt-6">
                      {data.total_snapshots.toLocaleString()} podium placements recorded
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Footer links */}
        {!loading && (
          <div className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap gap-3">
            <Link
              href="/podium"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-xs font-mono font-semibold text-gold hover:bg-gold/20 transition-colors"
            >
              <Trophy className="h-3.5 w-3.5" />
              Current week
            </Link>
            <Link
              href="/leaderboard/legends"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
              Hall of Legends
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
            >
              <BarChart2 className="h-3.5 w-3.5" />
              All-time leaderboard
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
