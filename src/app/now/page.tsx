'use client'

/**
 * /now — The Civic Status Board
 *
 * A real-time single-screen view of what's happening on Lobby Market right now:
 *   • Live platform heartbeat (votes/min, arguments/min, active debates)
 *   • The most contested topics at this moment (closest to 50/50)
 *   • Topics entering their final voting phase
 *   • Most recent law established
 *   • A live vote ticker strip
 *
 * Distinct from:
 *   /live       — streaming argument feed
 *   /vote-stream — per-vote activity ticker
 *   /today      — daily stats digest
 *   /pulse      — argument activity
 *   /observatory — researcher analytics view
 *
 * This is the "dashboard screen" you'd put on a big display at a civic hackathon.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { PlatformLiveStats } from '@/app/api/platform/live/route'
import type { VoteStreamStats } from '@/app/api/vote-stream/route'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HotTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  support_count?: number
  activation_threshold?: number
}

interface NowData {
  platform: PlatformLiveStats
  voteStats: VoteStreamStats
  contestedTopics: HotTopic[]
  votingTopics: HotTopic[]
  activeTopics: HotTopic[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function votesPerMin(hourly: number) {
  const vpm = hourly / 60
  return vpm < 1 ? `<1 /min` : `${Math.round(vpm)} /min`
}

function relativeTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CAT_DOT: Record<string, string> = {
  Politics:    'bg-for-500',
  Economics:   'bg-gold',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-400',
  Philosophy:  'bg-for-300',
  Culture:     'bg-orange-400',
  Health:      'bg-pink-400',
  Environment: 'bg-green-400',
  Education:   'bg-cyan-400',
}

function catDot(cat: string | null) {
  return cat ? (CAT_DOT[cat] ?? 'bg-surface-500') : 'bg-surface-500'
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function PulseIndicator({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      {active && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-for-400 opacity-75" />
      )}
      <span className={cn('relative inline-flex rounded-full h-2 w-2', active ? 'bg-for-500' : 'bg-surface-500')} />
    </span>
  )
}

function StatPill({
  icon: Icon,
  value,
  label,
  color = 'text-surface-400',
  loading,
}: {
  icon: typeof Activity
  value: string | number
  label: string
  color?: string
  loading: boolean
}) {
  if (loading) return <Skeleton className="h-16 rounded-2xl flex-1" />
  return (
    <div className="flex-1 flex flex-col items-center gap-1 p-3 rounded-2xl bg-surface-100 border border-surface-300">
      <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
      <span className="text-lg font-mono font-bold text-white tabular-nums leading-none">{value}</span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider text-center">{label}</span>
    </div>
  )
}

function TopicRow({ topic, showSplit = true }: { topic: HotTopic; showSplit?: boolean }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const cat = topic.category
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {cat && (
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', catDot(cat))} />
          )}
          {cat && <span className="text-[10px] font-mono text-surface-500">{cat}</span>}
        </div>
        <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
          {topic.statement}
        </p>
        {showSplit && (
          <div className="mt-2">
            <div className="flex justify-between text-[10px] font-mono mb-0.5">
              <span className="text-for-400">{forPct}% FOR</span>
              <span className="text-against-400">{againstPct}% AGAINST</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden bg-surface-300 flex">
              <div className="h-full bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
              <div className="h-full bg-against-500 rounded-r-full ml-auto" style={{ width: `${againstPct}%` }} />
            </div>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <span className="text-xs font-mono text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-for-400 transition-colors" />
      </div>
    </Link>
  )
}

function Section({
  title,
  icon: Icon,
  iconColor,
  children,
  viewHref,
}: {
  title: string
  icon: typeof Scale
  iconColor: string
  children: React.ReactNode
  viewHref?: string
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
          <h2 className="text-xs font-mono text-surface-400 uppercase tracking-widest">{title}</h2>
        </div>
        {viewHref && (
          <Link
            href={viewHref}
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function NowPage() {
  const [data, setData] = useState<NowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAll = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [platformRes, voteStreamRes, topicsRes] = await Promise.all([
        fetch('/api/platform/live', { cache: 'no-store' }),
        fetch('/api/vote-stream', { cache: 'no-store' }),
        fetch('/api/topics?status=active&limit=20&sort=hot', { cache: 'no-store' }),
      ])

      const [platform, voteStream, topicsData] = await Promise.all([
        platformRes.ok ? (platformRes.json() as Promise<PlatformLiveStats>) : Promise.resolve(null),
        voteStreamRes.ok ? (voteStreamRes.json() as Promise<{ stats: VoteStreamStats }>) : Promise.resolve(null),
        topicsRes.ok ? (topicsRes.json() as Promise<{ topics: HotTopic[] }>) : Promise.resolve(null),
      ])

      if (!platform || !voteStream || !topicsData) return

      const allTopics: HotTopic[] = topicsData.topics ?? []

      // Most contested = active topics closest to 50/50 (low |blue_pct - 50|)
      const contestedTopics = allTopics
        .filter((t) => t.status === 'active' && t.total_votes >= 20)
        .sort((a, b) => Math.abs(a.blue_pct - 50) - Math.abs(b.blue_pct - 50))
        .slice(0, 3)

      // Topics entering final vote
      const votingRes = await fetch('/api/topics?status=voting&limit=3&sort=hot', { cache: 'no-store' })
      const votingData = votingRes.ok ? ((await votingRes.json()) as { topics: HotTopic[] }) : { topics: [] }
      const votingTopics = votingData.topics.slice(0, 3)

      // Active topics by total votes (most engaged)
      const activeTopics = allTopics
        .filter((t) => t.status === 'active')
        .sort((a, b) => b.total_votes - a.total_votes)
        .slice(0, 3)

      setData({
        platform,
        voteStats: voteStream.stats,
        contestedTopics,
        votingTopics,
        activeTopics,
      })
      setLastUpdated(new Date())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      if (manual) setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    timerRef.current = setInterval(() => fetchAll(), 30_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetchAll])

  const d = data

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <Activity className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white flex items-center gap-2">
                Right Now
                <PulseIndicator active={!loading} />
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                {lastUpdated
                  ? `Updated ${relativeTime(lastUpdated.toISOString())}`
                  : 'Loading platform data…'}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchAll(true)}
            disabled={refreshing || loading}
            aria-label="Refresh"
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white transition-colors text-xs font-mono',
              'disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Platform heartbeat ────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <StatPill
            icon={Zap}
            value={loading ? '—' : votesPerMin(d!.platform.votesLastHour)}
            label="Vote rate"
            color="text-for-400"
            loading={loading}
          />
          <StatPill
            icon={MessageSquare}
            value={loading ? '—' : d!.platform.argumentsLastHour}
            label="Args/hr"
            color="text-purple"
            loading={loading}
          />
          <StatPill
            icon={Mic}
            value={loading ? '—' : d!.platform.liveDebates}
            label="Live debates"
            color="text-gold"
            loading={loading}
          />
          <StatPill
            icon={TrendingUp}
            value={loading ? '—' : d!.platform.activeTopics}
            label="Active topics"
            color="text-for-300"
            loading={loading}
          />
        </div>

        {/* ── Sentiment bar ─────────────────────────────────────────── */}
        {!loading && d && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-6 p-4 rounded-2xl bg-surface-100 border border-surface-300"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wide">
                Platform sentiment — last 5 min
              </span>
              <span className="text-[11px] font-mono text-surface-600">
                {d.voteStats.votesLast5m} votes
              </span>
            </div>
            <div className="relative h-2.5 rounded-full overflow-hidden bg-against-500/20">
              <motion.div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                animate={{ width: `${d.voteStats.forPctLast5m}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="flex items-center gap-1 text-[11px] font-mono text-for-400">
                <ThumbsUp className="h-3 w-3" />
                FOR {d.voteStats.forPctLast5m}%
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono text-against-400">
                AGAINST {100 - d.voteStats.forPctLast5m}%
                <ThumbsDown className="h-3 w-3" />
              </span>
            </div>
          </motion.div>
        )}

        {/* ── Latest law ────────────────────────────────────────────── */}
        {!loading && d?.platform.latestLawStatement && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mb-6 p-4 rounded-2xl bg-emerald/5 border border-emerald/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Gavel className="h-4 w-4 text-emerald" aria-hidden="true" />
              <span className="text-[11px] font-mono text-emerald uppercase tracking-widest">Latest law established</span>
              {d.platform.latestLawAt && (
                <span className="text-[10px] font-mono text-surface-500 ml-auto">
                  {relativeTime(d.platform.latestLawAt)}
                </span>
              )}
            </div>
            <p className="text-sm text-white font-semibold leading-snug">
              {d.platform.latestLawStatement}
            </p>
            <div className="mt-3">
              <Link
                href="/law"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
              >
                View law codex
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skel"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-32 mb-3" />
                  <div className="space-y-2">
                    {[0, 1, 2].map((j) => (
                      <Skeleton key={j} className="h-20 rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="data"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {/* Most contested */}
              {d!.contestedTopics.length > 0 && (
                <Section
                  title="Most Contested Right Now"
                  icon={Scale}
                  iconColor="text-against-400"
                  viewHref="/battleground"
                >
                  {d!.contestedTopics.map((t) => (
                    <TopicRow key={t.id} topic={t} showSplit />
                  ))}
                </Section>
              )}

              {/* In final voting */}
              {d!.votingTopics.length > 0 && (
                <Section
                  title="In Final Vote"
                  icon={Gavel}
                  iconColor="text-purple"
                  viewHref="/pipeline"
                >
                  {d!.votingTopics.map((t) => (
                    <motion.div
                      key={t.id}
                      className="relative"
                    >
                      <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-purple/20 via-for-500/10 to-against-500/10 pointer-events-none" />
                      <TopicRow topic={t} showSplit />
                    </motion.div>
                  ))}
                </Section>
              )}

              {/* Most active */}
              {d!.activeTopics.length > 0 && (
                <Section
                  title="Most Active"
                  icon={Flame}
                  iconColor="text-gold"
                  viewHref="/trending"
                >
                  {d!.activeTopics.map((t) => (
                    <TopicRow key={t.id} topic={t} showSplit />
                  ))}
                </Section>
              )}

              {/* Laws this month pill */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-100 border border-surface-300">
                <div>
                  <p className="text-xs font-mono text-surface-500 uppercase tracking-wide">Laws this month</p>
                  <p className="text-2xl font-mono font-bold text-emerald mt-0.5">{d!.platform.lawsThisMonth}</p>
                </div>
                <Link
                  href="/almanac"
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-400 hover:text-emerald transition-colors"
                >
                  Full almanac
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Quick links */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: '/vote-stream', label: 'Live vote ticker', icon: Activity, color: 'text-for-400' },
                  { href: '/live', label: 'Argument stream', icon: MessageSquare, color: 'text-purple' },
                  { href: '/debate', label: 'Live debates', icon: Mic, color: 'text-gold' },
                  { href: '/trending', label: 'Trending topics', icon: TrendingUp, color: 'text-for-300' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                  >
                    <Icon className={cn('h-4 w-4 flex-shrink-0', color)} aria-hidden="true" />
                    <span className="text-xs font-mono text-surface-300">{label}</span>
                  </Link>
                ))}
              </div>

              {/* Footer */}
              <p className="text-center text-[11px] font-mono text-surface-600">
                Auto-refreshes every 30 seconds · {d!.platform.totalVotesAllTime.toLocaleString()} votes cast all time
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
