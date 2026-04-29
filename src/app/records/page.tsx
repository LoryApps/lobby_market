'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
  Eye,
  Mic,
  BarChart2,
  ChevronRight,
  Crown,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  RecordsResponse,
  RecordTopic,
  RecordProfile,
} from '@/app/api/records/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  const months = Math.floor(d / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  const rem = Math.round(hours % 24)
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

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
  Education: 'text-purple',
}

function catColor(cat: string | null) {
  return cat ? (CAT_COLOR[cat] ?? 'text-surface-400') : 'text-surface-400'
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  label,
  icon: Icon,
  iconColor,
  iconBg,
  children,
  delay = 0,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('p-1.5 rounded-lg flex-shrink-0', iconBg)}>
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <span className="text-xs font-mono font-semibold uppercase tracking-widest text-surface-500">
          {label}
        </span>
      </div>
      {children}
    </motion.div>
  )
}

// ─── Record card ─────────────────────────────────────────────────────────────

function RecordCard({
  medal,
  medalColor,
  medalBg,
  title,
  description,
  href,
  children,
}: {
  medal: string
  medalColor: string
  medalBg: string
  title: string
  description: string
  href?: string
  children: React.ReactNode
}) {
  const inner = (
    <div
      className={cn(
        'bg-surface-100 border border-surface-300 rounded-2xl p-4 flex flex-col gap-3',
        'transition-all duration-200',
        href && 'hover:border-surface-400 hover:bg-surface-200/60 cursor-pointer'
      )}
    >
      {/* Medal row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center justify-center h-7 w-7 rounded-full text-sm font-bold flex-shrink-0',
              medalBg
            )}
          >
            <span className={medalColor}>{medal}</span>
          </span>
          <div>
            <p className="text-[11px] font-mono font-bold uppercase tracking-widest text-surface-500">
              {title}
            </p>
            <p className="text-[10px] font-mono text-surface-600 mt-0.5">{description}</p>
          </div>
        </div>
        {href && <ChevronRight className="h-4 w-4 text-surface-600 flex-shrink-0 mt-0.5" />}
      </div>

      {/* Content */}
      {children}
    </div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return inner
}

// ─── Topic record card ────────────────────────────────────────────────────────

function TopicRecordCard({
  topic,
  medal,
  medalColor,
  medalBg,
  title,
  description,
  metric,
  metricLabel,
  metricColor,
}: {
  topic: RecordTopic
  medal: string
  medalColor: string
  medalBg: string
  title: string
  description: string
  metric: number
  metricLabel: string
  metricColor: string
}) {
  return (
    <RecordCard
      medal={medal}
      medalColor={medalColor}
      medalBg={medalBg}
      title={title}
      description={description}
      href={`/topic/${topic.id}`}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-mono text-white leading-snug line-clamp-2">
          &ldquo;{topic.statement}&rdquo;
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {topic.category && (
              <span className={cn('text-[11px] font-mono', catColor(topic.category))}>
                {topic.category}
              </span>
            )}
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              {topic.status === 'law' ? 'LAW' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
            </Badge>
          </div>
          <div className="text-right">
            <span className={cn('text-base font-mono font-bold', metricColor)}>
              {metric.toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-surface-500 ml-1">{metricLabel}</span>
          </div>
        </div>
      </div>
    </RecordCard>
  )
}

// ─── Profile record card ──────────────────────────────────────────────────────

function ProfileRecordCard({
  profile,
  medal,
  medalColor,
  medalBg,
  title,
  description,
  metric,
  metricLabel,
  metricColor,
  metricIcon: MetricIcon,
}: {
  profile: RecordProfile
  medal: string
  medalColor: string
  medalBg: string
  title: string
  description: string
  metric: number
  metricLabel: string
  metricColor: string
  metricIcon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <RecordCard
      medal={medal}
      medalColor={medalColor}
      medalBg={medalBg}
      title={title}
      description={description}
      href={`/profile/${profile.username}`}
    >
      <div className="flex items-center gap-3">
        <Avatar
          src={profile.avatar_url}
          fallback={profile.display_name ?? profile.username}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white truncate">
            {profile.display_name ?? profile.username}
          </p>
          <p className="text-[11px] font-mono text-surface-500">@{profile.username}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 justify-end">
            {MetricIcon && <MetricIcon className={cn('h-3.5 w-3.5', metricColor)} />}
            <span className={cn('text-base font-mono font-bold', metricColor)}>
              {metric.toLocaleString()}
            </span>
          </div>
          <p className="text-[10px] font-mono text-surface-500">{metricLabel}</p>
        </div>
      </div>
    </RecordCard>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function RecordSkeleton() {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-7 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-32" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

// ─── Platform stat pill ───────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  iconColor,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  value: number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl px-3 py-2.5 min-w-0">
      <Icon className={cn('h-4 w-4', iconColor)} />
      <span className="text-lg font-mono font-bold text-white">
        <AnimatedNumber value={value} />
      </span>
      <span className="text-[10px] font-mono text-surface-500 text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const [data, setData] = useState<RecordsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/records', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load records')
      setData(await res.json())
    } catch {
      setError('Could not load platform records. Try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 pt-5 pb-24 md:pb-8">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 mb-6"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-5 w-5 text-gold" />
              <h1 className="text-2xl font-mono font-bold text-white tracking-tight">
                Civic Records
              </h1>
            </div>
            <p className="text-sm font-mono text-surface-500">
              The all-time records of Lobby Market — the most extreme, the fastest, the best.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh records"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
              'bg-surface-200 border border-surface-300 text-surface-400',
              'hover:text-surface-200 hover:border-surface-400 transition-colors disabled:opacity-40'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </motion.div>

        {/* ── Platform totals ──────────────────────────────────────────── */}
        {(loading || data) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-8"
          >
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface-600 mb-3">
              Platform at a glance
            </p>
            {loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <StatPill icon={BarChart2} iconColor="text-for-400" value={data!.platformTotals.totalTopics} label="Topics" />
                <StatPill icon={Gavel} iconColor="text-gold" value={data!.platformTotals.totalLaws} label="Laws" />
                <StatPill icon={Zap} iconColor="text-emerald" value={data!.platformTotals.totalVotes} label="Votes" />
                <StatPill icon={MessageSquare} iconColor="text-purple" value={data!.platformTotals.totalArguments} label="Arguments" />
                <StatPill icon={Users} iconColor="text-for-300" value={data!.platformTotals.totalUsers} label="Citizens" />
                <StatPill icon={Mic} iconColor="text-against-300" value={data!.platformTotals.totalDebates} label="Debates" />
              </div>
            )}
          </motion.div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <EmptyState
                icon={Trophy}
                title="Records unavailable"
                description={error ?? undefined}
                actions={[{ label: 'Retry', onClick: () => load() }]}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading skeletons ────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <RecordSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ── Records grid ────────────────────────────────────────────── */}
        {!loading && data && (
          <div className="flex flex-col gap-8">

            {/* ── Topics section ──────────────────────────────────────── */}
            <Section
              label="Topic Records"
              icon={BarChart2}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              delay={0.1}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {data.mostVoted ? (
                  <TopicRecordCard
                    topic={data.mostVoted}
                    medal="🏆"
                    medalColor="text-gold"
                    medalBg="bg-gold/15"
                    title="Most Voted"
                    description="Topic with the most votes ever cast"
                    metric={data.mostVoted.total_votes}
                    metricLabel="votes"
                    metricColor="text-for-400"
                  />
                ) : (
                  <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 flex items-center justify-center min-h-[120px]">
                    <p className="text-xs font-mono text-surface-600">No data yet</p>
                  </div>
                )}

                {data.mostContested ? (
                  <TopicRecordCard
                    topic={data.mostContested}
                    medal="⚖️"
                    medalColor="text-against-300"
                    medalBg="bg-against-500/15"
                    title="Most Contested"
                    description={`Closest split — ${Math.round(data.mostContested.blue_pct)}% FOR / ${100 - Math.round(data.mostContested.blue_pct)}% AGAINST`}
                    metric={data.mostContested.total_votes}
                    metricLabel="votes"
                    metricColor="text-against-300"
                  />
                ) : (
                  <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 flex items-center justify-center min-h-[120px]">
                    <p className="text-xs font-mono text-surface-600">No data yet</p>
                  </div>
                )}

                {data.mostViewed ? (
                  <TopicRecordCard
                    topic={data.mostViewed}
                    medal="👁️"
                    medalColor="text-purple"
                    medalBg="bg-purple/15"
                    title="Most Viewed"
                    description="Topic page with the most visits"
                    metric={data.mostViewed.view_count}
                    metricLabel="views"
                    metricColor="text-purple"
                  />
                ) : null}

                {data.mostDebated ? (
                  <TopicRecordCard
                    topic={data.mostDebated}
                    medal="💬"
                    medalColor="text-emerald"
                    medalBg="bg-emerald/15"
                    title="Most Argued"
                    description="Topic that sparked the most arguments"
                    metric={0}
                    metricLabel="arguments"
                    metricColor="text-emerald"
                  />
                ) : null}

              </div>
            </Section>

            {/* ── Laws section ────────────────────────────────────────── */}
            {data.fastestLaw && (
              <Section
                label="Law Records"
                icon={Gavel}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                delay={0.15}
              >
                <RecordCard
                  medal="⚡"
                  medalColor="text-gold"
                  medalBg="bg-gold/15"
                  title="Fastest Law Ever"
                  description="Shortest time from proposal to becoming law"
                  href={`/law/${data.fastestLaw.id}`}
                >
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-mono text-white leading-snug line-clamp-2">
                      &ldquo;{data.fastestLaw.statement}&rdquo;
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      {data.fastestLaw.category && (
                        <span className={cn('text-[11px] font-mono', catColor(data.fastestLaw.category))}>
                          {data.fastestLaw.category}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Clock className="h-3 w-3 text-gold" />
                        <span className="text-base font-mono font-bold text-gold">
                          {formatDuration(data.fastestLaw.hours_to_law!)}
                        </span>
                        <span className="text-[10px] font-mono text-surface-500">proposal → law</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500">
                      <span>{data.fastestLaw.total_votes.toLocaleString()} votes</span>
                      <span className="text-surface-600">·</span>
                      <span>Established {relativeTime(data.fastestLaw.established_at)}</span>
                    </div>
                  </div>
                </RecordCard>
              </Section>
            )}

            {/* ── Arguments section ────────────────────────────────────── */}
            {data.mostUpvotedArgument && (
              <Section
                label="Argument Records"
                icon={MessageSquare}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                delay={0.2}
              >
                <RecordCard
                  medal="🌟"
                  medalColor="text-purple"
                  medalBg="bg-purple/15"
                  title="Most Upvoted Argument"
                  description="The single argument that resonated most with the community"
                  href={data.mostUpvotedArgument.topic ? `/topic/${data.mostUpvotedArgument.topic.id}` : undefined}
                >
                  <div className="flex flex-col gap-3">
                    {/* Side badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
                          data.mostUpvotedArgument.side === 'blue'
                            ? 'bg-for-500/15 text-for-300 border-for-500/30'
                            : 'bg-against-500/15 text-against-300 border-against-500/30'
                        )}
                      >
                        {data.mostUpvotedArgument.side === 'blue' ? 'FOR' : 'AGAINST'}
                      </span>
                      {data.mostUpvotedArgument.topic?.category && (
                        <span className={cn('text-[11px] font-mono', catColor(data.mostUpvotedArgument.topic.category))}>
                          {data.mostUpvotedArgument.topic.category}
                        </span>
                      )}
                    </div>

                    {/* Argument text */}
                    <p className="text-sm font-mono text-white leading-snug line-clamp-3 italic">
                      &ldquo;{data.mostUpvotedArgument.content}&rdquo;
                    </p>

                    {/* Author + upvotes */}
                    <div className="flex items-center justify-between gap-2">
                      {data.mostUpvotedArgument.author && (
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar
                            src={data.mostUpvotedArgument.author.avatar_url}
                            fallback={
                              data.mostUpvotedArgument.author.display_name ??
                              data.mostUpvotedArgument.author.username
                            }
                            size="xs"
                          />
                          <span className="text-[11px] font-mono text-surface-400 truncate">
                            @{data.mostUpvotedArgument.author.username}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <ThumbsUp className="h-3.5 w-3.5 text-purple" />
                        <span className="text-base font-mono font-bold text-purple">
                          {data.mostUpvotedArgument.upvotes.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-mono text-surface-500">upvotes</span>
                      </div>
                    </div>

                    {/* Topic reference */}
                    {data.mostUpvotedArgument.topic && (
                      <div className="bg-surface-200/60 border border-surface-300/50 rounded-lg px-3 py-2">
                        <p className="text-[11px] font-mono text-surface-400 leading-snug line-clamp-1">
                          On: &ldquo;{data.mostUpvotedArgument.topic.statement}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>
                </RecordCard>
              </Section>
            )}

            {/* ── Debate records ───────────────────────────────────────── */}
            {data.biggestDebate && (
              <Section
                label="Debate Records"
                icon={Mic}
                iconColor="text-against-300"
                iconBg="bg-against-500/10"
                delay={0.25}
              >
                <RecordCard
                  medal="🎙️"
                  medalColor="text-against-300"
                  medalBg="bg-against-500/15"
                  title="Biggest Debate"
                  description="Most-watched live debate in Lobby history"
                  href={`/debate/${data.biggestDebate.id}`}
                >
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-mono text-white font-semibold line-clamp-2">
                      {data.biggestDebate.title}
                    </p>
                    {data.biggestDebate.topic && (
                      <p className="text-[11px] font-mono text-surface-500 line-clamp-1">
                        Topic: &ldquo;{data.biggestDebate.topic.statement}&rdquo;
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-surface-500 capitalize">
                          {data.biggestDebate.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5 text-against-300" />
                        <span className="text-base font-mono font-bold text-against-300">
                          {data.biggestDebate.viewer_count.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-mono text-surface-500">viewers</span>
                      </div>
                    </div>
                  </div>
                </RecordCard>
              </Section>
            )}

            {/* ── People records ───────────────────────────────────────── */}
            <Section
              label="Citizen Records"
              icon={Users}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              delay={0.3}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {data.highestReputation && (
                  <ProfileRecordCard
                    profile={data.highestReputation}
                    medal="👑"
                    medalColor="text-gold"
                    medalBg="bg-gold/15"
                    title="Highest Reputation"
                    description="All-time top reputation score"
                    metric={Math.round(data.highestReputation.reputation_score)}
                    metricLabel="rep score"
                    metricColor="text-gold"
                    metricIcon={Crown}
                  />
                )}

                {data.longestStreak && (
                  <ProfileRecordCard
                    profile={data.longestStreak}
                    medal="🔥"
                    medalColor="text-against-300"
                    medalBg="bg-against-500/15"
                    title="Longest Active Streak"
                    description="Most consecutive days voted"
                    metric={data.longestStreak.vote_streak}
                    metricLabel="day streak"
                    metricColor="text-against-300"
                    metricIcon={Flame}
                  />
                )}

                {data.mostArguments && (
                  <ProfileRecordCard
                    profile={data.mostArguments}
                    medal="💬"
                    medalColor="text-purple"
                    medalBg="bg-purple/15"
                    title="Most Arguments Posted"
                    description="The most prolific civic debater"
                    metric={data.mostArguments.total_arguments}
                    metricLabel="arguments"
                    metricColor="text-purple"
                    metricIcon={MessageSquare}
                  />
                )}

              </div>
            </Section>

            {/* ── CTA strip ────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-3 bg-surface-100 border border-surface-300 rounded-2xl p-4"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2.5 rounded-xl bg-for-500/10">
                  <Sparkles className="h-5 w-5 text-for-300" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white">
                    Could your name be here?
                  </p>
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                    Vote daily, debate well, and build your civic legacy.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href="/"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                    'bg-for-600 text-white hover:bg-for-500 transition-colors'
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Vote Now
                </Link>
                <Link
                  href="/leaderboard"
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                    'bg-surface-200 border border-surface-300 text-surface-300',
                    'hover:text-white hover:border-surface-400 transition-colors'
                  )}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Leaderboard
                </Link>
              </div>
            </motion.div>

          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
