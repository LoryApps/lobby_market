'use client'

/**
 * /relays/today — Relay Daily Spotlight
 *
 * A curated daily snapshot of relay activity:
 *   • Headline stats for today (legs, contributors, completions)
 *   • Today's spotlight relay — the most active chain right now
 *   • Top relay legs of the day (by community upvotes)
 *   • Top contributors today
 *   • Category activity breakdown
 *
 * Distinct from:
 *   /relays/pulse   — raw live stream of every leg as it lands
 *   /relays/weekly  — weekly champion showcase
 *   /relays/stats   — all-time platform analytics
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  GitMerge,
  RefreshCw,
  Star,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  TodayRelayResponse,
  SpotlightRelay,
  TopLegToday,
  TopContributorToday,
  CategoryBreakdown,
} from '@/app/api/relays/today/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Category colors ───────────────────────────────────────────────────────────

const CATEGORY_BAR: Record<string, string> = {
  Politics: 'bg-for-500',
  Economics: 'bg-gold',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-against-400',
  Philosophy: 'bg-for-300',
  Culture: 'bg-gold',
  Health: 'bg-against-300',
  Environment: 'bg-emerald',
  Education: 'bg-purple',
}

const CATEGORY_TEXT: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: typeof Flame
  label: string
  value: number
  color: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl bg-surface-100 border border-surface-300 p-5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 uppercase tracking-wider">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        {label}
      </div>
      <div className={cn('text-3xl font-mono font-bold tabular-nums', color)}>
        {value.toLocaleString()}
      </div>
    </motion.div>
  )
}

// ─── Spotlight relay card ─────────────────────────────────────────────────────

function SpotlightCard({ relay }: { relay: SpotlightRelay }) {
  const isFor = relay.side === 'for'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10 border-for-500/30' : 'bg-against-500/10 border-against-500/30'
  const sideBar = isFor ? 'bg-for-500' : 'bg-against-500'
  const catColor = CATEGORY_TEXT[relay.topic_category ?? ''] ?? 'text-surface-400'

  const pct = relay.leg_count / relay.max_legs
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling
  const compellingPct = totalVotes > 0 ? Math.round((relay.vote_compelling / totalVotes) * 100) : null

  const statusLabel =
    relay.status === 'complete'
      ? 'Complete'
      : relay.status === 'voted'
      ? 'Voted'
      : relay.status === 'in_progress'
      ? 'In Progress'
      : 'Open'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-300">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Trophy className="h-4 w-4 text-gold flex-shrink-0" />
          <span className="text-xs font-mono text-gold uppercase tracking-wider font-semibold">
            Today&apos;s Spotlight Relay
          </span>
        </div>
        <span
          className={cn(
            'text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            relay.status === 'complete'
              ? 'text-emerald border-emerald/30 bg-emerald/10'
              : relay.status === 'in_progress'
              ? 'text-gold border-gold/30 bg-gold/10'
              : 'text-surface-400 border-surface-400/30 bg-surface-200/50'
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="p-5">
        {/* Topic statement */}
        {relay.topic_statement && (
          <Link
            href={`/topic/${relay.topic_id}`}
            className="block text-sm font-semibold text-white leading-snug hover:text-for-300 transition-colors mb-3"
          >
            {relay.topic_statement.length > 120
              ? relay.topic_statement.slice(0, 120) + '…'
              : relay.topic_statement}
          </Link>
        )}

        <div className="flex items-center gap-2 mb-4">
          <span className={cn('text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border', sideBg, sideColor)}>
            {isFor ? 'FOR' : 'AGAINST'}
          </span>
          {relay.topic_category && (
            <span className={cn('text-[10px] font-mono', catColor)}>
              {relay.topic_category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-500">
            {relay.legs_today} leg{relay.legs_today !== 1 ? 's' : ''} added today
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] font-mono text-surface-500 mb-1.5">
            <span>Progress</span>
            <span className="text-white font-medium">{relay.leg_count}/{relay.max_legs} legs</span>
          </div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', sideBar)}
              style={{ width: `${Math.min(pct * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Compelling rate */}
        {compellingPct !== null && (
          <div className="mb-4 text-xs font-mono text-surface-500">
            <span className="text-emerald font-semibold">{compellingPct}%</span> of voters found this chain compelling
            <span className="text-surface-600 ml-2">({totalVotes} votes)</span>
          </div>
        )}

        {/* Starter */}
        <div className="flex items-center gap-2 mb-4">
          <Avatar
            src={relay.starter_avatar_url}
            fallback={relay.starter_display_name || relay.starter_username}
            size="xs"
          />
          <span className="text-xs text-surface-400 font-mono">
            Started by{' '}
            <Link
              href={`/profile/${relay.starter_username}`}
              className="text-white hover:text-for-300 transition-colors"
            >
              @{relay.starter_username}
            </Link>
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link
            href={`/relays/${relay.relay_id}`}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold',
              'transition-all',
              isFor
                ? 'bg-for-600/20 border border-for-600/40 text-for-400 hover:bg-for-600/30'
                : 'bg-against-600/20 border border-against-600/40 text-against-400 hover:bg-against-600/30'
            )}
          >
            View Relay <ArrowRight className="h-3 w-3" />
          </Link>
          {relay.topic_id && (
            <Link
              href={`/topic/${relay.topic_id}/relays`}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
            >
              All Relays <GitMerge className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Top legs panel ────────────────────────────────────────────────────────────

function TopLegsPanel({ legs }: { legs: TopLegToday[] }) {
  if (legs.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No legs yet today"
        description="Be the first to contribute a relay leg today."
      />
    )
  }

  return (
    <div className="space-y-3">
      {legs.map((leg, i) => {
        const isFor = leg.side === 'for'
        const sideColor = isFor ? 'text-for-400' : 'text-against-400'
        const catColor = CATEGORY_TEXT[leg.topic_category ?? ''] ?? 'text-surface-400'

        return (
          <motion.div
            key={leg.leg_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.05 * i }}
            className="rounded-xl bg-surface-100 border border-surface-300 p-4"
          >
            <div className="flex items-start gap-3">
              {/* Rank */}
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-200 border border-surface-300 flex items-center justify-center text-[11px] font-mono font-bold text-surface-500">
                {i + 1}
              </div>

              <div className="flex-1 min-w-0">
                {/* Meta */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                  <span className={cn('text-[10px] font-mono font-bold', sideColor)}>
                    {isFor ? 'FOR' : 'AGAINST'}
                  </span>
                  <span className="text-[10px] font-mono text-surface-600">Leg {leg.leg_number}</span>
                  {leg.topic_category && (
                    <span className={cn('text-[10px] font-mono', catColor)}>
                      {leg.topic_category}
                    </span>
                  )}
                </div>

                {/* Topic */}
                {leg.topic_statement && (
                  <Link
                    href={`/relays/${leg.relay_id}`}
                    className="block text-[11px] text-surface-400 hover:text-white transition-colors mb-1.5 line-clamp-1"
                  >
                    {leg.topic_statement}
                  </Link>
                )}

                {/* Content */}
                <p className="text-sm text-white leading-relaxed line-clamp-2 mb-2">
                  {leg.content}
                </p>

                {/* Footer */}
                <div className="flex items-center gap-3 text-[11px] font-mono text-surface-500">
                  <div className="flex items-center gap-1">
                    <Avatar
                      src={leg.author_avatar_url}
                      fallback={leg.author_display_name || leg.author_username}
                      size="xs"
                    />
                    <Link
                      href={`/profile/${leg.author_username}`}
                      className="hover:text-white transition-colors"
                    >
                      @{leg.author_username}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1 text-gold">
                    <Star className="h-3 w-3 fill-gold" />
                    <span>{leg.upvote_count}</span>
                  </div>
                  <span>{relativeTime(leg.created_at)}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Top contributors panel ────────────────────────────────────────────────────

function ContributorsPanel({ contributors }: { contributors: TopContributorToday[] }) {
  if (contributors.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No contributors yet today"
        description="Contribute to a relay chain to appear here."
      />
    )
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-2">
      {contributors.map((c, i) => (
        <motion.div
          key={c.author_id}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.05 * i }}
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300"
        >
          <span className="text-base w-6 text-center flex-shrink-0">
            {medals[i] ?? `${i + 1}.`}
          </span>
          <Avatar
            src={c.author_avatar_url}
            fallback={c.author_display_name || c.author_username}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <Link
              href={`/profile/${c.author_username}`}
              className="block text-sm font-semibold text-white hover:text-for-300 transition-colors truncate"
            >
              {c.author_display_name || `@${c.author_username}`}
            </Link>
            <div className="text-[11px] font-mono text-surface-500">
              {c.legs_contributed} leg{c.legs_contributed !== 1 ? 's' : ''} contributed
            </div>
          </div>
          {c.total_upvotes > 0 && (
            <div className="flex items-center gap-1 text-xs font-mono text-gold flex-shrink-0">
              <Star className="h-3 w-3 fill-gold" />
              {c.total_upvotes}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

// ─── Category breakdown ────────────────────────────────────────────────────────

function CategoryPanel({ breakdown }: { breakdown: CategoryBreakdown[] }) {
  if (breakdown.length === 0) return null

  const maxLegs = Math.max(...breakdown.map((b) => b.legs_count))

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
      <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-4">
        <BarChart2 className="h-3.5 w-3.5 text-purple" />
        Today by Category
      </div>
      <div className="space-y-2.5">
        {breakdown.map((cat) => {
          const pct = (cat.legs_count / maxLegs) * 100
          const barColor = CATEGORY_BAR[cat.category] ?? 'bg-surface-400'
          const textColor = CATEGORY_TEXT[cat.category] ?? 'text-surface-400'

          return (
            <div key={cat.category}>
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <span className={cn('font-semibold', textColor)}>{cat.category}</span>
                <div className="text-surface-500">
                  <span className="text-white">{cat.legs_count}</span> leg{cat.legs_count !== 1 ? 's' : ''}{' '}
                  · {cat.relay_count} relay{cat.relay_count !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function TodaySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300 p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TodayRelayClient() {
  const [data, setData] = useState<TodayRelayResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relays/today')
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      setData(json)
    } catch {
      setError('Could not load today\'s relay data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const today = data?.as_of ? formatDate(data.as_of) : ''

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <Link
            href="/relays"
            className="p-2 rounded-xl bg-surface-100 border border-surface-300 text-surface-400 hover:text-white transition-colors"
            aria-label="Back to relays"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-gold" />
              <h1 className="text-lg font-bold text-white">Relay Today</h1>
            </div>
            {today && (
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">{today}</p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh"
            className="p-2 rounded-xl bg-surface-100 border border-surface-300 text-surface-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <TodaySkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center">
            <p className="text-against-400 text-sm font-mono">{error}</p>
            <button
              onClick={load}
              className="mt-3 flex items-center gap-1.5 mx-auto text-xs font-mono text-surface-400 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={Zap}
                label="Legs Today"
                value={data.stats.legs_today}
                color="text-gold"
                delay={0}
              />
              <StatCard
                icon={Users}
                label="Contributors"
                value={data.stats.contributors_today}
                color="text-purple"
                delay={0.05}
              />
              <StatCard
                icon={CheckCircle2}
                label="Completions"
                value={data.stats.completions_today}
                color="text-emerald"
                delay={0.1}
              />
              <StatCard
                icon={ThumbsUp}
                label="Compelling Votes"
                value={data.stats.compelling_votes_today}
                color="text-for-400"
                delay={0.15}
              />
            </div>

            {/* No activity yet today */}
            {data.stats.legs_today === 0 && (
              <EmptyState
                icon={Clock}
                title="Nothing yet today"
                description="Relay activity refreshes each UTC day. Be the first to contribute a leg!"
                action={{
                  label: 'Browse Open Relays',
                  href: '/relays',
                }}
              />
            )}

            {/* Spotlight relay */}
            {data.spotlight && <SpotlightCard relay={data.spotlight} />}

            {/* Category breakdown */}
            {data.category_breakdown.length > 0 && (
              <CategoryPanel breakdown={data.category_breakdown} />
            )}

            {/* Top legs */}
            {data.top_legs.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Top Legs Today</h2>
                  <span className="text-xs font-mono text-surface-500">by community upvotes</span>
                </div>
                <TopLegsPanel legs={data.top_legs} />
              </section>
            )}

            {/* Top contributors */}
            {data.top_contributors.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-4 w-4 text-gold" />
                  <h2 className="text-sm font-semibold text-white">Today&apos;s Builders</h2>
                </div>
                <ContributorsPanel contributors={data.top_contributors} />
              </section>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="rounded-2xl bg-gradient-to-br from-for-700/20 to-purple/10 border border-for-500/20 p-5"
            >
              <div className="flex items-start gap-3">
                <GitMerge className="h-5 w-5 text-for-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-1">
                    Build today&apos;s history
                  </p>
                  <p className="text-xs text-surface-400 mb-3">
                    Join an open relay chain and add your argument leg. Every contribution
                    shapes the civic record.
                  </p>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/relays"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-for-600/20 border border-for-600/40 text-for-400 hover:bg-for-600/30 transition-all"
                    >
                      Browse Open Relays <ArrowRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href="/relays/pulse"
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-semibold border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 transition-all"
                    >
                      <Flame className="h-3 w-3" /> Live Pulse
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Cross-links */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/relays/weekly"
                className="flex items-center gap-2 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <Trophy className="h-4 w-4 text-gold" />
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">
                    Relay of the Week
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">This week&apos;s champion</div>
                </div>
              </Link>
              <Link
                href="/relays/stats"
                className="flex items-center gap-2 p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <BarChart2 className="h-4 w-4 text-purple" />
                <div>
                  <div className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">
                    All-Time Stats
                  </div>
                  <div className="text-[10px] font-mono text-surface-500">Platform analytics</div>
                </div>
              </Link>
            </div>
          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
