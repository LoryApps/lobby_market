'use client'

/**
 * /resonance — The Civic Resonance
 *
 * Shows which of your arguments crossed partisan lines — earning upvotes
 * from people who voted the OPPOSITE side on the same topic.
 *
 * Cross-partisan upvotes are rare and meaningful: they indicate your argument
 * was compelling enough to earn respect from ideological opponents.
 *
 * Distinct from:
 *   /persuasion     — shows which categories you write arguments in
 *   /rhetoric       — your rhetorical style and techniques
 *   /impact         — general influence score
 *   /analytics      — personal stats overview
 *
 * Resonance specifically answers: "Which arguments of yours landed across
 * the aisle — and who on the other side actually upvoted you?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  BookOpen,
  Cpu,
  DollarSign,
  ExternalLink,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ResonanceResponse,
  ResonantArgument,
  CategoryResonance,
  CrossPartisanVoice,
} from '@/app/api/analytics/resonance/route'

// ─── Category icons ───────────────────────────────────────────────────────────

type CategoryIconType = typeof Globe

const CATEGORY_ICONS: Record<string, CategoryIconType> = {
  Politics:    Landmark,
  Economics:   DollarSign,
  Technology:  Cpu,
  Science:     FlaskConical,
  Ethics:      Scale,
  Environment: Leaf,
  Education:   GraduationCap,
  Health:      Heart,
  Culture:     Music2,
  Other:       Globe,
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Environment: 'text-emerald',
  Education:   'text-amber-400',
  Health:      'text-pink-400',
  Culture:     'text-orange-400',
  Other:       'text-surface-500',
}

// ─── Archetype config ─────────────────────────────────────────────────────────

interface ArchetypeConfig {
  icon: string
  color: string
  bg: string
  border: string
  gradient: string
}

const ARCHETYPE_CONFIG: Record<string, ArchetypeConfig> = {
  'Bridge Builder': {
    icon: '🌉',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    gradient: 'from-purple/20 to-transparent',
  },
  'Cross-Aisle Advocate': {
    icon: '🤝',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    gradient: 'from-emerald/15 to-transparent',
  },
  'Emerging Persuader': {
    icon: '🌱',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    gradient: 'from-for-500/15 to-transparent',
  },
  'Choir Preacher': {
    icon: '📣',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    gradient: 'from-gold/10 to-transparent',
  },
  'Silent Partisan': {
    icon: '🔇',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-300',
    gradient: 'from-surface-200 to-transparent',
  },
}

function getArchetypeConfig(archetype: string): ArchetypeConfig {
  return ARCHETYPE_CONFIG[archetype] ?? ARCHETYPE_CONFIG['Silent Partisan']
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function ResonanceSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  )
}

// ─── Resonant Argument Card ───────────────────────────────────────────────────

function ArgumentCard({ arg, rank }: { arg: ResonantArgument; rank: number }) {
  const isFor = arg.argument_side === 'blue'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className={cn(
        'rounded-2xl border p-4 transition-all hover:border-purple/40',
        'bg-surface-100 border-surface-300',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex-shrink-0',
              isFor
                ? 'bg-for-500/15 text-for-400 border border-for-500/30'
                : 'bg-against-500/15 text-against-400 border border-against-500/30',
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-2.5 w-2.5" />
            ) : (
              <ThumbsDown className="h-2.5 w-2.5" />
            )}
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          <span className="text-[10px] font-mono text-surface-500 truncate">
            {arg.topic_category ?? 'Other'}
          </span>
        </div>
        <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">
          #{rank + 1}
        </span>
      </div>

      {/* Topic */}
      <Link
        href={`/topic/${arg.topic_id}`}
        className="block text-[11px] font-mono text-surface-500 hover:text-surface-400 transition-colors mb-2 line-clamp-1"
      >
        {arg.topic_statement}
      </Link>

      {/* Argument content */}
      <p className="text-sm font-mono text-white leading-relaxed line-clamp-3 mb-3">
        &ldquo;{arg.argument_content}&rdquo;
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        {/* Total upvotes */}
        <div className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3 text-surface-500" />
          <span className="text-xs font-mono text-surface-400 tabular-nums">
            {arg.total_upvotes}
          </span>
        </div>

        {/* Cross-partisan upvotes */}
        <div className="flex items-center gap-1">
          <UserCheck className="h-3 w-3 text-purple" />
          <span className="text-xs font-mono text-purple tabular-nums font-semibold">
            {arg.cross_upvotes} cross
          </span>
        </div>

        {/* Cross % bar */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <div className="h-1.5 flex-1 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-purple"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(arg.cross_upvote_pct, 100)}%` }}
              transition={{ duration: 0.6, delay: rank * 0.05 + 0.2 }}
            />
          </div>
          <span className="text-[10px] font-mono text-purple tabular-nums flex-shrink-0">
            {arg.cross_upvote_pct}%
          </span>
        </div>

        {/* Resonance score */}
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-gold" />
          <span className="text-[10px] font-mono text-gold tabular-nums">
            {arg.resonance_score.toFixed(1)}
          </span>
        </div>
      </div>

      {/* View link */}
      <div className="mt-3 pt-3 border-t border-surface-300">
        <Link
          href={`/topic/${arg.topic_id}`}
          className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          View debate
          <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Category Bar ─────────────────────────────────────────────────────────────

function CategoryBar({ cat, maxPct, index }: { cat: CategoryResonance; maxPct: number; index: number }) {
  const Icon = CATEGORY_ICONS[cat.category] ?? Globe
  const color = CATEGORY_COLORS[cat.category] ?? 'text-surface-500'
  const width = maxPct > 0 ? (cat.avg_cross_pct / maxPct) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center gap-3"
    >
      <div className="flex items-center gap-2 w-28 flex-shrink-0">
        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
        <span className="text-xs font-mono text-surface-400 truncate">{cat.category}</span>
      </div>

      <div className="flex-1 flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-surface-300 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-purple"
            initial={{ width: 0 }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 0.7, delay: index * 0.06 + 0.15, ease: 'easeOut' }}
          />
        </div>
        <span className="text-xs font-mono text-purple tabular-nums w-8 text-right">
          {cat.avg_cross_pct}%
        </span>
      </div>

      <div className="text-[10px] font-mono text-surface-600 w-14 text-right flex-shrink-0">
        {cat.resonant_args}/{cat.total_args} args
      </div>
    </motion.div>
  )
}

// ─── Cross-Upvoter Card ───────────────────────────────────────────────────────

function CrossUpvoterCard({ voice, index }: { voice: CrossPartisanVoice; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        href={`/profile/${voice.username}`}
        className={cn(
          'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all',
          'bg-surface-100 border-surface-300 hover:border-purple/40 hover:bg-purple/5',
        )}
      >
        <Avatar
          src={voice.avatar_url}
          fallback={voice.display_name ?? voice.username}
          size="sm"
          className="ring-1 ring-purple/30"
        />
        <div className="text-center min-w-0 w-full">
          <p className="text-xs font-mono text-white truncate font-semibold">
            {voice.display_name ?? voice.username}
          </p>
          <p className="text-[10px] font-mono text-surface-500 truncate">
            @{voice.username}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <UserCheck className="h-3 w-3 text-purple" />
          <span className="text-[10px] font-mono text-purple tabular-nums">
            {voice.upvoted_args}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ResonanceClient() {
  const router = useRouter()
  const [data, setData] = useState<ResonanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expandedArgs, setExpandedArgs] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/analytics/resonance')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const archCfg = data ? getArchetypeConfig(data.stats.resonance_archetype) : null
  const maxCrossPct = data ? Math.max(...data.category_breakdown.map((c) => c.avg_cross_pct), 1) : 1
  const visibleArgs = expandedArgs
    ? (data?.top_resonant ?? [])
    : (data?.top_resonant ?? []).slice(0, 5)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">
        {/* ── Nav ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <UserCheck className="h-6 w-6 text-purple" />
          </div>
          <div>
            <h1 className="text-xl font-mono font-bold text-white mb-1">
              Civic Resonance
            </h1>
            <p className="text-sm font-mono text-surface-500 leading-relaxed">
              The arguments that crossed the divide. When someone on the other
              side upvotes you, that&rsquo;s resonance.
            </p>
          </div>
        </div>

        {loading ? (
          <ResonanceSkeleton />
        ) : !data ? (
          <EmptyState
            icon={UserCheck}
            title="Could not load resonance data"
            description="Try refreshing the page."
          />
        ) : (
          <div className="space-y-8">
            {/* ── Archetype Card ────────────────────────────────────────────── */}
            {archCfg && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-6 relative overflow-hidden',
                  archCfg.bg,
                  archCfg.border,
                )}
              >
                {/* Background gradient */}
                <div
                  className={cn(
                    'absolute inset-0 bg-gradient-to-br pointer-events-none',
                    archCfg.gradient,
                  )}
                />

                <div className="relative z-10">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl flex-shrink-0" role="img" aria-label={data.stats.resonance_archetype}>
                      {archCfg.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('text-lg font-mono font-bold', archCfg.color)}>
                          {data.stats.resonance_archetype}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-300/50 text-[10px] font-mono text-surface-400 border border-surface-400/30">
                          Your Archetype
                        </span>
                      </div>
                      <p className="text-sm font-mono text-surface-400 leading-relaxed">
                        {data.stats.archetype_desc}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Stats Grid ──────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="grid grid-cols-2 gap-3"
            >
              {[
                {
                  label: 'Total Args',
                  value: data.stats.total_arguments,
                  icon: BookOpen,
                  color: 'text-surface-400',
                  sub: 'with upvotes',
                },
                {
                  label: 'Resonant Args',
                  value: data.stats.arguments_with_cross_upvotes,
                  icon: Sparkles,
                  color: 'text-purple',
                  sub: 'crossed the aisle',
                },
                {
                  label: 'Cross Upvotes',
                  value: data.stats.total_cross_upvotes,
                  icon: UserCheck,
                  color: 'text-emerald',
                  sub: 'from opponents',
                },
                {
                  label: 'Avg Cross %',
                  value: `${data.stats.avg_cross_pct}%`,
                  icon: TrendingUp,
                  color: 'text-gold',
                  sub: 'per argument',
                },
              ].map(({ label, value, icon: Icon, color, sub }) => (
                <div
                  key={label}
                  className="rounded-xl bg-surface-100 border border-surface-300 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn('h-3.5 w-3.5', color)} />
                    <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                      {label}
                    </span>
                  </div>
                  <p className={cn('text-2xl font-mono font-bold tabular-nums', color)}>
                    {value}
                  </p>
                  <p className="text-[10px] font-mono text-surface-600 mt-0.5">{sub}</p>
                </div>
              ))}
            </motion.div>

            {/* ── No data state ──────────────────────────────────────────── */}
            {!data.has_data ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center"
              >
                <UserCheck className="h-10 w-10 text-surface-500 mx-auto mb-3" />
                <h3 className="text-base font-mono font-bold text-white mb-2">
                  No cross-partisan upvotes yet
                </h3>
                <p className="text-sm font-mono text-surface-500 leading-relaxed mb-4">
                  Write arguments that engage genuinely with the opposing side&rsquo;s concerns.
                  The more you steelman the other view, the more likely opponents will respect your reasoning.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Link
                    href="/topics"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/10 border border-purple/30 text-sm font-mono text-purple hover:bg-purple/20 transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Browse debates
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/steelman"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white transition-colors"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    Steelman engine
                  </Link>
                </div>
              </motion.div>
            ) : (
              <>
                {/* ── Top Resonant Arguments ────────────────────────────── */}
                <motion.section
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple" />
                      <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        Most Resonant Arguments
                      </h2>
                    </div>
                    <span className="text-[10px] font-mono text-surface-500">
                      sorted by resonance score
                    </span>
                  </div>

                  <div className="space-y-3">
                    <AnimatePresence>
                      {visibleArgs.map((arg, i) => (
                        <ArgumentCard key={arg.argument_id} arg={arg} rank={i} />
                      ))}
                    </AnimatePresence>
                  </div>

                  {data.top_resonant.length > 5 && (
                    <button
                      onClick={() => setExpandedArgs((prev) => !prev)}
                      className="mt-3 w-full py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                    >
                      {expandedArgs
                        ? 'Show fewer arguments'
                        : `Show all ${data.top_resonant.length} resonant arguments`}
                    </button>
                  )}
                </motion.section>

                {/* ── Category Breakdown ───────────────────────────────── */}
                {data.category_breakdown.length > 0 && (
                  <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-2xl bg-surface-100 border border-surface-300 p-6"
                  >
                    <div className="flex items-center gap-2 mb-5">
                      <BarChart2 className="h-4 w-4 text-purple" />
                      <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        Resonance by Category
                      </h2>
                    </div>

                    <p className="text-xs font-mono text-surface-500 mb-4">
                      Average % of upvotes coming from opposite-side voters, per category.
                    </p>

                    <div className="space-y-3">
                      {data.category_breakdown.map((cat, i) => (
                        <CategoryBar
                          key={cat.category}
                          cat={cat}
                          maxPct={maxCrossPct}
                          index={i}
                        />
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* ── Top Cross-Upvoters ───────────────────────────────── */}
                {data.top_cross_upvoters.length > 0 && (
                  <motion.section
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="h-4 w-4 text-purple" />
                      <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
                        Who Crossed the Aisle for You
                      </h2>
                    </div>

                    <p className="text-xs font-mono text-surface-500 mb-4">
                      These users voted opposite to you — yet still upvoted your arguments.
                    </p>

                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                      {data.top_cross_upvoters.map((voice, i) => (
                        <CrossUpvoterCard key={voice.user_id} voice={voice} index={i} />
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* ── Resonance tip ─────────────────────────────────────── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-2xl bg-purple/5 border border-purple/20 p-5"
                >
                  <div className="flex items-start gap-3">
                    <Zap className="h-4 w-4 text-purple flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-mono font-semibold text-white mb-1">
                        How to increase your resonance
                      </p>
                      <p className="text-xs font-mono text-surface-500 leading-relaxed">
                        Arguments earn cross-partisan respect when they acknowledge the opposing
                        side&rsquo;s strongest concerns, cite evidence, and avoid tribal
                        signaling. Try the Steelman Engine to pressure-test your arguments before
                        posting.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </>
            )}

            {/* ── Footer CTAs ──────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-4 border-t border-surface-300 flex flex-wrap gap-3"
            >
              <Link
                href="/persuasion"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Persuasion stats
              </Link>
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Analytics
              </Link>
              <Link
                href="/steelman"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/10 border border-purple/30 text-xs font-mono text-purple hover:bg-purple/20 transition-colors"
              >
                <Scale className="h-3.5 w-3.5" />
                Steelman engine
              </Link>
            </motion.div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
