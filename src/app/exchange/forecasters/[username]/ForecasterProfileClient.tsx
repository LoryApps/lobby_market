'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Flame,
  Globe,
  MessageSquare,
  RefreshCw,
  Scale,
  Star,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ForecasterProfileData,
  ForecasterForecast,
  CategoryStat,
} from '@/app/api/exchange/forecasters/[username]/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-US')
}

function accuracyColor(acc: number): string {
  if (acc >= 85) return 'text-emerald'
  if (acc >= 70) return 'text-for-400'
  if (acc >= 50) return 'text-gold'
  return 'text-against-400'
}

function accuracyBg(acc: number): string {
  if (acc >= 85) return 'bg-emerald/10 border-emerald/30'
  if (acc >= 70) return 'bg-for-500/10 border-for-500/30'
  if (acc >= 50) return 'bg-gold/10 border-gold/30'
  return 'bg-against-500/10 border-against-500/30'
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCatStyle(cat: string | null) {
  if (cat && CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat]
  return { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

const ROLE_LABELS: Record<string, string> = {
  elder: 'Elder',
  troll_catcher: 'Troll Catcher',
  debator: 'Debater',
  person: 'Citizen',
}

const DIRECTION_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-emerald', label: 'Bullish' },
  bearish: { icon: TrendingDown, color: 'text-against-400', label: 'Bearish' },
  neutral: { icon: Scale, color: 'text-surface-500', label: 'Neutral' },
}

const HORIZON_LABELS: Record<string, string> = {
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
  '90d': '90 days',
  '180d': '6 months',
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color = 'text-white',
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl bg-surface-200/60 border border-surface-300 p-4 flex flex-col gap-1">
      {Icon && <Icon className={cn('w-4 h-4 mb-1', color)} />}
      <span className={cn('text-2xl font-mono font-bold tabular-nums leading-tight', color)}>
        {value}
      </span>
      <span className="text-xs font-mono text-surface-500 leading-tight">{label}</span>
      {sub && <span className="text-[10px] text-surface-600 leading-tight">{sub}</span>}
    </div>
  )
}

// ─── Forecast card ────────────────────────────────────────────────────────────

function ForecastCard({ forecast }: { forecast: ForecasterForecast }) {
  const [expanded, setExpanded] = useState(false)
  const dirCfg = DIRECTION_CONFIG[forecast.direction]
  const DirIcon = dirCfg.icon
  const isResolved = forecast.resolved_price !== null
  const isLaw = forecast.status === 'law'
  const isFailed = forecast.status === 'failed'
  const catStyle = getCatStyle(forecast.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border bg-surface-100/80 transition-colors',
        isResolved
          ? forecast.accuracy !== null && forecast.accuracy >= 70
            ? 'border-emerald/20'
            : forecast.accuracy !== null && forecast.accuracy < 40
              ? 'border-against-500/20'
              : 'border-surface-300'
          : 'border-surface-300',
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {forecast.category && (
              <span
                className={cn(
                  'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                  catStyle.text, catStyle.bg, catStyle.border,
                )}
              >
                {forecast.category}
              </span>
            )}
            <span
              className={cn(
                'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
                isLaw ? 'text-gold bg-gold/10 border-gold/30' :
                isFailed ? 'text-against-400 bg-against-500/10 border-against-500/30' :
                forecast.status === 'voting' ? 'text-purple bg-purple/10 border-purple/30' :
                'text-for-400 bg-for-500/10 border-for-500/30',
              )}
            >
              {isLaw ? 'LAW' : isFailed ? 'FAILED' : forecast.status.toUpperCase()}
            </span>
          </div>

          {/* Accuracy badge (resolved only) */}
          {isResolved && forecast.accuracy !== null && (
            <div
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg border text-sm font-mono font-bold',
                accuracyBg(forecast.accuracy),
                accuracyColor(forecast.accuracy),
              )}
            >
              {forecast.accuracy >= 70 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {forecast.accuracy}%
            </div>
          )}
          {!isResolved && (
            <span className="text-[10px] font-mono text-for-400 bg-for-500/10 border border-for-500/30 px-2 py-0.5 rounded-full">
              Open
            </span>
          )}
        </div>

        <Link
          href={`/exchange/${forecast.topic_id}`}
          className="group flex items-start gap-1 mb-3"
        >
          <p className="text-sm font-medium text-surface-700 group-hover:text-white transition-colors leading-snug line-clamp-2">
            {forecast.statement}
          </p>
          <ExternalLink className="w-3 h-3 text-surface-600 group-hover:text-for-400 flex-shrink-0 mt-0.5 transition-colors" />
        </Link>

        {/* Forecast details row */}
        <div className="flex items-center gap-3 flex-wrap text-xs font-mono text-surface-500">
          <span className={cn('flex items-center gap-1', dirCfg.color)}>
            <DirIcon className="w-3.5 h-3.5" />
            {dirCfg.label}
          </span>
          <span className="flex items-center gap-1 text-surface-600">
            <Target className="w-3.5 h-3.5" />
            Target: <span className="text-white">{forecast.target_price}¢</span>
          </span>
          <span className="flex items-center gap-1 text-surface-600">
            Current: <span className="text-surface-400">{forecast.current_price}¢</span>
          </span>
          <span className="flex items-center gap-1 text-surface-600">
            <Star className="w-3.5 h-3.5" />
            Conf: <span className="text-surface-400">{forecast.confidence}/5</span>
          </span>
          <span className="flex items-center gap-1 text-surface-600">
            <Clock className="w-3.5 h-3.5" />
            {HORIZON_LABELS[forecast.horizon] ?? forecast.horizon}
          </span>
          <span className="text-surface-600">{relTime(forecast.created_at)}</span>
        </div>

        {/* Direction correct badge */}
        {isResolved && forecast.direction_correct !== null && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-mono">
            {forecast.direction_correct ? (
              <span className="flex items-center gap-1 text-emerald">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Direction correct
              </span>
            ) : (
              <span className="flex items-center gap-1 text-against-400">
                <XCircle className="w-3.5 h-3.5" />
                Direction wrong
              </span>
            )}
            {forecast.resolved_price !== null && (
              <span className="text-surface-600">
                · Settled at {forecast.resolved_price}¢
              </span>
            )}
          </div>
        )}
      </div>

      {/* Reasoning expand */}
      {forecast.reasoning && (
        <div className="border-t border-surface-300 px-4">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1.5 py-2.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors w-full text-left"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Reasoning
            {expanded ? (
              <ChevronUp className="w-3 h-3 ml-auto" />
            ) : (
              <ChevronDown className="w-3 h-3 ml-auto" />
            )}
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <p className="text-xs text-surface-400 leading-relaxed pb-3 font-mono">
                  &ldquo;{forecast.reasoning}&rdquo;
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({ stat, maxCount }: { stat: CategoryStat; maxCount: number }) {
  const catStyle = getCatStyle(stat.category)
  const pct = maxCount > 0 ? Math.round((stat.count / maxCount) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <div className="w-24 flex-shrink-0">
        <span className={cn('text-xs font-mono font-semibold', catStyle.text)}>{stat.category}</span>
      </div>
      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className={cn('h-full rounded-full', catStyle.bg.replace('/10', '/60'))}
        />
      </div>
      <div className="w-28 flex items-center gap-2 justify-end text-xs font-mono text-surface-500">
        <span>{stat.count} calls</span>
        {stat.avg_accuracy !== null && (
          <span className={cn('font-semibold', accuracyColor(stat.avg_accuracy))}>
            {stat.avg_accuracy}%
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Main client ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'open' | 'resolved' | 'correct' | 'wrong'

export function ForecasterProfileClient({ username }: { username: string }) {
  const [data, setData] = useState<ForecasterProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [catFilter, setCatFilter] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/exchange/forecasters/${encodeURIComponent(username)}`, {
        cache: 'no-store',
      })
      if (res.status === 404) {
        setError('Forecaster not found')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Failed to load forecaster profile')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => { load() }, [load])

  // Filtered forecasts
  const filtered = data?.forecasts.filter((f) => {
    if (catFilter && f.category !== catFilter) return false
    if (filter === 'open') return f.resolved_price === null
    if (filter === 'resolved') return f.resolved_price !== null
    if (filter === 'correct') return f.direction_correct === true
    if (filter === 'wrong') return f.direction_correct === false
    return true
  }) ?? []

  const { profile, stats, category_breakdown } = data ?? {}

  const filterTabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: data?.forecasts.length },
    { id: 'open', label: 'Open', count: stats?.pending_forecasts },
    { id: 'resolved', label: 'Resolved', count: stats?.resolved_forecasts },
    { id: 'correct', label: 'Correct', count: stats?.correct_direction },
    {
      id: 'wrong',
      label: 'Wrong',
      count:
        stats?.resolved_forecasts !== undefined && stats?.correct_direction !== undefined
          ? stats.resolved_forecasts - stats.correct_direction
          : undefined,
    },
  ]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Back */}
        <div className="mb-5">
          <Link
            href="/exchange/forecasters"
            className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Forecasters
          </Link>
        </div>

        {loading && <ProfileSkeleton />}

        {!loading && error && (
          <div className="text-center py-16">
            <p className="text-surface-500 font-mono mb-4">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 text-sm text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {!loading && data && profile && stats && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* ── Profile card ─────────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <div className="flex items-start gap-4 mb-5">
                <Avatar
                  src={profile.avatar_url}
                  username={profile.username}
                  size="lg"
                  className="flex-shrink-0 ring-2 ring-for-500/30"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-mono font-bold text-white truncate">
                      {profile.display_name ?? profile.username}
                    </h1>
                    <Badge variant="outline" className="text-xs">
                      {ROLE_LABELS[profile.role] ?? 'Citizen'}
                    </Badge>
                    {stats.global_rank && stats.global_rank <= 10 && (
                      <span className="flex items-center gap-1 text-xs font-mono text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">
                        <Trophy className="w-3 h-3" />
                        #{stats.global_rank} Forecaster
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-surface-500 mt-0.5">
                    @{profile.username}
                  </p>
                  {profile.bio && (
                    <p className="text-sm text-surface-400 mt-1.5 leading-relaxed">
                      {profile.bio}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs font-mono text-surface-500">
                    <span className="flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-gold" />
                      {fmtNum(profile.clout)} Clout
                    </span>
                    {stats.top_category && (
                      <span className={cn('flex items-center gap-1', getCatStyle(stats.top_category).text)}>
                        <Globe className="w-3.5 h-3.5" />
                        Specialises in {stats.top_category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link
                    href={`/profile/${profile.username}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs font-mono text-surface-400 hover:text-for-400 transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Profile
                  </Link>
                  {stats.global_rank && (
                    <Link
                      href="/exchange/forecasters"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-xs font-mono text-gold transition-colors"
                    >
                      <Trophy className="w-3.5 h-3.5" />
                      #{stats.global_rank}
                    </Link>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile
                  label="Forecasts"
                  value={stats.total_forecasts}
                  sub={`${stats.resolved_forecasts} resolved`}
                  icon={BarChart2}
                  color="text-for-400"
                />
                <StatTile
                  label="Direction Accuracy"
                  value={stats.direction_hit_rate !== null ? `${stats.direction_hit_rate}%` : '—'}
                  sub={stats.resolved_forecasts >= 1 ? `${stats.correct_direction}/${stats.resolved_forecasts} correct` : 'No resolved calls'}
                  icon={Target}
                  color={
                    stats.direction_hit_rate !== null
                      ? stats.direction_hit_rate >= 60
                        ? 'text-emerald'
                        : stats.direction_hit_rate >= 45
                          ? 'text-gold'
                          : 'text-against-400'
                      : 'text-surface-500'
                  }
                />
                <StatTile
                  label="Avg Accuracy"
                  value={stats.avg_accuracy !== null ? `${stats.avg_accuracy}%` : '—'}
                  sub="price proximity"
                  icon={Brain}
                  color={
                    stats.avg_accuracy !== null
                      ? accuracyColor(stats.avg_accuracy)
                      : 'text-surface-500'
                  }
                />
                <StatTile
                  label="Composite Score"
                  value={stats.avg_composite !== null ? stats.avg_composite.toFixed(1) : '—'}
                  sub="accuracy × confidence"
                  icon={Star}
                  color={
                    stats.avg_composite !== null
                      ? stats.avg_composite >= 70
                        ? 'text-emerald'
                        : stats.avg_composite >= 50
                          ? 'text-for-400'
                          : 'text-surface-500'
                      : 'text-surface-500'
                  }
                />
              </div>

              {/* Best / worst call */}
              {(stats.best_call_statement || stats.worst_call_statement) && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stats.best_call_statement && stats.best_accuracy !== null && (
                    <div className="rounded-xl bg-emerald/5 border border-emerald/20 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ThumbsUp className="w-3.5 h-3.5 text-emerald" />
                        <span className="text-xs font-mono text-emerald font-semibold">
                          Best call · {stats.best_accuracy}%
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 leading-snug line-clamp-2">
                        {stats.best_call_statement}
                      </p>
                    </div>
                  )}
                  {stats.worst_call_statement && stats.worst_accuracy !== null && stats.resolved_forecasts > 1 && (
                    <div className="rounded-xl bg-against-500/5 border border-against-500/20 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <ThumbsDown className="w-3.5 h-3.5 text-against-400" />
                        <span className="text-xs font-mono text-against-400 font-semibold">
                          Worst call · {stats.worst_accuracy}%
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 leading-snug line-clamp-2">
                        {stats.worst_call_statement}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Category breakdown ──────────────────────────────────────── */}
            {category_breakdown && category_breakdown.length > 0 && (
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-purple" />
                  <h2 className="text-sm font-mono font-semibold text-surface-300">
                    Category Breakdown
                  </h2>
                </div>
                <div className="space-y-3">
                  {category_breakdown.map((cat, i) => (
                    <div
                      key={cat.category}
                      onClick={() =>
                        setCatFilter((prev) => prev === cat.category ? null : cat.category)
                      }
                      className="cursor-pointer"
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          catFilter === cat.category
                            ? 'bg-surface-200'
                            : 'hover:bg-surface-200/50',
                        )}
                      >
                        <CategoryBar
                          stat={cat}
                          maxCount={category_breakdown[0]?.count ?? 1}
                        />
                      </motion.div>
                    </div>
                  ))}
                </div>
                {catFilter && (
                  <button
                    onClick={() => setCatFilter(null)}
                    className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            )}

            {/* ── Forecast list ───────────────────────────────────────────── */}
            <div>
              {/* Filter tabs */}
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={cn(
                      'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors border',
                      filter === tab.id
                        ? 'bg-for-500/20 text-for-300 border-for-500/40'
                        : 'bg-surface-200/50 text-surface-500 border-surface-300 hover:text-surface-300',
                    )}
                  >
                    {tab.label}
                    {tab.count !== undefined && tab.count > 0 && (
                      <span className="text-[10px] bg-surface-300 text-surface-500 px-1.5 rounded-full">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
                {catFilter && (
                  <span
                    className={cn(
                      'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border',
                      getCatStyle(catFilter).text,
                      getCatStyle(catFilter).bg,
                      getCatStyle(catFilter).border,
                    )}
                  >
                    {catFilter}
                    <button
                      onClick={() => setCatFilter(null)}
                      className="ml-1 opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="No forecasts"
                  description="No predictions match this filter."
                />
              ) : (
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((f, i) => (
                      <motion.div
                        key={f.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                      >
                        <ForecastCard forecast={f} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* ── Link to exchange ────────────────────────────────────────── */}
            <div className="flex items-center justify-between pt-2">
              <Link
                href="/exchange/forecasters"
                className="flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                All forecasters
              </Link>
              <Link
                href="/exchange"
                className="flex items-center gap-2 text-sm font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Browse markets
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
