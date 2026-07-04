'use client'

/**
 * /analytics/growth-plan — Civic Growth Plan
 *
 * An AI-powered personalised improvement plan that analyses the user's
 * weakest karma dimensions and generates specific, actionable tasks with
 * direct platform links and estimated clout rewards.
 *
 * Distinct from:
 *   /karma          — shows your current composite civic score (what you ARE)
 *   /advisor        — recommends which TOPICS to engage with today
 *   /briefing       — daily action list (not strategic improvement-focused)
 *   /analytics/mentor — argument writing coaching (narrow focus)
 *
 * This is the strategic "how do I level up?" page — not just what happened,
 * but what to DO next to grow across all civic dimensions.
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
  Brain,
  ChevronRight,
  Coins,
  Flame,
  Globe,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  ThumbsUp,
  TrendingUp,
  Zap,
  CheckCircle2,
  Clock,
  Shield,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { GrowthPlanData, GrowthDimension, GrowthTask } from '@/app/api/analytics/growth-plan/route'

// ─── Dimension config ─────────────────────────────────────────────────────────

const DIM_ICONS: Record<string, React.ElementType> = {
  discourse: MessageSquare,
  prediction: Target,
  breadth: Globe,
  engagement: Flame,
  trust: Shield,
}

const DIM_COLORS: Record<string, { text: string; bg: string; border: string; bar: string }> = {
  discourse: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30', bar: 'bg-purple' },
  prediction: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30', bar: 'bg-for-500' },
  breadth: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30', bar: 'bg-emerald' },
  engagement: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', bar: 'bg-against-500' },
  trust: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30', bar: 'bg-gold' },
}

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'text-against-400', bg: 'bg-against-500/15 border-against-500/30' },
  high: { label: 'High', color: 'text-for-300', bg: 'bg-for-500/15 border-for-500/30' },
  medium: { label: 'Medium', color: 'text-gold', bg: 'bg-gold/15 border-gold/30' },
  low: { label: 'Low', color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/20' },
}

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'text-emerald', dot: 'bg-emerald' },
  medium: { label: 'Medium', color: 'text-gold', dot: 'bg-gold' },
  hard: { label: 'Hard', color: 'text-against-400', dot: 'bg-against-500' },
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({ task, dimId }: { task: GrowthTask; dimId: string }) {
  const colors = DIM_COLORS[dimId] ?? DIM_COLORS.discourse
  const diff = DIFFICULTY_CONFIG[task.difficulty]

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-colors',
      'bg-surface-100 border-surface-300 hover:border-surface-400'
    )}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-white leading-snug">{task.title}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={cn('flex items-center gap-0.5 text-[10px] font-mono', diff.color)}>
            <span className={cn('inline-block w-1.5 h-1.5 rounded-full', diff.dot)} />
            {diff.label}
          </span>
        </div>
      </div>

      <p className="text-xs text-surface-500 leading-relaxed">{task.description}</p>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        {task.estimated_clout > 0 ? (
          <span className="flex items-center gap-1 text-[11px] font-mono text-gold">
            <Coins className="h-3 w-3" />
            +{task.estimated_clout} clout
          </span>
        ) : (
          <span className="text-[11px] font-mono text-surface-600">No direct clout reward</span>
        )}
        <Link
          href={task.action_href}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
            'transition-all duration-150',
            colors.text, colors.bg, 'border', colors.border,
            'hover:opacity-80'
          )}
        >
          {task.action_label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ─── Dimension block ──────────────────────────────────────────────────────────

function DimensionBlock({ dim }: { dim: GrowthDimension }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = DIM_ICONS[dim.id] ?? Star
  const colors = DIM_COLORS[dim.id] ?? DIM_COLORS.discourse
  const priority = PRIORITY_CONFIG[dim.priority]

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-200',
      expanded ? 'border-surface-400 bg-surface-100' : 'border-surface-300 bg-surface-100/60 hover:border-surface-400'
    )}>
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
        aria-label={`${dim.label} — ${dim.pct}% — expand to see tasks`}
      >
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0', colors.bg, 'border', colors.border)}>
          <Icon className={cn('h-4 w-4', colors.text)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{dim.label}</span>
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', priority.bg, priority.color)}>
              {priority.label}
            </span>
          </div>
          {/* Score bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
                style={{ width: `${dim.pct}%` }}
              />
            </div>
            <span className={cn('text-[11px] font-mono tabular-nums flex-shrink-0', colors.text)}>
              {dim.score}/{dim.max_score}
            </span>
          </div>
        </div>

        <ChevronRight className={cn('h-4 w-4 text-surface-500 flex-shrink-0 transition-transform duration-200', expanded && 'rotate-90')} />
      </button>

      {/* Tasks */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2.5">
              <p className={cn('text-xs font-mono mb-3', colors.text)}>
                {dim.tasks.length} task{dim.tasks.length !== 1 ? 's' : ''} to improve this dimension
              </p>
              {dim.tasks.map((task, i) => (
                <TaskCard key={i} task={task} dimId={dim.id} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GrowthPlanSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthPlanPage() {
  const router = useRouter()
  const [data, setData] = useState<GrowthPlanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/growth-plan', { method: 'POST' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load growth plan')
      const json = (await res.json()) as GrowthPlanData
      setData(json)
    } catch {
      setError('Could not load your growth plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link
              href="/analytics"
              className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
              aria-label="Back to Analytics"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/30">
                  <TrendingUp className="h-4 w-4 text-for-400" />
                </div>
                <h1 className="font-mono text-xl font-bold text-white">Civic Growth Plan</h1>
              </div>
              <p className="text-sm text-surface-500 font-mono">
                Your personalised improvement roadmap
              </p>
            </div>
          </div>
          {!loading && (
            <button
              onClick={load}
              aria-label="Refresh growth plan"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-all flex-shrink-0"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>

        {/* Content */}
        {loading && <GrowthPlanSkeleton />}

        {error && (
          <EmptyState
            icon={BarChart2}
            title="Could not load growth plan"
            description={error}
            actions={[{ label: 'Try again', onClick: load }]}
          />
        )}

        {data && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Score + tier hero */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-mono text-surface-500 mb-0.5">Overall Civic Score</p>
                  <div className="flex items-baseline gap-2">
                    <AnimatedNumber
                      value={data.overall_score}
                      className="text-4xl font-mono font-bold text-white"
                    />
                    <span className="text-surface-500 text-lg font-mono">/100</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-surface-500 mb-1">Current Tier</p>
                  <span className={cn('text-lg font-mono font-bold', data.tier_color)}>{data.tier}</span>
                </div>
              </div>

              {/* Overall progress bar */}
              <div>
                <div className="h-2 bg-surface-300 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-for-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.overall_pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] font-mono text-surface-600">Newcomer</span>
                  <span className="text-[10px] font-mono text-surface-600">Civic Champion</span>
                </div>
              </div>

              {/* Strength / opportunity pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald/10 border border-emerald/25 text-xs font-mono text-emerald">
                  <Star className="h-3 w-3" />
                  Strength: {data.top_strength}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-for-500/10 border border-for-500/25 text-xs font-mono text-for-300">
                  <TrendingUp className="h-3 w-3" />
                  Focus: {data.biggest_opportunity}
                </span>
              </div>
            </div>

            {/* Weekly goal */}
            <div className="rounded-xl border border-gold/30 bg-gold/5 p-4 flex items-start gap-3">
              <Sparkles className="h-4 w-4 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-gold mb-1">This Week&apos;s Goal</p>
                <p className="text-sm text-white leading-snug">{data.weekly_goal}</p>
              </div>
            </div>

            {/* Quick stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Votes', value: data.profile.total_votes, icon: ThumbsUp, color: 'text-for-400' },
                { label: 'Arguments', value: data.profile.total_arguments, icon: MessageSquare, color: 'text-purple' },
                {
                  label: 'Streak',
                  value: data.profile.vote_streak,
                  icon: Flame,
                  color: data.profile.vote_streak >= 7 ? 'text-gold' : 'text-against-400',
                  suffix: 'd',
                },
              ].map(({ label, value, icon: Icon, color, suffix }) => (
                <div key={label} className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
                  <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
                  <p className="text-lg font-mono font-bold text-white tabular-nums">
                    {value}{suffix}
                  </p>
                  <p className="text-[10px] font-mono text-surface-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Quick wins */}
            {data.quick_wins.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-mono font-bold text-white">Quick Wins</h2>
                  <span className="text-[10px] font-mono text-surface-500">under 5 minutes each</span>
                </div>
                <div className="space-y-2">
                  {data.quick_wins.map((task, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{task.title}</p>
                        {task.estimated_clout > 0 && (
                          <p className="text-[10px] font-mono text-gold mt-0.5">+{task.estimated_clout} clout</p>
                        )}
                      </div>
                      <Link
                        href={task.action_href}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-for-500/10 border border-for-500/30 text-for-300 hover:bg-for-500/20 transition-all"
                      >
                        {task.action_label}
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dimension breakdown */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="h-4 w-4 text-for-400" />
                <h2 className="text-sm font-mono font-bold text-white">Improvement Plan by Dimension</h2>
              </div>
              <p className="text-xs text-surface-500 font-mono mb-3">
                Tap any dimension to see specific tasks — sorted by most room to improve
              </p>
              <div className="space-y-2">
                {[...data.dimensions]
                  .sort((a, b) => b.gap - a.gap)
                  .map(dim => (
                    <DimensionBlock key={dim.id} dim={dim} />
                  ))}
              </div>
            </div>

            {/* Links to related analytics */}
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <p className="text-xs font-mono text-surface-500 mb-3">Related analytics</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Karma Score', href: '/karma', icon: Star, color: 'text-gold' },
                  { label: 'Civic Advisor', href: '/advisor', icon: Brain, color: 'text-purple' },
                  { label: 'Civic Mentor', href: '/analytics/mentor', icon: BookOpen, color: 'text-for-400' },
                  { label: 'Full Analytics', href: '/analytics', icon: BarChart2, color: 'text-for-300' },
                ].map(({ label, href, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
                    <span className="text-xs font-mono text-surface-400 hover:text-white transition-colors">{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Generated timestamp */}
            <p className="text-center text-[10px] font-mono text-surface-600">
              <Clock className="inline h-2.5 w-2.5 mr-1" />
              Generated {new Date(data.generated_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
              {data.unavailable && ' — AI unavailable, showing smart defaults'}
            </p>

          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
