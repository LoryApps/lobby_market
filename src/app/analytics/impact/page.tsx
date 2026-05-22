'use client'

/**
 * /analytics/impact — Civic Argument Impact
 *
 * Shows the real-world influence of a user's arguments: total upvotes received,
 * replies sparked, debate wins, reach across all topics they engaged in, and an
 * impact archetype that captures their persuasion style.
 *
 * Distinct from:
 *   /analytics/arguments      — argument portfolio (grades, arena, faceoffs)
 *   /analytics/argument-quality — platform-wide argument quality index
 *   /analytics/rhetoric        — writing style breakdown
 *   /analytics/discourse       — platform discourse health (not personal)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronRight,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  ImpactResponse,
  ImpactArgument,
  ImpactCategoryStat,
  ImpactArchetype,
} from '@/app/api/analytics/impact/route'

// ─── Archetype styling ────────────────────────────────────────────────────────

const ARCHETYPE_STYLE: Record<
  ImpactArchetype,
  { color: string; bg: string; border: string; glow: string; icon: typeof Flame }
> = {
  catalyst: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    glow: 'shadow-[0_0_24px_rgba(201,168,76,0.2)]',
    icon: Flame,
  },
  specialist: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    glow: 'shadow-[0_0_24px_rgba(59,130,246,0.15)]',
    icon: Sparkles,
  },
  connector: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.15)]',
    icon: MessageSquare,
  },
  silent_force: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    glow: 'shadow-[0_0_24px_rgba(139,92,246,0.15)]',
    icon: Users,
  },
  wide_net: {
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    glow: 'shadow-[0_0_24px_rgba(239,68,68,0.12)]',
    icon: Scale,
  },
  rising_voice: {
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/20',
    glow: 'shadow-none',
    icon: TrendingUp,
  },
}

const CATEGORY_BAR: Record<string, string> = {
  Economics: 'bg-gold',
  Politics: 'bg-for-500',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-against-400',
  Philosophy: 'bg-for-300',
  Culture: 'bg-gold',
  Health: 'bg-against-300',
  Environment: 'bg-emerald',
  Education: 'bg-purple',
  Other: 'bg-surface-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonth(iso: string): string {
  const [year, month] = iso.split('-')
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${m[parseInt(month, 10) - 1]} ${year.slice(2)}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d < 1) return 'today'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ImpactSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg, rank }: { arg: ImpactArgument; rank: number }) {
  const isFor = arg.side === 'blue'
  const userSideWon =
    (arg.topic_status === 'law' && arg.side === 'blue') ||
    (arg.topic_status === 'failed' && arg.side === 'red')
  const isResolved = arg.topic_status === 'law' || arg.topic_status === 'failed'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.04 }}
    >
      <Link href={`/topic/${arg.topic_id}`}>
        <div className="group rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors">
          <div className="flex items-start gap-3">
            {/* Rank */}
            <span className="flex-shrink-0 text-xs font-mono font-bold text-surface-600 w-5 mt-0.5">
              #{rank + 1}
            </span>

            <div className="flex-1 min-w-0">
              {/* Topic */}
              <p className="text-[11px] font-mono text-surface-500 truncate mb-1">
                {arg.statement}
              </p>

              {/* Argument content */}
              <p className="text-sm text-surface-700 line-clamp-2 leading-relaxed mb-2.5">
                {arg.content}
              </p>

              {/* Metrics row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Side */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
                    isFor
                      ? 'bg-for-500/10 text-for-400 border border-for-500/20'
                      : 'bg-against-500/10 text-against-400 border border-against-500/20',
                  )}
                >
                  {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
                  {isFor ? 'FOR' : 'AGAINST'}
                </span>

                {/* Upvotes */}
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
                  <Zap className="h-3 w-3 text-gold" />
                  {arg.upvotes} upvote{arg.upvotes !== 1 ? 's' : ''}
                </span>

                {/* Replies */}
                {arg.reply_count > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500">
                    <MessageSquare className="h-3 w-3 text-for-400" />
                    {arg.reply_count} repl{arg.reply_count !== 1 ? 'ies' : 'y'}
                  </span>
                )}

                {/* Outcome */}
                {isResolved && (
                  <span
                    className={cn(
                      'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded',
                      userSideWon
                        ? 'bg-emerald/10 text-emerald border border-emerald/20'
                        : 'bg-surface-300/50 text-surface-500 border border-surface-400/30',
                    )}
                  >
                    {userSideWon ? '✓ Your side won' : 'Your side lost'}
                  </span>
                )}

                {/* Timestamp */}
                <span className="ml-auto text-[10px] font-mono text-surface-600">
                  {relativeTime(arg.created_at)}
                </span>
              </div>
            </div>

            <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1 transition-colors" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Category bar chart ───────────────────────────────────────────────────────

function CategoryBreakdown({ stats }: { stats: ImpactCategoryStat[] }) {
  const maxUpvotes = Math.max(...stats.map((s) => s.upvotes), 1)

  return (
    <div className="space-y-2.5">
      {stats.slice(0, 8).map((s, i) => (
        <motion.div
          key={s.category}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="flex items-center gap-3"
        >
          <span className="text-xs font-mono text-surface-500 w-24 truncate flex-shrink-0">
            {s.category}
          </span>
          <div className="flex-1 relative h-4 rounded-full bg-surface-300/40 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(s.upvotes / maxUpvotes) * 100}%` }}
              transition={{ duration: 0.6, delay: 0.2 + i * 0.05, ease: 'easeOut' }}
              className={cn('absolute inset-y-0 left-0 rounded-full', CATEGORY_BAR[s.category] ?? 'bg-surface-500')}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-mono font-bold text-white w-6 text-right">
              {s.upvotes}
            </span>
            <span className="text-[10px] font-mono text-surface-600">
              ({s.arguments} arg{s.arguments !== 1 ? 's' : ''})
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Monthly sparkline ────────────────────────────────────────────────────────

function MonthlyChart({ monthly }: { monthly: ImpactResponse['monthly'] }) {
  const maxUpvotes = Math.max(...monthly.map((m) => m.upvotes), 1)

  if (monthly.length === 0) return null

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1 h-20">
        {monthly.map((m, i) => (
          <motion.div
            key={m.month}
            className="flex-1 flex flex-col items-center gap-1"
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: 0.4, delay: i * 0.04, ease: 'easeOut' }}
            style={{ transformOrigin: 'bottom' }}
          >
            <div
              className="w-full rounded-t bg-for-500/60 hover:bg-for-500 transition-colors cursor-default relative group"
              style={{ height: `${Math.max(4, (m.upvotes / maxUpvotes) * 64)}px` }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-surface-50 border border-surface-300 rounded px-2 py-1 text-[10px] font-mono text-white whitespace-nowrap">
                  {m.upvotes}↑ {m.arguments}arg
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        {monthly.map((m) => (
          <div key={m.month} className="flex-1 text-[9px] font-mono text-surface-600 text-center truncate">
            {formatMonth(m.month)}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ImpactPage() {
  const router = useRouter()
  const [data, setData] = useState<ImpactResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/impact', { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as ImpactResponse
      setData(json)
    } catch {
      setError('Could not load impact analytics. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const archetypeStyle = data ? ARCHETYPE_STYLE[data.archetype] : null
  const ArchIcon = archetypeStyle?.icon ?? Sparkles

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-xl font-bold text-white">Argument Impact</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Your civic influence — upvotes, reach, and debate wins
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <ImpactSkeleton />
            </motion.div>
          )}

          {!loading && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-against-500/10 border border-against-500/30 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button
                onClick={load}
                className="mt-3 text-xs font-mono text-surface-500 hover:text-white underline"
              >
                Try again
              </button>
            </motion.div>
          )}

          {!loading && !error && data && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* ── No arguments yet ─────────────────────────────── */}
              {data.total_arguments === 0 && (
                <EmptyState
                  icon={MessageSquare}
                  title="No arguments yet"
                  description="Post your first FOR or AGAINST argument on any topic to start building your impact score."
                  action={{ label: 'Go to Feed', href: '/' }}
                />
              )}

              {data.total_arguments > 0 && (
                <>
                  {/* ── Archetype card ─────────────────────────── */}
                  {archetypeStyle && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className={cn(
                        'rounded-2xl border p-6',
                        archetypeStyle.bg,
                        archetypeStyle.border,
                        archetypeStyle.glow,
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'flex items-center justify-center h-12 w-12 rounded-xl border flex-shrink-0',
                            archetypeStyle.bg,
                            archetypeStyle.border,
                          )}
                        >
                          <ArchIcon className={cn('h-6 w-6', archetypeStyle.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-[10px] font-mono uppercase tracking-widest mb-1', archetypeStyle.color)}>
                            Impact Archetype
                          </div>
                          <div className="text-lg font-mono font-bold text-white mb-1">
                            {data.archetype_label}
                          </div>
                          <p className="text-xs font-mono text-surface-500 leading-relaxed">
                            {data.archetype_description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Stat tiles ─────────────────────────────── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.05 }}
                    className="grid grid-cols-2 sm:grid-cols-4 gap-3"
                  >
                    {[
                      {
                        label: 'Impact Score',
                        value: data.impact_score,
                        icon: Trophy,
                        color: 'text-gold',
                        bg: 'bg-gold/10 border-gold/20',
                        suffix: 'pts',
                      },
                      {
                        label: 'Upvotes',
                        value: data.total_upvotes,
                        icon: Zap,
                        color: 'text-for-400',
                        bg: 'bg-for-500/10 border-for-500/20',
                        suffix: '',
                      },
                      {
                        label: 'Replies Sparked',
                        value: data.total_replies,
                        icon: MessageSquare,
                        color: 'text-emerald',
                        bg: 'bg-emerald/10 border-emerald/20',
                        suffix: '',
                      },
                      {
                        label: 'Total Reach',
                        value: data.total_reach,
                        icon: Users,
                        color: 'text-purple',
                        bg: 'bg-purple/10 border-purple/20',
                        suffix: 'votes',
                      },
                    ].map((stat, i) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                        className={cn(
                          'rounded-xl border p-4 flex flex-col gap-1',
                          stat.bg,
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <stat.icon className={cn('h-3.5 w-3.5', stat.color)} />
                          <span className={cn('text-[10px] font-mono uppercase tracking-wider', stat.color)}>
                            {stat.label}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-mono font-bold text-white">
                            <AnimatedNumber value={stat.value} />
                          </span>
                          {stat.suffix && (
                            <span className={cn('text-[10px] font-mono', stat.color)}>
                              {stat.suffix}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>

                  {/* ── Debate outcomes ──────────────────────────── */}
                  {data.debate_total > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.15 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        <Scale className="h-3.5 w-3.5" />
                        Debate Outcomes
                      </div>
                      <div className="flex items-center gap-6">
                        <div>
                          <div className="text-3xl font-mono font-bold text-white">
                            {data.win_rate !== null ? `${data.win_rate}%` : '—'}
                          </div>
                          <div className="text-xs font-mono text-surface-500 mt-0.5">Win rate</div>
                        </div>
                        <div className="flex-1">
                          {/* Win/loss bar */}
                          <div className="relative h-2.5 rounded-full bg-surface-300 overflow-hidden mb-1.5">
                            {data.debate_total > 0 && (
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${(data.debate_wins / data.debate_total) * 100}%`,
                                }}
                                transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
                                className="absolute inset-y-0 left-0 rounded-full bg-emerald"
                              />
                            )}
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-surface-500">
                            <span>{data.debate_wins} wins</span>
                            <span>{data.debate_total - data.debate_wins} losses</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] font-mono text-surface-600 mt-3">
                        Based on {data.debate_total} resolved topic{data.debate_total !== 1 ? 's' : ''} you argued in (law = FOR win, failed = AGAINST win).
                      </p>
                    </motion.div>
                  )}

                  {/* ── Side preference ──────────────────────────── */}
                  {data.best_upvoted_side && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.17 }}
                      className={cn(
                        'rounded-2xl border p-4 flex items-center gap-3',
                        data.best_upvoted_side === 'blue'
                          ? 'bg-for-500/5 border-for-500/20'
                          : 'bg-against-500/5 border-against-500/20',
                      )}
                    >
                      {data.best_upvoted_side === 'blue' ? (
                        <ThumbsUp className="h-5 w-5 text-for-400 flex-shrink-0" />
                      ) : (
                        <ThumbsDown className="h-5 w-5 text-against-400 flex-shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-mono font-semibold text-white">
                          {data.best_upvoted_side === 'blue' ? 'FOR arguments resonate more' : 'AGAINST arguments resonate more'}
                        </div>
                        <div className="text-[11px] font-mono text-surface-500 mt-0.5">
                          Your {data.best_upvoted_side === 'blue' ? 'supportive' : 'critical'} arguments earn more upvotes on average
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* ── Top arguments ────────────────────────────── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                      <Trophy className="h-3.5 w-3.5 text-gold" />
                      Most Impactful Arguments
                    </div>
                    <div className="space-y-2">
                      {data.top_arguments.map((arg, i) => (
                        <ArgumentCard key={arg.id} arg={arg} rank={i} />
                      ))}
                    </div>
                  </motion.div>

                  {/* ── Category breakdown ──────────────────────── */}
                  {data.category_stats.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.25 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider">
                          <BarChart2 className="h-3.5 w-3.5" />
                          Upvotes by Category
                        </div>
                        {data.best_category && (
                          <Badge variant="gold" size="xs">
                            Top: {data.best_category}
                          </Badge>
                        )}
                      </div>
                      <CategoryBreakdown stats={data.category_stats} />
                    </motion.div>
                  )}

                  {/* ── Monthly chart ────────────────────────────── */}
                  {data.monthly.length >= 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: 0.3 }}
                      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                    >
                      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Upvotes Over Time
                      </div>
                      <MonthlyChart monthly={data.monthly} />
                    </motion.div>
                  )}

                  {/* ── CTA: view all arguments ──────────────────── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.35 }}
                  >
                    <Link
                      href="/analytics/arguments"
                      className="flex items-center justify-between rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-for-500/40 hover:bg-for-500/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-for-500/10 border border-for-500/20 flex-shrink-0">
                          <BarChart2 className="h-5 w-5 text-for-400" />
                        </div>
                        <div>
                          <div className="text-sm font-mono font-semibold text-white">
                            Argument Portfolio
                          </div>
                          <div className="text-xs font-mono text-surface-500 mt-0.5">
                            Full breakdown with grades, faceoff record, and per-topic history
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors flex-shrink-0" />
                    </Link>
                  </motion.div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
