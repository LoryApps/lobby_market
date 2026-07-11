'use client'

/**
 * /daily — Daily Civic Action Center
 *
 * A personalized daily dashboard telling users WHAT TO DO today:
 *  • Personal vote quota & streak status
 *  • Hot topics (most vote activity in last 24h)
 *  • Upcoming debates (next 24h)
 *  • Recent laws (this week)
 *  • Your active engagements (voted topics with new arguments)
 *  • Recommended topics matching your category preferences
 *  • Controversy of the Day (closest to 50/50 split)
 *
 * Distinct from:
 *   /pulse    — live argument feed (what others are saying right now)
 *   /digest   — weekly retrospective roundup
 *   /weekly   — weekly stats summary
 *   /trending — most votes overall, not time-windowed
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Award,
  BarChart2,
  Bell,
  Calendar,
  Flame,
  Gavel,
  GitMerge,
  Landmark,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DailyResponse, DailyTopic, DailyDebate, DailyLaw, DailyEngagement } from '@/app/api/daily/route'
import type { PendingMirrorTopic } from '@/app/api/me/pending-mirrors/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const m = Math.floor(abs / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (diff > 0) {
    if (m < 60) return `in ${m}m`
    if (h < 24) return `in ${h}h`
    return `in ${d}d`
  }
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400 bg-for-500/10 border-for-500/30',
  Economics:   'text-gold bg-gold/10 border-gold/30',
  Technology:  'text-purple bg-purple/10 border-purple/30',
  Science:     'text-emerald bg-emerald/10 border-emerald/30',
  Ethics:      'text-for-300 bg-for-400/10 border-for-400/30',
  Philosophy:  'text-purple bg-purple/10 border-purple/30',
  Culture:     'text-against-400 bg-against-500/10 border-against-500/30',
  Health:      'text-emerald bg-emerald/10 border-emerald/30',
  Environment: 'text-emerald bg-emerald/10 border-emerald/30',
  Education:   'text-gold bg-gold/10 border-gold/30',
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null
  const cls = CATEGORY_COLORS[category] ?? 'text-surface-300 bg-surface-300/10 border-surface-400/30'
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border', cls)}>
      {category}
    </span>
  )
}

function VoteBar({ pct, size = 'sm' }: { pct: number; size?: 'sm' | 'xs' }) {
  const h = size === 'xs' ? 'h-1' : 'h-1.5'
  return (
    <div className={cn('w-full rounded-full bg-surface-300/50 overflow-hidden', h)}>
      <div
        className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  color = 'text-for-400',
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300', color.replace('text-', 'border-').replace('-400', '-500/30').replace('-300', '-400/30'))}>
        <Icon className={cn('h-4.5 w-4.5', color)} />
      </div>
      <div>
        <h2 className="font-mono text-sm font-bold text-white">{title}</h2>
        {subtitle && <p className="text-[11px] text-surface-400">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Personal status card ─────────────────────────────────────────────────────

function PersonalStatusCard({ personal, auth }: {
  personal: DailyResponse['personal']
  auth: boolean
}) {
  if (!auth || !personal) {
    return (
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center">
          <Vote className="h-5 w-5 text-surface-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Sign in to track your civic activity</p>
          <p className="text-xs text-surface-400 mt-0.5">See your vote quota, streak, and personalized recommendations.</p>
        </div>
        <Link
          href="/login"
          className="flex-shrink-0 px-4 py-2 rounded-lg bg-for-600/20 border border-for-500/40 text-for-400 text-xs font-mono font-semibold hover:bg-for-600/30 transition-colors"
        >
          Sign in
        </Link>
      </div>
    )
  }

  const votesLeft = personal.daily_limit - personal.votes_used
  const votePct = Math.round((personal.votes_used / personal.daily_limit) * 100)
  const streakColor = personal.vote_streak >= 30 ? 'text-gold' : personal.vote_streak >= 7 ? 'text-emerald' : 'text-for-400'

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-start gap-4">
        <Link href={`/profile/${personal.username}`}>
          <Avatar
            src={personal.avatar_url}
            fallback={personal.display_name ?? personal.username}
            size="md"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/profile/${personal.username}`} className="font-semibold text-white text-sm hover:text-for-300 transition-colors">
              {personal.display_name ?? personal.username}
            </Link>
            {personal.rank && (
              <span className="text-[10px] font-mono text-surface-400">#{personal.rank.toLocaleString()} ranked</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-gold" />
              <span className="text-xs font-mono text-gold font-semibold">{personal.clout.toLocaleString()} clout</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className={cn('h-3 w-3', streakColor)} />
              <span className={cn('text-xs font-mono font-semibold', streakColor)}>{personal.vote_streak}d streak</span>
            </div>
          </div>
        </div>
        <Link
          href="/analytics"
          className="flex-shrink-0 text-[11px] font-mono text-surface-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Stats
        </Link>
      </div>

      {/* Vote quota */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-surface-400 font-mono">Today&apos;s votes</span>
          <span className={cn('text-xs font-mono font-bold', votesLeft === 0 ? 'text-against-400' : votesLeft <= 3 ? 'text-gold' : 'text-for-400')}>
            {votesLeft} / {personal.daily_limit} remaining
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-300/50 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              votePct >= 100 ? 'bg-against-500' : votePct >= 70 ? 'bg-gold' : 'bg-for-500'
            )}
            style={{ width: `${Math.min(100, votePct)}%` }}
          />
        </div>
        {votesLeft === 0 && personal.reset_at && (
          <p className="text-[11px] text-against-400 font-mono">
            Resets {relTime(personal.reset_at)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Hot topic card ───────────────────────────────────────────────────────────

function HotTopicCard({ topic, rank }: { topic: DailyTopic; rank: number }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link href={`/topic/${topic.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.05 }}
        className="group rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 transition-all hover:bg-surface-200/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            <span className="flex-shrink-0 text-xs font-mono text-surface-500 mt-0.5 w-5 text-right">
              {rank + 1}.
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
                {topic.statement}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <CategoryBadge category={topic.category} />
                {topic.has_active_debate && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-against-500/10 border border-against-500/30 text-against-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
                    LIVE
                  </span>
                )}
                {topic.vote_delta_24h && topic.vote_delta_24h > 0 && (
                  <span className="text-[10px] font-mono text-emerald">
                    +{topic.vote_delta_24h} votes/24h
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-sm font-mono font-bold text-for-400">{forPct}%</div>
            <div className="text-[10px] font-mono text-surface-500">{againstPct}% against</div>
          </div>
        </div>
        <VoteBar pct={forPct} size="xs" />
      </motion.div>
    </Link>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: DailyDebate }) {
  const isLive = debate.status === 'live'

  return (
    <Link href={`/debate/${debate.id}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="group rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 transition-all hover:bg-surface-200/50"
      >
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-xl border',
            isLive
              ? 'bg-against-500/10 border-against-500/30'
              : 'bg-for-500/10 border-for-500/30'
          )}>
            {isLive
              ? <span className="h-2 w-2 rounded-full bg-against-400 animate-pulse" />
              : <Mic className={cn('h-4 w-4', isLive ? 'text-against-400' : 'text-for-400')} />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white line-clamp-2 group-hover:text-for-300 transition-colors">
              {debate.title ?? debate.topic_statement}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className={cn(
                'text-[11px] font-mono font-semibold',
                isLive ? 'text-against-400' : 'text-for-300'
              )}>
                {isLive ? 'LIVE NOW' : relTime(debate.scheduled_at)}
              </span>
              {debate.topic_category && (
                <CategoryBadge category={debate.topic_category} />
              )}
            </div>
          </div>
          {debate.participant_count > 0 && (
            <div className="flex-shrink-0 text-right">
              <div className="text-[11px] font-mono text-surface-400">{debate.participant_count} RSVPs</div>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: DailyLaw }) {
  return (
    <Link href={`/topic/${law.topic_id}`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/40 hover:bg-gold/5 transition-all"
      >
        <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30">
          <Gavel className="h-3.5 w-3.5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white line-clamp-2 group-hover:text-gold transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <CategoryBadge category={law.category} />
            <span className="text-[10px] font-mono text-surface-500">{relTime(law.established_at)}</span>
          </div>
        </div>
        <Gavel className="flex-shrink-0 h-3.5 w-3.5 text-gold/40 group-hover:text-gold transition-colors mt-0.5" />
      </motion.div>
    </Link>
  )
}

// ─── Engagement card ──────────────────────────────────────────────────────────

function EngagementCard({ item }: { item: DailyEngagement }) {
  return (
    <Link href={`/topic/${item.topic_id}/arguments`}>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="group flex items-start gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all"
      >
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border',
          item.user_side === 'for'
            ? 'bg-for-500/10 border-for-500/30'
            : 'bg-against-500/10 border-against-500/30'
        )}>
          {item.user_side === 'for'
            ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
            : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white line-clamp-2 group-hover:text-for-300 transition-colors">
            {item.statement}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <CategoryBadge category={item.category} />
            <span className="text-[10px] font-mono text-emerald font-semibold">
              +{item.new_arguments} new {item.new_arguments === 1 ? 'argument' : 'arguments'}
            </span>
          </div>
        </div>
        <ArrowRight className="flex-shrink-0 h-3.5 w-3.5 text-surface-400 group-hover:text-white transition-colors mt-0.5" />
      </motion.div>
    </Link>
  )
}

// ─── Platform stat tile ───────────────────────────────────────────────────────

function StatTile({ label, value, icon: Icon, color = 'text-for-400' }: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  color?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300">
      <Icon className={cn('h-4 w-4', color)} />
      <div className={cn('text-lg font-mono font-bold tabular-nums', color)}>
        {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString()}
      </div>
      <div className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DailySkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        {[0, 1].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    </div>
  )
}

// ─── Pending mirror votes ─────────────────────────────────────────────────────

function MirrorTopicRow({ topic }: { topic: PendingMirrorTopic }) {
  const isFor = topic.delegateSide === 'blue'
  const displayName = topic.delegateDisplayName || `@${topic.delegateUsername}`
  const scopeLabel =
    topic.delegationScope === 'topic'
      ? 'topic delegate'
      : topic.delegationScope === 'category'
      ? `${topic.category} delegate`
      : 'global delegate'

  return (
    <Link
      href={`/topic/${topic.topicId}`}
      className="flex items-start gap-3 rounded-xl border border-surface-300 bg-surface-100 p-3 hover:border-surface-400 hover:bg-surface-200/50 transition-all group"
    >
      <div className="flex-shrink-0 mt-0.5">
        <Avatar
          src={topic.delegateAvatarUrl}
          fallback={displayName}
          size="xs"
        />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-surface-400 mb-1 leading-tight truncate">
          <span className="text-white font-semibold">{displayName}</span>
          <span className="text-surface-600"> · {scopeLabel} · voted </span>
          <span className={cn('font-bold', isFor ? 'text-for-300' : 'text-against-300')}>
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
        </p>
        <p className="text-xs font-mono text-surface-300 line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {topic.statement}
        </p>
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <CategoryBadge category={topic.category} />
        <div className="w-14">
          <VoteBar pct={topic.bluePct} size="xs" />
        </div>
      </div>
    </Link>
  )
}

function DelegateMirrorsSection({ auth }: { auth: boolean }) {
  const [topics, setTopics] = useState<PendingMirrorTopic[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth) { setLoading(false); return }
    let cancelled = false
    fetch('/api/me/pending-mirrors')
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((data) => { if (!cancelled) setTopics(data.topics ?? []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [auth])

  if (!auth || loading || topics.length === 0) return null

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <SectionHeader
          icon={GitMerge}
          title="Pending Mirror Votes"
          subtitle={`${topics.length} topic${topics.length !== 1 ? 's' : ''} voted on by your delegate — review and optionally mirror`}
          color="text-purple"
        />
        <div className="space-y-2">
          {topics.map((t) => (
            <MirrorTopicRow key={t.topicId} topic={t} />
          ))}
        </div>
        <Link
          href="/delegate/inbox"
          className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-purple/20 text-xs font-mono text-purple/70 hover:text-purple hover:border-purple/40 transition-all"
        >
          Open mirror inbox <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </motion.section>
    </AnimatePresence>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DailyClient() {
  const [data, setData] = useState<DailyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch('/api/daily')
      if (!res.ok) throw new Error('Failed to load daily briefing')
      const json: DailyResponse = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-10 space-y-8">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-for-400" />
              <h1 className="font-mono text-2xl font-bold text-white">Daily Briefing</h1>
            </div>
            {data && (
              <p className="text-sm text-surface-400 font-mono">
                {formatDate(data.today)}
              </p>
            )}
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs font-mono text-surface-300 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading && <DailySkeleton />}

        {error && !loading && (
          <EmptyState
            icon={Activity}
            title="Couldn't load briefing"
            description={error}
            actions={[{ label: 'Retry', onClick: () => load() }]}
          />
        )}

        {data && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

            {/* ── Personal Status ── */}
            <section>
              <PersonalStatusCard personal={data.personal} auth={data.auth} />
            </section>

            {/* ── Platform Snapshot ── */}
            <section>
              <SectionHeader
                icon={Activity}
                title="Platform Today"
                subtitle="Live civic activity snapshot"
                color="text-emerald"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile label="Active Topics" value={data.platform.active_topics} icon={Scale} color="text-for-400" />
                <StatTile label="Votes / 24h" value={data.platform.votes_last_24h} icon={Vote} color="text-emerald" />
                <StatTile label="Laws This Week" value={data.platform.laws_this_week} icon={Gavel} color="text-gold" />
                <StatTile label="Debates Today" value={data.platform.debates_today} icon={Mic} color="text-against-400" />
              </div>
            </section>

            {/* ── Controversy of the Day ── */}
            {data.controversy_of_day && (
              <section>
                <SectionHeader
                  icon={Flame}
                  title="Controversy of the Day"
                  subtitle="The most contested split right now"
                  color="text-against-400"
                />
                <Link href={`/topic/${data.controversy_of_day.id}`}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group rounded-2xl bg-gradient-to-br from-surface-100 to-surface-200/50 border border-against-500/30 hover:border-against-500/60 p-5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <p className="text-base font-semibold text-white leading-snug line-clamp-3 group-hover:text-against-300 transition-colors flex-1">
                        {data.controversy_of_day.statement}
                      </p>
                      <CategoryBadge category={data.controversy_of_day.category} />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-for-400 font-bold">{Math.round(data.controversy_of_day.blue_pct)}% FOR</span>
                        <span className="text-against-400 font-bold">{100 - Math.round(data.controversy_of_day.blue_pct)}% AGAINST</span>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden bg-against-600/40">
                        <div
                          className="h-full bg-for-500 transition-all rounded-full"
                          style={{ width: `${data.controversy_of_day.blue_pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] font-mono text-surface-400">
                        {data.controversy_of_day.total_votes.toLocaleString()} total votes
                        {data.controversy_of_day.vote_delta_24h ? ` · +${data.controversy_of_day.vote_delta_24h} in last 24h` : ''}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              </section>
            )}

            {/* ── Hot Topics ── */}
            {data.hot_topics.length > 0 && (
              <section>
                <SectionHeader
                  icon={TrendingUp}
                  title="Hot Right Now"
                  subtitle="Most vote activity in the last 24 hours"
                  color="text-for-400"
                />
                <div className="space-y-2">
                  {data.hot_topics.map((topic, i) => (
                    <HotTopicCard key={topic.id} topic={topic} rank={i} />
                  ))}
                </div>
                <Link
                  href="/trending"
                  className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  See all trending <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {/* ── Your Engagements ── */}
            {data.auth && data.your_engagements.length > 0 && (
              <section>
                <SectionHeader
                  icon={Bell}
                  title="Your Active Debates"
                  subtitle="Topics you voted on with new argument activity"
                  color="text-purple"
                />
                <div className="space-y-2">
                  {data.your_engagements.map(item => (
                    <EngagementCard key={item.topic_id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Pending Mirror Votes (liquid democracy) ── */}
            <DelegateMirrorsSection auth={!!data.auth} />

            {/* ── Recommended Topics ── */}
            {data.recommended_topics.length > 0 && (
              <section>
                <SectionHeader
                  icon={Sparkles}
                  title="For You to Vote On"
                  subtitle={data.personal?.category_preferences.length ? `Based on your ${data.personal.category_preferences.slice(0, 2).join(', ')} preferences` : 'Popular active topics'}
                  color="text-gold"
                />
                <div className="space-y-2">
                  {data.recommended_topics.map((topic, i) => (
                    <HotTopicCard key={topic.id} topic={topic} rank={i} />
                  ))}
                </div>
                <Link
                  href="/discover"
                  className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  Explore more topics <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {/* ── Upcoming Debates ── */}
            {data.upcoming_debates.length > 0 && (
              <section>
                <SectionHeader
                  icon={Calendar}
                  title="Upcoming Debates"
                  subtitle="Live and scheduled in the next 24 hours"
                  color="text-against-400"
                />
                <div className="space-y-2">
                  {data.upcoming_debates.map(debate => (
                    <DebateCard key={debate.id} debate={debate} />
                  ))}
                </div>
                <Link
                  href="/debate"
                  className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  See all debates <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {/* ── Recent Laws ── */}
            {data.recent_laws.length > 0 && (
              <section>
                <SectionHeader
                  icon={Gavel}
                  title="Laws Established This Week"
                  subtitle="Consensus turned into law"
                  color="text-gold"
                />
                <div className="space-y-2">
                  {data.recent_laws.map(law => (
                    <LawCard key={law.id} law={law} />
                  ))}
                </div>
                <Link
                  href="/laws"
                  className="mt-3 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                >
                  View all laws <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </section>
            )}

            {/* ── No activity fallback ── */}
            {data.hot_topics.length === 0 && data.upcoming_debates.length === 0 && data.recent_laws.length === 0 && (
              <EmptyState
                icon={Landmark}
                title="The Lobby is quiet today"
                description="No active debates or recent vote activity. Be the first to start a discussion."
                actions={[{ label: 'Explore topics', href: '/discover' }]}
              />
            )}

            {/* ── Quick links ── */}
            <section>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Leaderboard', href: '/leaderboard', icon: Award, color: 'text-gold' },
                  { label: 'Discover', href: '/discover', icon: Sparkles, color: 'text-for-400' },
                  { label: 'Analytics', href: '/analytics', icon: BarChart2, color: 'text-emerald' },
                ].map(({ label, href, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200/50 transition-all group"
                  >
                    <Icon className={cn('h-5 w-5', color)} />
                    <span className="text-[11px] font-mono text-surface-400 group-hover:text-white transition-colors">{label}</span>
                  </Link>
                ))}
              </div>
            </section>

          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
