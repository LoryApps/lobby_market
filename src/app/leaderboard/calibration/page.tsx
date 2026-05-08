'use client'

/**
 * /leaderboard/calibration — The Oracle Rankings
 *
 * Ranks users by voting accuracy: how often they cast their ballot on the
 * side that ultimately won (law passed vs. failed/archived).
 *
 * Three views:
 *   By Accuracy   — highest % correct votes (min 5 resolved)
 *   By Volume     — most resolved votes cast
 *   Top Contrarians — most accurate against-the-grain voters
 *
 * Distinct from:
 *   /calibration     (personal dashboard, private)
 *   /leaderboard/predictions (prediction-market accuracy, different mechanic)
 *   /prescient       (personal stance analysis)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  Crown,
  FlaskConical,
  Medal,
  RefreshCw,
  Swords,
  Target,
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
  CalibrationRankEntry,
  CalibrationLeaderboardResponse,
} from '@/app/api/leaderboard/calibration/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
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
        'inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-mono font-bold border flex-shrink-0',
        GRADE_BG[grade] ?? GRADE_BG['F']
      )}
    >
      {grade}
    </span>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Target
  value: string | number
  label: string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-surface-300 bg-surface-100 px-3 py-3">
      <Icon className={cn('h-3.5 w-3.5', color)} />
      <p className="text-sm font-mono font-bold text-white leading-none">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </p>
      <p className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</p>
    </div>
  )
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
  entry,
  view,
  index,
}: {
  entry: CalibrationRankEntry
  view: 'accuracy' | 'volume' | 'contrarian'
  index: number
}) {
  const metric =
    view === 'contrarian'
      ? entry.contrarian_pct !== null
        ? `${entry.contrarian_pct.toFixed(1)}%`
        : '—'
      : view === 'volume'
        ? fmtNum(entry.total_resolved)
        : `${entry.accuracy_pct.toFixed(1)}%`

  const subMetric =
    view === 'contrarian'
      ? `${entry.contrarian_correct}/${entry.contrarian_total} contrarian votes`
      : view === 'volume'
        ? `${entry.accuracy_pct.toFixed(1)}% accuracy`
        : `${entry.correct_votes}/${entry.total_resolved} correct`

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025, duration: 0.2 }}
    >
      <Link
        href={`/profile/${entry.username}`}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all',
          'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
          entry.rank <= 3 && 'border-gold/20 bg-gold/5'
        )}
      >
        {/* Rank */}
        <div className="flex items-center justify-center w-5 flex-shrink-0">
          <RankMedal rank={entry.rank} />
        </div>

        {/* Avatar */}
        <Avatar
          src={entry.avatar_url}
          fallback={entry.display_name ?? entry.username}
          size="sm"
          className="flex-shrink-0"
        />

        {/* Name + sub */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {entry.display_name ?? entry.username}
          </p>
          <p className="text-[11px] text-surface-500 truncate">{subMetric}</p>
        </div>

        {/* Grade */}
        <GradeBadge grade={entry.grade} />

        {/* Metric */}
        <div className="text-right flex-shrink-0 min-w-[52px]">
          <p className="text-sm font-mono font-bold text-white">{metric}</p>
          {view !== 'volume' && (
            <p className="text-[10px] font-mono text-surface-500">
              {fmtNum(entry.total_resolved)} votes
            </p>
          )}
        </div>

        <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
      </Link>
    </motion.div>
  )
}

// ─── Row skeleton ─────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-surface-300 bg-surface-100">
      <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="h-2.5 w-36" />
      </div>
      <Skeleton className="h-7 w-7 rounded-lg flex-shrink-0" />
      <div className="text-right flex-shrink-0 min-w-[52px] space-y-1">
        <Skeleton className="h-3.5 w-10 ml-auto" />
        <Skeleton className="h-2.5 w-12 ml-auto" />
      </div>
      <Skeleton className="h-3.5 w-3.5 rounded flex-shrink-0" />
    </div>
  )
}

// ─── View tabs ────────────────────────────────────────────────────────────────

type View = 'accuracy' | 'volume' | 'contrarian'

const VIEWS: { id: View; label: string; icon: typeof Target; desc: string }[] = [
  {
    id: 'accuracy',
    label: 'By Accuracy',
    icon: Target,
    desc: 'Highest % of votes on the winning side',
  },
  {
    id: 'volume',
    label: 'By Volume',
    icon: BarChart2,
    desc: 'Most resolved votes cast',
  },
  {
    id: 'contrarian',
    label: 'Contrarians',
    icon: Swords,
    desc: 'Won most often by bucking the majority',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalibrationLeaderboardPage() {
  const [data, setData] = useState<CalibrationLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<View>('accuracy')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard/calibration', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const entries =
    view === 'accuracy'
      ? data?.topByAccuracy ?? []
      : view === 'volume'
        ? data?.topByVolume ?? []
        : data?.topContrarians ?? []

  const stats = data?.platformStats

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-400" />
          </Link>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gold/15 border border-gold/30 flex-shrink-0">
              <FlaskConical className="h-4 w-4 text-gold" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-mono font-bold text-white leading-tight">
                Calibration Board
              </h1>
              <p className="text-xs text-surface-500 font-mono truncate">
                Who votes on the winning side most often?
              </p>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh leaderboard"
            className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Platform stats strip ─────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-3">
                <Skeleton className="h-3.5 w-3.5 mx-auto mb-1.5 rounded" />
                <Skeleton className="h-4 w-10 mx-auto mb-1" />
                <Skeleton className="h-2.5 w-14 mx-auto" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                icon={Target}
                value={stats?.platform_accuracy_pct != null ? `${stats.platform_accuracy_pct.toFixed(1)}%` : '—'}
                label="Platform accuracy"
                color="text-for-400"
              />
              <StatCard
                icon={Users}
                value={stats?.total_unique_voters ?? 0}
                label="Calibrated voters"
                color="text-purple"
              />
              <StatCard
                icon={Zap}
                value={stats?.total_resolved_votes != null ? fmtNum(stats.total_resolved_votes) : '—'}
                label="Resolved votes"
                color="text-gold"
              />
              <StatCard
                icon={TrendingUp}
                value={stats?.avg_grade ?? '—'}
                label="Avg. grade"
                color="text-emerald"
              />
            </>
          )}
        </div>

        {/* ── Grade legend ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 px-4 py-3 mb-6">
          <p className="text-[11px] font-mono text-surface-500 mb-2 uppercase tracking-wide">
            Grade scale
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { g: 'S', label: '≥75%', color: 'text-gold' },
              { g: 'A', label: '≥65%', color: 'text-emerald' },
              { g: 'B', label: '≥55%', color: 'text-for-300' },
              { g: 'C', label: '≥45%', color: 'text-purple' },
              { g: 'D', label: '≥35%', color: 'text-against-300' },
              { g: 'F', label: '<35%', color: 'text-surface-500' },
            ].map(({ g, label, color }) => (
              <div key={g} className="flex items-center gap-1.5">
                <span className={cn('text-xs font-mono font-bold', color)}>{g}</span>
                <span className="text-[11px] font-mono text-surface-500">{label}</span>
              </div>
            ))}
            <span className="text-[11px] font-mono text-surface-600 ml-auto">
              Min. 5 resolved votes to qualify
            </span>
          </div>
        </div>

        {/* ── View tabs ────────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon
            const active = view === v.id
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-all',
                  active
                    ? 'bg-for-600/20 border-for-500/40 text-for-300'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-surface-300 hover:border-surface-400'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            )
          })}
        </div>

        {/* ── View description ─────────────────────────────────────────────── */}
        <p className="text-xs font-mono text-surface-500 mb-4">
          {VIEWS.find((v) => v.id === view)?.desc}
        </p>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title={
              view === 'contrarian'
                ? 'No contrarian heroes yet'
                : 'No calibration data yet'
            }
            description={
              view === 'contrarian'
                ? 'Contrarians need at least 5 against-the-grain votes on resolved topics.'
                : 'Voters need at least 5 resolved topics to appear here.'
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-2"
            >
              {entries.map((entry, i) => (
                <UserRow key={entry.user_id} entry={entry} view={view} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Personal calibration CTA ─────────────────────────────────────── */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="mt-8 rounded-2xl border border-gold/20 bg-gold/5 p-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex-shrink-0">
                <FlaskConical className="h-5 w-5 text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono font-bold text-white mb-1">
                  Check your calibration
                </p>
                <p className="text-xs font-mono text-surface-400 leading-relaxed">
                  See your personal accuracy grade, Brier score, contrarian index, and category-level
                  breakdown on your private calibration dashboard.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-2">
              <Link
                href="/calibration"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold/90 hover:bg-gold text-surface-900 text-sm font-mono font-bold transition-colors"
              >
                <Target className="h-4 w-4" />
                My calibration
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/prescient"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-surface-300 text-sm font-mono font-medium transition-colors"
              >
                <Zap className="h-4 w-4" />
                Stance analysis
              </Link>
            </div>
          </motion.div>
        )}

        {/* ── Back to leaderboard ───────────────────────────────────────────── */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All leaderboards
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
