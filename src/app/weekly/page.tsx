'use client'

/**
 * /weekly — The Civic Weekly Roundup
 *
 * A platform-wide digest of the past 7 days: laws established, hottest
 * debates, top arguments, rising citizens, and category heatmap.
 *
 * Distinct from /my-week (personal stats) and /digest (curated editorial).
 * This is the public, community-facing week-in-review.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  ChevronRight,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { cn } from '@/lib/utils/cn'
import type {
  WeeklyDigestData,
  WeeklyArgument,
  WeeklyLaw,
  WeeklyTopicSwing,
  WeeklyRisingUser,
} from '@/app/api/weekly/route'

// ── Category colours ───────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
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
  Other: 'text-surface-500',
}


function catColor(cat: string | null) {
  return CAT_COLOR[cat ?? ''] ?? 'text-surface-500'
}

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}
const ROLE_COLOR: Record<string, string> = {
  elder: 'border-gold/40 text-gold',
  senator: 'border-purple/40 text-purple',
  lawmaker: 'border-gold/60 text-gold',
  debator: 'border-for-500/40 text-for-300',
  troll_catcher: 'border-emerald/40 text-emerald',
  person: 'border-surface-400 text-surface-500',
}

function roleStyle(role: string) {
  return ROLE_COLOR[role] ?? ROLE_COLOR.person
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function truncate(s: string, max = 120) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Flame
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface-100 border border-surface-300 px-4 py-4 min-w-[110px]">
      <Icon className={cn('h-4 w-4', color)} />
      <span className={cn('font-mono text-2xl font-bold', color)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </span>
      <span className="text-[11px] font-mono text-surface-500 text-center">{label}</span>
    </div>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  color,
  count,
}: {
  icon: typeof Flame
  title: string
  color: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className={cn('h-4 w-4', color)} />
      <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">{title}</h2>
      {count !== undefined && (
        <span className="font-mono text-xs text-surface-500 ml-1">({count})</span>
      )}
    </div>
  )
}

function LawCard({ law }: { law: WeeklyLaw }) {
  const forPct = Math.round(law.blue_pct ?? 67)
  return (
    <Link
      href={`/law/${law.id}`}
      className="group block rounded-xl bg-surface-100 border border-gold/20 hover:border-gold/40 p-4 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
            <Gavel className="h-4 w-4 text-gold" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
            {law.statement}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {law.category && (
              <span className={cn('text-[11px] font-mono font-semibold', catColor(law.category))}>
                {law.category}
              </span>
            )}
            <span className="text-[11px] font-mono text-surface-500">
              {law.total_votes ? `${fmtNum(law.total_votes)} votes` : ''}
            </span>
            <span className="text-[11px] font-mono text-gold/70">
              {forPct}% consensus
            </span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors flex-shrink-0 mt-0.5" />
      </div>
    </Link>
  )
}

function TopicSwingCard({ topic, rank }: { topic: WeeklyTopicSwing; rank: number }) {
  const forPct = Math.round(topic.blue_pct)
  const isFor = forPct > 50
  return (
    <Link
      href={`/topic/${topic.id}`}
      className="group flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-3 transition-all"
    >
      <span className="font-mono text-xs font-bold text-surface-500 w-5 text-center flex-shrink-0">
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[13px] font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
          {topic.statement}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {topic.category && (
            <span className={cn('text-[11px] font-mono', catColor(topic.category))}>
              {topic.category}
            </span>
          )}
          <span
            className={cn(
              'text-[11px] font-mono font-semibold',
              isFor ? 'text-for-400' : 'text-against-400'
            )}
          >
            {forPct}% {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {topic.week_votes > 0 && (
            <span className="text-[11px] font-mono text-surface-500">
              +{fmtNum(topic.week_votes)} this week
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="h-1.5 w-16 rounded-full bg-surface-300 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isFor ? 'bg-for-500' : 'bg-against-500'
            )}
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>
    </Link>
  )
}

function ArgumentCard({ arg }: { arg: WeeklyArgument }) {
  const isFor = arg.side === 'blue'
  return (
    <Link
      href={`/arguments/${arg.id}`}
      className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-4 transition-all"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'mt-0.5 flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg',
            isFor
              ? 'bg-for-500/15 border border-for-500/30'
              : 'bg-against-500/15 border border-against-500/30'
          )}
        >
          {isFor ? (
            <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
          ) : (
            <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[13px] text-surface-300 leading-relaxed line-clamp-3">
            &ldquo;{truncate(arg.content, 160)}&rdquo;
          </p>
          <div className="flex items-center gap-3 mt-2">
            {arg.author && (
              <div className="flex items-center gap-1.5">
                <Avatar
                  src={arg.author.avatar_url}
                  fallback={arg.author.display_name || arg.author.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500">
                  @{arg.author.username}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Zap className="h-3 w-3" />
              {arg.upvotes} upvotes
            </div>
            {arg.category && (
              <span className={cn('text-[11px] font-mono', catColor(arg.category))}>
                {arg.category}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function RisingUserCard({ user, rank }: { user: WeeklyRisingUser; rank: number }) {
  return (
    <Link
      href={`/profile/${user.username}`}
      className="group flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 p-3 transition-all"
    >
      <span className="font-mono text-xs font-bold text-surface-500 w-5 text-center flex-shrink-0">
        {rank}
      </span>
      <Avatar
        src={user.avatar_url}
        fallback={user.display_name || user.username}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[13px] font-semibold text-white truncate group-hover:text-for-300 transition-colors">
          {user.display_name || user.username}
        </p>
        <p className="text-[11px] font-mono text-surface-500 truncate">@{user.username}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span
          className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded border',
            roleStyle(user.role)
          )}
        >
          {ROLE_LABEL[user.role] ?? user.role}
        </span>
        <div className="flex items-center gap-1 text-[11px] font-mono text-gold">
          <Trophy className="h-3 w-3" />
          {fmtNum(user.clout)}
        </div>
      </div>
    </Link>
  )
}

function CategoryBar({
  data,
}: {
  data: Array<{ category: string; votes: number; topics: number }>
}) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.votes), 1)
  return (
    <div className="space-y-2.5">
      {data.map((item) => (
        <Link
          key={item.category}
          href={`/categories/${item.category}`}
          className="group block"
        >
          <div className="flex items-center justify-between mb-1">
            <span className={cn('text-[12px] font-mono font-semibold', catColor(item.category))}>
              {item.category}
            </span>
            <span className="text-[11px] font-mono text-surface-500">
              {fmtNum(item.votes)} votes · {item.topics} topics
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.votes / max) * 100}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                'h-full rounded-full',
                item.category === 'Politics'
                  ? 'bg-for-500'
                  : item.category === 'Economics'
                  ? 'bg-gold'
                  : item.category === 'Technology'
                  ? 'bg-purple'
                  : item.category === 'Science' || item.category === 'Environment'
                  ? 'bg-emerald'
                  : item.category === 'Ethics' || item.category === 'Health'
                  ? 'bg-against-500'
                  : 'bg-surface-500'
              )}
            />
          </div>
        </Link>
      ))}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function WeeklySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 rounded-2xl bg-surface-100 border border-surface-300 w-28 h-24" />
        ))}
      </div>
      <div className="grid gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 h-20" />
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WeeklyPage() {
  const [data, setData] = useState<WeeklyDigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/weekly', { cache: 'no-store' })
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

  const weekLabel = data
    ? `Week of ${formatDate(data.week_start)}`
    : 'This Week in the Lobby'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                <Calendar className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Weekly Roundup</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">{weekLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-all disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
          <p className="mt-3 text-sm font-mono text-surface-500 leading-relaxed">
            The most important civic moments from the past 7 days — laws established, hottest
            debates, top arguments, and rising citizens.
          </p>
        </motion.div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WeeklySkeleton />
            </motion.div>
          ) : error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Scale}
                title="Failed to load the weekly digest"
                description="The Lobby is temporarily unavailable. Try refreshing."
                actions={[{ label: 'Retry', onClick: load }]}
              />
            </motion.div>
          ) : data ? (
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

              {/* ── Headline stats ─────────────────────────────────── */}
              <section>
                <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                  <StatPill
                    icon={Zap}
                    label="Votes cast"
                    value={data.highlight.total_votes_this_week}
                    color="text-for-400"
                  />
                  <StatPill
                    icon={MessageSquare}
                    label="Arguments"
                    value={data.highlight.total_arguments_this_week}
                    color="text-purple"
                  />
                  <StatPill
                    icon={Gavel}
                    label="New laws"
                    value={data.highlight.new_laws_this_week}
                    color="text-gold"
                  />
                  {data.highlight.most_debated_category && (
                    <div className="flex flex-col items-center gap-1 rounded-2xl bg-surface-100 border border-surface-300 px-4 py-4 min-w-[110px]">
                      <Flame className={cn('h-4 w-4', catColor(data.highlight.most_debated_category))} />
                      <span className={cn('font-mono text-sm font-bold text-center', catColor(data.highlight.most_debated_category))}>
                        {data.highlight.most_debated_category}
                      </span>
                      <span className="text-[11px] font-mono text-surface-500 text-center">hottest category</span>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Hottest topic spotlight ────────────────────────── */}
              {data.highlight.hottest_topic && (
                <section>
                  <div className="rounded-2xl bg-for-500/5 border border-for-500/20 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-for-400" />
                      <span className="font-mono text-xs font-bold text-for-400 uppercase tracking-wider">
                        Debate of the Week
                      </span>
                    </div>
                    <Link
                      href={`/topic/${data.highlight.hottest_topic.id}`}
                      className="group block"
                    >
                      <p className="font-mono text-lg font-bold text-white leading-snug group-hover:text-for-300 transition-colors">
                        {data.highlight.hottest_topic.statement}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        {data.highlight.hottest_topic.category && (
                          <span className={cn('text-[12px] font-mono font-semibold', catColor(data.highlight.hottest_topic.category))}>
                            {data.highlight.hottest_topic.category}
                          </span>
                        )}
                        <span className="text-[12px] font-mono text-surface-500">
                          {fmtNum(data.highlight.hottest_topic.total_votes)} total votes
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-for-500 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  </div>
                </section>
              )}

              {/* ── Two-column grid on md+ ─────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Left column */}
                <div className="space-y-8">

                  {/* New laws */}
                  <section>
                    <SectionHeader
                      icon={Gavel}
                      title="Laws Established"
                      color="text-gold"
                      count={data.new_laws.length}
                    />
                    {data.new_laws.length === 0 ? (
                      <EmptyState
                        icon={Gavel}
                        title="No new laws this week"
                        description="The Lobby is still deliberating."
                        size="sm"
                      />
                    ) : (
                      <div className="space-y-2">
                        {data.new_laws.map((law) => (
                          <LawCard key={law.id} law={law} />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Top arguments */}
                  <section>
                    <SectionHeader
                      icon={MessageSquare}
                      title="Top Arguments"
                      color="text-purple"
                      count={data.top_arguments.length}
                    />
                    {data.top_arguments.length === 0 ? (
                      <EmptyState
                        icon={MessageSquare}
                        title="No arguments this week"
                        description="Be the first to make your case."
                        size="sm"
                      />
                    ) : (
                      <div className="space-y-2">
                        {data.top_arguments.map((arg) => (
                          <ArgumentCard key={arg.id} arg={arg} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Right column */}
                <div className="space-y-8">

                  {/* Hottest topics */}
                  <section>
                    <SectionHeader
                      icon={TrendingUp}
                      title="Hottest Debates"
                      color="text-for-400"
                      count={data.hottest_topics.length}
                    />
                    {data.hottest_topics.length === 0 ? (
                      <EmptyState
                        icon={Flame}
                        title="Nothing trending yet"
                        description="Vote on topics to fuel the debate."
                        size="sm"
                      />
                    ) : (
                      <div className="space-y-2">
                        {data.hottest_topics.map((topic, i) => (
                          <TopicSwingCard key={topic.id} topic={topic} rank={i + 1} />
                        ))}
                      </div>
                    )}
                    <Link
                      href="/trending"
                      className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-300 transition-colors mt-3"
                    >
                      See all trending
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </section>

                  {/* Rising users */}
                  <section>
                    <SectionHeader
                      icon={Award}
                      title="Top Citizens"
                      color="text-emerald"
                      count={data.rising_users.length}
                    />
                    {data.rising_users.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="No users yet"
                        description="Be the first to participate this week."
                        size="sm"
                      />
                    ) : (
                      <div className="space-y-2">
                        {data.rising_users.map((user, i) => (
                          <RisingUserCard key={user.id} user={user} rank={i + 1} />
                        ))}
                      </div>
                    )}
                    <Link
                      href="/leaderboard"
                      className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-emerald transition-colors mt-3"
                    >
                      Full leaderboard
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </section>

                  {/* Category breakdown */}
                  {data.category_breakdown.length > 0 && (
                    <section>
                      <SectionHeader
                        icon={BarChart2}
                        title="Category Breakdown"
                        color="text-surface-400"
                      />
                      <CategoryBar data={data.category_breakdown} />
                    </section>
                  )}
                </div>
              </div>

              {/* ── Footer links ───────────────────────────────────── */}
              <section className="border-t border-surface-300 pt-6">
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/my-week"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-xs font-mono font-semibold text-for-300 hover:bg-for-500/20 transition-colors"
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    Your week
                  </Link>
                  <Link
                    href="/stats"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
                  >
                    <Scale className="h-3.5 w-3.5" />
                    Platform stats
                  </Link>
                  <Link
                    href="/timeline"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono font-semibold text-surface-400 hover:text-white transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Full timeline
                  </Link>
                  <Link
                    href="/wrapped"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/10 border border-purple/30 text-xs font-mono font-semibold text-purple hover:bg-purple/20 transition-colors"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    Year in review
                  </Link>
                </div>
              </section>

            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
