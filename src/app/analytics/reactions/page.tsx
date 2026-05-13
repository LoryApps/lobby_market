'use client'

/**
 * /analytics/reactions — Argument Reception Analytics
 *
 * How does the community react to what you argue?
 * Breaks down the reactions your arguments receive — insightful, compelling,
 * balanced, needs_evidence — and reveals your Argument Archetype.
 *
 * Distinct from:
 *   /analytics/arguments   — grade distribution, arena record, raw stats
 *   /analytics/sentiment   — emotional tone of your votes/arguments
 *   /arguments/reactions   — platform-wide reaction leaderboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart2,
  Brain,
  ChevronRight,
  ExternalLink,
  Flame,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ArgumentReceptionData,
  ReactionType,
  TopReactionArgument,
  ReceptionArchetype,
} from '@/app/api/analytics/reactions/route'

// ─── Reaction config ──────────────────────────────────────────────────────────

const REACTION_CONFIG: Record<ReactionType, {
  label: string
  emoji: string
  color: string
  bg: string
  border: string
  description: string
}> = {
  insightful: {
    label: 'Insightful',
    emoji: '💡',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'This shifted my thinking',
  },
  compelling: {
    label: 'Compelling',
    emoji: '🔥',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'Strong, well-made point',
  },
  balanced: {
    label: 'Balanced',
    emoji: '⚖️',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'Fair, considers both sides',
  },
  needs_evidence: {
    label: 'Needs Evidence',
    emoji: '🔍',
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
    description: 'Good point — needs a source',
  },
}

// ─── Archetype config ─────────────────────────────────────────────────────────

const ARCHETYPE_CONFIG: Record<ReceptionArchetype, {
  label: string
  icon: string
  color: string
  bg: string
  border: string
  description: string
}> = {
  analyst: {
    label: 'The Analyst',
    icon: '💡',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    description: 'Your arguments illuminate — the community finds your reasoning novel and thought-shifting.',
  },
  debater: {
    label: 'The Debater',
    icon: '🔥',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    description: 'You argue to win — your points land hard and the community feels the persuasion.',
  },
  mediator: {
    label: 'The Mediator',
    icon: '⚖️',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    description: 'You see every angle — your balanced arguments earn respect from both sides.',
  },
  provocateur: {
    label: 'The Provocateur',
    icon: '🔍',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    description: 'You make bold claims — the community wants you to back them up. Cite your sources.',
  },
  newcomer: {
    label: 'Newcomer',
    icon: '🌱',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    description: 'Keep arguing — your reception archetype will emerge as the community engages.',
  },
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-3 w-full mb-1.5" />
                <Skeleton className="h-2 w-3/4" />
              </div>
              <Skeleton className="h-6 w-12 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Reception bar chart ──────────────────────────────────────────────────────

function ReactionBar({
  type,
  count,
  total,
}: {
  type: ReactionType
  count: number
  total: number
}) {
  const cfg = REACTION_CONFIG[type]
  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-base',
          cfg.bg,
          cfg.border,
          'border'
        )}
      >
        {cfg.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('text-xs font-mono font-semibold', cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-xs font-mono text-surface-500">
            {count} · {pct}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
            className={cn('h-full rounded-full', cfg.bg.replace('/10', '/60'))}
            style={{ background: undefined }}
          />
        </div>
        <p className="text-[11px] text-surface-600 mt-0.5">{cfg.description}</p>
      </div>
    </div>
  )
}

// ─── Monthly sparkline ────────────────────────────────────────────────────────

const SPARK_W = 240
const SPARK_H = 48
const PAD = 4

function Sparkline({
  data,
  className,
}: {
  data: { month: string; reactions: number }[]
  className?: string
}) {
  const max = Math.max(...data.map((d) => d.reactions), 1)
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (SPARK_W - PAD * 2)
    const y = SPARK_H - PAD - ((d.reactions / max) * (SPARK_H - PAD * 2))
    return { x, y }
  })
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ')
  const fillPath =
    `M${pts[0].x},${SPARK_H} ` +
    pts.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${SPARK_H} Z`

  return (
    <svg
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className={cn('w-full', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(96 165 250)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="rgb(96 165 250)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#spark-grad)" />
      <polyline
        points={polyline}
        fill="none"
        stroke="rgb(96 165 250)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function TopArgumentCard({ arg }: { arg: TopReactionArgument }) {
  const isFor = arg.side === 'blue'
  const total = arg.total_reactions
  const topType = Object.entries(arg.breakdown)
    .sort(([, a], [, b]) => b - a)
    .find(([, count]) => count > 0)?.[0] as ReactionType | undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border p-4 transition-colors hover:border-surface-400/60',
        isFor
          ? 'bg-for-950/30 border-for-800/30'
          : 'bg-against-950/30 border-against-800/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 h-7 w-14 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold uppercase tracking-wider mt-0.5',
            isFor
              ? 'bg-for-500/15 text-for-400 border border-for-500/30'
              : 'bg-against-500/15 text-against-400 border border-against-500/30'
          )}
        >
          {isFor ? 'FOR' : 'AGN'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-surface-200 leading-snug line-clamp-2">{arg.content}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-[11px] text-surface-500 truncate max-w-[160px]">
              {arg.topic_statement}
            </span>
            {topType && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
                  REACTION_CONFIG[topType].bg,
                  REACTION_CONFIG[topType].border,
                  REACTION_CONFIG[topType].color
                )}
              >
                {REACTION_CONFIG[topType].emoji} {REACTION_CONFIG[topType].label}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-sm font-mono font-bold text-white">{total}</span>
          <span className="text-[10px] text-surface-600">reactions</span>
        </div>
      </div>
      <Link
        href={`/arguments/${arg.id}`}
        className={cn(
          'mt-3 inline-flex items-center gap-1 text-[11px] font-mono transition-colors',
          isFor ? 'text-for-400 hover:text-for-300' : 'text-against-400 hover:text-against-300'
        )}
      >
        View argument <ExternalLink className="h-3 w-3" />
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArgumentReceptionsPage() {
  const router = useRouter()
  const [data, setData] = useState<ArgumentReceptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/reactions', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to load reaction analytics')
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const archCfg = data ? ARCHETYPE_CONFIG[data.archetype] : null
  const totalReactions = data?.total_received ?? 0
  const breakdown = data?.reaction_breakdown ?? {
    insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white font-mono">Argument Reception</h1>
            <p className="text-xs text-surface-500 mt-0.5">
              How the community reacts to your arguments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
            <Link
              href="/analytics"
              className="flex items-center gap-1 text-xs text-surface-500 hover:text-white transition-colors font-mono"
            >
              Analytics <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {loading && <PageSkeleton />}

        {!loading && data && data.total_received === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="No reactions yet"
            description="Write arguments on topics you care about. As others engage with your reasoning, your reception analytics will appear here."
            action={{ label: 'Browse Topics', href: '/' }}
          />
        )}

        {!loading && data && data.total_received > 0 && (
          <AnimatePresence>
            <div className="space-y-4">

              {/* Hero stats row */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-3"
              >
                {[
                  {
                    label: 'Total Reactions',
                    value: totalReactions,
                    sub: `${data.arguments_with_reactions} argument${data.arguments_with_reactions !== 1 ? 's' : ''}`,
                    color: 'text-white',
                  },
                  {
                    label: 'Reception Score',
                    value: data.reception_score,
                    sub: 'weighted quality',
                    color: 'text-gold',
                  },
                  {
                    label: 'Top Reaction',
                    value: (() => {
                      const best = Object.entries(breakdown)
                        .sort(([, a], [, b]) => b - a)[0]?.[0] as ReactionType
                      return REACTION_CONFIG[best]?.emoji ?? '—'
                    })(),
                    sub: (() => {
                      const best = Object.entries(breakdown)
                        .sort(([, a], [, b]) => b - a)[0]?.[0] as ReactionType
                      return REACTION_CONFIG[best]?.label ?? ''
                    })(),
                    color: (() => {
                      const best = Object.entries(breakdown)
                        .sort(([, a], [, b]) => b - a)[0]?.[0] as ReactionType
                      return REACTION_CONFIG[best]?.color ?? 'text-white'
                    })(),
                    isText: true,
                  },
                  {
                    label: 'Percentile',
                    value: data.percentile !== null ? `${data.percentile}th` : '—',
                    sub: 'by reception score',
                    color: 'text-emerald',
                    isText: true,
                  },
                ].map(({ label, value, sub, color, isText }) => (
                  <div
                    key={label}
                    className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                  >
                    <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                      {label}
                    </div>
                    {isText ? (
                      <div className={cn('text-2xl font-mono font-bold', color)}>{value}</div>
                    ) : (
                      <div className={cn('text-2xl font-mono font-bold', color)}>
                        <AnimatedNumber value={Number(value)} />
                      </div>
                    )}
                    <div className="text-[11px] text-surface-600 mt-1">{sub}</div>
                  </div>
                ))}
              </motion.div>

              {/* Archetype card */}
              {archCfg && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 }}
                  className={cn(
                    'rounded-2xl border p-6',
                    archCfg.bg,
                    archCfg.border
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'flex-shrink-0 h-14 w-14 rounded-2xl flex items-center justify-center text-3xl',
                        archCfg.bg,
                        'border',
                        archCfg.border
                      )}
                    >
                      {archCfg.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className={cn('h-3.5 w-3.5', archCfg.color)} />
                        <span className={cn('text-[10px] font-mono uppercase tracking-wider', archCfg.color)}>
                          Your Archetype
                        </span>
                      </div>
                      <h2 className={cn('text-xl font-bold font-mono', archCfg.color)}>
                        {archCfg.label}
                      </h2>
                      <p className="text-sm text-surface-400 mt-1 leading-relaxed">
                        {archCfg.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Reaction breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
              >
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-5">
                  <BarChart2 className="h-3.5 w-3.5 text-for-400" />
                  Reaction Breakdown
                </div>
                <div className="space-y-4">
                  {(Object.keys(REACTION_CONFIG) as ReactionType[]).map((type) => (
                    <ReactionBar
                      key={type}
                      type={type}
                      count={breakdown[type]}
                      total={totalReactions}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Monthly trend */}
              {data.monthly_trend.some((m) => m.reactions > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.15 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Zap className="h-3.5 w-3.5 text-for-400" />
                    Reaction Activity (12 months)
                  </div>
                  <Sparkline data={data.monthly_trend} className="h-12" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-surface-600 font-mono">
                      {data.monthly_trend[0]?.month}
                    </span>
                    <span className="text-[10px] text-surface-600 font-mono">
                      {data.monthly_trend[data.monthly_trend.length - 1]?.month}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Side breakdown */}
              {(data.side_breakdown[0]?.argument_count > 0 || data.side_breakdown[1]?.argument_count > 0) && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Scale className="h-3.5 w-3.5 text-for-400" />
                    FOR vs AGAINST Reception
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {data.side_breakdown.map((side) => (
                      <div
                        key={side.side}
                        className={cn(
                          'rounded-xl border p-4',
                          side.side === 'for'
                            ? 'bg-for-950/30 border-for-800/30'
                            : 'bg-against-950/30 border-against-800/30'
                        )}
                      >
                        <div
                          className={cn(
                            'text-xs font-mono font-bold uppercase mb-3',
                            side.side === 'for' ? 'text-for-400' : 'text-against-400'
                          )}
                        >
                          {side.side === 'for' ? 'FOR' : 'AGAINST'}
                        </div>
                        <div className="space-y-1.5">
                          <div>
                            <span className="text-xl font-mono font-bold text-white">
                              {side.total_reactions}
                            </span>
                            <span className="text-xs text-surface-500 ml-1.5">reactions</span>
                          </div>
                          <div className="text-xs text-surface-500">
                            {side.argument_count} arg{side.argument_count !== 1 ? 's' : ''} ·{' '}
                            {side.avg_reactions} avg
                          </div>
                          {side.top_type && (
                            <div
                              className={cn(
                                'inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md border',
                                REACTION_CONFIG[side.top_type].bg,
                                REACTION_CONFIG[side.top_type].border,
                                REACTION_CONFIG[side.top_type].color
                              )}
                            >
                              {REACTION_CONFIG[side.top_type].emoji} {REACTION_CONFIG[side.top_type].label}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Category breakdown */}
              {data.category_breakdown.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.25 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Brain className="h-3.5 w-3.5 text-purple" />
                    Reception by Category
                  </div>
                  <div className="space-y-3">
                    {data.category_breakdown.map((cat) => {
                      const maxCat = data.category_breakdown[0]?.total_reactions || 1
                      const pct = Math.round((cat.total_reactions / maxCat) * 100)
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-24 text-xs font-mono text-surface-400 truncate">
                            {cat.category}
                          </div>
                          <div className="flex-1">
                            <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
                                className="h-full rounded-full bg-purple/60"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {cat.top_type && (
                              <span className="text-sm">{REACTION_CONFIG[cat.top_type].emoji}</span>
                            )}
                            <span className="text-xs font-mono text-white w-8 text-right">
                              {cat.total_reactions}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-surface-600 mt-4 border-t border-surface-300 pt-3">
                    Bar length = share of your total reactions. Emoji = most common reaction type in that category.
                  </p>
                </motion.div>
              )}

              {/* Top arguments */}
              {data.top_arguments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.3 }}
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                    <Award className="h-3.5 w-3.5 text-gold" />
                    Most Reacted Arguments
                  </div>
                  <div className="space-y-2">
                    {data.top_arguments.slice(0, 5).map((arg) => (
                      <TopArgumentCard key={arg.id} arg={arg} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Footer nav */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.4 }}
                className="flex flex-wrap gap-3 pt-2"
              >
                <Link
                  href="/analytics/arguments"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  Argument Portfolio
                </Link>
                <Link
                  href="/analytics/faceoffs"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Faceoff Record
                </Link>
                <Link
                  href="/arguments/reactions"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Flame className="h-3.5 w-3.5" />
                  Platform Reaction Leaders
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>

            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
