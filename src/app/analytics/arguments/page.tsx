'use client'

/**
 * /analytics/arguments — Argument Portfolio
 *
 * Personal argument performance dashboard: grade distribution, arena record,
 * category breakdown, monthly activity sparkline, and top arguments by
 * different metrics (best composite, most upvoted, most replied-to).
 *
 * Complements /analytics (voting stats), /analytics/evolution (opinion drift),
 * and /analytics/sentiment (emotional tone), but focuses exclusively on
 * what the user has argued, how those arguments performed, and how they
 * stack up in head-to-head Arena matchups.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Brain,
  ChevronRight,
  Crown,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentPortfolioResponse,
  ArgumentStat,
  CategoryBreakdown,
  GradeDistribution,
} from '@/app/api/analytics/arguments/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  A: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  B: { text: 'text-for-400',    bg: 'bg-for-500/10',     border: 'border-for-500/30'     },
  C: { text: 'text-gold',       bg: 'bg-gold/10',         border: 'border-gold/30'         },
  D: { text: 'text-against-400',bg: 'bg-against-500/10', border: 'border-against-500/30' },
  F: { text: 'text-surface-500',bg: 'bg-surface-300/10', border: 'border-surface-300/30' },
}

const CAT_COLORS: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-for-300',
  Science:     'text-emerald',
  Ethics:      'text-purple',
  Philosophy:  'text-purple',
  Culture:     'text-against-400',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

function catColor(cat: string): string {
  return CAT_COLORS[cat] ?? 'text-surface-500'
}

// ─── Grade Bar ────────────────────────────────────────────────────────────────────

function GradeBar({ dist }: { dist: GradeDistribution[] }) {
  const total = dist.reduce((s, d) => s + d.count, 0)
  if (total === 0) return null

  return (
    <div className="space-y-2">
      {dist.map((d) => {
        const colors = GRADE_COLORS[d.grade] ?? GRADE_COLORS.F
        return (
          <div key={d.grade} className="flex items-center gap-3">
            <span className={cn('w-5 text-xs font-bold font-mono text-right', colors.text)}>
              {d.grade}
            </span>
            <div className="flex-1 h-3 rounded-full bg-surface-300/30 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', colors.bg.replace('/10', '/60'))}
                initial={{ width: 0 }}
                animate={{ width: `${d.pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
            <span className="w-10 text-[11px] font-mono text-surface-500 text-right">
              {d.count > 0 ? `${d.pct}%` : '—'}
            </span>
            <span className="w-5 text-[11px] font-mono text-surface-600 text-right">
              {d.count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Monthly Sparkline ────────────────────────────────────────────────────────────────

const SPARK_W = 240
const SPARK_H = 48
const PAD = 4

function MonthlySparkline({ data }: { data: { month: string; count: number }[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.count), 1)
  const step = (SPARK_W - PAD * 2) / (data.length - 1)
  const pts = data.map((d, i) => ({
    x: PAD + i * step,
    y: SPARK_H - PAD - ((d.count / max) * (SPARK_H - PAD * 2)),
    count: d.count,
    month: d.month,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${pathD} L${pts[pts.length - 1].x},${SPARK_H} L${pts[0].x},${SPARK_H} Z`

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="w-full h-12"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="argSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#argSpark)" />
      <path
        d={pathD}
        fill="none"
        stroke="rgb(99,102,241)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {pts.map((p) => (
        p.count > 0 && (
          <circle key={p.month} cx={p.x} cy={p.y} r="2.5" fill="rgb(99,102,241)" />
        )
      ))}
    </svg>
  )
}

// ─── Argument Card ───────────────────────────────────────────────────────────────────

function ArgCard({ arg, label }: { arg: ArgumentStat; label: string }) {
  const isFor = arg.side === 'blue'
  const gradeColors = arg.ai_grade ? GRADE_COLORS[arg.ai_grade] : null

  return (
    <Link
      href={`/arguments/${arg.id}`}
      className="group flex flex-col gap-2.5 p-4 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200 transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1.5">
          {gradeColors && arg.ai_grade && (
            <span
              className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded border',
                gradeColors.text,
                gradeColors.bg,
                gradeColors.border
              )}
            >
              {arg.ai_grade}
            </span>
          )}
          <span
            className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border',
              isFor
                ? 'text-for-400 bg-for-500/10 border-for-500/30'
                : 'text-against-400 bg-against-500/10 border-against-500/30'
            )}
          >
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>
      </div>

      <p className="text-sm text-surface-700 leading-relaxed line-clamp-2 group-hover:text-surface-900 transition-colors">
        {arg.content}
      </p>

      {arg.topic && (
        <p className="text-[11px] text-surface-500 line-clamp-1">
          re: {arg.topic.statement}
        </p>
      )}

      <div className="flex items-center gap-3 text-[11px] text-surface-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="w-3 h-3" />
          {arg.upvotes}
        </span>
        {arg.reply_count > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {arg.reply_count}
          </span>
        )}
        {arg.arena_wins > 0 && (
          <span className="flex items-center gap-1 text-gold">
            <Trophy className="w-3 h-3" />
            {arg.arena_wins}W ({arg.arena_win_pct}%)
          </span>
        )}
        <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
      </div>
    </Link>
  )
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────────

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  color = 'text-surface-700',
}: {
  icon: typeof Zap
  label: string
  value: ReactNode
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs text-surface-500')}>
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <div className={cn('text-2xl font-bold font-mono', color)}>{value}</div>
      {sub && <div className="text-[11px] text-surface-500">{sub}</div>}
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function ArgumentPortfolioPage() {
  const router = useRouter()
  const [data, setData] = useState<ArgumentPortfolioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Verify auth
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const res = await fetch('/api/analytics/arguments', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json() as ArgumentPortfolioResponse)
    } catch {
      setError('Failed to load argument portfolio. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-purple" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900">Argument Portfolio</h1>
              <p className="text-xs text-surface-500">How your arguments perform across the Lobby</p>
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadingSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-16 text-center"
            >
              <Shield className="w-12 h-12 text-surface-400 mb-4" />
              <p className="text-surface-500 text-sm">{error}</p>
              <button onClick={load} className="mt-4 text-xs text-gold hover:underline">
                Try again
              </button>
            </motion.div>
          ) : !data || data.total === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <EmptyState
                icon={BookOpen}
                title="No arguments yet"
                description="Start arguing on topics you care about. Your argument stats will appear here."
                actions={[{ label: 'Browse Topics', href: '/', variant: 'primary' }]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              {/* Overview tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Tile
                  icon={BookOpen}
                  label="Arguments"
                  value={data.total}
                  sub={`${data.for_count} FOR · ${data.against_count} AGAINST`}
                  color="text-purple"
                />
                <Tile
                  icon={ThumbsUp}
                  label="Total Upvotes"
                  value={<AnimatedNumber value={data.total_upvotes} />}
                  sub={data.avg_upvotes !== null ? `${data.avg_upvotes} avg` : undefined}
                  color="text-for-400"
                />
                {data.avg_ai_score !== null ? (
                  <Tile
                    icon={Brain}
                    label="Avg AI Score"
                    value={data.avg_ai_score.toFixed(1)}
                    sub="out of 10"
                    color="text-gold"
                  />
                ) : (
                  <Tile
                    icon={Brain}
                    label="AI Score"
                    value="—"
                    sub="Not yet graded"
                    color="text-surface-500"
                  />
                )}
                <Tile
                  icon={Swords}
                  label="Arena Wins"
                  value={data.arena.total_wins}
                  sub={
                    data.arena.total_bouts > 0
                      ? `${data.arena.win_rate}% win rate`
                      : 'No bouts yet'
                  }
                  color="text-gold"
                />
              </div>

              {/* Grade distribution */}
              {data.grade_distribution.some((d) => d.count > 0) && (
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="w-4 h-4 text-gold" />
                    <h2 className="text-sm font-semibold text-surface-700">Grade Distribution</h2>
                    <span className="text-xs text-surface-500 ml-auto">
                      {data.grade_distribution.reduce((s, d) => s + d.count, 0)} graded
                    </span>
                  </div>
                  <GradeBar dist={data.grade_distribution} />
                </div>
              )}

              {/* Arena record */}
              {data.arena.total_bouts > 0 && (
                <div className="bg-gold/5 border border-gold/20 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Swords className="w-4 h-4 text-gold" />
                      <h2 className="text-sm font-semibold text-surface-700">Arena Record</h2>
                    </div>
                    <Link
                      href="/arguments/faceoff"
                      className="flex items-center gap-1 text-xs text-gold hover:text-gold/80 transition-colors"
                    >
                      Play <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold font-mono text-gold">
                        {data.arena.total_wins}
                      </div>
                      <div className="text-[11px] text-surface-500 mt-0.5">Wins</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono text-surface-600">
                        {data.arena.total_bouts - data.arena.total_wins}
                      </div>
                      <div className="text-[11px] text-surface-500 mt-0.5">Losses</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold font-mono text-emerald-400">
                        {data.arena.win_rate !== null ? `${data.arena.win_rate}%` : '—'}
                      </div>
                      <div className="text-[11px] text-surface-500 mt-0.5">Win Rate</div>
                    </div>
                  </div>
                  <p className="text-xs text-surface-500 mt-3 text-center">
                    {data.arena.arguments_with_bouts} of your arguments have appeared in Arena matchups
                  </p>
                </div>
              )}

              {/* Top arguments */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-gold" />
                  <h2 className="text-sm font-semibold text-surface-700">Your Top Arguments</h2>
                </div>
                <div className="flex flex-col gap-3">
                  {data.best_argument && data.best_argument.id !== data.most_upvoted?.id && (
                    <ArgCard arg={data.best_argument} label="Best Overall" />
                  )}
                  {data.most_upvoted && (
                    <ArgCard arg={data.most_upvoted} label="Most Upvoted" />
                  )}
                  {data.most_active &&
                    data.most_active.id !== data.most_upvoted?.id &&
                    data.most_active.reply_count > 0 && (
                      <ArgCard arg={data.most_active} label="Most Discussed" />
                    )}
                </div>
              </div>

              {/* Monthly activity */}
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-purple" />
                  <h2 className="text-sm font-semibold text-surface-700">Monthly Activity</h2>
                  <span className="text-xs text-surface-500 ml-auto">last 12 months</span>
                </div>
                <MonthlySparkline data={data.monthly_activity} />
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-surface-600 font-mono">
                    {data.monthly_activity[0]?.month?.slice(0, 7)}
                  </span>
                  <span className="text-[10px] text-surface-600 font-mono">
                    {data.monthly_activity[data.monthly_activity.length - 1]?.month?.slice(0, 7)}
                  </span>
                </div>
              </div>

              {/* Category breakdown */}
              {data.category_breakdown.length > 0 && (
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 className="w-4 h-4 text-for-400" />
                    <h2 className="text-sm font-semibold text-surface-700">By Category</h2>
                  </div>
                  <div className="flex flex-col divide-y divide-surface-300">
                    {data.category_breakdown.map((cat) => (
                      <CategoryRow key={cat.category} cat={cat} total={data.total} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent arguments */}
              {data.recent_arguments.length > 0 && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-surface-500" />
                      <h2 className="text-sm font-semibold text-surface-700">Recent Arguments</h2>
                    </div>
                    <Link
                      href="/arguments/mine"
                      className="text-xs text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
                    >
                      View all <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.recent_arguments.slice(0, 5).map((arg) => (
                      <RecentArgRow key={arg.id} arg={arg} />
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-center gap-4 pb-4">
                <Link
                  href="/arguments/mine"
                  className="text-xs text-surface-500 hover:text-surface-700 transition-colors flex items-center gap-1"
                >
                  All my arguments <ChevronRight className="w-3.5 h-3.5" />
                </Link>
                <span className="text-surface-600 text-xs">·</span>
                <Link
                  href="/coach"
                  className="text-xs text-gold hover:text-gold/80 transition-colors flex items-center gap-1"
                >
                  <Brain className="w-3.5 h-3.5" /> AI Coach
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Category Row ──────────────────────────────────────────────────────────────────

function CategoryRow({ cat, total }: { cat: CategoryBreakdown; total: number }) {
  const pct = total > 0 ? Math.round((cat.count / total) * 100) : 0
  const forPct = cat.count > 0 ? Math.round((cat.for_count / cat.count) * 100) : 0

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={cn('w-24 text-xs font-medium truncate', catColor(cat.category))}>
        {cat.category}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-1 mb-1">
          <div className="flex-1 h-1.5 rounded-full bg-surface-300/30 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-surface-500/40"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] font-mono text-surface-600 w-8 text-right">{cat.count}</span>
        </div>
        <div className="flex gap-0.5 h-1 rounded-full overflow-hidden">
          <div
            className="bg-for-500/50 rounded-l-full"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="bg-against-500/50 rounded-r-full flex-1"
          />
        </div>
      </div>
      <span className="text-[11px] font-mono text-surface-500 w-14 text-right">
        {cat.avg_upvotes.toFixed(1)} avg ↑
      </span>
    </div>
  )
}

// ─── Recent Arg Row ─────────────────────────────────────────────────────────────────

function RecentArgRow({ arg }: { arg: ArgumentStat }) {
  const isFor = arg.side === 'blue'
  const gradeColors = arg.ai_grade ? GRADE_COLORS[arg.ai_grade] : null

  return (
    <Link
      href={`/arguments/${arg.id}`}
      className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-200 transition-colors group"
    >
      <span
        className={cn(
          'flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full border mt-0.5',
          isFor
            ? 'text-for-400 bg-for-500/10 border-for-500/30'
            : 'text-against-400 bg-against-500/10 border-against-500/30'
        )}
      >
        {isFor ? 'FOR' : 'AGN'}
      </span>
      <p className="flex-1 text-xs text-surface-600 line-clamp-1 group-hover:text-surface-900 transition-colors">
        {arg.content}
      </p>
      <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-surface-500">
        {gradeColors && arg.ai_grade && (
          <span className={cn('font-bold', gradeColors.text)}>{arg.ai_grade}</span>
        )}
        <span className="flex items-center gap-0.5">
          <ThumbsUp className="w-3 h-3" />
          {arg.upvotes}
        </span>
      </div>
    </Link>
  )
}
