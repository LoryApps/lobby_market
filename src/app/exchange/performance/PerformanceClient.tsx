'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  Award,
  BarChart2,
  Brain,
  ChevronRight,
  Flame,
  Info,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  PerformanceResponse,
  CalibrationBucket,
  CategoryPerformance,
  StanceGroup,
  RecentResult,
} from '@/app/api/exchange/performance/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brierGrade(bs: number | null): { label: string; color: string; desc: string } {
  if (bs === null) return { label: '—', color: 'text-surface-500', desc: 'Not enough data' }
  if (bs <= 0.05) return { label: 'S', color: 'text-gold', desc: 'Elite forecaster' }
  if (bs <= 0.10) return { label: 'A', color: 'text-emerald', desc: 'Expert calibration' }
  if (bs <= 0.15) return { label: 'B', color: 'text-for-400', desc: 'Above average' }
  if (bs <= 0.20) return { label: 'C', color: 'text-surface-400', desc: 'Average' }
  if (bs <= 0.25) return { label: 'D', color: 'text-against-300', desc: 'Below average' }
  return { label: 'F', color: 'text-against-400', desc: 'Coin-flip territory' }
}

function winRateColor(wr: number | null): string {
  if (wr === null) return 'text-surface-500'
  if (wr >= 75) return 'text-gold'
  if (wr >= 60) return 'text-emerald'
  if (wr >= 50) return 'text-for-400'
  if (wr >= 40) return 'text-against-300'
  return 'text-against-400'
}

function streakLabel(streak: number): { text: string; color: string; icon: typeof Flame } {
  if (streak >= 5) return { text: `${streak}W streak`, color: 'text-gold', icon: Flame }
  if (streak > 0) return { text: `${streak}W`, color: 'text-emerald', icon: TrendingUp }
  if (streak === 0) return { text: 'No streak', color: 'text-surface-500', icon: Activity }
  if (streak <= -5) return { text: `${Math.abs(streak)}L streak`, color: 'text-against-400', icon: TrendingDown }
  return { text: `${Math.abs(streak)}L`, color: 'text-against-300', icon: TrendingDown }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  const w = Math.floor(d / 7)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (w === 1) return '1w ago'
  return `${w}w ago`
}

// ─── Category color palette ───────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}
function catColor(c: string) {
  return CAT_COLOR[c] ?? 'text-surface-400'
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  icon?: typeof Zap
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-100 border border-surface-300 p-4">
      {Icon && (
        <Icon className={cn('h-4 w-4 mb-1', color ?? 'text-surface-500')} aria-hidden />
      )}
      <span className={cn('text-2xl font-mono font-bold', color ?? 'text-white')}>{value}</span>
      <span className="text-xs font-mono text-surface-500">{label}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</span>}
    </div>
  )
}

// ─── Calibration bar ─────────────────────────────────────────────────────────

function CalibrationBar({ bucket }: { bucket: CalibrationBucket }) {
  const wr = bucket.actual_win_rate
  const perfect = bucket.predicted_avg
  const gap = wr !== null ? Math.abs(wr - perfect) : null
  const gapColor =
    gap === null ? 'text-surface-600'
      : gap <= 5 ? 'text-emerald'
      : gap <= 15 ? 'text-for-400'
      : gap <= 25 ? 'text-gold'
      : 'text-against-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-surface-500 truncate mr-2">{bucket.label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {bucket.count > 0 ? (
            <>
              <span className={cn('font-semibold', winRateColor(wr))}>
                {wr !== null ? `${wr}%` : '—'}
              </span>
              <span className={cn('text-[10px]', gapColor)}>
                {gap !== null ? (gap <= 3 ? '✓' : `±${Math.round(gap)}`) : ''}
              </span>
            </>
          ) : (
            <span className="text-surface-600">no data</span>
          )}
        </div>
      </div>

      {/* Bar: expected (predicted_avg) vs actual */}
      <div className="relative h-2 rounded-full bg-surface-300 overflow-hidden">
        {/* Predicted (expected) — ghost */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-surface-400/40"
          style={{ width: `${perfect}%` }}
        />
        {/* Actual win rate */}
        {wr !== null && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${wr}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              wr >= 60 ? 'bg-for-500' : wr >= 45 ? 'bg-surface-500' : 'bg-against-500'
            )}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-surface-600">
        <span>Expected: {Math.round(perfect)}%</span>
        <span>{bucket.count} prediction{bucket.count !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ cat }: { cat: CategoryPerformance }) {
  const wr = cat.win_rate
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-surface-300 last:border-0">
      <div className="flex-shrink-0 w-28">
        <span className={cn('text-sm font-mono font-medium', catColor(cat.category))}>
          {cat.category}
        </span>
      </div>

      {/* Win-rate bar */}
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        {wr !== null && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${wr}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              wr >= 60 ? 'bg-emerald' : wr >= 50 ? 'bg-for-500' : wr >= 40 ? 'bg-against-400' : 'bg-against-600'
            )}
          />
        )}
      </div>

      <div className="flex-shrink-0 flex items-center gap-3 text-xs font-mono">
        <span className={cn('font-semibold w-8 text-right', winRateColor(wr))}>
          {wr !== null ? `${wr}%` : '—'}
        </span>
        <span className="text-surface-600 w-16 text-right">
          {cat.wins}W / {cat.losses}L
        </span>
      </div>
    </div>
  )
}

// ─── Stance card ─────────────────────────────────────────────────────────────

function StanceCard({
  title,
  desc,
  group,
  icon: Icon,
  color,
}: {
  title: string
  desc: string
  group: StanceGroup
  icon: typeof Target
  color: string
}) {
  const wr = group.win_rate
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color)} aria-hidden />
        <span className="text-sm font-mono font-semibold text-white">{title}</span>
      </div>
      <p className="text-xs text-surface-500 mb-3 leading-relaxed">{desc}</p>
      <div className="flex items-end justify-between">
        <div>
          <span className={cn('text-xl font-mono font-bold', winRateColor(wr))}>
            {wr !== null ? `${wr}%` : '—'}
          </span>
          <span className="text-xs text-surface-600 ml-1">win rate</span>
        </div>
        <span className="text-xs font-mono text-surface-600">
          {group.total} decision{group.total !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Recent form strip ────────────────────────────────────────────────────────

function RecentFormStrip({ form }: { form: RecentResult[] }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {form.slice(0, 20).map((r, i) => (
        <Link
          key={`${r.topic_id}-${i}`}
          href={`/exchange/${r.topic_id}`}
          title={r.statement}
          className={cn(
            'h-5 w-5 rounded flex items-center justify-center text-[9px] font-mono font-bold',
            'transition-transform hover:scale-110 flex-shrink-0',
            r.outcome === 'win' ? 'bg-emerald/20 text-emerald border border-emerald/30'
              : r.outcome === 'loss' ? 'bg-against-600/20 text-against-400 border border-against-500/30'
              : 'bg-surface-300 text-surface-500 border border-surface-400/30'
          )}
          aria-label={`${r.outcome === 'win' ? 'Win' : r.outcome === 'loss' ? 'Loss' : 'Push'}: ${r.statement.slice(0, 60)}`}
        >
          {r.outcome === 'win' ? 'W' : r.outcome === 'loss' ? 'L' : 'P'}
        </Link>
      ))}
    </div>
  )
}

// ─── Recent results list ──────────────────────────────────────────────────────

function RecentList({ form }: { form: RecentResult[] }) {
  return (
    <div className="space-y-2">
      {form.slice(0, 10).map((r, i) => (
        <Link
          key={`${r.topic_id}-list-${i}`}
          href={`/exchange/${r.topic_id}`}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl group transition-colors',
            'bg-surface-100 border',
            r.outcome === 'win'
              ? 'border-emerald/20 hover:border-emerald/40'
              : r.outcome === 'loss'
              ? 'border-against-500/20 hover:border-against-500/40'
              : 'border-surface-300 hover:border-surface-400'
          )}
        >
          {/* Outcome badge */}
          <div
            className={cn(
              'flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
              r.outcome === 'win' ? 'bg-emerald/10'
                : r.outcome === 'loss' ? 'bg-against-500/10'
                : 'bg-surface-300'
            )}
          >
            {r.outcome === 'win' ? (
              <TrendingUp className="h-4 w-4 text-emerald" aria-hidden />
            ) : r.outcome === 'loss' ? (
              <TrendingDown className="h-4 w-4 text-against-400" aria-hidden />
            ) : (
              <Scale className="h-4 w-4 text-surface-500" aria-hidden />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-white line-clamp-1 group-hover:text-for-400 transition-colors">
              {r.statement}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              {r.category && (
                <span className={cn('text-xs', catColor(r.category))}>{r.category}</span>
              )}
              <span className="text-[10px] font-mono text-surface-600">{relTime(r.settled_at)}</span>
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-full border',
                r.side === 'blue'
                  ? 'bg-for-500/10 border-for-500/30 text-for-400'
                  : 'bg-against-500/10 border-against-500/30 text-against-400'
              )}
            >
              {r.side === 'blue' ? (
                <ThumbsUp className="h-2.5 w-2.5" aria-hidden />
              ) : (
                <ThumbsDown className="h-2.5 w-2.5" aria-hidden />
              )}
              {r.side === 'blue' ? 'FOR' : 'AGAINST'}
            </span>
            <span className="text-[10px] font-mono text-surface-600">@{r.entry_price}%</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function PerformanceClient() {
  const router = useRouter()
  const [data, setData] = useState<PerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/exchange/performance')
      if (res.status === 401) {
        router.push('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as PerformanceResponse)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const grade = data ? brierGrade(data.brier_score) : null
  const streak = data ? streakLabel(data.current_streak) : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-mono text-white">Prediction Performance</h1>
            <p className="text-xs text-surface-500 mt-0.5">
              How well-calibrated are your civic market predictions?
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        )}

        {error && (
          <EmptyState
            icon={Activity}
            title="Failed to load performance"
            description="Could not fetch your prediction history. Please try again."
            action={{ label: 'Retry', onClick: load }}
          />
        )}

        {!loading && !error && data && data.settled_predictions === 0 && (
          <EmptyState
            icon={Brain}
            title="No settled predictions yet"
            description="Your performance analytics will appear once some of the topics you voted on have resolved as laws or failed."
            action={{ label: 'Go to Exchange', href: '/exchange' }}
          />
        )}

        {!loading && !error && data && data.settled_predictions > 0 && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* ── Top stats ─────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <StatTile
                  label="Brier Score"
                  value={data.brier_score !== null ? data.brier_score.toFixed(3) : '—'}
                  sub={grade?.desc}
                  color={grade?.color}
                  icon={Brain}
                />
                <StatTile
                  label="Win Rate"
                  value={data.win_rate !== null ? `${data.win_rate}%` : '—'}
                  sub={`${data.settled_predictions} settled`}
                  color={winRateColor(data.win_rate)}
                  icon={Trophy}
                />
                <StatTile
                  label="Current Streak"
                  value={streak?.text ?? '—'}
                  color={streak?.color}
                  icon={streak?.icon ?? Activity}
                />
                <StatTile
                  label="Open Positions"
                  value={data.open_predictions.toString()}
                  sub="awaiting resolution"
                  icon={Scale}
                />
              </div>

              {/* ── Brier Score explanation ───────────────────────────── */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-xs font-mono text-surface-500 leading-relaxed">
                      <span className="text-white font-medium">Brier Score</span> measures
                      calibration — how well your stated confidence matches your actual win rate.
                      Lower is better. 0.00 = perfect. 0.25 = coin flip.
                      Your grade: <span className={cn('font-bold', grade?.color)}>{grade?.label}</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Calibration chart ─────────────────────────────────── */}
              <section
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                aria-label="Calibration by confidence level"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-4 w-4 text-for-400" aria-hidden />
                  <h2 className="text-sm font-mono font-semibold text-white">
                    Calibration Curve
                  </h2>
                </div>
                <p className="text-xs text-surface-500 mb-4 leading-relaxed">
                  For each confidence level, your actual win rate should match your stated confidence. Grey bars = expected, coloured = actual.
                </p>
                <div className="space-y-4">
                  {data.calibration_buckets.map((bucket) => (
                    <CalibrationBar key={bucket.label} bucket={bucket} />
                  ))}
                </div>
              </section>

              {/* ── By category ───────────────────────────────────────── */}
              {data.by_category.length > 0 && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="h-4 w-4 text-purple" aria-hidden />
                    <h2 className="text-sm font-mono font-semibold text-white">
                      Win Rate by Category
                    </h2>
                  </div>
                  <div>
                    {data.by_category.map((cat) => (
                      <CategoryRow key={cat.category} cat={cat} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Stance analysis ───────────────────────────────────── */}
              <section aria-label="Prediction style analysis">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                  Prediction Style
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <StanceCard
                    title="Contrarian"
                    desc="Voted against the majority view (&lt;45% crowd confidence)"
                    group={data.contrarian}
                    icon={Sparkles}
                    color="text-gold"
                  />
                  <StanceCard
                    title="Consensus"
                    desc="Voted with the majority view (&gt;60% crowd confidence)"
                    group={data.consensus}
                    icon={TrendingUp}
                    color="text-for-400"
                  />
                  <StanceCard
                    title="Neutral"
                    desc="Voted in contested markets (45–60% range)"
                    group={data.neutral}
                    icon={Scale}
                    color="text-purple"
                  />
                </div>
              </section>

              {/* ── Vs. naive benchmarks ─────────────────────────────── */}
              <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="h-4 w-4 text-gold" aria-hidden />
                  <h2 className="text-sm font-mono font-semibold text-white">
                    vs. Naive Strategies
                  </h2>
                </div>
                <p className="text-xs text-surface-500 mb-4 leading-relaxed">
                  How your actual win rate compares to always-FOR or always-AGAINST strategies.
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-surface-200 p-3 border border-surface-300">
                    <div className={cn('text-xl font-mono font-bold', winRateColor(data.win_rate))}>
                      {data.win_rate !== null ? `${data.win_rate}%` : '—'}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 mt-0.5">You</div>
                  </div>
                  <div className="rounded-xl bg-surface-200 p-3 border border-surface-300">
                    <div className={cn('text-xl font-mono font-bold', winRateColor(data.naive_always_for_win_rate))}>
                      {data.naive_always_for_win_rate !== null ? `${data.naive_always_for_win_rate}%` : '—'}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 mt-0.5 flex items-center justify-center gap-1">
                      <ThumbsUp className="h-2.5 w-2.5 text-for-400" aria-hidden />
                      Always FOR
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface-200 p-3 border border-surface-300">
                    <div className={cn('text-xl font-mono font-bold', winRateColor(data.naive_always_against_win_rate))}>
                      {data.naive_always_against_win_rate !== null ? `${data.naive_always_against_win_rate}%` : '—'}
                    </div>
                    <div className="text-[10px] font-mono text-surface-500 mt-0.5 flex items-center justify-center gap-1">
                      <ThumbsDown className="h-2.5 w-2.5 text-against-400" aria-hidden />
                      Always AGAINST
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Streak records ────────────────────────────────────── */}
              {(data.best_win_streak > 0 || data.worst_loss_streak < 0) && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="h-4 w-4 text-gold" aria-hidden />
                    <h2 className="text-sm font-mono font-semibold text-white">
                      Streak Records
                    </h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-surface-200 border border-surface-300 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Flame className="h-4 w-4 text-gold" aria-hidden />
                        <span className="text-xs font-mono text-surface-500">Best win streak</span>
                      </div>
                      <span className="text-2xl font-mono font-bold text-gold">
                        {data.best_win_streak}W
                      </span>
                    </div>
                    <div className="rounded-xl bg-surface-200 border border-surface-300 p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="h-4 w-4 text-against-400" aria-hidden />
                        <span className="text-xs font-mono text-surface-500">Worst loss streak</span>
                      </div>
                      <span className="text-2xl font-mono font-bold text-against-400">
                        {Math.abs(data.worst_loss_streak)}L
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Recent form ───────────────────────────────────────── */}
              {data.recent_form.length > 0 && (
                <section className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-for-400" aria-hidden />
                    <h2 className="text-sm font-mono font-semibold text-white">
                      Recent Form
                    </h2>
                  </div>
                  <RecentFormStrip form={data.recent_form} />
                  <p className="text-[10px] font-mono text-surface-600 mt-2">
                    <span className="text-emerald">W</span> = win ·&nbsp;
                    <span className="text-against-400">L</span> = loss ·&nbsp;
                    <span className="text-surface-500">P</span> = push · hover for details
                  </p>

                  <div className="mt-4 border-t border-surface-300 pt-4">
                    <RecentList form={data.recent_form} />
                  </div>
                </section>
              )}

              {/* ── Footer nav ────────────────────────────────────────── */}
              <div className="flex items-center justify-between pt-2">
                <Link
                  href="/exchange/portfolio"
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <ChevronRight className="h-3 w-3 rotate-180" aria-hidden />
                  Portfolio
                </Link>
                <Link
                  href="/exchange/leaderboard"
                  className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  Leaderboard
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
