'use client'

/**
 * /predictions/leaderboard — Prediction Accuracy Leaderboard
 *
 * Ranks users by how accurately they predicted topic outcomes.
 * Scoring uses: accuracy %, Brier score, total volume, clout earned.
 * Minimum 3 resolved predictions to qualify for ranking.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Coins,
  Crown,
  Medal,
  RefreshCw,
  Target,
  Trophy,
  TrendingDown,
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
import type { PredictorRow, CategoryStat, LeaderboardResponse } from '@/app/api/predictions/leaderboard/route'

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { id: string; label: string; description: string }[] = [
  { id: 'accuracy',  label: 'Accuracy',    description: '% correct' },
  { id: 'brier',     label: 'Brier Score', description: 'lower = better' },
  { id: 'total',     label: 'Volume',      description: 'most predictions' },
  { id: 'clout',     label: 'Clout Won',   description: 'earnings from predictions' },
]

// ─── Role colours ─────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  elder:         'text-gold',
  lawmaker:      'text-gold',
  senator:       'text-purple',
  troll_catcher: 'text-emerald',
  debator:       'text-for-400',
  person:        'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder:         'Elder',
  lawmaker:      'Lawmaker',
  senator:       'Senator',
  troll_catcher: 'Troll Catcher',
  debator:       'Debator',
  person:        'Citizen',
}

// ─── Category colours ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
  Other:       'text-surface-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function accuracyGrade(pct: number): { grade: string; color: string } {
  if (pct >= 90) return { grade: 'S',  color: 'text-gold' }
  if (pct >= 80) return { grade: 'A+', color: 'text-emerald' }
  if (pct >= 70) return { grade: 'A',  color: 'text-emerald' }
  if (pct >= 65) return { grade: 'B+', color: 'text-for-300' }
  if (pct >= 60) return { grade: 'B',  color: 'text-for-400' }
  if (pct >= 55) return { grade: 'C+', color: 'text-gold' }
  if (pct >= 50) return { grade: 'C',  color: 'text-gold' }
  return { grade: 'D',  color: 'text-against-400' }
}

function brierLabel(b: number | null): string {
  if (b === null) return '—'
  return b.toFixed(3)
}

function brierQuality(b: number | null): string {
  if (b === null) return 'text-surface-500'
  if (b <= 0.10) return 'text-gold'
  if (b <= 0.15) return 'text-emerald'
  if (b <= 0.20) return 'text-for-400'
  if (b <= 0.25) return 'text-gold'
  return 'text-against-400'
}

function formatClout(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-gold" aria-label="1st" />
  if (rank === 2) return <Medal className="h-5 w-5 text-surface-400" aria-label="2nd" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" aria-label="3rd" />
  return (
    <span className="text-xs font-mono text-surface-600 w-5 text-center tabular-nums">
      {rank}
    </span>
  )
}

// ─── Podium top-3 ─────────────────────────────────────────────────────────────

function Podium({ rows }: { rows: PredictorRow[] }) {
  const top3 = rows.slice(0, 3)
  if (top3.length === 0) return null

  // Reorder: 2nd, 1st, 3rd
  const order = [top3[1], top3[0], top3[2]].filter(Boolean)
  const heights = [top3[1] ? '70%' : '0', '100%', top3[2] ? '55%' : '0']
  const hInOrder = [heights[1], heights[0], heights[2]]

  return (
    <div className="flex items-end justify-center gap-2 mt-6 mb-8 h-40">
      {order.map((row, i) => {
        if (!row) return null
        const isFirst = row.rank === 1
        const { grade, color } = accuracyGrade(row.accuracy)
        const h = hInOrder[i]
        return (
          <motion.div
            key={row.user_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex flex-col items-center gap-1"
            style={{ height: h }}
          >
            {/* Avatar + grade pill */}
            <div className="relative flex-shrink-0">
              <Avatar
                src={row.avatar_url}
                fallback={row.display_name || row.username}
                size={isFirst ? 'lg' : 'md'}
                className={cn(
                  'ring-2',
                  row.rank === 1 ? 'ring-gold' :
                  row.rank === 2 ? 'ring-surface-400' :
                  'ring-amber-700/60'
                )}
              />
              <span
                className={cn(
                  'absolute -bottom-1 -right-1 px-1 min-w-[20px] text-center text-[9px] font-mono font-bold rounded-full border',
                  row.rank === 1 ? 'bg-gold/20 border-gold/40 text-gold' :
                  row.rank === 2 ? 'bg-surface-300/60 border-surface-400/40 text-surface-300' :
                  'bg-amber-900/30 border-amber-700/40 text-amber-600',
                  color
                )}
              >
                {grade}
              </span>
            </div>

            <Link
              href={`/profile/${row.username}`}
              className="text-xs font-mono text-center text-white hover:text-for-300 transition-colors max-w-[80px] truncate leading-tight"
            >
              {row.display_name || row.username}
            </Link>

            <span className="text-[10px] font-mono text-surface-500 tabular-nums">
              {row.accuracy}%
            </span>

            {/* Platform block */}
            <div
              className={cn(
                'w-16 rounded-t-lg flex items-center justify-center mt-auto',
                row.rank === 1 ? 'bg-gold/20 border border-gold/30' :
                row.rank === 2 ? 'bg-surface-300/30 border border-surface-300/20' :
                'bg-amber-900/20 border border-amber-700/20'
              )}
              style={{ height: '40%' }}
            >
              <span
                className={cn(
                  'text-lg font-mono font-bold',
                  row.rank === 1 ? 'text-gold' :
                  row.rank === 2 ? 'text-surface-400' :
                  'text-amber-600'
                )}
              >
                {row.rank}
              </span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Table row ────────────────────────────────────────────────────────────────

function PredictorTableRow({ row, sort }: { row: PredictorRow; sort: string }) {
  const { grade, color } = accuracyGrade(row.accuracy)
  const roleLabel = ROLE_LABEL[row.role] ?? row.role
  const roleColor = ROLE_COLOR[row.role] ?? 'text-surface-500'
  const lawBiasLabel = row.law_bias >= 60 ? 'Optimist' : row.law_bias <= 40 ? 'Skeptic' : 'Balanced'
  const lawBiasColor = row.law_bias >= 60 ? 'text-emerald' : row.law_bias <= 40 ? 'text-against-400' : 'text-surface-500'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'group flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors',
        'bg-surface-100 border-surface-300 hover:border-surface-400',
        row.rank <= 3 && 'border-gold/20 bg-gold/5 hover:border-gold/30'
      )}
    >
      {/* Rank */}
      <div className="w-6 flex-shrink-0 flex items-center justify-center">
        <RankMedal rank={row.rank} />
      </div>

      {/* Avatar */}
      <Link href={`/profile/${row.username}`} className="flex-shrink-0">
        <Avatar
          src={row.avatar_url}
          fallback={row.display_name || row.username}
          size="sm"
          className="ring-1 ring-surface-400/30"
        />
      </Link>

      {/* Name + role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/profile/${row.username}`}
            className="text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
          >
            {row.display_name || row.username}
          </Link>
          <span className={cn('text-[10px] font-mono hidden sm:inline', roleColor)}>
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-surface-600">
            {row.total} predictions · {row.correct} correct
          </span>
          <span className={cn('text-[10px] font-mono hidden sm:inline', lawBiasColor)}>
            {lawBiasLabel}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Accuracy + grade */}
        <div className="text-center hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-mono font-bold text-white tabular-nums">
              {row.accuracy}%
            </span>
            <span className={cn('text-xs font-mono font-bold px-1 py-0.5 rounded', color)}>
              {grade}
            </span>
          </div>
          <p className="text-[10px] text-surface-600 font-mono">accuracy</p>
        </div>

        {/* Brier score — only shown when sorted by brier */}
        {sort === 'brier' && (
          <div className="text-center hidden md:block">
            <p className={cn('text-sm font-mono font-semibold tabular-nums', brierQuality(row.avg_brier))}>
              {brierLabel(row.avg_brier)}
            </p>
            <p className="text-[10px] text-surface-600 font-mono">brier</p>
          </div>
        )}

        {/* Clout earned */}
        <div className="text-center hidden md:block">
          <div className="flex items-center gap-0.5">
            <Coins className="h-3 w-3 text-gold" />
            <span className="text-sm font-mono font-semibold text-gold tabular-nums">
              {formatClout(row.clout_earned)}
            </span>
          </div>
          <p className="text-[10px] text-surface-600 font-mono">earned</p>
        </div>

        {/* Mobile: just accuracy */}
        <div className="sm:hidden text-right">
          <span className={cn('text-sm font-mono font-bold', color)}>
            {row.accuracy}%
          </span>
          <p className="text-[10px] text-surface-600 font-mono">{row.correct}/{row.total}</p>
        </div>

        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
      </div>
    </motion.div>
  )
}

// ─── Category stats bar ───────────────────────────────────────────────────────

function CategoryStatsPanel({ stats }: { stats: CategoryStat[] }) {
  if (stats.length === 0) return null

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
      <h3 className="text-sm font-mono font-semibold text-white mb-4 flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-purple" />
        Platform Accuracy by Category
      </h3>
      <div className="space-y-3">
        {stats.map((s) => {
          const pct = s.accuracy
          const isGood = pct >= 65
          const barColor = isGood ? 'bg-emerald' : pct >= 55 ? 'bg-for-500' : 'bg-against-500'
          const textColor = CAT_COLOR[s.category] ?? 'text-surface-500'

          return (
            <div key={s.category}>
              <div className="flex items-center justify-between mb-1">
                <span className={cn('text-xs font-mono', textColor)}>{s.category}</span>
                <span className="text-xs font-mono text-surface-500 tabular-nums">
                  {pct}% · {s.total} predictions
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', barColor)}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-surface-300 bg-surface-100">
          <Skeleton className="h-4 w-4 rounded flex-shrink-0" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-2.5 w-20 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded hidden sm:block" />
          <Skeleton className="h-6 w-12 rounded hidden md:block" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PredictionLeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState('accuracy')

  const load = useCallback(async (s: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/predictions/leaderboard?sort=${s}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json: LeaderboardResponse = await res.json()
      setData(json)
    } catch {
      setError('Could not load the leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(sort)
  }, [load, sort])

  const rows = data?.rows ?? []
  const totalResolved = data?.total_resolved ?? 0
  const platformAccuracy = data?.platform_accuracy ?? 0
  const catStats = data?.top_category_stats ?? []

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-10 space-y-6">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/predictions"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
              aria-label="Back to predictions"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-gold" aria-hidden />
              <h1 className="font-mono text-xl font-bold text-white">
                Prediction Leaderboard
              </h1>
            </div>
          </div>
          <p className="text-sm font-mono text-surface-500 pl-12">
            Ranked by who calls it best — minimum 3 resolved predictions to qualify.
          </p>
        </div>

        {/* ── Platform stats strip ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
            <div className="text-2xl font-mono font-bold text-white tabular-nums">
              {loading ? '—' : <AnimatedNumber value={totalResolved} />}
            </div>
            <p className="text-[11px] font-mono text-surface-500 mt-1">resolved predictions</p>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
            <div className="text-2xl font-mono font-bold text-for-300 tabular-nums">
              {loading ? '—' : `${platformAccuracy}%`}
            </div>
            <p className="text-[11px] font-mono text-surface-500 mt-1">platform accuracy</p>
          </div>
          <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
            <div className="text-2xl font-mono font-bold text-purple tabular-nums">
              {loading ? '—' : <AnimatedNumber value={rows.length} />}
            </div>
            <p className="text-[11px] font-mono text-surface-500 mt-1">qualified predictors</p>
          </div>
        </div>

        {/* ── Sort strip ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {SORT_OPTIONS.map(({ id, label, description }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSort(id)}
              className={cn(
                'flex-shrink-0 flex flex-col items-center px-3.5 py-2 rounded-xl border transition-all text-left',
                sort === id
                  ? 'bg-for-600/30 border-for-500/50 text-for-300'
                  : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-white'
              )}
            >
              <span className="text-xs font-mono font-semibold">{label}</span>
              <span className="text-[10px] font-mono opacity-70">{description}</span>
            </button>
          ))}

          <div className="ml-auto flex-shrink-0">
            <button
              type="button"
              onClick={() => load(sort)}
              disabled={loading}
              aria-label="Refresh leaderboard"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-surface-300 bg-surface-100 text-surface-500 hover:text-white hover:border-surface-400 transition-all disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* ── Podium ───────────────────────────────────────────────────── */}
        {!loading && rows.length >= 3 && <Podium rows={rows} />}

        {/* ── Main content ─────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              type="button"
              onClick={() => load(sort)}
              className="px-4 py-2 rounded-lg bg-surface-200 text-xs font-mono text-white hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No qualified predictors yet"
            description="Once users make 3 or more resolved predictions, they'll appear here. Make your first prediction to get on the board."
            actions={[
              { label: 'Make Predictions', href: '/predictions', icon: Target },
              { label: 'Browse Topics', href: '/', icon: Zap, variant: 'secondary' },
            ]}
            size="lg"
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-2">
              {rows.map((row) => (
                <PredictorTableRow key={row.user_id} row={row} sort={sort} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* ── Category accuracy panel ───────────────────────────────────── */}
        {!loading && catStats.length > 0 && (
          <CategoryStatsPanel stats={catStats} />
        )}

        {/* ── How scoring works ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <h3 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-surface-500" />
            How Scoring Works
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px] font-mono text-surface-500">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
                <span><span className="text-white">Accuracy</span> — % of predictions correct</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                <span><span className="text-white">Brier Score</span> — measures confidence calibration (lower = better; 0.0 is perfect)</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-purple flex-shrink-0" />
                <span><span className="text-white">Volume</span> — total resolved predictions made</span>
              </div>
              <div className="flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 text-gold flex-shrink-0" />
                <span><span className="text-white">Clout</span> — earned from correct high-confidence predictions</span>
              </div>
            </div>
          </div>
          <p className="text-[11px] font-mono text-surface-600 pt-1">
            Minimum 3 resolved predictions required to qualify. Grades: S ≥ 90%, A+ ≥ 80%, A ≥ 70%, B ≥ 65%, C ≥ 55%.
          </p>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <Link
            href="/predictions"
            className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-for-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Predictions
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-for-300 transition-colors"
          >
            Full Leaderboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
