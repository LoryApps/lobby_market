'use client'

/**
 * /analytics/threads — Argument Thread Analytics
 *
 * Shows how much dialogue your arguments generate:
 * total replies received, reply rate, top threadworthy arguments,
 * who replies to you most, and weekly conversation trends.
 *
 * Distinct from:
 *   /analytics/impact       — upvotes + debate wins (not reply dialogue)
 *   /analytics/discourse    — platform-wide discourse quality metrics
 *   /analytics/resonance    — cross-partisan upvotes (not replies)
 *   /analytics/arguments    — broad argument portfolio
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
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  ThreadAnalyticsData,
  ThreadArgument,
  TopReplier,
} from '@/app/api/analytics/threads/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ThreadsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
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
  color: _color,
  delay,
  platformAvg,
}: {
  label: string
  value: number
  sub: string
  icon: typeof MessageSquare
  color: string
  delay: number
  platformAvg?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
    >
      <div className="flex items-center gap-2 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-3">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-3xl font-mono font-bold text-white tabular-nums">
        <AnimatedNumber value={value} />
      </div>
      <div className="text-xs text-surface-500 mt-1">{sub}</div>
      {platformAvg !== undefined && (
        <div className={cn('text-[10px] font-mono mt-2', value >= platformAvg ? 'text-emerald' : 'text-surface-600')}>
          {value >= platformAvg ? '↑' : '↓'} Platform avg: {platformAvg}
          {label.includes('Rate') ? '%' : ''}
        </div>
      )}
    </motion.div>
  )
}

// ─── Bar chart (thread depth distribution) ────────────────────────────────────

function DepthChart({
  data,
}: {
  data: Array<{ bucket: string; count: number }>
}) {
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <BarChart2 className="h-3.5 w-3.5" />
        Replies per argument distribution
      </div>
      <div className="flex items-end gap-2 h-24">
        {data.map(({ bucket, count }) => (
          <div key={bucket} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t-sm bg-for-600/60 hover:bg-for-500/80 transition-colors"
              style={{ height: `${Math.max(4, (count / max) * 80)}px` }}
              title={`${count} argument${count !== 1 ? 's' : ''}`}
            />
            <span className="text-[9px] font-mono text-surface-500">{bucket}</span>
            <span className="text-[9px] font-mono text-surface-600">{count}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-surface-600 mt-2">Buckets = number of replies received on each argument</p>
    </div>
  )
}

// ─── Weekly activity sparkline ─────────────────────────────────────────────────

function ActivitySparkline({
  data,
}: {
  data: Array<{ week: string; arguments_posted: number; replies_received: number }>
}) {
  if (data.length < 2) return null
  const maxReplies = Math.max(...data.map((d) => d.replies_received), 1)
  const maxArgs = Math.max(...data.map((d) => d.arguments_posted), 1)

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <TrendingUp className="h-3.5 w-3.5" />
        Weekly conversation activity
      </div>
      <div className="flex items-end gap-1 h-20">
        {data.map(({ week, arguments_posted, replies_received }) => (
          <div key={week} className="flex-1 flex items-end gap-0.5" title={`Week of ${week}\n${arguments_posted} args · ${replies_received} replies`}>
            <div
              className="flex-1 rounded-t-sm bg-surface-400/40"
              style={{ height: `${Math.max(3, (arguments_posted / maxArgs) * 72)}px` }}
            />
            <div
              className="flex-1 rounded-t-sm bg-emerald/60"
              style={{ height: `${Math.max(3, (replies_received / maxReplies) * 72)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-surface-400/40" />
          <span className="text-[10px] font-mono text-surface-500">Arguments posted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-emerald/60" />
          <span className="text-[10px] font-mono text-surface-500">Replies received</span>
        </div>
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ThreadArgumentCard({ arg }: { arg: ThreadArgument }) {
  const iFor = arg.side === 'blue'
  return (
    <Link
      href={`/topic/${arg.topic_id}/arguments`}
      className="group flex items-start gap-3 p-3.5 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
        iFor ? 'bg-for-600/20 border border-for-600/30' : 'bg-against-600/20 border border-against-600/30'
      )}>
        {iFor
          ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white leading-relaxed line-clamp-2 mb-1.5">{truncate(arg.content, 140)}</p>
        <p className="text-[10px] text-surface-500 truncate">{truncate(arg.topic_statement, 60)}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="flex items-center gap-1 text-[10px] text-emerald font-mono font-semibold">
            <MessageSquare className="h-3 w-3" />
            {arg.reply_count} {arg.reply_count === 1 ? 'reply' : 'replies'}
          </span>
          <span className="text-[10px] text-surface-600">{relTime(arg.created_at)}</span>
          <span className="flex items-center gap-1 text-[10px] text-surface-500 font-mono">
            <Zap className="h-3 w-3 text-gold" />
            {arg.upvotes}
          </span>
        </div>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors shrink-0 mt-2.5" />
    </Link>
  )
}

// ─── Top replier card ─────────────────────────────────────────────────────────

function ReplierCard({ replier }: { replier: TopReplier }) {
  return (
    <Link
      href={`/profile/${replier.username}`}
      className="group flex items-center gap-2.5 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
    >
      <Avatar
        src={replier.avatar_url}
        fallback={replier.display_name ?? replier.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white truncate">
          {replier.display_name ?? replier.username}
        </p>
        <p className="text-[10px] text-surface-500">@{replier.username}</p>
      </div>
      <span className="text-xs font-mono font-semibold text-emerald shrink-0">
        {replier.reply_count} {replier.reply_count === 1 ? 'reply' : 'replies'}
      </span>
    </Link>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ThreadAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<ThreadAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/threads', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        throw new Error(`HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const isEmpty = data && data.totalArguments === 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white font-mono">Thread Analytics</h1>
            <p className="text-xs text-surface-500 mt-0.5">How much dialogue your arguments generate</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="ml-auto p-2 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-against-950 border border-against-800 p-4 text-sm text-against-400 mb-4">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && <ThreadsSkeleton />}

        {/* Empty state */}
        {!loading && isEmpty && (
          <EmptyState
            icon={MessageSquare}
            title="No arguments yet"
            description="Post your first argument on any topic to start tracking thread engagement."
            action={{ label: 'Go to Feed', href: '/' }}
          />
        )}

        {/* Content */}
        {!loading && data && !isEmpty && (
          <AnimatePresence>
            <div className="space-y-4">
              {/* Stat cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Total Replies"
                  value={data.totalRepliesReceived}
                  sub="received on your arguments"
                  icon={MessageSquare}
                  color="text-emerald"
                  delay={0}
                />
                <StatCard
                  label="Reply Rate"
                  value={data.replyRate}
                  sub="% of arguments replied to"
                  icon={TrendingUp}
                  color="text-for-400"
                  delay={0.05}
                  platformAvg={data.platformAvgReplyRate}
                />
                <StatCard
                  label="Avg Replies"
                  value={data.avgRepliesPerArgument}
                  sub="per argument posted"
                  icon={BarChart2}
                  color="text-purple"
                  delay={0.1}
                />
                <StatCard
                  label="Best Thread"
                  value={data.maxRepliesOnOneArgument}
                  sub="replies on top argument"
                  icon={Flame}
                  color="text-gold"
                  delay={0.15}
                />
              </div>

              {/* Depth distribution */}
              {data.threadDepthDistribution.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <DepthChart data={data.threadDepthDistribution} />
                </motion.div>
              )}

              {/* Weekly activity sparkline */}
              {data.recentActivity.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.25 }}
                >
                  <ActivitySparkline data={data.recentActivity} />
                </motion.div>
              )}

              {/* Top threaded arguments */}
              {data.topThreadedArguments.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <MessageSquare className="h-3.5 w-3.5 text-emerald" />
                    Your most threadworthy arguments
                  </div>
                  <div className="space-y-2">
                    {data.topThreadedArguments.map((arg, i) => (
                      <motion.div
                        key={arg.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: 0.32 + i * 0.04 }}
                      >
                        <ThreadArgumentCard arg={arg} />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Top repliers */}
              {data.topRepliers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.35 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
                >
                  <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
                    <Users className="h-3.5 w-3.5 text-for-400" />
                    Who engages with your arguments most
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.topRepliers.map((replier, i) => (
                      <motion.div
                        key={replier.user_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: 0.37 + i * 0.04 }}
                      >
                        <ReplierCard replier={replier} />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* No threaded arguments yet */}
              {data.topThreadedArguments.length === 0 && data.totalArguments > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 }}
                  className="rounded-2xl bg-surface-200/60 border border-surface-300/40 p-6 text-center"
                >
                  <MessageSquare className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-white mb-1">No replies yet</p>
                  <p className="text-xs text-surface-500">
                    You&apos;ve posted {data.totalArguments} argument{data.totalArguments !== 1 ? 's' : ''} but none have received replies yet.
                    Engaging arguments that cite evidence and ask questions tend to spark more dialogue.
                  </p>
                  <Link
                    href="/analytics/argument-quality"
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-for-400 hover:text-for-300 transition-colors"
                  >
                    Improve your argument quality
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </motion.div>
              )}

              {/* Navigation to related analytics */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.4 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                {[
                  { href: '/analytics/impact', label: 'Argument Impact', sub: 'Upvotes, debate wins, reach', icon: Zap, color: 'text-gold', border: 'border-gold/20 hover:border-gold/40' },
                  { href: '/analytics/resonance', label: 'Civic Resonance', sub: 'Cross-partisan engagement', icon: TrendingUp, color: 'text-emerald', border: 'border-emerald/20 hover:border-emerald/40' },
                ].map(({ href, label, sub, icon: Icon, color, border }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center justify-between rounded-xl bg-surface-100 border p-4 group transition-colors',
                      border
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn('h-4 w-4 shrink-0', color)} />
                      <div>
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="text-[10px] text-surface-500">{sub}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-white transition-colors" />
                  </Link>
                ))}
              </motion.div>
            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
