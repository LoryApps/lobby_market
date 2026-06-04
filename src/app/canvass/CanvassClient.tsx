'use client'

/**
 * /canvass — The Civic Canvass
 *
 * Shows which high-engagement topics you haven't voted on yet, grouped by
 * category. A personalised "gaps in your civic record" discovery tool.
 *
 * Distinct from:
 *   /recommended     — algorithmically ranked personalised feed
 *   /swipe           — card-by-card voting interface
 *   /lighthouse      — neglected debates needing any vote
 *   /topics          — all-topics browser (no personalisation)
 *
 * This is the only view showing YOUR specific blind spots —
 * popular debates the community has weighed in on, but you haven't.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Check,
  ChevronDown,
  ChevronRight,
  Cpu,
  DollarSign,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Lightbulb,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Sparkles,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type { CanvassResponse, CanvassTopic, CategoryStat } from '@/app/api/canvass/route'

// ─── Constants ────────────────────────────────────────────────────────────────

type Category = string | null

const CATEGORY_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }
> = {
  Economics:   { icon: DollarSign,    color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30'          },
  Politics:    { icon: Landmark,      color: 'text-for-400',       bg: 'bg-for-500/10',       border: 'border-for-500/30'       },
  Technology:  { icon: Cpu,           color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30'        },
  Science:     { icon: FlaskConical,  color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
  Ethics:      { icon: Scale,         color: 'text-for-300',       bg: 'bg-for-400/10',       border: 'border-for-400/30'       },
  Philosophy:  { icon: Lightbulb,     color: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30'        },
  Culture:     { icon: Music2,        color: 'text-against-400',   bg: 'bg-against-500/10',   border: 'border-against-500/30'   },
  Health:      { icon: Heart,         color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
  Education:   { icon: GraduationCap, color: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30'          },
  Environment: { icon: Leaf,          color: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30'       },
}

function getCatConfig(cat: string) {
  return (
    CATEGORY_CONFIG[cat] ?? {
      icon: Sparkles,
      color: 'text-surface-500',
      bg: 'bg-surface-200',
      border: 'border-surface-300',
    }
  )
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; text: string }
> = {
  active:   { label: 'Active',   dot: 'bg-for-500',       text: 'text-for-400'     },
  voting:   { label: 'Voting',   dot: 'bg-purple',        text: 'text-purple'      },
  proposed: { label: 'Proposed', dot: 'bg-surface-500',   text: 'text-surface-500' },
}

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

// ─── Progress ring ────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const fill = (pct / 100) * circ

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        className="text-surface-300"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={4}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        className="text-emerald transition-all duration-700"
      />
    </svg>
  )
}

// ─── Category pill ────────────────────────────────────────────────────────────

function CategoryPill({
  stat,
  active,
  onClick,
}: {
  stat: CategoryStat
  active: boolean
  onClick: () => void
}) {
  const cfg = getCatConfig(stat.category)
  const Icon = cfg.icon
  const completionPct =
    stat.total > 0 ? Math.round((stat.voted / stat.total) * 100) : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
        active
          ? `${cfg.bg} ${cfg.border} ${cfg.color}`
          : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-700',
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{stat.category}</span>
      {stat.unvoted > 0 && (
        <span
          className={cn(
            'ml-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
            active
              ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
              : 'bg-surface-200 text-surface-500 border border-surface-300',
          )}
        >
          {stat.unvoted}
        </span>
      )}
      {stat.unvoted === 0 && (
        <Check className="h-3 w-3 text-emerald flex-shrink-0" />
      )}
      {completionPct > 0 && stat.unvoted > 0 && (
        <span className="text-[10px] opacity-60">{completionPct}%</span>
      )}
    </button>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic, rank }: { topic: CanvassTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const agnPct = 100 - forPct
  const st = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const catCfg = getCatConfig(topic.category ?? '')

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.04, duration: 0.3 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className={cn(
          'group flex flex-col gap-3 p-4 rounded-2xl',
          'bg-surface-100 border border-surface-300',
          'hover:border-surface-400 hover:bg-surface-150 transition-all',
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          {/* Rank */}
          <span className="text-xs font-mono text-surface-500 w-6 flex-shrink-0 pt-0.5">
            {rank + 1}
          </span>

          {/* Statement */}
          <p className="flex-1 text-sm font-semibold text-surface-800 leading-snug line-clamp-2 group-hover:text-white transition-colors">
            {topic.statement}
          </p>

          <ArrowRight className="h-4 w-4 text-surface-400 group-hover:text-surface-600 flex-shrink-0 transition-colors mt-0.5" />
        </div>

        {/* Vote bar */}
        <div className="ml-9">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-for-400">{forPct}%</span>
            <span className="text-surface-500">{fmtVotes(topic.total_votes)} votes</span>
            <span className="font-bold text-against-400">{agnPct}%</span>
          </div>
          <div className="h-1 bg-surface-300 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-for-700 to-for-400 rounded-full"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="h-full bg-gradient-to-l from-against-700 to-against-400 rounded-full ml-auto"
              style={{ width: `${agnPct}%` }}
            />
          </div>
        </div>

        {/* Footer meta */}
        <div className="ml-9 flex items-center gap-3">
          {/* Status */}
          <div className="flex items-center gap-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', st.dot)} />
            <span className={cn('text-[11px] font-medium', st.text)}>{st.label}</span>
          </div>

          {/* Category */}
          {topic.category && (
            <span className={cn('text-[11px] font-medium', catCfg.color)}>
              {topic.category}
            </span>
          )}

          {/* Arguments */}
          {topic.total_arguments > 0 && (
            <div className="flex items-center gap-1 text-surface-500">
              <MessageSquare className="h-3 w-3" />
              <span className="text-[11px]">{fmtVotes(topic.total_arguments)}</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
      <div className="flex items-start gap-3">
        <Skeleton className="h-3 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
      <div className="ml-9 space-y-1.5">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-10" />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CanvassClient() {
  const [data, setData] = useState<CanvassResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeCategory, setActiveCategory] = useState<Category>(null)
  const [showAllCategories, setShowAllCategories] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    async (cat: Category, isRefresh = false) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      try {
        const params = new URLSearchParams({ limit: '40' })
        if (cat) params.set('category', cat)

        const res = await fetch(`/api/canvass?${params}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`${res.status}`)
        const json: CanvassResponse = await res.json()
        setData(json)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error('[canvass]', e)
        }
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(activeCategory)
  }, [activeCategory, load])

  function handleRefresh() {
    load(activeCategory, true)
  }

  const stats = data?.stats
  const topics = data?.topics ?? []
  const catBreakdown = stats?.category_breakdown ?? []

  // Limit category pills to top 6 unless expanded
  const visibleCats = showAllCategories ? catBreakdown : catBreakdown.slice(0, 6)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12">
        {/* ── Back link ──────────────────────────────────────────────── */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-5 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Back
        </Link>

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-1">
              Civic Canvass
            </h1>
            <p className="text-sm text-surface-500 max-w-sm">
              High-engagement topics you haven&rsquo;t weighed in on yet. Close
              the gaps in your civic record.
            </p>
          </div>

          {/* Progress ring */}
          {stats && (
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <div className="relative w-20 h-20">
                <ProgressRing pct={stats.completion_pct} size={80} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-white">
                    {stats.completion_pct}%
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-surface-500 font-medium text-center leading-tight">
                Voted
              </span>
            </div>
          )}
        </div>

        {/* ── Stats strip ────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center">
              <div className="text-xl font-black text-emerald">
                <AnimatedNumber value={stats.voted_count} />
              </div>
              <div className="text-[10px] text-surface-500 font-medium mt-0.5">Voted</div>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center">
              <div className="text-xl font-black text-gold">
                <AnimatedNumber value={stats.unvoted_count} />
              </div>
              <div className="text-[10px] text-surface-500 font-medium mt-0.5">To Vote</div>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-3 text-center">
              <div className="text-xl font-black text-white">
                <AnimatedNumber value={stats.total_active} />
              </div>
              <div className="text-[10px] text-surface-500 font-medium mt-0.5">Total Active</div>
            </div>
          </div>
        )}

        {/* ── Unauthenticated notice ──────────────────────────────────── */}
        {data && !data.authenticated && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-for-500/10 border border-for-500/30 mb-5">
            <Sparkles className="h-4 w-4 text-for-400 flex-shrink-0" />
            <p className="text-sm text-for-300">
              <Link href="/auth/sign-in" className="font-semibold hover:underline">
                Sign in
              </Link>{' '}
              to see which topics you&rsquo;ve missed — your personal civic gaps.
            </p>
          </div>
        )}

        {/* ── Category filters ────────────────────────────────────────── */}
        {catBreakdown.length > 0 && (
          <div className="mb-5">
            <div className="flex flex-wrap gap-2">
              {/* All pill */}
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all',
                  activeCategory === null
                    ? 'bg-white/10 border-surface-400 text-white'
                    : 'bg-surface-100 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-700',
                )}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                All
                {stats?.unvoted_count != null && (
                  <span className="ml-0.5 text-[10px] font-bold bg-surface-200 border border-surface-300 px-1 py-0.5 rounded-full text-surface-500">
                    {stats.unvoted_count}
                  </span>
                )}
              </button>

              {visibleCats.map((stat) => (
                <CategoryPill
                  key={stat.category}
                  stat={stat}
                  active={activeCategory === stat.category}
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === stat.category
                        ? null
                        : (stat.category as Category),
                    )
                  }
                />
              ))}

              {catBreakdown.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((v) => !v)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border border-surface-300 bg-surface-100 text-sm text-surface-500 hover:text-surface-700 transition-colors"
                >
                  {showAllCategories ? 'Less' : `+${catBreakdown.length - 6} more`}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      showAllCategories && 'rotate-180',
                    )}
                  />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Refresh button ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-surface-600">
            {activeCategory ? `${activeCategory} · ` : ''}
            {loading ? (
              <span className="text-surface-400">Loading&hellip;</span>
            ) : (
              <span>
                {topics.length} unvoted topic{topics.length !== 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Topic list ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
          ) : topics.length === 0 ? (
            <EmptyState
              icon={Check}
              title={
                activeCategory
                  ? `All ${activeCategory} topics voted`
                  : 'All caught up!'
              }
              description={
                activeCategory
                  ? `You've voted on every ${activeCategory} topic currently active.`
                  : "You've voted on all active topics. Check back as new debates are proposed."
              }
              actions={
                activeCategory
                  ? [{ label: 'View all categories', onClick: () => setActiveCategory(null) }]
                  : [{ label: 'Browse all topics', href: '/topics' }]
              }
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {topics.map((topic, i) => (
                <TopicRow key={topic.id} topic={topic} rank={i} />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* ── Footer nudge ────────────────────────────────────────────── */}
        {!loading && topics.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-surface-500">
              Keep going — each vote shapes the Lobby&rsquo;s consensus.
            </p>
            <Link
              href="/swipe"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-for-400 text-sm font-semibold hover:bg-for-500/20 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Swipe &amp; Vote
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
