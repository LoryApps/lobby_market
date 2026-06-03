'use client'

/**
 * /zenith — The Civic Zenith
 *
 * The all-time hall of records for Lobby Market — peak moments, record-breaking
 * topics, and the greatest days in platform history.
 *
 * Records showcased:
 *   • Most voted debate ever
 *   • Highest consensus ever reached in a law
 *   • Most contested law that still passed
 *   • Most argued topic (most arguments posted)
 *   • Fastest topic → law conversion
 *   • Peak voting day (most votes cast in one day)
 *   • Peak law day (most laws established in one day)
 *   • Category champion (most-voted topic per category)
 *
 * Distinct from:
 *   /apex         — per-category current record holders (refreshed stats)
 *   /annual       — all-time aggregated platform stats
 *   /supernova    — topics that peaked then decayed (temporal arc)
 *   /momentum     — recent 24h momentum, not all-time peaks
 *   /legacy       — personal civic legacy (user-specific)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  Cpu,
  Crown,
  FlaskConical,
  Flame,
  Gavel,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Star,
  Timer,
  Trophy,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type {
  ZenithResponse,
  ZenithTopic,
  CategoryZenith,
} from '@/app/api/zenith/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const REFRESH_MS = 15 * 60 * 1000

const CAT_ICON: Record<string, typeof Landmark> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: Sparkles,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CAT_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Politics: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  Technology: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  Science: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Ethics: { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy: { text: 'text-for-300', bg: 'bg-for-400/10', border: 'border-for-400/30' },
  Culture: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Health: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Environment: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Education: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
}

function catColor(cat: string) {
  return (
    CAT_COLOR[cat] ?? {
      text: 'text-surface-400',
      bg: 'bg-surface-200',
      border: 'border-surface-300',
    }
  )
}

function catIcon(cat: string) {
  return CAT_ICON[cat] ?? BarChart2
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── VoteBar ──────────────────────────────────────────────────────────────────

function VoteBar({ bluePct, size = 'md' }: { bluePct: number; size?: 'sm' | 'md' }) {
  const against = 100 - bluePct
  return (
    <div
      className={cn(
        'w-full rounded-full overflow-hidden bg-surface-300',
        size === 'sm' ? 'h-1.5' : 'h-2'
      )}
    >
      <div className="flex h-full">
        <motion.div
          className="h-full bg-for-500"
          initial={{ width: 0 }}
          animate={{ width: `${bluePct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        <motion.div
          className="h-full bg-against-600"
          initial={{ width: 0 }}
          animate={{ width: `${against}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Record Card ──────────────────────────────────────────────────────────────

interface RecordCardProps {
  icon: typeof Trophy
  iconColor: string
  iconBg: string
  iconBorder: string
  badge: string
  badgeColor: string
  title: string
  topic: ZenithTopic | null
  metric: string
  metricValue: string | number
  metricColor?: string
  index: number
}

function RecordCard({
  icon: Icon,
  iconColor,
  iconBg,
  iconBorder,
  badge,
  badgeColor,
  title,
  topic,
  metric,
  metricValue,
  metricColor,
  index,
}: RecordCardProps) {
  if (!topic) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="group flex flex-col gap-3 rounded-2xl border border-surface-300 bg-surface-100 p-5 hover:border-surface-400 hover:bg-surface-200/60 transition-colors"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border flex-shrink-0',
              iconBg,
              iconBorder
            )}
          >
            <Icon className={cn('h-5 w-5', iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border',
                  badgeColor
                )}
              >
                {badge}
              </span>
              {topic.category && (
                <span className="text-[10px] font-mono text-surface-500">
                  {topic.category}
                </span>
              )}
            </div>
            <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
              {title}
            </p>
          </div>
        </div>

        {/* Statement */}
        <p className="font-mono text-sm text-white leading-relaxed line-clamp-3 group-hover:text-for-100 transition-colors">
          {topic.statement}
        </p>

        {/* Vote bar */}
        <VoteBar bluePct={topic.blue_pct} size="sm" />

        {/* Stats row */}
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-for-400">{Math.round(topic.blue_pct)}% FOR</span>
            <span className="text-against-400">{Math.round(100 - topic.blue_pct)}% AGAINST</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-surface-500">{metric}:</span>
            <span className={cn('font-bold', metricColor ?? 'text-white')}>
              {typeof metricValue === 'number'
                ? metricValue.toLocaleString()
                : metricValue}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-surface-600 group-hover:text-for-400 transition-colors">
          <span>View debate</span>
          <ArrowRight className="h-3 w-3" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Platform Stat Card ───────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  sub,
  delay,
}: {
  icon: typeof Trophy
  iconColor: string
  label: string
  value: number | string
  sub?: string
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: delay ?? 0 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('h-4 w-4 flex-shrink-0', iconColor)} />
        <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="font-mono text-2xl font-bold text-white tabular-nums">
        {typeof value === 'number' ? (
          <AnimatedNumber value={value} />
        ) : (
          value
        )}
      </div>
      {sub && (
        <p className="text-[11px] font-mono text-surface-500 mt-1">{sub}</p>
      )}
    </motion.div>
  )
}

// ─── Category Champion Card ───────────────────────────────────────────────────

function CategoryChampionCard({
  zenith,
  rank,
}: {
  zenith: CategoryZenith
  rank: number
}) {
  const cc = catColor(zenith.category)
  const Icon = catIcon(zenith.category)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.05 }}
    >
      <Link
        href={`/topic/${zenith.record_topic.id}`}
        className="group flex items-start gap-3 p-4 rounded-2xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/60 transition-colors"
      >
        {/* Rank + icon */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border',
              cc.bg,
              cc.border
            )}
          >
            <Icon className={cn('h-4.5 w-4.5', cc.text)} />
          </div>
          <span className="text-[10px] font-mono text-surface-600">
            #{rank + 1}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'text-xs font-mono font-bold uppercase tracking-wide',
                cc.text
              )}
            >
              {zenith.category}
            </span>
            <div className="flex items-center gap-2 text-[11px] font-mono text-surface-500 flex-shrink-0">
              <span>{zenith.law_count} laws</span>
              <span>·</span>
              <span>{zenith.total_votes.toLocaleString()} votes</span>
            </div>
          </div>

          <p className="font-mono text-xs text-white line-clamp-2 leading-relaxed">
            {zenith.record_topic.statement}
          </p>

          <div className="space-y-1">
            <VoteBar bluePct={zenith.record_topic.blue_pct} size="sm" />
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-surface-500">
                Category record:{' '}
                <span className="text-white font-semibold">
                  {zenith.record_topic.total_votes.toLocaleString()} votes
                </span>
              </span>
              <span
                className={cn(
                  'flex items-center gap-0.5',
                  zenith.record_topic.status === 'law' ? 'text-gold' : 'text-surface-500'
                )}
              >
                {zenith.record_topic.status === 'law' && (
                  <Gavel className="h-2.5 w-2.5" />
                )}
                {zenith.record_topic.status === 'law' ? 'LAW' : zenith.record_topic.status}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ZenithSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ZenithClient() {
  const [data, setData] = useState<ZenithResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/zenith', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load zenith data')
      const json: ZenithResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(() => load(true), REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Crown className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white tracking-tight">
                The Civic Zenith
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                All-time records &amp; peak moments
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            aria-label="Refresh"
            className="mt-1 flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* ── Loading ───────────────────────────────────────────────────────── */}
        {loading ? (
          <ZenithSkeleton />
        ) : error ? (
          <EmptyState
            icon={Crown}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="Records unavailable"
            description="Could not compute zenith records. The platform may be catching up."
            actions={[{ label: 'Try again', onClick: () => load() }]}
          />
        ) : data ? (
          <AnimatePresence mode="wait">
            <motion.div
              key="zenith"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-10"
            >

              {/* ── Platform snapshot ──────────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4 text-for-400" />
                  <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-widest">
                    Platform at a Glance
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    icon={Vote}
                    iconColor="text-for-400"
                    label="Total Votes"
                    value={data.stats.total_votes_cast}
                    delay={0}
                  />
                  <StatCard
                    icon={Gavel}
                    iconColor="text-gold"
                    label="Laws Passed"
                    value={data.stats.total_laws}
                    delay={0.05}
                  />
                  <StatCard
                    icon={MessageSquare}
                    iconColor="text-purple"
                    label="Arguments"
                    value={data.stats.total_arguments}
                    delay={0.1}
                  />
                  <StatCard
                    icon={Calendar}
                    iconColor="text-emerald"
                    label="Platform Age"
                    value={data.stats.platform_age_days}
                    sub="days of civic history"
                    delay={0.15}
                  />
                </div>
              </section>

              {/* ── All-Time Records ───────────────────────────────────────── */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="h-4 w-4 text-gold" />
                  <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-widest">
                    All-Time Records
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <RecordCard
                    index={0}
                    icon={Zap}
                    iconColor="text-for-400"
                    iconBg="bg-for-500/10"
                    iconBorder="border-for-500/30"
                    badge="Most Voted"
                    badgeColor="bg-for-500/10 text-for-400 border-for-500/30"
                    title="Highest engagement debate of all time"
                    topic={data.most_voted_ever}
                    metric="votes"
                    metricValue={data.most_voted_ever?.total_votes ?? 0}
                    metricColor="text-for-400"
                  />
                  <RecordCard
                    index={1}
                    icon={Star}
                    iconColor="text-gold"
                    iconBg="bg-gold/10"
                    iconBorder="border-gold/30"
                    badge="Peak Consensus"
                    badgeColor="bg-gold/10 text-gold border-gold/30"
                    title="Highest agreement ever reached in a law"
                    topic={data.highest_consensus_law}
                    metric="FOR"
                    metricValue={
                      data.highest_consensus_law
                        ? `${Math.round(data.highest_consensus_law.blue_pct)}%`
                        : '—'
                    }
                    metricColor="text-gold"
                  />
                  <RecordCard
                    index={2}
                    icon={MessageSquare}
                    iconColor="text-purple"
                    iconBg="bg-purple/10"
                    iconBorder="border-purple/30"
                    badge="Most Argued"
                    badgeColor="bg-purple/10 text-purple border-purple/30"
                    title="Debate that generated the most arguments"
                    topic={data.most_argued_topic}
                    metric="arguments"
                    metricValue={data.most_argued_topic?.arg_count ?? 0}
                    metricColor="text-purple"
                  />
                  <RecordCard
                    index={3}
                    icon={Scale}
                    iconColor="text-against-400"
                    iconBg="bg-against-500/10"
                    iconBorder="border-against-500/30"
                    badge="Narrowest Win"
                    badgeColor="bg-against-500/10 text-against-400 border-against-500/30"
                    title="Most contested law that still passed"
                    topic={data.most_opposed_topic}
                    metric="FOR"
                    metricValue={
                      data.most_opposed_topic
                        ? `${Math.round(data.most_opposed_topic.blue_pct)}%`
                        : '—'
                    }
                    metricColor="text-against-400"
                  />
                </div>

                {/* Fastest law — full-width banner */}
                {data.fastest_law && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.28 }}
                    className="mt-4"
                  >
                    <Link
                      href={`/topic/${data.fastest_law.id}`}
                      className="group flex items-start gap-4 rounded-2xl border border-emerald/20 bg-emerald/5 p-5 hover:border-emerald/40 hover:bg-emerald/10 transition-colors"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0">
                        <Timer className="h-5 w-5 text-emerald" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald/10 text-emerald border border-emerald/30">
                            ⚡ Fastest Law
                          </span>
                          {data.fastest_law.category && (
                            <span className="text-[10px] font-mono text-surface-500">
                              {data.fastest_law.category}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-sm text-white leading-relaxed line-clamp-2 group-hover:text-emerald transition-colors mb-2">
                          {data.fastest_law.statement}
                        </p>
                        <div className="flex items-center gap-4 text-xs font-mono">
                          <span className="text-emerald font-bold">
                            {data.fastest_law.hours_to_law < 24
                              ? `${data.fastest_law.hours_to_law}h to pass`
                              : `${Math.round(data.fastest_law.hours_to_law / 24)}d to pass`}
                          </span>
                          <span className="text-surface-500">
                            {data.fastest_law.total_votes.toLocaleString()} votes ·{' '}
                            {Math.round(data.fastest_law.blue_pct)}% FOR
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-emerald transition-colors mt-1 flex-shrink-0" />
                    </Link>
                  </motion.div>
                )}
              </section>

              {/* ── Peak Days ──────────────────────────────────────────────── */}
              {(data.peak_voting_day || data.peak_law_day) && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Flame className="h-4 w-4 text-against-400" />
                    <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-widest">
                      Historic Peak Days
                    </h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.peak_voting_day && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.35, delay: 0.1 }}
                        className="rounded-2xl border border-for-500/20 bg-for-500/5 p-5 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <Vote className="h-4 w-4 text-for-400" />
                          <span className="text-xs font-mono font-bold text-for-400 uppercase tracking-wider">
                            Peak Voting Day
                          </span>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold text-white tabular-nums">
                            <AnimatedNumber value={data.peak_voting_day.vote_count} />
                            <span className="text-sm text-surface-400 font-normal ml-1">
                              votes
                            </span>
                          </p>
                          <p className="font-mono text-sm text-for-400 mt-0.5">
                            {formatShortDate(data.peak_voting_day.date)}
                          </p>
                        </div>
                        <p className="text-xs font-mono text-surface-500">
                          The most votes ever cast in a single calendar day on the platform.
                        </p>
                      </motion.div>
                    )}

                    {data.peak_law_day && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.35, delay: 0.15 }}
                        className="rounded-2xl border border-gold/20 bg-gold/5 p-5 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <Gavel className="h-4 w-4 text-gold" />
                          <span className="text-xs font-mono font-bold text-gold uppercase tracking-wider">
                            Most Laws in a Day
                          </span>
                        </div>
                        <div>
                          <p className="font-mono text-2xl font-bold text-white tabular-nums">
                            <AnimatedNumber value={data.peak_law_day.law_count} />
                            <span className="text-sm text-surface-400 font-normal ml-1">
                              {data.peak_law_day.law_count === 1 ? 'law' : 'laws'}
                            </span>
                          </p>
                          <p className="font-mono text-sm text-gold mt-0.5">
                            {formatShortDate(data.peak_law_day.date)}
                          </p>
                        </div>
                        {data.peak_law_day.law_statements.length > 0 && (
                          <div className="space-y-1">
                            {data.peak_law_day.law_statements.map((s, i) => (
                              <p
                                key={i}
                                className="text-[11px] font-mono text-surface-500 leading-snug line-clamp-1"
                              >
                                <CheckCircle2 className="h-2.5 w-2.5 text-gold inline mr-1" />
                                {s}
                              </p>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                </section>
              )}

              {/* ── Category Champions ─────────────────────────────────────── */}
              {data.category_zeniths.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Award className="h-4 w-4 text-purple" />
                    <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-widest">
                      Category Champions
                    </h2>
                    <span className="text-[11px] font-mono text-surface-600 ml-1">
                      — most-voted debate in each domain
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.category_zeniths.map((z, i) => (
                      <CategoryChampionCard key={z.category} zenith={z} rank={i} />
                    ))}
                  </div>
                </section>
              )}

              {/* ── Top 10 Most Voted ──────────────────────────────────────── */}
              {data.top_10_by_votes.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-4 w-4 text-for-400" />
                    <h2 className="font-mono text-sm font-bold text-surface-400 uppercase tracking-widest">
                      Top 10 — All-Time Votes
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
                    {data.top_10_by_votes.map((t, idx) => (
                      <Link
                        key={t.id}
                        href={`/topic/${t.id}`}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 hover:bg-surface-200/60 transition-colors group',
                          idx < data.top_10_by_votes.length - 1 && 'border-b border-surface-300'
                        )}
                      >
                        {/* Rank */}
                        <div
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 font-mono text-xs font-bold',
                            idx === 0
                              ? 'bg-gold/20 text-gold border border-gold/40'
                              : idx === 1
                              ? 'bg-surface-300/60 text-surface-300 border border-surface-400'
                              : idx === 2
                              ? 'bg-against-600/20 text-against-300 border border-against-500/40'
                              : 'bg-surface-200 text-surface-500 border border-surface-300'
                          )}
                        >
                          {idx + 1}
                        </div>

                        {/* Statement */}
                        <p className="flex-1 min-w-0 font-mono text-sm text-white truncate group-hover:text-for-100 transition-colors">
                          {t.statement}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center gap-3 flex-shrink-0 text-xs font-mono">
                          {t.status === 'law' && (
                            <Gavel className="h-3 w-3 text-gold" title="Established law" />
                          )}
                          <span className="text-for-400">{Math.round(t.blue_pct)}%</span>
                          <span className="text-surface-500 font-semibold">
                            {t.total_votes.toLocaleString()}
                          </span>
                        </div>

                        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* ── Explore related ────────────────────────────────────────── */}
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { href: '/apex', label: 'Civic Apex', icon: Trophy, color: 'text-gold' },
                    { href: '/supernova', label: 'Civic Supernova', icon: Flame, color: 'text-against-400' },
                    { href: '/momentum', label: 'Current Momentum', icon: TrendingUp, color: 'text-for-400' },
                    { href: '/annual', label: 'Civic Annual', icon: Calendar, color: 'text-purple' },
                    { href: '/stalemate', label: 'Civic Stalemate', icon: Scale, color: 'text-surface-400' },
                    { href: '/laws', label: 'The Codex', icon: Shield, color: 'text-emerald' },
                  ].map(({ href, label, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-colors"
                    >
                      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                      <span className="font-mono text-xs text-surface-300">{label}</span>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Timestamp */}
              <p className="font-mono text-xs text-surface-600 text-center">
                Records computed at{' '}
                {new Date(data.generated_at).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </motion.div>
          </AnimatePresence>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
