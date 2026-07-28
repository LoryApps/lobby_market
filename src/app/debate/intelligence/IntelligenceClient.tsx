'use client'

/**
 * /debate/intelligence — Debate Intelligence Hub
 *
 * A curated analytics view of the debate arena:
 *   • Live debates with real-time viewer counts and audience sway
 *   • Upcoming debates sorted by RSVP interest
 *   • Recent debate outcomes showing which side persuaded the audience
 *   • Top debaters by speaker appearances
 *   • Category breakdown of debate activity
 *   • Platform-level debate stats
 *
 * Distinct from:
 *   /debate            — Simple list of upcoming/live debates
 *   /debate/calendar   — Calendar view of scheduled debates
 *   /debate/archive    — Historical record of all ended debates
 *   /debate/my-record  — Personal debate history
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Calendar,
  Eye,
  Flame,
  Gavel,
  Mic,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  IntelligenceResponse,
  IntelligenceLiveDebate,
  IntelligenceUpcomingDebate,
  IntelligenceRecentOutcome,
  IntelligenceTopDebater,
  IntelligenceCategoryStat,
} from '@/app/api/debates/intelligence/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const m = Math.floor(abs / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const past = diff < 0
  if (m < 2) return 'just now'
  if (m < 60) return past ? `${m}m ago` : `in ${m}m`
  if (h < 24) return past ? `${h}h ago` : `in ${h}h`
  return past ? `${d}d ago` : `in ${d}d`
}


const TYPE_LABEL: Record<string, string> = {
  quick: 'QUICK',
  grand: 'GRAND',
  tribunal: 'TRIBUNAL',
}

const TYPE_COLOR: Record<string, string> = {
  quick: 'text-for-400 bg-for-500/10 border-for-500/30',
  grand: 'text-gold bg-gold/10 border-gold/30',
  tribunal: 'text-purple bg-purple/10 border-purple/30',
}

const CAT_COLOR: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-purple',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

function getCatColor(cat: string | null) {
  return cat ? (CAT_COLOR[cat] ?? 'text-surface-400') : 'text-surface-400'
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Flame; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 gap-1 text-center">
      <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
      <p className="font-mono text-xl font-bold text-white">{value}</p>
      <p className="font-mono text-[10px] text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

function SwayBar({ blue, red, size = 'md' }: { blue: number; red: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-1.5' : 'h-2'
  return (
    <div className={cn('w-full flex rounded-full overflow-hidden', h)} aria-label={`${blue}% FOR, ${red}% AGAINST`}>
      <div className="bg-for-500 transition-all" style={{ width: `${blue}%` }} />
      <div className="bg-against-500 transition-all" style={{ width: `${red}%` }} />
    </div>
  )
}

// ── Live Debate Card ──────────────────────────────────────────────────────────

function LiveDebateCard({ debate }: { debate: IntelligenceLiveDebate }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Link
        href={`/debate/${debate.id}`}
        className="block rounded-2xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors overflow-hidden"
      >
        {/* Live pulse header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-against-500/10 border-b border-against-500/20">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-against-500 animate-pulse" aria-hidden="true" />
            <span className="font-mono text-xs font-bold text-against-400 uppercase tracking-wider">Live Now</span>
          </div>
          <div className="flex items-center gap-1.5 text-surface-400">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="font-mono text-xs">{debate.viewer_count.toLocaleString()} watching</span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Type + category */}
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border', TYPE_COLOR[debate.type] ?? TYPE_COLOR.quick)}>
              {TYPE_LABEL[debate.type] ?? debate.type.toUpperCase()}
            </span>
            {debate.topic_category && (
              <span className={cn('font-mono text-[11px]', getCatColor(debate.topic_category))}>
                {debate.topic_category}
              </span>
            )}
          </div>

          {/* Title */}
          <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2">{debate.title}</p>

          {/* Sway bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between font-mono text-[10px]">
              <span className="text-for-400 font-semibold">FOR {debate.blue_sway}%</span>
              <span className="text-against-400 font-semibold">{debate.red_sway}% AGAINST</span>
            </div>
            <SwayBar blue={debate.blue_sway} red={debate.red_sway} />
          </div>
        </div>

        {/* Topic link */}
        <div className="px-4 py-2 border-t border-surface-300/50 flex items-center justify-between">
          <p className="font-mono text-[11px] text-surface-500 truncate flex-1 mr-2">
            re: {debate.topic_statement}
          </p>
          <ArrowRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" aria-hidden="true" />
        </div>
      </Link>
    </motion.div>
  )
}

// ── Upcoming Debate Row ───────────────────────────────────────────────────────

function UpcomingDebateRow({ debate, rank }: { debate: IntelligenceUpcomingDebate; rank: number }) {
  return (
    <Link
      href={`/debate/${debate.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/60 transition-colors"
    >
      {/* Rank */}
      <span className="font-mono text-surface-600 text-sm font-bold w-5 text-center flex-shrink-0 mt-0.5">{rank}</span>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2">{debate.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border', TYPE_COLOR[debate.type] ?? TYPE_COLOR.quick)}>
            {TYPE_LABEL[debate.type] ?? debate.type.toUpperCase()}
          </span>
          {debate.topic_category && (
            <span className={cn('font-mono text-[10px]', getCatColor(debate.topic_category))}>
              {debate.topic_category}
            </span>
          )}
          <span className="font-mono text-[10px] text-surface-500">
            {relTime(debate.scheduled_at)}
          </span>
        </div>
      </div>

      {/* RSVP count */}
      <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
        <span className="font-mono text-sm font-bold text-white">{debate.rsvp_count}</span>
        <span className="font-mono text-[9px] text-surface-500 uppercase">RSVPs</span>
      </div>
    </Link>
  )
}

// ── Recent Outcome Card ───────────────────────────────────────────────────────

function OutcomeCard({ outcome }: { outcome: IntelligenceRecentOutcome }) {
  const isFor = outcome.winner_side === 'blue'
  const isDraw = outcome.winner_side === 'draw'

  return (
    <Link
      href={`/debate/${outcome.id}`}
      className="flex items-start gap-3 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/60 transition-colors"
    >
      {/* Winner icon */}
      <div className={cn(
        'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
        isDraw ? 'bg-gold/10 border border-gold/30' : isFor ? 'bg-for-500/10 border border-for-500/30' : 'bg-against-500/10 border border-against-500/30'
      )}>
        {isDraw ? (
          <Scale className="h-4 w-4 text-gold" aria-hidden="true" />
        ) : isFor ? (
          <ThumbsUp className="h-4 w-4 text-for-400" aria-hidden="true" />
        ) : (
          <ThumbsDown className="h-4 w-4 text-against-400" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="font-mono text-xs font-semibold text-white leading-snug line-clamp-2">{outcome.title}</p>

        {/* Sway bar */}
        <SwayBar blue={outcome.blue_sway} red={outcome.red_sway} size="sm" />

        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-surface-500">{relTime(outcome.ended_at)}</span>
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3 text-surface-600" aria-hidden="true" />
            <span className="font-mono text-[10px] text-surface-500">{outcome.viewer_count}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ── Top Debater Row ───────────────────────────────────────────────────────────

function TopDebaterRow({ debater, rank }: { debater: IntelligenceTopDebater; rank: number }) {
  return (
    <Link
      href={`/profile/${debater.username}`}
      className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-200/50 transition-colors"
    >
      <span className="font-mono text-surface-600 text-xs font-bold w-5 text-center">{rank}</span>
      <Avatar src={debater.avatar_url} fallback={debater.display_name || debater.username} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm font-semibold text-white truncate">
          {debater.display_name || debater.username}
        </p>
        <p className="font-mono text-[10px] text-surface-500">@{debater.username}</p>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono text-sm font-bold text-white">{debater.speaker_count}</span>
        <span className="font-mono text-[9px] text-surface-500">debates</span>
      </div>
    </Link>
  )
}

// ── Category Stat Row ─────────────────────────────────────────────────────────

function CategoryStatRow({ stat }: { stat: IntelligenceCategoryStat }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={cn('font-mono text-xs font-semibold w-24 truncate', getCatColor(stat.category))}>
        {stat.category}
      </span>

      {/* Bar */}
      <div className="flex-1 h-1.5 rounded-full bg-surface-300/60 overflow-hidden">
        <div
          className={cn('h-full rounded-full', stat.live_count > 0 ? 'bg-against-500' : 'bg-for-500/60')}
          style={{ width: `${Math.min(100, (stat.debate_count / 10) * 100)}%` }}
        />
      </div>

      <div className="flex items-center gap-3 text-right">
        {stat.live_count > 0 && (
          <span className="font-mono text-[10px] text-against-400 font-bold">{stat.live_count} live</span>
        )}
        <span className="font-mono text-xs text-white font-semibold w-8 text-right">{stat.debate_count}</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntelligenceClient() {
  const [data, setData] = useState<IntelligenceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/debates/intelligence', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load debate intelligence')
      const json = await res.json() as IntelligenceResponse
      setData(json)
      setLastUpdated(new Date())
    } catch {
      setError('Could not load debate intelligence data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s when debates are live
  useEffect(() => {
    if (!data || data.live.length === 0) return
    const interval = setInterval(() => load(true), 30_000)
    return () => clearInterval(interval)
  }, [data, load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <Link
              href="/debate"
              aria-label="Back to debates"
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
                <BarChart2 className="h-5 w-5 text-purple" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Debate Intelligence</h1>
                <p className="font-mono text-sm text-surface-500 mt-0.5">
                  Live arena analytics · What&apos;s hot, who&apos;s debating, what moved the needle
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh debate intelligence"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors text-xs font-mono disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
              </div>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && !loading && (
          <EmptyState
            icon={BarChart2}
            title="Could not load debate intelligence"
            description={error}
            action={{
              label: 'Try again',
              onClick: () => load(),
            }}
          />
        )}

        {/* ── Content ───────────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="space-y-8">
            {/* Stats strip */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <StatTile label="Live Now" value={data.stats.live_now} icon={Activity} color="text-against-400" />
              <StatTile label="Upcoming 7d" value={data.stats.upcoming_7d} icon={Calendar} color="text-for-400" />
              <StatTile label="Ended 30d" value={data.stats.ended_30d} icon={Gavel} color="text-gold" />
              <StatTile label="Total RSVPs" value={data.stats.total_rsvps.toLocaleString()} icon={Users} color="text-emerald" />
              <StatTile label="Avg Viewers" value={data.stats.avg_viewer_count} icon={Eye} color="text-purple" />
              <StatTile label="Total" value={data.stats.total_debates.toLocaleString()} icon={BarChart2} color="text-surface-400" />
            </div>

            {/* ── Live + Upcoming ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Live debates */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-base font-bold text-white flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-against-500 animate-pulse" aria-hidden="true" />
                    Live Now
                  </h2>
                  {data.live.length > 0 && (
                    <Link href="/debate" className="font-mono text-xs text-for-400 hover:text-for-300 transition-colors">
                      All debates →
                    </Link>
                  )}
                </div>

                {data.live.length === 0 ? (
                  <EmptyState
                    icon={Mic}
                    iconColor="text-surface-500"
                    title="No live debates"
                    description="Check back soon — debates are scheduled regularly."
                    action={{ label: 'View upcoming', href: '/debate/calendar' }}
                    size="sm"
                  />
                ) : (
                  <div className="space-y-3">
                    {data.live.map((d) => (
                      <LiveDebateCard key={d.id} debate={d} />
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming debates */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-for-400" aria-hidden="true" />
                    Upcoming · Most RSVPs
                  </h2>
                  <Link href="/debate/calendar" className="font-mono text-xs text-for-400 hover:text-for-300 transition-colors">
                    Calendar →
                  </Link>
                </div>

                {data.upcoming.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    iconColor="text-surface-500"
                    title="No upcoming debates"
                    description="Nothing scheduled in the next 7 days."
                    action={{ label: 'Schedule one', href: '/debate/create' }}
                    size="sm"
                  />
                ) : (
                  <div className="space-y-2">
                    {data.upcoming.map((d, i) => (
                      <UpcomingDebateRow key={d.id} debate={d} rank={i + 1} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Recent Outcomes + Top Debaters ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent outcomes */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-base font-bold text-white flex items-center gap-2">
                    <Scale className="h-4 w-4 text-gold" aria-hidden="true" />
                    Recent Outcomes
                  </h2>
                  <Link href="/debate/archive" className="font-mono text-xs text-for-400 hover:text-for-300 transition-colors">
                    Archive →
                  </Link>
                </div>

                {data.recent_outcomes.length === 0 ? (
                  <EmptyState
                    icon={Scale}
                    iconColor="text-surface-500"
                    title="No recent debates"
                    description="No debates have ended in the last 7 days."
                    size="sm"
                  />
                ) : (
                  <div className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                    <div className="divide-y divide-surface-300/50">
                      {data.recent_outcomes.map((o) => (
                        <div key={o.id} className="p-3">
                          <OutcomeCard outcome={o} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top debaters + Category stats */}
              <div className="space-y-6">
                {/* Top debaters */}
                <div>
                  <h2 className="font-mono text-base font-bold text-white flex items-center gap-2 mb-4">
                    <Trophy className="h-4 w-4 text-gold" aria-hidden="true" />
                    Top Debaters
                    <span className="font-mono text-xs font-normal text-surface-500">by speaker appearances</span>
                  </h2>

                  {data.top_debaters.length === 0 ? (
                    <EmptyState
                      icon={Mic}
                      iconColor="text-surface-500"
                      title="No debater data yet"
                      size="sm"
                    />
                  ) : (
                    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-2">
                      {data.top_debaters.map((d, i) => (
                        <TopDebaterRow key={d.user_id} debater={d} rank={i + 1} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Category breakdown */}
                {data.category_stats.length > 0 && (
                  <div>
                    <h2 className="font-mono text-base font-bold text-white flex items-center gap-2 mb-4">
                      <Flame className="h-4 w-4 text-against-400" aria-hidden="true" />
                      Categories
                      <span className="font-mono text-xs font-normal text-surface-500">by debate activity</span>
                    </h2>
                    <div className="rounded-2xl bg-surface-100 border border-surface-300 px-4 py-3 divide-y divide-surface-300/50">
                      {data.category_stats.map((s) => (
                        <CategoryStatRow key={s.category} stat={s} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Quick nav ─────────────────────────────────────────── */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
              <p className="font-mono text-sm text-surface-500 mb-3 uppercase tracking-wider text-xs">Explore debates</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { href: '/debate/create', label: 'Schedule Debate', icon: Mic, color: 'text-for-400' },
                  { href: '/debate/calendar', label: 'Calendar', icon: Calendar, color: 'text-purple' },
                  { href: '/debate/archive', label: 'Archive', icon: Gavel, color: 'text-gold' },
                  { href: '/debate/my-record', label: 'My Record', icon: Trophy, color: 'text-emerald' },
                ].map(({ href, label, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface-200/50 border border-surface-300/50 hover:border-surface-400/60 transition-colors"
                  >
                    <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                    <span className="font-mono text-xs font-medium text-white">{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Last updated */}
            {lastUpdated && (
              <p className="font-mono text-[11px] text-surface-600 text-center">
                Updated {lastUpdated.toLocaleTimeString()} · Refreshes every 30s during live debates
              </p>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
