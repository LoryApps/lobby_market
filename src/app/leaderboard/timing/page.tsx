'use client'

/**
 * /leaderboard/timing — First-Move Accuracy
 *
 * Ranks citizens by how accurately they voted within the first 48 hours of
 * a topic's life — before the crowd's consensus formed. An early-correct vote
 * requires genuine civic intuition, not bandwagon following.
 *
 * Three ranked views:
 *   By Accuracy   — highest % correct among early votes (min 3 early votes)
 *   By Volume     — most early votes cast on resolved topics
 *   Speedsters    — voted fastest AND accurately (avg hours since creation,
 *                   filtered to users with ≥ 50% early accuracy)
 *
 * Distinct from:
 *   /leaderboard/calibration — all-time voting accuracy (no timing weight)
 *   /leaderboard/founders    — platform join order, not per-topic timing
 *   /leaderboard/velocity    — recent growth rate, not predictive accuracy
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  Clock,
  Crown,
  Medal,
  RefreshCw,
  Target,
  Timer,
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
  TimingRankEntry,
  TimingLeaderboardResponse,
} from '@/app/api/leaderboard/timing/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`
  if (h < 24) return `${h.toFixed(1)}h`
  return `${(h / 24).toFixed(1)}d`
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-4 w-4 text-gold flex-shrink-0" />
  if (rank === 2) return <Medal className="h-4 w-4 text-surface-300 flex-shrink-0" />
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-600 flex-shrink-0" />
  return (
    <span className="text-xs font-mono text-surface-500 w-4 text-center flex-shrink-0">
      {rank}
    </span>
  )
}

// ─── Grade badge ──────────────────────────────────────────────────────────────

const GRADE_BG: Record<string, string> = {
  S: 'bg-gold/15 border-gold/30 text-gold',
  A: 'bg-emerald/15 border-emerald/30 text-emerald',
  B: 'bg-for-500/15 border-for-500/30 text-for-300',
  C: 'bg-purple/15 border-purple/30 text-purple',
  D: 'bg-against-500/15 border-against-500/30 text-against-300',
  F: 'bg-surface-200 border-surface-300 text-surface-500',
  '–': 'bg-surface-200 border-surface-300 text-surface-500',
}

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center h-6 w-6 rounded text-xs font-bold border font-mono',
        GRADE_BG[grade] ?? GRADE_BG['–'],
      )}
    >
      {grade}
    </span>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  mode,
}: {
  entry: TimingRankEntry
  mode: 'pct' | 'volume' | 'speed'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-200 transition-colors"
    >
      <RankMedal rank={entry.rank} />

      <Link
        href={`/profile/${entry.username}`}
        className="flex items-center gap-2.5 flex-1 min-w-0 group"
      >
        <Avatar
          src={entry.avatar_url}
          username={entry.username}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-white truncate group-hover:text-for-300 transition-colors">
            {entry.display_name ?? entry.username}
          </p>
          <p className="font-mono text-[10px] text-surface-500">@{entry.username}</p>
        </div>
      </Link>

      <GradeBadge grade={entry.grade} />

      <div className="text-right flex-shrink-0 min-w-[72px]">
        {mode === 'speed' ? (
          <>
            <p className="font-mono text-sm font-bold text-for-300">
              {fmtHours(entry.avg_topic_age_hours)}
            </p>
            <p className="font-mono text-[10px] text-surface-500">avg age</p>
          </>
        ) : mode === 'volume' ? (
          <>
            <p className="font-mono text-sm font-bold text-white">{fmtNum(entry.early_total)}</p>
            <p className="font-mono text-[10px] text-surface-500">early votes</p>
          </>
        ) : (
          <>
            <p className="font-mono text-sm font-bold text-for-300">{entry.early_pct}%</p>
            <p className="font-mono text-[10px] text-surface-500">
              {entry.early_correct}/{entry.early_total}
            </p>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EntrySkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300">
      <Skeleton className="h-4 w-4 rounded" />
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-2.5 w-20 rounded" />
      </div>
      <Skeleton className="h-6 w-6 rounded" />
      <Skeleton className="h-8 w-16 rounded" />
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className={cn('rounded-xl border p-4', color)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      </div>
      <p className="font-mono text-xl font-bold text-white">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      {sub && <p className="font-mono text-[10px] text-surface-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'pct' | 'volume' | 'speed'

const TABS: { id: Tab; label: string; icon: typeof Target }[] = [
  { id: 'pct', label: 'By Accuracy', icon: Target },
  { id: 'volume', label: 'By Volume', icon: Users },
  { id: 'speed', label: 'Speedsters', icon: Timer },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimingLeaderboardPage() {
  const [data, setData] = useState<TimingLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pct')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const res = await fetch('/api/leaderboard/timing')
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as TimingLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the leaderboard. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const entries =
    data == null
      ? []
      : tab === 'pct'
        ? data.topByPct
        : tab === 'volume'
          ? data.topByVolume
          : data.topSpeed

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-200 transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Clock className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-lg font-bold text-white leading-none">
                First-Move Accuracy
              </h1>
              <p className="font-mono text-xs text-surface-500 mt-0.5">
                Who voted correctly before the crowd formed?
              </p>
            </div>
          </div>
        </div>

        {/* Context banner */}
        <div className="rounded-xl border border-for-500/20 bg-for-500/5 px-4 py-3 mb-6">
          <p className="font-mono text-xs text-surface-400 leading-relaxed">
            Early votes are cast within <span className="text-for-300 font-semibold">48 hours</span> of a topic going live — before most citizens have weighed in.
            Accuracy is judged after each topic resolves to{' '}
            <span className="text-emerald font-semibold">law</span> or{' '}
            <span className="text-against-400 font-semibold">failed</span>.
            Minimum <span className="text-white font-semibold">3 early votes</span> to qualify.
          </p>
        </div>

        {/* Platform stats */}
        {data && (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard
              label="Early Voters"
              value={data.platformStats.total_early_voters}
              sub="qualified citizens"
              icon={Users}
              color="border-surface-300 bg-surface-100 text-surface-400"
            />
            <StatCard
              label="Platform Accuracy"
              value={`${data.platformStats.platform_early_pct}%`}
              sub={`${fmtNum(data.platformStats.total_early_votes)} early votes`}
              icon={TrendingUp}
              color="border-for-500/30 bg-for-500/5 text-for-400"
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-100 border border-surface-300 mb-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-mono text-xs font-semibold transition-all',
                tab === t.id
                  ? 'bg-for-600 text-white shadow-sm'
                  : 'text-surface-400 hover:text-white',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.id === 'pct' ? 'Accuracy' : t.id === 'volume' ? 'Volume' : 'Speed'}</span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <AnimatePresence mode="wait">
          <motion.p
            key={tab}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="font-mono text-[11px] text-surface-500 mb-4"
          >
            {tab === 'pct' &&
              'Ranked by % of early votes on the correct side. Rewards civic intuition.'}
            {tab === 'volume' &&
              'Ranked by total early votes cast. Rewards consistent first-move engagement.'}
            {tab === 'speed' &&
              'Ranked by average hours between topic creation and vote, filtered to ≥50% accuracy. Rewards both speed and precision.'}
          </motion.p>
        </AnimatePresence>

        {/* Refresh button */}
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-[10px] text-surface-600 uppercase tracking-widest">
            {tab === 'pct' ? 'Top Accuracy' : tab === 'volume' ? 'Top Volume' : 'Fastest & Accurate'}
          </p>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <EntrySkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={BarChart2}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load rankings"
            description={error}
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            iconColor="text-for-400"
            iconBg="bg-for-500/10"
            iconBorder="border-for-500/30"
            title="No early voters yet"
            description={
              tab === 'speed'
                ? 'No citizens have qualified for Speedster rankings yet. They need early votes with ≥50% accuracy.'
                : 'No citizens have cast at least 3 early votes on resolved topics yet. Be the first!'
            }
            actions={[{ label: 'Browse topics', href: '/topics' }]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              {entries.map((entry) => (
                <EntryRow key={entry.user_id} entry={entry} mode={tab} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* Footer links */}
        <div className="mt-8 pt-6 border-t border-surface-300 flex flex-col gap-2">
          <Link
            href="/leaderboard/calibration"
            className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 hover:border-surface-200 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-for-400 flex-shrink-0" />
              <div>
                <p className="font-mono text-sm font-semibold text-white">All-Time Calibration</p>
                <p className="font-mono text-[10px] text-surface-500">Overall voting accuracy, all time</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
          </Link>
          <Link
            href="/leaderboard/predictions"
            className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 hover:border-surface-200 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple flex-shrink-0" />
              <div>
                <p className="font-mono text-sm font-semibold text-white">Prediction Market</p>
                <p className="font-mono text-[10px] text-surface-500">Outcome prediction accuracy</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center justify-between rounded-xl border border-surface-300 bg-surface-100 px-4 py-3 hover:border-surface-200 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-surface-400 flex-shrink-0" />
              <div>
                <p className="font-mono text-sm font-semibold text-white">All Leaderboards</p>
                <p className="font-mono text-[10px] text-surface-500">Browse every ranking</p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-surface-300 transition-colors" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
