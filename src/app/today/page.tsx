'use client'

/**
 * /today — Today in the Lobby
 *
 * A daily snapshot of what's happening right now on Lobby Market:
 *   - Live stats for the current UTC day (votes, arguments, new topics, laws)
 *   - The hottest topic right now with a direct vote link
 *   - Today's most upvoted argument
 *   - The most recent law established
 *   - Topics currently in final voting
 *
 * Distinct from /digest (weekly roundup), /catchup (since-last-visit),
 * and /newspaper (curated editorial). This is the raw daily pulse.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BarChart2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  Gavel,
  MessageSquare,
  RefreshCw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  Vote,
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
import type { TodayResponse, TodayTopTopic, TodayTopArgument, TodayLaw, TodayVotingTopic } from '@/app/api/today/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

const CATEGORY_COLOR: Record<string, string> = {
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

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function votingCountdown(endsAt: string | null): string | null {
  if (!endsAt) return null
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return 'Closed'
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (h === 0) return `${m}m left`
  if (h < 24) return `${h}h ${m}m left`
  const d = Math.floor(h / 24)
  return `${d}d left`
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
  loading: boolean
}) {
  return (
    <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className={cn('text-2xl font-mono font-bold', color)}>
          {typeof value === 'number' ? formatCount(value) : value}
        </span>
      )}
    </div>
  )
}

// ─── Hot Topic card ────────────────────────────────────────────────────────────

function HotTopicCard({
  topic,
  loading,
}: {
  topic: TodayTopTopic | null
  loading: boolean
}) {
  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <section
      aria-labelledby="hot-topic-heading"
      className="bg-surface-100 border border-surface-300 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-against-400" aria-hidden="true" />
        <h2
          id="hot-topic-heading"
          className="text-xs font-mono text-surface-500 uppercase tracking-wider"
        >
          Hottest Topic Right Now
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ) : !topic ? (
        <EmptyState
          icon={Scale}
          title="No active topics"
          description="Be the first to propose a topic for debate."
          actions={[{ label: 'Propose a Topic', href: '/topic/create' }]}
          size="sm"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/topic/${topic.id}`}
              className="text-base font-semibold text-white hover:text-for-300 transition-colors leading-snug line-clamp-3"
            >
              {topic.statement}
            </Link>
            {topic.category && (
              <span
                className={cn(
                  'flex-shrink-0 text-xs font-mono',
                  CATEGORY_COLOR[topic.category] ?? 'text-surface-400'
                )}
              >
                {topic.category}
              </span>
            )}
          </div>

          <VoteBar
            bluePct={topic.blue_pct}
            totalVotes={topic.total_votes}
            showLabels
          />

          <div className="flex items-center justify-between gap-2 text-xs font-mono text-surface-500">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Vote className="h-3 w-3" aria-hidden="true" />
                {formatCount(topic.total_votes)} votes
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                {topic.argument_count} arguments
              </span>
            </div>
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              {topic.status === 'voting' ? 'Voting' : topic.status.charAt(0).toUpperCase() + topic.status.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"
              aria-label={`Vote on: ${topic.statement}`}
            >
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              <span className="text-for-200 font-mono">{forPct}%</span>
              <span>For</span>
            </Link>
            <Link
              href={`/topic/${topic.id}`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-against-600 hover:bg-against-500 text-white text-sm font-semibold transition-colors"
              aria-label={`Vote against: ${topic.statement}`}
            >
              <ThumbsDown className="h-4 w-4" aria-hidden="true" />
              <span className="text-against-200 font-mono">{againstPct}%</span>
              <span>Against</span>
            </Link>
            <Link
              href={`/topic/${topic.id}`}
              className="ml-auto flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              aria-label="Open full topic page"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              Full debate
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Top Argument card ─────────────────────────────────────────────────────────

function TopArgumentCard({
  argument,
  loading,
}: {
  argument: TodayTopArgument | null
  loading: boolean
}) {
  return (
    <section
      aria-labelledby="top-arg-heading"
      className="bg-surface-100 border border-surface-300 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-emerald" aria-hidden="true" />
        <h2
          id="top-arg-heading"
          className="text-xs font-mono text-surface-500 uppercase tracking-wider"
        >
          Top Argument Today
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ) : !argument ? (
        <EmptyState
          icon={MessageSquare}
          title="No arguments yet today"
          description="Be the first to make a case."
          size="sm"
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'text-sm border-l-2 pl-3 italic text-surface-300 leading-relaxed',
              argument.side === 'blue' ? 'border-for-500' : 'border-against-500'
            )}
          >
            &ldquo;{truncate(argument.content, 240)}&rdquo;
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {argument.author && (
                <>
                  <Avatar
                    src={argument.author.avatar_url}
                    fallback={argument.author.display_name ?? argument.author.username}
                    size="xs"
                  />
                  <Link
                    href={`/profile/${argument.author.username}`}
                    className="text-xs font-mono text-surface-400 hover:text-white transition-colors"
                  >
                    @{argument.author.username}
                  </Link>
                </>
              )}
              <span className="text-xs font-mono text-surface-600">
                {relativeTime(argument.created_at)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'text-xs font-mono font-semibold flex items-center gap-1',
                  argument.side === 'blue' ? 'text-for-400' : 'text-against-400'
                )}
                aria-label={`${argument.side === 'blue' ? 'For' : 'Against'} side`}
              >
                {argument.side === 'blue' ? (
                  <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                )}
                {argument.side === 'blue' ? 'FOR' : 'AGAINST'}
              </span>
              <span className="text-xs font-mono text-emerald flex items-center gap-1">
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
                {argument.upvotes} upvotes
              </span>
            </div>
          </div>

          <Link
            href={`/topic/${argument.topic_id}`}
            className="text-xs font-mono text-surface-500 hover:text-for-300 transition-colors flex items-center gap-1"
            aria-label={`Go to topic: ${argument.topic.statement}`}
          >
            <ArrowRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{truncate(argument.topic.statement, 80)}</span>
          </Link>
        </div>
      )}
    </section>
  )
}

// ─── Recent Law card ───────────────────────────────────────────────────────────

function RecentLawCard({
  law,
  loading,
}: {
  law: TodayLaw | null
  loading: boolean
}) {
  return (
    <section
      aria-labelledby="recent-law-heading"
      className="bg-surface-100 border border-surface-300 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-gold" aria-hidden="true" />
        <h2
          id="recent-law-heading"
          className="text-xs font-mono text-surface-500 uppercase tracking-wider"
        >
          Most Recent Law
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      ) : !law ? (
        <EmptyState
          icon={Gavel}
          title="No laws yet"
          description="No topics have reached consensus yet."
          size="sm"
        />
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            href={`/topic/${law.id}`}
            className="text-base font-semibold text-white hover:text-gold transition-colors leading-snug"
          >
            {law.statement}
          </Link>

          <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
            {law.category && (
              <span
                className={cn(CATEGORY_COLOR[law.category] ?? 'text-surface-400')}
              >
                {law.category}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Vote className="h-3 w-3" aria-hidden="true" />
              {formatCount(law.total_votes)} votes
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald" aria-hidden="true" />
              {Math.round(law.blue_pct)}% consensus
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-surface-600 flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {relativeTime(law.updated_at)}
            </span>
            <Link
              href={`/topic/${law.id}`}
              className="text-xs font-mono text-gold hover:text-gold/80 flex items-center gap-1 transition-colors"
              aria-label={`View law: ${law.statement}`}
            >
              Read more
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Voting Now card ───────────────────────────────────────────────────────────

function VotingNowCard({
  topics,
  loading,
}: {
  topics: TodayVotingTopic[]
  loading: boolean
}) {
  if (!loading && topics.length === 0) return null

  return (
    <section
      aria-labelledby="voting-now-heading"
      className="bg-surface-100 border border-surface-300 rounded-xl p-5 flex flex-col gap-4"
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-against-400" aria-hidden="true" />
        <h2
          id="voting-now-heading"
          className="text-xs font-mono text-surface-500 uppercase tracking-wider"
        >
          Closing Soon — Final Voting
        </h2>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {topics.map((topic) => {
            const countdown = votingCountdown(topic.voting_ends_at)
            return (
              <li key={topic.id}>
                <Link
                  href={`/topic/${topic.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface-200 hover:bg-surface-300 transition-colors group"
                  aria-label={`Vote on: ${topic.statement}${countdown ? ` — ${countdown}` : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors line-clamp-2 leading-snug">
                      {topic.statement}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3 text-xs font-mono text-surface-500">
                      <span className="flex items-center gap-1 text-for-400">
                        <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                        {Math.round(topic.blue_pct)}%
                      </span>
                      <span className="flex items-center gap-1 text-against-400">
                        <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                        {Math.round(100 - topic.blue_pct)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Vote className="h-3 w-3" aria-hidden="true" />
                        {formatCount(topic.total_votes)}
                      </span>
                    </div>
                  </div>
                  {countdown && (
                    <span
                      className={cn(
                        'flex-shrink-0 text-xs font-mono font-semibold',
                        countdown.includes('m') && !countdown.includes('h') && !countdown.includes('d')
                          ? 'text-against-400'
                          : countdown.includes('h') && !countdown.includes('d')
                          ? 'text-gold'
                          : 'text-surface-400'
                      )}
                      aria-label={countdown}
                    >
                      {countdown}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/today', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const json: TodayResponse = await res.json()
      setData(json)
    } catch {
      setError("Failed to load today’s data. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col pb-20">
      <TopBar />

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 pt-4 pb-8">
        {/* ── Date header ───────────────────────────────────────────────── */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-for-400" aria-hidden="true" />
              <h1 className="text-xs font-mono text-surface-500 uppercase tracking-widest">
                Today in the Lobby
              </h1>
            </div>
            <p className="text-xl font-bold text-white font-mono" aria-live="polite">
              {todayLabel()}
            </p>
          </div>

          <button
            onClick={() => load(true)}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
            aria-label="Refresh today's data"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              aria-hidden="true"
            />
          </button>
        </header>

        <AnimatePresence mode="wait">
          {error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-20 text-center"
              role="alert"
            >
              <Zap className="h-8 w-8 text-against-400" aria-hidden="true" />
              <p className="text-surface-400 font-mono text-sm">{error}</p>
              <button
                onClick={() => load()}
                className="flex items-center gap-2 px-4 py-2 bg-surface-200 hover:bg-surface-300 rounded-lg text-white text-sm font-mono transition-colors"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try again
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-5"
            >
              {/* ── Stats grid ──────────────────────────────────────────── */}
              <section aria-label="Today's platform statistics">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    icon={Vote}
                    label="Votes Cast"
                    value={data?.stats.votes_cast ?? 0}
                    color="text-for-400"
                    loading={loading}
                  />
                  <StatCard
                    icon={MessageSquare}
                    label="Arguments"
                    value={data?.stats.arguments_made ?? 0}
                    color="text-emerald"
                    loading={loading}
                  />
                  <StatCard
                    icon={BarChart2}
                    label="New Topics"
                    value={data?.stats.new_topics ?? 0}
                    color="text-purple"
                    loading={loading}
                  />
                  <StatCard
                    icon={Gavel}
                    label="Laws Passed"
                    value={data?.stats.laws_passed ?? 0}
                    color="text-gold"
                    loading={loading}
                  />
                  <StatCard
                    icon={Users}
                    label="Active Debaters"
                    value={data?.stats.active_debaters ?? 0}
                    color="text-against-300"
                    loading={loading}
                  />
                  <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 flex flex-col justify-between">
                    <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">
                      Explore More
                    </span>
                    <div className="flex flex-col gap-1 mt-2">
                      <Link
                        href="/surge"
                        className="text-xs font-mono text-for-400 hover:text-for-300 flex items-center gap-1 transition-colors"
                      >
                        <Flame className="h-3 w-3" aria-hidden="true" />
                        Surge
                      </Link>
                      <Link
                        href="/senate"
                        className="text-xs font-mono text-gold hover:text-gold/80 flex items-center gap-1 transition-colors"
                      >
                        <Scale className="h-3 w-3" aria-hidden="true" />
                        Senate
                      </Link>
                      <Link
                        href="/leaderboard/today"
                        className="text-xs font-mono text-emerald hover:text-emerald/80 flex items-center gap-1 transition-colors"
                      >
                        <TrendingUp className="h-3 w-3" aria-hidden="true" />
                        Leaders
                      </Link>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── Hot topic ───────────────────────────────────────────── */}
              <HotTopicCard
                topic={data?.topTopic ?? null}
                loading={loading}
              />

              {/* ── Top argument ────────────────────────────────────────── */}
              <TopArgumentCard
                argument={data?.topArgument ?? null}
                loading={loading}
              />

              {/* ── Recent law ──────────────────────────────────────────── */}
              <RecentLawCard
                law={data?.recentLaw ?? null}
                loading={loading}
              />

              {/* ── Voting now ──────────────────────────────────────────── */}
              <VotingNowCard
                topics={data?.votingNow ?? []}
                loading={loading}
              />

              {/* ── Footer links ────────────────────────────────────────── */}
              {!loading && (
                <nav
                  aria-label="Related pages"
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono text-surface-500 pt-2"
                >
                  <Link href="/newspaper" className="hover:text-white transition-colors flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    Lobby Dispatch
                  </Link>
                  <Link href="/digest" className="hover:text-white transition-colors flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    Weekly Digest
                  </Link>
                  <Link href="/almanac" className="hover:text-white transition-colors flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    On This Day
                  </Link>
                  <Link href="/timeline" className="hover:text-white transition-colors flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    Full Timeline
                  </Link>
                </nav>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
