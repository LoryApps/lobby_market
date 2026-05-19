'use client'

/**
 * /resolutions — Prediction Resolution Feed
 *
 * Shows recently resolved civic predictions: which forecasts came true,
 * which were upset, and who called it correctly. A post-mortem on the
 * collective intelligence of the Lobby.
 *
 * Distinct from:
 *  - /predictions    (your own active/resolved prediction history)
 *  - /forecasters    (all-time accuracy leaderboard)
 *  - /verdicts       (topic outcomes — law/failed — without prediction context)
 *  - /prescient      (personal alignment with platform consensus)
 *
 * This page answers: "what did everyone predict, and were they right?"
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  Gavel,
  RefreshCw,
  Scale,
  Skull,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ResolvedPredictionTopic, ResolutionsStats, ResolutionsResponse } from '@/app/api/predictions/resolutions/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-gold',
}

const WINDOW_TABS = [
  { days: 7,  label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const

const SORT_OPTS = [
  { id: 'surprise',    label: 'Most Surprising' },
  { id: 'predictions', label: 'Most Predicted' },
  { id: 'recent',      label: 'Most Recent' },
] as const

type SortKey = 'surprise' | 'predictions' | 'recent'
type WindowDays = 7 | 30 | 90

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return `${Math.floor(d / 30)}mo ago`
}

function surpriseLabel(score: number): { label: string; color: string } {
  if (score >= 0.6) return { label: 'Major Upset', color: 'text-against-400' }
  if (score >= 0.4) return { label: 'Surprise',    color: 'text-gold' }
  if (score >= 0.25) return { label: 'Close Call',  color: 'text-purple' }
  return { label: 'Called It',  color: 'text-emerald' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SurpriseMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 60 ? 'bg-against-500' :
    pct >= 40 ? 'bg-gold' :
    pct >= 25 ? 'bg-purple' :
    'bg-emerald'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <span className="text-[11px] font-mono text-surface-500 tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  )
}

function ConfidenceBar({
  lawConfidence,
  isLaw,
}: {
  lawConfidence: number
  isLaw: boolean
}) {
  const crowdCorrect =
    (lawConfidence >= 50 && isLaw) || (lawConfidence < 50 && !isLaw)

  return (
    <div className="flex items-center gap-2">
      {/* Against side */}
      <span className={cn('text-[10px] font-mono tabular-nums',
        !isLaw ? 'text-against-400 font-bold' : 'text-surface-500'
      )}>
        {100 - Math.round(lawConfidence)}%
      </span>

      {/* Bar */}
      <div className="flex-1 h-3 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${100 - lawConfidence}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full bg-against-500/60"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${lawConfidence}%` }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
          className="h-full bg-for-500/60"
        />
      </div>

      {/* For side */}
      <span className={cn('text-[10px] font-mono tabular-nums',
        isLaw ? 'text-for-400 font-bold' : 'text-surface-500'
      )}>
        {Math.round(lawConfidence)}%
      </span>

      {/* Correct indicator */}
      {crowdCorrect ? (
        <Check className="h-3 w-3 text-emerald flex-shrink-0" />
      ) : (
        <X className="h-3 w-3 text-against-400 flex-shrink-0" />
      )}
    </div>
  )
}

function TopicCard({ topic }: { topic: ResolvedPredictionTopic }) {
  const [expanded, setExpanded] = useState(false)
  const isLaw = topic.status === 'law'
  const { label: surpriseLbl, color: surpriseColor } = surpriseLabel(topic.surprise_score)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-4 transition-colors cursor-pointer',
        topic.verdict === 'upset'
          ? 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
          : topic.verdict === 'vindicated'
          ? 'bg-emerald/5 border-emerald/20 hover:border-emerald/40'
          : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60'
      )}
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Outcome icon */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border',
          isLaw
            ? 'bg-gold/10 border-gold/30 text-gold'
            : 'bg-against-500/10 border-against-500/30 text-against-400'
        )}>
          {isLaw ? <Gavel className="h-4 w-4" /> : <Skull className="h-4 w-4" />}
        </div>

        <div className="flex-1 min-w-0">
          {/* Statement */}
          <p className="text-sm font-medium text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {topic.category && (
              <span className={cn('text-[11px] font-mono', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                {topic.category}
              </span>
            )}
            <span className="text-[11px] text-surface-500">·</span>
            <span className="text-[11px] text-surface-500">{relTime(topic.resolved_at)}</span>
            <span className="text-[11px] text-surface-500">·</span>
            <span className={cn('text-[11px] font-mono font-semibold', surpriseColor)}>
              {surpriseLbl}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        <ChevronDown className={cn(
          'flex-shrink-0 h-4 w-4 text-surface-500 transition-transform',
          expanded && 'rotate-180'
        )} />
      </div>

      {/* Outcome badge + crowd prediction row */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-100/60 px-3 py-2">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">Outcome</p>
          <div className="flex items-center gap-1.5">
            {isLaw ? (
              <>
                <Gavel className="h-3.5 w-3.5 text-gold" />
                <span className="text-sm font-mono font-bold text-gold">LAW</span>
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5 text-against-400" />
                <span className="text-sm font-mono font-bold text-against-400">FAILED</span>
              </>
            )}
          </div>
        </div>

        <div className="rounded-xl bg-surface-100/60 px-3 py-2">
          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-1">
            Crowd predicted law
          </p>
          <div className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5 text-purple" />
            <span className="text-sm font-mono font-bold text-white">
              {Math.round(topic.law_confidence)}%
            </span>
            <span className="text-[10px] text-surface-500">
              ({topic.total_predictions} forecasters)
            </span>
          </div>
        </div>
      </div>

      {/* Crowd prediction bar */}
      <div className="mt-2.5">
        <p className="text-[10px] font-mono text-surface-500 mb-1.5">
          Crowd confidence → actual vote
        </p>
        <ConfidenceBar lawConfidence={topic.law_confidence} isLaw={isLaw} />
      </div>

      {/* Surprise meter */}
      <div className="mt-2.5">
        <p className="text-[10px] font-mono text-surface-500 mb-1.5">
          Surprise score
        </p>
        <SurpriseMeter score={topic.surprise_score} />
      </div>

      {/* Collective accuracy */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[11px] text-surface-500">Collective accuracy</span>
        <span className={cn(
          'text-[11px] font-mono font-semibold',
          topic.collective_accuracy >= 70 ? 'text-emerald' :
          topic.collective_accuracy >= 50 ? 'text-gold' : 'text-against-400'
        )}>
          {topic.collective_accuracy}%
          <span className="text-surface-500 font-normal ml-1">
            ({topic.correct_count}/{topic.total_predictions} correct)
          </span>
        </span>
      </div>

      {/* Expanded: top forecasters + view topic link */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-3 border-t border-surface-300/60">
              {topic.top_forecasters.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-2">
                    Top Forecasters
                  </p>
                  <div className="flex flex-col gap-2">
                    {topic.top_forecasters.map((f, i) => (
                      <Link
                        key={f.user_id}
                        href={`/profile/${f.username}`}
                        className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-100/60 hover:bg-surface-200/60 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className={cn(
                          'text-[10px] font-mono font-bold w-4 text-center',
                          i === 0 ? 'text-gold' : i === 1 ? 'text-surface-500' : 'text-surface-400'
                        )}>
                          #{i + 1}
                        </span>
                        <Avatar
                          src={f.avatar_url}
                          fallback={f.display_name || f.username}
                          size="xs"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-semibold text-white truncate block">
                            {f.display_name || f.username}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald">
                          {f.confidence}% confident
                        </span>
                        {f.clout_earned > 0 && (
                          <span className="text-[10px] font-mono text-gold">
                            +{f.clout_earned} ⚡
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <Link
                href={`/topic/${topic.topic_id}`}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-200/60 hover:bg-surface-300/60 transition-colors text-xs text-surface-700 hover:text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <span>View full topic</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: string | number
  sublabel?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}) {
  return (
    <div className="rounded-2xl bg-surface-200/60 border border-surface-300/60 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', iconColor)} />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-mono font-bold text-white">{value}</p>
      {sublabel && <p className="text-[11px] text-surface-500 mt-0.5">{sublabel}</p>}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/60 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-3 w-2/3 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResolutionsPage() {
  const [topics, setTopics]   = useState<ResolvedPredictionTopic[]>([])
  const [stats, setStats]     = useState<ResolutionsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [days, setDays]       = useState<WindowDays>(30)
  const [sort, setSort]       = useState<SortKey>('surprise')
  const [category, setCategory] = useState('All')
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (fresh = false) => {
    if (fresh) setRefreshing(true)
    else setLoading(true)

    try {
      const qs = new URLSearchParams({
        days: String(days),
        sort,
        ...(category !== 'All' && { category }),
        limit: '30',
      })
      const res = await fetch(`/api/predictions/resolutions?${qs}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = (await res.json()) as ResolutionsResponse
      setTopics(data.topics)
      setStats(data.stats)
    } catch {
      setTopics([])
      setStats(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [days, sort, category])

  useEffect(() => { load() }, [load])

  // Close sort dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const upsetsCount   = topics.filter((t) => t.verdict === 'upset').length
  const vindicated    = topics.filter((t) => t.verdict === 'vindicated').length
  const currentSort   = SORT_OPTS.find((s) => s.id === sort)!

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Target className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Prediction Resolutions
              </h1>
              <p className="text-sm font-mono text-surface-500">
                What the crowd forecast · what actually happened
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats strip */}
        {stats && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-3 mb-5 sm:grid-cols-4"
          >
            <StatCard
              label="Resolved"
              value={stats.total_resolved}
              sublabel={`last ${stats.window_label}`}
              icon={BarChart2}
              iconColor="text-purple"
            />
            <StatCard
              label="Collective Acc."
              value={`${stats.collective_accuracy_pct}%`}
              sublabel="avg across topics"
              icon={Brain}
              iconColor="text-for-400"
            />
            <StatCard
              label="Upsets"
              value={stats.total_upsets}
              sublabel="crowd was wrong"
              icon={Zap}
              iconColor="text-against-400"
            />
            <StatCard
              label="Avg. Forecasters"
              value={stats.avg_predictions_per_topic}
              sublabel="per topic"
              icon={Users}
              iconColor="text-gold"
            />
          </motion.div>
        )}

        {/* Biggest upset call-out */}
        {stats?.biggest_upset && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3.5 rounded-2xl bg-against-500/5 border border-against-500/20"
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-against-400" />
              <span className="text-xs font-mono font-bold text-against-400 uppercase tracking-wide">
                Biggest Upset
              </span>
            </div>
            <p className="text-sm text-white leading-snug line-clamp-2">
              {stats.biggest_upset.statement}
            </p>
            <p className="text-[11px] font-mono text-against-400 mt-1">
              {Math.round(stats.biggest_upset.surprise_score * 100)}% surprise score
            </p>
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {/* Window tabs */}
          <div className="flex items-center bg-surface-200/60 border border-surface-300/60 rounded-xl p-1 gap-0.5">
            {WINDOW_TABS.map((tab) => (
              <button
                key={tab.days}
                onClick={() => setDays(tab.days as WindowDays)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-mono transition-colors',
                  days === tab.days
                    ? 'bg-purple/20 text-purple font-semibold'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div ref={sortRef} className="relative">
            <button
              onClick={() => setShowSortMenu((s) => !s)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              {currentSort.label}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showSortMenu && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  className="absolute top-full left-0 mt-1 z-30 min-w-[160px] rounded-xl bg-surface-100 border border-surface-300/80 shadow-xl overflow-hidden"
                >
                  {SORT_OPTS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setSort(opt.id); setShowSortMenu(false) }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 text-xs font-mono transition-colors',
                        sort === opt.id
                          ? 'text-purple bg-purple/10'
                          : 'text-surface-600 hover:text-white hover:bg-surface-200'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refresh */}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-200/60 border border-surface-300/60 text-xs font-mono text-surface-600 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-mono border transition-colors',
                category === cat
                  ? 'bg-purple/20 border-purple/50 text-purple font-semibold'
                  : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Verdict summary pills */}
        {!loading && topics.length > 0 && (
          <div className="flex items-center gap-3 mb-5 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-emerald">
              <Check className="h-3.5 w-3.5" />
              {vindicated} vindicated
            </span>
            <span className="text-surface-500">·</span>
            <span className="flex items-center gap-1.5 text-against-400">
              <Zap className="h-3.5 w-3.5" />
              {upsetsCount} upset{upsetsCount !== 1 ? 's' : ''}
            </span>
            <span className="text-surface-500">·</span>
            <span className="flex items-center gap-1.5 text-surface-500">
              <Scale className="h-3.5 w-3.5" />
              {topics.filter((t) => t.verdict === 'split').length} splits
            </span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No resolved predictions yet"
            description="As topics with predictions resolve, they'll appear here. Try a longer time window or removing category filters."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {topics.map((topic, i) => (
                <motion.div
                  key={topic.topic_id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <TopicCard topic={topic} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer links */}
        {!loading && (
          <div className="mt-8 flex flex-col gap-2">
            <Link
              href="/predictions"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Target className="h-4 w-4 text-purple" />
                <span className="text-sm font-mono text-surface-600 group-hover:text-white">
                  Make predictions
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-500" />
            </Link>
            <Link
              href="/forecasters"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Award className="h-4 w-4 text-gold" />
                <span className="text-sm font-mono text-surface-600 group-hover:text-white">
                  Forecaster leaderboard
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-500" />
            </Link>
            <Link
              href="/verdicts"
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Gavel className="h-4 w-4 text-for-400" />
                <span className="text-sm font-mono text-surface-600 group-hover:text-white">
                  All verdicts
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-surface-500" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
