'use client'

/**
 * /dashboard — Personal Civic Command Centre
 *
 * Aggregates your most important civic data in one view:
 * profile summary, league standing, active predictions, watchlist,
 * today's activity, and quick navigation to key actions.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  BarChart2,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Crown,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  Swords,
  Target,
  ThumbsDown,
  ThumbsUp,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { SeasonProgressCard } from '@/components/season/SeasonProgressCard'
import { cn } from '@/lib/utils/cn'
import type {
  DashboardResponse,
  DashboardPrediction,
  DashboardWatchedTopic,
} from '@/app/api/dashboard/route'
import type { UpcomingRsvpDebate } from '@/app/api/me/upcoming-rsvps/route'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
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

function fmtClout(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  voting: 'text-purple',
  active: 'text-for-400',
  proposed: 'text-surface-500',
  law: 'text-gold',
  failed: 'text-surface-400',
}

const CAT_COLOR: Record<string, string> = {
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

const TIER_GRADIENT: Record<number, string> = {
  0: 'from-surface-300/50 to-surface-400/50',
  1: 'from-for-500/40 to-for-600/40',
  2: 'from-amber-600/50 to-amber-800/50',
  3: 'from-gray-400/50 to-gray-600/50',
  4: 'from-gold/40 to-amber-500/40',
  5: 'from-purple/50 to-violet-600/50',
}

const TIER_TEXT: Record<number, string> = {
  0: 'text-surface-400',
  1: 'text-for-300',
  2: 'text-amber-400',
  3: 'text-gray-300',
  4: 'text-gold',
  5: 'text-purple',
}

const TIER_BAR: Record<number, string> = {
  0: 'bg-surface-400',
  1: 'bg-for-400',
  2: 'bg-amber-500',
  3: 'bg-gray-400',
  4: 'bg-gold',
  5: 'bg-purple',
}

const DEBATE_TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
  quick: 'Quick',
  grand: 'Grand',
  tribunal: 'Tribunal',
}

function timeUntilShort(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 60) return `in ${m}m`
  if (h < 24) return `in ${h}h ${m % 60}m`
  return `in ${d}d`
}

// ─── Upcoming debate row ──────────────────────────────────────────────────────

function UpcomingDebateRow({ debate }: { debate: UpcomingRsvpDebate }) {
  const isLive = debate.status === 'live'
  return (
    <Link
      href={`/debate/${debate.id}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg',
          isLive ? 'bg-against-600/20 text-against-400' : 'bg-purple/15 text-purple'
        )}
      >
        {isLive ? <Mic className="h-3.5 w-3.5" /> : <Swords className="h-3.5 w-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium truncate">{debate.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-surface-500">
            {DEBATE_TYPE_LABEL[debate.type] ?? debate.type}
          </span>
          {debate.topic_category && (
            <span className={cn('text-[10px] font-mono', CAT_COLOR[debate.topic_category] ?? 'text-surface-500')}>
              {debate.topic_category}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        {isLive ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-against-600/25 text-against-300 text-[10px] font-mono font-bold tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse inline-block" />
            Live
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-mono text-purple">
            <Clock className="h-2.5 w-2.5" />
            {timeUntilShort(debate.scheduled_at)}
          </span>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>
      {/* League */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-2.5 w-full rounded-full" />
      </div>
      {/* Missions + Activity */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
      </div>
      {/* Predictions */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        {[0, 1].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-surface-200 border border-surface-300" />
        ))}
      </div>
      {/* Watchlist */}
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-24" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-xl bg-surface-200 border border-surface-300" />
        ))}
      </div>
    </div>
  )
}

// ─── Prediction card ──────────────────────────────────────────────────────────

function PredictionCard({ pred }: { pred: DashboardPrediction }) {
  const forPct = Math.round(pred.blue_pct)
  const crowdLabel = pred.law_confidence !== null
    ? `${Math.round(pred.law_confidence)}% crowd → LAW`
    : null

  return (
    <Link
      href={`/topic/${pred.topic_id}`}
      className="block p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-white font-medium leading-snug line-clamp-2 flex-1">
          {pred.statement}
        </p>
        <span
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border',
            pred.predicted_law
              ? 'bg-for-500/20 border-for-500/40 text-for-300'
              : 'bg-against-500/20 border-against-500/40 text-against-300'
          )}
        >
          {pred.predicted_law ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          {pred.predicted_law ? 'WILL PASS' : 'WILL FAIL'}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
          <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
        </div>
        <span className="text-[10px] font-mono text-surface-400 tabular-nums flex-shrink-0">
          {forPct}% FOR
        </span>
        {crowdLabel && (
          <span className="text-[10px] font-mono text-purple flex-shrink-0">
            {crowdLabel}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Watched topic row ────────────────────────────────────────────────────────

function WatchedRow({ topic }: { topic: DashboardWatchedTopic }) {
  const forPct = Math.round(topic.blue_pct)
  return (
    <Link
      href={`/topic/${topic.topic_id}`}
      className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white font-medium truncate">{topic.statement}</p>
        <div className="flex items-center gap-2 mt-1">
          {topic.category && (
            <span className={cn('text-[10px] font-mono', CAT_COLOR[topic.category] ?? 'text-surface-400')}>
              {topic.category}
            </span>
          )}
          <span className={cn('text-[10px] font-mono font-semibold', STATUS_COLOR[topic.status] ?? 'text-surface-400')}>
            {STATUS_LABEL[topic.status] ?? topic.status}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-[11px] font-mono tabular-nums text-for-400">{forPct}%</p>
        <p className="text-[10px] font-mono text-surface-500">{topic.total_votes.toLocaleString()} votes</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0" />
    </Link>
  )
}

// ─── Quick action button ──────────────────────────────────────────────────────

function QuickAction({
  href,
  icon: Icon,
  label,
  color,
  bg,
  border,
}: {
  href: string
  icon: typeof Vote
  label: string
  color: string
  bg: string
  border: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-colors',
        bg, border, 'hover:border-surface-400'
      )}
    >
      <Icon className={cn('h-5 w-5', color)} />
      <span className={cn('text-[10px] font-mono font-semibold', color)}>{label}</span>
    </Link>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [upcomingDebates, setUpcomingDebates] = useState<UpcomingRsvpDebate[]>([])

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/dashboard')
      if (res.status === 401) {
        setError('Sign in to view your dashboard.')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json() as DashboardResponse
      setData(json)
      setError(null)
    } catch {
      setError('Could not load your dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Fetch upcoming RSVPd debates independently (7-day window)
  useEffect(() => {
    let active = true
    fetch('/api/me/upcoming-rsvps?window_hours=168&limit=5')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setUpcomingDebates(d.debates ?? []) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const QUICK_ACTIONS = [
    { href: '/', icon: Vote, label: 'Vote', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/20' },
    { href: '/debate', icon: Mic, label: 'Debates', color: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/20' },
    { href: '/predictions', icon: Target, label: 'Predict', color: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/20' },
    { href: '/topic/create', icon: Plus, label: 'Propose', color: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/20' },
    { href: '/arcade', icon: Star, label: 'Arcade', color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/20' },
    { href: '/analytics', icon: BarChart2, label: 'Analytics', color: 'text-for-300', bg: 'bg-for-400/10', border: 'border-for-400/20' },
  ] as const

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-12 space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-mono font-bold text-white">Your Dashboard</h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Civic command centre</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {loading && <DashboardSkeleton />}

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <Scale className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-sm text-surface-400">{error}</p>
            {error.includes('Sign in') && (
              <Link
                href="/login"
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-for-400 text-xs font-mono hover:bg-for-500/20 transition-colors"
              >
                Sign in <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        )}

        {/* ── Dashboard content ────────────────────────────────────────────── */}
        {!loading && !error && data && (
          <AnimatePresence mode="wait">
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* ── Profile Card ─────────────────────────────────────────── */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                <div className="flex items-center gap-4">
                  <Avatar
                    src={data.profile.avatar_url}
                    fallback={data.profile.display_name || data.profile.username}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold text-white">
                        {data.profile.display_name || data.profile.username}
                      </h2>
                      <Badge variant={data.profile.role as 'person' | 'debator' | 'troll_catcher' | 'elder'} />
                    </div>
                    <p className="text-xs text-surface-500 font-mono mt-0.5">
                      @{data.profile.username}
                    </p>
                    {data.profile.civic_archetype && (
                      <p className="text-[10px] font-mono text-purple mt-1 capitalize">
                        {data.profile.civic_archetype}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/profile/${data.profile.username}`}
                    className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
                    aria-label="View profile"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-surface-300">
                  {[
                    { label: 'Clout', value: fmtClout(data.profile.clout), icon: Coins, color: 'text-gold' },
                    { label: 'Votes', value: data.profile.total_votes.toLocaleString(), icon: Vote, color: 'text-for-400' },
                    { label: 'Args', value: data.profile.total_arguments.toLocaleString(), icon: MessageSquare, color: 'text-purple' },
                    { label: 'Streak', value: `${data.profile.vote_streak}d`, icon: Flame, color: data.profile.vote_streak >= 7 ? 'text-amber-400' : 'text-surface-400' },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="text-center">
                      <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', color)} />
                      <p className={cn('text-sm font-bold tabular-nums', color)}>{value}</p>
                      <p className="text-[10px] font-mono text-surface-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Civic Season ─────────────────────────────────────────── */}
              <SeasonProgressCard />

              {/* ── League Standing ──────────────────────────────────────── */}
              <div className={cn('rounded-2xl border p-5 bg-gradient-to-br', TIER_GRADIENT[data.league.tier_rank] ?? 'bg-surface-100', 'border-surface-300')}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Crown className={cn('h-4 w-4', TIER_TEXT[data.league.tier_rank] ?? 'text-surface-400')} />
                    <span className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wide">
                      {data.league.season_name} League
                    </span>
                  </div>
                  <Link
                    href="/league"
                    className="text-[10px] font-mono text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    View <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="flex items-baseline gap-2 mb-3">
                  <span className={cn('text-2xl font-bold font-mono', TIER_TEXT[data.league.tier_rank] ?? 'text-white')}>
                    {data.league.tier_name}
                  </span>
                  <span className="text-sm font-mono text-surface-400 tabular-nums">
                    {data.league.monthly_lp.toLocaleString()} LP
                  </span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="h-2 rounded-full bg-surface-300/60 overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', TIER_BAR[data.league.tier_rank] ?? 'bg-for-500')}
                      initial={{ width: 0 }}
                      animate={{ width: `${data.league.progress_pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono text-surface-500">
                      {data.league.progress_pct}% to {data.league.next_tier_name ?? 'max rank'}
                    </span>
                    {data.league.lp_to_next !== null && (
                      <span className={cn('text-[10px] font-mono', TIER_TEXT[data.league.tier_rank] ?? 'text-surface-400')}>
                        {data.league.lp_to_next} LP needed
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[10px] font-mono text-surface-500 mt-2">
                  {data.league.days_left} days left in season
                </p>
              </div>

              {/* ── Today's Progress ─────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                {/* Activity */}
                <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Activity className="h-3.5 w-3.5 text-for-400" />
                    <span className="text-[10px] font-mono font-semibold text-surface-400 uppercase tracking-wide">Today</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-surface-400">Votes</span>
                      <span className={cn('text-sm font-bold font-mono tabular-nums',
                        data.recent_activity.votes_today > 0 ? 'text-for-400' : 'text-surface-500'
                      )}>
                        {data.recent_activity.votes_today}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-surface-400">Arguments</span>
                      <span className={cn('text-sm font-bold font-mono tabular-nums',
                        data.recent_activity.arguments_today > 0 ? 'text-purple' : 'text-surface-500'
                      )}>
                        {data.recent_activity.arguments_today}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono text-surface-400">Clout earned</span>
                      <span className={cn('text-sm font-bold font-mono tabular-nums',
                        data.mission_summary.clout_earned_today > 0 ? 'text-gold' : 'text-surface-500'
                      )}>
                        +{fmtClout(data.mission_summary.clout_earned_today)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Missions */}
                <Link
                  href="/missions"
                  className="rounded-xl bg-surface-100 border border-surface-300 p-4 hover:border-surface-400 transition-colors group"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
                    <span className="text-[10px] font-mono font-semibold text-surface-400 uppercase tracking-wide">Missions</span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-bold font-mono text-white tabular-nums">
                      {data.mission_summary.completed}
                    </span>
                    <span className="text-sm font-mono text-surface-500">
                      / {data.mission_summary.total}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full bg-emerald rounded-full transition-all duration-700"
                      style={{ width: `${(data.mission_summary.completed / data.mission_summary.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-emerald mt-1.5 group-hover:underline">
                    {data.mission_summary.completed === data.mission_summary.total
                      ? 'All done!'
                      : 'Complete daily missions'}
                  </p>
                </Link>
              </div>

              {/* ── Upcoming Debates ─────────────────────────────────────── */}
              {upcomingDebates.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Swords className="h-4 w-4 text-purple" />
                      <h3 className="text-sm font-mono font-semibold text-white">Your Debates</h3>
                    </div>
                    <Link
                      href="/debate"
                      className="text-[10px] font-mono text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {upcomingDebates.map((debate) => (
                      <UpcomingDebateRow key={debate.id} debate={debate} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active Predictions ───────────────────────────────────── */}
              {data.predictions.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-emerald" />
                      <h3 className="text-sm font-mono font-semibold text-white">Active Predictions</h3>
                    </div>
                    <Link
                      href="/predictions"
                      className="text-[10px] font-mono text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.predictions.map((pred) => (
                      <PredictionCard key={pred.topic_id} pred={pred} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Watchlist ────────────────────────────────────────────── */}
              {data.watched_topics.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-4 w-4 text-gold" />
                      <h3 className="text-sm font-mono font-semibold text-white">Watchlist</h3>
                    </div>
                    <Link
                      href="/watchlist"
                      className="text-[10px] font-mono text-surface-500 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.watched_topics.map((topic) => (
                      <WatchedRow key={topic.topic_id} topic={topic} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Latest Law ───────────────────────────────────────────── */}
              {data.last_law && (
                <Link
                  href={`/topic/${data.last_law.topic_id}`}
                  className="flex items-center gap-3 p-4 rounded-xl bg-gold/5 border border-gold/20 hover:border-gold/40 transition-colors group"
                >
                  <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <Gavel className="h-4 w-4 text-gold" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-mono text-gold uppercase tracking-wide font-semibold">
                      Latest Law
                    </p>
                    <p className="text-xs text-white font-medium truncate mt-0.5">
                      {data.last_law.statement}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                      {relTime(data.last_law.established_at)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0" />
                </Link>
              )}

              {/* ── Quick Actions ────────────────────────────────────────── */}
              <div>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mb-2 px-1">
                  Quick Actions
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_ACTIONS.map((action) => (
                    <QuickAction key={action.href} {...action} />
                  ))}
                </div>
              </div>

              {/* ── No predictions / watchlist empty state ───────────────── */}
              {data.predictions.length === 0 && data.watched_topics.length === 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 text-center">
                  <Sparkles className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                  <p className="text-sm font-medium text-white mb-1">Your dashboard is ready</p>
                  <p className="text-xs text-surface-500 mb-4">
                    Start voting, making predictions, or watching topics to personalise this view.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Link
                      href="/"
                      className="px-3 py-1.5 rounded-lg bg-for-500/10 border border-for-500/30 text-for-400 text-xs font-mono hover:bg-for-500/20 transition-colors"
                    >
                      Vote now
                    </Link>
                    <Link
                      href="/predictions"
                      className="px-3 py-1.5 rounded-lg bg-emerald/10 border border-emerald/30 text-emerald text-xs font-mono hover:bg-emerald/20 transition-colors"
                    >
                      Predict
                    </Link>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
