'use client'

/**
 * /analytics/engagement — Civic Engagement Depth
 *
 * Shows how BROADLY and DEEPLY a user interacts with the platform —
 * not just votes, but arguments, replies, reactions, bookmarks, wiki
 * edits, predictions, debate messages, and more.
 *
 * Distinct from:
 *   /analytics/votes       — vote history list
 *   /analytics/arguments   — argument portfolio
 *   /analytics/threads     — reply thread stats
 *   /analytics/growth      — participation rate over time
 *   /analytics/discourse   — platform-wide quality
 *
 * This is the only page answering: "How multi-dimensionally do you engage?"
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Bookmark,
  BookOpen,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  FolderOpen,
  Heart,
  Layers,
  Mic,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  EngagementData,
  EngagementAction,
  EngagementTopic,
} from '@/app/api/analytics/engagement/route'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, typeof Activity> = {
  ThumbsUp:     ThumbsUp,
  BookOpen:     BookOpen,
  MessageSquare: MessageSquare,
  ChevronUp:    ChevronUp,
  Target:       Target,
  Mic:          Mic,
  Heart:        Heart,
  Zap:          Zap,
  TrendingUp:   TrendingUp,
  Bookmark:     Bookmark,
  FolderOpen:   FolderOpen,
}

// ─── Color map (icon + bar colors) ───────────────────────────────────────────

const COLOR_MAP: Record<string, { text: string; bg: string; bar: string }> = {
  'for-400':     { text: 'text-for-400',     bg: 'bg-for-500/10',      bar: 'bg-for-500' },
  'for-300':     { text: 'text-for-300',     bg: 'bg-for-500/10',      bar: 'bg-for-400' },
  'for-500':     { text: 'text-for-500',     bg: 'bg-for-500/10',      bar: 'bg-for-500' },
  'purple':      { text: 'text-purple',      bg: 'bg-purple/10',       bar: 'bg-purple' },
  'emerald':     { text: 'text-emerald',     bg: 'bg-emerald/10',      bar: 'bg-emerald' },
  'gold':        { text: 'text-gold',        bg: 'bg-gold/10',         bar: 'bg-gold' },
  'against-400': { text: 'text-against-400', bg: 'bg-against-500/10',  bar: 'bg-against-500' },
  'against-300': { text: 'text-against-300', bg: 'bg-against-500/10',  bar: 'bg-against-400' },
}

// ─── Depth label styles ───────────────────────────────────────────────────────

const DEPTH_STYLE: Record<string, { text: string; bg: string; border: string; ring: string }> = {
  Lurker:      { text: 'text-surface-500',  bg: 'bg-surface-300/40',    border: 'border-surface-400',    ring: 'ring-surface-400/20' },
  Observer:    { text: 'text-for-400',      bg: 'bg-for-500/10',        border: 'border-for-500/40',     ring: 'ring-for-500/20' },
  Participant: { text: 'text-gold',         bg: 'bg-gold/10',           border: 'border-gold/40',        ring: 'ring-gold/20' },
  Contributor: { text: 'text-emerald',      bg: 'bg-emerald/10',        border: 'border-emerald/40',     ring: 'ring-emerald/20' },
  Champion:    { text: 'text-purple',       bg: 'bg-purple/10',         border: 'border-purple/40',      ring: 'ring-purple/20' },
}

// ─── Action type badge colors ─────────────────────────────────────────────────

const ACTION_BADGE: Record<string, string> = {
  vote:     'bg-for-500/20 text-for-300 border-for-500/30',
  argument: 'bg-purple/20 text-purple border-purple/30',
  reply:    'bg-emerald/20 text-emerald border-emerald/30',
  react:    'bg-against-500/20 text-against-300 border-against-500/30',
  bookmark: 'bg-gold/20 text-gold border-gold/30',
}

const ACTION_LABEL: Record<string, string> = {
  vote:     'Voted',
  argument: 'Argued',
  reply:    'Replied',
  react:    'Reacted',
  bookmark: 'Saved',
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-4 px-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

// ─── Engagement Depth Ring ────────────────────────────────────────────────────

function DepthRing({ score, label }: { score: number; label: string }) {
  const style = DEPTH_STYLE[label] ?? DEPTH_STYLE.Observer
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-surface-300" />
          <motion.circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            className={cn(
              label === 'Champion'   ? 'text-purple'
              : label === 'Contributor' ? 'text-emerald'
              : label === 'Participant' ? 'text-gold'
              : label === 'Observer'    ? 'text-for-400'
              : 'text-surface-500'
            )}
          />
        </svg>
        <div className="text-center z-10">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className={cn('text-3xl font-mono font-bold', style.text)}
          >
            {score}
          </motion.span>
          <p className="text-[10px] text-surface-500 font-mono">/ 100</p>
        </div>
      </div>
      <span
        className={cn(
          'px-3 py-1 rounded-full text-xs font-mono font-semibold border',
          style.text, style.bg, style.border
        )}
      >
        {label}
      </span>
    </div>
  )
}

// ─── Action Bar ───────────────────────────────────────────────────────────────

function ActionBar({ action, maxCount }: { action: EngagementAction; maxCount: number }) {
  const Icon = ICON_MAP[action.icon] ?? Activity
  const colors = COLOR_MAP[action.color] ?? COLOR_MAP['for-400']
  const pct = maxCount > 0 ? (action.count / maxCount) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <div className={cn('flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center', colors.bg)}>
        <Icon className={cn('h-3.5 w-3.5', colors.text)} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-surface-600 font-mono truncate">{action.label}</span>
          <span className={cn('text-xs font-mono font-semibold flex-shrink-0 ml-2', colors.text)}>
            {action.count.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', colors.bar)}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Topic Engagement Card ────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: EngagementTopic }) {
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 px-4 py-3.5 hover:bg-surface-200/50 transition-colors"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center mt-0.5">
        <Layers className="h-3.5 w-3.5 text-for-400" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium leading-snug line-clamp-2">{topic.statement}</p>
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {topic.action_types.map((type) => (
            <span
              key={type}
              className={cn(
                'px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border',
                ACTION_BADGE[type] ?? 'bg-surface-300 text-surface-600 border-surface-400'
              )}
            >
              {ACTION_LABEL[type] ?? type}
            </span>
          ))}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-1" aria-hidden />
    </Link>
  )
}

// ─── Funnel Bar ───────────────────────────────────────────────────────────────

function FunnelRow({
  label,
  count,
  max,
  color,
  href,
}: {
  label: string
  count: number
  max: number
  color: string
  href: string
}) {
  const pct = max > 0 ? Math.min(100, (count / max) * 100) : 0
  return (
    <Link href={href} className="flex items-center gap-3 group hover:bg-surface-200/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors">
      <div className="w-28 flex-shrink-0">
        <p className="text-xs text-surface-500 font-mono group-hover:text-surface-400 transition-colors">{label}</p>
      </div>
      <div className="flex-1 h-2 bg-surface-300 rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono font-semibold text-white flex-shrink-0 w-10 text-right">
        {count.toLocaleString()}
      </span>
    </Link>
  )
}

// ─── Weekly sparkline ─────────────────────────────────────────────────────────

function WeeklySparkline({ data }: { data: Array<{ week: string; actions: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.actions))
  const W = 280
  const H = 56
  if (data.length < 2) return null

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (d.actions / max) * H
    return `${x},${y}`
  })
  const polyline = points.join(' ')

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
        <polyline
          points={polyline}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-for-500"
        />
        {data.map((d, i) => {
          const x = (i / (data.length - 1)) * W
          const y = H - (d.actions / max) * H
          return (
            <circle key={i} cx={x} cy={y} r="3" fill="currentColor" className="text-for-400">
              <title>{`Week of ${d.week}: ${d.actions} actions`}</title>
            </circle>
          )
        })}
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] font-mono text-surface-500">{data[0]?.week?.slice(5)}</span>
        <span className="text-[10px] font-mono text-surface-500">{data[data.length - 1]?.week?.slice(5)}</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EngagementPage() {
  const router = useRouter()
  const [data, setData] = useState<EngagementData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/engagement', { cache: 'no-store' })
      if (res.status === 401) { router.push('/auth/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError('Could not load engagement data.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const maxCount = data ? Math.max(1, ...data.actions.map((a) => a.count)) : 1
  const funnelMax = data ? Math.max(
    data.funnel.viewed_topics,
    data.funnel.voted,
    data.funnel.argued,
    data.funnel.replied,
    data.funnel.reacted,
    1
  ) : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-4">
          <button
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex-shrink-0 p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white font-mono">Engagement Depth</h1>
            <p className="text-xs text-surface-500">How broadly you participate in the Lobby</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="flex-shrink-0 p-2 rounded-lg hover:bg-surface-200 transition-colors text-surface-500 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading && <PageSkeleton />}

        {error && !loading && (
          <div className="px-4">
            <EmptyState
              icon={Activity}
              title="Could not load data"
              description={error}
              action={{ label: 'Retry', onClick: load }}
            />
          </div>
        )}

        {data && !loading && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4 px-4"
            >
              {/* ── Hero card: depth score + diversity ─────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: depth ring */}
                  <DepthRing score={data.depthScore} label={data.depthLabel} />

                  {/* Right: key stats */}
                  <div className="flex-1 min-w-0 space-y-3 pt-1">
                    {/* Total actions */}
                    <div>
                      <p className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-0.5">Total Actions</p>
                      <p className="text-2xl font-mono font-bold text-white">
                        {data.totalActions.toLocaleString()}
                      </p>
                    </div>

                    {/* Diversity */}
                    <div>
                      <p className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-1">Action Diversity</p>
                      <div className="flex items-center gap-1">
                        {[...Array(10)].map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              'h-2 w-2 rounded-sm transition-colors',
                              i < data.diversityScore ? 'bg-emerald' : 'bg-surface-300'
                            )}
                          />
                        ))}
                        <span className="ml-1 text-xs font-mono text-emerald">{data.diversityScore}/10</span>
                      </div>
                    </div>

                    {/* Platform percentile */}
                    <div>
                      <p className="text-xs text-surface-500 font-mono uppercase tracking-wider mb-0.5">Percentile</p>
                      <p className="text-base font-mono font-semibold text-gold">
                        Top {100 - data.platformComparison.percentile + 1}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Platform comparison ────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Platform Comparison
                </h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-mono font-bold text-for-400">{data.platformComparison.your_score}</p>
                    <p className="text-[10px] text-surface-500 font-mono">Your Score</p>
                  </div>
                  <div>
                    <p className="text-xl font-mono font-bold text-surface-500">{data.platformComparison.avg_score}</p>
                    <p className="text-[10px] text-surface-500 font-mono">Avg Score</p>
                  </div>
                  <div>
                    <p className="text-xl font-mono font-bold text-gold">
                      {data.platformComparison.percentile}th
                    </p>
                    <p className="text-[10px] text-surface-500 font-mono">Percentile</p>
                  </div>
                </div>
                <div className="mt-3 relative h-3 bg-surface-300 rounded-full overflow-hidden">
                  {/* Avg marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-surface-500/60 z-10"
                    style={{ left: `${data.platformComparison.avg_score}%` }}
                  />
                  {/* Your position */}
                  <motion.div
                    className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${data.platformComparison.your_score}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
                <p className="text-[10px] text-surface-500 font-mono mt-1 text-right">
                  Avg user score: {data.platformComparison.avg_score}
                </p>
              </div>

              {/* ── Action breakdown ───────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-surface-300">
                  <h2 className="text-sm font-mono font-semibold text-white">Action Breakdown</h2>
                  <p className="text-xs text-surface-500 mt-0.5">Every way you engage with the platform</p>
                </div>
                <div className="px-5 py-4 space-y-3.5">
                  {data.actions.map((action) => (
                    <ActionBar key={action.type} action={action} maxCount={maxCount} />
                  ))}
                </div>
              </div>

              {/* ── Engagement funnel ──────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-surface-300">
                  <h2 className="text-sm font-mono font-semibold text-white">Engagement Funnel</h2>
                  <p className="text-xs text-surface-500 mt-0.5">From passive viewing to active debate</p>
                </div>
                <div className="px-5 py-4 space-y-2.5">
                  <FunnelRow label="Subscribed"  count={data.funnel.viewed_topics} max={funnelMax} color="bg-surface-500"  href="/topics" />
                  <FunnelRow label="Voted"       count={data.funnel.voted}         max={funnelMax} color="bg-for-500"      href="/analytics/votes" />
                  <FunnelRow label="Argued"      count={data.funnel.argued}        max={funnelMax} color="bg-purple"       href="/analytics/arguments" />
                  <FunnelRow label="Replied"     count={data.funnel.replied}       max={funnelMax} color="bg-emerald"      href="/analytics/threads" />
                  <FunnelRow label="Reacted"     count={data.funnel.reacted}       max={funnelMax} color="bg-against-500"  href="/pulse" />
                </div>
              </div>

              {/* ── Weekly trend ───────────────────────────────────────── */}
              {data.weeklyTrend.length > 1 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-sm font-mono font-semibold text-white">Weekly Activity</h2>
                      <p className="text-xs text-surface-500 mt-0.5">Votes cast per week (last 3 months)</p>
                    </div>
                    <BarChart2 className="h-4 w-4 text-surface-500" aria-hidden />
                  </div>
                  <WeeklySparkline data={data.weeklyTrend} />
                </div>
              )}

              {/* ── Most engaged topics ─────────────────────────────────── */}
              {data.topEngagedTopics.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                  <div className="px-5 pt-5 pb-3 border-b border-surface-300">
                    <h2 className="text-sm font-mono font-semibold text-white">Most Engaged Topics</h2>
                    <p className="text-xs text-surface-500 mt-0.5">Where you have done the most across all action types</p>
                  </div>
                  <div className="divide-y divide-surface-300">
                    {data.topEngagedTopics.map((topic) => (
                      <TopicCard key={topic.id} topic={topic} />
                    ))}
                  </div>
                </div>
              )}

              {data.totalActions === 0 && (
                <EmptyState
                  icon={Activity}
                  title="No engagement yet"
                  description="Start voting, arguing, and exploring topics to build your engagement depth."
                  action={{ label: 'Explore topics', href: '/topics' }}
                />
              )}

              {/* ── Footer: related analytics ─────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  Related Analytics
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { href: '/analytics/arguments', label: 'Argument Portfolio', icon: BookOpen, color: 'text-purple' },
                    { href: '/analytics/threads',   label: 'Thread Analytics',   icon: MessageSquare, color: 'text-emerald' },
                    { href: '/analytics/votes',     label: 'Vote History',       icon: ThumbsUp, color: 'text-for-400' },
                    { href: '/analytics/growth',    label: 'Activity Growth',    icon: TrendingUp, color: 'text-gold' },
                    { href: '/analytics/depth',     label: 'Depth Score',        icon: Layers, color: 'text-for-300' },
                    { href: '/analytics/discourse', label: 'Discourse Quality',  icon: Sparkles, color: 'text-emerald' },
                  ].map(({ href, label, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-200/60 border border-surface-300 hover:border-surface-400 transition-colors group"
                    >
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} aria-hidden />
                      <span className="text-xs font-mono text-surface-500 group-hover:text-surface-300 transition-colors truncate">{label}</span>
                      <ChevronRight className="h-3 w-3 text-surface-600 flex-shrink-0 ml-auto" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Back to analytics hub */}
              <div className="text-center pb-2">
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  All Analytics
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
