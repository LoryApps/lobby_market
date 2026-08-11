'use client'

/**
 * /broadcast — Civic Broadcast
 *
 * A live TV-style viewport showing the hottest civic topic in progress:
 *   - Split-screen FOR/AGAINST argument feeds (newest on top)
 *   - Animated live vote bar
 *   - Platform-wide stats ticker
 *   - Auto-refresh every 30 seconds
 *
 * Distinct from /debate (debate hub), /floor (parliamentary chamber),
 * and /topic/[id] (full topic page). This is the platform's "anchor desk".
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  ExternalLink,
  Gavel,
  Loader2,
  MessageSquare,
  Mic,
  Radio,
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
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { VoteBar } from '@/components/voting/VoteBar'
import { cn } from '@/lib/utils/cn'
import type { BroadcastResponse, BroadcastArgument, BroadcastTopic, BroadcastStats } from '@/app/api/broadcast/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30_000 // 30 seconds

const CATEGORY_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

type BadgeVariant = Parameters<typeof Badge>[0]['variant']

const STATUS_BADGE: Record<string, BadgeVariant> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald',
  A: 'text-emerald',
  'A-': 'text-emerald',
  'B+': 'text-for-400',
  B: 'text-for-400',
  'B-': 'text-for-300',
  'C+': 'text-gold',
  C: 'text-gold',
  'C-': 'text-gold',
  D: 'text-against-400',
  F: 'text-against-600',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1_000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (s < 60) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({
  arg,
  side,
}: {
  arg: BroadcastArgument
  side: 'blue' | 'red'
}) {
  const isFor = side === 'blue'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-xl border p-3.5 bg-surface-100 flex flex-col gap-2',
        isFor ? 'border-for-500/25' : 'border-against-500/25'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {arg.author && (
            <Avatar
              src={arg.author.avatar_url}
              username={arg.author.username}
              size={22}
            />
          )}
          <span className="text-xs text-surface-500 truncate">
            {arg.author?.display_name ?? arg.author?.username ?? 'Anonymous'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {arg.ai_grade && (
            <span
              className={cn(
                'text-[10px] font-bold tabular-nums',
                GRADE_COLOR[arg.ai_grade] ?? 'text-surface-500'
              )}
            >
              {arg.ai_grade}
            </span>
          )}
          <span className="text-[10px] text-surface-500">{relativeTime(arg.created_at)}</span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-surface-900 leading-relaxed line-clamp-4">{arg.content}</p>

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-surface-500">
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-3 w-3" aria-hidden="true" />
          {arg.upvotes}
        </span>
        {arg.ai_score != null && (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3" aria-hidden="true" />
            {Math.round(arg.ai_score * 10) / 10}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Side column ──────────────────────────────────────────────────────────────

function SideColumn({
  side,
  args,
  loading,
}: {
  side: 'blue' | 'red'
  args: BroadcastArgument[]
  loading: boolean
}) {
  const isFor = side === 'blue'
  const sideArgs = args.filter((a) => a.side === side)

  return (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Side header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-t-2xl border-b mb-3',
          isFor
            ? 'bg-for-900/30 border-for-700/30 text-for-400'
            : 'bg-against-900/30 border-against-700/30 text-against-400'
        )}
      >
        {isFor ? (
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="text-sm font-semibold tracking-wide uppercase">
          {isFor ? 'For' : 'Against'}
        </span>
        <span className="ml-auto text-xs opacity-60">{sideArgs.length} arguments</span>
      </div>

      {/* Arguments */}
      <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[520px] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-surface-300 px-1">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-surface-300 p-3.5 space-y-2 bg-surface-100">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))
        ) : sideArgs.length === 0 ? (
          <p className="text-center text-xs text-surface-500 py-8">No arguments yet</p>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {sideArgs.map((arg) => (
              <ArgumentCard key={arg.id} arg={arg} side={side} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

// ─── Stats ticker ─────────────────────────────────────────────────────────────

function StatsTicker({ stats }: { stats: BroadcastStats | null }) {
  const items = stats
    ? [
        { icon: Mic, label: `${stats.live_debates} live debate${stats.live_debates !== 1 ? 's' : ''}` },
        { icon: Activity, label: `${stats.active_topics} active topics` },
        { icon: BarChart2, label: `${stats.votes_last_hour} votes in the last hour` },
        { icon: MessageSquare, label: `${stats.arguments_last_hour} arguments in the last hour` },
      ]
    : []

  if (!stats) return null

  return (
    <div
      aria-label="Platform activity stats"
      className="flex items-center gap-6 overflow-x-auto scrollbar-none py-2 text-xs text-surface-500"
    >
      {items.map(({ icon: Icon, label }, i) => (
        <span key={i} className="flex items-center gap-1.5 shrink-0">
          <Icon className="h-3 w-3" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BroadcastClient() {
  const [data, setData] = useState<BroadcastResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL / 1000)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/broadcast', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load broadcast')
      const json: BroadcastResponse = await res.json()
      setData(json)
      setLastRefresh(new Date())
      setSecondsUntilRefresh(REFRESH_INTERVAL / 1000)
    } catch {
      setError('Could not load broadcast data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load + auto-refresh
  useEffect(() => {
    load()

    timerRef.current = setInterval(() => load(true), REFRESH_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load])

  // Countdown to next refresh
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setSecondsUntilRefresh((s) => Math.max(0, s - 1))
    }, 1_000)
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const topic: BroadcastTopic | null = data?.topic ?? null
  const args: BroadcastArgument[] = data?.arguments ?? []
  const stats: BroadcastStats | null = data?.stats ?? null

  const forPct = topic ? Math.round(topic.blue_pct) : 50

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col pb-20">
      <TopBar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 flex flex-col gap-5">

        {/* ── Broadcast header ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <span className="flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase text-against-400">
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              <span
                className="inline-flex h-2 w-2 rounded-full bg-against-500 animate-pulse"
                aria-label="Live"
              />
              Live
            </span>
            <h1 className="text-lg font-bold text-white">Civic Broadcast</h1>
          </div>

          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            aria-label="Refresh broadcast"
            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors disabled:opacity-40 px-2 py-1 rounded-lg hover:bg-surface-200"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
            {secondsUntilRefresh > 0 ? `${secondsUntilRefresh}s` : 'Now'}
          </button>
        </div>

        {/* ── Stats ticker ── */}
        <StatsTicker stats={stats} />

        {/* ── Error state ── */}
        {error && !loading && (
          <EmptyState
            icon={Activity}
            title="Broadcast unavailable"
            description={error}
            action={{ label: 'Retry', onClick: () => load() }}
          />
        )}

        {/* ── No topic ── */}
        {!loading && !error && !topic && (
          <EmptyState
            icon={Radio}
            title="Nothing on the floor"
            description="No active topics right now. Check back soon — the Lobby never stays quiet for long."
            action={{ label: 'Browse topics', href: '/topics' }}
          />
        )}

        {/* ── Topic spotlight ── */}
        {(loading || topic) && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
          >
            {/* Topic header */}
            <div className="px-5 pt-5 pb-4 border-b border-surface-300">
              {loading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-4/5" />
                </div>
              ) : topic ? (
                <>
                  <div className="flex items-center gap-2 mb-2.5 flex-wrap">
                    <Badge variant={STATUS_BADGE[topic.status] ?? 'active'}>
                      {STATUS_LABEL[topic.status] ?? topic.status}
                    </Badge>
                    {topic.category && (
                      <span className={cn('text-xs font-medium', CATEGORY_COLOR[topic.category] ?? 'text-surface-500')}>
                        {topic.category}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-xs text-surface-500">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {topic.total_votes.toLocaleString()} votes
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-white leading-snug">{topic.statement}</p>
                </>
              ) : null}
            </div>

            {/* Vote bar */}
            <div className="px-5 py-4 border-b border-surface-300">
              {loading ? (
                <Skeleton className="h-4 w-full rounded-full" />
              ) : topic ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-for-400">
                      FOR &nbsp;{forPct}%
                    </span>
                    <span className="text-against-400">
                      {100 - forPct}%&nbsp; AGAINST
                    </span>
                  </div>
                  <VoteBar bluePct={forPct} totalVotes={topic.total_votes} />
                </div>
              ) : null}
            </div>

            {/* Quick links */}
            {topic && (
              <div className="px-5 py-3 flex items-center gap-4 text-xs">
                <Link
                  href={`/topic/${topic.id}`}
                  className="flex items-center gap-1.5 text-for-400 hover:text-for-300 transition-colors font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  View topic
                </Link>
                <Link
                  href={`/topic/${topic.id}/argue`}
                  className="flex items-center gap-1.5 text-emerald hover:opacity-80 transition-opacity font-medium"
                >
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  Add argument
                </Link>
                <Link
                  href={`/topic/${topic.id}/debate`}
                  className="flex items-center gap-1.5 text-purple hover:opacity-80 transition-opacity font-medium"
                >
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  Debates
                </Link>
                <span className="ml-auto flex items-center gap-1 text-surface-500">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  Score {topic.feed_score.toFixed(1)}
                </span>
              </div>
            )}
          </motion.section>
        )}

        {/* ── Split argument feed ── */}
        {(loading || topic) && (
          <section aria-label="Live argument feed">
            <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-3">
              Live Argument Feed
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SideColumn side="blue" args={args} loading={loading} />
              <SideColumn side="red" args={args} loading={loading} />
            </div>
          </section>
        )}

        {/* ── Jump-off links ── */}
        <section aria-label="Explore more" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          {[
            { href: '/topics', icon: BarChart2, label: 'All Topics' },
            { href: '/debate', icon: Mic, label: 'Debates' },
            { href: '/arguments', icon: MessageSquare, label: 'Arguments' },
            { href: '/laws', icon: Gavel, label: 'Laws' },
          ].map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border border-surface-300',
                'bg-surface-100 hover:bg-surface-200 transition-colors',
                'px-3 py-3 text-sm text-surface-600 hover:text-white font-medium'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
              <ArrowRight className="h-3.5 w-3.5 ml-auto" aria-hidden="true" />
            </Link>
          ))}
        </section>

        {/* ── Refresh timestamp ── */}
        {lastRefresh && (
          <p className="text-center text-[10px] text-surface-600">
            Last updated {lastRefresh.toLocaleTimeString()} · refreshes every 30s
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
