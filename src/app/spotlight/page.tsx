'use client'

/**
 * /spotlight — Civic Spotlight
 *
 * A weekly curated showcase of the best the Lobby has to offer:
 * the top argument, hottest debate, closest vote, rising star,
 * newest law, and a live platform snapshot.
 *
 * Refreshes every 15 minutes client-side (pull-to-refresh button).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Award,
  BarChart2,
  Clock,
  Flame,
  Gavel,
  MessageSquare,
  Mic,
  RefreshCw,
  Scale,
  Sparkles,
  Star,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Vote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  SpotlightData,
  SpotlightArgument,
  SpotlightDebate,
  SpotlightTopic,
  SpotlightUser,
  SpotlightLaw,
  PlatformSnapshot,
} from '@/app/api/spotlight/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  const w = Math.floor(d / 7)
  return `${w}w ago`
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max) + '…' : s
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

function catColor(c: string | null | undefined): string {
  return CATEGORY_COLORS[c ?? ''] ?? 'text-surface-500'
}

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  iconBorder,
  label,
  sublabel,
}: {
  icon: typeof Trophy
  iconColor: string
  iconBg: string
  iconBorder: string
  label: string
  sublabel: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className={cn(
          'flex items-center justify-center h-10 w-10 rounded-xl border flex-shrink-0',
          iconBg,
          iconBorder
        )}
      >
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest">
          {sublabel}
        </p>
        <h2 className="font-mono text-lg font-bold text-white leading-tight">{label}</h2>
      </div>
    </div>
  )
}

// ─── Argument card ────────────────────────────────────────────────────────────

function ArgumentCard({ arg }: { arg: SpotlightArgument }) {
  const isFor = arg.side === 'for'
  const isAgainst = arg.side === 'against'

  return (
    <Link href={`/topic/${arg.topic?.id ?? ''}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl border p-5 space-y-4 hover:border-opacity-70 transition-all cursor-pointer group',
          isFor
            ? 'bg-for-500/5 border-for-500/30 hover:bg-for-500/10'
            : isAgainst
            ? 'bg-against-500/5 border-against-500/30 hover:bg-against-500/10'
            : 'bg-surface-100 border-surface-300'
        )}
      >
        {/* Side badge */}
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold',
              isFor
                ? 'bg-for-600/20 text-for-300'
                : isAgainst
                ? 'bg-against-600/20 text-against-300'
                : 'bg-surface-300/50 text-surface-400'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-3 w-3" />
            ) : (
              <ThumbsDown className="h-3 w-3" />
            )}
            {isFor ? 'FOR' : isAgainst ? 'AGAINST' : 'NEUTRAL'}
          </div>
          <div className="flex items-center gap-1.5 text-gold">
            <ThumbsUp className="h-4 w-4 fill-gold/20" />
            <span className="text-sm font-mono font-bold">{arg.upvotes.toLocaleString()}</span>
            <span className="text-xs text-surface-500 font-mono">upvotes</span>
          </div>
        </div>

        {/* Content */}
        <blockquote className="text-sm font-mono text-white leading-relaxed">
          &ldquo;{truncate(arg.content, 280)}&rdquo;
        </blockquote>

        {/* Author + topic */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-300/40">
          <div className="flex items-center gap-2">
            <Avatar
              src={arg.author?.avatar_url ?? null}
              fallback={arg.author?.display_name ?? arg.author?.username ?? '?'}
              size="xs"
            />
            <span className="text-xs font-mono text-surface-400">
              @{arg.author?.username ?? 'anonymous'}
            </span>
            <span className="text-xs font-mono text-surface-600">·</span>
            <span className="text-xs font-mono text-surface-500">{relativeTime(arg.created_at)}</span>
          </div>
          {arg.topic?.category && (
            <span className={cn('text-xs font-mono font-semibold', catColor(arg.topic.category))}>
              {arg.topic.category}
            </span>
          )}
        </div>

        {/* Topic statement */}
        {arg.topic && (
          <div className="bg-surface-200/60 border border-surface-300/60 rounded-xl px-4 py-3">
            <p className="text-xs font-mono text-surface-400 mb-1">On the question of:</p>
            <p className="text-sm font-mono text-white leading-snug">
              {truncate(arg.topic.statement, 120)}
            </p>
          </div>
        )}
      </motion.div>
    </Link>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  topic,
  label,
  labelColor,
}: {
  topic: SpotlightTopic
  label: string
  labelColor: string
}) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <Link href={`/topic/${topic.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 hover:border-surface-400 transition-all cursor-pointer group"
      >
        {/* Label + category */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-xs font-mono font-bold uppercase tracking-wider', labelColor)}>
            {label}
          </span>
          {topic.category && (
            <span className={cn('text-xs font-mono font-semibold', catColor(topic.category))}>
              {topic.category}
            </span>
          )}
        </div>

        {/* Statement */}
        <p className="text-sm font-mono text-white leading-snug">
          {truncate(topic.statement, 140)}
        </p>

        {/* Vote bar */}
        <div className="space-y-1.5">
          <div className="flex h-2 rounded-full overflow-hidden bg-surface-300">
            <div
              className="bg-for-500 transition-all"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="bg-against-500 transition-all"
              style={{ width: `${againstPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-for-400 font-semibold">{forPct}% FOR</span>
            <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
            <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Debate card ──────────────────────────────────────────────────────────────

function DebateCard({ debate }: { debate: SpotlightDebate }) {
  const isLive = debate.status === 'live'

  return (
    <Link href={`/debate/${debate.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4 hover:border-surface-400 transition-all cursor-pointer group"
      >
        {/* Status + type */}
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-against-300 bg-against-500/15 border border-against-500/30 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-against-400 animate-pulse" />
              LIVE
            </span>
          )}
          <span className="text-xs font-mono text-surface-500 capitalize">
            {debate.debate_type.replace('_', ' ')}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-mono text-white leading-snug font-semibold">
          {truncate(debate.title, 120)}
        </p>

        {/* Topic */}
        {debate.topic && (
          <div className="bg-surface-200/60 border border-surface-300/60 rounded-xl px-3 py-2.5">
            <p className="text-[11px] font-mono text-surface-500 mb-1">Topic</p>
            <p className="text-xs font-mono text-surface-300 leading-snug">
              {truncate(debate.topic.statement, 100)}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {debate.participant_count} participants
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {debate.message_count} messages
          </span>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawCard({ law }: { law: SpotlightLaw }) {
  return (
    <Link href={`/law/${law.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-emerald/5 border border-emerald/30 p-5 space-y-4 hover:bg-emerald/10 transition-all cursor-pointer group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-emerald bg-emerald/10 border border-emerald/30">
            <Gavel className="h-3 w-3" />
            ESTABLISHED
          </div>
          {law.category && (
            <span className={cn('text-xs font-mono font-semibold', catColor(law.category))}>
              {law.category}
            </span>
          )}
        </div>

        <p className="text-sm font-mono text-white leading-snug">
          {truncate(law.statement, 160)}
        </p>

        <div className="flex items-center justify-between text-xs font-mono text-surface-500 pt-1 border-t border-emerald/20">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {relativeTime(law.established_at)}
          </span>
          {law.total_votes && (
            <span className="flex items-center gap-1">
              <Vote className="h-3.5 w-3.5" />
              {law.total_votes.toLocaleString()} votes
            </span>
          )}
        </div>
      </motion.div>
    </Link>
  )
}

// ─── User card ────────────────────────────────────────────────────────────────

function UserCard({ user }: { user: SpotlightUser }) {
  const roleLabel = ROLE_LABELS[user.role] ?? user.role

  return (
    <Link href={`/profile/${user.username}`}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-surface-100 border border-surface-300 p-5 hover:border-surface-400 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-4">
          <Avatar
            src={user.avatar_url}
            fallback={user.display_name ?? user.username}
            size="lg"
          />
          <div className="flex-1 min-w-0">
            <p className="font-mono font-bold text-white text-base truncate">
              {user.display_name ?? user.username}
            </p>
            <p className="text-xs font-mono text-surface-500 truncate">
              @{user.username} · {roleLabel}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-purple">
            <Star className="h-4 w-4 fill-purple/20" />
            <span className="text-sm font-mono font-bold">{user.reputation_score}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-surface-300/60">
          <div className="text-center">
            <p className="font-mono text-base font-bold text-white">
              {user.total_votes.toLocaleString()}
            </p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">
              Votes
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-base font-bold text-white">
              {user.total_arguments.toLocaleString()}
            </p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">
              Arguments
            </p>
          </div>
          <div className="text-center">
            <p className="font-mono text-base font-bold text-gold">
              {user.vote_streak}
            </p>
            <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide mt-0.5">
              Streak
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Snapshot strip ───────────────────────────────────────────────────────────

function SnapshotStrip({ snap }: { snap: PlatformSnapshot }) {
  const stats = [
    {
      icon: Activity,
      iconColor: 'text-for-400',
      value: snap.active_topics,
      label: 'Active',
    },
    {
      icon: Gavel,
      iconColor: 'text-emerald',
      value: snap.laws_established,
      label: 'Laws',
    },
    {
      icon: Vote,
      iconColor: 'text-gold',
      value: snap.total_votes,
      label: 'Votes',
    },
    {
      icon: Mic,
      iconColor: 'text-against-400',
      value: snap.live_debates,
      label: 'Live',
    },
  ]

  const weekStats = [
    { label: 'votes this week', value: snap.week_votes, color: 'text-for-400' },
    { label: 'laws this week', value: snap.week_laws, color: 'text-emerald' },
    { label: 'arguments this week', value: snap.week_arguments, color: 'text-purple' },
  ]

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-5">
      {/* All-time stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ icon: Icon, iconColor, value, label }) => (
          <div key={label} className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-surface-200 border border-surface-300">
              <Icon className={cn('h-4.5 w-4.5', iconColor)} />
            </div>
            <div className="text-center">
              <AnimatedNumber
                value={value}
                className="font-mono text-base font-bold text-white"
              />
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* This week banner */}
      <div className="pt-4 border-t border-surface-300/60">
        <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-3">
          This week
        </p>
        <div className="grid grid-cols-3 gap-3">
          {weekStats.map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <AnimatedNumber
                value={value}
                className={cn('font-mono text-lg font-bold', color)}
              />
              <p className="text-[10px] font-mono text-surface-500 leading-tight mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SpotlightSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SpotlightPage() {
  const [data, setData] = useState<SpotlightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/spotlight', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Hero */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30">
              <Sparkles className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Spotlight
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The best of the Lobby, curated weekly.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            aria-label="Refresh spotlight"
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold',
              'bg-surface-200 border border-surface-300 text-surface-400',
              'hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {loading && !data && <SpotlightSkeleton />}

        {error && !data && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="text-sm font-mono text-surface-500">
              Failed to load spotlight. Check back soon.
            </p>
            <button
              type="button"
              onClick={load}
              className="text-xs font-mono text-for-400 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <AnimatePresence>
            <div className="space-y-10">

              {/* Platform Snapshot */}
              <section>
                <SectionHeader
                  icon={BarChart2}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10"
                  iconBorder="border-for-500/30"
                  label="Platform Snapshot"
                  sublabel="live stats"
                />
                <SnapshotStrip snap={data.snapshot} />
              </section>

              {/* Argument of the Week */}
              {data.argument_of_week && (
                <section>
                  <SectionHeader
                    icon={Award}
                    iconColor="text-gold"
                    iconBg="bg-gold/10"
                    iconBorder="border-gold/30"
                    label="Argument of the Week"
                    sublabel="most upvoted · 7 days"
                  />
                  <ArgumentCard arg={data.argument_of_week} />
                </section>
              )}

              {/* Newest Law */}
              {data.newest_law && (
                <section>
                  <SectionHeader
                    icon={Gavel}
                    iconColor="text-emerald"
                    iconBg="bg-emerald/10"
                    iconBorder="border-emerald/30"
                    label="Newest Law"
                    sublabel="just established"
                  />
                  <LawCard law={data.newest_law} />
                </section>
              )}

              {/* Closest Call */}
              {data.closest_call && (
                <section>
                  <SectionHeader
                    icon={Scale}
                    iconColor="text-against-400"
                    iconBg="bg-against-500/10"
                    iconBorder="border-against-500/30"
                    label="Closest Call"
                    sublabel="deadlocked · vote to break the tie"
                  />
                  <TopicCard
                    topic={data.closest_call}
                    label="DEADLOCK"
                    labelColor="text-against-300"
                  />
                </section>
              )}

              {/* Hottest Topic */}
              {data.hottest_topic && (
                <section>
                  <SectionHeader
                    icon={Flame}
                    iconColor="text-gold"
                    iconBg="bg-gold/10"
                    iconBorder="border-gold/30"
                    label="Hottest Topic"
                    sublabel="most viewed this week"
                  />
                  <TopicCard
                    topic={data.hottest_topic}
                    label="TRENDING"
                    labelColor="text-gold"
                  />
                </section>
              )}

              {/* Debate of the Week */}
              {data.debate_of_week && (
                <section>
                  <SectionHeader
                    icon={Mic}
                    iconColor="text-purple"
                    iconBg="bg-purple/10"
                    iconBorder="border-purple/30"
                    label="Debate of the Week"
                    sublabel="most participated"
                  />
                  <DebateCard debate={data.debate_of_week} />
                </section>
              )}

              {/* Rising Star */}
              {data.rising_star && (
                <section>
                  <SectionHeader
                    icon={TrendingUp}
                    iconColor="text-purple"
                    iconBg="bg-purple/10"
                    iconBorder="border-purple/30"
                    label="Rising Star"
                    sublabel="new citizen · climbing fast"
                  />
                  <UserCard user={data.rising_star} />
                </section>
              )}

              {/* Navigation links */}
              <section className="pt-4 border-t border-surface-300/60 space-y-3">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-4">
                  Explore more
                </p>
                {[
                  {
                    href: '/arguments',
                    icon: Award,
                    color: 'text-gold',
                    bg: 'bg-gold/5 border-gold/25 hover:bg-gold/10',
                    label: 'Top Arguments',
                    desc: 'The best arguments across all topics, ranked by upvotes.',
                  },
                  {
                    href: '/leaderboard',
                    icon: Trophy,
                    color: 'text-purple',
                    bg: 'bg-purple/5 border-purple/25 hover:bg-purple/10',
                    label: 'Leaderboard',
                    desc: 'The Lobby\'s most influential citizens.',
                  },
                  {
                    href: '/records',
                    icon: Star,
                    color: 'text-gold',
                    bg: 'bg-gold/5 border-gold/25 hover:bg-gold/10',
                    label: 'Civic Records',
                    desc: 'All-time records — most voted, fastest law, best argument.',
                  },
                  {
                    href: '/trending',
                    icon: TrendingUp,
                    color: 'text-for-400',
                    bg: 'bg-for-500/5 border-for-500/25 hover:bg-for-500/10',
                    label: 'Trending',
                    desc: 'What the Lobby is talking about right now.',
                  },
                ].map(({ href, icon: Icon, color, bg, label, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border px-5 py-4 transition-all group',
                      bg
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                      <div>
                        <p className="font-mono text-sm font-semibold text-white">{label}</p>
                        <p className="text-xs font-mono text-surface-500 mt-0.5">{desc}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </section>

              {/* Generated at */}
              <p className="text-center text-[11px] font-mono text-surface-600">
                Updated {relativeTime(data.generated_at)}
              </p>
            </div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
