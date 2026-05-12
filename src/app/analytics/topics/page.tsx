'use client'

/**
 * /analytics/topics — Topic Voting Analytics
 *
 * Personal breakdown of every topic the user has voted on:
 *  - Overall accuracy across resolved topics
 *  - Category distribution (where you vote most)
 *  - Monthly voting activity bar chart
 *  - Recent resolved topics with correct/incorrect outcome
 *  - Topics you've argued on most
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
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gavel,
  Layers,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TopicsAnalyticsResponse,
  CategoryStat,
  MonthlyActivity,
  ResolvedVotedTopic,
  ArgumentedTopic,
} from '@/app/api/analytics/topics/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function accuracyLabel(pct: number | null): string {
  if (pct === null) return 'N/A'
  if (pct >= 75) return 'Sharp'
  if (pct >= 60) return 'Good'
  if (pct >= 50) return 'Average'
  return 'Below avg'
}

function accuracyColor(pct: number | null): string {
  if (pct === null) return 'text-surface-500'
  if (pct >= 75) return 'text-emerald'
  if (pct >= 60) return 'text-for-400'
  if (pct >= 50) return 'text-gold'
  return 'text-against-400'
}

const GRADE_COLOR: Record<string, string> = {
  A: 'text-emerald',
  'A-': 'text-emerald',
  'B+': 'text-for-400',
  B: 'text-for-400',
  'B-': 'text-for-300',
  'C+': 'text-gold',
  C: 'text-gold',
  'C-': 'text-surface-400',
  D: 'text-against-400',
  F: 'text-against-500',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: typeof Target
  color: string
}) {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4', color)} />
        <p className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn('text-3xl font-mono font-bold', color)}>{value}</p>
      {sub && <p className="text-xs font-mono text-surface-500 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ stat, maxVotes }: { stat: CategoryStat; maxVotes: number }) {
  const barWidth = maxVotes > 0 ? (stat.voteCount / maxVotes) * 100 : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: stat.color }}
          />
          <span className="text-surface-200 truncate">{stat.category}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-surface-500">{stat.voteCount} votes</span>
          {stat.accuracyPct !== null && (
            <span className={cn('font-semibold', accuracyColor(stat.accuracyPct))}>
              {stat.accuracyPct}% acc.
            </span>
          )}
        </div>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: stat.color }}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <div className="flex gap-3 text-[10px] font-mono text-surface-500">
        <span className="text-for-400">{stat.forCount} FOR</span>
        <span className="text-against-400">{stat.againstCount} AGAINST</span>
        {stat.resolvedCount > 0 && (
          <span>
            {stat.accurateCount}/{stat.resolvedCount} correct
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────

function MonthlyChart({ months }: { months: MonthlyActivity[] }) {
  const maxCount = Math.max(...months.map((m) => m.voteCount), 1)
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
        <BarChart2 className="h-3.5 w-3.5" />
        Monthly Voting Activity
      </h3>
      <div className="flex items-end gap-1 h-24 overflow-x-auto pb-1">
        {months.map((m) => {
          const heightPct = (m.voteCount / maxCount) * 100
          const forPct = m.voteCount > 0 ? (m.forCount / m.voteCount) * 100 : 50
          return (
            <div key={m.monthKey} className="flex flex-col items-center gap-1 flex-shrink-0 w-8">
              <div
                className="w-full rounded-t-sm overflow-hidden relative"
                style={{ height: `${Math.max(4, heightPct)}%`, minHeight: 4, maxHeight: 80 }}
                title={`${m.month}: ${m.voteCount} votes (${m.forCount} FOR / ${m.againstCount} AGAINST)`}
              >
                <div
                  className="absolute bottom-0 left-0 right-0 bg-against-500/80 rounded-t-sm"
                  style={{ height: '100%' }}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 bg-for-500 rounded-t-sm"
                  style={{ height: `${forPct}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-surface-600 text-center leading-tight">
                {m.month.split(' ')[0]}
              </span>
            </div>
          )
        })}
        {months.length === 0 && (
          <p className="text-xs font-mono text-surface-600 self-center w-full text-center">
            No voting history yet
          </p>
        )}
      </div>
      <div className="flex items-center gap-4 text-[10px] font-mono text-surface-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-for-500" /> FOR</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-against-500/80" /> AGAINST</span>
      </div>
    </div>
  )
}

// ─── Resolved topic row ───────────────────────────────────────────────────────

function ResolvedRow({ topic }: { topic: ResolvedVotedTopic }) {
  const statusLabel = topic.status === 'law' ? 'LAW' : 'FAILED'
  return (
    <Link
      href={`/topic/${topic.topicId}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 hover:bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all group"
    >
      <div className={cn(
        'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-0.5',
        topic.correct ? 'bg-emerald/10' : 'bg-against-500/10'
      )}>
        {topic.correct
          ? <CheckCircle2 className="h-4 w-4 text-emerald" />
          : <XCircle className="h-4 w-4 text-against-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-100 group-hover:text-white transition-colors line-clamp-2 leading-snug">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {topic.category && (
            <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
          )}
          <span className={cn(
            'text-[10px] font-mono font-semibold',
            topic.status === 'law' ? 'text-gold' : 'text-surface-500'
          )}>
            {statusLabel}
          </span>
          <span className={cn(
            'text-[10px] font-mono',
            topic.userSide === 'blue' ? 'text-for-400' : 'text-against-400'
          )}>
            You voted {topic.userSide === 'blue' ? 'FOR' : 'AGAINST'}
          </span>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1" />
    </Link>
  )
}

// ─── Argumented topic row ─────────────────────────────────────────────────────

function ArgumentedRow({ topic }: { topic: ArgumentedTopic }) {
  const badgeVariant: 'proposed' | 'active' | 'law' | 'failed' =
    topic.status === 'law' ? 'law' :
    topic.status === 'failed' ? 'failed' :
    topic.status === 'active' || topic.status === 'voting' ? 'active' : 'proposed'

  return (
    <Link
      href={`/topic/${topic.topicId}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 hover:bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all group"
    >
      <div className="flex-shrink-0 h-7 w-7 rounded-full bg-purple/10 flex items-center justify-center mt-0.5">
        <MessageSquare className="h-4 w-4 text-purple" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-100 group-hover:text-white transition-colors line-clamp-2 leading-snug">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant={badgeVariant} size="xs">
            {topic.status === 'law' ? 'LAW' : topic.status.toUpperCase()}
          </Badge>
          <span className="text-[10px] font-mono text-purple">
            {topic.argCount} argument{topic.argCount !== 1 ? 's' : ''}
          </span>
          {topic.totalUpvotes > 0 && (
            <span className="text-[10px] font-mono text-surface-500">
              {topic.totalUpvotes} upvote{topic.totalUpvotes !== 1 ? 's' : ''}
            </span>
          )}
          {topic.bestGrade && (
            <span className={cn('text-[10px] font-mono font-bold', GRADE_COLOR[topic.bestGrade] ?? 'text-surface-500')}>
              Best: {topic.bestGrade}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-1" />
    </Link>
  )
}

// ─── Accuracy gauge ───────────────────────────────────────────────────────────

function AccuracyGauge({ pct }: { pct: number | null }) {
  const r = 54
  const cx = 70
  const cy = 70
  const arcX = (deg: number) => cx + r * Math.cos((deg * Math.PI) / 180)
  const arcY = (deg: number) => cy + r * Math.sin((deg * Math.PI) / 180)

  const track = `M ${arcX(-180)} ${arcY(-180)} A ${r} ${r} 0 0 1 ${arcX(0)} ${arcY(0)}`
  const fillAngle = pct !== null ? ((pct / 100) * 180 - 180) : -180
  const fillArc = pct !== null
    ? `M ${arcX(-180)} ${arcY(-180)} A ${r} ${r} 0 ${pct > 50 ? 1 : 0} 1 ${arcX(fillAngle)} ${arcY(fillAngle)}`
    : null

  const gaugeColor = pct === null ? '#6b7280' : pct >= 75 ? '#10b981' : pct >= 60 ? '#60a5fa' : pct >= 50 ? '#c9a84c' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="80" viewBox="0 0 140 80" aria-hidden="true">
        <path d={track} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} strokeLinecap="round" />
        {fillArc && (
          <motion.path
            d={fillArc}
            fill="none"
            stroke={gaugeColor}
            strokeWidth={12}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize={22} fontWeight="bold" fontFamily="monospace">
          {pct !== null ? `${pct}%` : '—'}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill="#71717a" fontSize={10} fontFamily="monospace">
          {accuracyLabel(pct)}
        </text>
      </svg>
      <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Vote Accuracy</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TopicsAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<TopicsAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllResolved, setShowAllResolved] = useState(false)
  const [showAllArgued, setShowAllArgued] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/topics', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) { setError('Failed to load analytics'); return }
      setData(await res.json())
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const resolvedVisible = showAllResolved
    ? (data?.recentResolved ?? [])
    : (data?.recentResolved ?? []).slice(0, 6)

  const arguedVisible = showAllArgued
    ? (data?.topArgumentedTopics ?? [])
    : (data?.topArgumentedTopics ?? []).slice(0, 5)

  const maxCatVotes = data
    ? Math.max(...data.categoryStats.map((c) => c.voteCount), 1)
    : 1

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/analytics"
              className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
              aria-label="Back to Analytics"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Topic Analytics</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Your voting patterns, accuracy, and civic engagement
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40 flex-shrink-0 mt-1"
            aria-label="Refresh analytics"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && <PageSkeleton />}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-against-500/10 border border-against-500/30 p-5 text-center">
            <p className="text-sm font-mono text-against-400">{error}</p>
            <button
              onClick={() => load()}
              className="mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && data && data.totalVoted === 0 && (
          <EmptyState
            icon={Scale}
            title="No votes yet"
            description="Start voting on topics in the feed — your analytics will appear here."
            action={{ label: 'Browse Topics', href: '/' }}
          />
        )}

        {/* Main content */}
        {!loading && !error && data && data.totalVoted > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="space-y-6"
            >

              {/* Top stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Topics Voted"
                  value={data.uniqueTopics.toLocaleString()}
                  sub={`${data.totalVoted} total votes`}
                  icon={Scale}
                  color="text-for-400"
                />
                <StatCard
                  label="For / Against"
                  value={`${data.forPct}%`}
                  sub={`${data.forCount} FOR · ${data.againstCount} AGAINST`}
                  icon={data.forPct >= 50 ? ThumbsUp : ThumbsDown}
                  color={data.forPct >= 60 ? 'text-for-400' : data.forPct <= 40 ? 'text-against-400' : 'text-gold'}
                />
                <StatCard
                  label="Accuracy"
                  value={data.accuracyPct !== null ? `${data.accuracyPct}%` : '—'}
                  sub={data.resolvedCount > 0 ? `${data.accurateCount}/${data.resolvedCount} resolved` : 'No resolved topics yet'}
                  icon={Target}
                  color={accuracyColor(data.accuracyPct) as string}
                />
                <StatCard
                  label="Best Streak"
                  value={data.streakData.longestAccurateStreak}
                  sub={`${data.streakData.currentAccurateStreak} current`}
                  icon={Flame}
                  color="text-gold"
                />
              </div>

              {/* Accuracy gauge + streak */}
              {data.resolvedCount > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col sm:flex-row items-center gap-6">
                  <AccuracyGauge pct={data.accuracyPct} />
                  <div className="flex-1 space-y-3 w-full">
                    <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5" />
                      Forecast Performance
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: 'Resolved topics', value: data.resolvedCount, color: 'text-surface-200' },
                        { label: 'Correct calls', value: data.accurateCount, color: 'text-emerald' },
                        { label: 'Longest streak', value: data.streakData.longestAccurateStreak, color: 'text-gold' },
                        { label: 'Current streak', value: data.streakData.currentAccurateStreak, color: data.streakData.currentAccurateStreak > 0 ? 'text-for-400' : 'text-surface-500' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-xl bg-surface-200/50 p-3">
                          <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
                          <p className={cn('text-2xl font-mono font-bold mt-0.5', color)}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Category breakdown */}
              {data.categoryStats.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
                  <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="h-3.5 w-3.5" />
                    Category Breakdown
                  </h3>
                  <div className="space-y-4">
                    {data.categoryStats.map((stat) => (
                      <CategoryRow key={stat.category} stat={stat} maxVotes={maxCatVotes} />
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly activity chart */}
              {data.monthlyActivity.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <MonthlyChart months={data.monthlyActivity} />
                </div>
              )}

              {/* Recent resolved topics */}
              {data.recentResolved.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
                    <Gavel className="h-3.5 w-3.5" />
                    Resolved Topics You Voted On
                    <span className="text-surface-600 font-normal normal-case tracking-normal">({data.recentResolved.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {resolvedVisible.map((topic) => (
                      <ResolvedRow key={topic.topicId + topic.votedAt} topic={topic} />
                    ))}
                  </div>
                  {data.recentResolved.length > 6 && (
                    <button
                      onClick={() => setShowAllResolved(!showAllResolved)}
                      className="w-full text-xs font-mono text-surface-500 hover:text-white transition-colors py-2"
                    >
                      {showAllResolved ? 'Show less' : `Show all ${data.recentResolved.length}`}
                    </button>
                  )}
                </div>
              )}

              {/* Most argued topics */}
              {data.topArgumentedTopics.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
                  <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    Topics You Argue Most
                    <span className="text-surface-600 font-normal normal-case tracking-normal">
                      ({data.topArgumentedTopics.length})
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {arguedVisible.map((topic) => (
                      <ArgumentedRow key={topic.topicId} topic={topic} />
                    ))}
                  </div>
                  {data.topArgumentedTopics.length > 5 && (
                    <button
                      onClick={() => setShowAllArgued(!showAllArgued)}
                      className="w-full text-xs font-mono text-surface-500 hover:text-white transition-colors py-2"
                    >
                      {showAllArgued ? 'Show less' : `Show all ${data.topArgumentedTopics.length}`}
                    </button>
                  )}
                </div>
              )}

              {/* Navigation to other analytics */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  More Analytics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { href: '/analytics/arguments', label: 'Argument Portfolio', icon: BookOpen, color: 'text-purple' },
                    { href: '/analytics/evolution', label: 'Opinion Evolution', icon: TrendingUp, color: 'text-for-400' },
                    { href: '/analytics/sentiment', label: 'Sentiment Drift', icon: Award, color: 'text-gold' },
                  ].map(({ href, label, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-200/50 hover:bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all group text-sm font-mono text-surface-400 hover:text-white"
                    >
                      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                      <span className="truncate">{label}</span>
                      <ArrowRight className="h-3 w-3 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
