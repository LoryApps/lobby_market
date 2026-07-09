'use client'

/**
 * /relays/league — Relay League
 *
 * Weekly competition for the most compelling civic relay chains.
 * Relays are scored by community compelling votes + leg star quality.
 * Resets each Monday at midnight UTC.
 *
 * Tabs:
 *   This Week  — relays completed this calendar week, ranked by score
 *   All Time   — hall of fame: the most compelling relays ever
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  ChevronDown,
  ChevronUp,
  Crown,
  GitMerge,
  RefreshCw,
  Star,
  ThumbsDown,
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
import type { LeagueRelay, LeagueResponse, LeagueStats } from '@/app/api/relays/league/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gold/20 border border-gold/50 flex-shrink-0">
      <Crown className="h-4 w-4 text-gold" />
    </div>
  )
  if (rank === 2) return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-surface-300/50 border border-surface-400/50 flex-shrink-0">
      <Trophy className="h-3.5 w-3.5 text-surface-300" />
    </div>
  )
  if (rank === 3) return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-against-500/15 border border-against-500/30 flex-shrink-0">
      <Award className="h-3.5 w-3.5 text-against-300" />
    </div>
  )
  return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-surface-200 border border-surface-300 flex-shrink-0">
      <span className="text-xs font-mono font-bold text-surface-500">{rank}</span>
    </div>
  )
}

// ─── League relay card ────────────────────────────────────────────────────────

function LeagueRelayCard({
  relay,
  rank,
  expanded,
  onToggle,
}: {
  relay: LeagueRelay
  rank: number
  expanded: boolean
  onToggle: () => void
}) {
  const isFor = relay.side === 'for'
  const totalVotes = relay.vote_compelling + relay.vote_not_compelling

  const rankBorder =
    rank === 1 ? 'border-gold/40' :
    rank === 2 ? 'border-surface-400/40' :
    rank === 3 ? 'border-against-500/30' :
    'border-surface-300'

  const rankGlow =
    rank === 1 ? 'bg-gold/3' :
    rank === 2 ? 'bg-surface-200/40' :
    rank === 3 ? 'bg-against-500/5' :
    ''

  return (
    <motion.div
      layout
      className={cn(
        'rounded-2xl border transition-colors overflow-hidden',
        rankBorder,
        rankGlow,
        'bg-surface-100'
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <RankMedal rank={rank} />

          <div className="flex-1 min-w-0">
            {/* Topic */}
            {relay.topic_statement ? (
              <Link
                href={`/topic/${relay.topic_id}`}
                className="text-sm font-mono font-semibold text-white hover:text-for-400 transition-colors line-clamp-2 leading-snug block"
              >
                {relay.topic_statement}
              </Link>
            ) : (
              <p className="text-sm font-mono font-semibold text-surface-400 leading-snug">
                Open topic relay
              </p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Side */}
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold border flex-shrink-0',
                  isFor
                    ? 'bg-for-500/10 border-for-500/30 text-for-400'
                    : 'bg-against-500/10 border-against-500/30 text-against-400'
                )}
              >
                {isFor ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
                {isFor ? 'FOR' : 'AGAINST'}
              </span>

              {relay.topic_category && (
                <span className="text-[10px] font-mono text-surface-500">{relay.topic_category}</span>
              )}

              {/* Leg count */}
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <GitMerge className="h-2.5 w-2.5" />
                {relay.leg_count}/{relay.max_legs} legs
              </span>

              {/* Star count */}
              {relay.total_leg_stars > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-gold">
                  <Star className="h-2.5 w-2.5 fill-gold" />
                  {relay.total_leg_stars}
                </span>
              )}

              <span className="text-[10px] font-mono text-surface-600 ml-auto">
                {relativeTime(relay.completed_at ?? relay.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-3 flex items-center gap-3">
          {/* League score */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border',
            rank === 1 ? 'bg-gold/10 border-gold/30' : 'bg-surface-200 border-surface-300'
          )}>
            <Zap className={cn('h-3 w-3', rank === 1 ? 'text-gold' : 'text-surface-500')} />
            <span className={cn('text-xs font-mono font-bold tabular-nums', rank === 1 ? 'text-gold' : 'text-white')}>
              {relay.league_score}
            </span>
            <span className="text-[10px] font-mono text-surface-500">pts</span>
          </div>

          {/* Compelling votes */}
          {totalVotes > 0 && (
            <>
              <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    relay.vote_compelling > relay.vote_not_compelling
                      ? 'bg-for-500'
                      : 'bg-against-500'
                  )}
                  style={{ width: `${relay.compelling_pct ?? 50}%` }}
                />
              </div>
              <span className="text-xs font-mono text-surface-400 flex-shrink-0">
                {relay.compelling_pct ?? 50}% compelling
              </span>
            </>
          )}
        </div>

        {/* Starter + toggle */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <Avatar
              src={relay.starter_avatar_url}
              fallback={relay.starter_display_name || relay.starter_username}
              size="xs"
            />
            <span className="text-[11px] font-mono text-surface-500">
              Started by{' '}
              <Link
                href={`/profile/${relay.starter_username}`}
                className="text-white hover:text-for-400 transition-colors"
              >
                {relay.starter_display_name ?? relay.starter_username}
              </Link>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/relays/${relay.id}`}
              className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              View
              <ArrowRight className="h-3 w-3" />
            </Link>
            <button
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse legs' : 'Expand legs'}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3 w-3" />Hide</>
              ) : (
                <><ChevronDown className="h-3 w-3" />Legs</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded legs */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            key="legs"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-300 divide-y divide-surface-300/60">
              {relay.legs.map((leg) => (
                <div key={leg.id} className="px-4 py-3 flex items-start gap-3">
                  <div className={cn(
                    'flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-mono font-bold',
                    isFor ? 'bg-for-500/15 text-for-400' : 'bg-against-500/15 text-against-400'
                  )}>
                    {leg.leg_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Avatar
                        src={leg.author_avatar_url}
                        fallback={leg.author_display_name || leg.author_username}
                        size="xs"
                      />
                      <Link
                        href={`/profile/${leg.author_username}`}
                        className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors truncate"
                      >
                        {leg.author_display_name ?? leg.author_username}
                      </Link>
                      {leg.upvote_count > 0 && (
                        <span className="ml-auto flex-shrink-0 flex items-center gap-0.5 text-[10px] font-mono text-gold">
                          <Star className="h-2.5 w-2.5 fill-gold" />
                          {leg.upvote_count}
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-[12px] font-mono leading-relaxed',
                      isFor ? 'text-for-200/90' : 'text-against-200/90'
                    )}>
                      {leg.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function LeagueSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
          <div className="flex gap-2 mt-1">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-1.5 flex-1 rounded-full" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
  )
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function WeekStats({ stats }: { stats: LeagueStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Relays started', value: stats.weekly_relays_started, icon: GitMerge, color: 'text-for-400' },
        { label: 'Legs written', value: stats.weekly_legs_written, icon: Users, color: 'text-purple' },
        { label: 'Compelling votes', value: stats.weekly_compelling_votes, icon: Zap, color: 'text-emerald' },
        { label: 'Total votes', value: stats.weekly_total_votes, icon: Trophy, color: 'text-gold' },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="flex flex-col gap-1 p-3.5 rounded-xl bg-surface-100 border border-surface-300">
          <div className="flex items-center gap-1.5">
            <Icon className={cn('h-3.5 w-3.5', color)} />
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">{label}</span>
          </div>
          <span className="text-xl font-mono font-bold text-white tabular-nums">{value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'week' | 'alltime'

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RelayLeagueClient() {
  const [data, setData] = useState<LeagueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('week')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/relays/league', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load league')
      setData(await res.json())
    } catch {
      setError('Could not load league data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const relays = tab === 'week' ? (data?.current_week ?? []) : (data?.all_time ?? [])

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/15 border border-gold/30 flex-shrink-0">
              <Trophy className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white leading-none">
                Relay League
              </h1>
              <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                Most compelling argument chains · scored by community votes
              </p>
            </div>
          </div>

          {data && (
            <div className="flex items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-400">
                <Zap className="h-3 w-3 text-for-400" />
                Week of {data.week_label}
              </span>
              <button
                onClick={load}
                disabled={loading}
                aria-label="Refresh"
                className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* ── Weekly stats ─────────────────────────────────────────────── */}
        {data && !loading && (
          <div className="mb-6">
            <WeekStats stats={data.stats} />
          </div>
        )}

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-5" role="tablist">
          {([
            { id: 'week' as Tab, label: 'This Week', icon: Zap },
            { id: 'alltime' as Tab, label: 'Hall of Fame', icon: Crown },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => { setTab(id); setExpandedId(null) }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-mono font-medium transition-colors',
                tab === id
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[1, 2, 3].map((i) => <LeagueSkeleton key={i} />)}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl bg-surface-100 border border-against-500/30 p-6 text-center"
            >
              <p className="text-sm font-mono text-against-300 mb-3">{error}</p>
              <button
                onClick={load}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:bg-surface-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </motion.div>
          ) : relays.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={GitMerge}
                title={tab === 'week' ? 'No relays completed this week yet' : 'No relay votes yet'}
                description={
                  tab === 'week'
                    ? 'Complete relay chains get rated by the community. Start a relay and fill all legs to qualify.'
                    : 'Relay chains with community votes will appear here.'
                }
                action={{ label: 'Browse open relays', href: '/relays' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`list-${tab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {relays.map((relay, i) => (
                <LeagueRelayCard
                  key={relay.id}
                  relay={relay}
                  rank={i + 1}
                  expanded={expandedId === relay.id}
                  onToggle={() => toggleExpand(relay.id)}
                />
              ))}

              {/* CTA */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/relays/create"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 text-white text-sm font-mono font-semibold hover:bg-for-500 transition-colors"
                >
                  <GitMerge className="h-4 w-4" />
                  Start a relay
                </Link>
                <Link
                  href="/relays"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-200 border border-surface-300 text-white text-sm font-mono font-semibold hover:bg-surface-300 transition-colors"
                >
                  Browse open relays
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
