'use client'

/**
 * /leaderboard/predictions — The Oracle Leaderboard
 *
 * Ranks users by their prediction accuracy on civic topics.
 * Three ranked views:
 *   By Accuracy  — lowest Brier score / highest % correct (min 3 predictions)
 *   By Volume    — most predictions made
 *   By Clout     — most Clout earned from correct predictions
 *
 * Also shows recent topic resolutions and platform-wide prediction stats.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  Coins,
  Crown,
  Eye,
  Gavel,
  Medal,
  RefreshCw,
  Sparkles,
  Target,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TopPredictor,
  RecentResolution,
  PredictionsLeaderboardResponse,
} from '@/app/api/leaderboard/predictions/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function fmtBrier(b: number | null): string {
  if (b === null) return '—'
  return b.toFixed(3)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const ROLE_COLOR: Record<string, string> = {
  elder: 'text-gold',
  debator: 'text-for-400',
  troll_catcher: 'text-emerald',
  person: 'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  elder: 'Elder',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  person: 'Citizen',
}

type RankView = 'accuracy' | 'volume' | 'clout'

const RANK_TABS: { id: RankView; label: string; icon: typeof Target; metricLabel: string; description: string }[] = [
  {
    id: 'accuracy',
    label: 'By Accuracy',
    icon: Target,
    metricLabel: 'Accuracy',
    description: 'Ranked by correct % (min 3 predictions)',
  },
  {
    id: 'volume',
    label: 'By Volume',
    icon: BarChart2,
    metricLabel: 'Predictions',
    description: 'Most predictions made',
  },
  {
    id: 'clout',
    label: 'By Clout',
    icon: Coins,
    metricLabel: 'Clout',
    description: 'Most Clout earned from predictions',
  },
]

// ─── Medal helper ─────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gold/20 border border-gold/40 flex-shrink-0">
        <Crown className="h-3.5 w-3.5 text-gold" />
      </div>
    )
  if (rank === 2)
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-surface-200 border border-surface-400 flex-shrink-0">
        <Medal className="h-3.5 w-3.5 text-surface-300" />
      </div>
    )
  if (rank === 3)
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-against-500/10 border border-against-500/30 flex-shrink-0">
        <Medal className="h-3.5 w-3.5 text-against-300" />
      </div>
    )
  return (
    <div className="flex items-center justify-center h-7 w-7 flex-shrink-0">
      <span className="font-mono text-xs text-surface-500">#{rank}</span>
    </div>
  )
}

// ─── Accuracy bar ─────────────────────────────────────────────────────────────

function AccuracyBar({ pct }: { pct: number }) {
  const color =
    pct >= 80
      ? 'bg-emerald'
      : pct >= 60
        ? 'bg-for-500'
        : pct >= 40
          ? 'bg-gold'
          : 'bg-against-500'
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden max-w-[80px]">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={cn(
          'text-xs font-mono font-bold tabular-nums flex-shrink-0',
          pct >= 80 ? 'text-emerald' : pct >= 60 ? 'text-for-400' : pct >= 40 ? 'text-gold' : 'text-against-400'
        )}
      >
        {pct}%
      </span>
    </div>
  )
}

// ─── Predictor row ────────────────────────────────────────────────────────────

function PredictorRow({
  predictor,
  view,
  isTop3,
}: {
  predictor: TopPredictor
  view: RankView
  isTop3: boolean
}) {
  const metric =
    view === 'accuracy'
      ? predictor.accuracy_pct
      : view === 'volume'
        ? predictor.total_predictions
        : predictor.clout_earned

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
        isTop3
          ? 'bg-surface-150 border-surface-350 hover:border-surface-400'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400'
      )}
    >
      <RankBadge rank={predictor.rank} />

      <Link href={`/profile/${predictor.username}`} className="flex-shrink-0">
        <Avatar
          src={predictor.avatar_url}
          username={predictor.username}
          size="sm"
          role={predictor.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${predictor.username}`}
          className="flex items-center gap-1.5 hover:text-white transition-colors"
        >
          <span className="font-mono text-sm font-semibold text-white truncate">
            {predictor.display_name ?? predictor.username}
          </span>
          {predictor.role !== 'person' && (
            <span className={cn('text-xs font-mono flex-shrink-0', ROLE_COLOR[predictor.role])}>
              {ROLE_LABEL[predictor.role]}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs font-mono text-surface-500">
            {predictor.correct_predictions}/{predictor.total_predictions} correct
          </span>
          {predictor.avg_brier !== null && (
            <span className="text-xs font-mono text-surface-600">
              Brier {fmtBrier(predictor.avg_brier)}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {view === 'accuracy' ? (
          <AccuracyBar pct={predictor.accuracy_pct} />
        ) : view === 'volume' ? (
          <span className="text-sm font-mono font-bold text-white tabular-nums">
            {fmtNum(metric)}
          </span>
        ) : (
          <span className="text-sm font-mono font-bold text-gold tabular-nums">
            +{fmtNum(metric)}
          </span>
        )}
        {view !== 'accuracy' && predictor.accuracy_pct > 0 && (
          <span
            className={cn(
              'text-xs font-mono',
              predictor.accuracy_pct >= 60 ? 'text-emerald' : 'text-surface-500'
            )}
          >
            {predictor.accuracy_pct}% acc
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300"
        >
          <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
          <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  )
}

// ─── Resolution card ──────────────────────────────────────────────────────────

function ResolutionCard({ r }: { r: RecentResolution }) {
  const isLaw = r.status === 'law'
  const communityNailed = r.accuracy_pct >= 60
  return (
    <Link href={`/topic/${r.topic_id}`} className="block">
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors"
      >
        {isLaw ? (
          <Gavel className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
        ) : (
          <XCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono text-white line-clamp-1">{r.statement}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={cn(
                'text-xs font-mono',
                r.category ? CATEGORY_COLOR[r.category] ?? 'text-surface-500' : 'text-surface-500'
              )}
            >
              {r.category ?? 'General'}
            </span>
            <span className="text-xs font-mono text-surface-600">·</span>
            <span className="text-xs font-mono text-surface-500">
              {r.total_predictors} predictor{r.total_predictors !== 1 ? 's' : ''}
            </span>
            {r.total_predictors > 0 && (
              <>
                <span className="text-xs font-mono text-surface-600">·</span>
                <span
                  className={cn(
                    'text-xs font-mono font-semibold',
                    communityNailed ? 'text-emerald' : 'text-against-400'
                  )}
                >
                  {r.accuracy_pct}% correct
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <Badge variant={isLaw ? 'law' : 'failed'} size="xs">
            {isLaw ? 'LAW' : 'FAILED'}
          </Badge>
          <span className="text-xs font-mono text-surface-600">{relativeTime(r.resolved_at)}</span>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PredictionsLeaderboardPage() {
  const [data, setData] = useState<PredictionsLeaderboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<RankView>('accuracy')
  const [showResolutions, setShowResolutions] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/leaderboard/predictions', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as PredictionsLeaderboardResponse
      setData(json)
    } catch {
      setError('Could not load the predictions leaderboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const currentList =
    data == null
      ? []
      : view === 'accuracy'
        ? data.topByAccuracy
        : view === 'volume'
          ? data.topByVolume
          : data.topByClout

  const activeTab = RANK_TABS.find((t) => t.id === view)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/leaderboard"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to leaderboard"
          >
            <ArrowLeft className="h-4 w-4 text-surface-300" />
          </Link>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <Target className="h-4.5 w-4.5 text-purple" aria-hidden />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white leading-tight">Oracle Leaderboard</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Ranked by prediction accuracy on civic outcomes
              </p>
            </div>
          </div>

          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 hover:bg-surface-300 transition-colors flex-shrink-0 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Platform stats strip ─────────────────────────────────────────── */}
        {data && (
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              {
                label: 'Predictors',
                value: fmtNum(data.platformStats.total_predictors),
                icon: Eye,
                color: 'text-purple',
              },
              {
                label: 'Predictions',
                value: fmtNum(data.platformStats.total_predictions),
                icon: Target,
                color: 'text-for-400',
              },
              {
                label: 'Platform Acc.',
                value: `${data.platformStats.platform_accuracy_pct}%`,
                icon: CheckCircle2,
                color:
                  data.platformStats.platform_accuracy_pct >= 60
                    ? 'text-emerald'
                    : 'text-gold',
              },
              {
                label: 'Avg Brier',
                value: fmtBrier(data.platformStats.avg_brier),
                icon: Sparkles,
                color: 'text-surface-400',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2.5 text-center"
              >
                <stat.icon className={cn('h-3.5 w-3.5 mx-auto mb-1', stat.color)} />
                <p className="font-mono text-sm font-bold text-white tabular-nums">{stat.value}</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface-100 border border-surface-300 mb-5">
          {RANK_TABS.map((tab) => {
            const Icon = tab.icon
            const active = view === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-semibold transition-colors',
                  active
                    ? 'bg-purple/20 text-purple border border-purple/40'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab description ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 mb-4">
          <Zap className="h-3.5 w-3.5 text-purple flex-shrink-0" />
          <p className="text-xs font-mono text-surface-400">{activeTab.description}</p>
          {data && currentList.length > 0 && (
            <span className="ml-auto text-xs font-mono text-surface-600 flex-shrink-0">
              {currentList.length} ranked
            </span>
          )}
        </div>

        {/* ── Main ranked list ─────────────────────────────────────────────── */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-xl border border-against-500/30 bg-against-500/5 p-6 text-center">
            <p className="text-sm font-mono text-against-400 mb-3">{error}</p>
            <button
              onClick={() => load()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : currentList.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No predictions yet"
            description={
              view === 'accuracy'
                ? 'Make at least 3 predictions to appear on the accuracy board.'
                : 'No predictions have been made and resolved yet.'
            }
            action={{ label: 'Make a prediction', href: '/predictions' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {currentList.map((p) => (
                <PredictorRow
                  key={p.user_id}
                  predictor={p}
                  view={view}
                  isTop3={p.rank <= 3}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Recent resolutions ───────────────────────────────────────────── */}
        {data && data.recentResolutions.length > 0 && !loading && !error && (
          <div className="mt-8">
            <button
              onClick={() => setShowResolutions((v) => !v)}
              className="flex items-center gap-2 w-full text-left mb-3 group"
            >
              <h2 className="font-mono text-sm font-bold text-surface-300 group-hover:text-white transition-colors">
                Recent Resolutions
              </h2>
              <span className="text-xs font-mono text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded">
                {data.recentResolutions.length}
              </span>
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 text-surface-500 ml-auto transition-transform',
                  showResolutions && 'rotate-90'
                )}
              />
            </button>

            <AnimatePresence>
              {showResolutions && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2">
                    {data.recentResolutions.map((r) => (
                      <ResolutionCard key={r.topic_id} r={r} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── CTA strip ───────────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="mt-8 grid grid-cols-2 gap-2">
            <Link
              href="/predictions"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-purple/10 border border-purple/30 hover:bg-purple/20 transition-colors"
            >
              <div>
                <p className="text-xs font-mono font-semibold text-purple">My Predictions</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5">Track your record</p>
              </div>
              <ArrowRight className="h-4 w-4 text-purple flex-shrink-0" />
            </Link>

            <Link
              href="/forecast"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-for-500/10 border border-for-500/30 hover:bg-for-500/20 transition-colors"
            >
              <div>
                <p className="text-xs font-mono font-semibold text-for-400">Open Forecasts</p>
                <p className="text-xs font-mono text-surface-500 mt-0.5">Make new predictions</p>
              </div>
              <ArrowRight className="h-4 w-4 text-for-400 flex-shrink-0" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
