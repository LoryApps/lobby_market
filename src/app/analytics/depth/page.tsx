'use client'

/**
 * /analytics/depth — Civic Depth Score
 *
 * Measures how deeply you engage with topics beyond just casting a vote.
 * For each voted topic, depth actions are: argued, predicted, bookmarked,
 * subscribed. A weighted composite produces the 0–100 Civic Depth Score.
 *
 * Distinct from:
 *   /analytics/arguments  — argument performance (grades, arena)
 *   /analytics/votes      — raw voting history
 *   /analytics/benchmark  — comparison to your join cohort
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  Bookmark,
  Brain,
  ChevronRight,
  ExternalLink,
  Gavel,
  Layers,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { DepthAnalyticsResponse, DepthCategoryStat, DepthTopic } from '@/app/api/analytics/depth/route'

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIERS: Array<{
  key: keyof Pick<DepthAnalyticsResponse, 'tier_surface' | 'tier_engaged' | 'tier_deep' | 'tier_expert'>
  label: string
  description: string
  color: string
  bg: string
  border: string
  icon: typeof Zap
  points: string
}> = [
  {
    key: 'tier_surface',
    label: 'Surface',
    description: 'Voted only',
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/30',
    icon: ThumbsUp,
    points: '1 action',
  },
  {
    key: 'tier_engaged',
    label: 'Engaged',
    description: 'Voted + 1 more',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    icon: Zap,
    points: '2 actions',
  },
  {
    key: 'tier_deep',
    label: 'Deep',
    description: 'Voted + 2 more',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/20',
    icon: Brain,
    points: '3 actions',
  },
  {
    key: 'tier_expert',
    label: 'Expert',
    description: 'Voted + 3+ more',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    icon: Sparkles,
    points: '4 actions',
  },
]

// ─── Category color map ───────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}
function catColor(c: string) { return CAT_COLOR[c] ?? 'text-surface-400' }

// ─── Score label ──────────────────────────────────────────────────────────────

function depthLabel(score: number): { label: string; color: string; desc: string } {
  if (score >= 80) return { label: 'Expert Engager', color: 'text-gold', desc: 'You go far beyond the vote on most topics.' }
  if (score >= 55) return { label: 'Deep Thinker', color: 'text-purple', desc: 'You regularly argue your case and track outcomes.' }
  if (score >= 30) return { label: 'Active Citizen', color: 'text-for-400', desc: 'You engage meaningfully with many debates.' }
  if (score >= 10) return { label: 'Voter', color: 'text-surface-400', desc: 'Mostly voting — try arguing your next position.' }
  return { label: 'Newcomer', color: 'text-surface-500', desc: 'Cast your first votes and start engaging deeply.' }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, iconColor, iconBg, animateValue,
}: {
  label: string
  value: string | number
  icon: typeof Zap
  iconColor: string
  iconBg: string
  animateValue?: number
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
      </div>
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ─── Depth gauge ──────────────────────────────────────────────────────────────

function DepthGauge({ score }: { score: number }) {
  const { label, color, desc } = depthLabel(score)
  const barColor =
    score >= 80 ? 'bg-gold'
    : score >= 55 ? 'bg-purple'
    : score >= 30 ? 'bg-for-500'
    : 'bg-surface-400'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center">
            <Layers className="h-5 w-5 text-purple" />
          </div>
          <div>
            <p className="font-mono text-sm font-semibold text-white">Civic Depth Score</p>
            <p className="text-[11px] font-mono text-surface-500">Engagement beyond the vote</p>
          </div>
        </div>
        <span className={cn('font-mono text-2xl font-bold tabular-nums', color)}>{score}</span>
      </div>
      <div className="h-3 rounded-full bg-surface-300/30 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] font-mono text-surface-600">Newcomer</span>
        <span className={cn('text-[11px] font-mono font-semibold', color)}>{label}</span>
        <span className="text-[10px] font-mono text-surface-600">Expert</span>
      </div>
      <p className="text-xs font-mono text-surface-500 mt-3 leading-relaxed">{desc}</p>
    </div>
  )
}

// ─── Tier distribution bar ────────────────────────────────────────────────────

function TierBreakdown({ data }: { data: DepthAnalyticsResponse }) {
  const total = data.total_voted
  if (total === 0) return null

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center">
          <BarChart2 className="h-5 w-5 text-for-400" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Engagement Tiers</p>
          <p className="text-[11px] font-mono text-surface-500">How deeply you engage across {total} voted topics</p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden mb-4 gap-px">
        {TIERS.map((tier) => {
          const count = data[tier.key]
          const pct = total > 0 ? (count / total) * 100 : 0
          if (pct === 0) return null
          const fill =
            tier.key === 'tier_surface' ? 'bg-surface-400'
            : tier.key === 'tier_engaged' ? 'bg-for-500'
            : tier.key === 'tier_deep' ? 'bg-purple'
            : 'bg-gold'
          return (
            <motion.div
              key={tier.key}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', fill)}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            />
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TIERS.map((tier) => {
          const count = data[tier.key]
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          const Icon = tier.icon
          return (
            <div
              key={tier.key}
              className={cn(
                'flex items-center gap-2.5 rounded-lg p-3',
                'border transition-colors',
                tier.bg, tier.border
              )}
            >
              <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', tier.color)} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('text-xs font-mono font-bold', tier.color)}>{tier.label}</span>
                  <span className="text-[10px] font-mono text-surface-500">{pct}%</span>
                </div>
                <p className="text-[10px] font-mono text-surface-600 truncate">{tier.description}</p>
              </div>
              <span className={cn('ml-auto text-sm font-mono font-bold tabular-nums flex-shrink-0', tier.color)}>
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Action breakdown ─────────────────────────────────────────────────────────

function ActionBreakdown({ data }: { data: DepthAnalyticsResponse }) {
  const total = data.total_voted
  if (total === 0) return null

  const actions = [
    {
      label: 'Argued',
      count: data.total_argued,
      icon: MessageSquare,
      color: 'text-for-400',
      bg: 'bg-for-500/10',
      border: 'border-for-500/20',
      desc: 'Posted a FOR or AGAINST argument',
      href: '/arguments/mine',
    },
    {
      label: 'Predicted',
      count: data.total_predicted,
      icon: Target,
      color: 'text-purple',
      bg: 'bg-purple/10',
      border: 'border-purple/20',
      desc: 'Staked a prediction on the outcome',
      href: '/predictions',
    },
    {
      label: 'Bookmarked',
      count: data.total_bookmarked,
      icon: Bookmark,
      color: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/20',
      desc: 'Saved for reference later',
      href: '/saved',
    },
    {
      label: 'Subscribed',
      count: data.total_subscribed,
      icon: TrendingUp,
      color: 'text-emerald',
      bg: 'bg-emerald/10',
      border: 'border-emerald/20',
      desc: 'Following status updates',
      href: '/following',
    },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-emerald/10 border border-emerald/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-emerald" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Action Breakdown</p>
          <p className="text-[11px] font-mono text-surface-500">Out of {total.toLocaleString()} voted topics</p>
        </div>
      </div>
      <div className="space-y-2.5">
        {actions.map((a) => {
          const pct = total > 0 ? Math.round((a.count / total) * 100) : 0
          const Icon = a.icon
          return (
            <Link
              key={a.label}
              href={a.href}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                'hover:border-surface-400/60 hover:bg-surface-200/60',
                a.bg, a.border
              )}
            >
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', a.bg, a.border, 'border')}>
                <Icon className={cn('h-4 w-4', a.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-xs font-mono font-semibold', a.color)}>{a.label}</span>
                  <span className={cn('text-xs font-mono font-bold tabular-nums', a.color)}>
                    {a.count.toLocaleString()} <span className="text-surface-500 font-normal">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-300/30 overflow-hidden">
                  <motion.div
                    className={cn('h-full rounded-full', a.bg.replace('/10', '/80'))}
                    style={{ backgroundColor: undefined }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
                  />
                </div>
                <p className="text-[10px] font-mono text-surface-600 mt-1">{a.desc}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-surface-600 flex-shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Category depth table ─────────────────────────────────────────────────────

function CategoryDepthTable({ categories }: { categories: DepthCategoryStat[] }) {
  if (categories.length === 0) return null

  const barColor = (score: number) =>
    score >= 60 ? 'bg-gold'
    : score >= 35 ? 'bg-purple'
    : score >= 15 ? 'bg-for-500'
    : 'bg-surface-400'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
          <Brain className="h-5 w-5 text-gold" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Depth by Category</p>
          <p className="text-[11px] font-mono text-surface-500">Where you engage most deeply</p>
        </div>
      </div>
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.category} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className={cn('text-xs font-mono font-semibold', catColor(cat.category))}>
                {cat.category}
              </span>
              <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500">
                <span>{cat.voted} voted</span>
                {cat.argued > 0 && <span className="text-for-400">{cat.argued} argued</span>}
                {cat.predicted > 0 && <span className="text-purple">{cat.predicted} predicted</span>}
                <span className={cn('font-bold', catColor(cat.category))}>{cat.depth_score}</span>
              </div>
            </div>
            <div className="h-2 rounded-full bg-surface-300/30 overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full opacity-80', barColor(cat.depth_score))}
                initial={{ width: 0 }}
                animate={{ width: `${cat.depth_score}%` }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Top engaged topics ───────────────────────────────────────────────────────

function TopTopics({ topics }: { topics: DepthTopic[] }) {
  if (topics.length === 0) return null

  function statusIcon(s: string) {
    if (s === 'law') return <Gavel className="h-3 w-3 text-gold" />
    if (s === 'active' || s === 'voting') return <Zap className="h-3 w-3 text-for-400" />
    return <Scale className="h-3 w-3 text-surface-500" />
  }

  const badgeVariant = (s: string): 'proposed' | 'active' | 'law' | 'failed' =>
    s === 'law' ? 'law' : s === 'active' || s === 'voting' ? 'active' : s === 'failed' ? 'failed' : 'proposed'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="h-9 w-9 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-purple" />
        </div>
        <div>
          <p className="font-mono text-sm font-semibold text-white">Most Engaged Topics</p>
          <p className="text-[11px] font-mono text-surface-500">Where you went deepest</p>
        </div>
      </div>
      <div className="space-y-2">
        {topics.map((topic) => (
          <Link
            key={topic.id}
            href={`/topic/${topic.id}`}
            className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/40 border border-surface-300/40 hover:border-surface-400/60 hover:bg-surface-200/60 transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge variant={badgeVariant(topic.status)} className="text-[10px] px-1.5 py-0 inline-flex items-center gap-0.5">
                  {statusIcon(topic.status)}
                  {topic.status === 'law' ? 'LAW' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
                </Badge>
                {topic.category && (
                  <span className={cn('text-[10px] font-mono', catColor(topic.category))}>
                    {topic.category}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                {topic.statement}
              </p>
              {/* Action indicators */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="flex items-center gap-0.5 text-[10px] font-mono text-for-400">
                  <ThumbsUp className="h-2.5 w-2.5" />
                  {Math.round(topic.blue_pct)}%
                </span>
                <span className="text-[10px] font-mono text-surface-600">
                  {topic.total_votes.toLocaleString()} votes
                </span>
                {topic.argued && (
                  <span className="flex items-center gap-0.5 text-[10px] font-mono text-for-400">
                    <MessageSquare className="h-2.5 w-2.5" /> argued
                  </span>
                )}
                {topic.predicted && (
                  <span className="flex items-center gap-0.5 text-[10px] font-mono text-purple">
                    <Target className="h-2.5 w-2.5" /> predicted
                  </span>
                )}
                {topic.bookmarked && (
                  <span className="flex items-center gap-0.5 text-[10px] font-mono text-gold">
                    <Bookmark className="h-2.5 w-2.5" /> saved
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <span className={cn(
                'text-sm font-mono font-bold tabular-nums',
                topic.depth_points === 4 ? 'text-gold'
                  : topic.depth_points === 3 ? 'text-purple'
                  : topic.depth_points === 2 ? 'text-for-400'
                  : 'text-surface-500'
              )}>
                {topic.depth_points}
              </span>
              <span className="text-[9px] font-mono text-surface-600 uppercase tracking-wide">depth</span>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DepthAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<DepthAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const res = await fetch('/api/analytics/depth', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load depth analytics')
      const json = (await res.json()) as DepthAnalyticsResponse
      setData(json)
    } catch {
      setError('Could not load analytics. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href="/analytics"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Analytics
          </Link>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-purple/10 border border-purple/20 flex items-center justify-center flex-shrink-0">
              <Layers className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="text-lg font-mono font-bold text-white">Civic Depth</h1>
              <p className="text-xs font-mono text-surface-500">How deeply you engage beyond the vote</p>
            </div>
          </div>
          <p className="text-xs font-mono text-surface-600 leading-relaxed mt-2">
            Voting is just the start. Arguing your position, predicting outcomes,
            bookmarking debates, and subscribing to updates all signal deeper civic engagement.
            Your Civic Depth Score rewards this comprehensive participation.
          </p>
        </div>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 p-3 rounded-xl bg-against-600/10 border border-against-600/30 text-xs font-mono text-against-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 h-28">
                  <Skeleton className="h-8 w-8 rounded-lg mb-3" />
                  <Skeleton className="h-6 w-16 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-52 rounded-2xl" />
          </div>
        ) : !data ? null : data.total_voted === 0 ? (
          <EmptyState
            icon={Layers}
            title="No votes yet"
            description="Start voting on topics to build your Civic Depth profile."
            action={{ label: 'Browse topics', href: '/' }}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                label="Topics Voted"
                value={data.total_voted}
                animateValue={data.total_voted}
                icon={ThumbsUp}
                iconColor="text-for-400"
                iconBg="bg-for-500/10"
              />
              <StatCard
                label="Times Argued"
                value={data.total_argued}
                animateValue={data.total_argued}
                icon={MessageSquare}
                iconColor="text-for-400"
                iconBg="bg-for-500/10"
              />
              <StatCard
                label="Predictions"
                value={data.total_predicted}
                animateValue={data.total_predicted}
                icon={Target}
                iconColor="text-purple"
                iconBg="bg-purple/10"
              />
              <StatCard
                label="Depth Score"
                value={data.depth_score}
                animateValue={data.depth_score}
                icon={Layers}
                iconColor="text-purple"
                iconBg="bg-purple/10"
              />
            </div>

            {/* Depth gauge */}
            <DepthGauge score={data.depth_score} />

            {/* Tier breakdown */}
            <TierBreakdown data={data} />

            {/* Action breakdown */}
            <ActionBreakdown data={data} />

            {/* Category depth */}
            {data.by_category.length > 0 && (
              <CategoryDepthTable categories={data.by_category} />
            )}

            {/* Top deeply-engaged topics */}
            {data.top_topics.length > 0 && (
              <TopTopics topics={data.top_topics} />
            )}

            {/* CTA to go deeper */}
            {data.depth_score < 30 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl border border-for-500/20 bg-for-500/5 p-5 text-center"
              >
                <Sparkles className="h-5 w-5 text-for-400 mx-auto mb-2" />
                <p className="text-sm font-mono font-semibold text-white mb-1">
                  Go deeper on your next vote
                </p>
                <p className="text-xs font-mono text-surface-500 mb-4 leading-relaxed">
                  After voting, post a FOR or AGAINST argument to raise your depth score.
                  It only takes one sentence.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-xs font-mono font-semibold transition-colors"
                >
                  Browse debates
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
            )}
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
